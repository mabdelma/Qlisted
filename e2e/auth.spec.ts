import { test, expect } from '@playwright/test';

test.describe('Authentication flow', () => {
  test('sign in page renders form', async ({ page }) => {
    await page.goto('/signin');

    await expect(page.locator('h2')).toBeVisible({ timeout: 10000 });

    // Form elements
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();

    // Forgot password link
    await expect(page.getByRole('link', { name: /trouble signing in/i })).toBeVisible();
  });

  test('sign in shows error for invalid credentials', async ({ page }) => {
    await page.goto('/signin');

    await expect(page.locator('h2')).toBeVisible({ timeout: 10000 });

    await page.getByLabel('Email address').fill('wrong@example.com');
    await page.getByLabel('Password', { exact: true }).fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 10000 });
  });

  test('protected admin route redirects to signin', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/signin/, { timeout: 10000 });
  });

  test('protected staff route redirects to signin', async ({ page }) => {
    await page.goto('/staff');
    await expect(page).toHaveURL(/\/signin/, { timeout: 10000 });
  });

  test('protected super-admin route redirects to signin', async ({ page }) => {
    await page.goto('/super-admin');
    await expect(page).toHaveURL(/\/signin/, { timeout: 10000 });
  });

  test('forgot password page loads', async ({ page }) => {
    await page.goto('/signin');

    await expect(page.locator('h2')).toBeVisible({ timeout: 10000 });

    await page.getByRole('link', { name: /trouble signing in/i }).click();
    await expect(page).toHaveURL(/\/forgot-password/);

    // Form elements
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByRole('button', { name: /send reset link/i })).toBeVisible();
  });

  test('reset password page loads', async ({ page }) => {
    await page.goto('/reset-password');

    // Without a token, shows "Invalid or expired reset token."
    await expect(page.getByText(/invalid or expired/i)).toBeVisible({ timeout: 10000 });
  });

  test('verify email page loads', async ({ page }) => {
    await page.goto('/verify-email');

    // Without a token, shows loading then error about invalid/expired token
    await expect(page.getByText(/invalid|expired|loading/i).first()).toBeVisible({ timeout: 10000 });
  });
});
