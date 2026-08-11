import Fastify from "fastify";
import pg from "pg";
import Stripe from "stripe";
import { randomUUID } from "node:crypto";
import { createLogger, ok, err, verifyHs256, bearer, initSentry, captureError, getEventBus } from "@qlisted/shared";
import type { DomainEvent } from "@qlisted/shared";

function publishDomain(e: DomainEvent) { void getEventBus().publish(e).catch(() => {}); }

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  return key ? new Stripe(key, { apiVersion: "2025-02-24.acacia" }) : null;
}

const iso = (s?: number | null) => (s ? new Date(s * 1000).toISOString() : null);

// Upsert the tenant's subscription row (newest), mirroring subscriptionService.upsert.
async function upsertSub(tenantId: string, v: { planId?: string | null; stripeSubscriptionId?: string | null; status?: string | null; currentPeriodStart?: string | null; currentPeriodEnd?: string | null }) {
  const ex = await pool.query("SELECT id FROM tenant_subscriptions WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1", [tenantId]);
  if (ex.rows[0]) {
    await pool.query(
      `UPDATE tenant_subscriptions SET plan_id = COALESCE($2, plan_id), stripe_subscription_id = COALESCE($3, stripe_subscription_id),
         status = COALESCE($4, status), current_period_start = COALESCE($5, current_period_start), current_period_end = COALESCE($6, current_period_end) WHERE id = $1`,
      [ex.rows[0].id, v.planId ?? null, v.stripeSubscriptionId ?? null, v.status ?? null, v.currentPeriodStart ?? null, v.currentPeriodEnd ?? null],
    );
  } else {
    await pool.query(
      "INSERT INTO tenant_subscriptions (id, tenant_id, plan_id, stripe_subscription_id, status, current_period_start, current_period_end) VALUES ($1,$2,COALESCE($3,'starter'),$4,COALESCE($5,'trial'),$6,$7)",
      [randomUUID(), tenantId, v.planId ?? null, v.stripeSubscriptionId ?? null, v.status ?? null, v.currentPeriodStart ?? null, v.currentPeriodEnd ?? null],
    );
  }
}

// Subscription/billing events → true if handled (mirrors handleSubscriptionEvent).
async function handleSubscriptionEvent(event: Stripe.Event): Promise<boolean> {
  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object as Stripe.Checkout.Session;
      if (s.mode !== "subscription") return false;
      const tenantId = s.metadata?.tenantId;
      const planId = s.metadata?.planId || "starter";
      if (!tenantId) return true;
      let pStart: string | null = null, pEnd: string | null = null;
      const stripe = getStripe();
      if (stripe && s.subscription) {
        const sub = await stripe.subscriptions.retrieve(s.subscription as string);
        pStart = iso(sub.current_period_start); pEnd = iso(sub.current_period_end);
      }
      await upsertSub(tenantId, { planId, stripeSubscriptionId: (s.subscription as string) || null, status: "active", currentPeriodStart: pStart, currentPeriodEnd: pEnd });
      publishDomain({ type: "subscription.updated", tenantId, plan: (planId || "starter").toUpperCase() as "STARTER" | "GROWTH" | "ENTERPRISE" });
      return true;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const tenantId = sub.metadata?.tenantId;
      if (!tenantId) return true;
      const status = event.type === "customer.subscription.deleted" ? "canceled"
        : (sub.status === "past_due" || sub.status === "unpaid") ? "past_due"
        : sub.status === "canceled" ? "canceled" : "active";
      await upsertSub(tenantId, { stripeSubscriptionId: sub.id, status, currentPeriodStart: iso(sub.current_period_start), currentPeriodEnd: iso(sub.current_period_end), ...(sub.metadata?.planId ? { planId: sub.metadata.planId } : {}) });
      publishDomain({ type: "subscription.updated", tenantId, plan: ((sub.metadata?.planId || "starter").toUpperCase()) as "STARTER" | "GROWTH" | "ENTERPRISE" });
      return true;
    }
    case "invoice.payment_failed": {
      const inv = event.data.object as Stripe.Invoice;
      const subId = (inv as unknown as { subscription?: string }).subscription;
      if (!subId) return true;
      await pool.query("UPDATE tenant_subscriptions SET status = 'past_due' WHERE stripe_subscription_id = $1", [subId]);
      const t = await pool.query("SELECT tenant_id FROM tenant_subscriptions WHERE stripe_subscription_id = $1 LIMIT 1", [subId]);
      if (t.rows[0]?.tenant_id) publishDomain({ type: "subscription.updated", tenantId: t.rows[0].tenant_id, plan: "STARTER" });
      return true;
    }
    default:
      return false;
  }
}

