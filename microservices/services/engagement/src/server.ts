import Fastify from "fastify";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { createLogger, ok, err, verifyHs256, bearer, initSentry, captureError, getEventBus } from "@qlisted/shared";
import type { DomainEvent } from "@qlisted/shared";

/**
 * ENGAGEMENT service — loyalty, promotions/campaigns, marketing sends. Migrated
 * for real from the monolith (routes/loyalty.ts, promoRoutes.ts, promos.ts,
 * services/promoService.ts + marketingService.ts). Writes the shared Postgres
 * directly and publishes loyalty./promo./campaign. domain events.
 */
const log = createLogger("engagement");
export const app = Fastify({ loggerInstance: log });
initSentry("engagement");
app.addHook("onError", async (req, _reply, error) => captureError(error, { url: req.url, method: req.method }));
const PORT = Number(process.env.PORT || 8080);

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
const toCamel = (row: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(row).map(([k, v]) => [k.replace(/_([a-z])/g, (_m, c) => c.toUpperCase()), v]));

function publishDomain(e: DomainEvent) { void getEventBus().publish(e).catch(() => {}); }

// ── helpers ─────────────────────────────────────────────────────────────────
async function tenantBySlug(slug: string) {
  const r = await pool.query("SELECT id, name FROM tenants WHERE slug = $1 AND is_active = true LIMIT 1", [slug]);
  return r.rows[0] as { id: string; name: string } | undefined;
}

/** Verify staff token + role + tenant scope (mirror authMiddleware + requireRole). */
function staff(reply: Fastify.Reply, roles: string[], tenantId: string): { role: string } | null {
  const claims = verifyHs256(bearer(reply.request.headers.authorization));
  if (!claims) { void reply.code(401).send(err("Authentication required")); return null; }
  if (!roles.includes(String(claims.role))) { void reply.code(403).send(err("Forbidden")); return null; }
  if (claims.tenantId !== null && claims.tenantId !== tenantId) { void reply.code(403).send(err("Forbidden")); return null; }
  return { role: String(claims.role) };
}

app.get("/health", async () => ok({ service: "engagement", status: "up" }));
app.get("/ready", async () => {
  try { await pool.query("select 1"); return ok({ ready: true }); }
  catch { return err("db unavailable"); }
});

// ── Loyalty ─────────────────────────────────────────────────────────────────
const DEFAULT_REWARDS = [
  { id: "reward-1", name: "$5 Off", pointsCost: 100, description: "Get $5 off your next order" },
  { id: "reward-2", name: "Free Dessert", pointsCost: 200, description: "Free dessert on any order" },
  { id: "reward-3", name: "Free Drink", pointsCost: 150, description: "Free beverage of your choice" },
  { id: "reward-4", name: "10% Off", pointsCost: 300, description: "10% off your entire order" },
];
const computeTier = (lifetimePoints: number) =>
  lifetimePoints >= 1000 ? "platinum" : lifetimePoints >= 500 ? "gold" : lifetimePoints >= 200 ? "silver" : "bronze";

interface LoyaltySummary { id: string; tenant_id: string; points: number; lifetime_points: number; tier: string; updated_at: string }
async function getOrCreate(tenantId: string): Promise<LoyaltySummary> {
  const existing = await pool.query("SELECT * FROM loyalty_summary WHERE tenant_id = $1 LIMIT 1", [tenantId]);
  if (existing.rows[0]) return existing.rows[0] as LoyaltySummary;
  const now = new Date().toISOString();
  await pool.query(
    "INSERT INTO loyalty_summary (id, tenant_id, points, lifetime_points, tier, updated_at) VALUES ($1,$2,50,50,'bronze',$3) ON CONFLICT (tenant_id) DO NOTHING",
    [randomUUID(), tenantId, now],
  );
  await pool.query(
    "INSERT INTO loyalty_transactions (id, tenant_id, type, amount, description, created_at) VALUES ($1,$2,'earn',50,'Welcome bonus',$3)",
    [randomUUID(), tenantId, now],
  );
  const again = await pool.query("SELECT * FROM loyalty_summary WHERE tenant_id = $1 LIMIT 1", [tenantId]);
  return again.rows[0] as LoyaltySummary;
}
async function ensureTier(summary: { id: string; lifetime_points: number }): Promise<string> {
  const tier = computeTier(summary.lifetime_points);
  await pool.query("UPDATE loyalty_summary SET tier = $1, updated_at = $2 WHERE id = $3", [tier, new Date().toISOString(), summary.id]);
  return tier;
}

