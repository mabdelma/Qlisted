import Fastify from "fastify";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { createLogger, ok, err, verifyHs256, bearer, initSentry, captureError, getEventBus } from "@qlisted/shared";
import type { MonolithClaims } from "@qlisted/shared";

/**
 * CATALOG service — owns each tenant's menu (categories + items). The public
 * reads AND the admin writes are migrated for real from the monolith
 * (mirrors routes/menu.ts). Reads/writes the shared Postgres directly. Auth uses
 * monolith-compatible JWTs (verifyHs256) so cut-over works with existing sessions.
 */
const log = createLogger("catalog");
export const app = Fastify({ loggerInstance: log });
initSentry("catalog");
app.addHook("onError", async (req, _reply, error) => captureError(error, { url: req.url, method: req.method }));
const PORT = Number(process.env.PORT || 8080);

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 });

app.get("/health", async () => ok({ service: "catalog", status: "up" }));
app.get("/ready", async () => {
  try { await pool.query("select 1"); return ok({ ready: true }); }
  catch { return err("db unavailable"); }
});

async function tenantBySlug(slug: string) {
  const r = await pool.query(
    "SELECT id, name, currency FROM tenants WHERE slug = $1 AND is_active = true LIMIT 1",
    [slug],
  );
  return r.rows[0] as { id: string; name: string; currency: string } | undefined;
}

// ── Auth helpers (mirror monolith authMiddleware + requireRole) ──────────────
const STAFF_WRITE = ["admin", "manager"];
const STAFF_DELETE = ["admin"];

/** Returns verified claims or sends an error reply and returns null. */
function authorize(reply: Fastify.Reply, roles: string[], tenantId: string): MonolithClaims | null {
  const claims = verifyHs256(bearer(reply.request.headers.authorization));
  if (!claims) { void reply.code(401).send(err("Authentication required")); return null; }
  if (!roles.includes(String(claims.role))) { void reply.code(403).send(err("Insufficient permissions")); return null; }
  // super_admin has no tenant; everyone else must belong to the target tenant.
  if (claims.tenantId !== null && claims.tenantId !== tenantId) {
    void reply.code(403).send(err("Forbidden"));
    return null;
  }
  return claims;
}

const toCamel = (row: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(row).map(([k, v]) => [k.replace(/_([a-z])/g, (_m, c) => c.toUpperCase()), v]));

// ── Public reads ─────────────────────────────────────────────────────────────
// Full menu (mirror monolith GET /api/r/:slug/menu).
app.get<{ Params: { slug: string } }>("/v1/tenants/:slug/menu", async (req, reply) => {
  const tenant = await tenantBySlug(req.params.slug);
  if (!tenant) return reply.code(404).send(err("Tenant not found"));

  const [cats, items] = await Promise.all([
    pool.query(
      "SELECT id, name, type, parent_id, sort_order, translations FROM menu_categories WHERE tenant_id = $1 ORDER BY sort_order, name",
      [tenant.id],
    ),
    pool.query(
      "SELECT id, category_id, sub_category_id, name, description, price, image_url, available, sort_order, modifiers, translations FROM menu_items WHERE tenant_id = $1 ORDER BY sort_order, name",
      [tenant.id],
    ),
  ]);

  return ok({
    tenant: { slug: req.params.slug, name: tenant.name, currency: tenant.currency },
    categories: cats.rows,
    items: items.rows,
  });
});

// Single item (public read).
app.get<{ Params: { slug: string; id: string } }>("/v1/tenants/:slug/menu/items/:id", async (req, reply) => {
  const tenant = await tenantBySlug(req.params.slug);
  if (!tenant) return reply.code(404).send(err("Tenant not found"));
  const r = await pool.query(
    "SELECT id, category_id, sub_category_id, name, description, price, image_url, available FROM menu_items WHERE tenant_id = $1 AND id = $2 LIMIT 1",
    [tenant.id, req.params.id],
  );
  if (!r.rows[0]) return reply.code(404).send(err("Item not found"));
  return ok(r.rows[0]);
});

