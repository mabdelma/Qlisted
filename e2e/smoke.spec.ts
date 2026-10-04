import { test, expect } from './fixtures';

test.describe('Smoke tests', () => {
  test('marketing landing page loads', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('sign-in page loads', async ({ page }) => {
    await page.goto('/signin');
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('restaurant landing page works', async ({ page }) => {
    await page.goto('/r/demo-cafe');
    await expect(page).toHaveURL(/\/r\/demo-cafe/);
  });

  test('health endpoint responds', async ({ page }) => {
    const response = await page.request.get('/api/health');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.status).toBe('ok');
  });
});
