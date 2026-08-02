import OpenAI from 'openai';
import { eq, sql } from 'drizzle-orm';
import crypto from 'node:crypto';
import { db, schema } from '../db/index.js';
import { computePnL } from './reportService.js';
import { getInsights } from './forecastService.js';
import { getLowStockItems } from './inventoryService.js';
import { suggestReorder, createPurchaseOrder } from './procurementService.js';
import { classifyIntent, evaluateDone, suggestNextStep, loadConversation, saveConversation } from './aiConversation.js';
import { logger } from '../lib/logger.js';

// LLM provider. Defaults to OpenAI, but set OPENAI_BASE_URL to point at any local,
// self-hosted, OpenAI-compatible server (Ollama http://host:11434/v1, llama.cpp,
// vLLM, LM Studio) and OPENAI_MODEL to a local model (e.g. llama3.1) — no API key
// needed for a local endpoint, and no data leaves your infrastructure.
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const BASE_URL = process.env.OPENAI_BASE_URL;

function getClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (BASE_URL) return new OpenAI({ apiKey: key || 'local', baseURL: BASE_URL });
  return key ? new OpenAI({ apiKey: key }) : null;
}

export function aiEnabled(): boolean {
  return !!(process.env.OPENAI_API_KEY || BASE_URL);
}

export interface ChatTurn { role: 'user' | 'assistant'; content: string }

// ── Shared block payloads returned to the client so the chat UI can render
// rich cards (menu items, live cart) instead of raw text. ──────────────────────
export interface AiBlockMenuCategory { id: string; name: string; items: { id: string; name: string; price: number; description?: string | null; imageUrl?: string | null }[] }
export type AiBlock =
  | { type: 'menu'; categories: AiBlockMenuCategory[] }
  | { type: 'cart'; items: CartLine[]; total: number };

// ── Customer session cart ─────────────────────────────────────────────────────
// The assistant can add/remove items on the guest's behalf. The client's cart
// is the source of truth (seeded here on first contact), then the server mirror
// carries the conversation's changes and returns them so the UI can sync.
export interface CartLine {
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  imageUrl?: string | null;
}

export interface CustomerContext {
  cart?: CartLine[];
  orderToken?: string;
  orderId?: string;
  locale?: string;
  isMobile?: boolean;
}

// ── Admin copilot: tenant-scoped tools over the restaurant's own data ───────
const adminTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_pnl',
      description: 'Profit & loss / sales summary for THIS restaurant over an optional ISO date range. Returns gross/net revenue, refunds, COGS, gross profit, tax, tips, service charge, order count, average order value, and revenue by payment method.',
      parameters: { type: 'object', properties: { start: { type: 'string', description: 'ISO start datetime (optional)' }, end: { type: 'string', description: 'ISO end datetime (optional)' } } },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_popular_items',
      description: 'Top-selling menu items by quantity for THIS restaurant.',
      parameters: { type: 'object', properties: { limit: { type: 'integer', description: 'Max rows (default 10)' } } },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_menu',
      description: "List THIS restaurant's menu categories and items with prices, availability, and descriptions.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_recent_orders',
      description: 'Recent orders for THIS restaurant with status, payment status, total, and item count.',
      parameters: { type: 'object', properties: { limit: { type: 'integer', description: 'Max rows (default 10)' } } },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_insights',
      description: 'Forward-looking insights: 7-day revenue forecast, low-stock reorder suggestions, churn-risk customers, and top customers by lifetime value.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_low_stock',
      description: 'Stock items at or below their minimum level (need reordering), with current/min quantities and unit cost.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_tables',
      description: "Live floor status for THIS restaurant's tables: number, capacity, status, plus currently open (unpaid) orders per table.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_staff',
      description: "THIS restaurant's staff: name, email, role, whether active, and last activity.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_reservations',
      description: 'Reservations for THIS restaurant, optionally filtered by date (YYYY-MM-DD) and/or status (pending, confirmed, seated, cancelled, no_show).',
      parameters: { type: 'object', properties: { date: { type: 'string', description: 'ISO date (YYYY-MM-DD, optional)' }, status: { type: 'string', description: 'Reservation status (optional)' } } },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_loyalty',
      description: 'Loyalty program status for THIS restaurant: total points, lifetime points, tier, and recent earn/redeem transactions.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_reorder',
      description: 'ACTION: create a purchase order that restocks every low-stock item (top up to ~2x minimum). Use only when the user asks you to reorder/restock. Returns the new PO id and total. The order is recorded for the manager to review and receive — no payment is taken.',
      parameters: { type: 'object', properties: {} },
    },
  },
];