// GET /api/r/:slug/loyalty — summary + history + rewards (admin/manager/waiter/cashier).
app.get<{ Params: { slug: string } }>("/v1/tenants/:slug/loyalty", async (req, reply) => {
  const tenant = await tenantBySlug(req.params.slug);
  if (!tenant) return reply.code(404).send(err("Tenant not found"));
  if (!staff(reply, ["admin", "manager", "waiter", "cashier"], tenant.id)) return;
  const summary = await getOrCreate(tenant.id);
  const tier = await ensureTier(summary);
  const history = await pool.query(
    "SELECT * FROM loyalty_transactions WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 100",
    [tenant.id],
  );
  return reply.send({
    points: summary.points,
    tier,
    lifetimePoints: summary.lifetime_points,
    history: history.rows.map(toCamel),
    rewards: DEFAULT_REWARDS,
  });
});

// POST /api/r/:slug/loyalty/earn (admin/manager/waiter).
app.post<{ Params: { slug: string }; Body: { amount?: number; orderId?: string } }>("/v1/tenants/:slug/loyalty/earn", async (req, reply) => {
  const tenant = await tenantBySlug(req.params.slug);
  if (!tenant) return reply.code(404).send(err("Tenant not found"));
  if (!staff(reply, ["admin", "manager", "waiter"], tenant.id)) return;
  const amount = req.body?.amount;
  if (!Number.isInteger(amount) || (amount as number) <= 0) return reply.code(400).send(err("amount must be a positive integer"));
  const summary = await getOrCreate(tenant.id);
  const newPoints = summary.points + (amount as number);
  const newLifetime = summary.lifetime_points + (amount as number);
  const tier = computeTier(newLifetime);
  await pool.query("UPDATE loyalty_summary SET points = $1, lifetime_points = $2, tier = $3, updated_at = $4 WHERE id = $5",
    [newPoints, newLifetime, tier, new Date().toISOString(), summary.id]);
  await pool.query(
    "INSERT INTO loyalty_transactions (id, tenant_id, type, amount, description, created_at) VALUES ($1,$2,'earn',$3,$4,$5)",
    [randomUUID(), tenant.id, amount, req.body?.orderId ? `Order #${req.body.orderId.slice(0, 8)}` : "Points earned", new Date().toISOString()],
  );
  publishDomain({ type: "loyalty.points.earned", tenantId: tenant.id, amount: amount as number });
  return reply.send({ success: true, points: newPoints, tier });
});

// POST /api/r/:slug/loyalty/redeem (admin/manager/waiter).
app.post<{ Params: { slug: string }; Body: { points?: number; rewardId?: string } }>("/v1/tenants/:slug/loyalty/redeem", async (req, reply) => {
  const tenant = await tenantBySlug(req.params.slug);
  if (!tenant) return reply.code(404).send(err("Tenant not found"));
  if (!staff(reply, ["admin", "manager", "waiter"], tenant.id)) return;
  const points = req.body?.points;
  if (!Number.isInteger(points) || (points as number) <= 0) return reply.code(400).send(err("points must be a positive integer"));
  const summary = await getOrCreate(tenant.id);
  if (summary.points < (points as number)) return reply.code(400).send(err("Insufficient points"));
  const newPoints = summary.points - (points as number);
  await pool.query("UPDATE loyalty_summary SET points = $1, updated_at = $2 WHERE id = $3", [newPoints, new Date().toISOString(), summary.id]);
  const reward = DEFAULT_REWARDS.find((r) => r.id === req.body?.rewardId);
  await pool.query(
    "INSERT INTO loyalty_transactions (id, tenant_id, type, amount, description, created_at) VALUES ($1,$2,'redeem',$3,$4,$5)",
    [randomUUID(), tenant.id, points, reward ? `Redeemed: ${reward.name}` : "Points redeemed", new Date().toISOString()],
  );
  publishDomain({ type: "loyalty.points.redeemed", tenantId: tenant.id, amount: points as number });
  return reply.send({ success: true, points: newPoints, discount: (points as number) * 0.05 });
});

