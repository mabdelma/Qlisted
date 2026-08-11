import Fastify from "fastify";
import pg from "pg";
import Redis from "ioredis";
import { randomUUID } from "node:crypto";
import { createLogger, ok, err, verifyHs256, bearer, initSentry, captureError, getEventBus } from "@qlisted/shared";
import type { DomainEvent } from "@qlisted/shared";

interface OrderItemInput { menuItemId: string; name: string; quantity: number; unitPrice: number; notes?: string | null; modifiers?: string | null }
interface CreateOrderInput {
  tableId?: string; customerName?: string; customerPhone?: string;
  orderType?: "dine_in" | "takeout" | "delivery"; deliveryAddress?: string; deliveryFee?: number;
  estimatedPickupTime?: string; estimatedDeliveryTime?: string; items: OrderItemInput[]; notes?: string;
}

/**
 * ORDERS service — owns carts, orders, kitchen/KDS status. The core flow
 * (place → track → status) is migrated for real from the monolith
 * (routes/orders.ts + services/orderService.ts). It shares the Postgres DB and
 * publishes order.* domain events on the bus (notifications consume them for
 * email/push) plus the Redis order:<tenantId> channel the kitchen feed relays.
 */
const log = createLogger("orders");
export const app = Fastify({ loggerInstance: log });
initSentry("orders");
app.addHook("onError", async (req, _reply, error) => captureError(error, { url: req.url, method: req.method }));
const PORT = Number(process.env.PORT || 8080);

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 });

const pub = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 3 }) : null;
const sub = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 3 }) : null;
pub?.on("error", (e) => log.error({ err: e }, "redis error"));
sub?.on("error", (e) => log.error({ err: e }, "redis error"));

// Kitchen feed parity: publish to order:<tenantId> (the monolith /events route
// relays this channel to the KDS over SSE).
function emitOrderEvent(type: string, tenantId: string, orderId: string, data?: Record<string, unknown>) {
  const msg = JSON.stringify(data ? { type, tenantId, orderId, data } : { type, tenantId, orderId });
  pub?.publish(`order:${tenantId}`, msg).catch((e) => log.error({ err: e }, "redis publish failed"));
}
// Cross-service domain events (notifications / billing / engagement react).
function publishDomain(e: DomainEvent) { void getEventBus().publish(e).catch(() => {}); }

const toCamel = (row: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(row).map(([k, v]) => [k.replace(/_([a-z])/g, (_m, c) => c.toUpperCase()), v]));

// ── helpers ─────────────────────────────────────────────────────────────────
async function tenantBySlug(slug: string) {
  const r = await pool.query(
    "SELECT id, name, tax_rate, service_charge, email FROM tenants WHERE slug = $1 AND is_active = true LIMIT 1",
    [slug],
  );
  return r.rows[0] as { id: string; name: string; tax_rate: number | null; service_charge: number | null; email: string | null } | undefined;
}

/** Verify staff token + role + tenant scope (mirror authMiddleware + requireRole). */
function staff(reply: Fastify.Reply, roles: string[], tenantId: string): { sub: string; role: string } | null {
  const claims = verifyHs256(bearer(reply.request.headers.authorization));
  if (!claims) { void reply.code(401).send(err("Authentication required")); return null; }
  if (!roles.includes(String(claims.role))) { void reply.code(403).send(err("Forbidden")); return null; }
  if (claims.tenantId !== null && claims.tenantId !== tenantId) { void reply.code(403).send(err("Forbidden")); return null; }
  return { sub: claims.sub, role: String(claims.role) };
}

function parsePagination(q: { page?: string; limit?: string }) {
  const page = Math.max(1, parseInt(q.page || "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q.limit || "20", 10) || 20));
  return { page, limit };
}
function buildPagination<T>(data: T[], total: number, { page, limit }: { page: number; limit: number }) {
  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasNext: page * limit < total, hasPrev: page > 1 } };
}

app.get("/health", async () => ok({ service: "orders", status: "up" }));
app.get("/ready", async () => {
  try { await pool.query("select 1"); return ok({ ready: true }); }
  catch { return err("db unavailable"); }
});

