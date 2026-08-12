import { api } from './client';
import type { Tenant, User, MenuCategory, MenuItem, TableData, Order, OrderWithItems, OrderItem, Payment, PaymentLinkResponse, AnalyticsSummary, RevenueDataPoint, FinancialAnalytics, PlatformAnalytics, TenantSummary, TenantWithStats, TenantUsage, HourlyTrafficPoint, PeakHour, CategoryPerformanceItem, TrendingItem, RecommendationItem, ModifierGroup, ModifierOption, TaxCategory, GiftCard, GiftCardRedemption, ConnectAccountStatus, PayoutInfo, TimeEntry, PnLReport, PlatformUser, Lead, TimePoint, AdminSubscription, AuditLog, Mailbox, MailAlias, StockItem, Supplier, PurchaseOrder, ReorderSuggestion, Shift, Customer, Room, RoomStatus, RoomStats, RoomBooking, Folio, HotelReport } from './types';

// Auth
export const authApi = {
  login: (email: string, password: string, totpToken?: string) =>
    api.post<{ token?: string; user?: User; twoFactorRequired?: boolean }>('/auth/login', { email, password, totpToken }, { skipAuth: true }),
  register: (data: { tenantSlug: string; name: string; email: string; password: string; role?: string }) =>
    api.post<{ token: string; user: User }>('/auth/register', data, { skipAuth: true }),
  me: () => api.get<{ user: User; tenant: Tenant | null }>('/auth/me'),
  googleStatus: () => api.get<{ enabled: boolean; clientId: string | null }>('/auth/google/status', { skipAuth: true }),
  google: (credential: string) =>
    api.post<{ token: string; user: User }>('/auth/google', { credential }, { skipAuth: true }),
  // TOTP 2FA enrollment (authed)
  setup2fa: () => api.post<{ secret: string; otpauthUrl: string }>('/auth/2fa/setup', {}),
  enable2fa: (token: string) => api.post<{ enabled: boolean; backupCodes?: string[] }>('/auth/2fa/enable', { token }),
  disable2fa: (token: string) => api.post<{ enabled: boolean }>('/auth/2fa/disable', { token }),
};

// Super-admin / platform (all require a super_admin token)
export const adminApi = {
  platformAnalytics: () => api.get<PlatformAnalytics>('/admin/analytics'),
  listTenants: () => api.get<TenantSummary[]>('/admin/tenants'),
  getTenant: (tenantId: string) => api.get<TenantWithStats>(`/admin/tenants/${tenantId}`),
  setTenantStatus: (tenantId: string, isActive: boolean) =>
    api.put<{ success: boolean }>(`/admin/tenants/${tenantId}/status`, { isActive }),
  getTenantUsage: (tenantId: string) => api.get<TenantUsage>(`/admin/tenants/${tenantId}/usage`),
  listUsers: () => api.get<PlatformUser[]>('/admin/users'),
  listLeads: () => api.get<Lead[]>('/admin/leads'),
  analyticsTimeseries: () => api.get<{ series: TimePoint[] }>('/admin/analytics/timeseries'),
  listAuditLogs: () => api.get<AuditLog[]>('/admin/audit-logs'),
  listMailboxes: () => api.get<{ domain: string; mailboxes: Mailbox[] }>('/admin/mailboxes'),
  createMailbox: (data: { localPart: string; name?: string; password: string; quotaMb?: number }) => api.post<{ email: string }>('/admin/mailboxes', data),
  deleteMailbox: (email: string) => api.post<{ deleted: string }>('/admin/mailboxes/delete', { email }),
  setMailboxPassword: (email: string, password: string) => api.post<{ email: string }>('/admin/mailboxes/password', { email, password }),
  editMailbox: (data: { email: string; name?: string; quotaMb?: number }) => api.post<{ email: string }>('/admin/mailboxes/edit', data),
  setMailboxActive: (email: string, active: boolean) => api.post<{ email: string; active: boolean }>('/admin/mailboxes/active', { email, active }),
  listAliases: () => api.get<{ domain: string; aliases: MailAlias[] }>('/admin/aliases'),
  createAlias: (data: { address: string; goto: string }) => api.post<{ address: string; goto: string }>('/admin/aliases', data),
  deleteAlias: (id: number) => api.post<{ deleted: number }>('/admin/aliases/delete', { id }),
  getSubscription: (tenantId: string) => api.get<AdminSubscription>(`/admin/subscriptions/${tenantId}`),
  cancelSubscription: (tenantId: string) => api.post<{ success?: boolean }>(`/admin/subscriptions/${tenantId}/cancel`, {}),
};

