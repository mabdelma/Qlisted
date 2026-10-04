import { db, schema } from '../db/index.js';
import { eq, and, asc, desc, inArray, lt, gt, gte } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { sendEmail, brandedEmailHtml } from '../lib/mail.js';
import { logger } from '../lib/logger.js';
import { createOrder } from './orderService.js';
import { createPaymentLink } from './paymentService.js';
import { sendSms } from '../lib/sms.js';

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export type RoomStatus = 'available' | 'occupied' | 'cleaning' | 'maintenance' | 'reserved';
const STATUSES: RoomStatus[] = ['available', 'occupied', 'cleaning', 'maintenance', 'reserved'];

/** All rooms for a property, ordered by floor then number. */
export async function listRooms(tenantId: string) {
  return db
    .select()
    .from(schema.rooms)
    .where(eq(schema.rooms.tenantId, tenantId))
    .orderBy(asc(schema.rooms.floor), asc(schema.rooms.number));
}

/** Short, unguessable token for a room's in-room service QR link. */
const newServiceToken = () => uuid().replace(/-/g, '') + uuid().replace(/-/g, '').slice(0, 4);

export async function createRoom(
  tenantId: string,
  data: { number: string; type?: string; floor?: string; status?: RoomStatus; rate?: number; notes?: string },
) {
  const id = uuid();
  await db.insert(schema.rooms).values({ id, tenantId, serviceToken: newServiceToken(), ...data });
  return { id };
}

/** Rotate a room's service token (invalidates the old QR link). */
export async function regenerateServiceToken(tenantId: string, id: string) {
  const serviceToken = newServiceToken();
  await db.update(schema.rooms).set({ serviceToken, updatedAt: new Date().toISOString() })
    .where(and(eq(schema.rooms.id, id), eq(schema.rooms.tenantId, tenantId)));
  return { serviceToken };
}

export async function updateRoom(
  tenantId: string,
  id: string,
  data: Partial<{ number: string; type: string; floor: string; status: RoomStatus; rate: number; housekeeperId: string | null; guestName: string; notes: string }>,
) {
  // The assigner must be a real user of THIS tenant — the column is a FK to
  // users.id, which on its own would happily accept another tenant's user id.
  if (data.housekeeperId) {
    const [hk] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(and(eq(schema.users.id, data.housekeeperId), eq(schema.users.tenantId, tenantId)))
      .limit(1);
    if (!hk) return { error: 'housekeeper not found in this tenant' as const };
  }
  await db
    .update(schema.rooms)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(and(eq(schema.rooms.id, id), eq(schema.rooms.tenantId, tenantId)));
  return { success: true };
}

/** Housekeeping / front-desk status change. Clearing the room (available) drops the guest name. */
export async function setRoomStatus(tenantId: string, id: string, status: RoomStatus, guestName?: string) {
  if (!STATUSES.includes(status)) return { error: 'invalid status' as const };
  const patch: Record<string, string | null> = { status, updatedAt: new Date().toISOString() };
  if (status === 'available') patch.guestName = null;
  else if (guestName !== undefined) patch.guestName = guestName;
  await db.update(schema.rooms).set(patch).where(and(eq(schema.rooms.id, id), eq(schema.rooms.tenantId, tenantId)));
  return { success: true };
}

export async function deleteRoom(tenantId: string, id: string) {
  await db.delete(schema.rooms).where(and(eq(schema.rooms.id, id), eq(schema.rooms.tenantId, tenantId)));
  return { success: true };
}

// ── Reservations / check-in ─────────────────────────────────────────────────

/** Bookings for a property, newest check-in first, with the room number joined. */
export async function listBookings(tenantId: string) {
  return db
    .select({
      id: schema.roomBookings.id,
      roomId: schema.roomBookings.roomId,
      roomNumber: schema.rooms.number,
      guestName: schema.roomBookings.guestName,
      guestEmail: schema.roomBookings.guestEmail,
      guestPhone: schema.roomBookings.guestPhone,
      checkIn: schema.roomBookings.checkIn,
      checkOut: schema.roomBookings.checkOut,
      status: schema.roomBookings.status,
      ratePerNight: schema.roomBookings.ratePerNight,
      total: schema.roomBookings.total,
      notes: schema.roomBookings.notes,
    })
    .from(schema.roomBookings)
    .leftJoin(schema.rooms, eq(schema.roomBookings.roomId, schema.rooms.id))
    .where(eq(schema.roomBookings.tenantId, tenantId))
    .orderBy(desc(schema.roomBookings.checkIn));
}