// ── Place order (guest, mirrors POST /api/r/:slug/orders) ───────────────────
async function createOrderFlow(tenant: NonNullable<Awaited<ReturnType<typeof tenantBySlug>>>, input: CreateOrderInput) {
  const orderType = input.orderType || "dine_in";
  if (!input.items?.length) return { error: "items required", status: 400 as const };
  if (orderType === "dine_in") {
    if (!input.tableId) return { error: "Table ID is required for dine-in orders", status: 400 as const };
    const tbl = await pool.query("SELECT id FROM tables WHERE id = $1 AND tenant_id = $2 LIMIT 1", [input.tableId, tenant.id]);
    if (!tbl.rows[0]) return { error: "Table not found", status: 404 as const };
  }

  const orderId = randomUUID();
  const subtotal = input.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const itemCount = input.items.reduce((s, i) => s + i.quantity, 0);
  const taxRate = tenant.tax_rate || 0;
  const serviceChargeRate = orderType === "dine_in" ? tenant.service_charge || 0 : 0;
  const deliveryFee = input.deliveryFee || 0;
  const tax = subtotal * taxRate;
  const serviceCharge = subtotal * serviceChargeRate;
  const total = subtotal + tax + serviceCharge + deliveryFee;

  await pool.query(
    `INSERT INTO orders (id, tenant_id, table_id, customer_name, customer_phone, order_type, delivery_address,
       delivery_fee, estimated_pickup_time, estimated_delivery_time, status, item_count, subtotal,
       discount_amount, tax, service_charge, total, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending',$11,$12,0,$13,$14,$15,$16)`,
    [orderId, tenant.id, input.tableId || null, input.customerName || null, input.customerPhone || null, orderType,
     input.deliveryAddress || null, deliveryFee, input.estimatedPickupTime || null, input.estimatedDeliveryTime || null,
     itemCount, subtotal, tax, serviceCharge, total, input.notes || null],
  );

  const orderItems = input.items.map((i) => ({
    id: randomUUID(), orderId, menuItemId: i.menuItemId, name: i.name,
    quantity: i.quantity, unitPrice: i.unitPrice, notes: i.notes, modifiers: i.modifiers,
  }));
  for (const it of orderItems) {
    await pool.query(
      "INSERT INTO order_items (id, order_id, menu_item_id, name, quantity, unit_price, notes, modifiers) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [it.id, it.orderId, it.menuItemId, it.name, it.quantity, it.unitPrice, it.notes ?? null, it.modifiers ?? null],
    );
  }
  if (orderType === "dine_in" && input.tableId) {
    await pool.query("UPDATE tables SET status = 'occupied' WHERE id = $1", [input.tableId]);
  }

  emitOrderEvent("order_created", tenant.id, orderId);
  publishDomain({ type: "order.placed", orderId, tenantId: tenant.id, total });
  log.info({ tenantId: tenant.id, orderId, orderType, items: input.items.length }, "Order created");
  return { data: { id: orderId, items: orderItems, subtotal, tax, serviceCharge, deliveryFee, total, orderType }, status: 201 as const };
}

app.post<{ Params: { slug: string }; Body: CreateOrderInput }>("/v1/tenants/:slug/orders", async (req, reply) => {
  const tenant = await tenantBySlug(req.params.slug);
  if (!tenant) return reply.code(404).send(err("Tenant not found"));
  const r = await createOrderFlow(tenant, req.body || {});
  if ("error" in r) return reply.code(r.status).send({ error: r.error });
  return reply.code(r.status).send(r.data);
});
// Compat alias — gateway rewrites POST /api/r/:slug/orders → /compat/orders/:slug.
app.post<{ Params: { slug: string }; Body: CreateOrderInput }>("/compat/orders/:slug", async (req, reply) => {
  const tenant = await tenantBySlug(req.params.slug);
  if (!tenant) return reply.code(404).send(err("Tenant not found"));
  const r = await createOrderFlow(tenant, req.body || {});
  if ("error" in r) return reply.code(r.status).send({ error: r.error });
  return reply.code(r.status).send(r.data);
});