// AI assistant (admin copilot + customer chat)
export interface AiCartLine { menuItemId: string; name: string; quantity: number; unitPrice: number; imageUrl?: string | null }
export type AiBlock =
  | { type: 'menu'; categories: { id: string; name: string; items: { id: string; name: string; price: number; description?: string | null; imageUrl?: string | null }[] }[] }
  | { type: 'cart'; items: AiCartLine[]; total: number };
export interface CustomerChatContext { cart?: AiCartLine[]; orderToken?: string; orderId?: string; locale?: string; isMobile?: boolean }
export type AiTaskId = 'build_order' | 'recommend' | 'track_order' | 'general';
export interface CustomerChatResponse {
  reply: string;
  orderToken?: string;
  cart?: { items: AiCartLine[]; total: number };
  blocks?: AiBlock[];
  task?: { id: AiTaskId; label?: string };
  done?: boolean;
  nextStep?: string;
}

export const aiApi = {
  status: (slug: string) => api.get<{ enabled: boolean }>(`/r/${slug}/ai/status`, { skipAuth: true }),
  adminChat: (slug: string, messages: { role: 'user' | 'assistant'; content: string }[]) =>
    api.post<{ reply: string }>(`/r/${slug}/ai/admin`, { messages }),
  customerChat: (slug: string, messages: { role: 'user' | 'assistant'; content: string }[], context?: CustomerChatContext) =>
    api.post<CustomerChatResponse>(`/r/${slug}/ai/customer`, { messages, context }, { skipAuth: true }),
  voiceSession: (slug: string) =>
    api.post<{ clientSecret: string; expiresAt?: number; model: string }>(`/r/${slug}/ai/voice-session`, {}, { skipAuth: true }),
};

// Reports (P&L)
export const reportApi = {
  getPnL: (slug: string, start?: string, end?: string) => {
    const q = new URLSearchParams();
    if (start) q.set('start', start);
    if (end) q.set('end', end);
    const qs = q.toString();
    return api.get<PnLReport>(`/r/${slug}/reports/pnl${qs ? `?${qs}` : ''}`);
  },
  // PDF path (downloaded with an auth header in the UI).
  pnlPdfPath: (slug: string, start?: string, end?: string) => {
    const q = new URLSearchParams();
    if (start) q.set('start', start);
    if (end) q.set('end', end);
    const qs = q.toString();
    return `/r/${slug}/reports/pnl.pdf${qs ? `?${qs}` : ''}`;
  },
};

// Tenants
export const tenantApi = {
  get: (slug: string) => api.get<Tenant>(`/tenants/${slug}`, { skipAuth: true }),
  create: (data: { name: string; slug: string; email: string; phone?: string; venueType?: 'restaurant' | 'hotel' | 'both'; adminName: string; adminPassword: string }) =>
    api.post<{ tenant: Tenant; admin: User }>('/tenants', data, { skipAuth: true }),
  updateSettings: (slug: string, data: Partial<Tenant>) =>
    api.put<{ success: boolean }>(`/tenants/${slug}/settings`, data),
};