/**
 * BILLING service — SaaS subscriptions + Stripe. The subscription READ is
 * ported for real (mirrors monolith GET /admin/subscriptions/:tenantId →
 * getSubscription). Checkout/cancel/webhook (writes + live payments) stay on
 * the monolith pending a deliberate, Stripe-test-mode cutover.
 */
const log = createLogger("billing");
export const app = Fastify({ loggerInstance: log });
initSentry("billing");
app.addHook("onError", async (req, _reply, error) => captureError(error, { url: req.url, method: req.method }));
const PORT = Number(process.env.PORT || 8080);

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 });

// ── Receipt email (parity with monolith sendReceiptEmail) ───────────────────
// Renders a branded receipt and hands it to the notifications service. No-op
// unless NOTIFICATIONS_URL is set (and notifications has SMTP configured).
function brandedEmailHtml(content: string, tenantName: string, color?: string | null, logoUrl?: string | null): string {
  const c = color || "#8B4513";
  const logo = logoUrl ? `<img src="${logoUrl}" alt="${tenantName}" style="height:40px;width:40px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:8px;" />` : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px;"><table width="100%" style="max-width:560px;background:#fff;border-radius:8px;overflow:hidden;"><tr><td style="background:${c};padding:16px 24px;"><table width="100%"><tr><td style="color:#fff;font-size:18px;font-weight:600;">${logo}${tenantName}</td></tr></table></td></tr><tr><td style="padding:24px;">${content}</td></tr><tr><td style="padding:12px 24px;border-top:1px solid #eee;"><p style="margin:0;color:#999;font-size:12px;">Qlisted &middot; ${tenantName}</p></td></tr></table></td></tr></table></body></html>`;
}

async function sendReceipt(orderId: string, tenantId: string): Promise<void> {
  const notifyUrl = process.env.NOTIFICATIONS_URL;
  if (!notifyUrl) return;
  try {
    const o = await pool.query("SELECT total, paid_amount, payment_status FROM orders WHERE id = $1 LIMIT 1", [orderId]);
    const order = o.rows[0];
    if (!order) return;
    const tr = await pool.query("SELECT name, email, primary_color, logo_url FROM tenants WHERE id = $1 LIMIT 1", [tenantId]);
    const tenant = tr.rows[0];
    if (!tenant?.email) return;
    const pr = await pool.query("SELECT method FROM payments WHERE order_id = $1 AND status = 'paid' ORDER BY created_at DESC LIMIT 1", [orderId]);
    const method = pr.rows[0]?.method || "card";
    const inner = `
      <h2 style="margin-top:0;">Payment Receipt</h2>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:6px 0;color:#666;">Order</td><td style="text-align:right;font-weight:600;">#${orderId.slice(0, 8)}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Amount</td><td style="text-align:right;font-weight:600;">$${Number(order.total).toFixed(2)}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Paid</td><td style="text-align:right;font-weight:600;">$${Number(order.paid_amount || 0).toFixed(2)}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Method</td><td style="text-align:right;">${method}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Status</td><td style="text-align:right;">${order.payment_status}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Date</td><td style="text-align:right;">${new Date().toLocaleString()}</td></tr>
      </table>`;
    await fetch(notifyUrl.replace(/\/$/, "") + "/v1/notify/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        to: tenant.email,
        subject: `Receipt for Order #${orderId.slice(0, 8)} — ${tenant.name}`,
        html: brandedEmailHtml(inner, tenant.name, tenant.primary_color, tenant.logo_url),
      }),
    });
  } catch (e) {
    log.error({ err: e, orderId }, "receipt email failed");
  }
}