// POST /api/r/:slug/loyalty/redeem-for-order — closes the loop: deducts points
// AND writes the resulting discount onto the order total (loyaltyService).
const POINTS_TO_CURRENCY = 0.05;
app.post<{ Params: { slug: string }; Body: { orderId?: string; points?: number } }>("/v1/tenants/:slug/loyalty/redeem-for-order", async (req, reply) => {
  const tenant = await tenantBySlug(req.params.slug);
  if (!tenant) return reply.code(404).send(err("Tenant not found"));
  if (!staff(reply, ["admin", "manager", "waiter", "cashier"], tenant.id)) return;
  const { orderId, points } = req.body || {};
  if (!orderId) return reply.code(400).send(err("orderId required"));
  if (!Number.isInteger(points) || (points as number) <= 0) return reply.code(400).send(err("Points must be a positive integer"));

  const summary = await getOrCreate(tenant.id);
  if (summary.points < (points as number)) return reply.code(400).send(err("Insufficient points"));
  const o = await pool.query("SELECT * FROM orders WHERE id = $1 AND tenant_id = $2 LIMIT 1", [orderId, tenant.id]);
  const order = o.rows[0];
  if (!order) return reply.code(404).send(err("Order not found"));
  if (order.payment_status === "paid") return reply.code(400).send(err("Order already paid"));

  const requestedDiscount = Math.round((points as number) * POINTS_TO_CURRENCY * 100) / 100;
  const discountApplied = Math.min(requestedDiscount, order.total);
  const pointsRedeemed = discountApplied === requestedDiscount ? (points as number) : Math.ceil(discountApplied / POINTS_TO_CURRENCY);
  const remainingPoints = summary.points - pointsRedeemed;
  const newTotal = Math.max(0, Math.round((order.total - discountApplied) * 100) / 100);
  const now = new Date().toISOString();

  await pool.query("UPDATE loyalty_summary SET points = $1, updated_at = $2 WHERE id = $3", [remainingPoints, now, summary.id]);
  await pool.query(
    "INSERT INTO loyalty_transactions (id, tenant_id, type, amount, description, created_at) VALUES ($1,$2,'redeem',$3,$4,$5)",
    [randomUUID(), tenant.id, pointsRedeemed, `Redeemed ${pointsRedeemed} pts (-$${discountApplied.toFixed(2)}) on order #${orderId.slice(0, 8)}`, now],
  );
  const reason = order.discount_reason
    ? `${order.discount_reason} | Loyalty (-$${discountApplied.toFixed(2)})`
    : `Loyalty redemption (-$${discountApplied.toFixed(2)})`;
  await pool.query(
    "UPDATE orders SET discount_amount = $1, discount_reason = $2, total = $3, updated_at = $4 WHERE id = $5",
    [(order.discount_amount || 0) + discountApplied, reason, newTotal, now, orderId],
  );
  publishDomain({ type: "loyalty.points.redeemed", tenantId: tenant.id, amount: pointsRedeemed });
  return reply.send({ success: true, pointsRedeemed, discountApplied, remainingPoints, newTotal });
});

