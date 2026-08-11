import { useState } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, Sparkles, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';

/**
 * Non-intrusive billing banner: warns past-due tenants and nudges trial tenants
 * to upgrade. Soft-surface only — never blocks access. The trial nudge is
 * dismissible for the session.
 */
export function SubscriptionBanner() {
  const { t } = useI18n();
  const { state: { tenant } } = useAuth();
  const status = tenant?.subscription?.status;
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem('qlisted-trial-dismissed') === '1'; } catch { return false; }
  });

  if (status === 'past_due') {
    return (
      <div className="bg-red-50 border-b border-red-200 px-4 py-2.5 flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-red-700"><AlertTriangle className="w-4 h-4 shrink-0" /> {t('billing.pastDueMsg')}</p>
        <Link to="/admin/subscription" className="text-sm font-medium text-red-700 underline whitespace-nowrap">{t('billing.manage')}</Link>
      </div>
    );
  }
  if (status === 'trial' && !dismissed) {
    return (
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-amber-800"><Sparkles className="w-4 h-4 shrink-0" /> {t('billing.trialMsg')}</p>
        <div className="flex items-center gap-3 shrink-0">
          <Link to="/admin/subscription" className="text-sm font-medium text-[#0f766e] underline whitespace-nowrap">{t('billing.upgrade')}</Link>
          <button onClick={() => { try { sessionStorage.setItem('qlisted-trial-dismissed', '1'); } catch { /* storage blocked */ } setDismissed(true); }}
            className="text-amber-500 hover:text-amber-700" aria-label="Dismiss"><X className="w-4 h-4" /></button>
        </div>
      </div>
    );
  }
  return null;
}
