export type VenueType = 'restaurant' | 'hotel' | 'both';
export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'canceled';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  email: string;
  venueType?: VenueType;
  subscription?: { status: SubscriptionStatus; currentPeriodEnd?: string | null };
  phone?: string;
  address?: string;
  currency: string;
  timezone: string;
  logoUrl?: string;
  coverImage?: string;
  primaryColor?: string;
  accentColor?: string;
  faviconUrl?: string;
  googleReviewUrl?: string;
  customDomain?: string;
  taxRate: number;
  serviceCharge: number;
  isActive: boolean;
  stripeAccountId?: string;
}

export interface User {
  id: string;
  tenantId: string | null;
  name: string;
  email: string;
  phone?: string;
  role: 'super_admin' | 'admin' | 'manager' | 'waiter' | 'kitchen' | 'cashier';
  avatar?: string;
  isActive: boolean;
  joinedAt: string;
  lastActive: string;
  totpEnabled?: boolean;
}

export interface MenuCategory {
  id: string;
  tenantId: string;
  name: string;
  type: string;
  parentId?: string;
  sortOrder: number;
  translations?: Record<string, { name?: string }>;
}

export interface MenuItem {
  id: string;
  tenantId: string;
  categoryId: string;
  subCategoryId?: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  available: boolean;
  sortOrder: number;
  modifiers?: string;
  taxCategoryId?: string;
  taxExempt?: boolean;
  translations?: Record<string, { name?: string; description?: string }>;
}

export interface TaxCategory {
  id: string;
  tenantId: string;
  name: string;
  rate: number;
  isDefault: boolean;
  createdAt: string;
}

export interface GiftCard {
  id: string;
  tenantId: string;
  code: string;
  initialBalance: number;
  currentBalance: number;
  expiresAt?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GiftCardRedemption {
  id: string;
  tenantId: string;
  giftCardId: string;
  orderId: string;
  amount: number;
  createdAt: string;
}

export interface TimeEntry {
  id: string;
  clockIn: string;
  clockOut?: string;
  totalHours?: number;
  notes?: string;
  userId: string;
  userName?: string;
  userRole?: string;
}

export interface ConnectAccountStatus {
  connected: boolean;
  account: {
    id: string;
    email: string | null;
    country: string;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
  } | null;
}

export interface PayoutInfo {
  id: string;
  amount: number;
  currency: string;
  status: string;
  arrivalDate: string;
  created?: string;
}

export interface TableData {
  id: string;
  tenantId: string;
  number: number;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved' | 'closed';
  qrToken: string;
  xPos?: number;
  yPos?: number;
}

export interface Order {
  id: string;
  tenantId: string;
  tableId?: string;
  serverId?: string;
  customerName?: string;
  customerPhone?: string;
  orderType: 'dine_in' | 'takeout' | 'delivery';
  deliveryAddress?: string;
  deliveryFee: number;
  estimatedPickupTime?: string;
  estimatedDeliveryTime?: string;
  status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  itemCount: number;
  subtotal: number;
  discountAmount?: number;
  discountReason?: string;
  tax: number;
  serviceCharge: number;
  total: number;
  paymentStatus: 'unpaid' | 'partially_paid' | 'paid' | 'refunded';
  paidAmount?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  isComp?: boolean;
  modifiers?: string;
  notes?: string;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
}

export interface Payment {
  id: string;
  tenantId: string;
  orderId: string;
  amount: number;
  tip: number;
  method: 'card' | 'wallet' | 'cash' | 'crypto';
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  receiptUrl?: string;
  createdAt: string;
}

export interface PaymentLink {
  id: string;
  tenantId: string;
  orderId?: string;
  amount: number;
  description?: string;
  status: 'active' | 'paid' | 'expired' | 'cancelled';
  token: string;
  createdAt: string;
  expiresAt?: string;
}

export interface PaymentLinkResponse {
  id: string;
  orderId?: string;
  amount: number;
  description?: string;
  tenantName?: string;
  tenantSlug?: string;
  tenantLogo?: string;
  status: string;
  expiresAt?: string;
}

export interface AnalyticsSummary {
  todaysSales: number;
  totalSales: number;
  averagePreparationTime: number;
  activeTables: number;
  totalTables: number;
  delayedOrders: number;
  pendingOrders: number;
  popularItems: { name: string; quantity: number }[];
}

export interface RevenueDataPoint {
  date: string;
  revenue: number;
}

export interface FinancialAnalytics {
  dailyRevenue: number;
  weeklyRevenue: number;
  monthlyRevenue: number;
  paymentMethods: Record<string, number>;
}

export interface ApiError {
  error: string;
}

export interface ModifierGroup {
  id: string;
  tenantId: string;
  name: string;
  selectionType: 'single' | 'multiple';
  isRequired: boolean;
  sortOrder: number;
  options: ModifierOption[];
}

export interface ModifierOption {
  id: string;
  groupId: string;
  name: string;
  priceAdjustment: number;
  maxSelectable: number;
  sortOrder: number;
}

// ── Super-admin / platform ──────────────────────────────────────────────────
export interface PlatformAnalytics {
  tenants: number;
  activeTenants: number;
  users: number;
  orders: number;
  revenue: number;
  customers: number;
  tables: number;
  menuItems: number;
  monthlyGrowth: number;
}

export interface TenantUsage {
  users: number;
  orders: number;
  revenue: number;
  customers: number;
  tables: number;
  menuItems: number;
  storageEstimate: string;
}

export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  email: string;
  isActive: boolean;
  currency: string;
  createdAt: string;
}

