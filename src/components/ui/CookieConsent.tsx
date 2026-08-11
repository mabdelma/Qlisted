import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Cookie } from 'lucide-react';
import { useI18n } from '../../contexts/I18nContext';

const STORAGE_KEY = 'qlisted-cookie-consent';

/**
 * GDPR-style consent notice. Essential cookies always run; the choice here only
 * gates optional/analytics cookies. The decision is remembered per device so the
 * banner shows once. Rendered globally from the app root.
 */
export function CookieConsent() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try { if (!localStorage.getItem(STORAGE_KEY)) setVisible(true); } catch { /* storage blocked */ }
  }, []);

  const choose = (value: 'all' | 'necessary') => {
    try { localStorage.setItem(STORAGE_KEY, value); } catch { /* storage blocked */ }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={t('cookie.title')}
      className="fixed inset-x-0 bottom-0 z-[100] p-3 sm:p-4"
    >
      <div className="mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white shadow-2xl p-5 sm:flex sm:items-center sm:gap-4">
        <div className="flex items-start gap-3 flex-1">
          <Cookie className="h-6 w-6 text-[#0f766e] shrink-0" aria-hidden />
          <p className="text-sm text-gray-600 leading-relaxed">
            {t('cookie.message')}{' '}
            <Link to="/cookies" className="font-medium text-[#0f766e] hover:underline whitespace-nowrap">
              {t('cookie.learnMore')}
            </Link>
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-2 shrink-0">
          <button
            onClick={() => choose('necessary')}
            className="flex-1 sm:flex-none px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            {t('cookie.decline')}
          </button>
          <button
            onClick={() => choose('all')}
            className="flex-1 sm:flex-none px-4 py-2 text-sm rounded-lg bg-[#0f766e] text-white hover:bg-[#1e3a5f] transition-colors"
          >
            {t('cookie.accept')}
          </button>
        </div>
      </div>
    </div>
  );
}