// Keep the raw JSON bytes on every request (the webhook needs them for Stripe
// signature verification) while still exposing the parsed object as req.body.
app.addContentTypeParser("application/json", { parseAs: "buffer" }, (req, body, done) => {
  (req as unknown as { rawBody: Buffer }).rawBody = body as Buffer;
  try { done(null, JSON.parse((body as Buffer).toString("utf8") || "{}")); }
  catch (e) { done(e as Error); }
});

interface Plan { id: string; name: string; price: number; usersLimit: number; ordersLimit: number; priceEnv: string }
const PLANS: Plan[] = [
  { id: "starter", name: "Starter", price: 29, usersLimit: 3, ordersLimit: 500, priceEnv: "STRIPE_PRICE_STARTER" },
  { id: "growth", name: "Growth", price: 79, usersLimit: 10, ordersLimit: 2000, priceEnv: "STRIPE_PRICE_GROWTH" },
  { id: "enterprise", name: "Enterprise", price: 199, usersLimit: 50, ordersLimit: 10000, priceEnv: "STRIPE_PRICE_ENTERPRISE" },
];
const getPlan = (id: string) => PLANS.find((p) => p.id === id);
const priceIdFor = (id: string) => { const p = getPlan(id); return p ? process.env[p.priceEnv] || null : null; };

app.get("/health", async () => ok({ service: "billing", status: "up" }));
app.get("/ready", async () => {
  try { await pool.query("select 1"); return ok({ ready: true }); }
  catch { return err("db unavailable"); }
});

// Compat: byte-compatible with GET /admin/subscriptions/:tenantId.
app.get<{ Params: { tenantId: string } }>("/compat/subscription/:tenantId", async (req, reply) => {
  const claims = verifyHs256(bearer(req.headers.authorization));
  if (!claims) return reply.code(401).send(err("Authentication required"));
  if (!["admin", "manager", "super_admin"].includes(String(claims.role))) return reply.code(403).send(err("Forbidden"));
  const { tenantId } = req.params;
  if (claims.role !== "super_admin" && claims.tenantId !== tenantId) return reply.code(403).send(err("Forbidden"));

  const t = await pool.query("SELECT id FROM tenants WHERE id = $1 LIMIT 1", [tenantId]);
  if (!t.rows[0]) return reply.code(404).send(err("Tenant not found"));

  const s = await pool.query(
    "SELECT plan_id, status, stripe_subscription_id, current_period_end, trial_ends_at FROM tenant_subscriptions WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1",
    [tenantId],
  );
  const sub = s.rows[0];
  const planId = sub?.plan_id || "starter";
  const plan = getPlan(planId) || PLANS[0];
  const u = await pool.query("SELECT COUNT(*)::int AS c FROM users WHERE tenant_id = $1", [tenantId]);
  const o = await pool.query("SELECT COUNT(*)::int AS c FROM orders WHERE tenant_id = $1", [tenantId]);

  return reply.send({
    plan,
    plans: PLANS,
    status: sub?.status || "trial",
    stripeSubscriptionId: sub?.stripe_subscription_id || null,
    renewDate: sub?.current_period_end || sub?.trial_ends_at || null,
    billingEnabled: !!priceIdFor(planId) && !!process.env.STRIPE_SECRET_KEY,
    usage: { users: Number(u.rows[0]?.c || 0), orders: Number(o.rows[0]?.c || 0) },
  });
});