// ── Order reads ─────────────────────────────────────────────────────────────
// Public order tracking (mirrors GET /api/r/:slug/orders/:orderId/track).
app.get<{ Params: { slug: string; orderId: string } }>("/v1/tenants/:slug/orders/:orderId/track", async (req, reply) => {
  const tenant = await tenantBySlug(req.params.slug);
  if (!tenant) return reply.code(404).send({ error: "Order not found" });
  const o = await pool.query("SELECT * FROM orders WHERE id = $1 AND tenant_id = $2 LIMIT 1", [req.params.orderId, tenant.id]);
  if (!o.rows[0]) return reply.code(404).send({ error: "Order not found" });
  const items = await pool.query("SELECT * FROM order_items WHERE order_id = $1", [req.params.orderId]);
  return reply.send({ ...toCamel(o.rows[0]), items: items.rows.map(toCamel) });
});

// Order detail (authed staff; mirrors GET /api/r/:slug/orders/:orderId).
app.get<{ Params: { slug: string; orderId: string } }>("/v1/tenants/:slug/orders/:orderId", async (req, reply) => {
  const tenant = await tenantBySlug(req.params.slug);
  if (!tenant) return reply.code(404).send(err("Tenant not found"));
  if (!staff(reply, ["admin", "manager", "kitchen", "waiter"], tenant.id)) return;
  const o = await pool.query("SELECT * FROM orders WHERE id = $1 AND tenant_id = $2 LIMIT 1", [req.params.orderId, tenant.id]);
  if (!o.rows[0]) return reply.code(404).send(err("Order not found"));
  const items = await pool.query("SELECT * FROM order_items WHERE order_id = $1", [req.params.orderId]);
  return reply.send({ ...toCamel(o.rows[0]), items: items.rows.map(toCamel) });
});

// List orders (staff; status/orderType filters + pagination).
app.get<{ Params: { slug: string }; Querystring: { status?: string; orderType?: string; page?: string; limit?: string } }>("/v1/tenants/:slug/orders", async (req, reply) => {
  const tenant = await tenantBySlug(req.params.slug);
  if (!tenant) return reply.code(404).send(err("Tenant not found"));
  if (!staff(reply, ["admin", "manager", "kitchen", "waiter"], tenant.id)) return;
  const { page, limit } = parsePagination(req.query);
  const conds = ["tenant_id = $1"];
  const vals: unknown[] = [tenant.id];
  if (req.query.status) { conds.push(`status = $${vals.length + 1}`); vals.push(req.query.status); }
  if (req.query.orderType) { conds.push(`order_type = $${vals.length + 1}`); vals.push(req.query.orderType); }
  const where = conds.join(" AND ");
  const count = await pool.query(`SELECT COUNT(*)::int AS c FROM orders WHERE ${where}`, vals);
  const data = await pool.query(`SELECT * FROM orders WHERE ${where} ORDER BY created_at LIMIT ${limit} OFFSET ${(page - 1) * limit}`, vals);
  return reply.send(buildPagination(data.rows.map(toCamel), Number(count.rows[0]?.c || 0), { page, limit }));
});

// Table orders (public — mirrors GET /api/r/:slug/table/:tableId/orders).
app.get<{ Params: { slug: string; tableId: string } }>("/v1/tenants/:slug/table/:tableId/orders", async (req, reply) => {
  const tenant = await tenantBySlug(req.params.slug);
  if (!tenant) return reply.code(404).send(err("Tenant not found"));
  const { page, limit } = parsePagination({});
  const count = await pool.query("SELECT COUNT(*)::int AS c FROM orders WHERE tenant_id = $1 AND table_id = $2", [tenant.id, req.params.tableId]);
  const data = await pool.query("SELECT * FROM orders WHERE tenant_id = $1 AND table_id = $2 ORDER BY created_at LIMIT $3 OFFSET $4", [tenant.id, req.params.tableId, limit, 0]);
  return reply.send(buildPagination(data.rows.map(toCamel), Number(count.rows[0]?.c || 0), { page, limit }));
});