async function runAdminTool(tenantId: string, tenantName: string, currency: string, name: string, input: Record<string, unknown>): Promise<string> {
  switch (name) {
    case 'get_insights':
      return JSON.stringify(await getInsights(tenantId, tenantName, currency));
    case 'get_low_stock':
      return JSON.stringify(await getLowStockItems(tenantId));
    case 'create_reorder': {
      const items = await suggestReorder(tenantId);
      if (items.length === 0) return JSON.stringify({ ok: false, message: 'Nothing is low on stock — no reorder needed.' });
      const r = await createPurchaseOrder(tenantId, { items: items.map((s) => ({ stockItemId: s.stockItemId, name: s.name, quantity: s.quantity, unitCost: s.unitCost })) });
      if ('error' in r) return JSON.stringify({ ok: false, error: r.error });
      return JSON.stringify({ ok: true, purchaseOrderId: r.data.id, total: r.data.total, lines: items.length });
    }
    case 'get_pnl':
      return JSON.stringify(await computePnL(tenantId, input.start as string | undefined, input.end as string | undefined));
    case 'get_popular_items': {
      const limit = Math.min(Number(input.limit) || 10, 50);
      const r = await db.execute(sql`
        SELECT mi.name, SUM(oi.quantity)::int AS quantity, SUM(oi.quantity * oi.unit_price)::float AS revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN menu_items mi ON mi.id = oi.menu_item_id
        WHERE o.tenant_id = ${tenantId}
        GROUP BY mi.name ORDER BY quantity DESC LIMIT ${limit}`);
      return JSON.stringify(r.rows);
    }
    case 'get_menu': {
      const categories = await db.select().from(schema.menuCategories).where(eq(schema.menuCategories.tenantId, tenantId));
      const items = await db.select().from(schema.menuItems).where(eq(schema.menuItems.tenantId, tenantId));
      return JSON.stringify({ categories, items });
    }
    case 'get_recent_orders': {
      const limit = Math.min(Number(input.limit) || 10, 50);
      const r = await db.execute(sql`
        SELECT id, status, payment_status, total::float AS total, item_count, created_at
        FROM orders WHERE tenant_id = ${tenantId} ORDER BY created_at DESC LIMIT ${limit}`);
      return JSON.stringify(r.rows);
    }
    case 'get_tables': {
      const tables = await db.execute(sql`SELECT id, number, capacity, status FROM tables WHERE tenant_id = ${tenantId} ORDER BY number`);
      const openOrders = await db.execute(sql`
        SELECT table_id, status, payment_status, total::float AS total
        FROM orders
        WHERE tenant_id = ${tenantId} AND status IN ('pending', 'preparing') AND payment_status != 'paid'
        ORDER BY created_at DESC`);
      return JSON.stringify({ tables: tables.rows, openOrders: openOrders.rows });
    }
    case 'get_staff': {
      const r = await db.execute(sql`
        SELECT id, name, email, role, is_active, last_active
        FROM users WHERE tenant_id = ${tenantId} AND role != 'super_admin' ORDER BY name`);
      return JSON.stringify(r.rows);
    }
    case 'get_reservations': {
      const conds = [sql`tenant_id = ${tenantId}`];
      if (input.date) conds.push(sql`date = ${String(input.date)}`);
      if (input.status) conds.push(sql`status = ${String(input.status)}`);
      const r = await db.execute(sql`
        SELECT * FROM reservations WHERE ${sql.join(conds, sql` AND `)}
        ORDER BY date, time`);
      return JSON.stringify(r.rows);
    }
    case 'get_loyalty': {
      const summary = await db.select().from(schema.loyaltySummary).where(eq(schema.loyaltySummary.tenantId, tenantId)).limit(1);
      const txs = await db.select().from(schema.loyaltyTransactions).where(eq(schema.loyaltyTransactions.tenantId, tenantId)).orderBy(sql`created_at DESC`).limit(20);
      return JSON.stringify({ summary: summary[0] ?? null, recentTransactions: txs });
    }
    default:
      return JSON.stringify({ error: `unknown tool: ${name}` });
  }
}