// ── Promotions ──────────────────────────────────────────────────────────────
// GET /api/r/:slug/promo/validate?code=&subtotal= — validates + returns discount.
app.get<{ Params: { slug: string }; Querystring: { code?: string; subtotal?: string } }>("/v1/tenants/:slug/promo/validate", async (req, reply) => {
  const tenant = await tenantBySlug(req.params.slug);
  if (!tenant) return reply.code(404).send(err("Tenant not found"));
  if (!staff(reply, ["admin", "manager", "waiter", "cashier"], tenant.id)) return;
  const code = req.query.code;
  if (!code || code.length > 100) return reply.code(400).send(err("code is required (1-100 chars)"));

  const r = await pool.query(
    "SELECT * FROM promo_campaigns WHERE tenant_id = $1 AND is_active = true AND lower(name) = lower($2) LIMIT 1",
    [tenant.id, code],
  );
  const campaign = r.rows[0];
  if (!campaign) return reply.code(404).send(err("Invalid promo code"));
  if (campaign.usage_limit && campaign.usage_count >= campaign.usage_limit) return reply.code(400).send(err("Promo code usage limit reached"));
  if (campaign.start_date && new Date(campaign.start_date) > new Date()) return reply.code(400).send(err("Promo code not yet active"));
  if (campaign.end_date && new Date(campaign.end_date) < new Date()) return reply.code(400).send(err("Promo code has expired"));
  if (campaign.days_of_week) {
    const allowed = campaign.days_of_week.split(",").map(Number);
    if (!allowed.includes(new Date().getDay())) return reply.code(400).send(err("Promo code not valid today"));
  }
  if (campaign.time_start && campaign.time_end) {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [sh, sm] = campaign.time_start.split(":").map(Number);
    const [eh, em] = campaign.time_end.split(":").map(Number);
    if (currentMinutes < sh * 60 + sm || currentMinutes > eh * 60 + em) return reply.code(400).send(err("Promo code not valid at this time"));
  }

  const subtotal = parseFloat(req.query.subtotal || "0");
  let discountAmount = 0;
  if (campaign.type === "percentage" || campaign.type === "happy_hour") {
    discountAmount = subtotal * (campaign.value / 100);
    if (campaign.max_discount) discountAmount = Math.min(discountAmount, campaign.max_discount);
  } else if (campaign.type === "fixed" || campaign.type === "buy_x_get_y") {
    discountAmount = Math.min(campaign.value, subtotal || Infinity);
  } else {
    return reply.code(400).send(err("Promo type not supported for this endpoint"));
  }
  discountAmount = Math.round(discountAmount * 100) / 100;
  await pool.query("UPDATE promo_campaigns SET usage_count = usage_count + 1 WHERE id = $1", [campaign.id]);
  publishDomain({ type: "promo.validated", campaignId: campaign.id, tenantId: tenant.id, code: campaign.name });
  return reply.send({
    valid: true, code: campaign.name, type: campaign.type, value: campaign.value, discount: discountAmount,
    description: campaign.type === "percentage" ? `${campaign.value}% off` : `$${campaign.value} off`,
  });
});

// POST /api/r/:slug/orders/:orderId/apply-promo — mirrors applyPromoCode.
app.post<{ Params: { slug: string; orderId: string }; Body: { code?: string } }>("/v1/tenants/:slug/orders/:orderId/apply-promo", async (req, reply) => {
  const tenant = await tenantBySlug(req.params.slug);
  if (!tenant) return reply.code(404).send(err("Tenant not found"));
  if (!staff(reply, ["admin", "manager", "waiter"], tenant.id)) return;
  const code = req.body?.code;
  if (!code || code.length > 100) return reply.code(400).send(err("code is required (1-100 chars)"));

  const r = await pool.query(
    "SELECT * FROM promo_campaigns WHERE tenant_id = $1 AND is_active = true AND lower(name) = lower($2) LIMIT 1",
    [tenant.id, code],
  );
  const campaign = r.rows[0];
  if (!campaign) return reply.code(404).send(err("Invalid promo code"));
  if (campaign.usage_limit && campaign.usage_count >= campaign.usage_limit) return reply.code(400).send(err("Promo code usage limit reached"));
  if (campaign.start_date && new Date(campaign.start_date) > new Date()) return reply.code(400).send(err("Promo code not yet active"));
  if (campaign.end_date && new Date(campaign.end_date) < new Date()) return reply.code(400).send(err("Promo code has expired"));
  if (campaign.days_of_week) {
    const allowed = campaign.days_of_week.split(",").map(Number);
    if (!allowed.includes(new Date().getDay())) return reply.code(400).send(err("Promo code not valid today"));
  }
  if (campaign.time_start && campaign.time_end) {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [sh, sm] = campaign.time_start.split(":").map(Number);
    const [eh, em] = campaign.time_end.split(":").map(Number);
    if (currentMinutes < sh * 60 + sm || currentMinutes > eh * 60 + em) return reply.code(400).send(err("Promo code not valid at this time"));
  }

  const o = await pool.query("SELECT * FROM orders WHERE id = $1 AND tenant_id = $2 LIMIT 1", [req.params.orderId, tenant.id]);
  const order = o.rows[0];
  if (!order) return reply.code(404).send(err("Order not found"));
  if (campaign.min_order_amount && order.subtotal < campaign.min_order_amount) {
    return reply.code(400).send(err(`Minimum order amount of ${campaign.min_order_amount} required`));
  }

  let discountAmount = 0;
  if (campaign.type === "percentage" || campaign.type === "happy_hour") {
    discountAmount = order.subtotal * (campaign.value / 100);
    if (campaign.max_discount) discountAmount = Math.min(discountAmount, campaign.max_discount);
  } else if (campaign.type === "fixed" || campaign.type === "buy_x_get_y") {
    discountAmount = Math.min(campaign.value, order.subtotal);
  } else {
    return reply.code(400).send(err("Promo type not supported for manual apply"));
  }
  discountAmount = Math.round(discountAmount * 100) / 100;
  const newTotal = Math.max(0, order.total - discountAmount);
  const now = new Date().toISOString();

  await pool.query("INSERT INTO promo_code_usages (id, campaign_id, order_id, discount_amount, created_at) VALUES ($1,$2,$3,$4,$5)",
    [randomUUID(), campaign.id, req.params.orderId, discountAmount, now]);
  await pool.query("UPDATE promo_campaigns SET usage_count = usage_count + 1 WHERE id = $1", [campaign.id]);
  await pool.query("UPDATE orders SET total = $1, notes = $2, updated_at = $3 WHERE id = $4",
    [newTotal, order.notes ? `${order.notes} | Promo: ${code} (-${discountAmount})` : `Promo: ${code} (-${discountAmount})`, now, req.params.orderId]);
  publishDomain({ type: "promo.validated", campaignId: campaign.id, tenantId: tenant.id, code: campaign.name });
  return reply.send({ discountAmount, newTotal });
});

