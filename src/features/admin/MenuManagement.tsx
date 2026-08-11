import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PlusCircle, Edit, Trash2, Image as ImageIcon, Upload, GripVertical, ToggleLeft, Globe, FolderTree } from 'lucide-react';
import { CategoryManager } from './CategoryManager';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { menuApi, uploadApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import type { MenuItem, MenuCategory, ModifierGroup } from '../../lib/api/types';

const locales = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'pt', label: 'Português' },
  { code: 'zh', label: '中文' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'ru', label: 'Русский' },
  { code: 'ja', label: '日本語' },
];

const SortableItem = React.memo(function SortableItem({ item, onEdit, onDelete }: { item: MenuItem; onEdit: (item: MenuItem) => void; onDelete: (id: string) => void }) {
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  const style = useMemo(() => ({
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto' as const,
  }), [transform, transition, isDragging]);

  return (
    <article ref={setNodeRef} style={style} className="bg-white rounded-lg shadow p-6">
      <div className="flex items-start justify-between mb-2">
        <button {...attributes} {...listeners} aria-label="Drag to reorder" className="p-1 -ml-1 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600">
          <GripVertical className="w-5 h-5" aria-hidden />
        </button>
      </div>
      <div className="aspect-video mb-4 bg-gray-100 rounded-md flex items-center justify-center overflow-hidden">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.name} width="160" height="160" loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <ImageIcon className="w-12 h-12 text-gray-400" aria-hidden />
        )}
      </div>
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-lg font-semibold text-gray-900">{item.name}</h3>
        <span className="text-lg font-medium">${item.price.toFixed(2)}</span>
      </div>
      {item.description && (
        <p className="text-gray-600 text-sm mb-4">{item.description}</p>
      )}
      <div className="flex justify-between items-center">
        <span className={`px-2 py-1 rounded-full text-sm ${
          item.available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {item.available ? t('menu.available') : t('menu.unavailable')}
        </span>
        <div className="flex space-x-2">
          <button onClick={() => onEdit(item)} aria-label="Edit item" className="p-2 text-gray-600 hover:text-indigo-600">
            <Edit className="w-5 h-5" aria-hidden />
          </button>
          <button onClick={() => onDelete(item.id)} aria-label="Delete item" className="p-2 text-gray-600 hover:text-red-600">
            <Trash2 className="w-5 h-5" aria-hidden />
          </button>
        </div>
      </div>
    </article>
  );
});

export function MenuManagement() {
  const { t } = useI18n();
  const { state: { tenant } } = useAuth();
  const slug = tenant?.slug;
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [allCategories, setAllCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [editing, setEditing] = useState<Partial<MenuItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [allModifierGroups, setAllModifierGroups] = useState<ModifierGroup[]>([]);
  const [linkedGroupIds, setLinkedGroupIds] = useState<string[]>([]);
  const [showCategories, setShowCategories] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const loadMenu = useCallback(async () => {
    if (!slug) return;
    try {
      const data = await menuApi.getFullMenu(slug);
      const mainCats = data.categories.filter((c) => c.type === 'main').sort((a, b) => a.sortOrder - b.sortOrder);
      setCategories(mainCats);
      setAllCategories(data.categories);
      setItems(data.items);
      // Keep the current tab if it still exists, otherwise fall back to the first.
      setSelectedCategory((cur) => (cur && mainCats.some((c) => c.id === cur)) ? cur : (mainCats[0]?.id ?? ''));
    } catch (e) {
      console.error(e);
    }
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    loadMenu().finally(() => setLoading(false));
    menuApi.getModifierGroups(slug).then((r) => setAllModifierGroups(r.data)).catch(() => {});
  }, [slug, loadMenu]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!slug || !editing) return;
    try {
      if (editing.id) {
        await menuApi.updateItem(slug, editing.id, editing);
        const currentLinked = new Set(linkedGroupIds);
        const previouslyLinked = allModifierGroups.filter((g) => currentLinked.has(g.id)).map((g) => g.id);
        try {
          const existingModifiers = await menuApi.getMenuItemModifiers(slug, editing.id);
          for (const g of existingModifiers) {
            if (!currentLinked.has(g.id)) {
              await menuApi.unlinkMenuItemModifier(slug, editing.id, g.id);
            }
          }
          for (const g of previouslyLinked) {
            if (!existingModifiers.some((e) => e.id === g)) {
              await menuApi.linkMenuItemModifier(slug, editing.id, g);
            }
          }
        } catch { /* no existing modifiers */ }
      } else {
        const newItem = await menuApi.createItem(slug, editing as Parameters<typeof menuApi.createItem>[1]);
        for (const g of linkedGroupIds) {
          try {
            await menuApi.linkMenuItemModifier(slug, newItem.id, g);
          } catch { /* ignore */ }
        }
      }
      setEditing(null);
      setLinkedGroupIds([]);
      const data = await menuApi.getFullMenu(slug);
      setItems(data.items);
    } catch (err) {
      console.error('Failed to save item:', err);
    }
  }

  function startEditing(item: MenuItem) {
    setEditing(item);
    if (slug) {
      menuApi.getMenuItemModifiers(slug, item.id).then((groups) => {
        setLinkedGroupIds(groups.map((g) => g.id));
      }).catch(() => setLinkedGroupIds([]));
    }
  }

  async function handleDelete(id: string) {
    if (!slug) return;
    try {
      await menuApi.deleteItem(slug, id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      console.error('Failed to delete item:', err);
    }
  }

  const filteredItems = useMemo(() => {
    return selectedCategory
      ? items.filter((i) => i.categoryId === selectedCategory).sort((a, b) => a.sortOrder - b.sortOrder)
      : [...items].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [items, selectedCategory]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !slug) return;

    const oldIndex = filteredItems.findIndex((i) => i.id === active.id);
    const newIndex = filteredItems.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...filteredItems];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    const updated = reordered.map((item, idx) => ({ ...item, sortOrder: idx }));
    setItems((prev) => {
      const other = prev.filter((i) => i.categoryId !== selectedCategory && (selectedCategory ? true : false));
      return [...other, ...updated].sort((a, b) => a.sortOrder - b.sortOrder);
    });

    try {
      await menuApi.reorderItems(slug, updated.map(({ id, sortOrder }) => ({ id, sortOrder })));
    } catch (err) {
      console.error('Failed to reorder items:', err);
    }
  }, [selectedCategory, slug, filteredItems]);

  if (!slug) return <div className="p-4 text-gray-500">{t('common.loading')}</div>;
  if (loading) return <div className="p-4 text-gray-500">{t('common.loading')}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">{t('menu.management')}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCategories(true)}
            className="flex items-center px-4 py-2 border border-[#0f766e] text-[#0f766e] rounded-md hover:bg-[#ccfbf1]/30"
          >
            <FolderTree className="w-5 h-5 mr-2" aria-hidden /> {t('category.manage')}
          </button>
          <button
            onClick={() => setEditing({ name: '', price: 0, categoryId: selectedCategory, available: true })}
            className="flex items-center px-4 py-2 bg-[#0f766e] text-white rounded-md hover:bg-[#1e3a5f]"
          >
            <PlusCircle className="w-5 h-5 mr-2" aria-hidden /> {t('menu.addItem')}
          </button>
        </div>
      </div>

      {showCategories && (
        <CategoryManager
          slug={slug}
          categories={allCategories}
          onChange={loadMenu}
          onClose={() => setShowCategories(false)}
        />
      )}

      {editing && (
        <div className="fixed inset-0 bg-gray-600/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg" role="dialog" aria-label={editing.id ? 'Edit menu item' : 'New menu item'}>
            <h3 className="text-xl font-semibold mb-4">{editing.id ? t('menu.editItem') : t('menu.newItem')}</h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label htmlFor="menu-name" className="block text-sm font-medium text-gray-700">{t('common.name')}</label>
                <input
                  id="menu-name"
                  type="text" required
                  value={editing.name || ''}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]"
                />
              </div>
              <div>
                <label htmlFor="menu-desc" className="block text-sm font-medium text-gray-700">{t('common.description')}</label>
                <textarea
                  id="menu-desc"
                  value={editing.description || ''}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]"
                />
              </div>
              <div>
                <label htmlFor="menu-image-upload" className="block text-sm font-medium text-gray-700 mb-1">{t('menu.image')}</label>
                <div className="flex items-center gap-3">
                  {editing.imageUrl && (
                    <img src={editing.imageUrl} alt="" width="64" height="64" loading="lazy" className="w-16 h-16 rounded object-cover border" />
                  )}
                  <button type="button" id="menu-image-upload" onClick={async () => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/jpeg,image/png,image/webp';
                    input.onchange = async () => {
                      const file = input.files?.[0];
                      if (!file || !slug) return;
                      try {
                        const { url } = await uploadApi.image(slug, file);
                        setEditing({ ...editing, imageUrl: url });
                      } catch { /* ignore */ }
                    };
                    input.click();
                  }}
                    className="flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50">
                    <Upload className="w-4 h-4 mr-2" aria-hidden /> {t('menu.upload')}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="menu-price" className="block text-sm font-medium text-gray-700">{t('common.price')}</label>
                  <input
                    id="menu-price"
                    type="number" step="0.01" min="0" required
                    value={editing.price || 0}
                    onChange={(e) => setEditing({ ...editing, price: parseFloat(e.target.value) || 0 })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]"
                  />
                </div>
                <div>
                  <label htmlFor="menu-category" className="block text-sm font-medium text-gray-700">{t('menu.category')}</label>
                  <select
                    id="menu-category"
                    value={editing.categoryId || ''}
                    onChange={(e) => setEditing({ ...editing, categoryId: e.target.value, subCategoryId: undefined })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              {(() => {
                const subs = allCategories.filter((c) => c.type === 'sub' && c.parentId === editing.categoryId);
                return subs.length > 0 ? (
                  <div>
                    <label htmlFor="menu-subcategory" className="block text-sm font-medium text-gray-700">{t('category.subcategory')}</label>
                    <select
                      id="menu-subcategory"
                      value={editing.subCategoryId || ''}
                      onChange={(e) => setEditing({ ...editing, subCategoryId: e.target.value || undefined })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]"
                    >
                      <option value="">—</option>
                      {subs.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                ) : null;
              })()}
              <div className="flex items-center">
                <input
                  type="checkbox" id="menu-avail"
                  checked={editing.available ?? true}
                  onChange={(e) => setEditing({ ...editing, available: e.target.checked })}
                  className="h-4 w-4 text-[#0f766e] border-gray-300 rounded"
                />
                <label htmlFor="menu-avail" className="ml-2 text-sm text-gray-900">{t('menu.available')}</label>
              </div>

              {/* Translations */}
              <details className="border border-gray-200 rounded-lg">
                <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg">
                  <Globe className="w-4 h-4" /> {t('menu.translations')}
                </summary>
                <div className="px-3 pb-3 space-y-3 border-t border-gray-200 pt-3">
                  {locales.filter((l) => l.code !== 'en').map((locale) => (
                    <div key={locale.code} className="p-3 bg-gray-50 rounded-lg space-y-2">
                      <span className="text-xs font-semibold text-gray-500 uppercase">{locale.label}</span>
                      <input type="text" placeholder={t('menu.namePlaceholder', { code: locale.code })}
                        value={(editing.translations?.[locale.code] as { name?: string } | undefined)?.name || ''}
                        onChange={(e) => {
                          const tr = editing.translations || {};
                          tr[locale.code] = { ...tr[locale.code], name: e.target.value };
                          setEditing({ ...editing, translations: tr });
                        }}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e] text-sm" />
                      <textarea placeholder={t('menu.descPlaceholder', { code: locale.code })}
                        value={(editing.translations?.[locale.code] as { description?: string } | undefined)?.description || ''}
                        onChange={(e) => {
                          const tr = editing.translations || {};
                          tr[locale.code] = { ...tr[locale.code], description: e.target.value };
                          setEditing({ ...editing, translations: tr });
                        }}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e] text-sm" rows={2} />
                    </div>
                  ))}
                </div>
              </details>

              {allModifierGroups.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                    <ToggleLeft className="w-4 h-4" /> {t('menu.modifierGroups')}
                  </label>
                  <div className="space-y-1 max-h-40 overflow-y-auto border border-gray-200 rounded-md p-2">
                    {allModifierGroups.map((g) => (
                      <label key={g.id} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={linkedGroupIds.includes(g.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setLinkedGroupIds([...linkedGroupIds, g.id]);
                            } else {
                              setLinkedGroupIds(linkedGroupIds.filter((id) => id !== g.id));
                            }
                          }}
                          className="h-4 w-4 text-[#0f766e] border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-900">{g.name}</span>
                        <span className="text-xs text-gray-400">
                          ({t('menu.optionsCount', { count: g.options.length })})
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-end space-x-3">
                <button type="button" onClick={() => { setEditing(null); setLinkedGroupIds([]); }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
                  {t('common.cancel')}
                </button>
                <button type="submit"
                  className="px-4 py-2 bg-[#0f766e] text-white rounded-md hover:bg-[#1e3a5f]">
                  {t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex space-x-4 overflow-x-auto pb-4">
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedCategory(c.id)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap ${
              selectedCategory === c.id
                ? 'bg-[#ccfbf1] text-[#0f766e]'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {c.name}
          </button>
        ))}
        <button
          onClick={() => setSelectedCategory('')}
          className={`px-4 py-2 rounded-lg whitespace-nowrap ${
            selectedCategory === ''
              ? 'bg-[#ccfbf1] text-[#0f766e]'
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          {t('menu.categoryAll')}
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={filteredItems.map(i => i.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map((item) => (
              <SortableItem key={item.id} item={item} onEdit={startEditing} onDelete={handleDelete} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {filteredItems.length === 0 && (
        <p className="text-center text-gray-500 py-12">{t('menu.noItems')}</p>
      )}
    </div>
  );
}