export async function adminCopilot(tenantId: string, tenantName: string, currency: string, history: ChatTurn[]) {
  const client = getClient();
  if (!client) return { error: 'AI assistant not configured (set OPENAI_API_KEY, or OPENAI_BASE_URL for a local model)', status: 501 as const };

  const system = `You are Qlisted Copilot — the AI operations assistant built into the Qlisted restaurant platform, helping the owner/manager of "${tenantName}" run their restaurant. Currency: ${currency}.\n`
    + `• Always call the provided tools to fetch REAL data (sales, orders, menu, tables, staff, reservations, loyalty) before answering with figures — never invent numbers, names, or dates.\n`
    + `• Be concise, concrete and ACTIONABLE: surface trends, flag problems (slow sellers, low stock, no-shows, drop in revenue), and suggest the next step a busy operator can take right now.\n`
    + `• You can look ahead with get_insights (revenue forecast, churn-risk customers, reorder needs, and — for hotels — room occupancy and upcoming room revenue) and you can ACT: when asked to reorder/restock, call create_reorder to raise a purchase order for everything that's low — then tell the owner the PO id and total so they can review and receive it. Never take payment.\n`
    + `• Format every monetary value in ${currency}; round sensibly and show short totals.\n`
    + `• You can also draft menu descriptions, promo/marketing copy, staff notices, and customer email in this restaurant's voice when asked.\n`
    + `• You ONLY ever have access to this one restaurant's data ("${tenantName}") — never mention or compare other restaurants.\n`
    + `• Reply in the SAME language the user writes in (Qlisted serves English, Español, Français, Deutsch, Português, Italiano, العربية, हिन्दी, 中文, 日本語, Русский, and more).\n`
    + `Tone: warm but efficient — a sharp operations manager who knows this restaurant inside out.`;

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: system },
    ...history.map((m) => ({ role: m.role, content: m.content }) as OpenAI.Chat.Completions.ChatCompletionMessageParam),
  ];

  // Manual tool-use loop (bounded).
  for (let i = 0; i < 6; i++) {
    const resp = await client.chat.completions.create({ model: MODEL, messages, tools: adminTools, max_tokens: 1024 });
    const msg = resp.choices[0]?.message;
    if (!msg) break;
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      messages.push(msg);
      for (const tc of msg.tool_calls) {
        if (tc.type !== 'function') continue;
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(tc.function.arguments || '{}'); } catch { /* ignore bad args */ }
        let out: string;
        try { out = await runAdminTool(tenantId, tenantName, currency, tc.function.name, args); }
        catch (e) { out = JSON.stringify({ error: (e as Error).message }); }
        messages.push({ role: 'tool', tool_call_id: tc.id, content: out });
      }
      continue;
    }
    return { data: { reply: (msg.content || '').trim() || '(no response)' }, status: 200 as const };
  }
  logger.warn({ tenantId }, 'admin copilot hit tool-loop limit');
  return { data: { reply: 'Sorry — I could not complete that request.' }, status: 200 as const };
}

