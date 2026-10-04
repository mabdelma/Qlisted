import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { createHmac } from "node:crypto";
import { getEventBus, resetEventBus } from "@qlisted/shared";

process.env.AUTH_SECRET = "test-secret";
process.env.NODE_ENV = "test";

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

import { app, pool, translateOrderNotes } from "./server";

const TENANT = { id: "T1", name: "Demo Diner", tax_rate: 0.1, service_charge: 0.05, email: null };

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
    if (sql.includes("FROM tables")) return { rows: [{ id: "t1" }], rowCount: 1 };
    if (sql.startsWith("INSERT") || sql.startsWith("UPDATE")) return { rows: [], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  });
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

describe("POST /v1/tenants/:slug/orders (create)", () => {
  const body = {
    tableId: "t1",
    items: [
      { menuItemId: "m1", name: "Coffee", quantity: 2, unitPrice: 10 },
      { menuItemId: "m2", name: "Cake", quantity: 1, unitPrice: 20 },
    ],
  };

  it("creates a dine-in order with computed totals and publishes order.placed", async () => {
    const seen: unknown[] = [];
    getEventBus().subscribe("order.placed", (e) => seen.push(e));
    const res = await app.inject({ method: "POST", url: "/v1/tenants/demo/orders", payload: body });
    expect(res.statusCode).toBe(201);
    const json = res.json();
    expect(json.total).toBe(46); // 40 subtotal + 4 tax + 2 service charge
    expect(json.orderType).toBe("dine_in");
    expect(json.items).toHaveLength(2);
    const updates = queryMock.mock.calls.filter((c) => c[0].startsWith("UPDATE"));
    expect(updates.some((c) => c[0].includes("tables"))).toBe(true);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ type: "order.placed", tenantId: "T1", total: 46 });
  });

  it("400s when items are missing", async () => {
    const res = await app.inject({ method: "POST", url: "/v1/tenants/demo/orders", payload: { tableId: "t1" } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("items required");
  });

  it("400s for dine-in without a table", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/tenants/demo/orders",
      payload: { items: [{ menuItemId: "m1", name: "Coffee", quantity: 1, unitPrice: 10 }] },
    });
    expect(res.statusCode).toBe(400);
  });

  it("404s when the table is not found", async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM tenants")) return { rows: [TENANT], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const res = await app.inject({ method: "POST", url: "/v1/tenants/demo/orders", payload: body });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("Table not found");
  });

  it("404s for an unknown tenant", async () => {
    queryMock.mockImplementation(async () => ({ rows: [], rowCount: 0 }));
    const res = await app.inject({ method: "POST", url: "/v1/tenants/nope/orders", payload: body });
    expect(res.statusCode).toBe(404);
  });
});

