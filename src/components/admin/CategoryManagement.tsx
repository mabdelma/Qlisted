import { useState, useEffect } from 'react';
import { PlusCircle, Edit2, Trash2, MoveUp, MoveDown } from 'lucide-react';
import { menuApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { useToast } from '../ui/Toast';
import type { MenuCategory } from '../../lib/api/types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Modal } from '../ui/Modal';
import { ConfirmDialog } from '../ui/ConfirmDialog';

export function CategoryManagement() {
  const { t } = useI18n();
  const { toast } = useToast();
  const { state: { tenant } } = useAuth();
  const slug = tenant?.slug;
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MenuCategory | null>(null);

  useEffect(() => {
    if (slug) loadCategories();
  }, [slug]);

  async function loadCategories() {
    if (!slug) return;
    const data = await menuApi.getFullMenu(slug);
    setCategories(data.categories.sort((a, b) => a.sortOrder - b.sortOrder));
  }

  async function saveCategory(category: MenuCategory) {
    if (!slug) return;
    try {
      const isNew = !categories.find(c => c.id === category.id);
      if (isNew) {
        await menuApi.createCategory(slug, {
          name: category.name,
          type: category.type,
          parentId: category.parentId,
          sortOrder: category.sortOrder,
        });
      } else {
        await menuApi.updateCategory(slug, category.id, {
          name: category.name,
          type: category.type,
          parentId: category.parentId,
          sortOrder: category.sortOrder,
        });
      }
      setEditingCategory(null);
      toast('Category saved');
      loadCategories();
    } catch (error) {
      console.error('Failed to save category:', error);
      toast('Failed to save category', { tone: 'error' });
    }
  }

  async function deleteCategory(id: string) {
    if (!slug) return;
    try {
      await menuApi.deleteCategory(slug, id);
      setDeleteTarget(null);
      toast('Category deleted');
      loadCategories();
    } catch (error) {
      console.error('Failed to delete category:', error);
      toast('Failed to delete category', { tone: 'error' });
    }
  }

  async function moveCategory(id: string, direction: 'up' | 'down') {
    if (!slug) return;
    const currentIndex = categories.findIndex(c => c.id === id);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= categories.length) return;

    const updated = [...categories];
    const temp = updated[currentIndex].sortOrder;
    updated[currentIndex] = { ...updated[currentIndex], sortOrder: updated[newIndex].sortOrder };
    updated[newIndex] = { ...updated[newIndex], sortOrder: temp };
    setCategories(updated);

    try {
      await menuApi.reorderCategories(slug, [
        { id: updated[currentIndex].id, sortOrder: updated[currentIndex].sortOrder },
        { id: updated[newIndex].id, sortOrder: updated[newIndex].sortOrder },
      ]);
    } catch {
      loadCategories();
    }
  }

  const mainCategories = categories.filter(c => c.type === 'main');
  const subCategories = categories.filter(c => c.type === 'sub');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('menu.categories')}</h2>
        <Button
          onClick={() => setEditingCategory({
            id: crypto.randomUUID(),
            name: '',
            type: 'main',
            tenantId: '',
            sortOrder: categories.length
          })}
          leftIcon={<PlusCircle className="w-5 h-5" />}
        >
          {t('common.create')}
        </Button>
      </div>

      <Modal
        open={!!editingCategory}
        onClose={() => setEditingCategory(null)}
        title={editingCategory?.id && categories.some(c => c.id === editingCategory.id) ? 'Edit Category' : 'New Category'}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditingCategory(null)}>
              Cancel
            </Button>
            <Button type="submit" form="category-form" disabled={!editingCategory?.name.trim()}>
              Save
            </Button>
          </>
        }
      >
        {editingCategory && (
          <form
            id="category-form"
            onSubmit={(e) => {
              e.preventDefault();
              saveCategory(editingCategory);
            }}
            className="space-y-4"
          >
            <Input
              id="category-name"
              label="Name"
              value={editingCategory.name}
              onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
            />
            <Select
              id="category-type"
              label="Type"
              value={editingCategory.type}
              onChange={(e) => {
                const type = e.target.value as 'main' | 'sub';
                setEditingCategory({
                  ...editingCategory,
                  type,
                  parentId: type === 'main' ? undefined : editingCategory.parentId
                });
              }}
              options={[
                { value: 'main', label: 'Main Category' },
                { value: 'sub', label: 'Sub Category' },
              ]}
            />
            {editingCategory.type === 'sub' && (
              <Select
                id="category-parent"
                label="Parent Category"
                placeholder="Select a parent category"
                value={editingCategory.parentId}
                onChange={(e) => setEditingCategory({ ...editingCategory, parentId: e.target.value })}
                options={mainCategories.map((category) => ({ value: category.id, label: category.name }))}
              />
            )}
          </form>
        )}
      </Modal>

      <div className="space-y-8">
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4 dark:text-gray-100">Main Categories</h3>
          <div className="overflow-hidden rounded-card bg-white shadow-card dark:bg-gray-900">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                    Name
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {mainCategories.map((category) => (
                  <tr key={category.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {category.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveCategory(category.id, 'up')}
                        aria-label="Move up"
                      >
                        <MoveUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveCategory(category.id, 'down')}
                        aria-label="Move down"
                      >
                        <MoveDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingCategory(category)}
                        aria-label="Edit category"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(category)}
                        aria-label="Delete category"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4 dark:text-gray-100">Sub Categories</h3>
          <div className="overflow-hidden rounded-card bg-white shadow-card dark:bg-gray-900">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                    Parent Category
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {subCategories.map((category) => (
                  <tr key={category.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {category.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {mainCategories.find(c => c.id === category.parentId)?.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveCategory(category.id, 'up')}
                        aria-label="Move up"
                      >
                        <MoveUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveCategory(category.id, 'down')}
                        aria-label="Move down"
                      >
                        <MoveDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingCategory(category)}
                        aria-label="Edit category"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(category)}
                        aria-label="Delete category"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete category"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        tone="danger"
        onConfirm={() => deleteTarget && deleteCategory(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
