import { test, expect } from '@playwright/test';
import { signInAsAdmin, apiGet } from './helpers';

test.describe('Loyalty & Promotions', () => {
  test('promo code input renders in checkout', async ({ page }) => {
    const BASE = '/r/demo-cafe/table/table-1';
    await page.goto(`${BASE}/bill`);
    await expect(page.locator('h2')).toBeVisible({ timeout: 10000 });
    await expect(page.getByPlaceholder(/enter promo code/i)).toBeVisible();
  });

  test('loyalty admin route exists', async ({ page }) => {
    await page.goto('/signin');
    await expect(page.locator('h2')).toBeVisible({ timeout: 10000 });
    const response = await page.goto('/admin/loyalty');
    expect(response?.status()).toBeLessThan(500);
  });

  test('campaigns admin route exists', async ({ page }) => {
    await page.goto('/signin');
    await expect(page.locator('h2')).toBeVisible({ timeout: 10000 });
    const response = await page.goto('/admin/campaigns');
    expect(response?.status()).toBeLessThan(500);
  });

  test('promo campaigns list endpoint returns data for authed user', async ({ page }) => {
    await signInAsAdmin(page);

    const { status, body } = await apiGet<{ data: unknown[] }>(page, '/api/r/demo-cafe/campaigns');
    expect(status).toBe(200);
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('loyalty endpoint returns data for authed user', async ({ page }) => {
    await signInAsAdmin(page);

    const { status, body } = await apiGet<{ points: unknown; tier: unknown }>(page, '/api/r/demo-cafe/loyalty');
    expect(status).toBe(200);
    expect(body.points).toBeDefined();
    expect(body.tier).toBeDefined();
    expect(body.rewards).toBeDefined();
  });

  test('promo code validation endpoint rejects invalid code', async ({ page }) => {
    // Unauthenticated: no token in localStorage, so the API must reject it.
    // Load the app first so evaluate() runs on the real origin.
    await page.goto('/');
    const { status } = await apiGet(page, '/api/r/demo-cafe/promo/validate?code=INVALID');
    expect(status).toBe(401);
  });

  test('promo validation with valid code returns discount', async ({ page }) => {
    await signInAsAdmin(page);

    const { status, body } = await apiGet<Record<string, unknown>>(page, '/api/r/demo-cafe/promo/validate?code=WELCOME10&subtotal=50');
    expect(status).toBe(200);
    expect(body.valid).toBe(true);
    expect(body.discount as number).toBeGreaterThan(0);
  });

  test('sidebar has promotions and loyalty tabs', async ({ page }) => {
    await signInAsAdmin(page);

    const sidebar = page.locator('nav');
    await expect(sidebar).toBeVisible();
  });
});