/** Whole nights between two YYYY-MM-DD dates (>= 1). */
function nightsBetween(checkIn: string, checkOut: string): number {
  const ms = new Date(checkOut + 'T00:00:00Z').getTime() - new Date(checkIn + 'T00:00:00Z').getTime();
  return Math.max(1, Math.round(ms / 86400000));
}

/** Rooms with no active (booked/checked_in) booking overlapping [checkIn, checkOut). */
export async function availableRooms(tenantId: string, checkIn: string, checkOut: string) {
  const all = await listRooms(tenantId);
  if (!checkIn || !checkOut || checkOut <= checkIn) return all;
  const clashing = await db.select({ roomId: schema.roomBookings.roomId }).from(schema.roomBookings)
    .where(and(
      eq(schema.roomBookings.tenantId, tenantId),
      inArray(schema.roomBookings.status, ['booked', 'checked_in']),
      lt(schema.roomBookings.checkIn, checkOut),
      gt(schema.roomBookings.checkOut, checkIn),
    ));
  const taken = new Set(clashing.map((c) => c.roomId));
  return all.filter((r) => !taken.has(r.id));
}

export async function createBooking(
  tenantId: string,
  data: { roomId: string; guestName: string; guestEmail?: string; guestPhone?: string; checkIn: string; checkOut: string; notes?: string },
) {
  // Room must belong to this tenant.
  const room = await db.select({ id: schema.rooms.id, number: schema.rooms.number, rate: schema.rooms.rate }).from(schema.rooms)
    .where(and(eq(schema.rooms.id, data.roomId), eq(schema.rooms.tenantId, tenantId)));
  if (room.length === 0) return { error: 'room not found' as const };
  if (data.checkOut <= data.checkIn) return { error: 'check-out must be after check-in' as const };

  // Conflict detection: reject overlapping active bookings for the same room.
  // Half-open ranges [checkIn, checkOut) overlap when start < otherEnd && end > otherStart.
  const clashes = await db.select({ id: schema.roomBookings.id }).from(schema.roomBookings)
    .where(and(
      eq(schema.roomBookings.tenantId, tenantId),
      eq(schema.roomBookings.roomId, data.roomId),
      inArray(schema.roomBookings.status, ['booked', 'checked_in']),
      lt(schema.roomBookings.checkIn, data.checkOut),
      gt(schema.roomBookings.checkOut, data.checkIn),
    ));
  if (clashes.length > 0) return { error: 'those dates overlap an existing booking for this room' as const };

  const ratePerNight = room[0].rate || 0;
  const total = ratePerNight * nightsBetween(data.checkIn, data.checkOut);
  const id = uuid();
  await db.insert(schema.roomBookings).values({ id, tenantId, ...data, ratePerNight, total });
  // Mark the room reserved (unless already occupied) so the board reflects the hold.
  await db.update(schema.rooms).set({ status: 'reserved', guestName: data.guestName, updatedAt: new Date().toISOString() })
    .where(and(eq(schema.rooms.id, data.roomId), eq(schema.rooms.tenantId, tenantId), eq(schema.rooms.status, 'available')));

  if (data.guestEmail) void sendBookingConfirmation(tenantId, data.guestEmail, data.guestName, room[0].number, data.checkIn, data.checkOut);
  if (data.guestPhone) void sendBookingSms(tenantId, data.guestPhone, room[0].number, data.checkIn, data.checkOut);
  return { id };
}

/** Fire-and-forget SMS confirmation (degrades to a log if Twilio isn't configured). */
async function sendBookingSms(tenantId: string, to: string, roomNumber: string, checkIn: string, checkOut: string) {
  try {
    const [tenant] = await db.select({ name: schema.tenants.name }).from(schema.tenants).where(eq(schema.tenants.id, tenantId));
    const name = tenant?.name || 'Qlisted';
    await sendSms(to, `${name}: booking confirmed — Room ${roomNumber}, ${checkIn} to ${checkOut}.`);
  } catch (e) {
    logger.warn({ err: e }, 'booking SMS failed');
  }
}

