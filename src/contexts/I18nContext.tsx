import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

export type Locale = 'en' | 'ar' | 'es' | 'fr' | 'de' | 'pt' | 'zh' | 'hi' | 'ru' | 'ja' | 'it';

export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English', ar: 'العربية', es: 'Español', fr: 'Français', de: 'Deutsch',
  pt: 'Português', zh: '中文', hi: 'हिन्दी', ru: 'Русский', ja: '日本語', it: 'Italiano',
};

const RTL_LOCALES: Set<Locale> = new Set(['ar']);

// Translation keys are derived from the English dictionary — the single source
// of truth. Re-exported here so consumers keep importing it from this context.
export type { TranslationKey } from '../lib/i18n/translations/en';
import type { TranslationKey } from '../lib/i18n/translations/en';

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  dir: 'ltr' | 'rtl';
}

const I18nContext = createContext<I18nContextValue | null>(null);

async function loadTranslations(locale: Locale): Promise<Partial<Record<TranslationKey, string>>> {
  const mod = await import(`../lib/i18n/translations/${locale}.ts`);
  return mod.translations;
}

let fallbackTranslations: Partial<Record<TranslationKey, string>> | null = null;

/**
 * Which language to open in, for someone who has never been here before.
 *
 * This used to be `localStorage.getItem('locale') || 'en'` — so a guest
 * scanning a QR code got ENGLISH no matter what their phone was set to, and
 * had to find the switcher themselves. On a product whose headline feature is
 * removing the language barrier, that was the barrier.
 *
 * Order matters: an explicit choice always wins, because someone who picked a
 * language should not have it overridden by their device on the next visit.
 * Only when there is no stored choice do we read the browser, which on a phone
 * is the device language and on the mobile app's WebView is the OS language.
 *
 * `navigator.languages` is preferred over `.language`: a user whose first
 * preference we do not ship may well have a second that we do.
 */
function detectInitialLocale(): Locale {
  try {
    const stored = localStorage.getItem('locale') as Locale | null;
    if (stored && stored in LOCALE_NAMES) return stored;
  } catch {
    /* storage blocked (private mode, embedded webview) — fall through */
  }

  const candidates = typeof navigator !== 'undefined'
    ? [...(navigator.languages ?? []), navigator.language].filter(Boolean)
    : [];

  for (const tag of candidates) {
    // Match on the base subtag: "es-419" and "es-MX" are both Spanish to us,
    // and "zh-Hant" should still land on Chinese rather than English.
    const base = tag.toLowerCase().split('-')[0];
    if (base in LOCALE_NAMES) return base as Locale;
  }
  return 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectInitialLocale);
  const [translations, setTranslations] = useState<Partial<Record<TranslationKey, string>> | null>(null);

  useEffect(() => {
    loadTranslations(locale).then(setTranslations);
    if (!fallbackTranslations) {
      loadTranslations('en').then((t) => { fallbackTranslations = t; });
    }
  }, [locale]);

  useEffect(() => {
    document.documentElement.dir = RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;
  }, [locale]);

  // Persist only a deliberate choice, never the detected one. Writing the
  // detection back would make it indistinguishable from a choice on the next
  // visit, so a guest who later switched their phone to Arabic would keep
  // getting whatever we guessed the first time.
  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem('locale', l);
    } catch {
      /* storage blocked — the choice still applies for this session */
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>): string => {
      const dict = translations || fallbackTranslations;
      let msg = dict?.[key] || key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          msg = msg.replace(`{${k}}`, String(v));
        }
      }
      return msg;
    },
    [translations],
  );

  const dir: 'ltr' | 'rtl' = RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, dir }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
