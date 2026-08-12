import { db, schema } from '../db/index.js';
import { eq, and } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { logger } from '../lib/logger.js';

/**
 * Points-to-currency conversion rate.
 * 1 point = $0.05 of order discount (i.e. 100 points = $5.00), matching the
 * "$5 Off / 100 points" reward tier surfaced in the loyalty UI.
 */
export const POINTS_TO_CURRENCY = 0.05;

/**
 * Convert a points balance into the equivalent currency discount, rounded to
 * cents. Pure helper — no I/O — so it is trivially unit-testable and reusable.
 */
export function pointsToCurrency(points: number): number {
  return Math.round(points * POINTS_TO_CURRENCY * 100) / 100;
}

interface RedeemResult {
  data?: {
    pointsRedeemed: number;
    discountApplied: number;
    remainingPoints: number;
    newTotal: number;
  };
  error?: string;
  status: 200 | 400 | 404;
}

/**
 * Redeem loyalty points as a currency discount applied to a concrete order.
 *
 * Unlike the legacy `/loyalty/redeem` endpoint (which deducts points and
 * returns a discount figure that is never applied anywhere), this closes the
 * loop: it deducts points, records a `redeem` transaction, and writes the
 * discount onto the order's `discountAmount` / `discountReason` / `total`.
 *
 * Guards:
 *  - points must be positive
 *  - tenant must have enough points
 *  - order must exist (and belong to the tenant)
 *  - the discount is capped so the order total never drops below 0
 */
export async function redeemPointsForOrder(
  tenantId: string,
  orderId: string,
  points: number,
): Promise<RedeemResult> {
  if (!Number.isInteger(points) || points <= 0) {
    return { error: 'Points must be a positive integer', status: 400 };
  }

  const [summary] = await db
    .select()
    .from(schema.loyaltySummary)
    .where(eq(schema.loyaltySummary.tenantId, tenantId))
    .limit(1);

  if (!summary) {
    return { error: 'No loyalty balance found', status: 404 };
  }

  if (summary.points < points) {
    return { error: 'Insufficient points', status: 400 };
  }

  const [order] = await db
    .select()
    .from(schema.orders)
    .where(and(eq(schema.orders.id, orderId), eq(schema.orders.tenantId, tenantId)))
    .limit(1);

  if (!order) {
    return { error: 'Order not found', status: 404 };
  }

  if (order.paymentStatus === 'paid') {
    return { error: 'Order already paid', status: 400 };
  }

  // Cap the discount at the order total so we never go negative, and only
  // charge the customer the points that were actually needed.
  const requestedDiscount = pointsToCurrency(points);
  const discountApplied = Math.min(requestedDiscount, order.total);
  const pointsRedeemed = discountApplied === requestedDiscount
    ? points
    : Math.ceil(discountApplied / POINTS_TO_CURRENCY);

  const remainingPoints = summary.points - pointsRedeemed;
  const newTotal = Math.max(0, Math.round((order.total - discountApplied) * 100) / 100);

  await db.update(schema.loyaltySummary)
    .set({ points: remainingPoints, updatedAt: new Date().toISOString() })
    .where(eq(schema.loyaltySummary.id, summary.id));

  await db.insert(schema.loyaltyTransactions).values({
    id: uuid(),
    tenantId,
    orderId,
    type: 'redeem',
    amount: pointsRedeemed,
    description: `Redeemed ${pointsRedeemed} pts (-$${discountApplied.toFixed(2)}) on order #${orderId.slice(0, 8)}`,
    createdAt: new Date().toISOString(),
  });

  await db.update(schema.orders)
    .set({
      discountAmount: (order.discountAmount || 0) + discountApplied,
      discountReason: order.discountReason
        ? `${order.discountReason} | Loyalty (-$${discountApplied.toFixed(2)})`
        : `Loyalty redemption (-$${discountApplied.toFixed(2)})`,
      total: newTotal,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.orders.id, orderId));

  logger.info({ tenantId, orderId, pointsRedeemed, discountApplied }, 'Loyalty points redeemed for order');

  return {
    data: { pointsRedeemed, discountApplied, remainingPoints, newTotal },
    status: 200,
  };
}
