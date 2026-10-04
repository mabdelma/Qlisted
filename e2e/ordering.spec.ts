import { test, expect } from './fixtures';

test.describe('Customer ordering flow', () => {
  test('menu page displays categories and items', async ({ page }) => {
    await page.goto('/r/demo-cafe');
    await page.waitForTimeout(1000);

    const menuSection = page.locator('text=Menu').first();
    await expect(menuSection).toBeVisible({ timeout: 10000 });
  });
});
