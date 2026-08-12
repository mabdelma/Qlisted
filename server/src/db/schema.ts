import { pgTable, text, integer, doublePrecision, boolean, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const tenantGroups = pgTable('tenant_groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  ownerUserId: text('owner_user_id'),
  createdAt: text('created_at').notNull().default(sql`now()`),
});

export const tenants = pgTable('tenants', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  email: text('email').notNull(),
  // What this operator runs — drives which features/nav they see.
  venueType: text('venue_type', { enum: ['restaurant', 'hotel', 'both'] }).notNull().default('restaurant'),
  phone: text('phone'),
  address: text('address'),
  currency: text('currency').notNull().default('USD'),
  timezone: text('timezone').notNull().default('UTC'),
  logoUrl: text('logo_url'),
  coverImage: text('cover_image'),
  primaryColor: text('primary_color').default('#8B4513'),
  accentColor: text('accent_color').default('#5C4033'),
  faviconUrl: text('favicon_url'),
  // Post-payment "leave us a review" link (qlub-style review boost).
  googleReviewUrl: text('google_review_url'),
  customDomain: text('custom_domain'),
  taxRate: doublePrecision('tax_rate').default(0),
  serviceCharge: doublePrecision('service_charge').default(0),
  groupId: text('group_id').references(() => tenantGroups.id),
  isActive: boolean('is_active').notNull().default(true),
  stripeAccountId: text('stripe_account_id'),
  createdAt: text('created_at').notNull().default(sql`now()`),
  updatedAt: text('updated_at').notNull().default(sql`now()`),
});

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  // Nullable: a platform-level super_admin belongs to no single tenant.
  tenantId: text('tenant_id').references(() => tenants.id),
  role: text('role', { enum: ['super_admin', 'admin', 'manager', 'waiter', 'kitchen', 'cashier'] }).notNull().default('waiter'),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  passwordHash: text('password_hash').notNull(),
  avatar: text('avatar'),
  isActive: boolean('is_active').notNull().default(true),
  emailVerified: boolean('email_verified').notNull().default(false),
  verificationToken: text('verification_token'),
  verificationTokenExpiry: text('verification_token_expiry'),
  resetToken: text('reset_token'),
  resetTokenExpiry: text('reset_token_expiry'),
  // TOTP 2FA (RFC 6238). totpSecret holds the pending/active base32 secret;
  // totpEnabled gates enforcement at login. Both null/false until the user opts in.
  totpSecret: text('totp_secret'),
  totpEnabled: boolean('totp_enabled').notNull().default(false),
  // JSON array of sha256-hashed single-use recovery codes (consumed on use).
  totpBackupCodes: text('totp_backup_codes'),
  joinedAt: text('joined_at').notNull().default(sql`now()`),
  lastActive: text('last_active').notNull().default(sql`now()`),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  // Nullable: a platform-level super_admin session has no tenant.
  tenantId: text('tenant_id').references(() => tenants.id),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull().default(sql`now()`),
});

export const menuCategories = pgTable('menu_categories', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  name: text('name').notNull(),
  type: text('type', { enum: ['main', 'sub'] }).notNull().default('main'),
  parentId: text('parent_id'),
  sortOrder: integer('sort_order').notNull().default(0),
  translations: jsonb('translations'),
});

export const stockItems = pgTable('stock_items', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  name: text('name').notNull(),
  unit: text('unit').notNull().default('units'),
  currentStock: doublePrecision('current_stock').notNull().default(0),
  minStock: doublePrecision('min_stock').notNull().default(0),
  costPerUnit: doublePrecision('cost_per_unit').default(0),
  createdAt: text('created_at').notNull().default(sql`now()`),
  updatedAt: text('updated_at').notNull().default(sql`now()`),
});

export const stockMovements = pgTable('stock_movements', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  stockItemId: text('stock_item_id').notNull().references(() => stockItems.id),
  type: text('type', { enum: ['in', 'out', 'adjustment'] }).notNull(),
  quantity: doublePrecision('quantity').notNull(),
  reason: text('reason'),
  referenceType: text('reference_type'),
  referenceId: text('reference_id'),
  createdAt: text('created_at').notNull().default(sql`now()`),
});

