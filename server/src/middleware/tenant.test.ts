import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { db } from '../db/index.js';
import { resolveTenant, requireVenue } from './tenant.js';

const TENANT = { id: 't-demo', slug: 'demo', isActive: true };

// Minimal Context stub exposing only what resolveTenant touches.
function makeCtx(slug: string, vars: Record<string, unknown>) {
  const store: Record<string, unknown> = { ...vars };
  return {
    req: { param: (k: string) => (k === 'slug' ? slug : undefined) },
    get: (k: string) => store[k],
    set: (k: string, v: unknown) => { store[k] = v; },
    store,
  } as unknown as Context & { store: Record<string, unknown> };
}

describe('resolveTenant — tenant isolation', () => {
  beforeEach(() => {
    (db as unknown as { __setQueryData: (d: unknown) => void }).__setQueryData([TENANT]);
  });

  it('allows a user acting on their OWN tenant', async () => {
    const c = makeCtx('demo', { userTenantId: 't-demo', role: 'admin' });
    const next = vi.fn();
    await resolveTenant(c, next);
    expect(next).toHaveBeenCalledOnce();
    expect((c as unknown as { store: Record<string, unknown> }).store.tenantId).toBe('t-demo');
  });

  it('BLOCKS cross-tenant access with 403', async () => {
    const c = makeCtx('demo', { userTenantId: 't-other', role: 'admin' });
    const next = vi.fn();
    await expect(resolveTenant(c, next)).rejects.toMatchObject({ status: 403 });
    expect(next).not.toHaveBeenCalled();
  });

  it('allows super_admin to act across tenants', async () => {
    const c = makeCtx('demo', { userTenantId: undefined, role: 'super_admin' });
    const next = vi.fn();
    await resolveTenant(c, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('allows public (unauthenticated) requests — QR menu / ordering', async () => {
    const c = makeCtx('demo', {}); // no userTenantId set
    const next = vi.fn();
    await resolveTenant(c, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('rejects an inactive tenant', async () => {
    (db as unknown as { __setQueryData: (d: unknown) => void }).__setQueryData([{ ...TENANT, isActive: false }]);
    const c = makeCtx('demo', {});
    const next = vi.fn();
    await expect(resolveTenant(c, next)).rejects.toBeInstanceOf(HTTPException);
    expect(next).not.toHaveBeenCalled();
  });
});

// The admin sidebar hides hotel tabs by venueType, but that filter is cosmetic —
// requireVenue is what actually stops a restaurant driving the hotel endpoints.
describe('requireVenue — venue-type feature gating', () => {
  const gate = requireVenue('hotel', 'both');

  function venueCtx(venueType: string | undefined, role = 'admin') {
    return makeCtx('demo', { tenant: { ...TENANT, venueType }, role });
  }

  it('allows a hotel tenant through the hotel gate', async () => {
    const next = vi.fn();
    await gate(venueCtx('hotel'), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('allows a "both" tenant through the hotel gate', async () => {
    const next = vi.fn();
    await gate(venueCtx('both'), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('BLOCKS a restaurant-only tenant with 403', async () => {
    const next = vi.fn();
    await expect(gate(venueCtx('restaurant'), next)).rejects.toMatchObject({ status: 403 });
    expect(next).not.toHaveBeenCalled();
  });

  it('treats a missing venueType as restaurant (fail closed)', async () => {
    const next = vi.fn();
    await expect(gate(venueCtx(undefined), next)).rejects.toMatchObject({ status: 403 });
    expect(next).not.toHaveBeenCalled();
  });

  it('lets super_admin inspect any tenant regardless of venueType', async () => {
    const next = vi.fn();
    await gate(venueCtx('restaurant', 'super_admin'), next);
    expect(next).toHaveBeenCalledOnce();
  });
});
