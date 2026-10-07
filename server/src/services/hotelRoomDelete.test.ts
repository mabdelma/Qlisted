import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Deleting a room.
 *
 * `room_bookings.room_id` is a NOT NULL foreign key, so a room referenced by
 * any booking — even a long-finished stay — cannot be removed. The old code
 * issued the DELETE blind, Postgres raised a foreign-key violation, and the
 * client's `catch { /* ignore *\/ }` swallowed the 500. The button looked dead.
 *
 * These pin the refusal and, importantly, that it is a REFUSAL with a reason
 * rather than a silent success or a cascade. Deleting a room must never
 * quietly erase booking history.
 */

const rows = vi.hoisted(() => ({ rooms: [] as unknown[], bookings: [] as unknown[], deleted: [] as unknown[] }));

vi.mock('../db/index.js', () => {
  // Minimal query-builder stand-in: `select().from(X)` resolves to whichever
  // fixture matches the table it was handed.
  const chain = (table: string) => {
    const result = table === 'rooms' ? rows.rooms : rows.bookings;
    const self: Record<string, unknown> = {};
    for (const m of ['from', 'where', 'limit']) {
      self[m] = () => self;
    }
    (self as { then: unknown }).then = (res: (v: unknown) => unknown) => Promise.resolve(result).then(res);
    return self;
  };
  let nextTable = 'rooms';
  return {
    db: {
      select: () => ({
        from: (t: { _: { name?: string } } | unknown) => {
          const name = (t as { _?: { name?: string } })?._?.name;
          nextTable = name === 'room_bookings' ? 'bookings' : 'rooms';
          return chain(nextTable);
        },
      }),
      delete: () => ({ where: async () => { rows.deleted.push(1); } }),
    },
    schema: {
      rooms: { _: { name: 'rooms' }, id: 'id', tenantId: 'tenant_id', number: 'number' },
      roomBookings: { _: { name: 'room_bookings' }, id: 'id', roomId: 'room_id', status: 'status' },
    },
  };
});

vi.mock('drizzle-orm', () => ({
  eq: () => ({}), and: () => ({}), asc: () => ({}), desc: () => ({}),
  inArray: () => ({}), lt: () => ({}), gt: () => ({}), gte: () => ({}), sql: () => ({}),
}));
vi.mock('../lib/mail.js', () => ({ sendEmail: vi.fn(), brandedEmailHtml: vi.fn() }));
vi.mock('../lib/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../lib/sms.js', () => ({ sendSms: vi.fn() }));
vi.mock('./orderService.js', () => ({ createOrder: vi.fn() }));
vi.mock('./paymentService.js', () => ({ createPaymentLink: vi.fn() }));

const { deleteRoom } = await import('./hotelService.js');

beforeEach(() => {
  rows.rooms = [{ id: 'r1', number: '101' }];
  rows.bookings = [];
  rows.deleted = [];
});

describe('deleteRoom', () => {
  it('deletes a room nothing references', async () => {
    const res = await deleteRoom('t1', 'r1');
    expect(res).toEqual({ success: true });
    expect(rows.deleted).toHaveLength(1);
  });

  it('refuses, naming the room, when an active booking references it', async () => {
    rows.bookings = [{ id: 'b1', status: 'checked_in' }];
    const res = await deleteRoom('t1', 'r1') as { error?: string; status?: number };
    expect(res.status).toBe(409);
    expect(res.error).toContain('101');
    // The DELETE must not have been attempted — that is what raised the raw
    // foreign-key 500 before.
    expect(rows.deleted).toHaveLength(0);
  });

  it('refuses for past bookings too, since deleting would lose that history', async () => {
    rows.bookings = [{ id: 'b1', status: 'checked_out' }];
    const res = await deleteRoom('t1', 'r1') as { error?: string; status?: number };
    expect(res.status).toBe(409);
    expect(rows.deleted).toHaveLength(0);
  });

  it('404s for a room that does not belong to this tenant', async () => {
    rows.rooms = [];
    const res = await deleteRoom('t1', 'nope') as { error?: string; status?: number };
    expect(res.status).toBe(404);
    expect(rows.deleted).toHaveLength(0);
  });
});
