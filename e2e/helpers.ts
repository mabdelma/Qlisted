import type { Page } from '@playwright/test';

export const ADMIN_EMAIL = 'admin@democafe.com';
export const ADMIN_PASSWORD = 'password123';

/** Sign in through the real form and wait until the admin portal is reached. */
export async function signInAsAdmin(page: Page) {
  await page.goto('/signin');
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/admin/, { timeout: 10000 });
}

/**
 * Call the API the way the app does: from the page origin, carrying the bearer
 * token the client keeps in localStorage.
 *
 * A plain `page.goto('/api/...')` is a document navigation and sends no
 * Authorization header, so every authenticated endpoint answered 401 no matter
 * how the test had signed in.
 */
export async function apiGet<T>(page: Page, path: string): Promise<{ status: number; body: T }> {
  return page.evaluate(async (p) => {
    const token = localStorage.getItem('token');
    const res = await fetch(p, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { status: res.status, body };
  }, path) as Promise<{ status: number; body: T }>;
}

/**
 * Surface uncaught page errors in the test output. The route error boundary
 * replaces the page with "Something went wrong", which hides the real stack from
 * the failure artifact — this puts it in the CI log.
 */
export function logPageErrors(page: Page, label: string) {
  page.on('pageerror', (err) => {
    console.log(`PAGEERROR[${label}] ${err.message}\n${err.stack ?? ''}`);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log(`CONSOLE-ERROR[${label}] ${msg.text()}`);
  });
}
