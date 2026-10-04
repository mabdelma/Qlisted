import { db, schema } from '../db/index.js';
import { translateNote } from './translationService.js';
import { eq, and, sql } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { logger } from '../lib/logger.js';
import { emitOrderEvent } from '../lib/events.js';
import { sendPushNotification } from '../lib/push.js';
import { sendEmail } from '../lib/mail.js';
import { createKotPrintJob } from './printService.js';
import type { PaginationParams, PaginatedResult } from '../lib/pagination.js';
import { buildPagination } from '../lib/pagination.js';

export interface OrderItemInput {
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
  modifiers?: string;
}

export interface CreateOrderInput {
  tableId?: string;
  customerName?: string;
  customerPhone?: string;
  orderType?: 'dine_in' | 'takeout' | 'delivery';
  deliveryAddress?: string;
  deliveryFee?: number;
  estimatedPickupTime?: string;
  estimatedDeliveryTime?: string;
  /** Hotel room-service orders: links the order to the guest stay (folio). */
  bookingId?: string;
  items: OrderItemInput[];
  notes?: string;
}

export async function createOrder(tenantId: string, input: CreateOrderInput) {
  const orderType = input.orderType || 'dine_in';

  if (orderType === 'dine_in') {
    if (!input.tableId) {
      return { error: 'Table ID is required for dine-in orders', status: 400 as const };
    }
    const [table] = await db
      .select()
      .from(schema.tables)
      .where(and(eq(schema.tables.id, input.tableId), eq(schema.tables.tenantId, tenantId)))
      .limit(1);
    if (!table) {
      return { error: 'Table not found', status: 404 as const };
    }
  }

  const orderId = uuid();
  const subtotal = input.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const itemCount = input.items.reduce((sum, item) => sum + item.quantity, 0);

  const [tenantSettings] = await db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.id, tenantId))
    .limit(1);

  const taxRate = tenantSettings?.taxRate || 0;
  const serviceChargeRate = orderType === 'dine_in' ? (tenantSettings?.serviceCharge || 0) : 0;
  const deliveryFee = input.deliveryFee || 0;
  const tax = subtotal * taxRate;
  const serviceCharge = subtotal * serviceChargeRate;
  const total = subtotal + tax + serviceCharge + deliveryFee;

  await db.insert(schema.orders).values({
    id: orderId,
    tenantId,
    tableId: input.tableId || null,
    customerName: input.customerName || null,
    customerPhone: input.customerPhone || null,
    orderType,
    deliveryAddress: input.deliveryAddress || null,
    deliveryFee,
    estimatedPickupTime: input.estimatedPickupTime || null,
    estimatedDeliveryTime: input.estimatedDeliveryTime || null,
    bookingId: input.bookingId || null,
    status: 'pending',
    itemCount,
    subtotal,
    discountAmount: 0,
    tax,
    serviceCharge,
    total,
    notes: input.notes || null,
  });

  // Language bridge: render the guest's notes in the venue's working language
  // before the kitchen or reception sees them. Best-effort by design — every
  // call degrades to null and staff read the original, so a slow or
  // unconfigured provider can never stop an order reaching the pass.
  const [venue] = await db
    .select({ lang: schema.tenants.operatingLanguage })
    .from(schema.tenants)
    .where(eq(schema.tenants.id, tenantId))
    .limit(1);
  const target = venue?.lang || 'en';

  const [orderNote, ...itemNotes] = await Promise.all([
    translateNote(input.notes, target),
    ...input.items.map((i) => translateNote(i.notes, target)),
  ]);

  if (orderNote.text) {
    await db.update(schema.orders)
      .set({ notesTranslated: orderNote.text, notesLanguage: orderNote.sourceLanguage })
      .where(eq(schema.orders.id, orderId));
  }

  const orderItems = input.items.map((item, idx) => ({
    id: uuid(),
    orderId,
    menuItemId: item.menuItemId,
    name: item.name,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    notes: item.notes,
    notesTranslated: itemNotes[idx]?.text ?? null,
    modifiers: item.modifiers,
  }));

  await db.insert(schema.orderItems).values(orderItems);

  if (orderType === 'dine_in' && input.tableId) {
    await db.update(schema.tables)
      .set({ status: 'occupied' })
      .where(eq(schema.tables.id, input.tableId));
  }

  logger.info({ tenantId, orderId, orderType, items: input.items.length }, 'Order created');
  emitOrderEvent({ type: 'order_created', tenantId, orderId });

  await createKotPrintJob(tenantId, orderId).catch(() => {});

  if (process.env.RESEND_API_KEY && tenantSettings?.email) {
    sendOrderConfirmationEmail(tenantSettings.email, {
      orderId,
      orderType,
      deliveryAddress: input.deliveryAddress,
      items: orderItems,
      subtotal,
      tax,
      serviceCharge,
      deliveryFee,
      total,
      customerName: input.customerName,
      tenantName: tenantSettings.name,
    }).catch(() => {});
  }

  return {
    data: { id: orderId, items: orderItems, subtotal, tax, serviceCharge, deliveryFee, total, orderType },
    status: 201 as const,
  };
}