// ── Campaigns CRUD ──────────────────────────────────────────────────────────
const campaignSchema = (b: Record<string, unknown>) =>
  typeof b.name === "string" && b.name.length >= 1
  && ["percentage", "fixed", "buy_x_get_y", "happy_hour"].includes(b.type as string)
  && typeof b.value === "number" && b.value >= 0;

// GET /api/r/:slug/campaigns (admin/manager).
app.get<{ Params: { slug: string } }>("/v1/tenants/:slug/campaigns", async (req, reply) => {
  const tenant = await tenantBySlug(req.params.slug);
  if (!tenant) return reply.code(404).send(err("Tenant not found"));
  if (!staff(reply, ["admin", "manager"], tenant.id)) return;
  const r = await pool.query("SELECT * FROM promo_campaigns WHERE tenant_id = $1 ORDER BY created_at", [tenant.id]);
  return reply.send({ data: r.rows.map(toCamel) });
});
// Compat alias (gateway rewrites GET /api/r/:slug/campaigns).
app.get<{ Params: { slug: string } }>("/compat/campaigns/:slug", async (req, reply) => {
  const tenant = await tenantBySlug(req.params.slug);
  if (!tenant) return reply.code(404).send(err("Tenant not found"));
  if (!staff(reply, ["admin", "manager"], tenant.id)) return;
  const r = await pool.query("SELECT * FROM promo_campaigns WHERE tenant_id = $1 ORDER BY created_at", [tenant.id]);
  return reply.send({ data: r.rows.map(toCamel) });
});