// ── Customer chat: tool-use over the menu + a session cart ───────────────────
const customerTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_menu',
      description: "List the restaurant's available menu items by category with prices and descriptions. Call this before recommending anything.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'restaurant_info',
      description: 'Basic info about the restaurant: address, phone, hours, and order types (dine-in/takeout/delivery).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_to_cart',
      description: "Add a menu item to the guest's cart by exact name. Only add items that appear in the menu.",
      parameters: { type: 'object', properties: { item_name: { type: 'string', description: 'Exact menu item name' }, quantity: { type: 'integer', description: 'How many to add (default 1)', minimum: 1 } }, required: ['item_name'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remove_from_cart',
      description: "Remove a menu item from the guest's cart by name.",
      parameters: { type: 'object', properties: { item_name: { type: 'string', description: 'Menu item name to remove' } }, required: ['item_name'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_cart',
      description: "Read back what's currently in the guest's cart and the running total.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_order_status',
      description: 'Check the status of the guest’s latest order (in the kitchen, ready, etc.). Call when they ask where their order is.',
      parameters: { type: 'object', properties: {} },
    },
  },
];

interface CustomerToolCtx {
  tenantId: string;
  tenantName: string;
  currency: string;
  phone?: string | null;
  address?: string | null;
  venueType?: string;
  context: CustomerContext;
  cart: { lines: CartLine[]; total: number };
  menuSnapshot: AiBlockMenuCategory[] | null;
}

function findMenuItemByName(tenantId: string, name: string) {
  return db.execute(sql`
    SELECT * FROM menu_items
    WHERE tenant_id = ${tenantId} AND available = true
      AND (LOWER(name) = LOWER(${name}) OR LOWER(name) LIKE LOWER(${name}) || '%')
    ORDER BY (LOWER(name) = LOWER(${name})) DESC, sort_order
    LIMIT 1`).then((r) => r.rows[0] as (Record<string, unknown> | undefined));
}

async function runCustomerTool(name: string, input: Record<string, unknown>, ctx: CustomerToolCtx): Promise<string> {
  const cart = ctx.cart;
  switch (name) {
    case 'get_menu': {
      const cats = await db.select().from(schema.menuCategories).where(eq(schema.menuCategories.tenantId, ctx.tenantId)).orderBy(sql`sort_order`);
      const items = await db.select().from(schema.menuItems).where(eq(schema.menuItems.tenantId, ctx.tenantId));
      ctx.menuSnapshot = cats.map((c) => ({
        id: c.id,
        name: c.name,
        items: items
          .filter((i) => i.categoryId === c.id && i.available)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((i) => ({ id: i.id, name: i.name, price: Number(i.price), description: i.description, imageUrl: i.imageUrl })),
      })).filter((c) => c.items.length > 0);
      const text = ctx.menuSnapshot
        .map((c) => `${c.name}:\n${c.items.map((i) => `- ${i.name} — ${ctx.currency} ${i.price.toFixed(2)}${i.description ? `: ${i.description}` : ''}`).join('\n')}`)
        .join('\n\n');
      return text || '(menu unavailable)';
    }
    case 'restaurant_info': {
      return JSON.stringify({ name: ctx.tenantName, currency: ctx.currency, phone: ctx.phone ?? null, address: ctx.address ?? null, venueType: ctx.venueType ?? 'restaurant' });
    }
    case 'add_to_cart': {
      const itemName = String(input.item_name ?? '').trim();
      if (!itemName) return JSON.stringify({ ok: false, message: 'No item name given.' });
      const item = await findMenuItemByName(ctx.tenantId, itemName);
      if (!item) return JSON.stringify({ ok: false, message: `No menu item found matching "${itemName}".` });
      const qty = Math.max(1, Math.min(99, Math.floor(Number(input.quantity) || 1)));
      const price = Number(item.price) || 0;
      const existing = cart.lines.find((l) => l.menuItemId === item.id);
      if (existing) {
        existing.quantity += qty;
        cart.total += price * qty;
      } else {
        cart.lines.push({ menuItemId: String(item.id), name: String(item.name), quantity: qty, unitPrice: price, imageUrl: (item.imageUrl as string | null) ?? null });
        cart.total += price * qty;
      }
      return JSON.stringify({ ok: true, added: String(item.name), quantity: qty, cartTotal: cart.total });
    }
    case 'remove_from_cart': {
      const itemName = String(input.item_name ?? '').trim();
      const targets = cart.lines.filter((l) => l.name.toLowerCase() === itemName.toLowerCase());
      if (targets.length === 0) return JSON.stringify({ ok: false, message: `"${itemName}" is not in the cart.` });
      for (const t of targets) {
        cart.total -= t.quantity * t.unitPrice;
        cart.lines.splice(cart.lines.indexOf(t), 1);
      }
      return JSON.stringify({ ok: true, removed: itemName, cartTotal: cart.total });
    }
    case 'read_cart':
      return JSON.stringify({ items: cart.lines, total: cart.total });
    case 'get_order_status': {
      const orderId = String(input.order_id ?? ctx.context.orderId ?? '').trim();
      if (!orderId) return JSON.stringify({ ok: false, message: 'No order to check yet — the guest has not placed one.' });
      const r = await db.execute(sql`
        SELECT id, status, payment_status, total::float AS total, item_count, created_at
        FROM orders WHERE id = ${orderId} AND tenant_id = ${ctx.tenantId}`);
      const order = r.rows[0];
      if (!order) return JSON.stringify({ ok: false, message: 'Order not found.' });
      const items = await db.execute(sql`SELECT name, quantity, unit_price::float AS unit_price FROM order_items WHERE order_id = ${orderId}`);
      return JSON.stringify({ ...order, items: items.rows });
    }
    default:
      return JSON.stringify({ error: `unknown tool: ${name}` });
  }
}

export async function customerChat(tenantId: string, tenantName: string, currency: string, history: ChatTurn[], context: CustomerContext = {}) {
  const client = getClient();
  if (!client) return { error: 'AI assistant not configured', status: 501 as const };

  const orderToken = context.orderToken || crypto.randomUUID();
  const convo = await loadConversation(orderToken, context);
  // Seed the persistent history from the client on first contact so the displayed
  // conversation and the stored one stay in sync.
  if (convo.messages.length === 0 && history.length > 0) {
    convo.messages = history.map((m) => ({ role: m.role, content: m.content }));
  }
  const cart = convo.cart;

  const cartText = cart.lines.length > 0
    ? cart.lines.map((l) => `- ${l.quantity} × ${l.name} — ${currency} ${l.unitPrice.toFixed(2)}`).join('\n') + `\nTotal: ${currency} ${cart.total.toFixed(2)}`
    : '(empty)';

  const system = `You are the friendly ordering assistant for "${tenantName}", powered by Qlisted. You help guests decide what to eat and drink, and can act on their order.\n`
    + `• Always call get_menu to see what's actually available — never invent dishes, prices, or ingredients.\n`
    + `• Match the guest's cravings, budget and dietary needs (vegetarian, vegan, gluten-free, spice level, common allergens), and when it feels natural, gently suggest one pairing or popular add-on — never pushy.\n`
    + `• You CAN act on the order: call add_to_cart (exact item name from the menu) when the guest asks for an item, remove_from_cart to take something off, and read_cart to confirm what's in their order. The changes appear in the on-screen cart.\n`
    + `• Keep building the order until the guest says they're done or want to check out. When they do, confirm the total and tell them to review it and pay on screen.\n`
    + `• You cannot take payment. Call get_order_status only to track an order they already placed.\n`
    + `• Keep replies short, warm and easy to skim; prices are in ${currency}.\n`
    + `• Reply in the SAME language the guest writes in.\n\nCURRENT CART:\n${cartText}`;

  const llmMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: system },
    ...convo.messages.slice(-20).map((m) => ({ role: m.role, content: m.content }) as OpenAI.Chat.Completions.ChatCompletionMessageParam),
  ];

  const ctx: CustomerToolCtx = {
    tenantId,
    tenantName,
    currency,
    phone: null,
    address: null,
    venueType: 'restaurant',
    context,
    cart,
    menuSnapshot: null,
  };
  // Enrich with tenant contact info for restaurant_info.
  const tenant = await db.select().from(schema.tenants).where(eq(schema.tenants.id, tenantId)).limit(1);
  if (tenant[0]) {
    ctx.phone = tenant[0].phone;
    ctx.address = tenant[0].address;
    ctx.venueType = tenant[0].venueType;
  }

  let touchedCart = false;
  let reply = '(no response)';
  for (let i = 0; i < 6; i++) {
    const resp = await client.chat.completions.create({ model: MODEL, messages: llmMessages, tools: customerTools, max_tokens: 700 });
    const msg = resp.choices[0]?.message;
    if (!msg) break;
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      llmMessages.push(msg);
      for (const tc of msg.tool_calls) {
        if (tc.type !== 'function') continue;
        if (tc.function.name === 'add_to_cart' || tc.function.name === 'remove_from_cart' || tc.function.name === 'read_cart') touchedCart = true;
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(tc.function.arguments || '{}'); } catch { /* ignore bad args */ }
        let out: string;
        try { out = await runCustomerTool(tc.function.name, args, ctx); }
        catch (e) { out = JSON.stringify({ error: (e as Error).message }); }
        llmMessages.push({ role: 'tool', tool_call_id: tc.id, content: out });
      }
      continue;
    }
    reply = (msg.content || '').trim() || '(no response)';
    break;
  }

  const blocks: AiBlock[] = [];
  if (ctx.menuSnapshot) blocks.push({ type: 'menu', categories: ctx.menuSnapshot });
  if (touchedCart) blocks.push({ type: 'cart', items: cart.lines, total: cart.total });

  // Conversation manager: classify the guest's latest message, keep the in-flight
  // task (e.g. build an order) alive across turns, and suggest a follow-up chip.
  const lastUserText = history.length > 0 ? history[history.length - 1].content : '';
  const freshTask = classifyIntent(lastUserText);
  const taskId = freshTask === 'general' && convo.task ? convo.task.id : freshTask;
  convo.task = { id: taskId };
  convo.done = evaluateDone(taskId, lastUserText);
  convo.nextStep = suggestNextStep(taskId, convo.done);

  convo.messages.push({ role: 'assistant', content: reply });
  await saveConversation(convo);

  return {
    data: {
      reply,
      orderToken,
      cart: { items: cart.lines, total: cart.total },
      blocks,
      task: convo.task,
      done: convo.done,
      nextStep: convo.nextStep,
    },
    status: 200 as const,
  };
}