export interface PlatformUser {
  id: string;
  name: string;
  email: string;
  role: string;
  tenantId: string | null;
  tenantName: string | null;
  isActive: boolean;
  joinedAt: string | null;
}

export interface TimePoint {
  date: string;
  orders: number;
  revenue: number;
}

export interface AuditLog {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  userName: string | null;
  tenantName: string | null;
  ip: string | null;
  createdAt: string;
}

export interface Mailbox {
  username: string;
  name: string;
  active: boolean;
  quotaMb: number;
  usedMb: number;
  messages: number;
  lastLogin: string | null;
}

export interface MailAlias {
  id: number;
  address: string;
  goto: string;
  active: boolean;
}

export interface AdminSubscription {
  plan: { id?: string; name?: string } | string | null;
  status: string;
  stripeSubscriptionId: string | null;
  renewDate: string | null;
  billingEnabled: boolean;
  usage?: Record<string, number>;
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  restaurant: string;
  phone: string | null;
  size: string | null;
  message: string | null;
  status: string;
  createdAt: string;
}

export interface TenantWithStats extends Tenant {
  stats: { users: number; orders: number; revenue: number; customers: number; tables: number; menuItems: number; storageEstimate: string };
}

export interface HourlyTrafficPoint {
  hour: number;
  orderCount: number;
  revenue: number;
}

export interface PeakHour {
  dayOfWeek: number;
  hour: number;
  orderCount: number;
}

export interface CategoryPerformanceItem {
  categoryId: string;
  categoryName: string;
  totalSold: number;
  totalRevenue: number;
}

export interface TrendingItem {
  id: string;
  name: string;
  price: number;
  recentOrders: number;
}

export interface RecommendationItem {
  id: string;
  name: string;
  price: number;
  orderCount: number;
}

export interface ModifierSelection {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceAdjustment: number;
}

export interface Campaign {
  id: string;
  tenantId: string;
  name: string;
  type: 'percentage' | 'fixed' | 'buy_x_get_y' | 'happy_hour';
  value: number;
  minOrderAmount?: number;
  maxDiscount?: number;
  buyQuantity?: number;
  getQuantity?: number;
  getDiscountPercent?: number;
  startDate?: string;
  endDate?: string;
  daysOfWeek?: string;
  timeStart?: string;
  timeEnd?: string;
  isActive: boolean;
  usageLimit?: number;
  usageCount: number;
  createdAt: string;
}