// Server (waiter) orders — mirrors GET /api/r/:slug/orders/server/:serverId.
app.get<{ Params: { slug: string; serverId: string } }>("/v1/tenants/:slug/orders/server/:serverId", async (req, reply) => {
  const tenant = await tenantBySlug(req.params.slug);
  if (!tenant) return reply.code(404).send(err("Tenant not found"));
  if (!staff(reply, ["admin", "manager", "kitchen", "waiter"], tenant.id)) return;
  const { page, limit } = parsePagination({});
  const count = await pool.query("SELECT COUNT(*)::int AS c FROM orders WHERE tenant_id = $1 AND server_id = $2", [tenant.id, req.params.serverId]);
  const data = await pool.query("SELECT * FROM orders WHERE tenant_id = $1 AND server_id = $2 ORDER BY created_at LIMIT $3 OFFSET $4", [tenant.id, req.params.serverId, limit, 0]);
  return reply.send(buildPagination(data.rows.map(toCamel), Number(count.rows[0]?.c || 0), { page, limit }));
});

// Track compat shim (gateway rewrites GET /api/r/:slug/orders/:id/track).
app.get<{ Params: { slug: string; orderId: string } }>("/compat/track/:slug/:orderId", async (req, reply) => {
  const tenant = await tenantBySlug(req.params.slug);
  if (!tenant) return reply.code(404).send({ error: "Order not found" });
  const o = await pool.query("SELECT * FROM orders WHERE id = $1 AND tenant_id = $2 LIMIT 1", [req.params.orderId, tenant.id]);
  if (!o.rows[0]) return reply.code(404).send({ error: "Order not found" });
  const items = await pool.query("SELECT * FROM order_items WHERE order_id = $1", [req.params.orderId]);
  return reply.send({ ...toCamel(o.rows[0]), items: items.rows.map(toCamel) });
});

// ── Status transitions (staff) ──────────────────────────────────────────────
const STATUSES = ["pending", "preparing", "ready", "delivered", "cancelled"];
const STATUS_ROLES = ["admin", "manager", "kitchen", "waiter"];

async function updateStatusFlow(tenantId: string, orderId: string, status: string) {
  const now = new Date().toISOString();
  if (status === "delivered") {
    await pool.query("UPDATE orders SET status = $1, updated_at = $2, completed_at = $2 WHERE id = $3 AND tenant_id = $4", [status, now, orderId, tenantId]);
  } else {
    await pool.query("UPDATE orders SET status = $1, updated_at = $2 WHERE id = $3 AND tenant_id = $4", [status, now, orderId, tenantId]);
  }
  emitOrderEvent("order_updated", tenantId, orderId, { status });
  emitOrderEvent("order_status_changed", tenantId, orderId, { status });
  publishDomain({ type: "order.status.changed", orderId, tenantId, status });
  if (status === "ready") publishDomain({ type: "order.ready", orderId, tenantId });
  log.info({ tenantId, orderId, status }, "Order status updated");
}

app.patch<{ Params: { slug: string; orderId: string }; Body: { status?: string } }>("/v1/tenants/:slug/orders/:orderId/status", async (req, reply) => {
  const tenant = await tenantBySlug(req.params.slug);
  if (!tenant) return reply.code(404).send(err("Tenant not found"));
  if (!staff(reply, STATUS_ROLES, tenant.id)) return;
  const status = req.body?.status;
  if (!status || !STATUSES.includes(status)) return reply.code(400).send(err("invalid status"));
  await updateStatusFlow(tenant.id, req.params.orderId, status);
  return reply.send({ success: true });
});
// Compat shim (gateway rewrites PATCH /api/r/:slug/orders/:id/status).
app.patch<{ Params: { slug: string; orderId: string }; Body: { status?: string } }>("/compat/status/:slug/:orderId", async (req, reply) => {
  const tenant = await tenantBySlug(req.params.slug);
  if (!tenant) return reply.code(404).send(err("Tenant not found"));
  if (!staff(reply, STATUS_ROLES, tenant.id)) return;
  const status = req.body?.status;
  if (!status || !STATUSES.includes(status)) return reply.code(400).send(err("invalid status"));
  await updateStatusFlow(tenant.id, req.params.orderId, status);
  return reply.send({ success: true });
});