export const menuItemIngredients = pgTable('menu_item_ingredients', {
  id: text('id').primaryKey(),
  menuItemId: text('menu_item_id').notNull().references(() => menuItems.id),
  stockItemId: text('stock_item_id').notNull().references(() => stockItems.id),
  quantity: doublePrecision('quantity').notNull().default(1),
});

export const subscriptionPlans = pgTable('subscription_plans', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  price: doublePrecision('price').notNull().default(0),
  maxMenus: integer('max_menus').default(-1),
  maxTables: integer('max_tables').default(-1),
  maxStaff: integer('max_staff').default(-1),
  features: text('features'),
});

export const tenantSubscriptions = pgTable('tenant_subscriptions', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  planId: text('plan_id').notNull().references(() => subscriptionPlans.id),
  stripeSubscriptionId: text('stripe_subscription_id'),
  status: text('status', { enum: ['active', 'past_due', 'canceled', 'trial'] }).notNull().default('trial'),
  trialEndsAt: text('trial_ends_at'),
  currentPeriodStart: text('current_period_start'),
  currentPeriodEnd: text('current_period_end'),
  createdAt: text('created_at').notNull().default(sql`now()`),
});

export const modifierGroups = pgTable('modifier_groups', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  name: text('name').notNull(),
  selectionType: text('selection_type', { enum: ['single', 'multiple'] }).notNull().default('single'),
  isRequired: boolean('is_required').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const modifierOptions = pgTable('modifier_options', {
  id: text('id').primaryKey(),
  groupId: text('group_id').notNull().references(() => modifierGroups.id),
  name: text('name').notNull(),
  priceAdjustment: doublePrecision('price_adjustment').notNull().default(0),
  maxSelectable: integer('max_selectable').default(1),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const menuItemModifiers = pgTable('menu_item_modifiers', {
  id: text('id').primaryKey(),
  menuItemId: text('menu_item_id').notNull().references(() => menuItems.id),
  modifierGroupId: text('modifier_group_id').notNull().references(() => modifierGroups.id),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const taxCategories = pgTable('tax_categories', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  name: text('name').notNull(),
  rate: doublePrecision('rate').notNull().default(0),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: text('created_at').notNull().default(sql`now()`),
});

export const menuItems = pgTable('menu_items', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  categoryId: text('category_id').notNull().references(() => menuCategories.id),
  subCategoryId: text('sub_category_id'),
  name: text('name').notNull(),
  description: text('description'),
  price: doublePrecision('price').notNull(),
  imageUrl: text('image_url'),
  imageData: text('image_data'),
  available: boolean('available').notNull().default(true),
  taxCategoryId: text('tax_category_id').references(() => taxCategories.id),
  taxExempt: boolean('tax_exempt').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  modifiers: text('modifiers'),
  translations: jsonb('translations'),
});

export const tables = pgTable('tables', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  number: integer('number').notNull(),
  capacity: integer('capacity').notNull().default(2),
  status: text('status', { enum: ['available', 'occupied', 'reserved', 'closed'] }).notNull().default('available'),
  qrToken: text('qr_token').notNull().unique(),
  qrImage: text('qr_image'),
  xPos: doublePrecision('x_pos'),
  yPos: doublePrecision('y_pos'),
});

export const orders = pgTable('orders', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  tableId: text('table_id').references(() => tables.id),
  serverId: text('server_id'),
  customerName: text('customer_name'),
  customerPhone: text('customer_phone'),
  orderType: text('order_type', { enum: ['dine_in', 'takeout', 'delivery'] }).notNull().default('dine_in'),
  deliveryAddress: text('delivery_address'),
  deliveryFee: doublePrecision('delivery_fee').default(0),
  estimatedPickupTime: text('estimated_pickup_time'),
  estimatedDeliveryTime: text('estimated_delivery_time'),
  status: text('status', { enum: ['pending', 'preparing', 'ready', 'delivered', 'cancelled'] }).notNull().default('pending'),
  itemCount: integer('item_count').notNull().default(0),
  subtotal: doublePrecision('subtotal').notNull().default(0),
  discountAmount: doublePrecision('discount_amount').default(0),
  discountReason: text('discount_reason'),
  tax: doublePrecision('tax').notNull().default(0),
  serviceCharge: doublePrecision('service_charge').notNull().default(0),
  total: doublePrecision('total').notNull().default(0),
  paymentStatus: text('payment_status', { enum: ['unpaid', 'partially_paid', 'paid', 'refunded'] }).notNull().default('unpaid'),
  paidAmount: doublePrecision('paid_amount').notNull().default(0),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(sql`now()`),
  updatedAt: text('updated_at').notNull().default(sql`now()`),
  completedAt: text('completed_at'),
});

export const orderItems = pgTable('order_items', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull().references(() => orders.id),
  menuItemId: text('menu_item_id').notNull(),
  name: text('name').notNull(),
  quantity: integer('quantity').notNull().default(1),
  unitPrice: doublePrecision('unit_price').notNull(),
  isComp: boolean('is_comp').notNull().default(false),
  modifiers: text('modifiers'),
  notes: text('notes'),
});

