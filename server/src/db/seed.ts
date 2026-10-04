import { db, schema } from './index.js';

import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import crypto from 'crypto';

// Idempotent: a platform super_admin (no tenant) that can manage all tenants.
// Runs on every deploy independent of the demo-data guard below.
async function seedSuperAdmin() {
  const [existing] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.role, 'super_admin'))
    .limit(1);
  if (existing) {
    console.log('Super admin already exists, skipping.');
    return;
  }

  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be set in production. Seed aborted.');
    process.exit(1);
  }
  if (password === 'change-me-now' || password === 'pass123' || password === 'password') {
    console.error('SUPER_ADMIN_PASSWORD is too weak. Choose a strong password.');
    process.exit(1);
  }
  if (password.length < 12) {
    console.error('SUPER_ADMIN_PASSWORD must be at least 12 characters.');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await db.insert(schema.users).values({
    id: uuid(),
    tenantId: null,
    name: 'Super Admin',
    email,
    passwordHash,
    role: 'super_admin',
  });
  console.log(`Created super admin: ${email}`);
}

async function seed() {
  await seedSuperAdmin();

  const [existing] = await db.select().from(schema.tenants).limit(1);
  if (existing) {
    console.log('Database already seeded, skipping.');
    return;
  }

  console.log('Seeding demo data...');

  const tenantId = uuid();
  await db.insert(schema.tenants).values({
    id: tenantId,
    name: 'Demo Cafe',
    slug: 'demo-cafe',
    email: 'hello@democafe.com',
    phone: '+1-555-0100',
    address: '123 Main Street, Cityville',
    currency: 'USD',
    timezone: 'America/New_York',
    primaryColor: '#8B4513',
    taxRate: 0.08,
    serviceCharge: 0.05,
  });

  const passwordHash = await bcrypt.hash('pass123', 12);
  await db.insert(schema.users).values({
    id: uuid(),
    tenantId,
    name: 'Restaurant Owner',
    email: 'owner@demo.com',
    passwordHash,
    role: 'admin',
  });

  const cat1Id = uuid();
  const cat2Id = uuid();
  await db.insert(schema.menuCategories).values([
    { id: cat1Id, tenantId, name: 'Main Courses', type: 'main', sortOrder: 0 },
    { id: cat2Id, tenantId, name: 'Beverages', type: 'main', sortOrder: 1 },
  ]);

  await db.insert(schema.menuItems).values([
    {
      id: uuid(), tenantId, categoryId: cat1Id,
      name: 'Classic Burger', description: 'Juicy beef patty with lettuce, tomato, and special sauce',
      price: 12.99, available: true, sortOrder: 0,
    },
    {
      id: uuid(), tenantId, categoryId: cat1Id,
      name: 'Margherita Pizza', description: 'Fresh mozzarella, tomato sauce, and basil',
      price: 14.99, available: true, sortOrder: 1,
    },
    {
      id: uuid(), tenantId, categoryId: cat2Id,
      name: 'Fresh Lemonade', description: 'House-made lemonade with mint',
      price: 4.99, available: true, sortOrder: 0,
    },
    {
      id: uuid(), tenantId, categoryId: cat2Id,
      name: 'Espresso', description: 'Double shot espresso',
      price: 3.49, available: true, sortOrder: 1,
    },
  ]);

  // The QR token is what makes a table's ordering link unguessable, so it is
  // random by default. SEED_QR_TOKEN pins it to a known value so the E2E suite
  // can address the demo table by a stable URL. Only ever set in CI.
  const qrToken = process.env.SEED_QR_TOKEN || crypto.randomBytes(16).toString('hex');
  await db.insert(schema.tables).values({
    id: uuid(), tenantId, number: 1, capacity: 4, qrToken,
  });

  await db.insert(schema.promoCampaigns).values([
    {
      id: uuid(), tenantId, name: 'WELCOME10', type: 'percentage', value: 10,
      minOrderAmount: 15, maxDiscount: 5, isActive: true, usageLimit: 100,
    },
    {
      id: uuid(), tenantId, name: 'FIVE OFF', type: 'fixed', value: 5,
      minOrderAmount: 20, isActive: true, usageLimit: 50,
    },
    {
      id: uuid(), tenantId, name: 'HAPPYHOUR', type: 'happy_hour', value: 15,
      timeStart: '15:00', timeEnd: '18:00', isActive: true,
    },
  ]);

  await db.insert(schema.loyaltySummary).values({
    id: uuid(), tenantId, points: 150, lifetimePoints: 250, tier: 'silver',
  });

  await db.insert(schema.loyaltyTransactions).values([
    { id: uuid(), tenantId, type: 'earn', amount: 50, description: 'Welcome bonus' },
    { id: uuid(), tenantId, type: 'earn', amount: 100, description: 'Order #abc123' },
    { id: uuid(), tenantId, type: 'redeem', amount: 50, description: 'Redeemed: $5 Off' },
  ]);

  await db.insert(schema.waitlistEntries).values([{
    id: uuid(), tenantId,
    customerName: 'Alice Brown', customerPhone: '+1-555-1111', partySize: 3,
    status: 'waiting', position: 1, estimatedWaitMinutes: 15, source: 'web',
  }, {
    id: uuid(), tenantId,
    customerName: 'Bob Green', customerPhone: '+1-555-2222', partySize: 2,
    status: 'waiting', position: 2, estimatedWaitMinutes: 30, source: 'web',
  }, {
    id: uuid(), tenantId,
    customerName: 'Carol White', customerPhone: '+1-555-3333', partySize: 5,
    status: 'waiting', position: 3, estimatedWaitMinutes: 45, source: 'staff',
    notes: 'Prefers booth seating',
  }]);

  const today = new Date().toISOString().split('T')[0];
  await db.insert(schema.reservations).values([{
    id: uuid(), tenantId, tableId: null,
    customerName: 'John Smith', customerEmail: 'john@example.com', customerPhone: '+1-555-1234',
    partySize: 4, date: today, time: '19:00', status: 'confirmed', source: 'web',
    specialRequests: 'Anniversary dinner - please prepare something special',
  }, {
    id: uuid(), tenantId, tableId: null,
    customerName: 'Sarah Johnson', customerEmail: 'sarah@example.com',
    partySize: 2, date: today, time: '20:30', status: 'pending', source: 'web',
  }, {
    id: uuid(), tenantId, tableId: null,
    customerName: 'Mike Wilson', customerPhone: '+1-555-5678',
    partySize: 6, date: today, time: '18:00', status: 'pending', source: 'phone',
  }]);

  console.log(`Seeded tenant: demo-cafe (ID: ${tenantId})`);
  console.log('Admin login: owner@demo.com / pass123');
  console.log(`Table QR token: ${qrToken}`);

  await seedHotel(passwordHash);
}

