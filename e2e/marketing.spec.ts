import { test, expect } from './fixtures';

test.describe('Marketing pages', () => {
  test('marketing landing page loads', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

    // Hero section
    await expect(page.getByText(/operating system for your restaurant or hotel/i)).toBeVisible();

    // Stats
    await expect(page.getByText('300+', { exact: true })).toBeVisible();
    await expect(page.getByText('1.2M+')).toBeVisible();

    // Features section
    await expect(page.getByText(/everything you need to run the business/i)).toBeVisible();

    // Pricing section
    await expect(page.getByText('Simple, transparent pricing')).toBeVisible();

    // Testimonials
    await expect(page.getByText('Loved by restaurant owners')).toBeVisible();

    // FAQ
    await expect(page.getByText('Frequently asked questions')).toBeVisible();

    // CTA section
    await expect(page.getByText('Ready to digitize your restaurant?')).toBeVisible();

    // Footer navigation links. These names also appear in the header nav, so
    // scope the lookup to the footer landmark to keep the locator unambiguous.
    const footer = page.getByRole('contentinfo');
    await expect(footer.getByRole('link', { name: 'Features' })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'Pricing' })).toBeVisible();
  });

  test('pricing page loads', async ({ page }) => {
    await page.goto('/pricing');

    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

    // Plan cards
    await expect(page.getByText('Starter')).toBeVisible();
    await expect(page.getByText('$29')).toBeVisible();
    await expect(page.getByText('Growth')).toBeVisible();
    await expect(page.getByText('$79')).toBeVisible();
    await expect(page.getByText('Enterprise')).toBeVisible();
    await expect(page.getByText('$199')).toBeVisible();

    // Popular badge on Growth
    await expect(page.getByText('Most Popular')).toBeVisible();

    // CTA buttons on every plan
    await expect(page.getByRole('link', { name: /start free trial/i })).toHaveCount(3);
  });

  test('features page loads', async ({ page }) => {
    await page.goto('/features');

    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

    // The feature grid grows as features ship, so assert it is populated rather
    // than pinning an exact count that goes stale on every addition.
    expect(await page.locator('h3').count()).toBeGreaterThanOrEqual(9);
  });

  test('contact page loads', async ({ page }) => {
    await page.goto('/contact');

    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

    // Contact form fields
    await expect(page.locator('#contact-name')).toBeVisible();
    await expect(page.locator('#contact-email')).toBeVisible();
    await expect(page.locator('#contact-subject')).toBeVisible();
    await expect(page.locator('#contact-message')).toBeVisible();

    // Contact / location info
    await expect(page.getByText('infor@qcart.com')).toBeVisible();
    await expect(page.getByText('Abu Dhabi, UAE')).toBeVisible();
    await expect(page.getByText('Valladolid, Spain')).toBeVisible();
  });

  test('demo page loads', async ({ page }) => {
    await page.goto('/demo');

    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

    // Demo request form
    await expect(page.locator('#demo-name')).toBeVisible();
    await expect(page.locator('#demo-email')).toBeVisible();
    await expect(page.locator('#demo-restaurant')).toBeVisible();
    await expect(page.locator('#demo-phone')).toBeVisible();
    await expect(page.locator('#demo-size')).toBeVisible();
    await expect(page.locator('#demo-message')).toBeVisible();
  });

  test('navigation between marketing pages', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);

    // Click Pricing link in header
    await page.getByRole('link', { name: /pricing/i }).first().click();
    await expect(page).toHaveURL(/\/pricing/);

    // Click Features link in header
    await page.getByRole('link', { name: /features/i }).first().click();
    await expect(page).toHaveURL(/\/features/);
  });

  test('sign in link works', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);

    await page.getByRole('link', { name: /sign in/i }).first().click();
    await expect(page).toHaveURL(/\/signin/);
  });
});