export const payments = pgTable('payments', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  orderId: text('order_id').notNull().references(() => orders.id),
  amount: doublePrecision('amount').notNull(),
  tip: doublePrecision('tip').default(0),
  method: text('method', { enum: ['card', 'wallet', 'cash', 'crypto'] }).notNull(),
  status: text('status', { enum: ['pending', 'paid', 'failed', 'refunded'] }).notNull().default('pending'),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  stripePaymentLinkId: text('stripe_payment_link_id'),
  receiptUrl: text('receipt_url'),
  createdAt: text('created_at').notNull().default(sql`now()`),
});

export const customers = pgTable('customers', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  loyaltyPoints: integer('loyalty_points').notNull().default(0),
  totalVisits: integer('total_visits').notNull().default(0),
  totalSpent: doublePrecision('total_spent').notNull().default(0),
  lastVisit: text('last_visit'),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(sql`now()`),
});

export const webhookIntegrations = pgTable('webhook_integrations', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  name: text('name').notNull(),
  provider: text('provider', { enum: ['delivery', 'accounting', 'custom'] }).notNull(),
  url: text('url').notNull(),
  secret: text('secret'),
  events: text('events').notNull().default('order_created,payment_completed'),
  isActive: boolean('is_active').notNull().default(true),
  lastTriggeredAt: text('last_triggered_at'),
  createdAt: text('created_at').notNull().default(sql`now()`),
});

export const demoRequests = pgTable('demo_requests', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  restaurant: text('restaurant').notNull(),
  phone: text('phone'),
  size: text('size'),
  message: text('message'),
  status: text('status', { enum: ['pending', 'contacted', 'converted', 'closed'] }).notNull().default('pending'),
  createdAt: text('created_at').notNull().default(sql`now()`),
});

export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id),
  userId: text('user_id').references(() => users.id),
  action: text('action').notNull(),
  resource: text('resource').notNull(),
  resourceId: text('resource_id'),
  details: text('details'),
  ip: text('ip'),
  createdAt: text('created_at').notNull().default(sql`now()`),
});

export const refreshTokens = pgTable('refresh_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  tenantId: text('tenant_id').references(() => tenants.id),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  revoked: boolean('revoked').notNull().default(false),
  createdAt: text('created_at').notNull().default(sql`now()`),
});

export const printers = pgTable('printers', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  name: text('name').notNull(),
  type: text('type', { enum: ['thermal', 'laser', 'network', 'browser'] }).notNull().default('browser'),
  address: text('address'),
  port: integer('port'),
  isActive: boolean('is_active').notNull().default(true),
  autoPrint: boolean('auto_print').notNull().default(true),
  createdAt: text('created_at').notNull().default(sql`now()`),
});

export const printJobs = pgTable('print_jobs', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  orderId: text('order_id').notNull().references(() => orders.id),
  printerId: text('printer_id').references(() => printers.id),
  type: text('type', { enum: ['kot', 'receipt', 'bill'] }).notNull().default('kot'),
  status: text('status', { enum: ['pending', 'printed', 'failed'] }).notNull().default('pending'),
  content: text('content'),
  error: text('error'),
  printedAt: text('printed_at'),
  createdAt: text('created_at').notNull().default(sql`now()`),
});

