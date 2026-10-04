import { test, expect } from './fixtures';

test.describe('PWA capabilities', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('service worker is registered', async ({ page }) => {
    const hasSw = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const registrations = await navigator.serviceWorker.getRegistrations();
      return registrations.length > 0;
    });
    expect(hasSw).toBe(true);
  });

  test('manifest link exists', async ({ page }) => {
    const manifest = page.locator('link[rel="manifest"]');
    await expect(manifest).toHaveAttribute('href', /manifest/i);
  });

  test('theme-color meta exists', async ({ page }) => {
    const meta = page.locator('meta[name="theme-color"]');
    await expect(meta).toHaveAttribute('content', /#8B4513|#[\da-fA-F]{6}/);
  });

  test('apple-touch-icon exists', async ({ page }) => {
    const icon = page.locator('link[rel="apple-touch-icon"]');
    await expect(icon).toHaveAttribute('href', /icon/i);
  });

  test('service worker scope includes root', async ({ page }) => {
    const scope = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return null;
      const registrations = await navigator.serviceWorker.getRegistrations();
      if (registrations.length === 0) return null;
      return registrations[0].scope;
    });
    expect(scope).toBeTruthy();
    if (scope) {
      expect(scope).toMatch(/^https?:\/\/[^/]+\/$|^\//);
    }
  });

  test('service worker file is accessible', async ({ page }) => {
    const swUrl = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return null;
      const registrations = await navigator.serviceWorker.getRegistrations();
      if (registrations.length === 0) return null;
      return registrations[0].active?.scriptURL || null;
    });
    if (swUrl) {
      const response = await page.request.get(swUrl);
      expect(response.ok()).toBe(true);
    }
  });

  test('install prompt is not triggered automatically', async ({ page }) => {
    const promptTriggered = await page.evaluate(() => {
      let prompted = false;
      const handler = (e: Event) => {
        prompted = true;
        e.preventDefault();
      };
      window.addEventListener('beforeinstallprompt', handler);
      return new Promise<boolean>((resolve) => {
        setTimeout(() => {
          window.removeEventListener('beforeinstallprompt', handler);
          resolve(prompted);
        }, 2000);
      });
    });
    expect(promptTriggered).toBe(false);
  });
});