/** Fire-and-forget guest confirmation email; failures are logged, never block the booking. */
async function sendBookingConfirmation(tenantId: string, to: string, guestName: string, roomNumber: string, checkIn: string, checkOut: string) {
  try {
    const [tenant] = await db.select({ name: schema.tenants.name, primaryColor: schema.tenants.primaryColor })
      .from(schema.tenants).where(eq(schema.tenants.id, tenantId));
    const name = tenant?.name || 'Qlisted';
    const content = `
      <h2 style="margin:0 0 12px">Booking confirmed</h2>
      <p>Hi ${escapeHtml(guestName)}, your reservation at <strong>${escapeHtml(name)}</strong> is confirmed.</p>
      <table style="border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:4px 16px 4px 0;color:#666">Room</td><td style="padding:4px 0"><strong>${escapeHtml(roomNumber)}</strong></td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#666">Check-in</td><td style="padding:4px 0"><strong>${escapeHtml(checkIn)}</strong></td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#666">Check-out</td><td style="padding:4px 0"><strong>${escapeHtml(checkOut)}</strong></td></tr>
      </table>
      <p>We look forward to hosting you.</p>`;
    await sendEmail({ to, subject: `Booking confirmed — ${name}`, html: brandedEmailHtml(content, name, tenant?.primaryColor) });
  } catch (e) {
    logger.warn({ err: e }, 'booking confirmation email failed');
  }
}

async function bookingWithRoom(tenantId: string, id: string) {
  const rows = await db.select().from(schema.roomBookings)
    .where(and(eq(schema.roomBookings.id, id), eq(schema.roomBookings.tenantId, tenantId)));
  return rows[0];
}

/** Check a guest in: booking → checked_in, room → occupied with the guest name. */
export async function checkIn(tenantId: string, id: string) {
  const b = await bookingWithRoom(tenantId, id);
  if (!b) return { error: 'booking not found' as const };
  const now = new Date().toISOString();
  await db.update(schema.roomBookings).set({ status: 'checked_in', updatedAt: now })
    .where(and(eq(schema.roomBookings.id, id), eq(schema.roomBookings.tenantId, tenantId)));
  await db.update(schema.rooms).set({ status: 'occupied', guestName: b.guestName, updatedAt: now })
    .where(and(eq(schema.rooms.id, b.roomId), eq(schema.rooms.tenantId, tenantId)));
  if (b.guestEmail) void sendCheckInEmail(tenantId, id);
  return { success: true };
}

/**
 * Fire-and-forget welcome email at check-in with the guest's room-service link.
 * Sent here (not at booking) because the room's service token is only guaranteed
 * valid for the whole stay once the guest is checked in.
 */
async function sendCheckInEmail(tenantId: string, bookingId: string) {
  try {
    const [row] = await db
      .select({
        guestEmail: schema.roomBookings.guestEmail,
        guestName: schema.roomBookings.guestName,
        roomNumber: schema.rooms.number,
        serviceToken: schema.rooms.serviceToken,
        tenantName: schema.tenants.name,
        tenantSlug: schema.tenants.slug,
        primaryColor: schema.tenants.primaryColor,
      })
      .from(schema.roomBookings)
      .leftJoin(schema.rooms, eq(schema.roomBookings.roomId, schema.rooms.id))
      .leftJoin(schema.tenants, eq(schema.roomBookings.tenantId, schema.tenants.id))
      .where(and(eq(schema.roomBookings.id, bookingId), eq(schema.roomBookings.tenantId, tenantId)));
    if (!row?.guestEmail || !row.serviceToken || !row.tenantSlug) return;
    const base = (process.env.FRONTEND_URL || 'https://qlisted.com').replace(/\/$/, '');
    const link = `${base}/r/${row.tenantSlug}/room/${row.serviceToken}`;
    const name = row.tenantName || 'Qlisted';
    const color = row.primaryColor || '#8B4513';
    const content = `
      <h2 style="margin:0 0 12px">Welcome to ${escapeHtml(name)}</h2>
      <p>Hi ${escapeHtml(row.guestName)}, you're checked in${row.roomNumber ? ` to room <strong>${escapeHtml(row.roomNumber)}</strong>` : ''}. Enjoy your stay!</p>
      <p>Order room service straight to your room — anything you order is added to your bill:</p>
      <p style="margin:20px 0"><a href="${link}" style="display:inline-block;background:${color};color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">Open room service</a></p>
      <p style="font-size:12px;color:#888;word-break:break-all">${link}</p>`;
    await sendEmail({ to: row.guestEmail, subject: `You're checked in — ${name}`, html: brandedEmailHtml(content, name, color) });
  } catch (e) {
    logger.warn({ err: e }, 'check-in email failed');
  }
}

