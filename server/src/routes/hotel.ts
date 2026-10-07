import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { resolveTenant, requireVenue } from '../middleware/tenant.js';
import * as svc from '../services/hotelService.js';

const hotel = new Hono();
// Rooms/bookings/folio/room-service are hotel features: reject tenants whose
// venueType doesn't include 'hotel' so a restaurant can't drive them by API.
const hotelOnly = [requireVenue('hotel', 'both')] as const;
const adminMgr = [authMiddleware, requireRole('admin', 'manager'), resolveTenant, ...hotelOnly] as const;
// Public guest routes: same venue gate, no auth.
const publicHotel = [resolveTenant, ...hotelOnly] as const;

const roomSchema = z.object({
  number: z.string().min(1),
  type: z.string().optional(),
  floor: z.string().optional(),
  status: z.enum(['available', 'occupied', 'cleaning', 'maintenance', 'reserved']).optional(),
  rate: z.number().nonnegative().optional(),
  notes: z.string().optional(),
  // Set from the upload endpoint's returned path, same as menu items.
  imageUrl: z.string().max(500).nullable().optional(),
});
// PATCH-shaped update: every field optional, but nothing unvalidated reaches
// updateRoom (which spreads this straight into the UPDATE set).
const roomUpdateSchema = z.object({
  number: z.string().min(1).optional(),
  type: z.string().optional(),
  floor: z.string().optional(),
  status: z.enum(['available', 'occupied', 'cleaning', 'maintenance', 'reserved']).optional(),
  rate: z.number().nonnegative().optional(),
  notes: z.string().optional(),
  housekeeperId: z.string().min(1).nullable().optional(),
  guestName: z.string().optional(),
});
const statusSchema = z.object({
  status: z.enum(['available', 'occupied', 'cleaning', 'maintenance', 'reserved']),
  guestName: z.string().optional(),
});

hotel.get('/:slug/rooms', ...adminMgr, async (c) => c.json(await svc.listRooms(c.get('tenantId'))));
hotel.get('/:slug/rooms/stats', ...adminMgr, async (c) => c.json(await svc.roomStats(c.get('tenantId'))));
hotel.get('/:slug/hotel-report', ...adminMgr, async (c) => {
  const r = await svc.hotelReport(c.get('tenantId'), c.req.query('from') || '', c.req.query('to') || '');
  return 'error' in r ? c.json(r, 400) : c.json(r);
});
hotel.get('/:slug/rooms/available', ...adminMgr, async (c) =>
  c.json(await svc.availableRooms(c.get('tenantId'), c.req.query('checkIn') || '', c.req.query('checkOut') || '')));
hotel.post('/:slug/rooms', ...adminMgr, zValidator('json', roomSchema), async (c) => {
  const tenantId = c.get('tenantId');
  const input = c.req.valid('json');
  const clash = await svc.roomNumberClash(tenantId, input.number);
  if (clash) return c.json({ error: clash }, 409);
  return c.json(await svc.createRoom(tenantId, input), 201);
});
hotel.put('/:slug/rooms/:id', ...adminMgr, zValidator('json', roomUpdateSchema), async (c) => {
  const tenantId = c.get('tenantId');
  const id = c.req.param('id')!;
  const input = c.req.valid('json');
  if (typeof input.number === 'string') {
    const clash = await svc.roomNumberClash(tenantId, input.number, id);
    if (clash) return c.json({ error: clash }, 409);
  }
  const r = await svc.updateRoom(tenantId, id, input);
  return 'error' in r ? c.json(r, 400) : c.json(r);
});
hotel.post('/:slug/rooms/:id/status', ...adminMgr, zValidator('json', statusSchema), async (c) => {
  const { status, guestName } = c.req.valid('json');
  return c.json(await svc.setRoomStatus(c.get('tenantId'), c.req.param('id')!, status, guestName));
});
hotel.delete('/:slug/rooms/:id', ...adminMgr, async (c) => {
  const r = await svc.deleteRoom(c.get('tenantId'), c.req.param('id')!);
  // A refusal carries its own status: 404 for a missing room, 409 when
  // bookings reference it. Previously this always answered 200 while the DELETE
  // had actually raised a foreign-key violation.
  return 'error' in r ? c.json({ error: r.error }, r.status) : c.json(r);
});
hotel.post('/:slug/rooms/:id/regenerate-token', ...adminMgr, async (c) =>
  c.json(await svc.regenerateServiceToken(c.get('tenantId'), c.req.param('id')!)));

