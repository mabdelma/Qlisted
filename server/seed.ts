import crypto from 'node:crypto';
import { db } from './src/db/index.js';
import * as schema from './src/db/schema.js';
import { v4 as uuid } from 'uuid';
import bcrypt from 'bcryptjs';

async function seed() {
  console.log('🌱 Seeding database...');

  // Clean existing data (in correct order for FK constraints)
  await db.delete(schema.orderItems);
  await db.delete(schema.orders);
  // Hotel rows before the tenant rows: folio → booking → room is the FK chain,
  // and orders.bookingId points at bookings, so orders have to go first.
  await db.delete(schema.folioItems);
  await db.delete(schema.roomBookings);
  await db.delete(schema.rooms);
  await db.delete(schema.payments);
  await db.delete(schema.paymentLinks);
  await db.delete(schema.menuItems);
  await db.delete(schema.menuCategories);
  await db.delete(schema.tables);
  // promo_campaigns references tenants, so it has to go before the tenant rows
  // or a re-seed fails on the foreign key.
  await db.delete(schema.promoCampaigns);
  await db.delete(schema.users);
  await db.delete(schema.tenants);

  // Create a demo tenant
  const tenantId = uuid();
  await db.insert(schema.tenants).values({
    id: tenantId,
    name: 'Demo Café',
    slug: 'demo-cafe',
    email: 'owner@democafe.com',
    phone: '+1-555-0100',
    timezone: 'America/New_York',
    currency: 'USD',
    taxRate: 8.875,
    serviceCharge: 0,
  });
  console.log('  ✓ Created demo tenant');

  // Create admin user
  const hashedPassword = await bcrypt.hash('password123', 10);
  const adminId = uuid();
  await db.insert(schema.users).values({
    id: adminId,
    tenantId,
    email: 'admin@democafe.com',
    passwordHash: hashedPassword,
    name: 'Admin User',
    role: 'admin',
    isActive: true,
  });
  console.log('  ✓ Created admin user (admin@democafe.com / password123)');

  // Create waiter
  const waiterId = uuid();
  await db.insert(schema.users).values({
    id: waiterId,
    tenantId,
    email: 'waiter@democafe.com',
    passwordHash: hashedPassword,
    name: 'Waiter User',
    role: 'waiter',
    isActive: true,
  });

  // Create kitchen staff
  const kitchenId = uuid();
  await db.insert(schema.users).values({
    id: kitchenId,
    tenantId,
    email: 'kitchen@democafe.com',
    passwordHash: hashedPassword,
    name: 'Kitchen User',
    role: 'kitchen',
    isActive: true,
  });

  // Create cashier
  const cashierId = uuid();
  await db.insert(schema.users).values({
    id: cashierId,
    tenantId,
    email: 'cashier@democafe.com',
    passwordHash: hashedPassword,
    name: 'Cashier User',
    role: 'cashier',
    isActive: true,
  });
  console.log('  ✓ Created staff users (staff@democafe.com / password123)');

  // Create menu categories
  const catMain = uuid();
  const catBeverages = uuid();
  const catDesserts = uuid();

  await db.insert(schema.menuCategories).values([
    { id: catMain, tenantId, name: 'Main Course', type: 'main', sortOrder: 0 },
    { id: catBeverages, tenantId, name: 'Beverages', type: 'main', sortOrder: 1 },
    { id: catDesserts, tenantId, name: 'Desserts', type: 'main', sortOrder: 2 },
  ]);
  console.log('  ✓ Created menu categories');

  // Create menu items
  const itemBurger = uuid();
  const itemLemonade = uuid();
  await db.insert(schema.menuItems).values([
    { id: uuid(), tenantId, categoryId: catMain, name: 'Grilled Chicken Salad', description: 'Fresh mixed greens with grilled chicken breast, cherry tomatoes, and balsamic vinaigrette', price: 14.99, available: true },
    { id: itemBurger, tenantId, categoryId: catMain, name: 'Beef Burger', description: 'Angus beef patty with cheddar, lettuce, tomato, and special sauce', price: 16.99, available: true },
    { id: uuid(), tenantId, categoryId: catMain, name: 'Margherita Pizza', description: 'Classic tomato sauce, fresh mozzarella, and basil on thin crust', price: 13.99, available: true },
    { id: uuid(), tenantId, categoryId: catMain, name: 'Pasta Carbonara', description: 'Spaghetti with pancetta, egg, parmesan, and black pepper', price: 15.99, available: true },
    { id: itemLemonade, tenantId, categoryId: catBeverages, name: 'Fresh Lemonade', description: 'House-made lemonade with fresh mint', price: 4.99, available: true },
    { id: uuid(), tenantId, categoryId: catBeverages, name: 'Iced Coffee', description: 'Cold brew coffee served over ice', price: 5.49, available: true },
    { id: uuid(), tenantId, categoryId: catBeverages, name: 'Green Tea', description: 'Premium Japanese green tea', price: 3.99, available: true },
    { id: uuid(), tenantId, categoryId: catDesserts, name: 'Chocolate Lava Cake', description: 'Warm chocolate cake with molten center, served with vanilla ice cream', price: 8.99, available: true },
    { id: uuid(), tenantId, categoryId: catDesserts, name: 'Tiramisu', description: 'Classic Italian coffee-flavored layered dessert', price: 7.99, available: true },
    { id: uuid(), tenantId, categoryId: catDesserts, name: 'Cheesecake', description: 'New York style cheesecake with berry compote', price: 6.99, available: true },
  ]);
  console.log('  ✓ Created menu items');

  // Create tables
  let table1Id = '';
  for (let i = 1; i <= 10; i++) {
    const tableId = uuid();
    if (i === 1) table1Id = tableId;
    await db.insert(schema.tables).values({
      id: tableId,
      tenantId,
      number: i,
      capacity: i <= 4 ? 2 : i <= 8 ? 4 : 6,
      status: 'available',
      // Deliberately `table-N`, not SEED_QR_TOKEN: every spec addresses table 1
      // as /r/demo-cafe/table/table-1, so honouring that env var would break
      // five spec files. SEED_ROOM_TOKEN is read because the hotel specs do use
      // it; the table equivalent is dead and the CI env entry is now gone.
      qrToken: `table-${i}`,
    });
  }
  console.log('  ✓ Created 10 tables');

  // One unpaid dine-in order on table 1. Without it the bill page has nothing to
  // settle, so the demo looks broken and the bill/payment E2E specs assert UI
  // that can never render.
  const demoOrderId = uuid();
  const burgerQty = 2;
  const lemonadeQty = 1;
  const demoSubtotal = 16.99 * burgerQty + 4.99 * lemonadeQty;
  const demoTax = Math.round(demoSubtotal * 0.1 * 100) / 100;
  await db.insert(schema.orders).values({
    id: demoOrderId,
    tenantId,
    tableId: table1Id,
    orderType: 'dine_in',
    status: 'delivered',
    itemCount: burgerQty + lemonadeQty,
    subtotal: demoSubtotal,
    tax: demoTax,
    serviceCharge: 0,
    total: Math.round((demoSubtotal + demoTax) * 100) / 100,
    paymentStatus: 'unpaid',
    paidAmount: 0,
  });
  await db.insert(schema.orderItems).values([
    { id: uuid(), orderId: demoOrderId, menuItemId: itemBurger, name: 'Beef Burger', quantity: burgerQty, unitPrice: 16.99 },
    { id: uuid(), orderId: demoOrderId, menuItemId: itemLemonade, name: 'Fresh Lemonade', quantity: lemonadeQty, unitPrice: 4.99 },
  ]);
  console.log('  ✓ Created demo unpaid order on table 1');

  // A live promo so the promo-validation path has something real to match.
  // Looked up case-insensitively by name, so the code a guest types is the name.
  await db.insert(schema.promoCampaigns).values({
    id: uuid(),
    tenantId,
    name: 'WELCOME10',
    type: 'percentage',
    value: 10,
    minOrderAmount: 15,
    maxDiscount: 5,
    isActive: true,
  });
  console.log('  ✓ Created WELCOME10 promo campaign');

  await seedHotel(hashedPassword);

  console.log('\n✅ Seed complete!');
  console.log('   Login: admin@democafe.com / password123');
  process.exit(0);
}

