/**
 * Turn whatever was typed into a usable slug.
 *
 * The old rule was `.replace(/[^a-z0-9-]/g, '')`, which DELETES punctuation
 * rather than replacing it. Someone pasted their website and got
 * "httpswwwswissrestaurantscomeg" — which passes the server's
 * /^[a-z0-9-]+$/ check, so nothing rejected it and that is now their live URL.
 *
 * Two changes: separators become dashes instead of vanishing ("my restaurant"
 * -> "my-restaurant"), and a pasted URL is reduced to its main label rather
 * than being mashed into one word.
 */
export function toSlug(raw: string): string {
  let v = raw.trim().toLowerCase();

  // Looks like a URL? Keep the significant part of the host.
  const urlish = v.match(/^(?:https?:\/\/)?(?:www\.)?([^/\s?#]+)/);
  if (urlish && v.includes('.')) {
    const host = urlish[1];
    const labels = host.split('.').filter(Boolean);
    // Drop the TLD and any country suffix: swissrestaurants.com.eg -> swissrestaurants
    const significant = labels.length > 1 ? labels[0] : host;
    v = significant;
  }

  return v
    .replace(/[^a-z0-9]+/g, '-')  // separators become dashes, not nothing
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 50);
}
