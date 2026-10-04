import type { Context, Next } from 'hono';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import type { VenueType } from '../types.js';

export async function resolveTenant(c: Context, next: Next) {
  const slug = c.req.param('slug');
  if (!slug) {
    throw new HTTPException(400, { message: 'Tenant slug required' });
  }
  const [tenant] = await db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.slug, slug))
    .limit(1);

  if (!tenant) {
    throw new HTTPException(404, { message: 'Restaurant not found' });
  }
  if (!tenant.isActive) {
    throw new HTTPException(403, { message: 'Restaurant is inactive' });
  }

  // Tenant isolation: if the request is authenticated (userTenantId is set by
  // authMiddleware), a non-super_admin may only act on their OWN tenant. This
  // blocks cross-tenant access (e.g. admin of A calling /api/r/<B>/...). Public
  // routes (QR menu/ordering) have no userTenantId set, so they're unaffected.
  const userTenantId = c.get('userTenantId');
  const role = c.get('role');
  if (userTenantId && role !== 'super_admin' && userTenantId !== tenant.id) {
    throw new HTTPException(403, { message: 'Forbidden: cross-tenant access' });
  }

  c.set('tenant', tenant);
  c.set('tenantId', tenant.id);
  await next();
}

/**
 * Gate a tenant-scoped route on the tenant's venueType. Feature routes (hotel
 * rooms/bookings, room service) must run AFTER resolveTenant, since it is what
 * loads the tenant. Without this, any tenant with an admin token could operate
 * the hotel endpoints and simply see empty tables — the UI sidebar filter is
 * cosmetic only. super_admin bypasses so platform staff can inspect any tenant.
 */
export function requireVenue(...allowed: VenueType[]) {
  return async (c: Context, next: Next) => {
    if (c.get('role') === 'super_admin') return next();
    const venue = (c.get('tenant')?.venueType ?? 'restaurant') as VenueType;
    if (!allowed.includes(venue)) {
      throw new HTTPException(403, {
        message: `Forbidden: not available for ${venue} venues`,
      });
    }
    await next();
  };
}
