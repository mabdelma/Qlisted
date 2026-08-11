import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { resolveTenant } from '../middleware/tenant.js';
import { db, schema } from '../db/index.js';
import { eq, sql } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { redeemPointsForOrder } from '../services/loyaltyService.js';

const loyalty = new Hono();

const DEFAULT_REWARDS = [
  { id: 'reward-1', name: '$5 Off', pointsCost: 100, description: 'Get $5 off your next order' },
  { id: 'reward-2', name: 'Free Dessert', pointsCost: 200, description: 'Free dessert on any order' },
  { id: 'reward-3', name: 'Free Drink', pointsCost: 150, description: 'Free beverage of your choice' },
  { id: 'reward-4', name: '10% Off', pointsCost: 300, description: '10% off your entire order' },
];

function computeTier(lifetimePoints: number): string {
  if (lifetimePoints >= 1000) return 'platinum';
  if (lifetimePoints >= 500) return 'gold';
  if (lifetimePoints >= 200) return 'silver';
  return 'bronze';
}

async function getOrCreate(tenantId: string) {
  const existing = await db
    .select()
    .from(schema.loyaltySummary)
    .where(eq(schema.loyaltySummary.tenantId, tenantId))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  const record = {
    id: uuid(),
    tenantId,
    points: 50,
    lifetimePoints: 50,
    tier: 'bronze' as const,
    updatedAt: new Date().toISOString(),
  };

  await db.insert(schema.loyaltySummary).values(record);

  await db.insert(schema.loyaltyTransactions).values({
    id: uuid(),
    tenantId,
    type: 'earn' as const,
    amount: 50,
    description: 'Welcome bonus',
    createdAt: new Date().toISOString(),
  });

  return record;
}

async function ensureTier(tenantId: string, summary: { id: string; lifetimePoints: number }) {
  const tier = computeTier(summary.lifetimePoints) as 'bronze' | 'silver' | 'gold' | 'platinum';
  await db.update(schema.loyaltySummary)
    .set({ tier, updatedAt: new Date().toISOString() })
    .where(eq(schema.loyaltySummary.id, summary.id));
  return tier;
}

loyalty.get('/:slug/loyalty', authMiddleware, requireRole('admin', 'manager', 'waiter', 'cashier'), resolveTenant, async (c) => {
  const tenantId = c.get('tenantId') as string;
  const summary = await getOrCreate(tenantId);
  await ensureTier(tenantId, summary);

  const history = await db
    .select()
    .from(schema.loyaltyTransactions)
    .where(eq(schema.loyaltyTransactions.tenantId, tenantId))
    .orderBy(sql`created_at desc`)
    .limit(100);

  return c.json({
    points: summary.points,
    tier: computeTier(summary.lifetimePoints),
    lifetimePoints: summary.lifetimePoints,
    history,
    rewards: DEFAULT_REWARDS,
  });
});

const earnSchema = z.object({
  amount: z.number().int().positive(),
  orderId: z.string().optional(),
});

loyalty.post('/:slug/loyalty/earn', authMiddleware, requireRole('admin', 'manager', 'waiter'), resolveTenant, zValidator('json', earnSchema), async (c) => {
  const tenantId = c.get('tenantId') as string;
  const { amount, orderId } = c.req.valid('json');

  const summary = await getOrCreate(tenantId);
  const newPoints = summary.points + amount;
  const newLifetime = summary.lifetimePoints + amount;
  const tier = computeTier(newLifetime) as 'bronze' | 'silver' | 'gold' | 'platinum';

  await db.update(schema.loyaltySummary)
    .set({ points: newPoints, lifetimePoints: newLifetime, tier, updatedAt: new Date().toISOString() })
    .where(eq(schema.loyaltySummary.id, summary.id));

  await db.insert(schema.loyaltyTransactions).values({
    id: uuid(),
    tenantId,
    type: 'earn',
    amount,
    description: orderId ? `Order #${orderId.slice(0, 8)}` : 'Points earned',
    createdAt: new Date().toISOString(),
  });

  return c.json({ success: true, points: newPoints, tier });
});

const redeemSchema = z.object({
  points: z.number().int().positive(),
  rewardId: z.string().optional(),
});

loyalty.post('/:slug/loyalty/redeem', authMiddleware, requireRole('admin', 'manager', 'waiter'), resolveTenant, zValidator('json', redeemSchema), async (c) => {
  const tenantId = c.get('tenantId') as string;
  const { points, rewardId } = c.req.valid('json');

  const summary = await getOrCreate(tenantId);

  if (summary.points < points) {
    return c.json({ error: 'Insufficient points' }, 400);
  }

  const newPoints = summary.points - points;

  await db.update(schema.loyaltySummary)
    .set({ points: newPoints, updatedAt: new Date().toISOString() })
    .where(eq(schema.loyaltySummary.id, summary.id));

  const reward = DEFAULT_REWARDS.find((r) => r.id === rewardId);
  await db.insert(schema.loyaltyTransactions).values({
    id: uuid(),
    tenantId,
    type: 'redeem',
    amount: points,
    description: reward ? `Redeemed: ${reward.name}` : 'Points redeemed',
    createdAt: new Date().toISOString(),
  });

  return c.json({ success: true, points: newPoints, discount: points * 0.05 });
});

const redeemForOrderSchema = z.object({
  orderId: z.string().min(1),
  points: z.number().int().positive(),
});

// Redeem loyalty points as a currency discount applied to a concrete order.
// Closes the loop the legacy /redeem endpoint leaves open: it not only deducts
// points but writes the resulting discount onto the order total.
loyalty.post('/:slug/loyalty/redeem-for-order', authMiddleware, requireRole('admin', 'manager', 'waiter', 'cashier'), resolveTenant, zValidator('json', redeemForOrderSchema), async (c) => {
  const tenantId = c.get('tenantId') as string;
  const { orderId, points } = c.req.valid('json');

  const result = await redeemPointsForOrder(tenantId, orderId, points);

  if (result.error) {
    return c.json({ error: result.error }, result.status);
  }

  return c.json({ success: true, ...result.data });
});

export default loyalty;
