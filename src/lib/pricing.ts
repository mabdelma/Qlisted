import type { Locale } from '../contexts/I18nContext';

// Per-locale display currency + an approximate USD→currency rate. Plans are
// priced in USD; these give an indicative localized price for marketing pages
// (actual billing is processed in USD by Stripe). Rates are static — refresh
// occasionally if they drift materially.
const CURRENCY: Record<Locale, { code: string; rate: number; tag: string }> = {
  en: { code: 'USD', rate: 1, tag: 'en-US' },
  es: { code: 'EUR', rate: 0.92, tag: 'es-ES' },
  ar: { code: 'AED', rate: 3.67, tag: 'ar-AE' },
  fr: { code: 'EUR', rate: 0.92, tag: 'fr-FR' },
  de: { code: 'EUR', rate: 0.92, tag: 'de-DE' },
  pt: { code: 'EUR', rate: 0.92, tag: 'pt-PT' },
  zh: { code: 'CNY', rate: 7.1, tag: 'zh-CN' },
  hi: { code: 'INR', rate: 83, tag: 'hi-IN' },
  ru: { code: 'RUB', rate: 90, tag: 'ru-RU' },
  ja: { code: 'JPY', rate: 150, tag: 'ja-JP' },
  it: { code: 'EUR', rate: 0.92, tag: 'it-IT' },
};

/** Indicative price in the locale's currency (whole units), converted from a USD base. */
export function formatPrice(usd: number, locale: Locale): string {
  const c = CURRENCY[locale] ?? CURRENCY.en;
  const amount = Math.round(usd * c.rate);
  try {
    return new Intl.NumberFormat(c.tag, { style: 'currency', currency: c.code, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `$${usd}`;
  }
}

export function currencyCode(locale: Locale): string {
  return (CURRENCY[locale] ?? CURRENCY.en).code;
}

/** Format an amount in the tenant's currency (falls back to USD). */
export function formatMoney(amount: number, currency?: string | null, localeTag = 'en-US'): string {
  try {
    return new Intl.NumberFormat(localeTag, {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}
