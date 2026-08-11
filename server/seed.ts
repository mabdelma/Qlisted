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
  await db.insert(schema.menuItems).values([
    { id: uuid(), tenantId, categoryId: catMain, name: 'Grilled Chicken Salad', description: 'Fresh mixed greens with grilled chicken breast, cherry tomatoes, and balsamic vinaigrette', price: 14.99, available: true },
    { id: uuid(), tenantId, categoryId: catMain, name: 'Beef Burger', description: 'Angus beef patty with cheddar, lettuce, tomato, and special sauce', price: 16.99, available: true },
    { id: uuid(), tenantId, categoryId: catMain, name: 'Margherita Pizza', description: 'Classic tomato sauce, fresh mozzarella, and basil on thin crust', price: 13.99, available: true },
    { id: uuid(), tenantId, categoryId: catMain, name: 'Pasta Carbonara', description: 'Spaghetti with pancetta, egg, parmesan, and black pepper', price: 15.99, available: true },
    { id: uuid(), tenantId, categoryId: catBeverages, name: 'Fresh Lemonade', description: 'House-made lemonade with fresh mint', price: 4.99, available: true },
    { id: uuid(), tenantId, categoryId: catBeverages, name: 'Iced Coffee', description: 'Cold brew coffee served over ice', price: 5.49, available: true },
    { id: uuid(), tenantId, categoryId: catBeverages, name: 'Green Tea', description: 'Premium Japanese green tea', price: 3.99, available: true },
    { id: uuid(), tenantId, categoryId: catDesserts, name: 'Chocolate Lava Cake', description: 'Warm chocolate cake with molten center, served with vanilla ice cream', price: 8.99, available: true },
    { id: uuid(), tenantId, categoryId: catDesserts, name: 'Tiramisu', description: 'Classic Italian coffee-flavored layered dessert', price: 7.99, available: true },
    { id: uuid(), tenantId, categoryId: catDesserts, name: 'Cheesecake', description: 'New York style cheesecake with berry compote', price: 6.99, available: true },
  ]);
  console.log('  ✓ Created menu items');

  // Create tables
  for (let i = 1; i <= 10; i++) {
    await db.insert(schema.tables).values({
      id: uuid(),
      tenantId,
      number: i,
      capacity: i <= 4 ? 2 : i <= 8 ? 4 : 6,
      status: 'available',
      qrToken: `table-${i}`,
    });
  }
  console.log('  ✓ Created 10 tables');

  console.log('\n✅ Seed complete!');
  console.log('   Login: admin@democafe.com / password123');
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
