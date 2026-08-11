import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { createHmac } from "node:crypto";
import { getEventBus, resetEventBus } from "@qlisted/shared";

process.env.AUTH_SECRET = "test-secret";
process.env.NODE_ENV = "test";
delete process.env.NOTIFICATIONS_URL;

const { queryMock, connectMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  connectMock: vi.fn(),
}));

vi.mock("pg", () => {
  class MockPool {
    query = queryMock;
    connect = connectMock;
    end = vi.fn().mockResolvedValue(undefined);
  }
  return { Pool: MockPool, default: { Pool: MockPool } };
});

import { app, pool } from "./server";

const TENANT = { id: "T1", name: "Demo Diner" };
const SUMMARY = { id: "ls1", tenant_id: "T1", points: 500, lifetime_points: 500, tier: "gold", updated_at: new Date().toISOString() };
const ORDER = { id: "o1", tenant_id: "T1", subtotal: 40, total: 46, discount_amount: 0, discount_reason: null, notes: null, payment_status: "pending", status: "pending" };
const CAMPAIGN = {
  id: "pc1", tenant_id: "T1", name: "SAVE10", type: "percentage", value: 10, max_discount: 5,
  min_order_amount: null, start_date: null, end_date: null, days_of_week: null, time_start: null, time_end: null,
  usage_limit: null, usage_count: 0, is_active: true,
};

function hs256Token(claims: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ ...claims, exp: Math.floor(Date.now() / 1000) + 3600 }),
  ).toString("base64url");
  const sig = createHmac("sha256", "test-secret").update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

const authHeader = (role: string, tenantId: string | null) => ({
  authorization: `Bearer ${hs256Token({ sub: "u1", userId: "u1", role, tenantId })}`,
});

