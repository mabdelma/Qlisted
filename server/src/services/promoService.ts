import { db, schema } from '../db/index.js';
import { eq, and, sql } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { logger } from '../lib/logger.js';

export type PromoCampaignType = 'percentage' | 'fixed' | 'buy_x_get_y' | 'happy_hour';

export interface PromoItems {
  unitPrice: number;
  quantity: number;
}

interface DiscountCampaign {
  type: string;
  value: number;
  maxDiscount?: number | null;
  buyQuantity?: number | null;
  getQuantity?: number | null;
  getDiscountPercent?: number | null;
}

/**
 * Real buy-one-get-one math.
 *
 * Items are expanded into a list of unit prices. Every bundle of
 * `buyQuantity + getQuantity` items qualifies: the cheapest `getQuantity`
 * units within each complete bundle are discounted by `getDiscountPercent`
 * (100 = free). Without item-level data we fall back to a flat `value`
 * discount so the legacy "value dollars off" behavior is preserved.
 */
export function computeBogoDiscount(
  items: PromoItems[],
  buyQuantity: number,
  getQuantity: number,
  discountPercent: number,
  fallbackValue: number,
): number {
  if (buyQuantity <= 0 || getQuantity <= 0) return fallbackValue;
  const prices: number[] = [];
  for (const item of items) {
    for (let i = 0; i < Math.floor(item.quantity || 0); i++) {
      prices.push(item.unitPrice || 0);
    }
  }
  if (prices.length === 0) return fallbackValue;

  const bundleSize = buyQuantity + getQuantity;
  const freeCount = Math.floor(prices.length / bundleSize) * getQuantity;
  if (freeCount === 0) return 0;

  prices.sort((a, b) => a - b);
  const freeAmount = prices.slice(0, freeCount).reduce((sum, p) => sum + p, 0);
  return Math.round(freeAmount * (discountPercent / 100) * 100) / 100;
}

/**
 * Pure discount calculator shared by promo validation and application so the
 * preview always matches the final applied discount. Returns 0 when no
 * discount applies (e.g. incomplete BOGO bundle with no free items).
 */
export function computePromoDiscount(
  campaign: DiscountCampaign,
  subtotal: number,
  items?: PromoItems[],
): number {
  let discount = 0;
  switch (campaign.type) {
    case 'percentage':
    case 'happy_hour':
      discount = subtotal * (campaign.value / 100);
      if (campaign.maxDiscount) discount = Math.min(discount, campaign.maxDiscount);
      break;
    case 'fixed':
      discount = campaign.value;
      break;
    case 'buy_x_get_y':
      discount = computeBogoDiscount(
        items ?? [],
        campaign.buyQuantity ?? 0,
        campaign.getQuantity ?? 0,
        campaign.getDiscountPercent ?? 100,
        campaign.value,
      );
      break;
    default:
      return 0;
  }
  return Math.min(Math.max(0, discount), subtotal);
}

export interface ApplyPromoResult {
  data?: { discountAmount: number; newTotal: number };
  error?: string;
  status: 200 | 400 | 404;
}

