import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db, schema } from '../db/index.js';
import { eq, and, sql } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import crypto from 'crypto';
import qrcode from 'qrcode';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { resolveTenant } from '../middleware/tenant.js';
import { logger } from '../lib/logger.js';

const tables = new Hono();

const tableSchema = z.object({
  number: z.number().int().positive(),
  // Optional on the wire: a caller that sends only a number gets "Table N",
  // which keeps the existing clients and the QR flow working unchanged.
  name: z.string().trim().min(1).max(60).optional(),
  capacity: z.number().int().positive().optional().default(2),
  xPos: z.number().optional(),
  yPos: z.number().optional(),
});

/**
 * Reject a name or number already used by another table in this tenant.
 *
 * Name uniqueness is also a database constraint; this exists so the admin gets
 * a message naming the clash instead of a raw 500 from the index. Number has
 * no DB constraint on purpose — see drizzle/0027_table_names.sql — so for that
 * this check IS the enforcement.
 */
/**
 * The lowest table number not in use for this tenant.
 *
 * Deliberately the first GAP, not max+1: a venue that removes a table expects
 * the number to become available again rather than the numbering climbing
 * forever. With 1, 2, 4, 5 this returns 3.
 */
export function firstFreeNumber(used: Iterable<number>): number {
  const taken = new Set(used);
  let n = 1;
  while (taken.has(n)) n += 1;
  return n;
}

async function nextFreeNumber(tenantId: string): Promise<number> {
  const rows = await db.select({ number: schema.tables.number })
    .from(schema.tables)
    .where(eq(schema.tables.tenantId, tenantId));
  return firstFreeNumber(rows.map((r) => r.number));
}

/**
 * A default name that is free.
 *
 * Only used when the caller did NOT type a name. "Table 3" can already be
 * taken by a table whose number is something else entirely — someone renamed
 * it — and failing the request over a name the admin never chose would be
 * their problem to solve for no reason. An explicitly typed name still errors
 * on a clash, because that one they did choose.
 */
export function firstFreeName(existing: Iterable<string>, number: number): string {
  const taken = new Set([...existing].map((n) => n.toLowerCase()));
  const base = `Table ${number}`;
  if (!taken.has(base.toLowerCase())) return base;
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${base} (${i})`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  // 1000 collisions on one number is not a real venue; stay unique anyway.
  return `${base} (${Date.now()})`;
}

async function freeAutoName(tenantId: string, number: number): Promise<string> {
  const rows = await db.select({ name: schema.tables.name })
    .from(schema.tables)
    .where(eq(schema.tables.tenantId, tenantId));
  return firstFreeName(rows.map((r) => r.name), number);
}

async function findClash(tenantId: string, name: string | undefined, number: number | undefined, excludeId?: string) {
  const rows = await db.select({ id: schema.tables.id, name: schema.tables.name, number: schema.tables.number })
    .from(schema.tables)
    .where(eq(schema.tables.tenantId, tenantId));
  for (const r of rows) {
    if (excludeId && r.id === excludeId) continue;
    if (name !== undefined && r.name.toLowerCase() === name.toLowerCase()) {
      return `A table named "${r.name}" already exists`;
    }
    if (number !== undefined && r.number === number) {
      return `Table number ${r.number} is already in use`;
    }
  }
  return null;
}

// Public: resolve a table by QR token (no slug needed)
tables.get('/resolve/:qrToken', async (c) => {
  const qrToken = c.req.param('qrToken')!;

  const [table] = await db
    .select()
    .from(schema.tables)
    .where(eq(schema.tables.qrToken, qrToken))
    .limit(1);

  if (!table) {
    return c.json({ error: 'Table not found' }, 404);
  }

  const [tenant] = await db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.id, table.tenantId))
    .limit(1);

  if (!tenant) {
    return c.json({ error: 'Tenant not found' }, 404);
  }

  return c.json({
    id: table.id,
    number: table.number,
    capacity: table.capacity,
    status: table.status,
    qrToken: table.qrToken,
    qrImage: table.qrImage,
    tenantSlug: tenant.slug,
    tenantName: tenant.name,
  });
});

// Public: get table info by QR token (requires slug)
tables.get('/:slug/table/:qrToken', resolveTenant, async (c) => {
  const tenantId = c.get('tenantId');
  const qrToken = c.req.param('qrToken')!;

  const [table] = await db
    .select()
    .from(schema.tables)
    .where(and(eq(schema.tables.qrToken, qrToken), eq(schema.tables.tenantId, tenantId)))
    .limit(1);

  if (!table) {
    return c.json({ error: 'Table not found' }, 404);
  }

  return c.json({
    id: table.id,
    number: table.number,
    capacity: table.capacity,
    status: table.status,
    qrImage: table.qrImage,
  });
});

// Protected: manage tables
tables.post('/:slug/tables', authMiddleware, requireRole('admin'), resolveTenant, zValidator('json', tableSchema), async (c) => {
  const tenantId = c.get('tenantId');
  const input = c.req.valid('json');

  // A typed name is checked and can be rejected. An auto name is resolved to
  // something free instead, since the admin did not pick it.
  const typed = input.name?.trim();
  const name = typed || await freeAutoName(tenantId, input.number);

  const clash = await findClash(tenantId, typed || undefined, input.number);
  if (clash) return c.json({ error: clash }, 409);

  const id = uuid();
  const qrToken = crypto.randomBytes(16).toString('hex');

  const qrUrl = `https://${c.req.header('host')}/api/tables/resolve/${qrToken}`;
  const qrImage = await qrcode.toDataURL(qrUrl, { width: 300, margin: 2 });

  await db.insert(schema.tables).values({ id, tenantId, qrToken, qrImage, ...input, name });

  logger.info({ tenantId, tableId: id, number: input.number, name }, 'Table created');
  return c.json({ id, qrToken, qrImage, ...input, name }, 201);
});

