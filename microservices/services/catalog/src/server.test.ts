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

import { app, pool } from "./server";

const TENANT = { id: "T1", name: "Demo Diner", currency: "USD" };

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
    return { rows: [], rowCount: 0 };
  });
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

describe("GET menu (public read)", () => {
  it("returns the tenant menu", async () => {
    queryMock
      .mockImplementationOnce(async (sql: string) =>
        sql.includes("FROM tenants") ? { rows: [TENANT] } : { rows: [], rowCount: 0 },
      )
      .mockImplementationOnce(async () => ({ rows: [{ id: "c1", name: "Starters" }], rowCount: 1 }))
      .mockImplementationOnce(async () => ({ rows: [{ id: "i1", name: "Burger", price: 9 }], rowCount: 1 }));
    const res = await app.inject({ method: "GET", url: "/v1/tenants/demo/menu" });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toMatchObject({
      tenant: { slug: "demo", name: "Demo Diner" },
      categories: [{ id: "c1", name: "Starters" }],
      items: [{ id: "i1", name: "Burger" }],
    });
  });

  it("404s for an unknown tenant", async () => {
    queryMock.mockImplementation(async () => ({ rows: [], rowCount: 0 }));
    const res = await app.inject({ method: "GET", url: "/v1/tenants/nope/menu" });
    expect(res.statusCode).toBe(404);
  });
});

