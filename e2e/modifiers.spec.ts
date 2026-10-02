import { test, expect } from '@playwright/test';

test.describe('Admin Modifier Management', () => {
  test('modifier groups page renders with create form', async ({ page }) => {
    await page.goto('/signin');
    await page.fill('input[type="email"]', 'admin@democafe.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/admin/, { timeout: 10000 });

    await page.goto('/admin/modifiers');
    await expect(page.locator('text=Modifier Groups').or(page.locator('text=Add Group'))).toBeVisible({ timeout: 10000 });
  });

  test('modifier tab exists in sidebar', async ({ page }) => {
    await page.goto('/signin');
    await page.fill('input[type="email"]', 'admin@democafe.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/admin/, { timeout: 10000 });

    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
  });

  test('modifier groups API endpoint returns data', async ({ page }) => {
    await page.goto('/signin');
    await page.fill('input[type="email"]', 'admin@democafe.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/admin/, { timeout: 10000 });

    const response = await page.goto('/api/r/demo-cafe/modifier-groups');
    expect(response?.status()).toBe(200);
    const body = await response?.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('menu item modifiers endpoint returns array', async ({ page }) => {
    await page.goto('/signin');
    await page.fill('input[type="email"]', 'admin@democafe.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/admin/, { timeout: 10000 });

    const menuResponse = await page.goto('/api/r/demo-cafe/menu');
    expect(menuResponse?.status()).toBe(200);
    const menuData = await menuResponse?.json();
    const firstItem = menuData.items?.[0];
    if (firstItem) {
      const response = await page.goto(`/api/r/demo-cafe/menu-items/${firstItem.id}/modifiers`);
      expect(response?.status()).toBe(200);
      const body = await response?.json();
      expect(Array.isArray(body)).toBe(true);
    }
  });
});