/**
 * Check a guest out: booking → checked_out, room → cleaning (housekeeping), guest
 * cleared. The room-service token is rotated so the departing guest's QR link
 * dies immediately — the next guest gets the fresh link at check-in.
 */
export async function checkOut(tenantId: string, id: string) {
  const b = await bookingWithRoom(tenantId, id);
  if (!b) return { error: 'booking not found' as const };
  const now = new Date().toISOString();
  await db.update(schema.roomBookings).set({ status: 'checked_out', updatedAt: now })
    .where(and(eq(schema.roomBookings.id, id), eq(schema.roomBookings.tenantId, tenantId)));
  await db.update(schema.rooms).set({ status: 'cleaning', guestName: null, serviceToken: newServiceToken(), updatedAt: now })
    .where(and(eq(schema.rooms.id, b.roomId), eq(schema.rooms.tenantId, tenantId)));
  return { success: true };
}

/** Cancel a booking. If the room was only reserved (not occupied), free it back up. */
export async function cancelBooking(tenantId: string, id: string) {
  const b = await bookingWithRoom(tenantId, id);
  if (!b) return { error: 'booking not found' as const };
  const now = new Date().toISOString();
  await db.update(schema.roomBookings).set({ status: 'cancelled', updatedAt: now })
    .where(and(eq(schema.roomBookings.id, id), eq(schema.roomBookings.tenantId, tenantId)));
  await db.update(schema.rooms).set({ status: 'available', guestName: null, updatedAt: now })
    .where(and(eq(schema.rooms.id, b.roomId), eq(schema.rooms.tenantId, tenantId), eq(schema.rooms.status, 'reserved')));
  return { success: true };
}

// ── Guest folio (room charge + posted extras → one bill) ────────────────────

/** Full folio for a booking: room charge, posted line items, and the grand total. */
export async function getFolio(tenantId: string, bookingId: string) {
  const [b] = await db
    .select({
      id: schema.roomBookings.id,
      guestName: schema.roomBookings.guestName,
      roomNumber: schema.rooms.number,
      checkIn: schema.roomBookings.checkIn,
      checkOut: schema.roomBookings.checkOut,
      status: schema.roomBookings.status,
      roomCharge: schema.roomBookings.total,
      deposit: schema.roomBookings.depositAmount,
      ratePerNight: schema.roomBookings.ratePerNight,
      paidAt: schema.roomBookings.folioPaidAt,
    })
    .from(schema.roomBookings)
    .leftJoin(schema.rooms, eq(schema.roomBookings.roomId, schema.rooms.id))
    .where(and(eq(schema.roomBookings.id, bookingId), eq(schema.roomBookings.tenantId, tenantId)));
  if (!b) return { error: 'booking not found' as const };
  const items = await db.select().from(schema.folioItems)
    .where(and(eq(schema.folioItems.bookingId, bookingId), eq(schema.folioItems.tenantId, tenantId)))
    .orderBy(asc(schema.folioItems.createdAt));
  const roomCharge = Number(b.roomCharge || 0);
  const extras = +items.reduce((s, i) => s + Number(i.amount || 0), 0).toFixed(2);
  const deposit = Number(b.deposit || 0);
  const grandTotal = +(roomCharge + extras).toFixed(2);
  return {
    booking: { id: b.id, guestName: b.guestName, roomNumber: b.roomNumber, checkIn: b.checkIn, checkOut: b.checkOut, status: b.status },
    roomCharge, items, extras, grandTotal, deposit,
    balance: +Math.max(0, grandTotal - deposit).toFixed(2),
    paidAt: b.paidAt,
  };
}

