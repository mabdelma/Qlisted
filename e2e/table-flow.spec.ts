import { test, expect } from '@playwright/test';

const BASE = '/r/demo-cafe/table/table-1';

test.describe('Customer ordering flow', () => {
  test('menu page displays categories and items', async ({ page }) => {
    await page.goto(`${BASE}/menu`);
    await page.waitForTimeout(1000);

    const searchInput = page.locator('input[aria-label="Search menu..."]');
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    const catCount = await page.locator('div.flex.space-x-2.overflow-x-auto button').count();
    expect(catCount).toBeGreaterThanOrEqual(1);

    const menuItems = page.locator('div.space-y-3 > div[role="button"]');
    await expect(menuItems.first()).toBeVisible({ timeout: 10000 });

    const priceText = page.locator('text=$').first();
    await expect(priceText).toBeVisible();
  });

  test('category filter works', async ({ page }) => {
    await page.goto(`${BASE}/menu`);
    await page.waitForTimeout(1000);

    const catButtons = page.locator('div.flex.space-x-2.overflow-x-auto button');
    const initialCount = await catButtons.count();
    expect(initialCount).toBeGreaterThanOrEqual(2);

    const secondCat = catButtons.nth(1);
    await secondCat.click();
    await page.waitForTimeout(300);

    const activeCat = catButtons.locator('.bg-\\[\\#8B4513\\]');
    await expect(activeCat).toHaveCount(1);
  });

  test('search filters items', async ({ page }) => {
    await page.goto(`${BASE}/menu`);
    await page.waitForTimeout(1000);

    const searchInput = page.locator('input[aria-label="Search menu..."]');
    await searchInput.fill('zzzzz_nonexistent');
    await page.waitForTimeout(300);

    const noResults = page.locator('text=No results found');
    await expect(noResults).toBeVisible({ timeout: 5000 });
  });

  test('item detail page loads', async ({ page }) => {
    await page.goto(`${BASE}/menu`);
    await page.waitForTimeout(1000);

    const firstItem = page.locator('div.space-y-3 > div[role="button"]').first();
    await firstItem.click();
    await page.waitForTimeout(500);

    expect(page.url()).toContain('/menu/');

    await expect(page.locator('text=$')).toBeVisible({ timeout: 5000 });
    const decreaseBtn = page.locator('button[aria-label="Decrease quantity"]');
    await expect(decreaseBtn).toBeVisible();
    const increaseBtn = page.locator('button[aria-label="Increase quantity"]');
    await expect(increaseBtn).toBeVisible();

    const addToCartBtn = page.locator('button', { hasText: 'Add to Cart' });
    await expect(addToCartBtn).toBeVisible();

    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible();

    const backBtn = page.locator('button', { hasText: 'Back' });
    await expect(backBtn).toBeVisible();
  });

  test('add item to cart from menu', async ({ page }) => {
    await page.goto(`${BASE}/menu`);
    await page.waitForTimeout(1000);

    const addBtn = page.locator('button[aria-label*="Add"]').first();
    await addBtn.click();
    await page.waitForTimeout(200);

    const checkIcon = addBtn.locator('svg');
    await expect(checkIcon).toBeVisible();
  });

  test('add item to cart from detail page', async ({ page }) => {
    await page.goto(`${BASE}/menu`);
    await page.waitForTimeout(1000);

    const firstItem = page.locator('div.space-y-3 > div[role="button"]').first();
    await firstItem.click();
    await page.waitForTimeout(500);

    const increaseBtn = page.locator('button[aria-label="Increase quantity"]');
    await increaseBtn.click();
    await page.waitForTimeout(200);

    const textarea = page.locator('textarea');
    await textarea.fill('No onions please');

    const addToCartBtn = page.locator('button', { hasText: 'Add to Cart' });
    await addToCartBtn.click();
    await page.waitForTimeout(300);

    await expect(page.locator('text=Done')).toBeVisible({ timeout: 5000 });
    const continueBtn = page.locator('button', { hasText: 'Continue' });
    await expect(continueBtn).toBeVisible();
    const viewCartBtn = page.locator('button', { hasText: 'Cart' });
    await expect(viewCartBtn).toBeVisible();
  });

  test('cart page shows items', async ({ page }) => {
    await page.goto(`${BASE}/menu`);
    await page.waitForTimeout(1000);

    const addBtn = page.locator('button[aria-label*="Add"]').first();
    await addBtn.click();
    await page.waitForTimeout(300);

    await page.goto(`${BASE}/cart`);
    await page.waitForTimeout(500);

    const itemName = page.locator('h3.font-medium.text-gray-900').first();
    await expect(itemName).toBeVisible({ timeout: 5000 });

    const price = page.locator('text=$').first();
    await expect(price).toBeVisible();
  });

  test('adjust quantity in cart', async ({ page }) => {
    await page.goto(`${BASE}/menu`);
    await page.waitForTimeout(1000);

    const addBtn = page.locator('button[aria-label*="Add"]').first();
    await addBtn.click();
    await page.waitForTimeout(300);

    await page.goto(`${BASE}/cart`);
    await page.waitForTimeout(500);

    const increaseBtn = page.locator('button[aria-label*="Increase quantity"]').first();
    await increaseBtn.click();
    await page.waitForTimeout(300);

    const qtyText = page.locator('span.font-medium.w-6.text-center').first();
    const qty = await qtyText.textContent();
    expect(Number(qty)).toBeGreaterThanOrEqual(2);

    const decreaseBtn = page.locator('button[aria-label*="Decrease quantity"]').first();
    await decreaseBtn.click();
    await page.waitForTimeout(300);

    const qtyAfter = await qtyText.textContent();
    expect(Number(qtyAfter)).toBeGreaterThanOrEqual(1);
  });

  test('remove item from cart', async ({ page }) => {
    await page.goto(`${BASE}/menu`);
    await page.waitForTimeout(1000);

    const addBtn = page.locator('button[aria-label*="Add"]').first();
    await addBtn.click();
    await page.waitForTimeout(300);

    await page.goto(`${BASE}/cart`);
    await page.waitForTimeout(500);

    const removeBtn = page.locator('button[aria-label*="Remove"]').first();
    await removeBtn.click();
    await page.waitForTimeout(300);

    const emptyMsg = page.locator('text=Cart is empty');
    await expect(emptyMsg).toBeVisible({ timeout: 5000 });
  });

  test('clear cart', async ({ page }) => {
    await page.goto(`${BASE}/menu`);
    await page.waitForTimeout(1000);

    const addBtn = page.locator('button[aria-label*="Add"]').first();
    await addBtn.click();
    await page.waitForTimeout(300);

    await page.goto(`${BASE}/cart`);
    await page.waitForTimeout(500);

    const clearBtn = page.locator('button', { hasText: 'Clear Cart' });
    await clearBtn.click();
    await page.waitForTimeout(300);

    const emptyMsg = page.locator('text=Cart is empty');
    await expect(emptyMsg).toBeVisible({ timeout: 5000 });
  });

  test('header nav links work', async ({ page }) => {
    await page.goto(`${BASE}/menu`);
    await page.waitForTimeout(1000);

    const cartLink = page.locator('header a', { hasText: 'Cart' }).first();
    await cartLink.click();
    await page.waitForTimeout(500);
    expect(page.url()).toContain('/cart');

    const ordersLink = page.locator('header a', { hasText: 'Orders' }).first();
    await ordersLink.click();
    await page.waitForTimeout(500);
    expect(page.url()).toContain('/orders');

    const billLink = page.locator('header a', { hasText: 'Bill' }).first();
    await billLink.click();
    await page.waitForTimeout(500);
    expect(page.url()).toContain('/bill');

    const menuLink = page.locator('header a', { hasText: 'Menu' }).first();
    await menuLink.click();
    await page.waitForTimeout(500);
    expect(page.url()).toContain('/menu');
  });

  test('breadcrumb shows correct step', async ({ page }) => {
    await page.goto(`${BASE}/menu`);
    await page.waitForTimeout(500);

    const breadcrumb = page.locator('nav[aria-label="Order progress"]');
    await expect(breadcrumb).toBeVisible();

    await page.goto(`${BASE}/cart`);
    await page.waitForTimeout(500);
    await expect(breadcrumb).toBeVisible();

    await page.goto(`${BASE}/checkout`);
    await page.waitForTimeout(500);
    await expect(breadcrumb).toBeVisible();

    await page.goto(`${BASE}/bill`);
    await page.waitForTimeout(500);
    await expect(breadcrumb).toBeVisible();

    const links = breadcrumb.locator('a');
    const count = await links.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('floating cart button appears', async ({ page }) => {
    await page.goto(`${BASE}/menu`);
    await page.waitForTimeout(1000);

    const floatingCart = page.locator('a[aria-label*="View cart"]');
    await expect(floatingCart).not.toBeVisible();

    const addBtn = page.locator('button[aria-label*="Add"]').first();
    await addBtn.click();
    await page.waitForTimeout(300);

    await expect(floatingCart).toBeVisible({ timeout: 5000 });
    const ariaLabel = await floatingCart.getAttribute('aria-label');
    expect(ariaLabel).toContain('items');
    expect(ariaLabel).toContain('$');
  });
});