// POST /api/r/:slug/campaigns (admin) — mirrors createCampaign.
app.post<{ Params: { slug: string }; Body: Record<string, unknown> }>("/v1/tenants/:slug/campaigns", async (req, reply) => {
  const tenant = await tenantBySlug(req.params.slug);
  if (!tenant) return reply.code(404).send(err("Tenant not found"));
  if (!staff(reply, ["admin"], tenant.id)) return;
  const b = req.body || {};
  if (!campaignSchema(b)) return reply.code(400).send(err("invalid campaign payload"));
  const id = randomUUID();
  await pool.query(
    `INSERT INTO promo_campaigns (id, tenant_id, name, type, value, min_order_amount, max_discount,
       start_date, end_date, days_of_week, time_start, time_end, usage_limit)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [id, tenant.id, b.name, b.type, b.value, b.minOrderAmount ?? null, b.maxDiscount ?? null,
     b.startDate ?? null, b.endDate ?? null, b.daysOfWeek ?? null, b.timeStart ?? null, b.timeEnd ?? null, b.usageLimit ?? null],
  );
  return reply.code(201).send({ data: { id } });
});

// PUT /api/r/:slug/campaigns/:campaignId (admin) — mirrors updateCampaign.
app.put<{ Params: { slug: string; campaignId: string }; Body: Record<string, unknown> }>("/v1/tenants/:slug/campaigns/:campaignId", async (req, reply) => {
  const tenant = await tenantBySlug(req.params.slug);
  if (!tenant) return reply.code(404).send(err("Tenant not found"));
  if (!staff(reply, ["admin"], tenant.id)) return;
  const b = req.body || {};
  const fields: string[] = [];
  const vals: unknown[] = [];
  const map: Record<string, string> = {
    name: "name", type: "type", value: "value", minOrderAmount: "min_order_amount", maxDiscount: "max_discount",
    startDate: "start_date", endDate: "end_date", daysOfWeek: "days_of_week", timeStart: "time_start",
    timeEnd: "time_end", usageLimit: "usage_limit", isActive: "is_active",
  };
  for (const [k, col] of Object.entries(map)) {
    if (b[k] !== undefined) { fields.push(`${col} = $${fields.length + 1}`); vals.push(b[k]); }
  }
  if (fields.length) {
    await pool.query(`UPDATE promo_campaigns SET ${fields.join(", ")} WHERE id = $${fields.length + 1} AND tenant_id = $${fields.length + 2}`,
      [...vals, req.params.campaignId, tenant.id]);
  }
  return reply.send({ success: true });
});

// DELETE /api/r/:slug/campaigns/:campaignId (admin) — mirrors deleteCampaign.
app.delete<{ Params: { slug: string; campaignId: string } }>("/v1/tenants/:slug/campaigns/:campaignId", async (req, reply) => {
  const tenant = await tenantBySlug(req.params.slug);
  if (!tenant) return reply.code(404).send(err("Tenant not found"));
  if (!staff(reply, ["admin"], tenant.id)) return;
  await pool.query("DELETE FROM promo_code_usages WHERE campaign_id = $1", [req.params.campaignId]);
  await pool.query("DELETE FROM promo_campaigns WHERE id = $1 AND tenant_id = $2", [req.params.campaignId, tenant.id]);
  return reply.send({ success: true });
});

// ── Marketing send ───────────────────────────────────────────────────────────
// POST /api/r/:slug/marketing/campaign — send to a segment; delivery fans out
// to the notifications service (email owner).
const daysSince = (d?: string | null) => (d ? (Date.now() - new Date(d).getTime()) / 86400000 : Infinity);
app.post<{ Params: { slug: string }; Body: { segment?: string; subject?: string; message?: string } }>("/v1/tenants/:slug/marketing/campaign", async (req, reply) => {
  const tenant = await tenantBySlug(req.params.slug);
  if (!tenant) return reply.code(404).send(err("Tenant not found"));
  if (!staff(reply, ["admin", "manager"], tenant.id)) return;
  const b = req.body || {};
  const segment = b.segment as "all" | "vip" | "atRisk";
  if (!["all", "vip", "atRisk"].includes(segment)) return reply.code(400).send(err("segment must be all|vip|atRisk"));
  if (typeof b.subject !== "string" || b.subject.length < 1 || typeof b.message !== "string" || b.message.length < 1) {
    return reply.code(400).send(err("subject and message required"));
  }
  const customers = await pool.query("SELECT * FROM customers WHERE tenant_id = $1", [tenant.id]);
  const inSeg = (c: { total_spent?: number | null; total_visits?: number | null; last_visit?: string | null; email?: string | null }) =>
    segment === "vip" ? (Number(c.total_spent) >= 200 || (c.total_visits || 0) >= 5)
      : segment === "atRisk" ? ((c.total_visits || 0) >= 2 && daysSince(c.last_visit) > 30)
        : true;
  const targets = customers.rows.filter((c) => inSeg(c) && c.email);
  const safe = String(b.message).replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
  const html = `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto;color:#333">`
    + `${safe}<hr style="border:none;border-top:1px solid #eee;margin:24px 0">`
    + `<p style="color:#999;font-size:12px">${tenant.name} · powered by Qlisted</p></div>`;

  const notifyUrl = process.env.NOTIFICATIONS_URL;
  let sent = 0;
  for (const c of targets) {
    if (!c.email || !notifyUrl) continue;
    try {
      const res = await fetch(`${notifyUrl.replace(/\/$/, "")}/v1/notify/send`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ to: c.email, subject: b.subject, html }),
      });
      if (res.ok) sent += 1;
    } catch { /* best-effort per recipient */ }
  }
  publishDomain({ type: "campaign.sent", campaignId: "manual", tenantId: tenant.id, recipients: targets.length });
  log.info({ tenantId: tenant.id, segment, sent, total: targets.length }, "Campaign sent");
  return reply.send({ sent, total: targets.length });
});

if (process.env.NODE_ENV !== "test") {
  app.listen({ port: PORT, host: "0.0.0.0" }).then(() => log.info(`engagement on :${PORT}`));
}