// Menu
export const menuApi = {
  getFullMenu: (slug: string) =>
    api.get<{ categories: MenuCategory[]; items: MenuItem[] }>(`/r/${slug}/menu`, { skipAuth: true }),
  createCategory: (slug: string, data: { name: string; type?: string; parentId?: string; sortOrder?: number }) =>
    api.post<MenuCategory>(`/r/${slug}/menu/categories`, data),
  updateCategory: (slug: string, categoryId: string, data: Partial<MenuCategory>) =>
    api.put<{ success: boolean }>(`/r/${slug}/menu/categories/${categoryId}`, data),
  deleteCategory: (slug: string, categoryId: string) =>
    api.delete<{ success: boolean }>(`/r/${slug}/menu/categories/${categoryId}`),
  createItem: (slug: string, data: { categoryId: string; subCategoryId?: string; name: string; price: number; description?: string; imageUrl?: string; available?: boolean; sortOrder?: number; modifiers?: string; taxCategoryId?: string; taxExempt?: boolean }) =>
    api.post<MenuItem>(`/r/${slug}/menu/items`, data),
  updateItem: (slug: string, itemId: string, data: Partial<MenuItem>) =>
    api.put<{ success: boolean }>(`/r/${slug}/menu/items/${itemId}`, data),
  deleteItem: (slug: string, itemId: string) =>
    api.delete<{ success: boolean }>(`/r/${slug}/menu/items/${itemId}`),
  reorderItems: (slug: string, items: { id: string; sortOrder: number }[]) =>
    api.put<{ success: boolean }>(`/r/${slug}/menu/reorder`, { items }),
  reorderCategories: (slug: string, categories: { id: string; sortOrder: number }[]) =>
    api.put<{ success: boolean }>(`/r/${slug}/menu/categories/reorder`, { categories }),
  getModifierGroups: (slug: string) =>
    api.get<{ data: ModifierGroup[] }>(`/r/${slug}/modifier-groups`),
  createModifierGroup: (slug: string, data: { name: string; selectionType: string; isRequired: boolean; sortOrder?: number }) =>
    api.post<{ data: ModifierGroup }>(`/r/${slug}/modifier-groups`, data),
  updateModifierGroup: (slug: string, groupId: string, data: Partial<ModifierGroup>) =>
    api.put<{ success: boolean }>(`/r/${slug}/modifier-groups/${groupId}`, data),
  deleteModifierGroup: (slug: string, groupId: string) =>
    api.delete<{ success: boolean }>(`/r/${slug}/modifier-groups/${groupId}`),
  createModifierOption: (slug: string, groupId: string, data: { name: string; priceAdjustment?: number; maxSelectable?: number; sortOrder?: number }) =>
    api.post<{ data: ModifierOption }>(`/r/${slug}/modifier-groups/${groupId}/options`, data),
  updateModifierOption: (slug: string, optionId: string, data: Partial<ModifierOption>) =>
    api.put<{ success: boolean }>(`/r/${slug}/modifier-options/${optionId}`, data),
  deleteModifierOption: (slug: string, optionId: string) =>
    api.delete<{ success: boolean }>(`/r/${slug}/modifier-options/${optionId}`),
  getMenuItemModifiers: (slug: string, menuItemId: string) =>
    api.get<ModifierGroup[]>(`/r/${slug}/menu-items/${menuItemId}/modifiers`),
  linkMenuItemModifier: (slug: string, menuItemId: string, groupId: string) =>
    api.post<{ success: boolean }>(`/r/${slug}/menu-items/${menuItemId}/modifiers/${groupId}`),
  unlinkMenuItemModifier: (slug: string, menuItemId: string, groupId: string) =>
    api.delete<{ success: boolean }>(`/r/${slug}/menu-items/${menuItemId}/modifiers/${groupId}`),
};

// Tables
export const tableApi = {
  resolve: (qrToken: string) =>
    api.get<TableData & { tenantSlug: string; tenantName: string }>(`/r/resolve/${qrToken}`, { skipAuth: true }),
  getByQr: (slug: string, qrToken: string) =>
    api.get<TableData>(`/r/${slug}/table/${qrToken}`, { skipAuth: true }),
  list: (slug: string) =>
    api.get<TableData[]>(`/r/${slug}/tables`),
  create: (slug: string, data: { number: number; capacity?: number; xPos?: number; yPos?: number }) =>
    api.post<TableData>(`/r/${slug}/tables`, data),
  update: (slug: string, tableId: string, data: Partial<TableData>) =>
    api.put<{ success: boolean }>(`/r/${slug}/tables/${tableId}`, data),
  delete: (slug: string, tableId: string) =>
    api.delete<{ success: boolean }>(`/r/${slug}/tables/${tableId}`),
};