async function buildMenuText(tenantId: string, currency: string): Promise<string> {
  const cats = await db.select().from(schema.menuCategories).where(eq(schema.menuCategories.tenantId, tenantId));
  const items = await db.select().from(schema.menuItems).where(eq(schema.menuItems.tenantId, tenantId));
  const catName = new Map(cats.map((c) => [c.id, c.name]));
  return items
    .filter((i) => i.available)
    .map((i) => `- ${i.name} (${catName.get(i.categoryId) || 'Other'}) — ${currency} ${Number(i.price).toFixed(2)}${i.description ? `: ${i.description}` : ''}`)
    .join('\n');
}

// ── Voice ordering: mint a short-lived OpenAI Realtime session token ─────────
// The browser connects to OpenAI's Realtime API over WebRTC using this
// ephemeral token, so the real OPENAI_API_KEY never leaves the server.
const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime';

export async function createRealtimeSession(tenantId: string, tenantName: string, currency: string) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { error: 'AI assistant not configured', status: 501 as const };

  const menuText = await buildMenuText(tenantId, currency);
  const instructions = `You are the friendly spoken ordering assistant for the restaurant "${tenantName}", powered by Qlisted.\n`
    + `• Speak naturally and keep spoken replies short — one or two sentences.\n`
    + `• Recommend ONLY items on the menu below; never invent dishes, prices, or ingredients.\n`
    + `• Help with cravings, budget and dietary needs (vegetarian, vegan, gluten-free, spice, allergens); suggest a pairing or popular add-on when it feels natural, never pushy.\n`
    + `• Detect the language the guest speaks and respond in that SAME language.\n`
    + `• When the guest wants an item, call add_to_cart with the item's name and quantity, then confirm out loud what you added. To take something off, call remove_from_cart. To answer "what's in my order / how much is it", call read_cart and report it. Only add items that appear on the menu below.\n`
    + `• You cannot take payment — after building the cart, tell the guest to review it and check out on screen.\n\nMENU:\n${menuText || '(menu unavailable)'}`;

  // Tool-calling lets the agent act on the on-screen cart — the browser executes
  // each tool against the live menu/cart and returns the result.
  const tools = [
    {
      type: 'function',
      name: 'add_to_cart',
      description: "Add a menu item to the guest's cart by name. Use the exact item name from the menu.",
      parameters: {
        type: 'object',
        properties: {
          item_name: { type: 'string', description: 'The menu item name to add' },
          quantity: { type: 'integer', description: 'How many to add', minimum: 1 },
        },
        required: ['item_name'],
      },
    },
    {
      type: 'function',
      name: 'remove_from_cart',
      description: "Remove an item from the guest's cart by name.",
      parameters: {
        type: 'object',
        properties: { item_name: { type: 'string', description: 'The item name to remove' } },
        required: ['item_name'],
      },
    },
    {
      type: 'function',
      name: 'read_cart',
      description: "Read back what is currently in the guest's cart and the running total.",
      parameters: { type: 'object', properties: {} },
    },
  ];

  try {
    const res = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session: { type: 'realtime', model: REALTIME_MODEL, instructions, tools, tool_choice: 'auto', audio: { output: { voice: 'alloy' } } },
      }),
    });
    if (!res.ok) {
      logger.error({ status: res.status, body: await res.text() }, 'realtime session mint failed');
      return { error: 'Could not start voice session', status: 502 as const };
    }
    const session = await res.json() as { value?: string; expires_at?: number };
    if (!session.value) return { error: 'Could not start voice session', status: 502 as const };
    return { data: { clientSecret: session.value, expiresAt: session.expires_at, model: REALTIME_MODEL }, status: 200 as const };
  } catch (e) {
    logger.error(e, 'realtime session error');
    return { error: 'Could not start voice session', status: 502 as const };
  }
}