/**
 * A second tenant with venueType 'hotel'.
 *
 * This lived only in `src/db/seed.ts`, which nothing runs — `npm run seed`
 * points at this file, so CI seeded no hotel at all and the two hotel specs
 * failed against a tenant that did not exist.
 *
 * The specs assert real content: rooms by number, the checked-in guest by name,
 * a room-service menu that hides the restaurant-only dish. None of that can be
 * satisfied by a page that merely loads, which is the point of the fixture.
 */
async function seedHotel(passwordHash: string) {
  const tenantId = uuid();
  await db.insert(schema.tenants).values({
    id: tenantId,
    name: 'Demo Hotel',
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
    id: uuid(),
    tenantId,
    name: 'Hotel Manager',
    email: 'manager@demohotel.com',
    passwordHash,
    role: 'admin',
    isActive: true,
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
    { id: uuid(), tenantId, categoryId: catInRoom, name: "Chef's Tasting Menu", description: 'Served in the restaurant only', price: 65, available: true, roomServiceAvailable: false, sortOrder: 2 },
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
    {
      id: activeBookingId, tenantId, roomId: occupiedRoomId,
      guestName: 'Alex Rivera', guestEmail: 'alex@example.com',
      checkIn: today, checkOut: nights(2), status: 'checked_in',
      ratePerNight: 140, total: 280,
      checkedInAt: new Date().toISOString(), checkedInBy: 'staff',
      accessToken: crypto.randomBytes(16).toString('hex'),
    },
    {
      id: uuid(), tenantId, roomId: vacantRoomId,
      guestName: 'Sam Chen', guestEmail: 'sam@example.com',
      checkIn: nights(3), checkOut: nights(5), status: 'booked',
      ratePerNight: 140, total: 280,
      accessToken: crypto.randomBytes(16).toString('hex'),
    },
  ]);
  await db.insert(schema.folioItems).values([
    { id: uuid(), tenantId, bookingId: activeBookingId, description: 'Minibar', amount: 15 },
  ]);

  console.log('  ✓ Created demo-hotel tenant (manager@demohotel.com / password123)');
  console.log(`  ✓ Room 101 service token: ${roomToken}`);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
