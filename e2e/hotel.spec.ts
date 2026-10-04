import { test, expect } from './fixtures';

// Hotel guest-facing flow. Targets the `demo-hotel` tenant (venueType: 'hotel'),
// which seed.ts provisions with rooms, a live checked-in stay and a folio — so
// these assert real content instead of merely "the page didn't crash".
// Set SEED_ROOM_TOKEN when seeding to address the in-room link directly.
const HOTEL = 'demo-hotel';

test.describe('Hotel guest flow', () => {
  test('public booking page loads with a date search', async ({ page }) => {
    await page.goto(`/r/${HOTEL}/book`);
    // Check-in + check-out date inputs.
    const dates = page.locator('input[type="date"]');
    await expect(dates).toHaveCount(2, { timeout: 10000 });
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 });
  });

  test('searching free dates lists the hotel\'s actual rooms', async ({ page }) => {
    await page.goto(`/r/${HOTEL}/book`);
    const dates = page.locator('input[type="date"]');
    await expect(dates).toHaveCount(2, { timeout: 10000 });
    await dates.nth(0).fill('2030-01-10');
    await dates.nth(1).fill('2030-01-12');

    const searchBtn = page.locator('button').filter({ hasText: /search|availability|buscar|rechercher|cerca/i }).first();
    await searchBtn.click();

    // Both seeded bookings are near-term, so a 2030 window leaves all five
    // rooms free and every one of them must be offered.
    //
    // Matched on the accessible name rather than text content: the number and
    // the room type sit in sibling <p> elements with no whitespace between
    // them, so textContent is "101Double140.00/ night" — a \b right after the
    // number has a digit on one side and a letter on the other and therefore
    // never matches. The accessible name keeps the spaces.
    for (const number of ['101', '102', '103', '201', '202']) {
      await expect(
        page.getByRole('button', { name: new RegExp(`^${number}\\s`) }),
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test('a hotel restaurant-only item is not offered for room service', async ({ page }) => {
    // No token → no active stay screen, which is the guard that keeps the
    // room-service menu from being served to a dead link.
    await page.goto(`/r/${HOTEL}/room/invalid-token-xyz`);
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/no active stay/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('a restaurant tenant does not serve the hotel booking page', async ({ page }) => {
    // requireVenue('hotel','both') now rejects this server-side; the SPA still
    // mounts, so assert the search yields nothing rather than rooms.
    await page.goto('/r/demo-cafe/book');
    const dates = page.locator('input[type="date"]');
    await expect(dates).toHaveCount(2, { timeout: 10000 });
    await dates.nth(0).fill('2030-01-10');
    await dates.nth(1).fill('2030-01-12');
    const searchBtn = page.locator('button').filter({ hasText: /search|availability|buscar|rechercher|cerca/i }).first();
    await searchBtn.click();
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).not.toContainText('Suite');
  });

  test('room service offers deliverable items but hides restaurant-only ones', async ({ page }) => {
    const token = process.env.SEED_ROOM_TOKEN || 'e2e-room-token-fixed';
    await page.goto(`/r/${HOTEL}/room/${token}`);

    // Seeded checked-in stay on room 101 greets the guest by name.
    await expect(page.getByText(/Alex Rivera/).first()).toBeVisible({ timeout: 10000 });

    // Items flagged roomServiceAvailable: true are offered...
    await expect(page.getByText('Club Sandwich').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Room Service Coffee').first()).toBeVisible({ timeout: 10000 });
    // ...and the restaurant-only item is not.
    await expect(page.getByText("Chef's Tasting Menu")).toHaveCount(0);
  });

  test('hotels marketing vertical page loads', async ({ page }) => {
    await page.goto('/hotels');
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 });
  });
});