/** Generate a Stripe payment link for a booking's outstanding folio balance. */
export async function folioPayLink(tenantId: string, bookingId: string) {
  const folio = await getFolio(tenantId, bookingId);
  if ('error' in folio) return folio;
  if (folio.balance <= 0) return { error: 'nothing to charge' as const };
  const label = `Folio — ${folio.booking.guestName}${folio.booking.roomNumber ? `, Room ${folio.booking.roomNumber}` : ''}`;
  const link = await createPaymentLink(tenantId, undefined, folio.balance, label, { bookingId, kind: 'folio' });
  return { url: link.url, amount: folio.balance };
}

/**
 * Guest-facing deposit link for a fresh booking (one night's rate). Unlike the
 * staff takeDeposit, this does NOT record the amount up front — the webhook sets
 * depositAmount only once the guest actually pays. Returns null if no rate.
 */
export async function publicDepositLink(tenantId: string, bookingId: string) {
  const [b] = await db.select({ id: schema.roomBookings.id, guestName: schema.roomBookings.guestName, ratePerNight: schema.roomBookings.ratePerNight })
    .from(schema.roomBookings).where(and(eq(schema.roomBookings.id, bookingId), eq(schema.roomBookings.tenantId, tenantId)));
  if (!b) return null;
  const amount = Number(b.ratePerNight || 0);
  if (amount <= 0) return null;
  const link = await createPaymentLink(tenantId, undefined, amount, `Deposit — ${b.guestName}`, { bookingId, kind: 'deposit' });
  return { url: link.url, amount };
}

/** Take a deposit: default one night's rate. Records it and returns a Stripe pay link. */
export async function takeDeposit(tenantId: string, bookingId: string, amount?: number) {
  const [b] = await db.select({ id: schema.roomBookings.id, guestName: schema.roomBookings.guestName, ratePerNight: schema.roomBookings.ratePerNight })
    .from(schema.roomBookings).where(and(eq(schema.roomBookings.id, bookingId), eq(schema.roomBookings.tenantId, tenantId)));
  if (!b) return { error: 'booking not found' as const };
  const value = amount && amount > 0 ? +amount.toFixed(2) : Number(b.ratePerNight || 0);
  if (value <= 0) return { error: 'no deposit amount' as const };
  await db.update(schema.roomBookings).set({ depositAmount: value })
    .where(and(eq(schema.roomBookings.id, bookingId), eq(schema.roomBookings.tenantId, tenantId)));
  const link = await createPaymentLink(tenantId, undefined, value, `Deposit — ${b.guestName}`, { bookingId, kind: 'deposit' });
  return { url: link.url, amount: value };
}

/** Mark a booking's folio as settled (cash, or after a card payment). */
export async function settleFolio(tenantId: string, bookingId: string) {
  const [b] = await db.select({ id: schema.roomBookings.id }).from(schema.roomBookings)
    .where(and(eq(schema.roomBookings.id, bookingId), eq(schema.roomBookings.tenantId, tenantId)));
  if (!b) return { error: 'booking not found' as const };
  await db.update(schema.roomBookings).set({ folioPaidAt: new Date().toISOString() })
    .where(and(eq(schema.roomBookings.id, bookingId), eq(schema.roomBookings.tenantId, tenantId)));
  return { success: true };
}

export async function addFolioItem(tenantId: string, bookingId: string, data: { description: string; amount: number }) {
  const [b] = await db.select({ id: schema.roomBookings.id }).from(schema.roomBookings)
    .where(and(eq(schema.roomBookings.id, bookingId), eq(schema.roomBookings.tenantId, tenantId)));
  if (!b) return { error: 'booking not found' as const };
  const id = uuid();
  await db.insert(schema.folioItems).values({ id, tenantId, bookingId, description: data.description, amount: data.amount });
  return { id };
}

export async function deleteFolioItem(tenantId: string, id: string) {
  await db.delete(schema.folioItems).where(and(eq(schema.folioItems.id, id), eq(schema.folioItems.tenantId, tenantId)));
  return { success: true };
}