export async function getTableOrders(tenantId: string, tableId: string, params: PaginationParams = {}): Promise<PaginatedResult<typeof schema.orders.$inferSelect>> {
  const { page = 1, limit = 20 } = params;
  const offset = (page - 1) * limit;
  const conditions = and(eq(schema.orders.tenantId, tenantId), eq(schema.orders.tableId, tableId));

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.orders)
    .where(conditions);

  const data = await db
    .select()
    .from(schema.orders)
    .where(conditions)
    .orderBy(schema.orders.createdAt)
    .limit(limit)
    .offset(offset);

  return buildPagination(data, Number(count), { page, limit });
}

export async function getAllOrders(tenantId: string, statusFilter?: string, orderTypeFilter?: string, params: PaginationParams = {}): Promise<PaginatedResult<typeof schema.orders.$inferSelect>> {
  const conditions = [eq(schema.orders.tenantId, tenantId)];
  if (statusFilter) {
    conditions.push(eq(schema.orders.status, statusFilter as typeof schema.orders.$inferSelect.status));
  }
  if (orderTypeFilter) {
    conditions.push(eq(schema.orders.orderType, orderTypeFilter as typeof schema.orders.$inferSelect.orderType));
  }

  const { page = 1, limit = 20 } = params;
  const offset = (page - 1) * limit;

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.orders)
    .where(and(...conditions));

  const data = await db
    .select()
    .from(schema.orders)
    .where(and(...conditions))
    .orderBy(schema.orders.createdAt)
    .limit(limit)
    .offset(offset);

  return buildPagination(data, Number(count), { page, limit });
}

export async function updateOrderItems(tenantId: string, orderId: string, input: { addItems?: OrderItemInput[]; removeItemIds?: string[] }) {
  const [order] = await db
    .select()
    .from(schema.orders)
    .where(and(eq(schema.orders.id, orderId), eq(schema.orders.tenantId, tenantId)))
    .limit(1);

  if (!order) {
    return { error: 'Order not found', status: 404 as const };
  }

  if (order.status === 'cancelled' || order.status === 'delivered') {
    return { error: 'Cannot modify a cancelled or delivered order', status: 400 as const };
  }

  if (input.removeItemIds && input.removeItemIds.length > 0) {
    for (const itemId of input.removeItemIds) {
      await db.delete(schema.orderItems)
        .where(and(eq(schema.orderItems.id, itemId), eq(schema.orderItems.orderId, orderId)));
    }
  }

  if (input.addItems && input.addItems.length > 0) {
    const newItems = input.addItems.map((item) => ({
      id: uuid(),
      orderId,
      menuItemId: item.menuItemId,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      notes: item.notes,
      modifiers: item.modifiers,
    }));
    await db.insert(schema.orderItems).values(newItems);
  }

  const remaining = await db
    .select()
    .from(schema.orderItems)
    .where(eq(schema.orderItems.orderId, orderId));

  const itemCount = remaining.reduce((s, i) => s + i.quantity, 0);
  const subtotal = remaining.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

  const [tenantSettings] = await db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.id, tenantId))
    .limit(1);

  const taxRate = tenantSettings?.taxRate || 0;
  const serviceChargeRate = order.orderType !== 'dine_in' ? 0 : (tenantSettings?.serviceCharge || 0);
  const tax = subtotal * taxRate;
  const serviceCharge = subtotal * serviceChargeRate;
  const discount = order.discountAmount || 0;
  const total = subtotal - discount + tax + serviceCharge + (order.deliveryFee || 0);

  await db.update(schema.orders)
    .set({ itemCount, subtotal, tax, serviceCharge, total, updatedAt: new Date().toISOString() })
    .where(eq(schema.orders.id, orderId));

  emitOrderEvent({ type: 'order_updated', tenantId, orderId, data: { itemCount, subtotal, total } });

  logger.info({ tenantId, orderId, itemCount, subtotal }, 'Order items updated');

  return { data: { items: remaining, itemCount, subtotal, tax, serviceCharge, total }, status: 200 as const };
}