// Compat — byte-compatible with the monolith's GET /api/r/:slug/menu.
app.get<{ Params: { slug: string } }>("/compat/menu/:slug", async (req, reply) => {
  const tenant = await tenantBySlug(req.params.slug);
  if (!tenant) return reply.code(404).send(err("Tenant not found"));
  const [cats, items] = await Promise.all([
    pool.query("SELECT * FROM menu_categories WHERE tenant_id = $1 ORDER BY sort_order", [tenant.id]),
    pool.query("SELECT * FROM menu_items WHERE tenant_id = $1 ORDER BY sort_order", [tenant.id]),
  ]);
  return reply.send({ categories: cats.rows.map(toCamel), items: items.rows.map(toCamel) });
});

// ── Categories (admin writes) ────────────────────────────────────────────────
const categorySchema = {
  name: (v: unknown) => typeof v === "string" && v.length >= 1 && v.length <= 100,
  type: (v: unknown) => v === undefined || v === "main" || v === "sub",
  parentId: (v: unknown) => v === undefined || typeof v === "string",
  sortOrder: (v: unknown) => v === undefined || (typeof v === "number" && Number.isInteger(v)),
  translations: (v: unknown) => v === undefined || (typeof v === "object" && v !== null),
} as const;

app.post<{ Params: { slug: string }; Body: Record<string, unknown> }>("/v1/tenants/:slug/menu/categories", async (req, reply) => {
  const tenant = await tenantBySlug(req.params.slug);
  if (!tenant) return reply.code(404).send(err("Tenant not found"));
  const claims = authorize(reply, STAFF_WRITE, tenant.id);
  if (!claims) return;

  const b = req.body || {};
  if (!categorySchema.name(b.name)) return reply.code(400).send(err("name is required (1-100 chars)"));
  if (!categorySchema.type(b.type) || !categorySchema.parentId(b.parentId) || !categorySchema.sortOrder(b.sortOrder)) {
    return reply.code(400).send(err("invalid category payload"));
  }
  const id = randomUUID();
  await pool.query(
    "INSERT INTO menu_categories (id, tenant_id, name, type, parent_id, sort_order, translations) VALUES ($1,$2,$3,$4,$5,$6,$7)",
    [id, tenant.id, b.name, b.type ?? "main", b.parentId ?? null, b.sortOrder ?? 0,
      b.translations != null ? JSON.stringify(b.translations) : null],
  );
  void getEventBus().publish({ type: "menu.category.created", categoryId: id, tenantId: tenant.id, name: String(b.name) }).catch(() => {});
  log.info({ tenantId: tenant.id, categoryId: id }, "Menu category created");
  return reply.code(201).send({ id, ...b });
});

app.put<{ Params: { slug: string; categoryId: string }; Body: Record<string, unknown> }>("/v1/tenants/:slug/menu/categories/:categoryId", async (req, reply) => {
  const tenant = await tenantBySlug(req.params.slug);
  if (!tenant) return reply.code(404).send(err("Tenant not found"));
  const claims = authorize(reply, STAFF_WRITE, tenant.id);
  if (!claims) return;

  const b = req.body || {};
  if (!categorySchema.name(b.name)) return reply.code(400).send(err("name is required (1-100 chars)"));
  if (!categorySchema.type(b.type) || !categorySchema.parentId(b.parentId) || !categorySchema.sortOrder(b.sortOrder)) {
    return reply.code(400).send(err("invalid category payload"));
  }
  const r = await pool.query(
    "UPDATE menu_categories SET name=$3, type=$4, parent_id=$5, sort_order=$6, translations=$7 WHERE id=$1 AND tenant_id=$2",
    [req.params.categoryId, tenant.id, b.name, b.type ?? "main", b.parentId ?? null, b.sortOrder ?? 0,
      b.translations != null ? JSON.stringify(b.translations) : null],
  );
  if (r.rowCount === 0) return reply.code(404).send(err("Category not found"));
  void getEventBus().publish({ type: "menu.category.updated", categoryId: req.params.categoryId, tenantId: tenant.id }).catch(() => {});
  return reply.send({ success: true });
});

app.delete<{ Params: { slug: string; categoryId: string } }>("/v1/tenants/:slug/menu/categories/:categoryId", async (req, reply) => {
  const tenant = await tenantBySlug(req.params.slug);
  if (!tenant) return reply.code(404).send(err("Tenant not found"));
  const claims = authorize(reply, STAFF_DELETE, tenant.id);
  if (!claims) return;
  const r = await pool.query(
    "DELETE FROM menu_categories WHERE id=$1 AND tenant_id=$2",
    [req.params.categoryId, tenant.id],
  );
  if (r.rowCount === 0) return reply.code(404).send(err("Category not found"));
  void getEventBus().publish({ type: "menu.category.deleted", categoryId: req.params.categoryId, tenantId: tenant.id }).catch(() => {});
  return reply.send({ success: true });
});