// ── Modify order (items / discount / comp) ──────────────────────────────────
interface OrderRow {
  id: string;
  status: string;
  order_type: string;
  subtotal: number;
  total: number;
  discount_amount?: number | null;
  tax?: number | null;
  service_charge?: number | null;
  delivery_fee?: number | null;
}
async function getOrder(tenantId: string, orderId: string) {
  const r = await pool.query("SELECT * FROM orders WHERE id = $1 AND tenant_id = $2 LIMIT 1", [orderId, tenantId]);
  return r.rows[0] as OrderRow | undefined;
}

// Update items (add / remove) — mirrors updateOrderItems.
app.patch<{ Params: { slug: string; orderId: string }; Body: { addItems?: OrderItemInput[]; removeItemIds?: string[] } }>("/v1/tenants/:slug/orders/:orderId/items", async (req, reply) => {
  const tenant = await tenantBySlug(req.params.slug);
  if (!tenant) return reply.code(404).send(err("Tenant not found"));
  if (!staff(reply, ["admin", "manager", "waiter"], tenant.id)) return;
  const order = await getOrder(tenant.id, req.params.orderId);
  if (!order) return reply.code(404).send(err("Order not found"));
  if (order.status === "cancelled" || order.status === "delivered") return reply.code(400).send(err("Cannot modify a cancelled or delivered order"));

  const body = req.body || {};
  if (body.removeItemIds?.length) {
    for (const itemId of body.removeItemIds) {
      await pool.query("DELETE FROM order_items WHERE id = $1 AND order_id = $2", [itemId, req.params.orderId]);
    }
  }
  if (body.addItems?.length) {
    for (const it of body.addItems) {
      await pool.query(
        "INSERT INTO order_items (id, order_id, menu_item_id, name, quantity, unit_price, notes, modifiers) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
        [randomUUID(), req.params.orderId, it.menuItemId, it.name, it.quantity, it.unitPrice, it.notes ?? null, it.modifiers ?? null],
      );
    }
  }
  const remaining = await pool.query("SELECT * FROM order_items WHERE order_id = $1", [req.params.orderId]);
  const itemCount = remaining.rows.reduce((s, i) => s + i.quantity, 0);
  const subtotal = remaining.rows.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const taxRate = tenant.tax_rate || 0;
  const serviceChargeRate = order.order_type !== "dine_in" ? 0 : tenant.service_charge || 0;
  const tax = subtotal * taxRate;
  const serviceCharge = subtotal * serviceChargeRate;
  const discount = order.discount_amount || 0;
  const total = subtotal - discount + tax + serviceCharge + (order.delivery_fee || 0);
  await pool.query(
    "UPDATE orders SET item_count = $1, subtotal = $2, tax = $3, service_charge = $4, total = $5, updated_at = $6 WHERE id = $7",
    [itemCount, subtotal, tax, serviceCharge, total, new Date().toISOString(), req.params.orderId],
  );
  emitOrderEvent("order_updated", tenant.id, req.params.orderId, { itemCount, subtotal, total });
  publishDomain({ type: "order.updated", orderId: req.params.orderId, tenantId: tenant.id });
  return reply.send({ items: remaining.rows.map(toCamel), itemCount, subtotal, tax, serviceCharge, total });
});

// Apply discount — mirrors applyDiscount.
app.post<{ Params: { slug: string; orderId: string }; Body: { amount?: number; reason?: string } }>("/v1/tenants/:slug/orders/:orderId/discount", async (req, reply) => {
  const tenant = await tenantBySlug(req.params.slug);
  if (!tenant) return reply.code(404).send(err("Tenant not found"));
  if (!staff(reply, ["admin", "manager"], tenant.id)) return;
  const order = await getOrder(tenant.id, req.params.orderId);
  if (!order) return reply.code(404).send(err("Order not found"));
  if (order.status === "cancelled" || order.status === "delivered") return reply.code(400).send(err("Cannot discount a completed order"));
  const amount = Math.max(0, Math.min(req.body?.amount || 0, order.subtotal));
  const total = order.subtotal - amount + (order.tax || 0) + (order.service_charge || 0) + (order.delivery_fee || 0);
  await pool.query("UPDATE orders SET discount_amount = $1, discount_reason = $2, total = $3, updated_at = $4 WHERE id = $5",
    [amount, req.body?.reason ?? null, total, new Date().toISOString(), req.params.orderId]);
  emitOrderEvent("order_updated", tenant.id, req.params.orderId, { discountAmount: amount, total });
  publishDomain({ type: "order.updated", orderId: req.params.orderId, tenantId: tenant.id });
  return reply.send({ discountAmount: amount, discountReason: req.body?.reason ?? null, total });
});

