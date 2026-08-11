import { db, schema } from '../db/index.js';
import { eq, and, sql } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import crypto from 'crypto';
import { logger } from '../lib/logger.js';
import { sendEmail, brandedEmailHtml } from '../lib/mail.js';
import { emitOrderEvent } from '../lib/events.js';
import { handleSubscriptionEvent } from './subscriptionService.js';
import Stripe from 'stripe';
import type { PaginationParams, PaginatedResult } from '../lib/pagination.js';
import { buildPagination } from '../lib/pagination.js';

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: '2025-02-24.acacia' });
}

/**
 * Stripe request options that scope a call to a tenant's connected account
 * (Connect direct charge). Per-tenant routing is OPT-IN via STRIPE_CONNECT_ENABLED
 * — by default (and here) everyone settles to the platform's shared Stripe
 * account, ignoring any tenant stripeAccountId. Flip the flag to route per tenant.
 */
function stripeAccountOpts(accountId?: string | null): { stripeAccount: string } | undefined {
  if (process.env.STRIPE_CONNECT_ENABLED !== 'true') return undefined;
  return accountId ? { stripeAccount: accountId } : undefined;
}

async function updateOrderPaymentStatus(tenantId: string, orderId: string) {
  const [order] = await db
    .select()
    .from(schema.orders)
    .where(and(eq(schema.orders.id, orderId), eq(schema.orders.tenantId, tenantId)))
    .limit(1);
  if (!order) return;

  const payments = await db
    .select()
    .from(schema.payments)
    .where(and(eq(schema.payments.orderId, orderId), eq(schema.payments.status, 'paid')));

  const totalPaid = payments.reduce((sum, p) => sum + p.amount + (p.tip || 0), 0);
  const remainingBalance = order.total - totalPaid;

  let paymentStatus: string;
  if (remainingBalance <= 0) {
    paymentStatus = 'paid';
  } else if (totalPaid > 0) {
    paymentStatus = 'partially_paid';
  } else {
    paymentStatus = 'unpaid';
  }

  await db.update(schema.orders)
    .set({ paymentStatus: paymentStatus as typeof schema.orders.$inferSelect.paymentStatus, paidAmount: totalPaid, updatedAt: new Date().toISOString() })
    .where(eq(schema.orders.id, orderId));

  return { totalPaid, remainingBalance: Math.max(0, remainingBalance), paymentStatus };
}

export async function createPaymentIntent(tenantId: string, orderId: string, tip?: number, amount?: number) {
  const [order] = await db
    .select()
    .from(schema.orders)
    .where(and(eq(schema.orders.id, orderId), eq(schema.orders.tenantId, tenantId)))
    .limit(1);

  if (!order) return { error: 'Order not found', status: 404 as const };
  if (order.paymentStatus === 'paid') return { error: 'Order already paid', status: 400 as const };

  const existingPayments = await db
    .select()
    .from(schema.payments)
    .where(and(eq(schema.payments.orderId, orderId), eq(schema.payments.status, 'paid')));
  const totalPaidSoFar = existingPayments.reduce((s, p) => s + p.amount + (p.tip || 0), 0);
  const remainingBalance = order.total - totalPaidSoFar;

  if (remainingBalance <= 0) return { error: 'Order already fully paid', status: 400 as const };

  const paymentAmount = amount ? Math.min(amount, remainingBalance) : remainingBalance;
  const stripe = getStripe();
  const chargeAmount = Math.round((paymentAmount + (tip || 0)) * 100);

  // Charge in the tenant's own currency and let Stripe surface every eligible
  // local method (Bizum for EUR/Spain, cards, wallets, …) via the Payment
  // Element — no per-method code. Bizum must be enabled on the Stripe account.
  const [tenant] = await db.select({ currency: schema.tenants.currency, stripeAccountId: schema.tenants.stripeAccountId }).from(schema.tenants).where(eq(schema.tenants.id, tenantId)).limit(1);
  const currency = (tenant?.currency || 'usd').toLowerCase();
  // When the tenant has connected their own Stripe, charge directly on their
  // account so the money lands there — otherwise it goes to the platform account.
  const acctOpts = stripeAccountOpts(tenant?.stripeAccountId);

  if (stripe) {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: chargeAmount,
      currency,
      automatic_payment_methods: { enabled: true },
      metadata: { orderId, tenantId },
    }, acctOpts);

    const paymentId = uuid();
    await db.insert(schema.payments).values({
      id: paymentId,
      tenantId,
      orderId,
      amount: paymentAmount,
      tip: tip || 0,
      method: 'card',
      status: 'pending',
      stripePaymentIntentId: paymentIntent.id,
    });

    logger.info({ tenantId, orderId, paymentId, amount: paymentAmount }, 'Payment intent created');
    return { data: { clientSecret: paymentIntent.client_secret, paymentId, amount: chargeAmount }, status: 200 as const };
  }

  const paymentId = uuid();
  await db.insert(schema.payments).values({
    id: paymentId,
    tenantId,
    orderId,
    amount: paymentAmount,
    tip: tip || 0,
    method: 'card',
    status: 'paid',
  });

  const result = await updateOrderPaymentStatus(tenantId, orderId);
  logger.info({ tenantId, orderId, paymentId, amount: paymentAmount, remainingBalance: result?.remainingBalance }, 'Mock payment processed');

  emitOrderEvent({ type: 'order_updated', tenantId, orderId, data: { paymentId, paymentStatus: result?.paymentStatus } });

  if (result?.paymentStatus === 'paid') {
    sendReceiptEmail(tenantId, orderId, paymentId).catch(() => {});
  }

  return { data: { status: 'paid', paymentId, amount: chargeAmount, remainingBalance: result?.remainingBalance, mock: true }, status: 200 as const };
}

