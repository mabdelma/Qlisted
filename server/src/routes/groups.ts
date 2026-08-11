import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db, schema } from '../db/index.js';
import { eq, and, sql } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { authMiddleware, requireRole } from '../middleware/auth.js';

const groups = new Hono();

groups.post('/groups', authMiddleware, requireRole('super_admin', 'admin'), zValidator('json', z.object({ name: z.string().min(1), ownerUserId: z.string().optional() })), async (c) => {
  const id = uuid();
  const body = c.req.valid('json');
  const currentUserId = c.get('userId');
  await db.insert(schema.tenantGroups).values({ id, ...body, ownerUserId: body.ownerUserId || currentUserId });
  return c.json({ data: { id } }, 201);
});

groups.get('/groups', authMiddleware, requireRole('super_admin', 'admin'), async (c) => {
  const all = await db.select().from(schema.tenantGroups).orderBy(schema.tenantGroups.name);
  return c.json({ data: all });
});

groups.post('/groups/:groupId/tenants/:tenantId', authMiddleware, requireRole('super_admin', 'admin'), async (c) => {
  const groupId = c.req.param('groupId')!;
  const tenantId = c.req.param('tenantId')!;
  await db.update(schema.tenants).set({ groupId }).where(eq(schema.tenants.id, tenantId));
  return c.json({ success: true });
});

groups.delete('/groups/:groupId/tenants/:tenantId', authMiddleware, requireRole('super_admin', 'admin'), async (c) => {
  const tenantId = c.req.param('tenantId')!;
  await db.update(schema.tenants).set({ groupId: null }).where(eq(schema.tenants.id, tenantId));
  return c.json({ success: true });
});

groups.get('/groups/:groupId/analytics', authMiddleware, requireRole('super_admin', 'admin'), async (c) => {
  const groupId = c.req.param('groupId')!;
  const tenants = await db.select().from(schema.tenants).where(eq(schema.tenants.groupId, groupId));
  const tenantIds = tenants.map((t) => t.id);

  if (tenantIds.length === 0) return c.json({ data: { totalRevenue: 0, totalOrders: 0, tenantCount: 0, perTenant: [] } });

  const total = await db
    .select({
      revenue: sql`COALESCE(SUM(${schema.orders.total}), 0)`,
      count: sql`COUNT(*)`,
    })
    .from(schema.orders)
    .where(        and(sql`${schema.orders.tenantId} IN (${sql.join(tenantIds.map((id) => sql`${id}`), sql`, `)})`, eq(schema.orders.paymentStatus, 'paid')));

  const perTenant = [];
  for (const tenant of tenants) {
    const [stats] = await db
      .select({
        revenue: sql`COALESCE(SUM(${schema.orders.total}), 0)`,
        count: sql`COUNT(*)`,
      })
      .from(schema.orders)
      .where(and(eq(schema.orders.tenantId, tenant.id), eq(schema.orders.paymentStatus, 'paid')));
    perTenant.push({ id: tenant.id, name: tenant.name, slug: tenant.slug, revenue: Number(stats.revenue), orders: Number(stats.count) });
  }

  return c.json({ data: { totalRevenue: Number(total[0]?.revenue || 0), totalOrders: Number(total[0]?.count || 0), tenantCount: tenantIds.length, perTenant } });
});

export default groups;