// ── Reservations / check-in ─────────────────────────────────────────────────
const bookingSchema = z.object({
  roomId: z.string().min(1),
  guestName: z.string().min(1),
  guestEmail: z.string().email().optional().or(z.literal('')),
  guestPhone: z.string().optional(),
  checkIn: z.string().min(1),
  checkOut: z.string().min(1),
  notes: z.string().optional(),
});

hotel.get('/:slug/bookings', ...adminMgr, async (c) => c.json(await svc.listBookings(c.get('tenantId'))));
hotel.post('/:slug/bookings', ...adminMgr, zValidator('json', bookingSchema), async (c) => {
  const b = c.req.valid('json');
  const r = await svc.createBooking(c.get('tenantId'), { ...b, guestEmail: b.guestEmail || undefined });
  return 'error' in r ? c.json(r, 400) : c.json(r, 201);
});
hotel.post('/:slug/bookings/:id/check-in', ...adminMgr, async (c) =>
  c.json(await svc.checkIn(c.get('tenantId'), c.req.param('id')!)));
hotel.post('/:slug/bookings/:id/check-out', ...adminMgr, async (c) =>
  c.json(await svc.checkOut(c.get('tenantId'), c.req.param('id')!)));
hotel.post('/:slug/bookings/:id/cancel', ...adminMgr, async (c) =>
  c.json(await svc.cancelBooking(c.get('tenantId'), c.req.param('id')!)));

// ── Guest folio ─────────────────────────────────────────────────────────────
const folioItemSchema = z.object({ description: z.string().min(1), amount: z.number().nonnegative() });

hotel.get('/:slug/bookings/:id/folio', ...adminMgr, async (c) => {
  const r = await svc.getFolio(c.get('tenantId'), c.req.param('id')!);
  return 'error' in r ? c.json(r, 404) : c.json(r);
});
hotel.post('/:slug/bookings/:id/folio', ...adminMgr, zValidator('json', folioItemSchema), async (c) => {
  const r = await svc.addFolioItem(c.get('tenantId'), c.req.param('id')!, c.req.valid('json'));
  return 'error' in r ? c.json(r, 404) : c.json(r, 201);
});
hotel.delete('/:slug/folio/:id', ...adminMgr, async (c) =>
  c.json(await svc.deleteFolioItem(c.get('tenantId'), c.req.param('id')!)));
hotel.post('/:slug/bookings/:id/folio/pay-link', ...adminMgr, async (c) => {
  const r = await svc.folioPayLink(c.get('tenantId'), c.req.param('id')!);
  return 'error' in r ? c.json(r, 400) : c.json(r, 201);
});
hotel.post('/:slug/bookings/:id/folio/settle', ...adminMgr, async (c) => {
  const r = await svc.settleFolio(c.get('tenantId'), c.req.param('id')!);
  return 'error' in r ? c.json(r, 404) : c.json(r);
});
hotel.post('/:slug/bookings/:id/folio/deposit', ...adminMgr, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const r = await svc.takeDeposit(c.get('tenantId'), c.req.param('id')!, typeof body.amount === 'number' ? body.amount : undefined);
  return 'error' in r ? c.json(r, 400) : c.json(r, 201);
});