export async function recordCashPayment(tenantId: string, orderId: string, amount: number, tip?: number) {
  const paymentId = uuid();

  const [order] = await db
    .select()
    .from(schema.orders)
    .where(and(eq(schema.orders.id, orderId), eq(schema.orders.tenantId, tenantId)))
    .limit(1);
  if (!order) return { error: 'Order not found', status: 404 as const };

  const existingPayments = await db
    .select()
    .from(schema.payments)
    .where(and(eq(schema.payments.orderId, orderId), eq(schema.payments.status, 'paid')));
  const totalPaidSoFar = existingPayments.reduce((s, p) => s + p.amount + (p.tip || 0), 0);
  const remainingBalance = order.total - totalPaidSoFar;
  const cashAmount = Math.min(amount, remainingBalance);

  await db.insert(schema.payments).values({
    id: paymentId,
    tenantId,
    orderId,
    amount: cashAmount,
    tip: tip || 0,
    method: 'cash',
    status: 'paid',
  });

  const result = await updateOrderPaymentStatus(tenantId, orderId);
  logger.info({ tenantId, orderId, paymentId, method: 'cash', amount: cashAmount }, 'Cash payment recorded');

  emitOrderEvent({ type: 'order_updated', tenantId, orderId, data: { paymentId, method: 'cash', paymentStatus: result?.paymentStatus } });

  if (result?.paymentStatus === 'paid') {
    sendReceiptEmail(tenantId, orderId, paymentId).catch(() => {});
  }

  return { data: { id: paymentId, status: 'paid', amount: cashAmount, remainingBalance: result?.remainingBalance }, status: 200 as const };
}

export async function splitPayment(tenantId: string, orderId: string, splits: Array<{ method: 'card' | 'cash' | 'wallet'; amount: number; tip?: number }>) {
  const [order] = await db
    .select()
    .from(schema.orders)
    .where(and(eq(schema.orders.id, orderId), eq(schema.orders.tenantId, tenantId)))
    .limit(1);
  if (!order) return { error: 'Order not found', status: 404 as const };

  const existingPayments = await db
    .select()
    .from(schema.payments)
    .where(and(eq(schema.payments.orderId, orderId), eq(schema.payments.status, 'paid')));
  const totalPaidSoFar = existingPayments.reduce((s, p) => s + p.amount + (p.tip || 0), 0);
  const remainingBalance = order.total - totalPaidSoFar;

  if (remainingBalance <= 0) return { error: 'Order already fully paid', status: 400 as const };

  const results = [];
  for (const split of splits) {
    const paymentId = uuid();
    await db.insert(schema.payments).values({
      id: paymentId,
      tenantId,
      orderId,
      amount: split.amount,
      tip: split.tip || 0,
      method: split.method,
      status: 'paid',
    });
    results.push({ id: paymentId, method: split.method, amount: split.amount });
  }

  const result = await updateOrderPaymentStatus(tenantId, orderId);
  logger.info({ tenantId, orderId, splits: results.length }, 'Split payment processed');

  emitOrderEvent({ type: 'order_updated', tenantId, orderId, data: { paymentIds: results.map(r => r.id), paymentStatus: result?.paymentStatus } });

  if (result?.paymentStatus === 'paid') {
    sendReceiptEmail(tenantId, orderId, results[0]?.id || '').catch(() => {});
  }

  return { data: { payments: results, remainingBalance: result?.remainingBalance }, status: 200 as const };
}