export const promoCampaigns = pgTable('promo_campaigns', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  name: text('name').notNull(),
  type: text('type', { enum: ['percentage', 'fixed', 'buy_x_get_y', 'happy_hour'] }).notNull(),
  value: doublePrecision('value').notNull().default(0),
  minOrderAmount: doublePrecision('min_order_amount').default(0),
  maxDiscount: doublePrecision('max_discount'),
  buyQuantity: integer('buy_quantity'),
  getQuantity: integer('get_quantity'),
  getDiscountPercent: doublePrecision('get_discount_percent').default(100),
  startDate: text('start_date'),
  endDate: text('end_date'),
  daysOfWeek: text('days_of_week'),
  timeStart: text('time_start'),
  timeEnd: text('time_end'),
  isActive: boolean('is_active').notNull().default(true),
  usageLimit: integer('usage_limit'),
  usageCount: integer('usage_count').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`now()`),
});

export const promoCodeUsages = pgTable('promo_code_usages', {
  id: text('id').primaryKey(),
  campaignId: text('campaign_id').notNull().references(() => promoCampaigns.id),
  orderId: text('order_id').notNull().references(() => orders.id),
  discountAmount: doublePrecision('discount_amount').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`now()`),
});

export const paymentLinks = pgTable('payment_links', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  orderId: text('order_id').references(() => orders.id),
  bookingId: text('booking_id'), // hotel folio/deposit links reconcile against this
  kind: text('kind'), // 'folio' | 'deposit' (null for order/generic links)
  amount: doublePrecision('amount').notNull(),
  description: text('description'),
  status: text('status', { enum: ['active', 'paid', 'expired', 'cancelled'] }).notNull().default('active'),
  token: text('token').notNull().unique(),
  stripeLinkId: text('stripe_link_id'),
  paidAt: text('paid_at'),
  createdAt: text('created_at').notNull().default(sql`now()`),
  expiresAt: text('expires_at'),
});

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  userAgent: text('user_agent'),
  createdAt: text('created_at').notNull().default(sql`now()`),
});

export const loyaltySummary = pgTable('loyalty_summary', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id).unique(),
  points: integer('points').notNull().default(0),
  lifetimePoints: integer('lifetime_points').notNull().default(0),
  tier: text('tier', { enum: ['bronze', 'silver', 'gold', 'platinum'] }).notNull().default('bronze'),
  updatedAt: text('updated_at').notNull().default(sql`now()`),
});

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  orderId: text('order_id').references(() => orders.id),
  type: text('type', { enum: ['earn', 'redeem'] }).notNull(),
  amount: integer('amount').notNull(),
  description: text('description'),
  createdAt: text('created_at').notNull().default(sql`now()`),
});

export const expoPushTokens = pgTable('expo_push_tokens', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  token: text('token').notNull().unique(),
  deviceInfo: text('device_info'),
  createdAt: text('created_at').notNull().default(sql`now()`),
});

export const waitlistEntries = pgTable('waitlist_entries', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  customerName: text('customer_name').notNull(),
  customerPhone: text('customer_phone'),
  customerEmail: text('customer_email'),
  partySize: integer('party_size').notNull(),
  status: text('status', { enum: ['waiting', 'notified', 'seated', 'cancelled', 'expired'] }).notNull().default('waiting'),
  estimatedWaitMinutes: integer('estimated_wait_minutes').default(15),
  notifiedAt: text('notified_at'),
  seatedAt: text('seated_at'),
  notes: text('notes'),
  source: text('source', { enum: ['web', 'staff'] }).notNull().default('web'),
  position: integer('position'),
  createdAt: text('created_at').notNull().default(sql`now()`),
  updatedAt: text('updated_at').notNull().default(sql`now()`),
});

export const timeEntries = pgTable('time_entries', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  userId: text('user_id').notNull().references(() => users.id),
  clockIn: text('clock_in').notNull(),
  clockOut: text('clock_out'),
  totalHours: doublePrecision('total_hours'),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(sql`now()`),
  updatedAt: text('updated_at').notNull().default(sql`now()`),
});

export const giftCards = pgTable('gift_cards', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  code: text('code').notNull(),
  initialBalance: doublePrecision('initial_balance').notNull(),
  currentBalance: doublePrecision('current_balance').notNull(),
  expiresAt: text('expires_at'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: text('created_at').notNull().default(sql`now()`),
  updatedAt: text('updated_at').notNull().default(sql`now()`),
});

export const giftCardRedemptions = pgTable('gift_card_redemptions', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  giftCardId: text('gift_card_id').notNull().references(() => giftCards.id),
  orderId: text('order_id').notNull().references(() => orders.id),
  amount: doublePrecision('amount').notNull(),
  createdAt: text('created_at').notNull().default(sql`now()`),
});

