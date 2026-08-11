import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { tenantApi } from '../../lib/api';
import { Palette, Save, Check, Loader2 } from 'lucide-react';

export function WhiteLabelSettings() {
  const { t } = useI18n();
  const { state: { tenant } } = useAuth();
  const slug = tenant?.slug;
  const [logoUrl, setLogoUrl] = useState(tenant?.logoUrl || '');
  const [primaryColor, setPrimaryColor] = useState(tenant?.primaryColor || '#0f766e');
  const [accentColor, setAccentColor] = useState('#1e3a5f');
  const [restaurantName, setRestaurantName] = useState(tenant?.name || '');
  const [favicon, setFavicon] = useState('');
  const [customDomain, setCustomDomain] = useState('');
  const [googleReviewUrl, setGoogleReviewUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (tenant) {
      setLogoUrl(tenant.logoUrl || '');
      setPrimaryColor(tenant.primaryColor || '#0f766e');
      setAccentColor(tenant.accentColor || '#1e3a5f');
      setRestaurantName(tenant.name || '');
      setFavicon(tenant.faviconUrl || '');
      setCustomDomain(tenant.customDomain || '');
      setGoogleReviewUrl(tenant.googleReviewUrl || '');
    }
  }, [tenant]);

  async function handleSave() {
    if (!slug) return;
    setSaving(true);
    setError('');
    try {
      await tenantApi.updateSettings(slug, {
        logoUrl: logoUrl || undefined,
        primaryColor,
        accentColor,
        faviconUrl: favicon || undefined,
        customDomain: customDomain || undefined,
        googleReviewUrl: googleReviewUrl || undefined,
        name: restaurantName,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError((err as { message?: string }).message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">{t('wl.title')}</h2>

      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <Palette className="w-6 h-6 text-brand" />
          <h3 className="text-lg font-medium">{t('wl.customize')}</h3>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('wl.restaurantName')}</label>
          <input
            type="text"
            value={restaurantName}
            onChange={(e) => setRestaurantName(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-brand focus:border-brand"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('wl.logoUrl')}</label>
          <input
            type="text"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://example.com/logo.png"
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-brand focus:border-brand"
          />
          {logoUrl && (
            <div className="mt-2 flex items-center gap-2">
              <img src={logoUrl} alt="Logo preview" width="40" height="40" loading="lazy" className="h-10 w-10 rounded object-contain border" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <span className="text-xs text-gray-400">{t('wl.preview')}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('wl.primaryColor')}</label>
            <div className="flex gap-2">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-10 w-10 rounded cursor-pointer border border-gray-300"
              />
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 focus:ring-brand focus:border-brand"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('wl.accentColor')}</label>
            <div className="flex gap-2">
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="h-10 w-10 rounded cursor-pointer border border-gray-300"
              />
              <input
                type="text"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 focus:ring-brand focus:border-brand"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('wl.faviconUrl')}</label>
          <input
            type="text"
            value={favicon}
            onChange={(e) => setFavicon(e.target.value)}
            placeholder="https://example.com/favicon.ico"
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-brand focus:border-brand"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('wl.customDomain')}</label>
          <input
            type="text"
            value={customDomain}
            onChange={(e) => setCustomDomain(e.target.value)}
            placeholder="order.yourrestaurant.com"
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-brand focus:border-brand"
          />
          <p className="text-xs text-gray-500 mt-1">{t('wl.domainHint')}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('wl.googleReview')}</label>
          <input
            type="text"
            value={googleReviewUrl}
            onChange={(e) => setGoogleReviewUrl(e.target.value)}
            placeholder="https://g.page/r/…/review"
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-brand focus:border-brand"
          />
          <p className="text-xs text-gray-500 mt-1">{t('wl.reviewHint')}</p>
        </div>

        {error && <div className="bg-red-50 border-l-4 border-red-400 p-3 text-sm text-red-700">{error}</div>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2 bg-brand text-white rounded-md hover:bg-brand-hover disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? t('settings.saved') : saving ? t('layout.saving') : t('wl.saveBranding')}
        </button>
      </div>

      {/* Live Preview */}
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <h3 className="text-lg font-medium">{t('wl.customerPreview')}</h3>
        <p className="text-sm text-gray-500">{t('wl.previewDesc')}</p>
        <div className="border rounded-lg overflow-hidden">
          <div className="p-3 flex items-center gap-2" style={{ backgroundColor: primaryColor }}>
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
            ) : (
              <Palette className="h-6 w-6 text-white" />
            )}
            <span className="text-white font-semibold text-lg">{restaurantName || t('wl.yourRestaurant')}</span>
            <span className="ml-auto text-white/70 text-xs bg-white/20 px-2 py-1 rounded">{t('table.tableNumber', { number: 1 })}</span>
          </div>
          <div className="p-4 bg-gray-50 flex gap-2 text-sm">
            <span className="px-3 py-1.5 rounded-md font-medium" style={{ backgroundColor: '#ccfbf1', color: primaryColor }}>
              {t('nav.menu')}
            </span>
            <span className="px-3 py-1.5 text-gray-400">{t('nav.cart')}</span>
            <span className="px-3 py-1.5 text-gray-400">{t('nav.orders')}</span>
            <span className="px-3 py-1.5 text-gray-400">{t('nav.bill')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
