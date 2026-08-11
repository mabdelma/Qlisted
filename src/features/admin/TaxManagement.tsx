import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { taxCategoryApi } from '../../lib/api';
import type { TaxCategory } from '../../lib/api/types';
import { Plus, Pencil, Trash2, Percent, CheckCircle } from 'lucide-react';
import { useI18n } from '../../contexts/I18nContext';

export function TaxManagement() {
  const { t } = useI18n();
  const { state: { tenant } } = useAuth();
  const slug = tenant?.slug;
  const [categories, setCategories] = useState<TaxCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<TaxCategory | null>(null);
  const [name, setName] = useState('');
  const [rate, setRate] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadCategories() {
    if (!slug) return;
    try {
      const data = await taxCategoryApi.list(slug);
      setCategories(data);
    } catch {
      setError('Failed to load tax categories');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCategories();
  }, [slug]);

  function openCreate() {
    setEditing(null);
    setName('');
    setRate('');
    setIsDefault(false);
    setShowModal(true);
  }

  function openEdit(cat: TaxCategory) {
    setEditing(cat);
    setName(cat.name);
    setRate(String(cat.rate * 100));
    setIsDefault(cat.isDefault);
    setShowModal(true);
  }

  async function handleSave() {
    if (!slug) return;
    const rateNum = parseFloat(rate) / 100;
    if (!name || isNaN(rateNum)) return;

    try {
      if (editing) {
        await taxCategoryApi.update(slug, editing.id, { name, rate: rateNum, isDefault });
      } else {
        await taxCategoryApi.create(slug, { name, rate: rateNum, isDefault });
      }
      setShowModal(false);
      await loadCategories();
    } catch {
      setError('Failed to save tax category');
    }
  }

  async function handleDelete(id: string) {
    if (!slug) return;
    if (!window.confirm(t('tax.deleteConfirm'))) return;
    try {
      await taxCategoryApi.delete(slug, id);
      await loadCategories();
    } catch {
      setError('Failed to delete tax category');
    }
  }

  if (!slug) return null;
  if (loading) return <div className="text-center py-8 text-gray-500">{t('common.loading')}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-[#1e3a5f]">{t('tax.title')}</h2>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-[#0f766e] text-white rounded-lg hover:bg-[#115e59] transition-colors">
          <Plus className="w-4 h-4" /> {t('tax.create')}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg">{error}</div>
      )}

      {categories.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Percent className="mx-auto h-12 w-12 mb-3" />
          <p>{t('tax.noCategories')}</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {categories.map((cat) => (
            <div key={cat.id}
              className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between hover:shadow-sm transition-shadow">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-[#ccfbf1] flex items-center justify-center">
                  <Percent className="w-5 h-5 text-[#0f766e]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{cat.name}</span>
                    {cat.isDefault && (
                      <span className="text-xs bg-[#0f766e] text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> {t('tax.isDefault')}
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-gray-500">{(cat.rate * 100).toFixed(1)}%</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => openEdit(cat)}
                  className="p-2 text-gray-400 hover:text-[#0f766e] transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(cat.id)}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900">
              {editing ? t('tax.edit') : t('tax.create')}
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('tax.name')}</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-[#0f766e] focus:ring-[#0f766e]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('tax.rate')} (%)</label>
              <input type="number" value={rate} onChange={(e) => setRate(e.target.value)}
                min="0" max="100" step="0.1"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-[#0f766e] focus:ring-[#0f766e]" />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)}
                className="rounded border-gray-300 text-[#0f766e] focus:ring-[#0f766e]" />
              {t('tax.isDefault')}
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors">
                {t('common.cancel')}
              </button>
              <button onClick={handleSave}
                className="px-4 py-2 bg-[#0f766e] text-white rounded-lg hover:bg-[#115e59] transition-colors">
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