// Subscription checkout — ported from createCheckoutSession (mirrors
// POST /admin/subscriptions/:tenantId/checkout). Returns {url} or {error}.
app.post<{ Params: { tenantId: string }; Body: { planId?: string } }>("/compat/subscription/:tenantId/checkout", async (req, reply) => {
  const claims = verifyHs256(bearer(req.headers.authorization));
  if (!claims) return reply.code(401).send({ error: "Authentication required" });
  if (!["admin", "super_admin"].includes(String(claims.role))) return reply.code(403).send({ error: "Forbidden" });
  const { tenantId } = req.params;
  if (claims.role !== "super_admin" && claims.tenantId !== tenantId) return reply.code(403).send({ error: "Forbidden" });

  const tr = await pool.query("SELECT id, email FROM tenants WHERE id = $1 LIMIT 1", [tenantId]);
  const tenant = tr.rows[0];
  if (!tenant) return reply.code(404).send({ error: "Tenant not found" });

  const planId = String(req.body?.planId ?? "");
  const stripe = getStripe();
  if (!stripe) return reply.code(501).send({ error: "Billing not configured (no Stripe key)" });
  const price = priceIdFor(planId);
  if (!price) return reply.code(400).send({ error: `Plan "${planId}" has no Stripe price configured` });

  const base = process.env.FRONTEND_URL || "http://localhost:5173";
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    customer_email: tenant.email,
    success_url: `${base}/admin/subscription?status=success`,
    cancel_url: `${base}/admin/subscription?status=cancelled`,
    metadata: { tenantId, planId },
    subscription_data: { metadata: { tenantId, planId } },
  });
  return reply.send({ url: session.url });
});

// Subscription cancel — ported from cancelSubscription.
app.post<{ Params: { tenantId: string } }>("/compat/subscription/:tenantId/cancel", async (req, reply) => {
  const claims = verifyHs256(bearer(req.headers.authorization));
  if (!claims) return reply.code(401).send({ error: "Authentication required" });
  if (!["admin", "super_admin"].includes(String(claims.role))) return reply.code(403).send({ error: "Forbidden" });
  const { tenantId } = req.params;
  if (claims.role !== "super_admin" && claims.tenantId !== tenantId) return reply.code(403).send({ error: "Forbidden" });

  const s = await pool.query("SELECT stripe_subscription_id FROM tenant_subscriptions WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1", [tenantId]);
  const subId = s.rows[0]?.stripe_subscription_id;
  if (!subId) return reply.code(400).send({ error: "No active subscription" });
  const stripe = getStripe();
  if (!stripe) return reply.code(501).send({ error: "Billing not configured" });
  await stripe.subscriptions.update(subId, { cancel_at_period_end: true });
  return reply.send({ success: true });
});

// Order payment intent — ported from createPaymentIntent (public, mirrors
// POST /api/r/:slug/payments/create-intent). Creates a Stripe PaymentIntent
// (no charge — confirmed client-side) + a pending payments row. {orderId, tip?}.
app.post<{ Params: { slug: string }; Body: { orderId?: string; tip?: number } }>("/compat/payment-intent/:slug", async (req, reply) => {
  const tr = await pool.query("SELECT id, lower(coalesce(currency,'usd')) AS currency FROM tenants WHERE slug = $1 AND is_active = true LIMIT 1", [req.params.slug]);
  const tenant = tr.rows[0];
  if (!tenant) return reply.code(404).send({ error: "Tenant not found" });
  const { orderId, tip } = req.body || {};
  if (!orderId) return reply.code(400).send({ error: "orderId required" });

  const o = await pool.query("SELECT total, payment_status FROM orders WHERE id = $1 AND tenant_id = $2 LIMIT 1", [orderId, tenant.id]);
  const order = o.rows[0];
  if (!order) return reply.code(404).send({ error: "Order not found" });
  if (order.payment_status === "paid") return reply.code(400).send({ error: "Order already paid" });

  const paid = await pool.query("SELECT COALESCE(SUM(amount + COALESCE(tip,0)),0)::float AS s FROM payments WHERE order_id = $1 AND status = 'paid'", [orderId]);
  const remaining = Number(order.total) - Number(paid.rows[0].s);
  if (remaining <= 0) return reply.code(400).send({ error: "Order already fully paid" });

  const stripe = getStripe();
  if (!stripe) return reply.code(501).send({ error: "Billing not configured" });
  const paymentAmount = remaining;
  const chargeAmount = Math.round((paymentAmount + (tip || 0)) * 100);

  const intent = await stripe.paymentIntents.create({
    amount: chargeAmount,
    currency: tenant.currency,
    automatic_payment_methods: { enabled: true },
    metadata: { orderId, tenantId: tenant.id },
  });
  const paymentId = randomUUID();
  await pool.query(
    "INSERT INTO payments (id, tenant_id, order_id, amount, tip, method, status, stripe_payment_intent_id) VALUES ($1,$2,$3,$4,$5,'card','pending',$6)",
    [paymentId, tenant.id, orderId, paymentAmount, tip || 0, intent.id],
  );
  return reply.send({ clientSecret: intent.client_secret, paymentId, amount: chargeAmount });
});

