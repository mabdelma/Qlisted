import { describe, it, expect } from 'vitest';
import { toSlug } from './slug';

/**
 * Deriving a tenant slug from whatever the operator typed.
 *
 * The old rule was `.replace(/[^a-z0-9-]/g, '')`, which DELETES punctuation
 * instead of replacing it. A real customer pasted their website and ended up
 * with the slug "httpswwwswissrestaurantscomeg" — which passes the server's
 * /^[a-z0-9-]+$/ check, so nothing rejected it and it became their live URL.
 * That exact input is the first case here.
 */
describe('toSlug', () => {
  it('reduces a pasted URL to its meaningful label', () => {
    // The production case.
    expect(toSlug('https://www.swissrestaurants.com.eg')).toBe('swissrestaurants');
  });

  it('turns separators into dashes rather than deleting them', () => {
    // The old behaviour collapsed this to "myrestaurant".
    expect(toSlug('My Restaurant')).toBe('my-restaurant');
  });

  it('handles a bare host with a multi-part TLD', () => {
    expect(toSlug('www.pizza.co.uk')).toBe('pizza');
  });

  it('leaves an already-valid slug alone', () => {
    expect(toSlug('already-fine')).toBe('already-fine');
  });

  it('collapses runs of separators and trims the edges', () => {
    expect(toSlug('  A & B   Grill  ')).toBe('a-b-grill');
  });

  it('strips accents down to something URL-safe without merging words', () => {
    // Not transliteration — just no empty or doubled dashes.
    const out = toSlug('Café Du Nord');
    expect(out).not.toMatch(/^-|-$|--/);
    expect(out.split('-').length).toBe(3);
  });

  it('never returns something the server would reject', () => {
    const inputs = ['https://x.com', '!!!', 'A  B', 'ÜBER Grill', '  ', 'a'.repeat(80)];
    for (const i of inputs) {
      const out = toSlug(i);
      if (out) expect(out).toMatch(/^[a-z0-9-]+$/);
      expect(out.length).toBeLessThanOrEqual(50);
    }
  });

  it('returns empty for input with nothing usable, rather than a stray dash', () => {
    // An empty field is a validation error the form can show; "-" would be
    // accepted by the server and become a real, broken tenant URL.
    expect(toSlug('!!!')).toBe('');
    expect(toSlug('   ')).toBe('');
  });
});