export async function applyPromoCode(tenantId: string, orderId: string, code: string): Promise<ApplyPromoResult> {
  const [campaign] = await db
    .select()
    .from(schema.promoCampaigns)
    .where(and(
      eq(schema.promoCampaigns.tenantId, tenantId),
      eq(schema.promoCampaigns.isActive, true),
      sql`lower(${schema.promoCampaigns.name}) = lower(${code})`,
    ))
    .limit(1);

  if (!campaign) return { error: 'Invalid promo code', status: 404 as const };

  if (campaign.usageLimit && campaign.usageCount >= campaign.usageLimit) {
    return { error: 'Promo code usage limit reached', status: 400 as const };
  }

  if (campaign.startDate && new Date(campaign.startDate) > new Date()) {
    return { error: 'Promo code not yet active', status: 400 as const };
  }
  if (campaign.endDate && new Date(campaign.endDate) < new Date()) {
    return { error: 'Promo code has expired', status: 400 as const };
  }

  if (campaign.daysOfWeek) {
    const allowedDays = campaign.daysOfWeek.split(',').map(Number);
    const today = new Date().getDay();
    if (!allowedDays.includes(today)) {
      return { error: 'Promo code not valid today', status: 400 as const };
    }
  }

  if (campaign.timeStart && campaign.timeEnd) {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [startH, startM] = campaign.timeStart.split(':').map(Number);
    const [endH, endM] = campaign.timeEnd.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
      return { error: 'Promo code not valid at this time', status: 400 as const };
    }
  }

  const [order] = await db
    .select()
    .from(schema.orders)
    .where(and(eq(schema.orders.id, orderId), eq(schema.orders.tenantId, tenantId)))
    .limit(1);
  if (!order) return { error: 'Order not found', status: 404 as const };

  if (order.paymentStatus === 'paid') {
    return { error: 'Order already paid', status: 400 as const };
  }

  if (campaign.minOrderAmount && order.subtotal < campaign.minOrderAmount) {
    return { error: `Minimum order amount of ${campaign.minOrderAmount} required`, status: 400 as const };
  }

  const orderItems = await db
    .select()
    .from(schema.orderItems)
    .where(eq(schema.orderItems.orderId, orderId));

  const items = (orderItems ?? []).map((item) => ({ unitPrice: item.unitPrice, quantity: item.quantity }));
  const discountAmount = computePromoDiscount(campaign, order.subtotal, items);

  if (discountAmount <= 0) {
    return { error: 'Promo code does not apply to this order', status: 400 as const };
  }

  const usageId = uuid();
  await db.insert(schema.promoCodeUsages).values({
    id: usageId, campaignId: campaign.id, orderId, discountAmount,
  });

  await db.update(schema.promoCampaigns)
    .set({ usageCount: sql`${schema.promoCampaigns.usageCount} + 1` })
    .where(eq(schema.promoCampaigns.id, campaign.id));

  const newTotal = Math.max(0, order.total - discountAmount);
  const reason = `Promo: ${code} (-$${discountAmount.toFixed(2)})`;
  await db.update(schema.orders)
    .set({
      discountAmount: (order.discountAmount || 0) + discountAmount,
      discountReason: order.discountReason ? `${order.discountReason} | ${reason}` : reason,
      total: newTotal,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.orders.id, orderId));

  logger.info({ tenantId, orderId, code, discountAmount }, 'Promo code applied');
  return { data: { discountAmount, newTotal }, status: 200 as const };
}

export interface CampaignInput {
  name: string;
  type: PromoCampaignType;
  value: number;
  minOrderAmount?: number;
  maxDiscount?: number;
  buyQuantity?: number;
  getQuantity?: number;
  getDiscountPercent?: number;
  startDate?: string;
  endDate?: string;
  daysOfWeek?: string;
  timeStart?: string;
  timeEnd?: string;
  usageLimit?: number;
}

export async function createCampaign(tenantId: string, data: CampaignInput) {
  const id = uuid();
  await db.insert(schema.promoCampaigns).values({ id, tenantId, ...data });
  return { id };
}

export async function getCampaigns(tenantId: string) {
  return db
    .select()
    .from(schema.promoCampaigns)
    .where(eq(schema.promoCampaigns.tenantId, tenantId))
    .orderBy(schema.promoCampaigns.createdAt);
}

export async function updateCampaign(campaignId: string, tenantId: string, data: Partial<CampaignInput>) {
  await db.update(schema.promoCampaigns)
    .set(data)
    .where(and(eq(schema.promoCampaigns.id, campaignId), eq(schema.promoCampaigns.tenantId, tenantId)));
}

export async function deleteCampaign(campaignId: string, tenantId: string) {
  await db.delete(schema.promoCodeUsages)
    .where(eq(schema.promoCodeUsages.campaignId, campaignId));
  await db.delete(schema.promoCampaigns)
    .where(and(eq(schema.promoCampaigns.id, campaignId), eq(schema.promoCampaigns.tenantId, tenantId)));
}