// SaaS subscriptions (mirror monolith /api/admin/subscriptions) — wired to the
// same handlers as the compat shims (which the gateway rewrites to).
app.get<{ Params: { id: string } }>("/v1/tenants/:id/subscription", async (req, reply) => {
  const claims = verifyHs256(bearer(req.headers.authorization));
  if (!claims) return reply.code(401).send(err("Authentication required"));
  if (!["admin", "manager", "super_admin"].includes(String(claims.role))) return reply.code(403).send(err("Forbidden"));
  if (claims.role !== "super_admin" && claims.tenantId !== req.params.id) return reply.code(403).send(err("Forbidden"));

  const t = await pool.query("SELECT id FROM tenants WHERE id = $1 LIMIT 1", [req.params.id]);
  if (!t.rows[0]) return reply.code(404).send(err("Tenant not found"));
  const s = await pool.query(
    "SELECT plan_id, status, stripe_subscription_id, current_period_end, trial_ends_at FROM tenant_subscriptions WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1",
    [req.params.id],
  );
  const sub = s.rows[0];
  const planId = sub?.plan_id || "starter";
  const plan = getPlan(planId) || PLANS[0];
  const u = await pool.query("SELECT COUNT(*)::int AS c FROM users WHERE tenant_id = $1", [req.params.id]);
  const o = await pool.query("SELECT COUNT(*)::int AS c FROM orders WHERE tenant_id = $1", [req.params.id]);
  return reply.send({
    plan, plans: PLANS,
    status: sub?.status || "trial",
    stripeSubscriptionId: sub?.stripe_subscription_id || null,
    renewDate: sub?.current_period_end || sub?.trial_ends_at || null,
    billingEnabled: !!priceIdFor(planId) && !!process.env.STRIPE_SECRET_KEY,
    usage: { users: Number(u.rows[0]?.c || 0), orders: Number(o.rows[0]?.c || 0) },
  });
});

app.post<{ Params: { id: string }; Body: { planId?: string } }>("/v1/tenants/:id/subscription/checkout", async (req, reply) => {
  const claims = verifyHs256(bearer(req.headers.authorization));
  if (!claims) return reply.code(401).send(err("Authentication required"));
  if (!["admin", "super_admin"].includes(String(claims.role))) return reply.code(403).send(err("Forbidden"));
  if (claims.role !== "super_admin" && claims.tenantId !== req.params.id) return reply.code(403).send(err("Forbidden"));

  const tr = await pool.query("SELECT id, email FROM tenants WHERE id = $1 LIMIT 1", [req.params.id]);
  const tenant = tr.rows[0];
  if (!tenant) return reply.code(404).send(err("Tenant not found"));
  const planId = String(req.body?.planId ?? "");
  const stripe = getStripe();
  if (!stripe) return reply.code(501).send(err("Billing not configured (no Stripe key)"));
  const price = priceIdFor(planId);
  if (!price) return reply.code(400).send(err(`Plan "${planId}" has no Stripe price configured`));

  const base = process.env.FRONTEND_URL || "http://localhost:5173";
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    customer_email: tenant.email,
    success_url: `${base}/admin/subscription?status=success`,
    cancel_url: `${base}/admin/subscription?status=cancelled`,
    metadata: { tenantId: req.params.id, planId },
    subscription_data: { metadata: { tenantId: req.params.id, planId } },
  });
  return reply.send({ url: session.url });
});