// ── Items (admin writes) ─────────────────────────────────────────────────────
const itemSchema = {
  categoryId: (v: unknown) => typeof v === "string" && v.length >= 1,
  subCategoryId: (v: unknown) => v === undefined || typeof v === "string",
  name: (v: unknown) => typeof v === "string" && v.length >= 1 && v.length <= 200,
  description: (v: unknown) => v === undefined || typeof v === "string",
  price: (v: unknown) => typeof v === "number" && v > 0,
  imageUrl: (v: unknown) => v === undefined || v === null || typeof v === "string",
  available: (v: unknown) => v === undefined || typeof v === "boolean",
  sortOrder: (v: unknown) => v === undefined || (typeof v === "number" && Number.isInteger(v)),
  modifiers: (v: unknown) => v === undefined || typeof v === "string",
  translations: (v: unknown) => v === undefined || (typeof v === "object" && v !== null),
} as const;

app.post<{ Params: { slug: string }; Body: Record<string, unknown> }>("/v1/tenants/:slug/menu/items", async (req, reply) => {
  const tenant = await tenantBySlug(req.params.slug);
  if (!tenant) return reply.code(404).send(err("Tenant not found"));
  const claims = authorize(reply, STAFF_WRITE, tenant.id);
  if (!claims) return;

  const b = req.body || {};
  if (!itemSchema.categoryId(b.categoryId) || !itemSchema.name(b.name) || !itemSchema.price(b.price)) {
    return reply.code(400).send(err("categoryId, name and a positive price are required"));
  }
  if (!itemSchema.subCategoryId(b.subCategoryId) || !itemSchema.description(b.description) ||
      !itemSchema.imageUrl(b.imageUrl) || !itemSchema.available(b.available) ||
      !itemSchema.sortOrder(b.sortOrder) || !itemSchema.modifiers(b.modifiers) || !itemSchema.translations(b.translations)) {
    return reply.code(400).send(err("invalid item payload"));
  }
  const cat = await pool.query("SELECT id FROM menu_categories WHERE id=$1 AND tenant_id=$2 LIMIT 1", [b.categoryId, tenant.id]);
  if (!cat.rows[0]) return reply.code(400).send(err("Category not found in this restaurant"));

  const id = randomUUID();
  await pool.query(
    `INSERT INTO menu_items (id, tenant_id, category_id, sub_category_id, name, description, price, image_url, available, sort_order, modifiers, translations)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [id, tenant.id, b.categoryId, b.subCategoryId ?? null, b.name, b.description ?? null, b.price,
      b.imageUrl ?? null, b.available ?? true, b.sortOrder ?? 0, b.modifiers ?? null,
      b.translations != null ? JSON.stringify(b.translations) : null],
  );
  void getEventBus().publish({ type: "menu.item.created", itemId: id, tenantId: tenant.id, name: String(b.name) }).catch(() => {});
  log.info({ tenantId: tenant.id, itemId: id }, "Menu item created");
  return reply.code(201).send({ id, ...b });
});

const updateItemFields = ["name", "description", "price", "categoryId", "available", "imageUrl", "subCategoryId", "sortOrder", "modifiers"] as const;

app.put<{ Params: { slug: string; itemId: string }; Body: Record<string, unknown> }>("/v1/tenants/:slug/menu/items/:itemId", async (req, reply) => {
  const tenant = await tenantBySlug(req.params.slug);
  if (!tenant) return reply.code(404).send(err("Tenant not found"));
  const claims = authorize(reply, STAFF_WRITE, tenant.id);
  if (!claims) return;

  const b = req.body || {};
  if (b.name !== undefined && !(typeof b.name === "string" && b.name.length >= 1 && b.name.length <= 200)) {
    return reply.code(400).send(err("name must be 1-200 chars"));
  }
  if (b.price !== undefined && !(typeof b.price === "number" && b.price > 0)) {
    return reply.code(400).send(err("price must be positive"));
  }
  if (b.categoryId !== undefined) {
    if (typeof b.categoryId !== "string") return reply.code(400).send(err("invalid categoryId"));
    const cat = await pool.query("SELECT id FROM menu_categories WHERE id=$1 AND tenant_id=$2 LIMIT 1", [b.categoryId, tenant.id]);
    if (!cat.rows[0]) return reply.code(400).send(err("Category not found in this restaurant"));
  }

  const set = updateItemFields.filter((f) => b[f] !== undefined)
    .map((f) => `${f === "categoryId" ? "category_id" : f === "subCategoryId" ? "sub_category_id" : f === "imageUrl" ? "image_url" : f === "sortOrder" ? "sort_order" : f} = $${f}`);
  if (set.length === 0) return reply.send({ success: true });
  const values = updateItemFields.filter((f) => b[f] !== undefined).map((f) => b[f]);
  const r = await pool.query(
    `UPDATE menu_items SET ${set.join(", ")} WHERE id=$${set.length + 1} AND tenant_id=$${set.length + 2}`,
    [...values, req.params.itemId, tenant.id],
  );
  if (r.rowCount === 0) return reply.code(404).send(err("Item not found"));
  void getEventBus().publish({ type: "menu.item.updated", itemId: req.params.itemId, tenantId: tenant.id }).catch(() => {});
  return reply.send({ success: true });
});

app.delete<{ Params: { slug: string; itemId: string } }>("/v1/tenants/:slug/menu/items/:itemId", async (req, reply) => {
  const tenant = await tenantBySlug(req.params.slug);
  if (!tenant) return reply.code(404).send(err("Tenant not found"));
  const claims = authorize(reply, STAFF_DELETE, tenant.id);
  if (!claims) return;
  const r = await pool.query("DELETE FROM menu_items WHERE id=$1 AND tenant_id=$2", [req.params.itemId, tenant.id]);
  if (r.rowCount === 0) return reply.code(404).send(err("Item not found"));
  void getEventBus().publish({ type: "menu.item.deleted", itemId: req.params.itemId, tenantId: tenant.id }).catch(() => {});
  return reply.send({ success: true });
});

// ── Translations (item + category) ───────────────────────────────────────────
const translationsSchema = (v: unknown) => v !== undefined && typeof v === "object" && v !== null;

app.put<{ Params: { slug: string; itemId: string }; Body: Record<string, unknown> }>("/v1/tenants/:slug/menu/items/:itemId/translations", async (req, reply) => {
  const tenant = await tenantBySlug(req.params.slug);
  if (!tenant) return reply.code(404).send(err("Tenant not found"));
  const claims = authorize(reply, STAFF_WRITE, tenant.id);
  if (!claims) return;
  if (!translationsSchema(req.body?.translations)) return reply.code(400).send(err("translations object required"));
  const r = await pool.query(
    "UPDATE menu_items SET translations=$3 WHERE id=$1 AND tenant_id=$2",
    [req.params.itemId, tenant.id, JSON.stringify(req.body!.translations)],
  );
  if (r.rowCount === 0) return reply.code(404).send(err("Item not found"));
  void getEventBus().publish({ type: "menu.item.updated", itemId: req.params.itemId, tenantId: tenant.id }).catch(() => {});
  return reply.send({ success: true });
});

app.put<{ Params: { slug: string; categoryId: string }; Body: Record<string, unknown> }>("/v1/tenants/:slug/menu/categories/:categoryId/translations", async (req, reply) => {
  const tenant = await tenantBySlug(req.params.slug);
  if (!tenant) return reply.code(404).send(err("Tenant not found"));
  const claims = authorize(reply, STAFF_WRITE, tenant.id);
  if (!claims) return;
  if (!translationsSchema(req.body?.translations)) return reply.code(400).send(err("translations object required"));
  const r = await pool.query(
    "UPDATE menu_categories SET translations=$3 WHERE id=$1 AND tenant_id=$2",
    [req.params.categoryId, tenant.id, JSON.stringify(req.body!.translations)],
  );
  if (r.rowCount === 0) return reply.code(404).send(err("Category not found"));
  void getEventBus().publish({ type: "menu.category.updated", categoryId: req.params.categoryId, tenantId: tenant.id }).catch(() => {});
  return reply.send({ success: true });
});

// ── Bulk import ──────────────────────────────────────────────────────────────
app.post<{ Params: { slug: string }; Body: Record<string, unknown> }>("/v1/tenants/:slug/menu/import", async (req, reply) => {
  const tenant = await tenantBySlug(req.params.slug);
  if (!tenant) return reply.code(404).send(err("Tenant not found"));
  const claims = authorize(reply, STAFF_WRITE, tenant.id);
  if (!claims) return;

  const b = req.body || {};
  const categories = Array.isArray(b.categories) ? b.categories : [];
  const items = Array.isArray(b.items) ? b.items : [];
  if (items.length === 0) return reply.code(400).send(err("items array required"));

  const results = { categoriesCreated: 0, itemsCreated: 0, errors: [] as string[] };
  const categoryMap = new Map<string, string>();
  const existing = await pool.query("SELECT id, name FROM menu_categories WHERE tenant_id=$1", [tenant.id]);
  for (const c of existing.rows) categoryMap.set(String(c.name).toLowerCase(), c.id);

  for (const cat of categories as { name?: unknown }[]) {
    if (typeof cat.name !== "string") continue;
    const key = cat.name.toLowerCase();
    if (categoryMap.has(key)) continue;
    const id = randomUUID();
    await pool.query(
      "INSERT INTO menu_categories (id, tenant_id, name, type, sort_order) VALUES ($1,$2,$3,$4,$5)",
      [id, tenant.id, cat.name, "main", 0],
    );
    categoryMap.set(key, id);
    results.categoriesCreated++;
  }

  for (const item of items as { name?: unknown; price?: unknown; categoryName?: unknown; description?: unknown; available?: unknown; sortOrder?: unknown; imageUrl?: unknown }[]) {
    const catKey = typeof item.categoryName === "string" ? item.categoryName.toLowerCase() : "";
    const categoryId = categoryMap.get(catKey);
    if (!categoryId) {
      results.errors.push(`Category "${String(item.categoryName)}" not found for item "${String(item.name)}"`);
      continue;
    }
    if (typeof item.name !== "string" || typeof item.price !== "number") {
      results.errors.push(`Item "${String(item.name)}" is missing a name or price`);
      continue;
    }
    await pool.query(
      `INSERT INTO menu_items (id, tenant_id, category_id, name, description, price, available, sort_order, image_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [randomUUID(), tenant.id, categoryId, item.name, item.description ?? null, item.price,
       item.available ?? true, item.sortOrder ?? 0, item.imageUrl ?? null],
    );
    results.itemsCreated++;
  }

  log.info({ tenantId: tenant.id, results }, "Menu import completed");
  return reply.code(201).send(results);
});

