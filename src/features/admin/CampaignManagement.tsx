import { useState, useEffect, useCallback } from 'react';
import { PlusCircle, Edit, Trash2, Tag, Power, PowerOff } from 'lucide-react';
import { promoApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n, type TranslationKey } from '../../contexts/I18nContext';
import type { Campaign, CampaignInput } from '../../lib/api/types';

const CAMPAIGN_TYPES = ['percentage', 'fixed', 'buy_x_get_y', 'happy_hour'] as const;

export function CampaignManagement() {
  const { t } = useI18n();
  const { state: { tenant } } = useAuth();
  const slug = tenant?.slug;
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Partial<CampaignInput> | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    fetchCampaigns();
  }, [slug, fetchCampaigns]);

  const fetchCampaigns = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const res = await promoApi.listCampaigns(slug);
      setCampaigns(res.data);
    } catch {
      setError('Failed to load campaigns');
    }
    setLoading(false);
  }, [slug]);

  function resetForm() {
    setEditing(null);
    setEditingId(null);
  }

  function startEdit(campaign?: Campaign) {
    if (campaign) {
      setEditingId(campaign.id);
      setEditing({
        name: campaign.name,
        type: campaign.type,
        value: campaign.value,
        minOrderAmount: campaign.minOrderAmount,
        maxDiscount: campaign.maxDiscount,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        daysOfWeek: campaign.daysOfWeek,
        timeStart: campaign.timeStart,
        timeEnd: campaign.timeEnd,
        usageLimit: campaign.usageLimit,
      });
    } else {
      setEditingId(null);
      setEditing({
        name: '',
        type: 'percentage',
        value: 0,
        minOrderAmount: undefined,
        maxDiscount: undefined,
        startDate: undefined,
        endDate: undefined,
        daysOfWeek: undefined,
        timeStart: undefined,
        timeEnd: undefined,
        usageLimit: undefined,
      });
    }
  }

  async function saveCampaign(e: React.FormEvent) {
    e.preventDefault();
    if (!slug || !editing) return;
    try {
      const payload: CampaignInput = {
        name: editing.name || '',
        type: editing.type || 'percentage',
        value: editing.value || 0,
        minOrderAmount: editing.minOrderAmount,
        maxDiscount: editing.maxDiscount,
        startDate: editing.startDate,
        endDate: editing.endDate,
        daysOfWeek: editing.daysOfWeek,
        timeStart: editing.timeStart,
        timeEnd: editing.timeEnd,
        usageLimit: editing.usageLimit,
      };
      if (editingId) {
        await promoApi.updateCampaign(slug, editingId, payload);
      } else {
        await promoApi.createCampaign(slug, payload);
      }
      resetForm();
      await fetchCampaigns();
    } catch {
      setError('Failed to save campaign');
    }
  }

  async function toggleActive(campaign: Campaign) {
    if (!slug) return;
    try {
      await promoApi.updateCampaign(slug, campaign.id, { isActive: !campaign.isActive } as Partial<CampaignInput>);
      setCampaigns((prev) => prev.map((c) => c.id === campaign.id ? { ...c, isActive: !c.isActive } : c));
    } catch {
      setError('Failed to update campaign');
    }
  }

  async function deleteCampaign(id: string) {
    if (!slug || !window.confirm('Delete this campaign? This cannot be undone.')) return;
    try {
      await promoApi.deleteCampaign(slug, id);
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
    } catch {
      setError('Failed to delete campaign');
    }
  }

  function typeLabel(type: string): string {
    const key = `promo.${type === 'buy_x_get_y' ? 'buyXGetY' : type === 'happy_hour' ? 'happyHour' : type}` as TranslationKey;
    return t(key);
  }

  if (!slug) return <div className="p-4 text-gray-500">Loading tenant...</div>;
  if (loading) return <div className="p-4 text-gray-500">{t('common.loading')}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">{t('promo.title')}</h2>
        <button onClick={() => startEdit()}
          className="flex items-center px-4 py-2 bg-[#0f766e] text-white rounded-md hover:bg-[#1e3a5f]">
          <PlusCircle className="w-5 h-5 mr-2" /> {t('promo.create')}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 text-sm text-red-700">{error}</div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-gray-600/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg overflow-y-auto max-h-[90vh]" role="dialog" aria-label={editingId ? 'Edit campaign' : 'New campaign'}>
            <h3 className="text-xl font-semibold mb-4">{editingId ? t('promo.edit') : t('promo.create')}</h3>
            <form onSubmit={saveCampaign} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('promo.name')}</label>
                <input type="text" required value={editing.name || ''}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('promo.type')}</label>
                <select value={editing.type || 'percentage'}
                  onChange={(e) => setEditing({ ...editing, type: e.target.value as CampaignInput['type'] })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]">
                  {CAMPAIGN_TYPES.map((t) => (
                    <option key={t} value={t}>{typeLabel(t)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('promo.value')}</label>
                <input type="number" step="0.01" min="0" required value={editing.value ?? 0}
                  onChange={(e) => setEditing({ ...editing, value: parseFloat(e.target.value) || 0 })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('promo.minOrder')}</label>
                  <input type="number" step="0.01" min="0" value={editing.minOrderAmount ?? ''}
                    onChange={(e) => setEditing({ ...editing, minOrderAmount: e.target.value ? parseFloat(e.target.value) : undefined })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('promo.maxDiscount')}</label>
                  <input type="number" step="0.01" min="0" value={editing.maxDiscount ?? ''}
                    onChange={(e) => setEditing({ ...editing, maxDiscount: e.target.value ? parseFloat(e.target.value) : undefined })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('promo.startDate')}</label>
                  <input type="date" value={editing.startDate?.split('T')[0] || ''}
                    onChange={(e) => setEditing({ ...editing, startDate: e.target.value || undefined })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('promo.endDate')}</label>
                  <input type="date" value={editing.endDate?.split('T')[0] || ''}
                    onChange={(e) => setEditing({ ...editing, endDate: e.target.value || undefined })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('promo.daysOfWeek')}</label>
                <input type="text" placeholder="e.g. 1,2,3,4,5" value={editing.daysOfWeek || ''}
                  onChange={(e) => setEditing({ ...editing, daysOfWeek: e.target.value || undefined })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('promo.timeStart')}</label>
                  <input type="time" value={editing.timeStart || ''}
                    onChange={(e) => setEditing({ ...editing, timeStart: e.target.value || undefined })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('promo.timeEnd')}</label>
                  <input type="time" value={editing.timeEnd || ''}
                    onChange={(e) => setEditing({ ...editing, timeEnd: e.target.value || undefined })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('promo.usageLimit')}</label>
                <input type="number" min="0" value={editing.usageLimit ?? ''}
                  onChange={(e) => setEditing({ ...editing, usageLimit: e.target.value ? parseInt(e.target.value) : undefined })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]" />
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button type="button" onClick={resetForm}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">{t('common.cancel')}</button>
                <button type="submit" className="px-4 py-2 bg-[#0f766e] text-white rounded-md hover:bg-[#1e3a5f]">{t('common.save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {campaigns.map((campaign) => (
          <div key={campaign.id} className={`bg-white rounded-lg shadow p-6 border-l-4 ${campaign.isActive ? 'border-green-500' : 'border-gray-300'}`}>
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <Tag className={`w-5 h-5 ${campaign.isActive ? 'text-[#0f766e]' : 'text-gray-400'}`} />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{campaign.name}</h3>
                  <div className="flex flex-wrap gap-2 mt-1">
                    <span className="text-xs px-2 py-0.5 bg-blue-100 rounded-full text-blue-700">{typeLabel(campaign.type)}</span>
                    <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-600">
                      {campaign.type === 'percentage' ? `${campaign.value}%` : `$${campaign.value}`}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${campaign.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {campaign.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => toggleActive(campaign)} aria-label="Toggle active"
                  className="p-2 text-gray-600 hover:text-yellow-600">
                  {campaign.isActive ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                </button>
                <button onClick={() => startEdit(campaign)} aria-label="Edit campaign"
                  className="p-2 text-gray-600 hover:text-indigo-600">
                  <Edit className="w-4 h-4" />
                </button>
                <button onClick={() => deleteCampaign(campaign.id)} aria-label="Delete campaign"
                  className="p-2 text-gray-600 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
              {campaign.minOrderAmount != null && campaign.minOrderAmount > 0 && <span>Min: ${campaign.minOrderAmount}</span>}
              {campaign.maxDiscount != null && <span>Max: ${campaign.maxDiscount}</span>}
              {campaign.startDate && <span>Start: {new Date(campaign.startDate).toLocaleDateString()}</span>}
              {campaign.endDate && <span>End: {new Date(campaign.endDate).toLocaleDateString()}</span>}
              {campaign.daysOfWeek && <span>Days: {campaign.daysOfWeek}</span>}
              {campaign.timeStart && <span>{campaign.timeStart}-{campaign.timeEnd}</span>}
              <span>{t('promo.usageCount')}: {campaign.usageCount}{campaign.usageLimit ? `/${campaign.usageLimit}` : ''}</span>
            </div>
          </div>
        ))}
      </div>

      {campaigns.length === 0 && (
        <p className="text-center text-gray-500 py-12">{t('promo.noCampaigns')}</p>
      )}
    </div>
  );
}