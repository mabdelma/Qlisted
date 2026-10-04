import type { InferSelectModel } from 'drizzle-orm';
import type { tenants } from './db/schema.js';

export type Tenant = InferSelectModel<typeof tenants>;

/** What a tenant operates — drives which features/nav/routes they get. */
export type VenueType = 'restaurant' | 'hotel' | 'both';

declare module 'hono' {
  interface ContextVariableMap {
    tenant: Tenant;
    tenantId: string;
    userId: string;
    role: string;
    // The authenticated user's OWN tenant (from their token), kept separate from
    // `tenantId` which resolveTenant overwrites with the URL slug's tenant.
    userTenantId: string;
  }
}
