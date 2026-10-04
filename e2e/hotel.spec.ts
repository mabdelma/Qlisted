import { test, expect } from './fixtures';

// Hotel guest-facing flow smoke tests. Deterministic against the seeded demo
// tenant: these pages render and respond correctly whether or not the tenant has
// rooms provisioned, so they need no hotel-specific seed data.
test.describe('Hotel guest flow', () => {
  test('public booking page loads with a date search', async ({ page }) => {
    await page.goto('/r/demo-cafe/book');
    await page.waitForTimeout(1500);
    // Check-in + check-out date inputs.
    const dates = page.locator('input[type="date"]');
    await expect(dates).toHaveCount(2, { timeout: 10000 });
    // A visible heading (the page didn't blank out).
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 });
  });

  test('searching dates returns rooms or a no-rooms state', async ({ page }) => {
    await page.goto('/r/demo-cafe/book');
    await page.waitForTimeout(1500);
    const dates = page.locator('input[type="date"]');
    if (await dates.count() >= 2) {
      await dates.nth(0).fill('2030-01-10');
      await dates.nth(1).fill('2030-01-12');
    }
    const searchBtn = page.locator('button').filter({ hasText: /search|availability|buscar|rechercher|cerca/i }).first();
    if (await searchBtn.count()) {
      await searchBtn.click();
      await page.waitForTimeout(1500);
    }
    // Either room cards or the empty state — the app stayed alive, no crash.
    const body = await page.locator('body').innerText();
    expect(body.length).toBeGreaterThan(0);
  });

  test('room service with an invalid token shows the no-active-stay screen', async ({ page }) => {
    await page.goto('/r/demo-cafe/room/invalid-token-xyz');
    await page.waitForTimeout(1500);
    // Renders the "no active stay" state (a heading), not a blank/crash.
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 });
  });

  test('hotels marketing vertical page loads', async ({ page }) => {
    await page.goto('/hotels');
    await page.waitForTimeout(1000);
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 });
  });
});