tables.get('/:slug/tables', authMiddleware, requireRole('admin', 'manager', 'waiter'), resolveTenant, async (c) => {
  const tenantId = c.get('tenantId');

  const result = await db
    .select()
    .from(schema.tables)
    .where(eq(schema.tables.tenantId, tenantId))
    .orderBy(schema.tables.number);

  return c.json(result);
});

tables.put('/:slug/tables/:tableId', authMiddleware, requireRole('admin'), resolveTenant, async (c) => {
  const tenantId = c.get('tenantId');
  const tableId = c.req.param('tableId')!;
  const body = await c.req.json();

  const allowed = ['number', 'name', 'capacity', 'status', 'xPos', 'yPos'];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key];
  }

  if (typeof updates.name === 'string') {
    const trimmed = updates.name.trim();
    if (!trimmed) return c.json({ error: 'Table name cannot be empty' }, 400);
    updates.name = trimmed;
  }

  // Excluding this table, or renaming it to its own name would report a clash
  // with itself.
  const clash = await findClash(
    tenantId,
    typeof updates.name === 'string' ? updates.name : undefined,
    typeof updates.number === 'number' ? updates.number : undefined,
    tableId,
  );
  if (clash) return c.json({ error: clash }, 409);

  await db.update(schema.tables)
    .set(updates)
    .where(and(eq(schema.tables.id, tableId), eq(schema.tables.tenantId, tenantId)));

  return c.json({ success: true });
});

tables.delete('/:slug/tables/:tableId', authMiddleware, requireRole('admin'), resolveTenant, async (c) => {
  const tenantId = c.get('tenantId');
  const tableId = c.req.param('tableId')!;

  await db.delete(schema.tables)
    .where(and(eq(schema.tables.id, tableId), eq(schema.tables.tenantId, tenantId)));

  return c.json({ success: true });
});

tables.post('/:slug/tables/merge', authMiddleware, requireRole('admin', 'manager'), resolveTenant, async (c) => {
  const tenantId = c.get('tenantId');
  const { sourceTableId, targetTableId } = await c.req.json() as { sourceTableId: string; targetTableId: string };

  const [source] = await db.select().from(schema.tables).where(and(eq(schema.tables.id, sourceTableId), eq(schema.tables.tenantId, tenantId))).limit(1);
  const [target] = await db.select().from(schema.tables).where(and(eq(schema.tables.id, targetTableId), eq(schema.tables.tenantId, tenantId))).limit(1);
  if (!source || !target) return c.json({ error: 'Table not found' }, 404);

  const sourceOrders = await db.select().from(schema.orders).where(and(eq(schema.orders.tableId, sourceTableId), eq(schema.orders.paymentStatus, 'unpaid')));

  for (const order of sourceOrders) {
    await db.update(schema.orders)
      .set({ tableId: targetTableId, notes: `Merged from table ${source.number} | ${order.notes || ''}` })
      .where(eq(schema.orders.id, order.id));
  }

  const mergedCapacity = source.capacity + target.capacity;
  await db.update(schema.tables)
    .set({ status: 'closed', capacity: 0 })
    .where(eq(schema.tables.id, sourceTableId));
  await db.update(schema.tables)
    .set({ capacity: mergedCapacity })
    .where(eq(schema.tables.id, targetTableId));

  logger.info({ tenantId, sourceTableId, targetTableId }, 'Tables merged');
  return c.json({ data: { targetTableId, mergedCapacity, ordersTransferred: sourceOrders.length } });
});

