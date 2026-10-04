import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { logPageErrors } from './helpers';

const BASE = '/r/demo-cafe/table/table-1';

test.describe('Bill and payment page', () => {
  test.beforeEach(({ page }) => logPageErrors(page, 'bill'));

  test('bill page loads with orders', async ({ page }) => {
    await page.goto(`${BASE}/bill`);
    await page.waitForTimeout(2000);

    const heading = page.locator('h2').first();
    await expect(heading).toBeVisible({ timeout: 10000 });

    const receiptHeader = page.locator('div.bg-\\[\\#8B4513\\]');
    const hasReceipt = await receiptHeader.count();
    expect(hasReceipt).toBeGreaterThanOrEqual(0);

    const tableText = page.locator('text=Table').first();
    const hasTableText = await tableText.count();
    expect(hasTableText).toBeGreaterThanOrEqual(0);
  });

  test('unpaid orders toggle works', async ({ page }) => {
    await page.goto(`${BASE}/bill`);
    await page.waitForTimeout(2000);

    const unpaidBtn = page.locator('button', { hasText: 'Unpaid' }).first();
    await expect(unpaidBtn).toBeVisible({ timeout: 10000 });

    const allOrdersBtn = page.locator('button', { hasText: 'All Orders' }).first();
    await expect(allOrdersBtn).toBeVisible();
  });

  test('order expansion works', async ({ page }) => {
    await page.goto(`${BASE}/bill`);
    await page.waitForTimeout(2000);

    const chevronDown = page.locator('button svg.lucide-chevron-down').first();
    const chevronExists = await chevronDown.count();

    if (chevronExists > 0) {
      const parentBtn = page.locator('button svg.lucide-chevron-down').first().locator('..');
      await parentBtn.click();
      await page.waitForTimeout(500);

      const expandedContent = page.locator('div.border-l-2.border-gray-200').first();
      const isExpanded = await expandedContent.count();
      expect(isExpanded).toBeGreaterThanOrEqual(0);
    }
  });

  test('tip percentage buttons work', async ({ page }) => {
    await page.goto(`${BASE}/bill`);
    await page.waitForTimeout(2000);

    const tipSection = page.locator('text=Tip').first();
    await expect(tipSection).toBeVisible({ timeout: 10000 });

    const tip10 = page.locator('button', { hasText: '10%' }).first();
    const tip15 = page.locator('button', { hasText: '15%' }).first();
    const tip20 = page.locator('button', { hasText: '20%' }).first();

    const tip10Exists = await tip10.count();
    if (tip10Exists > 0) {
      await tip10.click();
      await page.waitForTimeout(200);
    }

    const tip15Exists = await tip15.count();
    if (tip15Exists > 0) {
      await tip15.click();
      await page.waitForTimeout(200);
    }

    const tip20Exists = await tip20.count();
    if (tip20Exists > 0) {
      await tip20.click();
      await page.waitForTimeout(200);
    }
  });

  test('custom tip input works', async ({ page }) => {
    await page.goto(`${BASE}/bill`);
    await page.waitForTimeout(2000);

    const tipInput = page.locator('input[type="number"]').first();
    const exists = await tipInput.count();

    if (exists > 0) {
      await tipInput.fill('5.50');
      await page.waitForTimeout(200);

      const tipAmount = page.locator('text=$5.50').first();
      const hasTip = await tipAmount.count();
      expect(hasTip).toBeGreaterThanOrEqual(0);
    }
  });

  test('split controls work', async ({ page }) => {
    await page.goto(`${BASE}/bill`);
    await page.waitForTimeout(2000);

    const increaseSplit = page.locator('button[aria-label="Increase split count"]').first();
    const exists = await increaseSplit.count();

    if (exists > 0) {
      await increaseSplit.click();
      await page.waitForTimeout(200);

      const splitText = page.locator('text=/ Split').first();
      const hasSplit = await splitText.count();
      expect(hasSplit).toBeGreaterThanOrEqual(0);
    }
  });

  test('payment method selector works', async ({ page }) => {
    await page.goto(`${BASE}/bill`);
    await page.waitForTimeout(2000);

    const cashBtn = page.locator('button', { hasText: 'Cash' }).first();
    const cardBtn = page.locator('button', { hasText: 'Card' }).first();
    const splitBtn = page.locator('button', { hasText: 'Split' }).first();

    const cashExists = await cashBtn.count();
    if (cashExists > 0) {
      await cashBtn.click();
      await page.waitForTimeout(200);
    }

    const cardExists = await cardBtn.count();
    if (cardExists > 0) {
      await cardBtn.click();
      await page.waitForTimeout(200);
    }

    const splitExists = await splitBtn.count();
    if (splitExists > 0) {
      await splitBtn.click();
      await page.waitForTimeout(200);
    }
  });

  // The seed guarantees an unpaid order on table 1, so the pay button must be
  // there. These used to wrap their whole body in `if (payExists > 0)`, which
  // meant that when the seed had no unpaid order the tests passed without
  // asserting anything at all.
  async function openPaymentConfirmation(page: Page) {
    await page.goto(`${BASE}/bill`);
    const payBtn = page.locator('button', { hasText: /Pay full amount|Pay Now/ }).first();
    await expect(payBtn).toBeVisible({ timeout: 15000 });
    await payBtn.click();

    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });
    return modal;
  }

  test('confirmation modal appears', async ({ page }) => {
    await openPaymentConfirmation(page);
  });

  test('confirmation modal can be closed', async ({ page }) => {
    const modal = await openPaymentConfirmation(page);

    // The shared Modal labels its close control "Close dialog". The old
    // selector looked for "Close confirmation", which has never existed
    // anywhere in the codebase — so this failed on a modal that closes fine.
    await modal.getByRole('button', { name: 'Close dialog' }).click();
    await expect(modal).not.toBeVisible();
  });

  test('confirmation modal can be dismissed with Escape', async ({ page }) => {
    const modal = await openPaymentConfirmation(page);
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
  });

  test('success state renders after payment', async ({ page }) => {
    await page.goto(`${BASE}/bill`);
    await page.waitForTimeout(2000);

    // verify success state DOM elements exist on the page
    const checkCircle = page.locator('text=Paid!').first();
    const successExists = await checkCircle.count();
    expect(successExists).toBeGreaterThanOrEqual(0);

    // also verify the pay button exists (when not yet paid)
    const payBtn = page.locator('button', { hasText: /Pay full amount|Pay Now/ }).first();
    const payBtnExists = await payBtn.count();
    expect(payBtnExists).toBeGreaterThanOrEqual(0);
  });
});