app.post<{ Params: { id: string } }>("/v1/tenants/:id/subscription/cancel", async (req, reply) => {
  const claims = verifyHs256(bearer(req.headers.authorization));
  if (!claims) return reply.code(401).send(err("Authentication required"));
  if (!["admin", "super_admin"].includes(String(claims.role))) return reply.code(403).send(err("Forbidden"));
  if (claims.role !== "super_admin" && claims.tenantId !== req.params.id) return reply.code(403).send(err("Forbidden"));

  const s = await pool.query("SELECT stripe_subscription_id FROM tenant_subscriptions WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1", [req.params.id]);
  const subId = s.rows[0]?.stripe_subscription_id;
  if (!subId) return reply.code(400).send(err("No active subscription"));
  const stripe = getStripe();
  if (!stripe) return reply.code(501).send(err("Billing not configured"));
  await stripe.subscriptions.update(subId, { cancel_at_period_end: true });
  return reply.send({ success: true });
});

// Stripe webhook — ported from handleStripeWebhook. Verifies the signature over
// the raw body, routes subscription events, and records payment_intent.succeeded.
app.post<{ Body: unknown }>("/compat/webhook", async (req, reply) => {
  const stripe = getStripe();
  if (!stripe) return reply.code(501).send({ error: "Stripe not configured" });
  const sig = req.headers["stripe-signature"] as string | undefined;
  if (!sig) return reply.code(400).send({ error: "Missing signature" });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent((req as unknown as { rawBody: Buffer }).rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET || "");
  } catch (e) {
    log.error({ err: e }, "Stripe webhook verification failed");
    return reply.code(400).send({ error: "Webhook error" });
  }

  try {
    if (await handleSubscriptionEvent(event)) return reply.send({ received: true });

    if (event.type === "payment_intent.succeeded") {
      const intent = event.data.object as Stripe.PaymentIntent;
      const orderId = intent.metadata?.orderId;
      const tenantId = intent.metadata?.tenantId;
      if (orderId && tenantId) {
        const existing = await pool.query("SELECT id FROM payments WHERE stripe_payment_intent_id = $1 AND status = 'paid' LIMIT 1", [intent.id]);
        if (!existing.rows[0]) {
          await pool.query("UPDATE payments SET status = 'paid' WHERE stripe_payment_intent_id = $1", [intent.id]);
          // recompute order payment status (mirrors updateOrderPaymentStatus)
          const o = await pool.query("SELECT total FROM orders WHERE id = $1 AND tenant_id = $2 LIMIT 1", [orderId, tenantId]);
          if (o.rows[0]) {
            const paid = await pool.query("SELECT COALESCE(SUM(amount + COALESCE(tip,0)),0)::float AS s FROM payments WHERE order_id = $1 AND status = 'paid'", [orderId]);
            const totalPaid = Number(paid.rows[0].s);
            const remaining = Number(o.rows[0].total) - totalPaid;
            const status = remaining <= 0 ? "paid" : totalPaid > 0 ? "partially_paid" : "unpaid";
            await pool.query("UPDATE orders SET payment_status = $1, paid_amount = $2, updated_at = $3 WHERE id = $4", [status, totalPaid, new Date().toISOString(), orderId]);
            publishDomain({ type: "payment.succeeded", orderId, tenantId, amount: totalPaid });
            // Fire-and-forget receipt (parity with monolith); no-op without NOTIFICATIONS_URL/SMTP.
            void sendReceipt(orderId, tenantId);
          }
        }
      }
    }
    return reply.send({ received: true });
  } catch (e) {
    log.error({ err: e }, "webhook handling error");
    return reply.code(400).send({ error: "Webhook error" });
  }
});

if (process.env.NODE_ENV !== "test") {
  app.listen({ port: PORT, host: "0.0.0.0" }).then(() => log.info(`billing on :${PORT}`));
}