// Comp an item — mirrors compOrderItem.
app.post<{ Params: { slug: string; orderId: string; itemId: string }; Body: { isComp?: boolean } }>("/v1/tenants/:slug/orders/:orderId/items/:itemId/comp", async (req, reply) => {
  const tenant = await tenantBySlug(req.params.slug);
  if (!tenant) return reply.code(404).send(err("Tenant not found"));
  if (!staff(reply, ["admin", "manager", "waiter"], tenant.id)) return;
  const order = await getOrder(tenant.id, req.params.orderId);
  if (!order) return reply.code(404).send(err("Order not found"));
  if (order.status === "cancelled" || order.status === "delivered") return reply.code(400).send(err("Cannot modify a completed order"));
  const item = await pool.query("SELECT * FROM order_items WHERE id = $1 AND order_id = $2 LIMIT 1", [req.params.itemId, req.params.orderId]);
  if (!item.rows[0]) return reply.code(404).send(err("Order item not found"));
  const isComp = req.body?.isComp !== false;
  await pool.query("UPDATE order_items SET is_comp = $1, unit_price = $2 WHERE id = $3",
    [isComp, isComp ? 0 : item.rows[0].unit_price, req.params.itemId]);
  const remaining = await pool.query("SELECT * FROM order_items WHERE order_id = $1", [req.params.orderId]);
  const itemCount = remaining.rows.reduce((s, i) => s + i.quantity, 0);
  const subtotal = remaining.rows.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const total = subtotal - (order.discount_amount || 0) + (order.tax || 0) + (order.service_charge || 0) + (order.delivery_fee || 0);
  await pool.query("UPDATE orders SET item_count = $1, subtotal = $2, total = $3, updated_at = $4 WHERE id = $5",
    [itemCount, subtotal, total, new Date().toISOString(), req.params.orderId]);
  emitOrderEvent("order_updated", tenant.id, req.params.orderId, { itemId: req.params.itemId, isComp, subtotal, total });
  publishDomain({ type: "order.updated", orderId: req.params.orderId, tenantId: tenant.id });
  return reply.send({ itemId: req.params.itemId, isComp, subtotal, total });
});

// ── Live order stream (SSE) — mirrors the monolith /events route ────────────
app.get<{ Params: { slug: string } }>("/v1/tenants/:slug/orders/stream", async (req, reply) => {
  const tenant = await tenantBySlug(req.params.slug);
  if (!tenant) return reply.code(404).send(err("Tenant not found"));
  const channel = `order:${tenant.id}`;
  const raw = reply.raw;
  raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });
  raw.write(": connected\n\n");
  const onMessage = (_ch: string, msg: string) => {
    try { raw.write(`data: ${msg}\n\n`); } catch { /* client gone */ }
  };
  sub?.on("message", onMessage);
  void sub?.subscribe(channel).catch((e) => log.error({ err: e }, "redis subscribe failed"));
  const keepAlive = setInterval(() => { try { raw.write(": keepalive\n\n"); } catch { /* client gone */ } }, 15000);
  raw.on("close", () => {
    sub?.off("message", onMessage);
    void sub?.unsubscribe(channel).catch(() => {});
    clearInterval(keepAlive);
  });
  return reply;
});

if (process.env.NODE_ENV !== "test") {
  app.listen({ port: PORT, host: "0.0.0.0" }).then(() => log.info(`orders on :${PORT}`));
}
