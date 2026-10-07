import { Hono } from 'hono';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { resolveTenant } from '../middleware/tenant.js';
import { parsePagination } from '../lib/pagination.js';
import {
  createPaymentIntent,
  recordCashPayment,
  splitPayment,
  listPayments,
  createPaymentLink,
  handleStripeWebhook,
  getPaymentLinkByToken,
  requestCashPayment,
} from '../services/paymentService.js';

const payments = new Hono();

payments.post('/:slug/payments/create-intent', resolveTenant, async (c) => {
  const tenantId = c.get('tenantId');
  const { orderId, tip, amount } = await c.req.json<{ orderId: string; tip?: number; amount?: number }>();

  const result = await createPaymentIntent(tenantId, orderId, tip, amount);
  if ('error' in result) {
    return c.json({ error: result.error }, result.status);
  }
  return c.json(result.data);
});

/**
 * Guest asking to settle in cash from the table.
 *
 * Public, because a guest scanning a QR code has no account — the client has
 * always called the cash endpoint with `skipAuth: true`, while the server
 * required admin/cashier, so paying cash from the table returned 401 every
 * single time.
 *
 * This does NOT mark the order paid. It records a pending cash payment and
 * notifies staff; the authenticated endpoint below is what confirms the money
 * arrived. Opening that one up instead would let anyone with the bill URL
 * declare their own bill settled.
 */
payments.post('/:slug/payments/cash-request', resolveTenant, async (c) => {
  const tenantId = c.get('tenantId');
  const { orderId, amount, tip } = await c.req.json<{ orderId: string; amount: number; tip?: number }>();
  if (!orderId) return c.json({ error: 'orderId required' }, 400);
  const result = await requestCashPayment(tenantId, orderId, Number(amount) || 0, Number(tip) || 0);
  if ('error' in result) return c.json({ error: result.error }, result.status);
  return c.json(result.data, 201);
});

payments.post('/:slug/payments/cash', authMiddleware, requireRole('admin', 'cashier'), resolveTenant, async (c) => {
  const tenantId = c.get('tenantId');
  const { orderId, amount, tip } = await c.req.json<{ orderId: string; amount: number; tip?: number }>();
  const result = await recordCashPayment(tenantId, orderId, amount, tip);
  if ('error' in result) return c.json({ error: result.error }, result.status);
  return c.json(result.data, 201);
});

payments.post('/:slug/payments/split', authMiddleware, requireRole('admin', 'cashier'), resolveTenant, async (c) => {
  const tenantId = c.get('tenantId');
  const { orderId, splits } = await c.req.json<{ orderId: string; splits: Array<{ method: 'card' | 'cash' | 'wallet'; amount: number; tip?: number }> }>();
  const result = await splitPayment(tenantId, orderId, splits);
  if ('error' in result) return c.json({ error: result.error }, result.status);
  return c.json(result.data, 201);
});

payments.get('/:slug/payments', authMiddleware, requireRole('admin', 'manager'), resolveTenant, async (c) => {
  const tenantId = c.get('tenantId');
  const { page, limit } = parsePagination(c.req.query());
  const result = await listPayments(tenantId, { page, limit });
  return c.json(result);
});

payments.post('/:slug/payment-links', authMiddleware, requireRole('admin', 'cashier'), resolveTenant, async (c) => {
  const tenantId = c.get('tenantId');
  const { orderId, amount, description } = await c.req.json<{ orderId?: string; amount: number; description?: string }>();
  const result = await createPaymentLink(tenantId, orderId, amount, description);
  return c.json(result, 201);
});

export const webhookRoutes = new Hono();

webhookRoutes.post('/webhooks/stripe', async (c) => {
  const sig = c.req.header('stripe-signature');
  const body = await c.req.text();

  if (!sig) return c.json({ error: 'Missing signature' }, 400);

  const result = await handleStripeWebhook(body, sig);
  if ('error' in result) {
    return c.json({ error: result.error }, result.status);
  }
  return c.json(result.data);
});

payments.get('/payment-links/:token', async (c) => {
  const token = c.req.param('token')!;
  const result = await getPaymentLinkByToken(token);

  if ('error' in result) {
    return c.json({ error: result.error }, result.status);
  }
  return c.json(result.data);
});

export default payments;