export const reservations = pgTable('reservations', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  tableId: text('table_id').references(() => tables.id),
  customerName: text('customer_name').notNull(),
  customerEmail: text('customer_email'),
  customerPhone: text('customer_phone'),
  partySize: integer('party_size').notNull(),
  date: text('date').notNull(),
  time: text('time').notNull(),
  duration: integer('duration').notNull().default(90),
  status: text('status', { enum: ['pending', 'confirmed', 'seated', 'cancelled', 'no_show'] }).notNull().default('pending'),
  notes: text('notes'),
  specialRequests: text('special_requests'),
  source: text('source', { enum: ['web', 'phone', 'walk_in', 'staff'] }).notNull().default('web'),
  depositAmount: doublePrecision('deposit_amount').default(0),
  depositPaymentId: text('deposit_payment_id'),
  reminderSent: boolean('reminder_sent').notNull().default(false),
  createdAt: text('created_at').notNull().default(sql`now()`),
  updatedAt: text('updated_at').notNull().default(sql`now()`),
});

// ── Procurement: suppliers + purchase orders ────────────────────────────────
export const suppliers = pgTable('suppliers', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(sql`now()`),
});

export const purchaseOrders = pgTable('purchase_orders', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  supplierId: text('supplier_id').references(() => suppliers.id),
  status: text('status', { enum: ['draft', 'ordered', 'received', 'cancelled'] }).notNull().default('draft'),
  total: doublePrecision('total').notNull().default(0),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(sql`now()`),
  receivedAt: text('received_at'),
});

export const purchaseOrderItems = pgTable('purchase_order_items', {
  id: text('id').primaryKey(),
  poId: text('po_id').notNull().references(() => purchaseOrders.id),
  stockItemId: text('stock_item_id').references(() => stockItems.id),
  name: text('name').notNull(),
  quantity: doublePrecision('quantity').notNull().default(1),
  unitCost: doublePrecision('unit_cost').notNull().default(0),
});

// ── Hotel: rooms + housekeeping ─────────────────────────────────────────────
export const rooms = pgTable('rooms', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  number: text('number').notNull(),
  type: text('type'),
  status: text('status', { enum: ['available', 'occupied', 'cleaning', 'maintenance', 'reserved'] }).notNull().default('available'),
  floor: text('floor'),
  rate: doublePrecision('rate').notNull().default(0), // price per night
  serviceToken: text('service_token'), // unguessable token for the in-room service QR link
  housekeeperId: text('housekeeper_id'), // staff user assigned to clean the room
  guestName: text('guest_name'),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(sql`now()`),
  updatedAt: text('updated_at').notNull().default(sql`now()`),
});

// ── Hotel: reservations / check-in ──────────────────────────────────────────
export const roomBookings = pgTable('room_bookings', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  roomId: text('room_id').notNull().references(() => rooms.id),
  guestName: text('guest_name').notNull(),
  guestEmail: text('guest_email'),
  guestPhone: text('guest_phone'),
  checkIn: text('check_in').notNull(), // YYYY-MM-DD
  checkOut: text('check_out').notNull(), // YYYY-MM-DD
  status: text('status', { enum: ['booked', 'checked_in', 'checked_out', 'cancelled'] }).notNull().default('booked'),
  ratePerNight: doublePrecision('rate_per_night').notNull().default(0),
  total: doublePrecision('total').notNull().default(0),
  depositAmount: doublePrecision('deposit_amount').notNull().default(0), // pre-paid deposit
  folioPaidAt: text('folio_paid_at'), // set when the guest's folio is settled
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(sql`now()`),
  updatedAt: text('updated_at').notNull().default(sql`now()`),
});

// ── Hotel: guest folio (extra charges posted to a booking) ──────────────────
export const folioItems = pgTable('folio_items', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  bookingId: text('booking_id').notNull().references(() => roomBookings.id),
  description: text('description').notNull(),
  amount: doublePrecision('amount').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`now()`),
});

// ── Staff scheduling: shifts (weekly rota) ──────────────────────────────────
export const shifts = pgTable('shifts', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  userId: text('user_id').notNull().references(() => users.id),
  date: text('date').notNull(),         // YYYY-MM-DD
  startTime: text('start_time').notNull(), // HH:MM
  endTime: text('end_time').notNull(),     // HH:MM
  role: text('role'),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(sql`now()`),
});