// Orders
export const orderApi = {
  create: (slug: string, data: { tableId?: string; customerName?: string; customerPhone?: string; orderType?: string; deliveryAddress?: string; deliveryFee?: number; estimatedPickupTime?: string; estimatedDeliveryTime?: string; items: { menuItemId: string; name: string; quantity: number; unitPrice: number; notes?: string; modifiers?: string }[]; notes?: string }) =>
    api.post<{ id: string; items: OrderItem[]; subtotal: number; tax: number; serviceCharge: number; deliveryFee: number; total: number; orderType: string }>(`/r/${slug}/orders`, data, { skipAuth: true }),
  getForTable: (slug: string, tableId: string) =>
    api.get<Order[]>(`/r/${slug}/table/${tableId}/orders`, { skipAuth: true }),
  list: (slug: string, status?: string, orderType?: string) =>
    api.get<Order[]>(`/r/${slug}/orders${status ? `?status=${status}` : ''}${orderType ? `${status ? '&' : '?'}orderType=${orderType}` : ''}`),
  getDetail: (slug: string, orderId: string) =>
    api.get<OrderWithItems>(`/r/${slug}/orders/${orderId}`),
  trackOrder: (slug: string, orderId: string) =>
    api.get<OrderWithItems>(`/r/${slug}/orders/${orderId}/track`, { skipAuth: true }),
  updateStatus: (slug: string, orderId: string, status: string) =>
    api.patch<{ success: boolean }>(`/r/${slug}/orders/${orderId}/status`, { status }),
  applyDiscount: (slug: string, orderId: string, data: { amount: number; reason?: string }) =>
    api.post<{ discountAmount: number; discountReason?: string; total: number }>(`/r/${slug}/orders/${orderId}/discount`, data),
  compItem: (slug: string, orderId: string, itemId: string, isComp: boolean) =>
    api.post<{ itemId: string; isComp: boolean; subtotal: number; total: number }>(`/r/${slug}/orders/${orderId}/items/${itemId}/comp`, { isComp }),
  getByServer: (slug: string, serverId: string) =>
    api.get<Order[]>(`/r/${slug}/orders/server/${serverId}`),
  updateItems: (slug: string, orderId: string, data: { addItems?: { menuItemId: string; name: string; quantity: number; unitPrice: number; notes?: string; modifiers?: string }[]; removeItemIds?: string[] }) =>
    api.patch<{ items: OrderItem[]; itemCount: number; subtotal: number; tax: number; serviceCharge: number; total: number }>(`/r/${slug}/orders/${orderId}/items`, data),
};

// Users / Staff management
export const userApi = {
  list: (slug: string) =>
    api.get<User[]>(`/r/${slug}/users`),
  create: (slug: string, data: { name: string; email: string; password: string; role: string; phone?: string }) =>
    api.post<User>(`/r/${slug}/users`, data),
  update: (slug: string, userId: string, data: Partial<User>) =>
    api.put<{ success: boolean }>(`/r/${slug}/users/${userId}`, data),
  updateStatus: (slug: string, userId: string, isActive: boolean) =>
    api.patch<{ success: boolean }>(`/r/${slug}/users/${userId}/status`, { isActive }),
  delete: (slug: string, userId: string) =>
    api.delete<{ success: boolean }>(`/r/${slug}/users/${userId}`),
};

// Payments
export const paymentApi = {
  createIntent: (slug: string, data: { orderId: string; tip?: number; amount?: number }) =>
    api.post<{ clientSecret: string; paymentId: string; amount: number }>(`/r/${slug}/payments/create-intent`, data, { skipAuth: true }),
  recordCash: (slug: string, data: { orderId: string; amount: number; tip?: number }) =>
    api.post<Payment>(`/r/${slug}/payments/cash`, data, { skipAuth: true }),
  list: (slug: string) =>
    api.get<Payment[]>(`/r/${slug}/payments`),
  getPaymentLink: (token: string) =>
    api.get<PaymentLinkResponse>(`/r/payment-links/${token}`, { skipAuth: true }),
  createLink: (slug: string, data: { amount: number; description?: string }) =>
    api.post<{ id: string; token: string; url: string }>(`/r/${slug}/payment-links`, data),
};

