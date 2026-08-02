import { useState, useEffect, useCallback, useMemo } from 'react';
import { PlusCircle, Edit, Trash2, Image as ImageIcon } from 'lucide-react';
import { menuApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/Toast';
import type { MenuItem, MenuCategory } from '../../lib/api/types';
import { uploadImage } from '../../lib/utils/imageUpload';
import { formatMoney } from '../../lib/pricing';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import { Switch } from '../ui/Switch';
import { Modal } from '../ui/Modal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { CategoryManagement } from './CategoryManagement';

export function MenuManagement() {
  const { state: { tenant } } = useAuth();
  const slug = tenant?.slug;
  const currency = tenant?.currency;
  const { toast } = useToast();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [selectedMainCategory, setSelectedMainCategory] = useState<string>('');
  const [showCategories, setShowCategories] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MenuItem | null>(null);
  const [availableSubCategories, setAvailableSubCategories] = useState<MenuCategory[]>([]);

  const loadMenuItems = useCallback(async () => {
    if (!slug) return;
    const data = await menuApi.getFullMenu(slug);
    const sortedCategories = data.categories.sort((a, b) => a.sortOrder - b.sortOrder);
    const mainCategories = sortedCategories.filter(c => c.type === 'main');
    setMenuItems(data.items);
    setCategories(sortedCategories);
    if (mainCategories.length > 0) {
      setSelectedMainCategory((prev) => prev || mainCategories[0].id);
    }
  }, [slug]);

  useEffect(() => {
    if (slug) loadMenuItems();
  }, [slug, loadMenuItems]);

  useEffect(() => {
    if (editingItem) {
      const subs = categories.filter(
        c => c.type === 'sub' && c.parentId === editingItem.categoryId
      );
      setAvailableSubCategories(subs);
    }
  }, [editingItem, categories]);

  async function saveMenuItem(item: MenuItem) {
    if (!slug) return;
    try {
      const isNew = !menuItems.find(i => i.id === item.id);
      if (isNew) {
        await menuApi.createItem(slug, {
          categoryId: item.categoryId,
          name: item.name,
          price: item.price,
          description: item.description,
          imageUrl: item.imageUrl,
          available: item.available,
          subCategoryId: item.subCategoryId || undefined,
        });
      } else {
        await menuApi.updateItem(slug, item.id, {
          name: item.name,
          price: item.price,
          description: item.description,
          imageUrl: item.imageUrl,
          available: item.available,
          subCategoryId: item.subCategoryId || undefined,
        });
      }
      setEditingItem(null);
      toast('Menu item saved');
      const data = await menuApi.getFullMenu(slug);
      setMenuItems(data.items);
      setCategories(data.categories.sort((a, b) => a.sortOrder - b.sortOrder));
    } catch (error) {
      console.error('Failed to save menu item:', error);
      toast('Failed to save menu item', { tone: 'error' });
    }
  }

  async function deleteMenuItem(id: string) {
    if (!slug) return;
    try {
      await menuApi.deleteItem(slug, id);
      setDeleteTarget(null);
      toast('Menu item deleted');
      const data = await menuApi.getFullMenu(slug);
      setMenuItems(data.items);
    } catch (error) {
      console.error('Failed to delete menu item:', error);
      toast('Failed to delete menu item', { tone: 'error' });
    }
  }

  const mainCategories = useMemo(() => categories.filter(c => c.type === 'main'), [categories]);

  const filteredMenuItems = useMemo(() => {
    return menuItems
      .filter(item => item.categoryId === selectedMainCategory)
      .sort((a, b) => {
        const subCatA = categories.find(c => c.id === a.subCategoryId);
        const subCatB = categories.find(c => c.id === b.subCategoryId);
        return (subCatA?.sortOrder || 0) - (subCatB?.sortOrder || 0);
      });
  }, [menuItems, selectedMainCategory, categories]);

  function startNewItem() {
    if (!slug) return;
    loadMenuItems().then(() => {
      const firstMainCategory = mainCategories[0]?.id || '';
      const firstSubCategory = categories.find(
        c => c.type === 'sub' && c.parentId === firstMainCategory
      )?.id || '';
      setEditingItem({
        id: crypto.randomUUID(),
        name: '',
        description: '',
        price: 0,
        categoryId: firstMainCategory,
        subCategoryId: firstSubCategory,
        imageUrl: '',
        available: true,
        tenantId: '',
        sortOrder: 0,
      });
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Menu Management</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={startNewItem} leftIcon={<PlusCircle className="h-5 w-5" />}>
            Add Item
          </Button>
          <Button variant="outline" onClick={() => setShowCategories(true)}>
            Manage Categories
          </Button>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex space-x-4 overflow-x-auto pb-4">
          {mainCategories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedMainCategory(category.id)}
              aria-pressed={selectedMainCategory === category.id}
              className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                selectedMainCategory === category.id
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/50 dark:text-brand-200'
                  : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>

      {filteredMenuItems.length === 0 ? (
        <EmptyState
          icon={<ImageIcon className="h-10 w-10" />}
          title="No menu items"
          description="Add your first item to this category to get started."
          action={{ label: 'Add Item', onClick: startNewItem }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMenuItems.map((item) => (
            <article key={item.id} className="rounded-card bg-white p-6 shadow-card transition-shadow hover:shadow-card-hover dark:bg-gray-900">
              <div className="relative aspect-video mb-4 bg-gray-100 rounded-md overflow-hidden dark:bg-gray-800">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    width="320"
                    height="180"
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <ImageIcon className="w-12 h-12 text-gray-400" />
                  </div>
                )}
              </div>
              <div className="flex justify-between items-start mb-2 gap-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{item.name}</h3>
                <span className="text-lg font-medium text-gray-900 dark:text-gray-100">{formatMoney(item.price, currency)}</span>
              </div>
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-sm font-medium text-brand-600 dark:text-brand-400">
                  {categories.find(c => c.id === item.subCategoryId)?.name}
                </span>
              </div>
              <p className="text-gray-600 text-sm mb-4 dark:text-gray-400">{item.description}</p>
              <div className="flex justify-between items-center">
                <Badge variant={item.available ? 'success' : 'danger'} dot>
                  {item.available ? 'Available' : 'Unavailable'}
                </Badge>
                <div className="flex space-x-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditingItem(item)} aria-label="Edit item">
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(item)} aria-label="Delete item">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal open={showCategories} onClose={() => setShowCategories(false)} size="xl">
        <CategoryManagement />
      </Modal>

      <Modal
        open={!!editingItem}
        onClose={() => setEditingItem(null)}
        title={editingItem?.id && menuItems.some(i => i.id === editingItem.id) ? 'Edit Menu Item' : 'New Menu Item'}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditingItem(null)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="menu-item-form"
              disabled={!editingItem?.name.trim()}
            >
              Save
            </Button>
          </>
        }
      >
        {editingItem && (
          <form
            id="menu-item-form"
            onSubmit={(e) => {
              e.preventDefault();
              saveMenuItem(editingItem);
            }}
            className="space-y-4"
          >
            <Input
              id="menu-name"
              type="text"
              label="Name"
              placeholder="Enter item name"
              value={editingItem.name}
              onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
            />
            <Textarea
              id="menu-description"
              label="Description"
              placeholder="Enter item description"
              value={editingItem.description}
              onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                id="menu-price"
                type="number"
                step="0.01"
                min="0"
                label="Price"
                value={editingItem.price.toString()}
                onChange={(e) => {
                  const value = e.target.value;
                  const price = value === '' ? 0 : parseFloat(value);
                  setEditingItem({ ...editingItem, price: isNaN(price) ? 0 : price });
                }}
              />
              <Select
                id="menu-main-category"
                label="Main Category"
                value={editingItem.categoryId}
                onChange={(e) => {
                  const categoryId = e.target.value;
                  const firstSubCategory = categories.find(
                    c => c.type === 'sub' && c.parentId === categoryId
                  );
                  setEditingItem({
                    ...editingItem,
                    categoryId,
                    subCategoryId: firstSubCategory?.id || ''
                  });
                }}
                options={mainCategories.map((category) => ({ value: category.id, label: category.name }))}
              />
            </div>
            <Select
              id="menu-sub-category"
              label="Sub Category"
              placeholder="No sub-category"
              value={editingItem.subCategoryId}
              onChange={(e) => setEditingItem({ ...editingItem, subCategoryId: e.target.value })}
              options={availableSubCategories.map((category) => ({ value: category.id, label: category.name }))}
            />
            <div>
              <span className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Image</span>
              <div className="flex items-center gap-4">
                <div className="relative h-20 w-20 bg-gray-100 rounded-md overflow-hidden shrink-0 dark:bg-gray-800">
                  {editingItem.imageUrl ? (
                    <img
                      src={editingItem.imageUrl}
                      alt="Preview"
                      width="80"
                      height="80"
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-20 w-20 bg-gray-100 rounded-md flex items-center justify-center dark:bg-gray-800">
                      <ImageIcon className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                </div>
                <label className="cursor-pointer bg-white py-2 px-3 border border-gray-300 rounded-md shadow-sm text-sm leading-4 font-medium text-gray-700 hover:bg-gray-50 focus-within:ring-2 focus-within:ring-brand-500 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-800">
                  <span>Upload Image</span>
                  <input
                    id="menu-image"
                    type="file"
                    className="sr-only"
                    accept="image/*"
                    key={editingItem.id}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        try {
                          const imageUrl = await uploadImage(file);
                          setEditingItem({ ...editingItem, imageUrl });
                        } catch (error) {
                          console.error('Failed to upload image:', error);
                          toast('Failed to upload image', { tone: 'error' });
                        }
                      }
                    }}
                  />
                </label>
                {editingItem.imageUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={() => setEditingItem({ ...editingItem, imageUrl: '' })}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
            <Switch
              id="menu-available"
              label="Available"
              checked={editingItem.available}
              onChange={(checked) => setEditingItem({ ...editingItem, available: checked })}
            />
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete menu item"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        tone="danger"
        onConfirm={() => deleteTarget && deleteMenuItem(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
