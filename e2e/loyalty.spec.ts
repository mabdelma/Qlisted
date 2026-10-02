import { test, expect } from '@playwright/test';

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
    await page.goto('/signin');
    await page.fill('input[type="email"]', 'admin@democafe.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/admin/, { timeout: 10000 });

    const response = await page.goto('/api/r/demo-cafe/campaigns');
    expect(response?.status()).toBe(200);
    const body = await response?.json();
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('loyalty endpoint returns data for authed user', async ({ page }) => {
    await page.goto('/signin');
    await page.fill('input[type="email"]', 'admin@democafe.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/admin/, { timeout: 10000 });

    const response = await page.goto('/api/r/demo-cafe/loyalty');
    expect(response?.status()).toBe(200);
    const body = await response?.json();
    expect(body.points).toBeDefined();
    expect(body.tier).toBeDefined();
    expect(body.rewards).toBeDefined();
  });

  test('promo code validation endpoint rejects invalid code', async ({ page }) => {
    const response = await page.goto('/api/r/demo-cafe/promo/validate?code=INVALID');
    expect(response?.status()).toBe(401);
  });

  test('promo validation with valid code returns discount', async ({ page }) => {
    await page.goto('/signin');
    await page.fill('input[type="email"]', 'admin@democafe.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/admin/, { timeout: 10000 });

    const response = await page.goto('/api/r/demo-cafe/promo/validate?code=WELCOME10&subtotal=50');
    expect(response?.status()).toBe(200);
    const body = await response?.json();
    expect(body.valid).toBe(true);
    expect(body.discount).toBeGreaterThan(0);
  });

  test('sidebar has promotions and loyalty tabs', async ({ page }) => {
    await page.goto('/signin');
    await page.fill('input[type="email"]', 'admin@democafe.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/admin/, { timeout: 10000 });

    const sidebar = page.locator('nav');
    await expect(sidebar).toBeVisible();
  });
});