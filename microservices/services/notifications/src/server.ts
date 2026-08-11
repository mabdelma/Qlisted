import Fastify from "fastify";
import pg from "pg";
import { createLogger, ok, err, initSentry, captureError, getEventBus } from "@qlisted/shared";
import type { EmailRequest } from "@qlisted/shared";
import { renderEmail } from "./templates.js";
import { sendEmail, smtpConfigured } from "./email.js";
import { sendOrderSms } from "./sms.js";
import { createPush, getVapidPublicKey } from "./push.js";

/**
 * NOTIFICATIONS service — the single owner of delivery: email (SMTP), SMS
 * (Twilio) and web push (VAPID). Other services call the /v1/notify/* routes;
 * it ALSO consumes order.* domain events from the bus:
 *   order.placed → order-confirmation email to the restaurant's inbox
 *   order.ready  → web push to every subscriber on that tenant
 */
const log = createLogger("notifications");
export const app = Fastify({ loggerInstance: log });
initSentry("notifications");
app.addHook("onError", async (req, _reply, error) => captureError(error, { url: req.url, method: req.method }));
const PORT = Number(process.env.PORT || 8080);

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
const push = createPush(pool);

app.get("/health", async () => ok({ service: "notifications", status: "up", smtp: smtpConfigured }));
app.get("/ready", async () => {
  try { await pool.query("select 1"); return ok({ ready: true }); }
  catch { return err("db unavailable"); }
});

// Raw delivery — the monolith renders the email and delegates SENDING here.
app.post("/v1/notify/send", async (req, reply) => {
  const b = (req.body || {}) as { to?: string; subject?: string; html?: string };
  if (!b.to || !b.subject || !b.html) return reply.code(400).send(err("to + subject + html required"));
  try {
    const sent = await sendEmail(b.to, b.subject, b.html);
    return ok({ sent, skipped: !sent });
  } catch (e) {
    log.error(e);
    return reply.code(502).send(err("email send failed"));
  }
});

// Send a templated email. Body: EmailRequest.
app.post("/v1/notify/email", async (req, reply) => {
  const body = req.body as EmailRequest | undefined;
  if (!body?.to || !body?.template) return reply.code(400).send(err("to + template required"));
  try {
    const { subject, html } = renderEmail(body.template as never, body.locale, body.vars || {});
    await sendEmail(body.to, subject, html);
    return ok({ sent: true });
  } catch (e) {
    log.error(e);
    return reply.code(502).send(err("email send failed"));
  }
});

// SMS — ported from monolith POST /api/r/:slug/sms/notify.
app.post<{ Body: { phone?: string; orderId?: string; message?: string } }>("/v1/notify/sms", async (req, reply) => {
  const { phone, orderId, message } = req.body || {};
  if (!phone || !orderId || !message) return reply.code(400).send(err("phone + orderId + message required"));
  const sent = await sendOrderSms(phone, orderId, message);
  return reply.send({ sent });
});

// Web push — send to all subscribers on a tenant (parity with sendPushNotification).
app.post<{ Body: { tenantId?: string; title?: string; body?: string; icon?: string; data?: Record<string, unknown> } }>("/v1/notify/push", async (req, reply) => {
  const { tenantId, title, body, icon, data } = req.body || {};
  if (!tenantId || !title || !body) return reply.code(400).send(err("tenantId + title + body required"));
  if (!getVapidPublicKey()) return reply.code(501).send(err("Push notifications not configured"));
  const res = await push.sendPushNotification(tenantId, title, body, icon, data);
  return ok(res);
});

// ── Push subscription management (mirrors monolith routes/push.ts) ──────────
async function tenantBySlug(slug: string) {
  const r = await pool.query("SELECT id FROM tenants WHERE slug = $1 AND is_active = true LIMIT 1", [slug]);
  return r.rows[0] as { id: string } | undefined;
}

app.get<{ Params: { slug: string } }>("/v1/tenants/:slug/push/vapid-key", async (req, reply) => {
  const key = getVapidPublicKey();
  if (!key) return reply.code(501).send(err("Push notifications not configured"));
  return reply.send({ publicKey: key });
});

app.post<{ Params: { slug: string }; Body: { endpoint?: string; keys?: { p256dh?: string; auth?: string }; userAgent?: string } }>("/v1/tenants/:slug/push/subscribe", async (req, reply) => {
  const tenant = await tenantBySlug(req.params.slug);
  if (!tenant) return reply.code(404).send(err("Tenant not found"));
  const { endpoint, keys, userAgent } = req.body || {};
  if (!endpoint || !keys?.p256dh || !keys.auth) return reply.code(400).send(err("endpoint + keys.p256dh + keys.auth required"));
  await push.addSubscription(endpoint, keys.p256dh, keys.auth, tenant.id, userAgent);
  log.info({ tenantId: tenant.id }, "Push subscription added");
  return reply.send({ status: "ok" });
});

