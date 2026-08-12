import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { resolveTenant } from '../middleware/tenant.js';
import { applyPromoCode, createCampaign, getCampaigns, updateCampaign, deleteCampaign } from '../services/promoService.js';

const promos = new Hono();

const applyPromoSchema = z.object({
  code: z.string().min(1).max(100),
});

const campaignSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['percentage', 'fixed', 'buy_x_get_y', 'happy_hour']),
  value: z.number().min(0),
  minOrderAmount: z.number().min(0).optional(),
  maxDiscount: z.number().min(0).optional(),
  buyQuantity: z.number().int().positive().optional(),
  getQuantity: z.number().int().positive().optional(),
  getDiscountPercent: z.number().min(0).max(100).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  daysOfWeek: z.string().optional(),
  timeStart: z.string().optional(),
  timeEnd: z.string().optional(),
  usageLimit: z.number().int().positive().optional(),
});

promos.post('/:slug/orders/:orderId/apply-promo', authMiddleware, requireRole('admin', 'manager', 'waiter'), resolveTenant, zValidator('json', applyPromoSchema), async (c) => {
  const tenantId = c.get('tenantId');
  const orderId = c.req.param('orderId')!;
  const { code } = c.req.valid('json');
  const result = await applyPromoCode(tenantId, orderId, code);
  if ('error' in result) return c.json({ error: result.error }, result.status);
  return c.json(result.data);
});

promos.get('/:slug/campaigns', authMiddleware, requireRole('admin', 'manager'), resolveTenant, async (c) => {
  const tenantId = c.get('tenantId');
  const campaigns = await getCampaigns(tenantId);
  return c.json({ data: campaigns });
});

promos.post('/:slug/campaigns', authMiddleware, requireRole('admin'), resolveTenant, zValidator('json', campaignSchema), async (c) => {
  const tenantId = c.get('tenantId');
  const body = c.req.valid('json');
  const result = await createCampaign(tenantId, body);
  return c.json({ data: result }, 201);
});

promos.put('/:slug/campaigns/:campaignId', authMiddleware, requireRole('admin'), resolveTenant, zValidator('json', campaignSchema.partial()), async (c) => {
  const tenantId = c.get('tenantId');
  const campaignId = c.req.param('campaignId')!;
  const body = c.req.valid('json');
  await updateCampaign(campaignId, tenantId, body);
  return c.json({ success: true });
});

promos.delete('/:slug/campaigns/:campaignId', authMiddleware, requireRole('admin'), resolveTenant, async (c) => {
  const tenantId = c.get('tenantId');
  const campaignId = c.req.param('campaignId')!;
  await deleteCampaign(campaignId, tenantId);
  return c.json({ success: true });
});

export default promos;