/**
 * A second tenant running a hotel, so the rooms / bookings / folio / room-service
 * surfaces have real data behind them. Without this the hotel dashboards are
 * permanently empty and the E2E hotel spec can only assert "it didn't crash".
 */
async function seedHotel(passwordHash: string) {
  const tenantId = uuid();
  await db.insert(schema.tenants).values({
    id: tenantId,
    name: 'Demo Grand Hotel',
    slug: 'demo-hotel',
    email: 'frontdesk@demohotel.com',
    phone: '+1-555-0200',
    address: '1 Grand Plaza, Cityville',
    currency: 'USD',
    timezone: 'America/New_York',
    primaryColor: '#0f766e',
    venueType: 'hotel',
    taxRate: 0.1,
    serviceCharge: 0,
  });

  await db.insert(schema.users).values({
    id: uuid(), tenantId, name: 'Hotel Manager',
    email: 'manager@demohotel.com', passwordHash, role: 'admin',
  });

  const catInRoom = uuid();
  const catDrinks = uuid();
  await db.insert(schema.menuCategories).values([
    { id: catInRoom, tenantId, name: 'In-Room Dining', type: 'main', sortOrder: 0 },
    { id: catDrinks, tenantId, name: 'Beverages', type: 'main', sortOrder: 1 },
  ]);
  await db.insert(schema.menuItems).values([
    { id: uuid(), tenantId, categoryId: catInRoom, name: 'Club Sandwich', description: 'Grilled chicken, bacon, lettuce, tomato', price: 16, available: true, roomServiceAvailable: true, sortOrder: 0 },
    { id: uuid(), tenantId, categoryId: catInRoom, name: 'Caesar Salad', description: 'Romaine, parmesan, croutons', price: 12, available: true, roomServiceAvailable: true, sortOrder: 1 },
    // Kitchen-only: not deliverable to a room, so room service must not offer it.
    { id: uuid(), tenantId, categoryId: catInRoom, name: 'Chef\'s Tasting Menu', description: 'Served in the restaurant only', price: 65, available: true, roomServiceAvailable: false, sortOrder: 2 },
    { id: uuid(), tenantId, categoryId: catDrinks, name: 'Room Service Coffee', description: 'Freshly brewed', price: 5, available: true, roomServiceAvailable: true, sortOrder: 0 },
  ]);

  // The in-room link is keyed on the room's serviceToken, so pin one to a known
  // value for E2E exactly like SEED_QR_TOKEN does for tables.
  const roomToken = process.env.SEED_ROOM_TOKEN || crypto.randomBytes(16).toString('hex');
  const occupiedRoomId = uuid();
  const vacantRoomId = uuid();
  const today = new Date().toISOString().split('T')[0];
  const nights = (n: number) => {
    const d = new Date(today + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().split('T')[0];
  };

  await db.insert(schema.rooms).values([
    { id: occupiedRoomId, tenantId, number: '101', type: 'Double', floor: '1', rate: 140, status: 'occupied', guestName: 'Alex Rivera', serviceToken: roomToken },
    { id: vacantRoomId, tenantId, number: '102', type: 'Double', floor: '1', rate: 140, status: 'available' },
    { id: uuid(), tenantId, number: '201', type: 'Suite', floor: '2', rate: 260, status: 'cleaning' },
    { id: uuid(), tenantId, number: '202', type: 'Suite', floor: '2', rate: 260, status: 'maintenance' },
    { id: uuid(), tenantId, number: '103', type: 'Single', floor: '1', rate: 95, status: 'reserved' },
  ]);

  // One live checked-in stay (so room service resolves) and one future booking.
  const activeBookingId = uuid();
  await db.insert(schema.roomBookings).values([
    { id: activeBookingId, tenantId, roomId: occupiedRoomId, guestName: 'Alex Rivera', guestEmail: 'alex@example.com', checkIn: today, checkOut: nights(2), status: 'checked_in', ratePerNight: 140, total: 280 },
    { id: uuid(), tenantId, roomId: vacantRoomId, guestName: 'Sam Chen', guestEmail: 'sam@example.com', checkIn: nights(3), checkOut: nights(5), status: 'booked', ratePerNight: 140, total: 280 },
  ]);
  await db.insert(schema.folioItems).values([
    { id: uuid(), tenantId, bookingId: activeBookingId, description: 'Minibar', amount: 15 },
  ]);

  console.log(`Seeded tenant: demo-hotel (ID: ${tenantId})`);
  console.log('Admin login: manager@demohotel.com / pass123');
  console.log(`Room service token (Room 101): ${roomToken}`);
}

seed()
  .then(() => { process.exit(0); })
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