app.post<{ Params: { slug: string }; Body: { endpoint?: string } }>("/v1/tenants/:slug/push/unsubscribe", async (req, reply) => {
  if (!req.body?.endpoint) return reply.code(400).send(err("Missing endpoint"));
  await push.removeSubscription(req.body.endpoint);
  return reply.send({ status: "ok" });
});

// ── Event-bus consumers ─────────────────────────────────────────────────────
// order.placed → confirmation email to the restaurant's inbox (parity with
// sendOrderConfirmationEmail).
async function onOrderPlaced(e: { orderId: string; tenantId: string; total: number }) {
  try {
    const t = await pool.query("SELECT name, email FROM tenants WHERE id = $1 LIMIT 1", [e.tenantId]);
    const tenant = t.rows[0] as { name: string; email: string | null } | undefined;
    if (!tenant?.email) return;
    const o = await pool.query("SELECT * FROM orders WHERE id = $1 AND tenant_id = $2 LIMIT 1", [e.orderId, e.tenantId]);
    const order = o.rows[0];
    if (!order) return;
    const items = await pool.query("SELECT name, quantity, unit_price, notes FROM order_items WHERE order_id = $1", [e.orderId]);
    const rows = items.rows
      .map((i) => `<tr><td style="padding:6px 12px">${i.name}${i.notes ? `<br/><small>${i.notes}</small>` : ""}</td><td style="padding:6px 12px;text-align:center">${i.quantity}</td><td style="padding:6px 12px;text-align:right">$${Number(i.unit_price).toFixed(2)}</td><td style="padding:6px 12px;text-align:right">$${(i.quantity * i.unit_price).toFixed(2)}</td></tr>`)
      .join("");
    const totals = [
      ["Subtotal", Number(order.subtotal).toFixed(2)],
      ["Tax", Number(order.tax).toFixed(2)],
      ...(Number(order.service_charge) > 0 ? [["Service Charge", Number(order.service_charge).toFixed(2)]] as const : []),
      ...(Number(order.delivery_fee) > 0 ? [["Delivery Fee", Number(order.delivery_fee).toFixed(2)]] as const : []),
    ].map(([k, v]) => `<tr><td>${k}</td><td style="text-align:right">$${v}</td></tr>`).join("");
    const html = `
      <h2>New Order</h2>
      ${order.customer_name ? `<p><strong>Customer:</strong> ${order.customer_name}</p>` : ""}
      <p><strong>Type:</strong> ${order.order_type}</p>
      <table style="width:100%;border-collapse:collapse;margin-top:12px">
        <thead><tr style="background:#f3f4f6"><th style="padding:8px 12px;text-align:left">Item</th><th style="padding:8px 12px;text-align:center">Qty</th><th style="padding:8px 12px;text-align:right">Price</th><th style="padding:8px 12px;text-align:right">Total</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <hr style="margin:12px 0" />
      <table style="width:100%">${totals}<tr style="font-weight:700"><td>Total</td><td style="text-align:right">$${Number(order.total).toFixed(2)}</td></tr></table>
      <hr style="margin:12px 0" />
      <p style="color:#666;font-size:12px">Qlisted &middot; ${tenant.name}</p>`;
    await sendEmail(tenant.email, `Order #${e.orderId.slice(0, 8)} — ${tenant.name}`, html);
  } catch (err) {
    log.error({ err, orderId: e.orderId }, "confirmation email failed");
  }
}

// order.ready → web push to every subscriber on the tenant.
async function onOrderReady(e: { orderId: string; tenantId: string }) {
  try {
    await push.sendPushNotification(e.tenantId, "Order Ready!", `Order #${e.orderId.slice(0, 8)} is ready for pickup.`);
  } catch (err) {
    log.error({ err, orderId: e.orderId }, "ready push failed");
  }
}

const bus = getEventBus();
bus.subscribe("order.placed", onOrderPlaced);
bus.subscribe("order.ready", onOrderReady);
log.info("subscribed to order.placed + order.ready");

if (process.env.NODE_ENV !== "test") {
  app.listen({ port: PORT, host: "0.0.0.0" }).then(() => log.info(`notifications on :${PORT}`));
}