// ── Room service (guest orders from the in-room menu, posted to their folio) ──

/** The active (checked-in) stay for a room identified by its service token, or null. */
export async function activeStay(tenantId: string, token: string) {
  if (!token) return null;
  const [room] = await db.select({ id: schema.rooms.id }).from(schema.rooms)
    .where(and(eq(schema.rooms.tenantId, tenantId), eq(schema.rooms.serviceToken, token)));
  if (!room) return null;
  const [b] = await db
    .select({ bookingId: schema.roomBookings.id, guestName: schema.roomBookings.guestName, roomNumber: schema.rooms.number })
    .from(schema.roomBookings)
    .leftJoin(schema.rooms, eq(schema.roomBookings.roomId, schema.rooms.id))
    .where(and(
      eq(schema.roomBookings.tenantId, tenantId),
      eq(schema.roomBookings.roomId, room.id),
      eq(schema.roomBookings.status, 'checked_in'),
    ));
  return b || null;
}

/** Place a room-service order for a room's active stay (by token) and post it to the folio. */
export async function placeRoomServiceOrder(
  tenantId: string,
  token: string,
  items: { menuItemId: string; name: string; quantity: number; unitPrice: number }[],
) {
  const stay = await activeStay(tenantId, token);
  if (!stay) return { error: 'no active stay for this room' as const };

  // A guest can only order what the property currently offers for in-room
  // delivery: re-price server-side from the menu and drop anything unavailable
  // rather than trusting prices/names posted by the browser.
  const priced = await priceRoomServiceItems(tenantId, items);
  if (priced.length === 0) return { error: 'none of those items are available for room service' as const };

  const result = await createOrder(tenantId, {
    orderType: 'takeout',
    customerName: `Room ${stay.roomNumber} — ${stay.guestName}`,
    bookingId: stay.bookingId,
    items: priced,
  });
  if ('error' in result) return { error: result.error };

  // Post one folio line per item so the guest bill itemises what they ordered
  // (a single "Room service (3 items)" summary was unauditable and couldn't be
  // disputed line-by-line at checkout).
  for (const item of priced) {
    await addFolioItem(tenantId, stay.bookingId, {
      description: item.quantity > 1 ? `${item.name} ×${item.quantity}` : item.name,
      amount: +(item.unitPrice * item.quantity).toFixed(2),
    });
  }
  return { orderId: result.data.id, total: Number(result.data.total || 0) };
}

/**
 * In-room menu for a room's active stay: the tenant's `main` categories plus
 * only the items that are both generally available AND flagged for room service.
 * Validates the token up front so an invalid/rotated link gets the same
 * "no active stay" answer as /stay rather than leaking the menu.
 */
export async function roomServiceMenu(tenantId: string, token: string) {
  const stay = await activeStay(tenantId, token);
  if (!stay) return { error: 'no active stay for this room' as const };

  const categories = await db
    .select()
    .from(schema.menuCategories)
    .where(and(eq(schema.menuCategories.tenantId, tenantId), eq(schema.menuCategories.type, 'main')))
    .orderBy(asc(schema.menuCategories.sortOrder));
  const items = await db
    .select()
    .from(schema.menuItems)
    .where(and(
      eq(schema.menuItems.tenantId, tenantId),
      eq(schema.menuItems.available, true),
      eq(schema.menuItems.roomServiceAvailable, true),
    ))
    .orderBy(asc(schema.menuItems.sortOrder));

  // Drop categories that ended up with nothing deliverable.
  const byCategory = new Map(items.map((i) => [i.categoryId, 0]));
  for (const i of items) byCategory.set(i.categoryId, (byCategory.get(i.categoryId) ?? 0) + 1);
  const [tenant] = await db
    .select({ currency: schema.tenants.currency })
    .from(schema.tenants)
    .where(eq(schema.tenants.id, tenantId));
  return {
    guestName: stay.guestName,
    roomNumber: stay.roomNumber,
    currency: tenant?.currency ?? 'USD',
    categories: categories.filter((c) => byCategory.get(c.id)),
    items,
  };
}

/**
 * Re-resolve posted room-service lines against the live menu: keeps only items
 * that exist, are `available`, and are flagged for room service, and replaces
 * the client-supplied name/price with the authoritative menu values.
 */