// ── Batch reorder ────────────────────────────────────────────────────────────
app.put<{ Params: { slug: string }; Body: { items?: { id?: string; sortOrder?: number }[] } }>("/v1/tenants/:slug/menu/reorder", async (req, reply) => {
  const tenant = await tenantBySlug(req.params.slug);
  if (!tenant) return reply.code(404).send(err("Tenant not found"));
  const claims = authorize(reply, STAFF_WRITE, tenant.id);
  if (!claims) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const it of (req.body?.items || [])) {
      if (!it.id || typeof it.sortOrder !== "number") continue;
      await client.query("UPDATE menu_items SET sort_order=$1 WHERE id=$2 AND tenant_id=$3", [it.sortOrder, it.id, tenant.id]);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  return reply.send({ success: true });
});

app.put<{ Params: { slug: string }; Body: { categories?: { id?: string; sortOrder?: number }[] } }>("/v1/tenants/:slug/menu/categories/reorder", async (req, reply) => {
  const tenant = await tenantBySlug(req.params.slug);
  if (!tenant) return reply.code(404).send(err("Tenant not found"));
  const claims = authorize(reply, STAFF_WRITE, tenant.id);
  if (!claims) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const c of (req.body?.categories || [])) {
      if (!c.id || typeof c.sortOrder !== "number") continue;
      await client.query("UPDATE menu_categories SET sort_order=$1 WHERE id=$2 AND tenant_id=$3", [c.sortOrder, c.id, tenant.id]);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  return reply.send({ success: true });
});

if (process.env.NODE_ENV !== "test") {
  app.listen({ port: PORT, host: "0.0.0.0" }).then(() => log.info(`catalog on :${PORT}`));
}