describe("GET order reads", () => {
  it("tracks a public order (camelized)", async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM tenants")) return { rows: [TENANT], rowCount: 1 };
      if (sql.includes("FROM orders")) {
        return { rows: [{ id: "o1", tenant_id: "T1", status: "preparing", subtotal: 40 }], rowCount: 1 };
      }
      if (sql.includes("FROM order_items")) {
        return { rows: [{ id: "oi1", name: "Coffee", quantity: 2 }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });
    const res = await app.inject({ method: "GET", url: "/v1/tenants/demo/orders/o1/track" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: "o1", tenantId: "T1", status: "preparing", items: [{ id: "oi1", quantity: 2 }] });
  });

  it("404s tracking a missing order", async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM tenants")) return { rows: [TENANT], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const res = await app.inject({ method: "GET", url: "/v1/tenants/demo/orders/nope/track" });
    expect(res.statusCode).toBe(404);
  });

  it("requires staff auth for order detail", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/tenants/demo/orders/o1" });
    expect(res.statusCode).toBe(401);
  });

  it("rejects staff from another tenant for order detail", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/tenants/demo/orders/o1",
      headers: authHeader("admin", "OTHER"),
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("PATCH status transitions", () => {
  it("publishes order.status.changed and order.ready on ready", async () => {
    const seen: unknown[] = [];
    getEventBus().subscribe("order.status.changed", (e) => seen.push(e));
    getEventBus().subscribe("order.ready", (e) => seen.push(e));
    const res = await app.inject({
      method: "PATCH",
      url: "/v1/tenants/demo/orders/o1/status",
      headers: authHeader("kitchen", "T1"),
      payload: { status: "ready" },
    });
    expect(res.statusCode).toBe(200);
    expect(seen.map((e) => (e as { type: string }).type)).toEqual(["order.status.changed", "order.ready"]);
  });

  it("400s for an invalid status", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/v1/tenants/demo/orders/o1/status",
      headers: authHeader("kitchen", "T1"),
      payload: { status: "burned" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("401s without auth", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/v1/tenants/demo/orders/o1/status",
      payload: { status: "ready" },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("discount / items / comp", () => {
  it("applies a discount clamped to subtotal", async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM tenants")) return { rows: [TENANT], rowCount: 1 };
      if (sql.includes("SELECT * FROM orders")) {
        return { rows: [{ id: "o1", status: "pending", subtotal: 100, tax: 10, service_charge: 5, delivery_fee: 0, discount_amount: 0 }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    });
    const res = await app.inject({
      method: "POST",
      url: "/v1/tenants/demo/orders/o1/discount",
      headers: authHeader("manager", "T1"),
      payload: { amount: 500, reason: "loyalty" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ discountAmount: 100, discountReason: "loyalty", total: 15 });
  });

  it("publishes order.updated when items change", async () => {
    const seen: unknown[] = [];
    getEventBus().subscribe("order.updated", (e) => seen.push(e));
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM tenants")) return { rows: [TENANT], rowCount: 1 };
      if (sql.includes("SELECT * FROM orders")) {
        return { rows: [{ id: "o1", status: "pending", order_type: "dine_in", subtotal: 40, tax: 4, service_charge: 2, delivery_fee: 0, discount_amount: 0 }], rowCount: 1 };
      }
      if (sql.includes("FROM order_items")) {
        return { rows: [
          { id: "oi1", name: "Coffee", quantity: 2, unit_price: 10 },
          { id: "oi2", name: "Cake", quantity: 1, unit_price: 20 },
        ], rowCount: 2 };
      }
      return { rows: [], rowCount: 1 };
    });
    const res = await app.inject({
      method: "PATCH",
      url: "/v1/tenants/demo/orders/o1/items",
      headers: authHeader("waiter", "T1"),
      payload: { addItems: [{ menuItemId: "m2", name: "Cake", quantity: 1, unitPrice: 20 }] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().total).toBe(46); // (20 + 20) + 4 tax + 2 charge
    expect(seen).toHaveLength(1);
  });

  it("rejects modifying a cancelled order", async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM tenants")) return { rows: [TENANT], rowCount: 1 };
      if (sql.includes("SELECT * FROM orders")) {
        return { rows: [{ id: "o1", status: "cancelled" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    });
    const res = await app.inject({
      method: "PATCH",
      url: "/v1/tenants/demo/orders/o1/items",
      headers: authHeader("waiter", "T1"),
      payload: { addItems: [{ menuItemId: "m2", name: "Cake", quantity: 1, unitPrice: 20 }] },
    });
    expect(res.statusCode).toBe(400);
  });

  it("comps an item to zero price", async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM tenants")) return { rows: [TENANT], rowCount: 1 };
      if (sql.includes("SELECT * FROM orders")) {
        return { rows: [{ id: "o1", status: "pending", subtotal: 40, tax: 4, service_charge: 2, delivery_fee: 0, discount_amount: 0 }], rowCount: 1 };
      }
      if (sql.includes("FROM order_items") && sql.includes("AND order_id")) {
        return { rows: [{ id: "oi1", order_id: "o1", name: "Coffee", quantity: 2, unit_price: 10 }], rowCount: 1 };
      }
      if (sql.includes("FROM order_items")) {
        return { rows: [{ id: "oi1", name: "Coffee", quantity: 2, unit_price: 0 }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    });
    const res = await app.inject({
      method: "POST",
      url: "/v1/tenants/demo/orders/o1/items/oi1/comp",
      headers: authHeader("manager", "T1"),
      payload: { isComp: true },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().subtotal).toBe(0);
  });
});

/**
 * The language bridge. These assert the two properties that actually matter:
 * the guest's own wording survives, and placing an order never waits on the
 * translation provider.
 */
describe("order note translation", () => {
  it("writes only the translation columns, never the guest's original note", async () => {
    const seen: string[] = [];
    queryMock.mockImplementation(async (sql: string) => {
      seen.push(sql);
      if (sql.includes("FROM tenants")) return { rows: [{ ...TENANT, operating_language: "en" }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    });

    await translateOrderNotes(
      { id: "T1", operating_language: "en" },
      "o1",
      { items: [], notes: "sin cebolla, por favor" },
      [{ id: "oi1", notes: "sin hielo" }],
    );

    const updates = seen.filter((q) => q.includes("UPDATE"));
    // Every write targets a *_translated / notes_language column only. An UPDATE
    // that set `notes` itself would destroy what the guest wrote, which staff
    // rely on when a translation is wrong — and allergy notes make that unsafe.
    for (const u of updates) {
      expect(u).toMatch(/notes_translated|notes_language/);
      expect(u).not.toMatch(/SET notes =/);
    }
  });

  it("does nothing at all when no provider is configured", async () => {
    const prevKey = process.env.OPENAI_API_KEY;
    const prevBase = process.env.OPENAI_BASE_URL;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_BASE_URL;
    try {
      queryMock.mockReset();
      await translateOrderNotes({ id: "T1" }, "o1", { items: [], notes: "sin cebolla" }, []);
      expect(queryMock).not.toHaveBeenCalled();
    } finally {
      if (prevKey !== undefined) process.env.OPENAI_API_KEY = prevKey;
      if (prevBase !== undefined) process.env.OPENAI_BASE_URL = prevBase;
    }
  });

  it("skips the provider entirely when the order carries no notes", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    try {
      queryMock.mockReset();
      await translateOrderNotes({ id: "T1" }, "o1", { items: [] }, [{ id: "oi1", notes: null }]);
      expect(queryMock).not.toHaveBeenCalled();
    } finally {
      delete process.env.OPENAI_API_KEY;
    }
  });

  it("returns the placed order without waiting on translation", async () => {
    // Point the bridge at a dead port: translation is ENABLED (so the path runs)
    // but the call fails immediately and makes no outbound request from CI.
    // If placing an order awaited the bridge, that failure would surface here;
    // it must not. This is the regression being guarded — the monolith's
    // version awaits the provider and adds its latency to every order placed.
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_BASE_URL = "http://127.0.0.1:1/v1";
    try {
      const res = await app.inject({
        method: "POST",
        url: "/v1/tenants/demo/orders",
        payload: { tableId: "t1", items: [{ menuItemId: "m1", name: "Burger", quantity: 1, unitPrice: 10, notes: "sin cebolla" }] },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().id).toBeTruthy();
    } finally {
      delete process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_BASE_URL;
    }
  });
});
