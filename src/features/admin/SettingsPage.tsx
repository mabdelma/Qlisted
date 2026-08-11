import { useState } from 'react';
import { CreditCard, Check, AlertTriangle, Store } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { tenantApi } from '../../lib/api';
import type { VenueType } from '../../lib/api/types';

export function SettingsPage() {
  const { t } = useI18n();
  const { state: { tenant } } = useAuth();
  const slug = tenant?.slug;
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [stripeAccountId, setStripeAccountId] = useState(tenant?.stripeAccountId || '');
  const [venueType, setVenueType] = useState<VenueType>(tenant?.venueType || 'restaurant');
  const [savingVenue, setSavingVenue] = useState(false);

  async function saveVenueType(v: VenueType) {
    if (!slug || v === venueType) return;
    setVenueType(v); setSavingVenue(true);
    try { await tenantApi.updateSettings(slug, { venueType: v }); window.location.reload(); }
    catch { setSavingVenue(false); }
  }

  const hasStripeKey = !!import.meta.env.VITE_STRIPE_KEY || false;
  const stripeConfigured = hasStripeKey || !!stripeAccountId;

  async function handleSave() {
    if (!slug) return;
    setSaving(true);
    try {
      await tenantApi.updateSettings(slug, { stripeAccountId: stripeAccountId || undefined });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* ignore */ }
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">{t('common.settings')}</h2>

      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div className="flex items-center gap-3 mb-1">
          <Store className="w-6 h-6 text-[#0f766e]" />
          <h3 className="text-lg font-medium">{t('settings.businessType')}</h3>
        </div>
        <p className="text-sm text-gray-500">{t('settings.businessTypeHint')}</p>
        <div className="grid grid-cols-3 gap-2 max-w-md">
          {([['restaurant', '🍽️', t('venue.restaurant')], ['hotel', '🏨', t('venue.hotel')], ['both', '✨', t('venue.both')]] as const).map(([v, icon, label]) => (
            <button key={v} type="button" disabled={savingVenue} onClick={() => saveVenueType(v)}
              className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-sm transition-colors disabled:opacity-60 ${venueType === v ? 'border-[#0f766e] bg-[#0f766e]/5 text-[#0f766e] font-medium' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
              <span className="text-xl">{icon}</span>{label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <CreditCard className="w-6 h-6 text-[#0f766e]" />
          <h3 className="text-lg font-medium">{t('settings.stripePayments')}</h3>
        </div>

        <div className={`flex items-center gap-2 p-3 rounded-md ${stripeConfigured ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
          {stripeConfigured ? <Check className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          <span className="text-sm">
            {stripeConfigured ? t('settings.stripeConfigured') : t('settings.stripeNotConfigured')}
          </span>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('settings.stripeAccountId')} <span className="text-gray-400">{t('settings.optional')}</span>
          </label>
          <input type="text" value={stripeAccountId}
            onChange={(e) => setStripeAccountId(e.target.value)}
            placeholder="acct_xxxxxxxxxxxxxxxx"
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-[#0f766e] focus:border-[#0f766e]" />
          <p className="text-xs text-gray-500 mt-1">
            {t('settings.stripeAccountHint')}
          </p>
        </div>

        <button onClick={handleSave} disabled={saving}
          className="px-4 py-2 bg-[#0f766e] text-white rounded-md hover:bg-[#1e3a5f] disabled:opacity-50">
          {saved ? t('settings.saved') : saving ? t('layout.saving') : t('settings.saveSettings')}
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium mb-4">{t('settings.stripeKeysHowTo')}</h3>
        <ol className="list-decimal ml-5 space-y-2 text-sm text-gray-600">
          <li>Go to <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer"
            className="text-[#0f766e] underline">dashboard.stripe.com</a> and create an account</li>
          <li>Navigate to <strong>Developers → API keys</strong></li>
          <li>Copy your <strong>Secret key</strong> (starts with <code>sk_test_</code> or <code>sk_live_</code>)</li>
          <li>Set it as <code>STRIPE_SECRET_KEY</code> in the server environment</li>
          <li>For webhooks: set up an endpoint pointing to <code>/api/webhooks/stripe</code> and copy the signing secret as <code>STRIPE_WEBHOOK_SECRET</code></li>
        </ol>
      </div>
    </div>
  );
}