describe("categories (admin writes)", () => {
  it("rejects requests without a token", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/tenants/demo/menu/categories",
      payload: { name: "Starters" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects non-staff roles", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/tenants/demo/menu/categories",
      headers: authHeader("customer", "T1"),
      payload: { name: "Starters" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("rejects staff from a different tenant", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/tenants/demo/menu/categories",
      headers: authHeader("admin", "OTHER"),
      payload: { name: "Starters" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("creates a category and publishes menu.category.created", async () => {
    const seen: unknown[] = [];
    getEventBus().subscribe("menu.category.created", (e) => seen.push(e));
    const res = await app.inject({
      method: "POST",
      url: "/v1/tenants/demo/menu/categories",
      headers: authHeader("manager", "T1"),
      payload: { name: "Starters", type: "main" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ id: expect.any(String), name: "Starters", type: "main" });
    expect(seen).toHaveLength(1);
  });

  it("rejects super_admin (monolith parity — tenant menus are staff-scoped)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/tenants/demo/menu/categories",
      headers: authHeader("super_admin", null),
      payload: { name: "Starters" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("rejects an invalid name", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/tenants/demo/menu/categories",
      headers: authHeader("admin", "T1"),
      payload: { name: "" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("updates a category", async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM tenants")) return { rows: [TENANT] };
      if (sql.includes("UPDATE menu_categories")) return { rows: [], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const res = await app.inject({
      method: "PUT",
      url: "/v1/tenants/demo/menu/categories/c1",
      headers: authHeader("admin", "T1"),
      payload: { name: "Small Plates" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ success: true });
  });

  it("404s when updating a missing category", async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM tenants")) return { rows: [TENANT] };
      return { rows: [], rowCount: 0 };
    });
    const res = await app.inject({
      method: "PUT",
      url: "/v1/tenants/demo/menu/categories/c1",
      headers: authHeader("admin", "T1"),
      payload: { name: "Small Plates" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("deletes a category (admin only) and publishes the event", async () => {
    const seen: unknown[] = [];
    getEventBus().subscribe("menu.category.deleted", (e) => seen.push(e));
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM tenants")) return { rows: [TENANT] };
      if (sql.includes("DELETE FROM menu_categories")) return { rows: [], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const res = await app.inject({
      method: "DELETE",
      url: "/v1/tenants/demo/menu/categories/c1",
      headers: authHeader("admin", "T1"),
    });
    expect(res.statusCode).toBe(200);
    expect(seen).toHaveLength(1);
  });

  it("forbids managers from deleting", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/v1/tenants/demo/menu/categories/c1",
      headers: authHeader("manager", "T1"),
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("items (admin writes)", () => {
  it("creates an item and publishes menu.item.created", async () => {
    const seen: unknown[] = [];
    getEventBus().subscribe("menu.item.created", (e) => seen.push(e));
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM tenants")) return { rows: [TENANT] };
      if (sql.includes("SELECT id FROM menu_categories")) return { rows: [{ id: "c1" }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const res = await app.inject({
      method: "POST",
      url: "/v1/tenants/demo/menu/items",
      headers: authHeader("admin", "T1"),
      payload: { categoryId: "c1", name: "Burger", price: 9.5, available: true },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ id: expect.any(String), name: "Burger", price: 9.5 });
    expect(seen).toHaveLength(1);
  });

  it("rejects an item in a missing category", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/tenants/demo/menu/items",
      headers: authHeader("admin", "T1"),
      payload: { categoryId: "missing", name: "Burger", price: 9.5 },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects a non-positive price", async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM tenants")) return { rows: [TENANT] };
      if (sql.includes("SELECT id FROM menu_categories")) return { rows: [{ id: "c1" }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const res = await app.inject({
      method: "POST",
      url: "/v1/tenants/demo/menu/items",
      headers: authHeader("admin", "T1"),
      payload: { categoryId: "c1", name: "Burger", price: 0 },
    });
    expect(res.statusCode).toBe(400);
  });

  it("updates an item and publishes menu.item.updated", async () => {
    const seen: unknown[] = [];
    getEventBus().subscribe("menu.item.updated", (e) => seen.push(e));
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM tenants")) return { rows: [TENANT] };
      if (sql.includes("UPDATE menu_items")) return { rows: [], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const res = await app.inject({
      method: "PUT",
      url: "/v1/tenants/demo/menu/items/i1",
      headers: authHeader("manager", "T1"),
      payload: { price: 12 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ success: true });
    expect(seen).toHaveLength(1);
  });

  it("updates item translations", async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM tenants")) return { rows: [TENANT] };
      if (sql.includes("UPDATE menu_items")) return { rows: [], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const res = await app.inject({
      method: "PUT",
      url: "/v1/tenants/demo/menu/items/i1/translations",
      headers: authHeader("admin", "T1"),
      payload: { translations: { ar: "برجر" } },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ success: true });
  });

  it("deletes an item", async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM tenants")) return { rows: [TENANT] };
      if (sql.includes("DELETE FROM menu_items")) return { rows: [], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const res = await app.inject({
      method: "DELETE",
      url: "/v1/tenants/demo/menu/items/i1",
      headers: authHeader("admin", "T1"),
    });
    expect(res.statusCode).toBe(200);
  });
});

describe("import + reorder", () => {
  it("imports categories and items, skipping ones without a matching category", async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM tenants")) return { rows: [TENANT] };
      if (sql.includes("SELECT id, name FROM menu_categories")) return { rows: [], rowCount: 0 };
      return { rows: [], rowCount: 1 };
    });
    const res = await app.inject({
      method: "POST",
      url: "/v1/tenants/demo/menu/import",
      headers: authHeader("admin", "T1"),
      payload: {
        categories: [{ name: "Starters" }],
        items: [
          { categoryName: "starters", name: "Burger", price: 9 },
          { categoryName: "Desserts", name: "Cake", price: 5 },
        ],
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      categoriesCreated: 1,
      itemsCreated: 1,
      errors: [expect.stringContaining("Desserts")],
    });
  });

  it("reorders items inside a transaction", async () => {
    const clientQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
    connectMock.mockResolvedValue({ query: clientQuery, release: vi.fn() });
    const res = await app.inject({
      method: "PUT",
      url: "/v1/tenants/demo/menu/reorder",
      headers: authHeader("admin", "T1"),
      payload: { items: [{ id: "i1", sortOrder: 3 }, { id: "i2", sortOrder: 1 }] },
    });
    expect(res.statusCode).toBe(200);
    expect(clientQuery).toHaveBeenCalledWith("BEGIN");
    expect(clientQuery).toHaveBeenCalledWith("COMMIT");
    expect(clientQuery).toHaveBeenCalledTimes(4);
  });
});
