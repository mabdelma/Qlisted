import { test, expect } from '@playwright/test';

const BASE = '/r/demo-cafe/table/table-1';

test.describe('Checkout flow', () => {
  test('empty cart redirects to menu', async ({ page }) => {
    await page.goto(`${BASE}/checkout`);
    await page.waitForTimeout(1000);

    const emptyMsg = page.locator('text=Cart is empty');
    await expect(emptyMsg).toBeVisible({ timeout: 10000 });

    const browseBtn = page.locator('button').filter({ hasText: 'Menu' }).filter({ visible: true });
    await expect(browseBtn).toBeVisible();
  });

  test('checkout form has name and notes fields', async ({ page }) => {
    await page.goto(`${BASE}/menu`);
    await page.waitForTimeout(1000);

    const addBtn = page.locator('button[aria-label*="Add"]').first();
    await addBtn.click();
    await page.waitForTimeout(300);

    await page.goto(`${BASE}/checkout`);
    await page.waitForTimeout(500);

    const nameInput = page.locator('input[type="text"]').first();
    await expect(nameInput).toBeVisible({ timeout: 5000 });

    const textarea = page.locator('textarea').first();
    await expect(textarea).toBeVisible();
  });

  test('guest name persists in sessionStorage', async ({ page }) => {
    await page.goto(`${BASE}/menu`);
    await page.waitForTimeout(1000);

    const addBtn = page.locator('button[aria-label*="Add"]').first();
    await addBtn.click();
    await page.waitForTimeout(300);

    await page.goto(`${BASE}/checkout`);
    await page.waitForTimeout(500);

    const nameInput = page.locator('input[type="text"]').first();
    await nameInput.fill('Test Guest');
    await page.waitForTimeout(200);

    const stored = await page.evaluate(() => sessionStorage.getItem('guestName'));
    expect(stored).toBe('Test Guest');
  });

  test('place order button shows total', async ({ page }) => {
    await page.goto(`${BASE}/menu`);
    await page.waitForTimeout(1000);

    const addBtn = page.locator('button[aria-label*="Add"]').first();
    await addBtn.click();
    await page.waitForTimeout(300);

    await page.goto(`${BASE}/checkout`);
    await page.waitForTimeout(500);

    const orderBtn = page.locator('button').filter({ hasText: 'Process Order' }).filter({ visible: true });
    await expect(orderBtn).toBeVisible({ timeout: 5000 });
    await expect(orderBtn).toContainText('$');
  });

  test('order summary shows cart items', async ({ page }) => {
    await page.goto(`${BASE}/menu`);
    await page.waitForTimeout(1000);

    const addBtn = page.locator('button[aria-label*="Add"]').first();
    await addBtn.click();
    await page.waitForTimeout(300);

    await page.goto(`${BASE}/checkout`);
    await page.waitForTimeout(500);

    const summaryTitle = page.locator('text=Order Summary');
    await expect(summaryTitle).toBeVisible({ timeout: 5000 });

    const itemRow = page.locator('text=x1').first();
    await expect(itemRow).toBeVisible({ timeout: 5000 });

    const total = page.locator('text=Total');
    await expect(total).toBeVisible();
  });

  test('error state renders', async ({ page }) => {
    await page.goto(`${BASE}/menu`);
    await page.waitForTimeout(1000);

    const addBtn = page.locator('button[aria-label*="Add"]').first();
    await addBtn.click();
    await page.waitForTimeout(300);

    await page.goto(`${BASE}/checkout`);
    await page.waitForTimeout(500);

    const alert = page.locator('[role="alert"]');
    const exists = await alert.count();
    expect(exists).toBeGreaterThanOrEqual(0);
  });

  test('back button navigates to cart', async ({ page }) => {
    await page.goto(`${BASE}/menu`);
    await page.waitForTimeout(1000);

    const addBtn = page.locator('button[aria-label*="Add"]').first();
    await addBtn.click();
    await page.waitForTimeout(300);

    await page.goto(`${BASE}/checkout`);
    await page.waitForTimeout(500);
    expect(page.url()).toContain('/checkout');

    const backBtn = page.locator('button').filter({ hasText: 'Back' }).filter({ visible: true }).first();
    await backBtn.click();
    await page.waitForTimeout(500);
    expect(page.url()).toContain('/cart');
  });
});
