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

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    return (localStorage.getItem('locale') as Locale) || 'en';
  });
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
    localStorage.setItem('locale', locale);
  }, [locale]);

  const setLocale = useCallback((l: Locale) => setLocaleState(l), []);

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
