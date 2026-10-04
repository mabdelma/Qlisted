import { test as base } from '@playwright/test';

/**
 * Shared test fixture.
 *
 * The cookie consent banner renders `fixed inset-x-0 bottom-0 z-[100]`, so it
 * sits on top of anything anchored to the bottom of the viewport — including the
 * bill page's "Pay full amount" button. Playwright resolves such a button fine
 * and then times out waiting for it to become clickable, which reads as a
 * missing feature rather than an obstructed one.
 *
 * Recording the consent choice before the app boots keeps the banner out of the
 * way for every spec, without any test having to know it exists.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('qlisted-cookie-consent', 'all');
      } catch {
        /* storage blocked — the banner will show, same as for a real user */
      }
    });
    await use(page);
  },
});

export { expect } from '@playwright/test';
