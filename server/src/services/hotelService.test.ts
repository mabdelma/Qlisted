import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createBooking, getFolio, availableRooms, settleFolio, folioPayLink, hotelReport, takeDeposit, roomStats, updateRoom, selfCheckIn, selfCheckOut } from './hotelService.js';
import { db } from '../db/index.js';

// Stub the cross-service calls hotelService makes so the tests stay unit-scoped.
vi.mock('./paymentService.js', () => ({
  createPaymentLink: vi.fn().mockResolvedValue({ id: 'link1', token: 'tok', url: '/pay/tok' }),
}));
vi.mock('./orderService.js', () => ({
  createOrder: vi.fn().mockResolvedValue({ data: { id: 'order1', total: 40 }, status: 201 }),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockDb = db as any;

describe('hotelService', () => {
  beforeEach(() => { vi.clearAllMocks(); mockDb.__setQueryQueue([]); });

  describe('createBooking — conflict detection', () => {
    const base = { roomId: 'r1', guestName: 'Alex', checkIn: '2026-07-10', checkOut: '2026-07-12' };

    it('rejects a range that overlaps an existing active booking', async () => {
      mockDb.__setQueryQueue([
        [{ id: 'r1', number: '101', rate: 100 }], // room lookup
        [{ id: 'existing' }],                     // an overlapping booking exists
      ]);
      const res = await createBooking('t1', base);
      expect('error' in res).toBe(true);
      if ('error' in res) expect(res.error).toMatch(/overlap/i);
    });

    it('rejects check-out on or before check-in', async () => {
      mockDb.__setQueryQueue([[{ id: 'r1', number: '101', rate: 100 }]]);
      const res = await createBooking('t1', { ...base, checkOut: '2026-07-10' });
      expect('error' in res && res.error).toMatch(/check-out/i);
    });

    it('rejects an unknown room', async () => {
      mockDb.__setQueryQueue([[]]); // room lookup returns nothing
      const res = await createBooking('t1', base);
      expect('error' in res && res.error).toMatch(/room not found/i);
    });

    it('creates the booking when there is no clash', async () => {
      mockDb.__setQueryQueue([
        [{ id: 'r1', number: '101', rate: 100 }], // room lookup
        [],                                        // no overlapping bookings
        [],                                        // room status update
      ]);
      const res = await createBooking('t1', base);
      expect('error' in res).toBe(false);
      if (!('error' in res)) expect(res.id).toBeTruthy();
      // 2 nights * 100 => stored total 200
      const insertArgs = mockDb.values.mock.calls.at(-1)?.[0];
      expect(insertArgs.ratePerNight).toBe(100);
      expect(insertArgs.total).toBe(200);
    });
  });

  describe('getFolio — bill math', () => {
    it('sums the room charge and extras into the grand total', async () => {
      mockDb.__setQueryQueue([
        [{ id: 'b1', guestName: 'Alex', roomNumber: '101', checkIn: '2026-07-10', checkOut: '2026-07-12', status: 'checked_in', roomCharge: 200, paidAt: null }],
        [{ id: 'f1', description: 'Minibar', amount: 12 }, { id: 'f2', description: 'Spa', amount: 40 }],
      ]);
      const folio = await getFolio('t1', 'b1');
      expect('error' in folio).toBe(false);
      if (!('error' in folio)) {
        expect(folio.roomCharge).toBe(200);
        expect(folio.extras).toBe(52);
        expect(folio.grandTotal).toBe(252);
      }
    });
  });

  describe('availableRooms', () => {
    it('excludes rooms with an overlapping active booking', async () => {
      mockDb.__setQueryQueue([
        [{ id: 'r1', number: '101' }, { id: 'r2', number: '102' }, { id: 'r3', number: '103' }], // all rooms (listRooms)
        [{ roomId: 'r2' }],                                                                       // r2 is taken
      ]);
      const free = await availableRooms('t1', '2026-07-10', '2026-07-12');
      expect(free.map((r) => r.id)).toEqual(['r1', 'r3']);
    });

    it('returns all rooms when the date range is invalid', async () => {
      mockDb.__setQueryQueue([[{ id: 'r1' }, { id: 'r2' }]]);
      const free = await availableRooms('t1', '2026-07-12', '2026-07-10');
      expect(free.length).toBe(2);
    });
  });

  describe('folio settlement', () => {
    it('settleFolio marks the booking paid', async () => {
      mockDb.__setQueryQueue([[{ id: 'b1' }], []]);
      const res = await settleFolio('t1', 'b1');
      expect('error' in res).toBe(false);
      const setArgs = mockDb.set.mock.calls.at(-1)?.[0];
      expect(setArgs.folioPaidAt).toBeTruthy();
    });

    it('hotelReport computes occupancy, ADR and RevPAR', async () => {
      mockDb.__setQueryQueue([
        [{ id: 'r1' }, { id: 'r2' }], // 2 rooms
        [
          { checkIn: '2026-07-05', checkOut: '2026-07-07', total: 200, status: 'checked_out' }, // 2 nights, 200
          { checkIn: '2026-07-10', checkOut: '2026-07-11', total: 150, status: 'booked' },       // 1 night, 150
          { checkIn: '2026-07-12', checkOut: '2026-07-14', total: 999, status: 'cancelled' },     // ignored
        ],
      ]);
      const r = await hotelReport('t1', '2026-07-01', '2026-07-31'); // 30 available days
      expect('error' in r).toBe(false);
      if (!('error' in r)) {
        expect(r.bookings).toBe(2);              // cancelled excluded
        expect(r.roomRevenue).toBe(350);
        expect(r.soldNights).toBe(3);
        expect(r.occupancyPct).toBe(5);          // 3 sold nights / (2 rooms * 30 days) = 5%
        expect(r.adr).toBeCloseTo(116.67, 1);    // 350 / 3 sold nights
        expect(r.revpar).toBeCloseTo(5.83, 1);   // 350 / 60 available room-nights
      }
    });

    it('takeDeposit defaults to one night and records the amount', async () => {
      mockDb.__setQueryQueue([
        [{ id: 'b1', guestName: 'Alex', ratePerNight: 120 }], // booking lookup
        [],                                                    // deposit update
      ]);
      const r = await takeDeposit('t1', 'b1');
      expect('error' in r).toBe(false);
      if (!('error' in r)) expect(r.amount).toBe(120);
      expect(mockDb.set.mock.calls.at(-1)?.[0].depositAmount).toBe(120);
    });

    it('getFolio subtracts a deposit into the balance', async () => {
      mockDb.__setQueryQueue([
        [{ id: 'b1', guestName: 'Alex', roomNumber: '101', checkIn: '2026-07-10', checkOut: '2026-07-12', status: 'checked_in', roomCharge: 200, deposit: 80, paidAt: null }],
        [],
      ]);
      const folio = await getFolio('t1', 'b1');
      if (!('error' in folio)) {
        expect(folio.deposit).toBe(80);
        expect(folio.balance).toBe(120);
      }
    });

    it('folioPayLink refuses a zero-total folio', async () => {
      mockDb.__setQueryQueue([
        [{ id: 'b1', guestName: 'Alex', roomNumber: '101', checkIn: '2026-07-10', checkOut: '2026-07-12', status: 'checked_in', roomCharge: 0, paidAt: null }],
        [],
      ]);
      const res = await folioPayLink('t1', 'b1');
      expect('error' in res && res.error).toMatch(/nothing to charge/i);
    });
  });

  // The two occupancy numbers answer different questions on purpose:
  // roomStats is a live physical count, hotelReport is a period measure.
  describe('occupancy — two deliberately different measures', () => {
    it('roomStats counts rooms physically occupied right now', async () => {
      mockDb.__setQueryQueue([
        [
          { status: 'occupied' }, { status: 'occupied' }, { status: 'occupied' },
          { status: 'available' }, { status: 'cleaning' }, { status: 'maintenance' },
          { status: 'reserved' },
        ],
      ]);
      const s = await roomStats('t1');
      expect(s.total).toBe(7);
      expect(s.occupied).toBe(3);
      expect(s.occupancy).toBe(43); // 3/7 of the house, right now
    });

    it('roomStats reports zero occupancy for a property with no rooms', async () => {
      mockDb.__setQueryQueue([[]]);
      const s = await roomStats('t1');
      expect(s.total).toBe(0);
      expect(s.occupancy).toBe(0);
    });
  });

  describe('updateRoom — housekeeper assignment', () => {
    it('rejects a housekeeper who is not a user of this tenant', async () => {
      mockDb.__setQueryQueue([[]]); // user lookup finds nothing
      const res = await updateRoom('t1', 'room1', { housekeeperId: 'user-from-another-tenant' });
      expect('error' in res && res.error).toMatch(/housekeeper not found/i);
    });

    it('accepts a housekeeper who belongs to this tenant', async () => {
      mockDb.__setQueryQueue([[{ id: 'u1' }], []]);
      const res = await updateRoom('t1', 'room1', { housekeeperId: 'u1' });
      expect('error' in res).toBe(false);
      expect(mockDb.set.mock.calls.at(-1)?.[0].housekeeperId).toBe('u1');
    });
  });

  describe('guest self check-in', () => {
    const stay = (over = {}) => ({
      id: 'b1', status: 'booked', guestName: 'Alex',
      checkIn: '2000-01-01', checkOut: '2999-01-01',
      total: 100, depositAmount: 0, folioPaidAt: null,
      roomNumber: '101', serviceToken: 'svc', ...over,
    });

    it('refuses an unknown token rather than leaking that it is unknown', async () => {
      mockDb.__setQueryQueue([[]]);
      const res = await selfCheckIn('t1', 'nope');
      expect(res.status).toBe(404);
    });

    it('refuses before the arrival date so a guest cannot take a room early', async () => {
      mockDb.__setQueryQueue([[stay({ checkIn: '2999-01-01', checkOut: '2999-01-02' })]]);
      const res = await selfCheckIn('t1', 'tok');
      expect(res.status).toBe(400);
      expect('error' in res && res.error).toMatch(/too early/i);
    });

    it('refuses once the stay has ended', async () => {
      mockDb.__setQueryQueue([[stay({ checkIn: '2000-01-01', checkOut: '2000-01-02' })]]);
      const res = await selfCheckIn('t1', 'tok');
      expect(res.status).toBe(400);
      expect('error' in res && res.error).toMatch(/ended/i);
    });
  });

  describe('guest self check-out', () => {
    const stay = (over = {}) => ({
      id: 'b1', status: 'checked_in', guestName: 'Alex',
      checkIn: '2000-01-01', checkOut: '2999-01-01',
      total: 100, depositAmount: 0, folioPaidAt: null,
      roomNumber: '101', serviceToken: 'svc', ...over,
    });

    it('refuses while the folio still owes money', async () => {
      mockDb.__setQueryQueue([
        [stay()],                                   // token lookup
        // getFolio's booking row: a 100 room charge with no deposit paid
        [{ id: 'b1', guestName: 'Alex', roomNumber: '101', checkIn: '2000-01-01',
           checkOut: '2999-01-01', status: 'checked_in', roomCharge: 100, deposit: 0, paidAt: null }],
        [],                                         // folio items
      ]);
      const res = await selfCheckOut('t1', 'tok');
      expect(res.status).toBe(400);
      expect('error' in res && res.error).toMatch(/settle/i);
    });

    it('is idempotent once already checked out', async () => {
      mockDb.__setQueryQueue([[stay({ status: 'checked_out' })]]);
      const res = await selfCheckOut('t1', 'tok');
      expect(res.status).toBe(200);
      expect('alreadyDone' in res && res.alreadyDone).toBe(true);
    });

    it('refuses when the guest never checked in', async () => {
      mockDb.__setQueryQueue([[stay({ status: 'booked' })]]);
      const res = await selfCheckOut('t1', 'tok');
      expect(res.status).toBe(400);
      expect('error' in res && res.error).toMatch(/not checked in/i);
    });
  });
});