// Analytics
export const analyticsApi = {
  summary: (slug: string) =>
    api.get<AnalyticsSummary>(`/r/${slug}/analytics/summary`),
  revenue: (slug: string) =>
    api.get<{ daily: RevenueDataPoint[] }>(`/r/${slug}/analytics/revenue`),
  financial: (slug: string) =>
    api.get<FinancialAnalytics>(`/r/${slug}/analytics/financial`),
  hourlyTraffic: (slug: string) =>
    api.get<{ data: HourlyTrafficPoint[] }>(`/r/${slug}/analytics/hourly-traffic`),
  peakHours: (slug: string) =>
    api.get<{ data: PeakHour[] }>(`/r/${slug}/analytics/peak-hours`),
  categoryPerformance: (slug: string) =>
    api.get<{ data: CategoryPerformanceItem[] }>(`/r/${slug}/analytics/category-performance`),
  insights: (slug: string) =>
    api.get<import('./types').ForecastInsights>(`/r/${slug}/analytics/insights`),
  trending: (slug: string) =>
    api.get<{ data: TrendingItem[] }>(`/r/${slug}/analytics/trending`),
  recommendations: (slug: string, menuItemId?: string) =>
    api.get<{ data: RecommendationItem[] }>(`/r/${slug}/analytics/recommendations${menuItemId ? `?menuItemId=${menuItemId}` : ''}`),
};

export const uploadApi = {
  image: (slug: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.upload<{ url: string; filename: string }>(`/r/${slug}/upload`, formData);
  },
};

export const loyaltyApi = {
  get: (slug: string) =>
    api.get<{ points: number; tier: string; lifetimePoints: number; history: { id: string; type: string; amount: number; description: string; createdAt: string }[]; rewards: { id: string; name: string; pointsCost: number; description: string }[] }>(`/r/${slug}/loyalty`),
  earn: (slug: string, data: { amount: number; orderId?: string }) =>
    api.post<{ success: boolean; points: number; tier: string }>(`/r/${slug}/loyalty/earn`, data),
  redeem: (slug: string, data: { points: number; rewardId?: string }) =>
    api.post<{ success: boolean; points: number; discount: number }>(`/r/${slug}/loyalty/redeem`, data),
  redeemForOrder: (slug: string, data: { orderId: string; points: number }) =>
    api.post<{ success: boolean; pointsRedeemed: number; discountApplied: number; remainingPoints: number; newTotal: number }>(`/r/${slug}/loyalty/redeem-for-order`, data),
};

export const waitlistApi = {
  join: (slug: string, data: { customerName: string; partySize: number; customerPhone?: string; customerEmail?: string; notes?: string }) =>
    api.post<{ id: string; position: number; estimatedWaitMinutes: number }>(`/r/${slug}/waitlist`, data, { skipAuth: true }),
  list: (slug: string, status?: string) =>
    api.get<WaitlistEntry[]>(`/r/${slug}/waitlist${status ? `?status=${status}` : ''}`),
  updateStatus: (slug: string, entryId: string, status: string) =>
    api.patch<{ success: boolean }>(`/r/${slug}/waitlist/${entryId}/status`, { status }),
  delete: (slug: string, entryId: string) =>
    api.delete<{ success: boolean }>(`/r/${slug}/waitlist/${entryId}`),
  checkStatus: (slug: string, phone: string) =>
    api.get<{ status: string; position?: number; estimatedWaitMinutes?: number } | { status: 'not_found' }>(`/r/${slug}/waitlist/status?phone=${encodeURIComponent(phone)}`, { skipAuth: true }),
};

export const reservationApi = {
  create: (slug: string, data: { customerName: string; partySize: number; date: string; time: string; customerEmail?: string; customerPhone?: string; duration?: number; notes?: string; specialRequests?: string }) =>
    api.post<{ id: string }>(`/r/${slug}/reservations`, data, { skipAuth: true }),
  list: (slug: string, date?: string, status?: string) =>
    api.get<Reservation[]>(`/r/${slug}/reservations${date ? `?date=${date}` : ''}${status ? `${date ? '&' : '?'}status=${status}` : ''}`),
  get: (slug: string, reservationId: string) =>
    api.get<Reservation>(`/r/${slug}/reservations/${reservationId}`),
  updateStatus: (slug: string, reservationId: string, status: string) =>
    api.patch<{ success: boolean }>(`/r/${slug}/reservations/${reservationId}/status`, { status }),
  assignTable: (slug: string, reservationId: string, tableId: string) =>
    api.post<{ success: boolean; tableNumber: number }>(`/r/${slug}/reservations/${reservationId}/assign-table`, { tableId }),
  update: (slug: string, reservationId: string, data: Partial<{ customerName: string; partySize: number; date: string; time: string; customerEmail?: string; customerPhone?: string; notes?: string; specialRequests?: string }>) =>
    api.put<{ success: boolean }>(`/r/${slug}/reservations/${reservationId}`, data),
  delete: (slug: string, reservationId: string) =>
    api.delete<{ success: boolean }>(`/r/${slug}/reservations/${reservationId}`),
};

