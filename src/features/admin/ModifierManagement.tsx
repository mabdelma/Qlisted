import { useState, useEffect } from 'react';
import { PlusCircle, Edit, Trash2, GripVertical, ChevronUp, ChevronDown } from 'lucide-react';
import { menuApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';

interface ModifierGroup {
  id: string;
  name: string;
  selectionType: 'single' | 'multiple';
  isRequired: boolean;
  sortOrder: number;
  options: ModifierOption[];
}

interface ModifierOption {
  id: string;
  name: string;
  priceAdjustment: number;
  maxSelectable: number;
  sortOrder: number;
}

export function ModifierManagement() {
  const { t } = useI18n();
  const { state: { tenant } } = useAuth();
  const slug = tenant?.slug;
  const [groups, setGroups] = useState<ModifierGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingGroup, setEditingGroup] = useState<Partial<ModifierGroup> | null>(null);
  const [editingOption, setEditingOption] = useState<{ groupId: string; option?: Partial<ModifierOption> } | null>(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetchGroups();
  }, [slug]);

  async function fetchGroups() {
    if (!slug) return;
    try {
      const data = await menuApi.getModifierGroups(slug);
      setGroups(data.data);
      setError('');
    } catch {
      setError('Failed to load modifier groups');
    }
    setLoading(false);
  }

  async function saveGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!slug || !editingGroup) return;
    try {
      if (editingGroup.id) {
        await menuApi.updateModifierGroup(slug, editingGroup.id, editingGroup);
      } else {
        await menuApi.createModifierGroup(slug, editingGroup as { name: string; selectionType: string; isRequired: boolean });
      }
      setEditingGroup(null);
      setError('');
      await fetchGroups();
    } catch {
      setError('Failed to save modifier group');
    }
  }

  async function deleteGroup(id: string) {
    if (!slug || !window.confirm(t('modifier.deleteGroupConfirm'))) return;
    try {
      await menuApi.deleteModifierGroup(slug, id);
      setGroups((prev) => prev.filter((g) => g.id !== id));
    } catch {
      setError('Failed to delete modifier group');
    }
  }

  async function moveGroup(index: number, dir: -1 | 1) {
    if (!slug) return;
    const target = index + dir;
    if (target < 0 || target >= groups.length) return;
    const a = groups[index];
    const b = groups[target];
    try {
      await Promise.all([
        menuApi.updateModifierGroup(slug, a.id, { sortOrder: b.sortOrder }),
        menuApi.updateModifierGroup(slug, b.id, { sortOrder: a.sortOrder }),
      ]);
      setGroups((prev) => {
        const next = [...prev];
        [next[index], next[target]] = [next[target], next[index]];
        return next;
      });
    } catch {
      setError('Failed to reorder modifier groups');
    }
  }

  async function saveOption(e: React.FormEvent) {
    e.preventDefault();
    if (!slug || !editingOption) return;
    try {
      if (editingOption.option?.id) {
        await menuApi.updateModifierOption(slug, editingOption.option.id, editingOption.option);
      } else {
        await menuApi.createModifierOption(slug, editingOption.groupId, editingOption.option as { name: string; priceAdjustment: number });
      }
      setEditingOption(null);
      setError('');
      await fetchGroups();
    } catch {
      setError('Failed to save modifier option');
    }
  }

  async function deleteOption(groupId: string, optionId: string) {
    if (!slug || !window.confirm(t('modifier.deleteOptionConfirm'))) return;
    try {
      await menuApi.deleteModifierOption(slug, optionId);
      setGroups((prev) => prev.map((g) => g.id === groupId ? {
        ...g, options: g.options.filter((o) => o.id !== optionId)
      } : g));
    } catch {
      setError('Failed to delete modifier option');
    }
  }

  async function moveOption(groupId: string, index: number, dir: -1 | 1) {
    if (!slug) return;
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    const target = index + dir;
    if (target < 0 || target >= group.options.length) return;
    const a = group.options[index];
    const b = group.options[target];
    try {
      await Promise.all([
        menuApi.updateModifierOption(slug, a.id, { sortOrder: b.sortOrder }),
        menuApi.updateModifierOption(slug, b.id, { sortOrder: a.sortOrder }),
      ]);
      setGroups((prev) => prev.map((g) => {
        if (g.id !== groupId) return g;
        const opts = [...g.options];
        [opts[index], opts[target]] = [opts[target], opts[index]];
        return { ...g, options: opts };
      }));
    } catch {
      setError('Failed to reorder modifier options');
    }
  }

  const typeLabel = (s: string) => s === 'multiple' ? t('modifier.multiple') : t('modifier.single');

  if (!slug) return <div className="p-4 text-gray-500">{t('common.loading')}</div>;
  if (loading) return <div className="p-4 text-gray-500">{t('common.loading')}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">{t('menu.modifierGroups')}</h2>
        <button onClick={() => setEditingGroup({ name: '', selectionType: 'single', isRequired: false, sortOrder: 0 })}
          className="flex items-center px-4 py-2 bg-[#0f766e] text-white rounded-md hover:bg-[#1e3a5f]">
          <PlusCircle className="w-5 h-5 mr-2" /> {t('modifier.addGroup')}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-3 text-sm text-red-700">{error}</div>
      )}

      {editingGroup && (
        <div className="fixed inset-0 bg-gray-600/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md" role="dialog" aria-label={editingGroup.id ? 'Edit modifier group' : 'New modifier group'}>
            <h3 className="text-xl font-semibold mb-4">{editingGroup.id ? t('modifier.editGroup') : t('modifier.newGroup')}</h3>
            <form onSubmit={saveGroup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('common.name')}</label>
                <input type="text" required value={editingGroup.name || ''}
                  onChange={(e) => setEditingGroup({ ...editingGroup, name: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('modifier.selectionType')}</label>
                <select value={editingGroup.selectionType || 'single'}
                  onChange={(e) => setEditingGroup({ ...editingGroup, selectionType: e.target.value as 'single' | 'multiple' })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]">
                  <option value="single">{t('modifier.single')}</option>
                  <option value="multiple">{t('modifier.multiple')}</option>
                </select>
              </div>
              <div className="flex items-center">
                <input type="checkbox" id="group-required" checked={editingGroup.isRequired ?? false}
                  onChange={(e) => setEditingGroup({ ...editingGroup, isRequired: e.target.checked })}
                  className="h-4 w-4 text-[#0f766e] border-gray-300 rounded" />
                <label htmlFor="group-required" className="ml-2 text-sm text-gray-900">{t('modifier.required')}</label>
              </div>
              <div className="flex justify-end space-x-3">
                <button type="button" onClick={() => setEditingGroup(null)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">{t('common.cancel')}</button>
                <button type="submit" className="px-4 py-2 bg-[#0f766e] text-white rounded-md hover:bg-[#1e3a5f]">{t('common.save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingOption && (
        <div className="fixed inset-0 bg-gray-600/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md" role="dialog" aria-label={editingOption.option?.id ? 'Edit modifier option' : 'New modifier option'}>
            <h3 className="text-xl font-semibold mb-4">{editingOption.option?.id ? t('modifier.editOption') : t('modifier.newOption')}</h3>
            <form onSubmit={saveOption} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('common.name')}</label>
                <input type="text" required value={editingOption.option?.name || ''}
                  onChange={(e) => setEditingOption({ ...editingOption, option: { ...editingOption.option, name: e.target.value } })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('modifier.priceAdjustment')} ($)</label>
                <input type="number" step="0.01" value={editingOption.option?.priceAdjustment ?? 0}
                  onChange={(e) => setEditingOption({ ...editingOption, option: { ...editingOption.option, priceAdjustment: parseFloat(e.target.value) || 0 } })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('modifier.maxSelectable')}</label>
                <input type="number" min="1" step="1" value={editingOption.option?.maxSelectable ?? 1}
                  onChange={(e) => setEditingOption({ ...editingOption, option: { ...editingOption.option, maxSelectable: parseInt(e.target.value, 10) || 1 } })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]" />
              </div>
              <div className="flex justify-end space-x-3">
                <button type="button" onClick={() => setEditingOption(null)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">{t('common.cancel')}</button>
                <button type="submit" className="px-4 py-2 bg-[#0f766e] text-white rounded-md hover:bg-[#1e3a5f]">{t('common.save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {groups.map((group, index) => (
          <div key={group.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="flex items-center gap-3">
                  <GripVertical className="w-5 h-5 text-gray-400" aria-hidden />
                  <h3 className="text-lg font-semibold text-gray-900">{group.name}</h3>
                </div>
                <div className="flex gap-2 mt-1">
                  <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-600">{typeLabel(group.selectionType)}</span>
                  {group.isRequired && <span className="text-xs px-2 py-0.5 bg-red-100 rounded-full text-red-600">{t('modifier.required')}</span>}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => moveGroup(index, -1)} disabled={index === 0} aria-label={t('modifier.moveUp')}
                  className="p-2 text-gray-600 hover:text-[#0f766e] disabled:opacity-30 disabled:cursor-not-allowed">
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button onClick={() => moveGroup(index, 1)} disabled={index === groups.length - 1} aria-label={t('modifier.moveDown')}
                  className="p-2 text-gray-600 hover:text-[#0f766e] disabled:opacity-30 disabled:cursor-not-allowed">
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button onClick={() => setEditingGroup(group)} aria-label="Edit group"
                  className="p-2 text-gray-600 hover:text-indigo-600">
                  <Edit className="w-4 h-4" />
                </button>
                <button onClick={() => deleteGroup(group.id)} aria-label="Delete group"
                  className="p-2 text-gray-600 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="ml-6 space-y-2">
              {group.options.map((opt, optIndex) => (
                <div key={opt.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-md">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-700">{opt.name}</span>
                    {opt.priceAdjustment > 0 && (
                      <span className="text-xs text-green-600">+${opt.priceAdjustment.toFixed(2)}</span>
                    )}
                    {opt.maxSelectable != null && (
                      <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-600">{t('modifier.maxSelectable')}: {opt.maxSelectable}</span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => moveOption(group.id, optIndex, -1)} disabled={optIndex === 0}
                      aria-label={t('modifier.moveUp')} className="p-1 text-gray-400 hover:text-[#0f766e] disabled:opacity-30 disabled:cursor-not-allowed">
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => moveOption(group.id, optIndex, 1)} disabled={optIndex === group.options.length - 1}
                      aria-label={t('modifier.moveDown')} className="p-1 text-gray-400 hover:text-[#0f766e] disabled:opacity-30 disabled:cursor-not-allowed">
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setEditingOption({ groupId: group.id, option: opt })}
                      aria-label="Edit option" className="p-1 text-gray-400 hover:text-indigo-600">
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deleteOption(group.id, opt.id)}
                      aria-label="Delete option" className="p-1 text-gray-400 hover:text-red-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              <button onClick={() => setEditingOption({ groupId: group.id, option: { name: '', priceAdjustment: 0, maxSelectable: 1 } })}
                className="flex items-center text-sm text-[#0f766e] hover:text-[#1e3a5f] mt-2">
                <PlusCircle className="w-4 h-4 mr-1" /> {t('modifier.addOption')}
              </button>
            </div>
          </div>
        ))}
      </div>

      {groups.length === 0 && (
        <p className="text-center text-gray-500 py-12">{t('modifier.noGroups')}</p>
      )}
    </div>
  );
}
