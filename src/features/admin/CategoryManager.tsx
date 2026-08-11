import { useState } from 'react';
import { Plus, Trash2, Edit2, Check, X, FolderTree, CornerDownRight } from 'lucide-react';
import { menuApi } from '../../lib/api';
import { useI18n } from '../../contexts/I18nContext';
import type { MenuCategory } from '../../lib/api/types';

interface CategoryManagerProps {
  slug: string;
  categories: MenuCategory[]; // all categories (main + sub)
  onChange: () => void;       // reload the menu after a mutation
  onClose: () => void;
}

/**
 * Lets restaurant admins create, rename, and delete menu categories and the
 * subcategories nested under them. The backend already supports the full CRUD
 * (type: 'main' | 'sub' + parentId); this is the missing admin UI.
 */
export function CategoryManager({ slug, categories, onChange, onClose }: CategoryManagerProps) {
  const { t } = useI18n();
  const [newMain, setNewMain] = useState('');
  const [newSub, setNewSub] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const mains = categories.filter((c) => c.type === 'main').sort((a, b) => a.sortOrder - b.sortOrder);
  const subsOf = (parentId: string) =>
    categories.filter((c) => c.type === 'sub' && c.parentId === parentId).sort((a, b) => a.sortOrder - b.sortOrder);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await fn();
      onChange();
    } catch (e) {
      setError((e as { message?: string }).message || 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  async function addMain() {
    const name = newMain.trim();
    if (!name) return;
    await run(async () => { await menuApi.createCategory(slug, { name, type: 'main' }); setNewMain(''); });
  }

  async function addSub(parentId: string) {
    const name = (newSub[parentId] || '').trim();
    if (!name) return;
    await run(async () => {
      await menuApi.createCategory(slug, { name, type: 'sub', parentId });
      setNewSub((prev) => ({ ...prev, [parentId]: '' }));
    });
  }

  async function saveRename(id: string) {
    const name = editName.trim();
    if (!name) { setEditingId(null); return; }
    await run(async () => { await menuApi.updateCategory(slug, id, { name }); setEditingId(null); });
  }

  async function remove(id: string) {
    if (!window.confirm(t('category.deleteConfirm'))) return;
    await run(async () => { await menuApi.deleteCategory(slug, id); });
  }

  function Row({ cat, sub }: { cat: MenuCategory; sub?: boolean }) {
    const isEditing = editingId === cat.id;
    return (
      <div className={`flex items-center gap-2 py-1.5 ${sub ? 'pl-8' : ''}`}>
        {sub && <CornerDownRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />}
        {isEditing ? (
          <>
            <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveRename(cat.id); if (e.key === 'Escape') setEditingId(null); }}
              className="flex-1 rounded-md border-gray-300 shadow-sm text-sm focus:border-[#0f766e] focus:ring-[#0f766e]" />
            <button onClick={() => saveRename(cat.id)} disabled={busy} aria-label={t('common.save')} className="p-1.5 text-green-600 hover:bg-green-50 rounded"><Check className="w-4 h-4" /></button>
            <button onClick={() => setEditingId(null)} aria-label={t('common.cancel')} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
          </>
        ) : (
          <>
            <span className={`flex-1 text-sm ${sub ? 'text-gray-600' : 'font-medium text-gray-900'}`}>{cat.name}</span>
            <button onClick={() => { setEditingId(cat.id); setEditName(cat.name); }} aria-label={t('common.edit')} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-gray-100 rounded"><Edit2 className="w-3.5 h-3.5" /></button>
            <button onClick={() => remove(cat.id)} disabled={busy} aria-label={t('common.delete')} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={t('category.manage')}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900"><FolderTree className="w-5 h-5 text-[#0f766e]" /> {t('category.title')}</h3>
          <button onClick={onClose} aria-label={t('common.close')} className="p-1 hover:bg-gray-100 rounded-full"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && <div className="bg-red-50 border-l-4 border-red-400 p-3 text-sm text-red-700">{error}</div>}

          {mains.length === 0 ? (
            <p className="text-center text-gray-500 py-6 text-sm">{t('category.empty')}</p>
          ) : (
            mains.map((main) => (
              <div key={main.id} className="border border-gray-200 rounded-lg p-3">
                <Row cat={main} />
                <div className="mt-1 border-t border-gray-100 pt-1">
                  {subsOf(main.id).map((s) => <Row key={s.id} cat={s} sub />)}
                  <div className="flex items-center gap-2 pl-8 pt-1">
                    <CornerDownRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                    <input value={newSub[main.id] || ''} onChange={(e) => setNewSub((p) => ({ ...p, [main.id]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') addSub(main.id); }}
                      placeholder={t('category.newSubcategory')}
                      className="flex-1 rounded-md border-gray-300 shadow-sm text-sm focus:border-[#0f766e] focus:ring-[#0f766e]" />
                    <button onClick={() => addSub(main.id)} disabled={busy || !(newSub[main.id] || '').trim()}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50">
                      <Plus className="w-3 h-3" /> {t('category.addSubcategory')}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t px-5 py-4">
          <div className="flex items-center gap-2">
            <input value={newMain} onChange={(e) => setNewMain(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addMain(); }}
              placeholder={t('category.newCategory')}
              className="flex-1 rounded-md border-gray-300 shadow-sm text-sm focus:border-[#0f766e] focus:ring-[#0f766e]" />
            <button onClick={addMain} disabled={busy || !newMain.trim()}
              className="flex items-center gap-1 px-4 py-2 bg-[#0f766e] text-white text-sm rounded-md hover:bg-[#1e3a5f] disabled:opacity-50">
              <Plus className="w-4 h-4" /> {t('category.addCategory')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
