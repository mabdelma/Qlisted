import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { resolveTenant } from '../middleware/tenant.js';
import { db, schema } from '../db/index.js';
import { eq, and, sql } from 'drizzle-orm';
import { computePromoDiscount } from '../services/promoService.js';

const promoValidate = new Hono();

const validateQuerySchema = z.object({
  code: z.string().min(1).max(100),
  subtotal: z.string().optional(),
});

promoValidate.get('/:slug/promo/validate', authMiddleware, requireRole('admin', 'manager', 'waiter', 'cashier'), resolveTenant, zValidator('query', validateQuerySchema), async (c) => {
  const tenantId = c.get('tenantId') as string;
  const { code, subtotal: subtotalStr } = c.req.valid('query');

  const [campaign] = await db
    .select()
    .from(schema.promoCampaigns)
    .where(and(
      eq(schema.promoCampaigns.tenantId, tenantId),
      eq(schema.promoCampaigns.isActive, true),
      sql`lower(${schema.promoCampaigns.name}) = lower(${code})`,
    ))
    .limit(1);

  if (!campaign) return c.json({ error: 'Invalid promo code' }, 404);

  if (campaign.usageLimit && campaign.usageCount >= campaign.usageLimit) {
    return c.json({ error: 'Promo code usage limit reached' }, 400);
  }

  if (campaign.startDate && new Date(campaign.startDate) > new Date()) {
    return c.json({ error: 'Promo code not yet active' }, 400);
  }
  if (campaign.endDate && new Date(campaign.endDate) < new Date()) {
    return c.json({ error: 'Promo code has expired' }, 400);
  }

  if (campaign.daysOfWeek) {
    const allowedDays = campaign.daysOfWeek.split(',').map(Number);
    const today = new Date().getDay();
    if (!allowedDays.includes(today)) {
      return c.json({ error: 'Promo code not valid today' }, 400);
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
      return c.json({ error: 'Promo code not valid at this time' }, 400);
    }
  }

  const subtotal = parseFloat(subtotalStr || '0');

  if (campaign.minOrderAmount && subtotal < campaign.minOrderAmount) {
    return c.json({ error: `Minimum order amount of ${campaign.minOrderAmount} required` }, 400);
  }

  const discount = computePromoDiscount(campaign, subtotal);

  if (discount <= 0) {
    return c.json({ error: 'Promo code does not apply to this order' }, 400);
  }

  return c.json({
    valid: true,
    code: campaign.name,
    type: campaign.type,
    value: campaign.value,
    discount,
    description: campaign.type === 'percentage' ? `${campaign.value}% off` : `$${campaign.value} off`,
  });
});

export default promoValidate;