export async function listPayments(tenantId: string, params: PaginationParams = {}): Promise<PaginatedResult<typeof schema.payments.$inferSelect>> {
  const { page = 1, limit = 20 } = params;
  const offset = (page - 1) * limit;

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.payments)
    .where(eq(schema.payments.tenantId, tenantId));

  const data = await db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.tenantId, tenantId))
    .orderBy(schema.payments.createdAt)
    .limit(limit)
    .offset(offset);

  return buildPagination(data, Number(count), { page, limit });
}

export async function createPaymentLink(tenantId: string, orderId?: string, amount?: number, description?: string, meta?: { bookingId?: string; kind?: 'folio' | 'deposit' }) {
  const linkId = uuid();
  const token = crypto.randomBytes(24).toString('hex');

  const stripe = getStripe();
  let stripeLinkId: string | undefined;

  if (stripe && amount) {
    // Route the link (and its price) to the tenant's connected account when set.
    const [tenant] = await db.select({ stripeAccountId: schema.tenants.stripeAccountId })
      .from(schema.tenants).where(eq(schema.tenants.id, tenantId)).limit(1);
    const acctOpts = stripeAccountOpts(tenant?.stripeAccountId);
    const price = await stripe.prices.create({
      currency: 'usd',
      product_data: { name: description || 'Restaurant Payment' },
      unit_amount: Math.round(amount * 100),
    }, acctOpts);
    const link = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }] as Stripe.PaymentLinkCreateParams.LineItem[],
      metadata: { tenantId, ...(meta?.bookingId ? { bookingId: meta.bookingId, kind: meta.kind || '' } : {}) },
    }, acctOpts);
    stripeLinkId = link.id;
  }

  await db.insert(schema.paymentLinks).values({
    id: linkId,
    tenantId,
    orderId,
    bookingId: meta?.bookingId,
    kind: meta?.kind,
    amount: amount || 0,
    description: description || 'Restaurant Payment',
    token,
    stripeLinkId,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });

  logger.info({ tenantId, linkId }, 'Payment link created');
  return { id: linkId, token, url: `/pay/${token}` };
}

export async function handleStripeWebhook(body: string, signature: string) {
  const stripe = getStripe();
  if (!stripe) return { error: 'Stripe not configured', status: 501 as const };

  try {
    const event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET || '');

    // Subscription/billing events → subscription service.
    if (await handleSubscriptionEvent(event)) {
      return { data: { received: true }, status: 200 as const };
    }

    const intent = event.data.object as Stripe.PaymentIntent;

    if (event.type === 'payment_intent.succeeded') {
      const orderId = intent.metadata.orderId;
      const tenantId = intent.metadata.tenantId;
      if (orderId && tenantId) {
        const [existing] = await db
          .select({ id: schema.payments.id })
          .from(schema.payments)
          .where(and(
            eq(schema.payments.stripePaymentIntentId, intent.id),
            eq(schema.payments.status, 'paid'),
          ))
          .limit(1);

        if (!existing) {
          await db.update(schema.payments)
            .set({ status: 'paid' })
            .where(eq(schema.payments.stripePaymentIntentId, intent.id));

          await updateOrderPaymentStatus(tenantId, orderId);
          logger.info({ orderId, paymentIntent: intent.id }, 'Stripe payment succeeded');
        } else {
          logger.info({ orderId, paymentIntent: intent.id }, 'Duplicate webhook received, skipped');
        }
      }
    }

    // Payment links (hotel folio/deposit + generic) settle via checkout sessions.
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const linkId = typeof session.payment_link === 'string' ? session.payment_link : session.payment_link?.id;
      if (linkId) await reconcilePaymentLink(linkId);
    }

    return { data: { received: true }, status: 200 as const };
  } catch (err) {
    logger.error({ err }, 'Stripe webhook verification failed');
    return { error: 'Webhook error', status: 400 as const };
  }
}