export const promoApi = {
  validate: (slug: string, code: string, subtotal?: number) =>
    api.get<{ valid: boolean; code: string; type: string; value: number; discount: number; description: string }>(`/r/${slug}/promo/validate?code=${encodeURIComponent(code)}${subtotal ? `&subtotal=${subtotal}` : ''}`),
  listCampaigns: (slug: string) =>
    api.get<{ data: Campaign[] }>(`/r/${slug}/campaigns`),
  createCampaign: (slug: string, data: CampaignInput) =>
    api.post<{ data: { id: string } }>(`/r/${slug}/campaigns`, data),
  updateCampaign: (slug: string, campaignId: string, data: Partial<CampaignInput>) =>
    api.put<{ success: boolean }>(`/r/${slug}/campaigns/${campaignId}`, data),
  deleteCampaign: (slug: string, campaignId: string) =>
    api.delete<{ success: boolean }>(`/r/${slug}/campaigns/${campaignId}`),
  applyPromo: (slug: string, orderId: string, code: string) =>
    api.post<{ discountAmount: number; newTotal: number }>(`/r/${slug}/orders/${orderId}/apply-promo`, { code }),
};

export const giftCardApi = {
  list: (slug: string) => api.get<GiftCard[]>(`/r/${slug}/gift-cards`),
  create: (slug: string, data: { code: string; initialBalance: number; expiresAt?: string }) =>
    api.post<GiftCard>(`/r/${slug}/gift-cards`, data),
  lookup: (slug: string, code: string) =>
    api.get<GiftCard>(`/r/${slug}/gift-cards/lookup/${code}`),
  redeem: (slug: string, code: string, orderId: string) =>
    api.post<{ redeemed: number; newBalance: number; remainingOrderBalance: number }>(`/r/${slug}/gift-cards/redeem`, { code, orderId }),
  deactivate: (slug: string, id: string) =>
    api.patch<GiftCard>(`/r/${slug}/gift-cards/${id}/deactivate`),
  redemptions: (slug: string, id: string) =>
    api.get<GiftCardRedemption[]>(`/r/${slug}/gift-cards/${id}/redemptions`),
};

export const timeApi = {
  clockIn: (slug: string, notes?: string) => api.post<TimeEntry>(`/r/${slug}/time/clock-in`, { notes }),
  clockOut: (slug: string, notes?: string) => api.post<TimeEntry>(`/r/${slug}/time/clock-out`, { notes }),
  active: (slug: string) => api.get<(TimeEntry & { userName: string; userRole: string })[]>(`/r/${slug}/time/active`),
  timesheet: (slug: string, params?: { userId?: string; startDate?: string; endDate?: string }) =>
    api.get<(TimeEntry & { userName: string; userRole: string })[]>(`/r/${slug}/time/timesheet`, { params }),
};