export async function getOrderDetail(tenantId: string, orderId: string) {
  const [order] = await db
    .select()
    .from(schema.orders)
    .where(and(eq(schema.orders.id, orderId), eq(schema.orders.tenantId, tenantId)))
    .limit(1);

  if (!order) {
    return { error: 'Order not found', status: 404 as const };
  }

  const items = await db
    .select()
    .from(schema.orderItems)
    .where(eq(schema.orderItems.orderId, orderId));

  return { data: { ...order, items }, status: 200 as const };
}

export async function applyDiscount(tenantId: string, orderId: string, input: { amount: number; reason?: string }) {
  const [order] = await db
    .select()
    .from(schema.orders)
    .where(and(eq(schema.orders.id, orderId), eq(schema.orders.tenantId, tenantId)))
    .limit(1);
  if (!order) {
    return { error: 'Order not found', status: 404 as const };
  }
  if (order.status === 'cancelled' || order.status === 'delivered') {
    return { error: 'Cannot discount a completed order', status: 400 as const };
  }

  const amount = Math.max(0, Math.min(input.amount, order.subtotal));
  const total = order.subtotal - amount + (order.tax || 0) + (order.serviceCharge || 0) + (order.deliveryFee || 0);

  await db.update(schema.orders)
    .set({ discountAmount: amount, discountReason: input.reason || null, total, updatedAt: new Date().toISOString() })
    .where(eq(schema.orders.id, orderId));

  logger.info({ tenantId, orderId, discountAmount: amount }, 'Discount applied');
  emitOrderEvent({ type: 'order_updated', tenantId, orderId, data: { discountAmount: amount, total } });

  return { data: { discountAmount: amount, discountReason: input.reason, total }, status: 200 as const };
}

export async function compOrderItem(tenantId: string, orderId: string, itemId: string, isComp: boolean) {
  const [order] = await db
    .select()
    .from(schema.orders)
    .where(and(eq(schema.orders.id, orderId), eq(schema.orders.tenantId, tenantId)))
    .limit(1);
  if (!order) {
    return { error: 'Order not found', status: 404 as const };
  }
  if (order.status === 'cancelled' || order.status === 'delivered') {
    return { error: 'Cannot modify a completed order', status: 400 as const };
  }

  const [item] = await db
    .select()
    .from(schema.orderItems)
    .where(and(eq(schema.orderItems.id, itemId), eq(schema.orderItems.orderId, orderId)))
    .limit(1);
  if (!item) {
    return { error: 'Order item not found', status: 404 as const };
  }

  await db.update(schema.orderItems)
    .set({ isComp, unitPrice: isComp ? 0 : item.unitPrice })
    .where(eq(schema.orderItems.id, itemId));

  const remaining = await db
    .select()
    .from(schema.orderItems)
    .where(eq(schema.orderItems.orderId, orderId));

  const itemCount = remaining.reduce((s, i) => s + i.quantity, 0);
  const subtotal = remaining.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const total = subtotal - (order.discountAmount || 0) + (order.tax || 0) + (order.serviceCharge || 0) + (order.deliveryFee || 0);

  await db.update(schema.orders)
    .set({ itemCount, subtotal, total, updatedAt: new Date().toISOString() })
    .where(eq(schema.orders.id, orderId));

  logger.info({ tenantId, orderId, itemId, isComp }, 'Item comp status updated');
  emitOrderEvent({ type: 'order_updated', tenantId, orderId, data: { itemId, isComp, subtotal, total } });

  return { data: { itemId, isComp, subtotal, total }, status: 200 as const };
}