export interface Reservation {
  id: string;
  tenantId: string;
  tableId?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  partySize: number;
  date: string;
  time: string;
  duration: number;
  status: 'pending' | 'confirmed' | 'seated' | 'cancelled' | 'no_show';
  notes?: string;
  specialRequests?: string;
  source: 'web' | 'phone' | 'walk_in' | 'staff';
  depositAmount?: number;
  depositPaymentId?: string;
  reminderSent: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WaitlistEntry {
  id: string;
  tenantId: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  partySize: number;
  status: 'waiting' | 'notified' | 'seated' | 'cancelled' | 'expired';
  estimatedWaitMinutes?: number;
  notifiedAt?: string;
  seatedAt?: string;
  notes?: string;
  source: 'web' | 'staff';
  position?: number;
  createdAt: string;
}

export interface CampaignInput {
  name: string;
  type: 'percentage' | 'fixed' | 'buy_x_get_y' | 'happy_hour';
  value: number;
  minOrderAmount?: number;
  maxDiscount?: number;
  buyQuantity?: number;
  getQuantity?: number;
  getDiscountPercent?: number;
  startDate?: string;
  endDate?: string;
  daysOfWeek?: string;
  timeStart?: string;
  timeEnd?: string;
  usageLimit?: number;
  isActive?: boolean;
}

export interface PnLReport {
  start: string | null;
  end: string | null;
  grossRevenue: number;
  tips: number;
  refunds: number;
  netRevenue: number;
  tax: number;
  serviceCharge: number;
  cogs: number;
  grossProfit: number;
  orderCount: number;
  avgOrderValue: number;
  byMethod: { method: string; amount: number; count: number }[];
}

export interface Customer {
  id: string;
  tenantId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  loyaltyPoints: number;
  totalVisits: number;
  totalSpent: number;
  lastVisit?: string | null;
  notes?: string | null;
  createdAt: string;
}

export type RoomStatus = 'available' | 'occupied' | 'cleaning' | 'maintenance' | 'reserved';

export interface Room {
  id: string;
  tenantId: string;
  number: string;
  type?: string | null;
  status: RoomStatus;
  floor?: string | null;
  rate: number;
  serviceToken?: string | null;
  housekeeperId?: string | null;
  guestName?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HotelReport {
  from: string;
  to: string;
  rooms: number;
  days: number;
  bookings: number;
  arrivals: number;
  departures: number;
  roomRevenue: number;
  occupancy: number;
  adr: number;
  revpar: number;
}

export interface RoomStats {
  total: number;
  occupancy: number;
  available: number;
  occupied: number;
  cleaning: number;
  maintenance: number;
  reserved: number;
}

export type BookingStatus = 'booked' | 'checked_in' | 'checked_out' | 'cancelled';

export interface RoomBooking {
  id: string;
  roomId: string;
  roomNumber?: string | null;
  guestName: string;
  guestEmail?: string | null;
  guestPhone?: string | null;
  checkIn: string;
  checkOut: string;
  status: BookingStatus;
  ratePerNight: number;
  total: number;
  notes?: string | null;
}

export interface FolioItem {
  id: string;
  description: string;
  amount: number;
  createdAt: string;
}

export interface Folio {
  booking: { id: string; guestName: string; roomNumber?: string | null; checkIn: string; checkOut: string; status: BookingStatus };
  roomCharge: number;
  items: FolioItem[];
  extras: number;
  grandTotal: number;
  deposit: number;
  balance: number;
  paidAt?: string | null;
}

export interface Shift {
  id: string;
  userId: string;
  userName?: string | null;
  date: string;
  startTime: string;
  endTime: string;
  role?: string | null;
  notes?: string | null;
}

export interface StockItem {
  id: string;
  tenantId: string;
  name: string;
  unit: string;
  currentStock: number;
  minStock: number;
  costPerUnit: number;
}

export interface Supplier {
  id: string;
  tenantId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
}

export interface PurchaseOrderItem {
  id: string;
  poId: string;
  stockItemId?: string | null;
  name: string;
  quantity: number;
  unitCost: number;
}

export interface PurchaseOrder {
  id: string;
  supplierId?: string | null;
  status: 'draft' | 'ordered' | 'received' | 'cancelled';
  total: number;
  notes?: string | null;
  createdAt: string;
  receivedAt?: string | null;
  items: PurchaseOrderItem[];
}

export interface ReorderSuggestion {
  stockItemId: string;
  name: string;
  unit: string;
  quantity: number;
  unitCost: number;
}

export interface ForecastInsights {
  forecast: { date: string; dow: string; projected: number }[];
  forecast7Total: number;
  lowStock: { name: string; unit: string; currentStock: number; minStock: number; suggestedReorder: number; estCost: number }[];
  reorderCost: number;
  atRisk: { name: string; lastVisit: string | null; totalSpent: number; totalVisits: number }[];
  topCustomers: { name: string; totalSpent: number; totalVisits: number }[];
  hotel?: { rooms: number; occupancy: number; upcomingRevenue: number; upcomingBookings: number };
  narrative: string;
}
