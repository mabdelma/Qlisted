/** Cross-service DTOs (the contracts services agree on) — Qlisted restaurant domain. */

export type PlanId = "STARTER" | "GROWTH" | "ENTERPRISE";
export type Role = "customer" | "staff" | "kitchen" | "manager" | "admin" | "super_admin";

export interface UserDTO {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  tenantId: string | null; // null for the platform super_admin
  locale: string | null;
}

export interface TenantDTO {
  id: string;
  slug: string;
  name: string;
  currency: string;
  plan: PlanId;
}

export interface MenuItemDTO {
  id: string;
  tenantId: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: number;
  available: boolean;
  imageUrl: string | null;
}

export interface OrderDTO {
  id: string;
  tenantId: string;
  tableId: string | null;
  status: "pending" | "preparing" | "ready" | "served" | "cancelled";
  paymentStatus: "unpaid" | "paid" | "refunded";
  total: number;
  itemCount: number;
  createdAt: string;
}

export interface EmailRequest {
  to: string;
  template: "verify" | "reset" | "adminInvite" | "orderReceipt" | "orderReady";
  locale?: string;
  /** template-specific variables (url, name, orderId, total, …) */
  vars: Record<string, unknown>;
}

/** Domain events on the bus (Phase: async). */
export type DomainEvent =
  | { type: "user.registered"; userId: string; email: string; tenantId?: string | null; locale?: string }
  | { type: "order.placed"; orderId: string; tenantId: string; total: number }
  | { type: "order.updated"; orderId: string; tenantId: string }
  | { type: "order.status.changed"; orderId: string; tenantId: string; status: string; tableId?: string | null }
  | { type: "order.ready"; orderId: string; tenantId: string; tableId?: string | null }
  | { type: "payment.succeeded"; tenantId: string; orderId?: string; amount: number }
  | { type: "subscription.updated"; tenantId: string; plan: PlanId }
  | { type: "menu.category.created"; categoryId: string; tenantId: string; name: string }
  | { type: "menu.category.updated"; categoryId: string; tenantId: string }
  | { type: "menu.category.deleted"; categoryId: string; tenantId: string }
  | { type: "menu.item.created"; itemId: string; tenantId: string; name: string }
  | { type: "menu.item.updated"; itemId: string; tenantId: string }
  | { type: "menu.item.deleted"; itemId: string; tenantId: string }
  | { type: "loyalty.points.earned"; tenantId: string; amount: number }
  | { type: "loyalty.points.redeemed"; tenantId: string; amount: number }
  | { type: "promo.validated"; campaignId: string; tenantId: string; code: string }
  | { type: "campaign.sent"; campaignId: string; tenantId: string; recipients: number }
  | { type: "sms.sent"; to: string; tenantId?: string }
  | { type: "push.sent"; tenantId: string; recipients: number };