// ── Public booking engine (a guest reserving a room online) ─────────────────
const publicBookingSchema = z.object({
  roomId: z.string().min(1),
  guestName: z.string().min(1),
  guestEmail: z.string().email().optional().or(z.literal('')),
  guestPhone: z.string().optional(),
  checkIn: z.string().min(1),
  checkOut: z.string().min(1),
});

hotel.get('/:slug/book/availability', ...publicHotel, async (c) => {
  const checkIn = c.req.query('checkIn') || '';
  const checkOut = c.req.query('checkOut') || '';
  if (!checkIn || !checkOut || checkOut <= checkIn) return c.json([]);
  const rooms = await svc.availableRooms(c.get('tenantId'), checkIn, checkOut);
  // Never expose the service token or internal fields on a public endpoint.
  return c.json(rooms.map((r) => ({ id: r.id, number: r.number, type: r.type, rate: r.rate })));
});
hotel.post('/:slug/book', ...publicHotel, zValidator('json', publicBookingSchema), async (c) => {
  const b = c.req.valid('json');
  const tenantId = c.get('tenantId');
  const r = await svc.createBooking(tenantId, { ...b, guestEmail: b.guestEmail || undefined });
  if ('error' in r) return c.json(r, 400);
  // Offer an optional deposit link to secure the room online.
  const deposit = await svc.publicDepositLink(tenantId, r.id).catch(() => null);
  return c.json({ ...r, deposit }, 201);
});

// ── Room service (public — a checked-in guest ordering from their room) ──────
const roomServiceSchema = z.object({
  items: z.array(z.object({
    menuItemId: z.string().min(1),
    name: z.string().min(1),
    quantity: z.number().int().positive(),
    unitPrice: z.number().nonnegative(),
  })).min(1),
});

// ── Guest self-service stay (public, token-scoped) ──────────────────────────
// The token identifies exactly one booking. It decides who may act, never what
// is allowed: the same rules the front desk obeys are enforced in the service.
hotel.get('/:slug/stay/:token', ...publicHotel, async (c) => {
  const stay = await svc.bookingByAccessToken(c.get('tenantId'), c.req.param('token')!);
  if (!stay) return c.json({ error: 'stay not found' }, 404);
  // Never expose the room's service token before the guest is actually checked
  // in — that link is what lets anyone order to the room.
  const { serviceToken, ...rest } = stay;
  return c.json({ ...rest, serviceToken: stay.status === 'checked_in' ? serviceToken : null });
});

hotel.post('/:slug/stay/:token/check-in', ...publicHotel, async (c) => {
  const r = await svc.selfCheckIn(c.get('tenantId'), c.req.param('token')!);
  return c.json(r, r.status);
});

hotel.post('/:slug/stay/:token/check-out', ...publicHotel, async (c) => {
  const r = await svc.selfCheckOut(c.get('tenantId'), c.req.param('token')!);
  return c.json(r, r.status);
});

hotel.get('/:slug/room/:token/stay', ...publicHotel, async (c) => {
  const stay = await svc.activeStay(c.get('tenantId'), c.req.param('token')!);
  return c.json({ active: !!stay, guestName: stay?.guestName ?? null, roomNumber: stay?.roomNumber ?? null });
});
// Serves ONLY items flagged for in-room delivery, and 400s on a dead token —
// the guest page no longer has to fetch the whole public menu and filter.
hotel.get('/:slug/room/:token/menu', ...publicHotel, async (c) => {
  const r = await svc.roomServiceMenu(c.get('tenantId'), c.req.param('token')!);
  return 'error' in r ? c.json(r, 400) : c.json(r);
});
hotel.post('/:slug/room/:token/order', ...publicHotel, zValidator('json', roomServiceSchema), async (c) => {
  const r = await svc.placeRoomServiceOrder(c.get('tenantId'), c.req.param('token')!, c.req.valid('json').items);
  return 'error' in r ? c.json(r, 400) : c.json(r, 201);
});

export default hotel;