export const invoiceApi = {
  download: async (slug: string, orderId: string) => {
    const token = localStorage.getItem('auth_token');
    const res = await fetch(`/api/r/${slug}/orders/${orderId}/invoice`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Failed to download invoice');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice-${orderId.slice(0, 8)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  },
};

export const connectApi = {
  createAccount: (slug: string, email: string) =>
    api.post<{ accountId: string }>(`/r/${slug}/connect/account`, { email }),
  onboardingLink: (slug: string) =>
    api.get<{ url: string }>(`/r/${slug}/connect/onboarding-link`),
  status: (slug: string) =>
    api.get<ConnectAccountStatus>(`/r/${slug}/connect/status`),
  balance: (slug: string) =>
    api.get<{ available: { amount: number; currency: string }[]; pending: { amount: number; currency: string }[] }>(`/r/${slug}/connect/balance`),
  createPayout: (slug: string, amount: number, currency?: string) =>
    api.post<PayoutInfo>(`/r/${slug}/connect/payout`, { amount, currency }),
  payouts: (slug: string) =>
    api.get<PayoutInfo[]>(`/r/${slug}/connect/payouts`),
};

export const taxCategoryApi = {
  list: (slug: string) => api.get<TaxCategory[]>(`/r/${slug}/tax-categories`),
  create: (slug: string, data: { name: string; rate: number; isDefault?: boolean }) =>
    api.post<TaxCategory>(`/r/${slug}/tax-categories`, data),
  update: (slug: string, id: string, data: { name?: string; rate?: number; isDefault?: boolean }) =>
    api.put<TaxCategory>(`/r/${slug}/tax-categories/${id}`, data),
  delete: (slug: string, id: string) =>
    api.delete<{ success: boolean }>(`/r/${slug}/tax-categories/${id}`),
};

export const inventoryApi = {
  list: (slug: string) => api.get<StockItem[]>(`/r/${slug}/inventory`),
  create: (slug: string, data: { name: string; unit?: string; currentStock?: number; minStock?: number; costPerUnit?: number }) =>
    api.post<{ id: string }>(`/r/${slug}/inventory`, data),
  update: (slug: string, id: string, data: Partial<{ name: string; unit: string; currentStock: number; minStock: number; costPerUnit: number }>) =>
    api.put<{ success: boolean }>(`/r/${slug}/inventory/${id}`, data),
  delete: (slug: string, id: string) => api.delete<{ success: boolean }>(`/r/${slug}/inventory/${id}`),
};

export const marketingApi = {
  sendCampaign: (slug: string, data: { segment: 'all' | 'vip' | 'atRisk'; subject: string; message: string }) =>
    api.post<{ sent: number; total: number }>(`/r/${slug}/marketing/campaign`, data),
};

export const hotelApi = {
  list: (slug: string) => api.get<Room[]>(`/r/${slug}/rooms`),
  stats: (slug: string) => api.get<RoomStats>(`/r/${slug}/rooms/stats`),
  report: (slug: string, from: string, to: string) => api.get<HotelReport>(`/r/${slug}/hotel-report?from=${from}&to=${to}`),
  available: (slug: string, checkIn: string, checkOut: string) =>
    api.get<Room[]>(`/r/${slug}/rooms/available?checkIn=${checkIn}&checkOut=${checkOut}`),
  create: (slug: string, data: { number: string; type?: string; floor?: string; rate?: number; notes?: string }) =>
    api.post<{ id: string }>(`/r/${slug}/rooms`, data),
  update: (slug: string, id: string, data: Partial<{ number: string; type: string; floor: string; rate: number; housekeeperId: string | null; notes: string }>) =>
    api.put<{ success: boolean }>(`/r/${slug}/rooms/${id}`, data),
  setStatus: (slug: string, id: string, status: RoomStatus, guestName?: string) =>
    api.post<{ success: boolean }>(`/r/${slug}/rooms/${id}/status`, { status, guestName }),
  delete: (slug: string, id: string) => api.delete<{ success: boolean }>(`/r/${slug}/rooms/${id}`),
  regenerateToken: (slug: string, id: string) => api.post<{ serviceToken: string }>(`/r/${slug}/rooms/${id}/regenerate-token`, {}),
  // Reservations / check-in
  listBookings: (slug: string) => api.get<RoomBooking[]>(`/r/${slug}/bookings`),
  createBooking: (slug: string, data: { roomId: string; guestName: string; guestEmail?: string; guestPhone?: string; checkIn: string; checkOut: string; notes?: string }) =>
    api.post<{ id: string }>(`/r/${slug}/bookings`, data),
  checkIn: (slug: string, id: string) => api.post<{ success: boolean }>(`/r/${slug}/bookings/${id}/check-in`, {}),
  checkOut: (slug: string, id: string) => api.post<{ success: boolean }>(`/r/${slug}/bookings/${id}/check-out`, {}),
  cancelBooking: (slug: string, id: string) => api.post<{ success: boolean }>(`/r/${slug}/bookings/${id}/cancel`, {}),
  // Guest folio
  getFolio: (slug: string, bookingId: string) => api.get<Folio>(`/r/${slug}/bookings/${bookingId}/folio`),
  addFolioItem: (slug: string, bookingId: string, data: { description: string; amount: number }) =>
    api.post<{ id: string }>(`/r/${slug}/bookings/${bookingId}/folio`, data),
  deleteFolioItem: (slug: string, id: string) => api.delete<{ success: boolean }>(`/r/${slug}/folio/${id}`),
  folioPayLink: (slug: string, bookingId: string) => api.post<{ url: string; amount: number }>(`/r/${slug}/bookings/${bookingId}/folio/pay-link`, {}),
  settleFolio: (slug: string, bookingId: string) => api.post<{ success: boolean }>(`/r/${slug}/bookings/${bookingId}/folio/settle`, {}),
  takeDeposit: (slug: string, bookingId: string) => api.post<{ url: string; amount: number }>(`/r/${slug}/bookings/${bookingId}/folio/deposit`, {}),
};

// Public booking engine — guest-facing (no auth): reserve a room online.
export const bookingApi = {
  availability: (slug: string, checkIn: string, checkOut: string) =>
    api.get<{ id: string; number: string; type?: string | null; rate: number }[]>(`/r/${slug}/book/availability?checkIn=${checkIn}&checkOut=${checkOut}`, { skipAuth: true }),
  book: (slug: string, data: { roomId: string; guestName: string; guestEmail?: string; guestPhone?: string; checkIn: string; checkOut: string }) =>
    api.post<{ id: string; deposit?: { url: string; amount: number } | null }>(`/r/${slug}/book`, data, { skipAuth: true }),
};

// Room service — guest-facing (no auth): a checked-in guest orders to their room.
export const roomServiceApi = {
  stay: (slug: string, roomId: string) =>
    api.get<{ active: boolean; guestName: string | null; roomNumber: string | null }>(`/r/${slug}/room/${roomId}/stay`, { skipAuth: true }),
  order: (slug: string, roomId: string, items: { menuItemId: string; name: string; quantity: number; unitPrice: number }[]) =>
    api.post<{ orderId: string; total: number }>(`/r/${slug}/room/${roomId}/order`, { items }, { skipAuth: true }),
};

export const customerApi = {
  list: (slug: string) => api.get<Customer[]>(`/r/${slug}/customers`),
  create: (slug: string, data: { name: string; email?: string; phone?: string }) =>
    api.post<{ id: string }>(`/r/${slug}/customers`, data),
  update: (slug: string, id: string, data: Partial<{ name: string; email: string; phone: string; notes: string }>) =>
    api.put<{ success: boolean }>(`/r/${slug}/customers/${id}`, data),
};

export const schedulingApi = {
  list: (slug: string, week: string) => api.get<Shift[]>(`/r/${slug}/shifts?week=${week}`),
  create: (slug: string, data: { userId: string; date: string; startTime: string; endTime: string; role?: string; notes?: string }) =>
    api.post<{ id: string }>(`/r/${slug}/shifts`, data),
  update: (slug: string, id: string, data: Partial<{ date: string; startTime: string; endTime: string; role: string; notes: string }>) =>
    api.put<{ success: boolean }>(`/r/${slug}/shifts/${id}`, data),
  delete: (slug: string, id: string) => api.delete<{ success: boolean }>(`/r/${slug}/shifts/${id}`),
};

export const procurementApi = {
  listSuppliers: (slug: string) => api.get<Supplier[]>(`/r/${slug}/suppliers`),
  createSupplier: (slug: string, data: { name: string; email?: string; phone?: string; notes?: string }) =>
    api.post<{ id: string }>(`/r/${slug}/suppliers`, data),
  deleteSupplier: (slug: string, id: string) => api.delete<{ success: boolean }>(`/r/${slug}/suppliers/${id}`),
  listOrders: (slug: string) => api.get<PurchaseOrder[]>(`/r/${slug}/purchase-orders`),
  suggest: (slug: string) => api.get<ReorderSuggestion[]>(`/r/${slug}/purchase-orders/suggest`),
  createOrder: (slug: string, data: { supplierId?: string | null; notes?: string; items: { stockItemId?: string | null; name: string; quantity: number; unitCost: number }[] }) =>
    api.post<{ id: string; total: number }>(`/r/${slug}/purchase-orders`, data),
  receiveOrder: (slug: string, id: string) => api.post<{ success: boolean }>(`/r/${slug}/purchase-orders/${id}/receive`, {}),
  cancelOrder: (slug: string, id: string) => api.post<{ success: boolean }>(`/r/${slug}/purchase-orders/${id}/cancel`, {}),
};