export async function updateOrderStatus(tenantId: string, orderId: string, status: string) {
  const updates: Record<string, unknown> = { status, updatedAt: new Date().toISOString() };
  if (status === 'delivered') {
    updates.completedAt = new Date().toISOString();
  }

  await db.update(schema.orders)
    .set(updates)
    .where(and(eq(schema.orders.id, orderId), eq(schema.orders.tenantId, tenantId)));

  logger.info({ tenantId, orderId, status }, 'Order status updated');
  emitOrderEvent({ type: 'order_updated', tenantId, orderId, data: { status } });
  emitOrderEvent({ type: 'order_status_changed', tenantId, orderId, data: { status } });

  if (status === 'ready') {
    sendPushNotification(tenantId, 'Order Ready!', `Order #${orderId.slice(0, 8)} is ready for pickup.`);
  }
}

export async function sendOrderConfirmationEmail(
  to: string,
  data: {
    orderId: string;
    orderType: string;
    deliveryAddress?: string;
    items: { name: string; quantity: number; unitPrice: number; notes?: string }[];
    subtotal: number;
    tax: number;
    serviceCharge: number;
    deliveryFee: number;
    total: number;
    customerName?: string;
    tenantName: string;
  },
) {
  const itemsHtml = data.items
    .map(
      (i) =>
        `<tr><td style="padding:6px 12px">${i.name}${i.notes ? `<br/><small>${i.notes}</small>` : ''}</td><td style="padding:6px 12px;text-align:center">${i.quantity}</td><td style="padding:6px 12px;text-align:right">$${i.unitPrice.toFixed(2)}</td><td style="padding:6px 12px;text-align:right">$${(i.quantity * i.unitPrice).toFixed(2)}</td></tr>`,
    )
    .join('');

  const headerInfo = data.orderType === 'dine_in'
    ? '<p><strong>Type:</strong> Dine In</p>'
    : data.orderType === 'takeout'
    ? '<p><strong>Type:</strong> Takeout</p>'
    : `<p><strong>Type:</strong> Delivery</p>${data.deliveryAddress ? `<p><strong>Delivery to:</strong> ${data.deliveryAddress}</p>` : ''}`;

  await sendEmail({
    to,
    subject: `Order #${data.orderId.slice(0, 8)} — ${data.tenantName}`,
    html: `
      <h2>New Order</h2>
      ${data.customerName ? `<p><strong>Customer:</strong> ${data.customerName}</p>` : ''}
      ${headerInfo}
      <table style="width:100%;border-collapse:collapse;margin-top:12px">
        <thead><tr style="background:#f3f4f6"><th style="padding:8px 12px;text-align:left">Item</th><th style="padding:8px 12px;text-align:center">Qty</th><th style="padding:8px 12px;text-align:right">Price</th><th style="padding:8px 12px;text-align:right">Total</th></tr></thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      <hr style="margin:12px 0" />
      <table style="width:100%">
        <tr><td>Subtotal</td><td style="text-align:right">$${data.subtotal.toFixed(2)}</td></tr>
        <tr><td>Tax</td><td style="text-align:right">$${data.tax.toFixed(2)}</td></tr>
        ${data.serviceCharge > 0 ? `<tr><td>Service Charge</td><td style="text-align:right">$${data.serviceCharge.toFixed(2)}</td></tr>` : ''}
        ${data.deliveryFee > 0 ? `<tr><td>Delivery Fee</td><td style="text-align:right">$${data.deliveryFee.toFixed(2)}</td></tr>` : ''}
        <tr style="font-weight:700"><td>Total</td><td style="text-align:right">$${data.total.toFixed(2)}</td></tr>
      </table>
      <hr style="margin:12px 0" />
      <p style="color:#666;font-size:12px">Qlisted &middot; ${data.tenantName}</p>
    `,
  });
}

export async function getServerOrders(tenantId: string, serverId: string, params: PaginationParams = {}): Promise<PaginatedResult<typeof schema.orders.$inferSelect>> {
  const { page = 1, limit = 20 } = params;
  const offset = (page - 1) * limit;
  const conditions = and(eq(schema.orders.tenantId, tenantId), eq(schema.orders.serverId, serverId));

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.orders)
    .where(conditions);

  const data = await db
    .select()
    .from(schema.orders)
    .where(conditions)
    .orderBy(schema.orders.createdAt)
    .limit(limit)
    .offset(offset);

  return buildPagination(data, Number(count), { page, limit });
}