/**
 * A payment link was paid (via its Stripe checkout session). Mark the link paid
 * and, for hotel folio/deposit links, reconcile the booking automatically —
 * folio → settled, deposit → amount recorded. Idempotent on the link's status.
 */
export async function reconcilePaymentLink(stripeLinkId: string) {
  const [link] = await db.select().from(schema.paymentLinks)
    .where(eq(schema.paymentLinks.stripeLinkId, stripeLinkId)).limit(1);
  if (!link || link.status === 'paid') return; // unknown or already handled
  const now = new Date().toISOString();
  await db.update(schema.paymentLinks).set({ status: 'paid', paidAt: now }).where(eq(schema.paymentLinks.id, link.id));

  if (link.bookingId && link.kind === 'folio') {
    await db.update(schema.roomBookings).set({ folioPaidAt: now })
      .where(and(eq(schema.roomBookings.id, link.bookingId), eq(schema.roomBookings.tenantId, link.tenantId)));
    logger.info({ bookingId: link.bookingId }, 'Folio settled via payment link');
  } else if (link.bookingId && link.kind === 'deposit') {
    await db.update(schema.roomBookings).set({ depositAmount: link.amount })
      .where(and(eq(schema.roomBookings.id, link.bookingId), eq(schema.roomBookings.tenantId, link.tenantId)));
    logger.info({ bookingId: link.bookingId, amount: link.amount }, 'Deposit recorded via payment link');
  }
}

async function sendReceiptEmail(tenantId: string, orderId: string, paymentId: string) {
  try {
    const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId)).limit(1);
    if (!order) return;

    const [tenant] = await db.select().from(schema.tenants).where(eq(schema.tenants.id, tenantId)).limit(1);
    if (!tenant || !tenant.email) return;

    const payment = await db.select().from(schema.payments).where(eq(schema.payments.id, paymentId)).limit(1);
    const method = payment[0]?.method || 'card';

    const content = `
      <h2 style="margin-top:0;">Payment Receipt</h2>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:6px 0;color:#666;">Order</td><td style="text-align:right;font-weight:600;">#${orderId.slice(0, 8)}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Amount</td><td style="text-align:right;font-weight:600;">$${order.total.toFixed(2)}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Paid</td><td style="text-align:right;font-weight:600;">$${(order.paidAmount || 0).toFixed(2)}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Method</td><td style="text-align:right;">${method}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Status</td><td style="text-align:right;">${order.paymentStatus}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Date</td><td style="text-align:right;">${new Date().toLocaleString()}</td></tr>
      </table>
    `;
    await sendEmail({
      to: tenant.email,
      subject: `Receipt for Order #${orderId.slice(0, 8)} — ${tenant.name}`,
      html: brandedEmailHtml(content, tenant.name, tenant.primaryColor, tenant.logoUrl),
    });
  } catch (err) {
    logger.error({ err, orderId }, 'Failed to send receipt email');
  }
}

export async function getPaymentLinkByToken(token: string) {
  const [link] = await db
    .select()
    .from(schema.paymentLinks)
    .where(eq(schema.paymentLinks.token, token))
    .limit(1);

  if (!link) return { error: 'Payment link not found', status: 404 as const };
  if (link.status !== 'active') return { error: `Payment link is ${link.status}`, status: 400 as const };

  const [tenant] = await db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.id, link.tenantId))
    .limit(1);

  return {
    data: {
      id: link.id,
      orderId: link.orderId,
      amount: link.amount,
      description: link.description,
      tenantName: tenant?.name,
      tenantSlug: tenant?.slug,
      tenantLogo: tenant?.logoUrl,
      status: link.status,
      expiresAt: link.expiresAt,
    },
    status: 200 as const,
  };
}
