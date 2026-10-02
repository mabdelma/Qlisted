import { db } from './src/db/index.js';
import * as schema from './src/db/schema.js';
import { v4 as uuid } from 'uuid';
import bcrypt from 'bcryptjs';

async function seed() {
  console.log('🌱 Seeding database...');

  // Clean existing data (in correct order for FK constraints)
  await db.delete(schema.orderItems);
  await db.delete(schema.orders);
  await db.delete(schema.payments);
  await db.delete(schema.paymentLinks);
  await db.delete(schema.menuItems);
  await db.delete(schema.menuCategories);
  await db.delete(schema.tables);
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

  console.log('\n✅ Seed complete!');
  console.log('   Login: admin@democafe.com / password123');
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
