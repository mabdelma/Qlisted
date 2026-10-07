import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db, schema } from '../db/index.js';
import { eq, and } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { auditLog } from '../middleware/auditLog.js';
import { resolveTenant } from '../middleware/tenant.js';
import { logger } from '../lib/logger.js';

const menu = new Hono();

const categorySchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['main', 'sub']).optional().default('main'),
  parentId: z.string().optional(),
  sortOrder: z.number().int().optional().default(0),
});

const itemSchema = z.object({
  categoryId: z.string().min(1),
  subCategoryId: z.string().optional(),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  price: z.number().positive(),
  imageUrl: z.string().optional(),
  available: z.boolean().optional().default(true),
  roomServiceAvailable: z.boolean().optional().default(true),
  sortOrder: z.number().int().optional().default(0),
  modifiers: z.string().optional(),
});

// Public: get full menu for a restaurant
menu.get('/:slug/menu', resolveTenant, async (c) => {
  const tenant = c.get('tenant');

  const categories = await db
    .select()
    .from(schema.menuCategories)
    .where(eq(schema.menuCategories.tenantId, tenant.id))
    .orderBy(schema.menuCategories.sortOrder);

  const items = await db
    .select()
    .from(schema.menuItems)
    .where(eq(schema.menuItems.tenantId, tenant.id))
    .orderBy(schema.menuItems.sortOrder);

  return c.json({ categories, items });
});

// Protected: manage categories
menu.post('/:slug/menu/categories', authMiddleware, requireRole('admin', 'manager'), resolveTenant, zValidator('json', categorySchema), auditLog('create', 'menu_category'), async (c) => {
  const tenantId = c.get('tenantId');
  const input = c.req.valid('json');
  const id = uuid();

  await db.insert(schema.menuCategories).values({ id, tenantId, ...input });

  logger.info({ tenantId, categoryId: id }, 'Menu category created');
  return c.json({ id, ...input }, 201);
});

menu.put('/:slug/menu/categories/:categoryId', authMiddleware, requireRole('admin', 'manager'), resolveTenant, zValidator('json', categorySchema), auditLog('update', 'menu_category'), async (c) => {
  const tenantId = c.get('tenantId');
  const categoryId = c.req.param('categoryId')!;
  const input = c.req.valid('json');

  await db.update(schema.menuCategories)
    .set(input)
    .where(and(eq(schema.menuCategories.id, categoryId), eq(schema.menuCategories.tenantId, tenantId)));

  return c.json({ success: true });
});

menu.delete('/:slug/menu/categories/:categoryId', authMiddleware, requireRole('admin'), resolveTenant, auditLog('delete', 'menu_category'), async (c) => {
  const tenantId = c.get('tenantId');
  const categoryId = c.req.param('categoryId')!;

  await db.delete(schema.menuCategories)
    .where(and(eq(schema.menuCategories.id, categoryId), eq(schema.menuCategories.tenantId, tenantId)));

  return c.json({ success: true });
});

// Protected: manage items
menu.post('/:slug/menu/items', authMiddleware, requireRole('admin', 'manager'), resolveTenant, zValidator('json', itemSchema), auditLog('create', 'menu_item'), async (c) => {
  const tenantId = c.get('tenantId');
  const input = c.req.valid('json');
  const id = uuid();

  await db.insert(schema.menuItems).values({ id, tenantId, ...input });

  logger.info({ tenantId, itemId: id }, 'Menu item created');
  return c.json({ id, ...input }, 201);
});

const updateMenuItemSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  price: z.number().positive().optional(),
  // NOT .uuid(): the create schema accepts any non-empty id, and a category
  // created before ids were uuids would make its items unsaveable.
  categoryId: z.string().min(1).optional(),
  subCategoryId: z.string().optional().nullable(),
  available: z.boolean().optional(),
  roomServiceAvailable: z.boolean().optional(),
  // NOT .url(). The upload endpoint returns a RELATIVE path (/uploads/x.png),
  // which .url() rejects — so attaching an image and saving failed validation
  // with a 400, and the client logged it to the console and showed nothing.
  // Creating worked because the create schema uses a plain string, which is
  // exactly why this only ever broke on edit.
  imageUrl: z.string().max(500).optional().nullable(),
  // Present on create but missing here, so every one of these was silently
  // dropped by zod when an item was edited.
  sortOrder: z.number().int().optional(),
  modifiers: z.string().optional().nullable(),
  // The AI-written copy. Without this the generated translations were stripped
  // on save and the item kept whatever it had before.
  translations: z.record(z.object({
    name: z.string().optional(),
    description: z.string().optional(),
  })).optional().nullable(),
});

menu.put('/:slug/menu/items/:itemId', authMiddleware, requireRole('admin', 'manager'), resolveTenant, zValidator('json', updateMenuItemSchema), auditLog('update', 'menu_item'), async (c) => {
  const tenantId = c.get('tenantId');
  const itemId = c.req.param('itemId')!;
  const input = c.req.valid('json');

  await db.update(schema.menuItems)
    .set(input)
    .where(and(eq(schema.menuItems.id, itemId), eq(schema.menuItems.tenantId, tenantId)));

  return c.json({ success: true });
});