async function priceRoomServiceItems(
  tenantId: string,
  items: { menuItemId: string; name: string; quantity: number; unitPrice: number }[],
) {
  const ids = [...new Set(items.map((i) => i.menuItemId))];
  if (ids.length === 0) return [];
  const rows = await db
    .select({
      id: schema.menuItems.id,
      name: schema.menuItems.name,
      price: schema.menuItems.price,
      available: schema.menuItems.available,
      roomServiceAvailable: schema.menuItems.roomServiceAvailable,
    })
    .from(schema.menuItems)
    .where(and(eq(schema.menuItems.tenantId, tenantId), inArray(schema.menuItems.id, ids)));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out: { menuItemId: string; name: string; quantity: number; unitPrice: number }[] = [];
  for (const item of items) {
    const row = byId.get(item.menuItemId);
    if (!row || !row.available || !row.roomServiceAvailable) continue;
    out.push({ menuItemId: row.id, name: row.name, quantity: item.quantity, unitPrice: Number(row.price || 0) });
  }
  return out;
}

/**
 * Hotel performance report over [from, to): occupancy, ADR (avg daily rate),
 * RevPAR (revenue per available room), room revenue, and arrivals/departures.
 * Attributed by check-in date within the range (simple, staff-legible).
 *
 * `occupancyPct` here is the *period* measure (sold nights ÷ available
 * room-nights) — see roomStats() for the live point-in-time one.
 */
export async function hotelReport(tenantId: string, from: string, to: string) {
  if (!from || !to || to <= from) return { error: 'invalid date range' as const };
  const roomRows = await db.select({ id: schema.rooms.id }).from(schema.rooms).where(eq(schema.rooms.tenantId, tenantId));
  const rooms = roomRows.length;
  const days = nightsBetween(from, to);
  const rows = await db
    .select({ checkIn: schema.roomBookings.checkIn, checkOut: schema.roomBookings.checkOut, total: schema.roomBookings.total, status: schema.roomBookings.status })
    .from(schema.roomBookings)
    .where(and(
      eq(schema.roomBookings.tenantId, tenantId),
      gte(schema.roomBookings.checkIn, from),
      lt(schema.roomBookings.checkIn, to),
    ));
  let soldNights = 0, revenue = 0, bookings = 0, arrivals = 0, departures = 0;
  for (const b of rows) {
    if (b.status === 'cancelled') continue;
    bookings++;
    soldNights += nightsBetween(b.checkIn, b.checkOut);
    revenue += Number(b.total || 0);
    if (b.checkIn >= from && b.checkIn < to) arrivals++;
    if (b.checkOut >= from && b.checkOut < to) departures++;
  }
  const availNights = rooms * days;
  return {
    from, to, rooms, days, bookings, arrivals, departures,
    soldNights,
    roomRevenue: +revenue.toFixed(2),
    occupancyPct: availNights ? Math.round((soldNights / availNights) * 100) : 0,
    adr: soldNights ? +(revenue / soldNights).toFixed(2) : 0,
    revpar: availNights ? +(revenue / availNights).toFixed(2) : 0,
  };
}

/**
 * Live occupancy summary for the front-desk header / dashboard.
 *
 * NOTE the deliberate difference from hotelReport(): this is a *point-in-time*
 * physical count (rooms whose status is `occupied` right now ÷ total rooms), so
 * it reacts instantly to a walk-in or a checkout. hotelReport() is a *period*
 * measure (sold nights ÷ available room-nights) used for revenue reporting.
 * They will not agree — that is expected, not a bug. Naming is explicit so
 * callers can't mix them up: `occupancy` here, `occupancyPct` in the report.
 */
export async function roomStats(tenantId: string) {
  const all = await db.select({ status: schema.rooms.status }).from(schema.rooms).where(eq(schema.rooms.tenantId, tenantId));
  const by: Record<RoomStatus, number> = { available: 0, occupied: 0, cleaning: 0, maintenance: 0, reserved: 0 };
  for (const r of all) by[r.status as RoomStatus]++;
  const total = all.length;
  const occupancy = total ? Math.round((by.occupied / total) * 100) : 0;
  return { total, occupancy, ...by };
}
