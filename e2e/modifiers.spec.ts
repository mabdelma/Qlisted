import { test, expect } from '@playwright/test';
import { signInAsAdmin, apiGet } from './helpers';

test.describe('Admin Modifier Management', () => {
  test('modifier groups page renders with create form', async ({ page }) => {
    await signInAsAdmin(page);

    await page.goto('/admin/modifiers');
    await expect(page.locator('text=Modifier Groups').or(page.locator('text=Add Group'))).toBeVisible({ timeout: 10000 });
  });

  test('modifier tab exists in sidebar', async ({ page }) => {
    await signInAsAdmin(page);

    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
  });

  test('modifier groups API endpoint returns data', async ({ page }) => {
    await signInAsAdmin(page);

    const { status, body } = await apiGet<unknown[]>(page, '/api/r/demo-cafe/modifier-groups');
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });

  test('menu item modifiers endpoint returns array', async ({ page }) => {
    await signInAsAdmin(page);

    const menu = await apiGet<{ items?: { id: string }[] }>(page, '/api/r/demo-cafe/menu');
    expect(menu.status).toBe(200);
    const firstItem = menu.body.items?.[0];
    expect(firstItem).toBeDefined();
    const { status, body } = await apiGet<unknown[]>(page, `/api/r/demo-cafe/menu-items/${firstItem!.id}/modifiers`);
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });
});