menu.delete('/:slug/menu/items/:itemId', authMiddleware, requireRole('admin'), resolveTenant, auditLog('delete', 'menu_item'), async (c) => {
  const tenantId = c.get('tenantId');
  const itemId = c.req.param('itemId')!;

  await db.delete(schema.menuItems)
    .where(and(eq(schema.menuItems.id, itemId), eq(schema.menuItems.tenantId, tenantId)));

  return c.json({ success: true });
});

const translationsSchema = z.object({
  translations: z.record(z.object({
    name: z.string().optional(),
    description: z.string().optional(),
  })),
});

menu.put('/:slug/menu/items/:itemId/translations', authMiddleware, requireRole('admin', 'manager'), resolveTenant, zValidator('json', translationsSchema), async (c) => {
  const tenantId = c.get('tenantId');
  const itemId = c.req.param('itemId')!;
  const { translations } = c.req.valid('json');

  await db.update(schema.menuItems)
    .set({ translations })
    .where(and(eq(schema.menuItems.id, itemId), eq(schema.menuItems.tenantId, tenantId)));

  return c.json({ success: true });
});

menu.put('/:slug/menu/categories/:categoryId/translations', authMiddleware, requireRole('admin', 'manager'), resolveTenant, zValidator('json', translationsSchema), async (c) => {
  const tenantId = c.get('tenantId');
  const categoryId = c.req.param('categoryId')!;
  const { translations } = c.req.valid('json');

  await db.update(schema.menuCategories)
    .set({ translations })
    .where(and(eq(schema.menuCategories.id, categoryId), eq(schema.menuCategories.tenantId, tenantId)));

  return c.json({ success: true });
});

// Bulk menu import
const menuImportSchema = z.object({
  categories: z.array(z.object({
    name: z.string().min(1).max(100),
    type: z.enum(['main', 'sub']).default('main'),
    sortOrder: z.number().int().default(0),
  })).optional(),
  items: z.array(z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
    price: z.number().positive(),
    categoryName: z.string().min(1),
    available: z.boolean().default(true),
    sortOrder: z.number().int().default(0),
    imageUrl: z.string().url().max(500).optional().nullable(),
  })),
});

menu.post('/:slug/menu/import', authMiddleware, requireRole('admin', 'manager'), zValidator('json', menuImportSchema), auditLog('import', 'menu'), async (c) => {
  const tenantId = c.get('tenantId');
  const { categories, items } = c.req.valid('json');
  const results = { categoriesCreated: 0, itemsCreated: 0, errors: [] as string[] };

  const categoryMap = new Map<string, string>();

  const existingCats = await db.select().from(schema.menuCategories).where(eq(schema.menuCategories.tenantId, tenantId));
  for (const cat of existingCats) {
    categoryMap.set(cat.name.toLowerCase(), cat.id);
  }

  if (categories) {
    for (const cat of categories) {
      const key = cat.name.toLowerCase();
      if (categoryMap.has(key)) continue;
      const id = uuid();
      await db.insert(schema.menuCategories).values({
        id,
        tenantId,
        name: cat.name,
        type: cat.type,
        sortOrder: cat.sortOrder,
      });
      categoryMap.set(key, id);
      results.categoriesCreated++;
    }
  }

  for (const item of items) {
    const catKey = item.categoryName.toLowerCase();
    const categoryId = categoryMap.get(catKey);
    if (!categoryId) {
      results.errors.push(`Category "${item.categoryName}" not found for item "${item.name}"`);
      continue;
    }
    await db.insert(schema.menuItems).values({
      id: uuid(),
      tenantId,
      categoryId,
      name: item.name,
      description: item.description,
      price: item.price,
      available: item.available,
      sortOrder: item.sortOrder,
      imageUrl: item.imageUrl,
    });
    results.itemsCreated++;
  }

  logger.info({ tenantId, results }, 'Menu import completed');
  return c.json(results, 201);
});

// Batch reorder items
menu.put('/:slug/menu/reorder', authMiddleware, requireRole('admin', 'manager'), resolveTenant, async (c) => {
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const orderMap: { id: string; sortOrder: number }[] = body.items || [];

  await db.transaction(async (tx) => {
    for (const item of orderMap) {
      await tx.update(schema.menuItems)
        .set({ sortOrder: item.sortOrder })
        .where(and(eq(schema.menuItems.id, item.id), eq(schema.menuItems.tenantId, tenantId)));
    }
  });

  return c.json({ success: true });
});

// Batch reorder categories
menu.put('/:slug/menu/categories/reorder', authMiddleware, requireRole('admin', 'manager'), resolveTenant, async (c) => {
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const orderMap: { id: string; sortOrder: number }[] = body.categories || [];

  await db.transaction(async (tx) => {
    for (const cat of orderMap) {
      await tx.update(schema.menuCategories)
        .set({ sortOrder: cat.sortOrder })
        .where(and(eq(schema.menuCategories.id, cat.id), eq(schema.menuCategories.tenantId, tenantId)));
    }
  });

  return c.json({ success: true });
});

export default menu;
