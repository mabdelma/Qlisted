import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { giftCardApi } from '../../lib/api';
import type { GiftCard } from '../../lib/api/types';
import { Plus, Gift, Ban } from 'lucide-react';

export default function GiftCards() {
  const { t } = useI18n();
  const { slug } = useAuth();
  const [cards, setCards] = useState<GiftCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: '', initialBalance: 0, expiresAt: '' });
  const [error, setError] = useState('');

  const load = async () => {
    if (!slug) return;
    try {
      setLoading(true);
      const data = await giftCardApi.list(slug);
      setCards(data);
    } catch (err) {
      console.error('Failed to load gift cards', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [slug]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug) return;
    try {
      setError('');
      await giftCardApi.create(slug, {
        code: form.code,
        initialBalance: form.initialBalance,
        expiresAt: form.expiresAt || undefined,
      });
      setShowForm(false);
      setForm({ code: '', initialBalance: 0, expiresAt: '' });
      await load();
    } catch (err) {
      setError((err as { message?: string })?.message || 'Failed to create gift card');
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!slug) return;
    try {
      await giftCardApi.deactivate(slug, id);
      await load();
    } catch (err) {
      console.error('Failed to deactivate', err);
    }
  };

  if (loading) return <div className="p-4 text-gray-500">{t('common.loading')}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">{t('giftCards.title')}</h2>
        <button onClick={() => setShowForm(true)}
          className="flex items-center px-4 py-2 bg-[#0f766e] text-white rounded-md hover:bg-[#1e3a5f]">
          <Plus className="w-5 h-5 mr-2" /> {t('giftCards.create')}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white p-6 rounded-lg shadow space-y-4 border">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('giftCards.code')}</label>
              <input type="text" value={form.code} required
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e] text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('giftCards.initialBalance')} ($)</label>
              <input type="number" min="1" step="0.01" value={form.initialBalance || ''} required
                onChange={(e) => setForm({ ...form, initialBalance: parseFloat(e.target.value) || 0 })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e] text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('giftCards.expiresAt')}</label>
              <input type="date" value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e] text-sm" />
            </div>
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex justify-end space-x-3">
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">{t('common.cancel')}</button>
            <button type="submit"
              className="px-4 py-2 bg-[#0f766e] text-white rounded-md hover:bg-[#1e3a5f]">{t('giftCards.create')}</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <div key={card.id} className={`bg-white rounded-lg shadow p-4 border-l-4 ${card.isActive ? 'border-l-green-500' : 'border-l-red-500'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-[#0f766e]" />
                <span className="font-mono font-bold text-lg">{card.code}</span>
              </div>
              {card.isActive ? (
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">{t('giftCards.active')}</span>
              ) : (
                <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">{t('giftCards.inactive')}</span>
              )}
            </div>
            <div className="mt-3 space-y-1 text-sm text-gray-600">
              <p>{t('giftCards.balance')}: <span className="font-semibold">${card.currentBalance.toFixed(2)}</span> / ${card.initialBalance.toFixed(2)}</p>
              {card.expiresAt && <p>{t('giftCards.expiresAt')}: {new Date(card.expiresAt).toLocaleDateString()}</p>}
            </div>
            {card.isActive && (
              <button onClick={() => handleDeactivate(card.id)}
                className="mt-3 flex items-center text-sm text-red-600 hover:text-red-800">
                <Ban className="w-4 h-4 mr-1" /> {t('giftCards.deactivate')}
              </button>
            )}
          </div>
        ))}
        {cards.length === 0 && (
          <p className="text-gray-500 col-span-full text-center py-8">{t('giftCards.noCards')}</p>
        )}
      </div>
    </div>
  );
}