beforeEach(() => {
  resetEventBus();
  queryMock.mockReset();
  connectMock.mockReset();
  queryMock.mockImplementation(async (sql: string) => {
    if (sql.includes("FROM tenants")) return { rows: [TENANT], rowCount: 1 };
    if (sql.includes("FROM loyalty_summary")) return { rows: [SUMMARY], rowCount: 1 };
    if (sql.includes("FROM loyalty_transactions")) return { rows: [{ id: "lt1", tenant_id: "T1", type: "earn", amount: 50 }], rowCount: 1 };
    if (sql.includes("FROM promo_campaigns")) return { rows: [CAMPAIGN], rowCount: 1 };
    if (sql.includes("FROM orders")) return { rows: [ORDER], rowCount: 1 };
    return { rows: [], rowCount: 1 };
  });
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

describe("loyalty", () => {
  it("GET returns summary, tier and history", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/tenants/demo/loyalty", headers: authHeader("manager", "T1") });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ points: 500, tier: "gold", lifetimePoints: 500, rewards: expect.any(Array) });
  });

  it("earn updates points and publishes loyalty.points.earned", async () => {
    const seen: unknown[] = [];
    getEventBus().subscribe("loyalty.points.earned", (e) => seen.push(e));
    const res = await app.inject({
      method: "POST",
      url: "/v1/tenants/demo/loyalty/earn",
      headers: authHeader("waiter", "T1"),
      payload: { amount: 10 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ points: 510, tier: "gold" });
    expect(seen[0]).toMatchObject({ type: "loyalty.points.earned", tenantId: "T1", amount: 10 });
  });

  it("earn rejects non-positive amounts", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/tenants/demo/loyalty/earn",
      headers: authHeader("manager", "T1"),
      payload: { amount: -5 },
    });
    expect(res.statusCode).toBe(400);
  });

  it("redeem rejects insufficient points", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/tenants/demo/loyalty/redeem",
      headers: authHeader("manager", "T1"),
      payload: { points: 9999 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("Insufficient points");
  });

  it("redeem returns a cash discount at 5%", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/tenants/demo/loyalty/redeem",
      headers: authHeader("manager", "T1"),
      payload: { points: 100, rewardId: "reward-1" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ points: 400, discount: 5 });
  });

  it("redeem-for-order writes the discount onto the order", async () => {
    const seen: unknown[] = [];
    getEventBus().subscribe("loyalty.points.redeemed", (e) => seen.push(e));
    const res = await app.inject({
      method: "POST",
      url: "/v1/tenants/demo/loyalty/redeem-for-order",
      headers: authHeader("cashier", "T1"),
      payload: { orderId: "o1", points: 100 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ pointsRedeemed: 100, discountApplied: 5, remainingPoints: 400, newTotal: 41 });
    const update = queryMock.mock.calls.find((c) => c[0].includes("UPDATE orders"));
    expect(update?.[1]?.[0]).toBe(5);
    expect(seen[0]).toMatchObject({ type: "loyalty.points.redeemed", amount: 100 });
  });

  it("redeem-for-order 400s when the order is already paid", async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM tenants")) return { rows: [TENANT], rowCount: 1 };
      if (sql.includes("FROM loyalty_summary")) return { rows: [SUMMARY], rowCount: 1 };
      if (sql.includes("FROM orders")) return { rows: [{ ...ORDER, payment_status: "paid" }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    });
    const res = await app.inject({
      method: "POST",
      url: "/v1/tenants/demo/loyalty/redeem-for-order",
      headers: authHeader("cashier", "T1"),
      payload: { orderId: "o1", points: 100 },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("promotions", () => {
  it("validates a percentage code and caps at max_discount", async () => {
    const seen: unknown[] = [];
    getEventBus().subscribe("promo.validated", (e) => seen.push(e));
    const res = await app.inject({
      method: "GET",
      url: "/v1/tenants/demo/promo/validate?code=SAVE10&subtotal=100",
      headers: authHeader("waiter", "T1"),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ valid: true, discount: 5, description: "10% off" });
    expect(queryMock.mock.calls.some((c) => c[0].includes("usage_count = usage_count + 1"))).toBe(true);
    expect(seen[0]).toMatchObject({ type: "promo.validated", code: "SAVE10" });
  });

  it("404s for an unknown code", async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM tenants")) return { rows: [TENANT], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const res = await app.inject({
      method: "GET",
      url: "/v1/tenants/demo/promo/validate?code=NOPE&subtotal=100",
      headers: authHeader("waiter", "T1"),
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("Invalid promo code");
  });

  it("rejects an expired code", async () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM tenants")) return { rows: [TENANT], rowCount: 1 };
      if (sql.includes("FROM promo_campaigns")) return { rows: [{ ...CAMPAIGN, end_date: past }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    });
    const res = await app.inject({
      method: "GET",
      url: "/v1/tenants/demo/promo/validate?code=SAVE10&subtotal=100",
      headers: authHeader("waiter", "T1"),
    });
    expect(res.statusCode).toBe(400);
  });

  it("applies a fixed promo to an order", async () => {
    const fixed = { ...CAMPAIGN, type: "fixed", value: 5 };
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM tenants")) return { rows: [TENANT], rowCount: 1 };
      if (sql.includes("FROM promo_campaigns")) return { rows: [fixed], rowCount: 1 };
      if (sql.includes("FROM orders")) return { rows: [ORDER], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    });
    const res = await app.inject({
      method: "POST",
      url: "/v1/tenants/demo/orders/o1/apply-promo",
      headers: authHeader("waiter", "T1"),
      payload: { code: "FIVE" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ discountAmount: 5, newTotal: 41 });
  });
});

describe("campaigns CRUD", () => {
  it("lists campaigns for admin", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/tenants/demo/campaigns", headers: authHeader("admin", "T1") });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(1);
  });

  it("403s for non-admin on create", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/tenants/demo/campaigns",
      headers: authHeader("manager", "T1"),
      payload: { name: "X", type: "fixed", value: 5 },
    });
    expect(res.statusCode).toBe(403);
  });

  it("creates a campaign (admin)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/tenants/demo/campaigns",
      headers: authHeader("admin", "T1"),
      payload: { name: "SUMMER", type: "percentage", value: 15, minOrderAmount: 20 },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.id).toBeTruthy();
    expect(queryMock.mock.calls.some((c) => c[0].includes("INSERT INTO promo_campaigns"))).toBe(true);
  });

  it("400s on an invalid payload", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/tenants/demo/campaigns",
      headers: authHeader("admin", "T1"),
      payload: { name: "", type: "bogus", value: 1 },
    });
    expect(res.statusCode).toBe(400);
  });

  it("updates and deletes a campaign (admin)", async () => {
    const upd = await app.inject({
      method: "PUT",
      url: "/v1/tenants/demo/campaigns/pc1",
      headers: authHeader("admin", "T1"),
      payload: { value: 20, isActive: false },
    });
    expect(upd.statusCode).toBe(200);
    expect(upd.json().success).toBe(true);
    const del = await app.inject({
      method: "DELETE",
      url: "/v1/tenants/demo/campaigns/pc1",
      headers: authHeader("admin", "T1"),
    });
    expect(del.statusCode).toBe(200);
  });
});

describe("marketing send", () => {
  it("rejects an invalid segment", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/tenants/demo/marketing/campaign",
      headers: authHeader("admin", "T1"),
      payload: { segment: "everyone", subject: "Hi", message: "Hello" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("sends to matching customers and reports totals", async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM tenants")) return { rows: [TENANT], rowCount: 1 };
      if (sql.includes("FROM customers")) {
        return { rows: [
          { id: "c1", email: "a@x.com", total_spent: 500, total_visits: 3, last_visit: new Date().toISOString() },
          { id: "c2", email: null, total_spent: 10, total_visits: 1, last_visit: null },
        ], rowCount: 2 };
      }
      return { rows: [], rowCount: 1 };
    });
    const res = await app.inject({
      method: "POST",
      url: "/v1/tenants/demo/marketing/campaign",
      headers: authHeader("manager", "T1"),
      payload: { segment: "vip", subject: "Hello", message: "Check this out" },
    });
    expect(res.statusCode).toBe(200);
    // vip: only c1 qualifies (spent>=200) and has an email; delivery skipped (no NOTIFICATIONS_URL).
    expect(res.json()).toMatchObject({ sent: 0, total: 1 });
  });
});