tables.post('/:slug/tables/split', authMiddleware, requireRole('admin', 'manager'), resolveTenant, async (c) => {
  const tenantId = c.get('tenantId');
  const { tableId, orderItemIds } = await c.req.json() as { tableId: string; orderItemIds: string[] };

  const [existing] = await db.select().from(schema.tables).where(and(eq(schema.tables.id, tableId), eq(schema.tables.tenantId, tenantId))).limit(1);
  if (!existing) return c.json({ error: 'Table not found' }, 404);

  const newTableId = uuid();
  const qrToken = crypto.randomBytes(16).toString('hex');
  const qrUrl = `https://${c.req.header('host')}/api/tables/resolve/${qrToken}`;
  const qrImage = await qrcode.toDataURL(qrUrl, { width: 300, margin: 2 });

  // Work the number out BEFORE inserting. This used to insert `number: 0` and
  // then renumber in a second statement, which now also has to carry a unique
  // name — two writes where one will do, and a window where the row is wrong.
  const newNumber = await nextFreeNumber(tenantId);

  // Derived from the table it split off, which is what staff will look for.
  let splitName = `${existing.name} (split)`;
  if (await findClash(tenantId, splitName, undefined)) {
    splitName = await freeAutoName(tenantId, newNumber);
  }

  await db.insert(schema.tables).values({
    id: newTableId, tenantId, number: newNumber, name: splitName,
    capacity: existing.capacity, status: 'occupied', qrToken, qrImage,
  });

  const orderItemsToMove = await db
    .select()
    .from(schema.orderItems)
    .where(sql`${schema.orderItems.id} IN (${sql.join(orderItemIds.map((id) => sql`${id}`), sql`, `)})`);

  const orderIds = [...new Set(orderItemsToMove.map((i) => i.orderId))];

  for (const orderId of orderIds) {
    const itemsForOrder = orderItemsToMove.filter((i) => i.orderId === orderId);
    const [existingOrder] = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId)).limit(1);
    if (!existingOrder) continue;

    const newOrderId = uuid();
    const movedSubtotal = itemsForOrder.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const movedCount = itemsForOrder.reduce((s, i) => s + i.quantity, 0);

    await db.insert(schema.orders).values({
      id: newOrderId, tenantId, tableId: newTableId,
      customerName: existingOrder.customerName,
      status: existingOrder.status, itemCount: movedCount,
      subtotal: movedSubtotal, tax: 0, serviceCharge: 0, total: movedSubtotal,
      notes: `Split from table ${existing.number}`,
    });

    for (const item of itemsForOrder) {
      await db.insert(schema.orderItems).values({
        id: uuid(), orderId: newOrderId, menuItemId: item.menuItemId,
        name: item.name, quantity: item.quantity, unitPrice: item.unitPrice,
        notes: item.notes, modifiers: item.modifiers,
      });
      await db.delete(schema.orderItems).where(eq(schema.orderItems.id, item.id));
    }

    const remainingItems = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, orderId));
    if (remainingItems.length === 0) {
      await db.update(schema.orders).set({ status: 'cancelled' }).where(eq(schema.orders.id, orderId));
    } else {
      const remainingSubtotal = remainingItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
      const remainingCount = remainingItems.reduce((s, i) => s + i.quantity, 0);
      await db.update(schema.orders).set({
        subtotal: remainingSubtotal, total: remainingSubtotal,
        itemCount: remainingCount,
      }).where(eq(schema.orders.id, orderId));
    }
  }

  logger.info({ tenantId, tableId, newTableId }, 'Table split');
  return c.json({ data: { newTableId, newTableNumber: newNumber, ordersCreated: orderIds.length } });
});

tables.post('/:slug/tables/transfer-order', authMiddleware, requireRole('admin', 'manager', 'waiter'), resolveTenant, async (c) => {
  const tenantId = c.get('tenantId');
  const { orderId, targetTableId } = await c.req.json() as { orderId: string; targetTableId: string };

  const [order] = await db.select().from(schema.orders).where(and(eq(schema.orders.id, orderId), eq(schema.orders.tenantId, tenantId))).limit(1);
  if (!order) return c.json({ error: 'Order not found' }, 404);

  const [targetTable] = await db.select().from(schema.tables).where(and(eq(schema.tables.id, targetTableId), eq(schema.tables.tenantId, tenantId))).limit(1);
  if (!targetTable) return c.json({ error: 'Target table not found' }, 404);

  const oldTableId = order.tableId;
  if (!oldTableId) {
    return c.json({ error: 'Cannot transfer a takeout or delivery order to a table' }, 400);
  }
  await db.update(schema.orders)
    .set({ tableId: targetTableId, notes: `Transferred from table ${oldTableId} | ${order.notes || ''}` })
    .where(eq(schema.orders.id, orderId));

  const remainingOrders = await db.select().from(schema.orders).where(and(eq(schema.orders.tableId, oldTableId), eq(schema.orders.paymentStatus, 'unpaid'), eq(schema.orders.id, sql`${schema.orders.id} != ${orderId}`)));
  if (remainingOrders.length === 0) {
    await db.update(schema.tables).set({ status: 'available' }).where(eq(schema.tables.id, oldTableId));
  }
  await db.update(schema.tables).set({ status: 'occupied' }).where(eq(schema.tables.id, targetTableId));

  logger.info({ tenantId, orderId, oldTableId, targetTableId }, 'Order transferred');
  return c.json({ data: { orderId, oldTableId, newTableId: targetTableId } });
});

export default tables;
