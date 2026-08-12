import React from 'react';
import { useParams, useNavigate } from 'react-router';
import { X, Minus, Plus, ShoppingBag } from 'lucide-react';
import { useCart } from '../../contexts/CartContext';
import { menuApi } from '../../lib/api';
import type { MenuItem, ModifierGroup, ModifierSelection } from '../../lib/api/types';
import { LoadingSpinner } from '../ui/LoadingSpinner';

export function MenuItemDetail() {
  const { slug, tableId, itemId } = useParams();
  const navigate = useNavigate();
  const { dispatch } = useCart();
  const [item, setItem] = React.useState<MenuItem | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [quantity, setQuantity] = React.useState(1);
  const [comment, setComment] = React.useState('');
  const [modifierGroups, setModifierGroups] = React.useState<ModifierGroup[]>([]);
  const [selections, setSelections] = React.useState<Record<string, string[]>>({});

  React.useEffect(() => {
    loadItem();
  }, [itemId]);

  async function loadItem() {
    if (!itemId || !slug) return;
    try {
      const data = await menuApi.getFullMenu(slug);
      const menuItem = data.items.find(i => i.id === itemId) || null;
      setItem(menuItem);
      if (menuItem) {
        try {
          const groups = await menuApi.getMenuItemModifiers(slug, menuItem.id);
          setModifierGroups(groups.data);
          const defaults: Record<string, string[]> = {};
          for (const g of groups.data) {
            defaults[g.id] = [];
          }
          setSelections(defaults);
        } catch {
          // no modifiers
        }
      }
    } catch (error) {
      console.error('Failed to load menu item:', error);
    } finally {
      setLoading(false);
    }
  }

  function toggleOption(groupId: string, optionId: string, selectionType: string) {
    setSelections((prev) => {
      const current = prev[groupId] ?? [];
      if (selectionType === 'single') {
        return { ...prev, [groupId]: current.includes(optionId) ? [] : [optionId] };
      }
      if (current.includes(optionId)) {
        return { ...prev, [groupId]: current.filter((id) => id !== optionId) };
      }
      return { ...prev, [groupId]: [...current, optionId] };
    });
  }

  function getSelectedModifiers(): ModifierSelection[] {
    const result: ModifierSelection[] = [];
    for (const group of modifierGroups) {
      const selectedIds = selections[group.id] ?? [];
      for (const optId of selectedIds) {
        const opt = group.options.find((o) => o.id === optId);
        if (opt) {
          result.push({
            groupId: group.id,
            groupName: group.name,
            optionId: opt.id,
            optionName: opt.name,
            priceAdjustment: opt.priceAdjustment,
          });
        }
      }
    }
    return result;
  }

  function modifiersTotal(): number {
    return getSelectedModifiers().reduce((sum, m) => sum + m.priceAdjustment, 0);
  }

  const handleAddToCart = () => {
    if (!item) return;
    dispatch({
      type: 'ADD_ITEM',
      payload: item,
      quantity,
      comment,
      selectedModifiers: getSelectedModifiers(),
    });
    navigate(`/r/${slug}/table/${tableId}/menu`);
  };

  if (loading) return <LoadingSpinner />;
  if (!item || !item.available) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Item Not Available</h2>
        <p className="text-gray-600 mb-6">This menu item is currently unavailable.</p>
        <button
          onClick={() => navigate(`/r/${slug}/table/${tableId}/menu`)}
          className="px-4 py-2 bg-[#0f766e] text-white rounded-md hover:bg-[#1e3a5f]"
        >
          Return to Menu
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="relative">
        <button
          onClick={() => navigate(`/r/${slug}/table/${tableId}/menu`)}
          aria-label="Close"
          className="absolute right-4 top-4 p-2 rounded-full bg-white shadow-md hover:bg-gray-100 z-10"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>

        <div className="h-96 w-full overflow-hidden">
          {item.imageUrl ? (
            <img src={item.imageUrl} alt={item.name} width="640" height="320" loading="lazy" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gray-200 flex items-center justify-center">
              <ShoppingBag className="w-12 h-12 text-gray-400" />
            </div>
          )}
        </div>
      </div>

      <div className="p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{item.name}</h2>
        <p className="text-gray-600 text-lg mb-4">{item.description}</p>
        <p className="text-2xl font-bold text-[#0f766e] mb-6">
          ${item.price.toFixed(2)}
        </p>

        {modifierGroups.length > 0 && (
          <div className="space-y-6 mb-6 border-t pt-6">
            {modifierGroups.map((group) => (
              <div key={group.id}>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-lg font-medium text-gray-900">{group.name}</h3>
                  {group.isRequired && <span className="text-xs text-red-500">Required</span>}
                  <span className="text-xs text-gray-400">
                    {group.selectionType === 'single' ? '(Choose one)' : '(Choose any)'}
                  </span>
                </div>
                <div className="space-y-2">
                  {group.options.map((opt) => {
                    const isSelected = (selections[group.id] ?? []).includes(opt.id);
                    return (
                      <label
                        key={opt.id}
                        className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                          isSelected
                            ? 'border-[#0f766e] bg-[#ccfbf1]'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type={group.selectionType === 'single' ? 'radio' : 'checkbox'}
                            name={`modifier-${group.id}`}
                            checked={isSelected}
                            onChange={() => toggleOption(group.id, opt.id, group.selectionType)}
                            className="h-4 w-4 text-[#0f766e] border-gray-300"
                          />
                          <span className="text-sm text-gray-900">{opt.name}</span>
                        </div>
                        {opt.priceAdjustment > 0 && (
                          <span className="text-sm text-green-600">+${opt.priceAdjustment.toFixed(2)}</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Special Instructions (Optional)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add any special requests..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-[#0f766e] focus:border-[#0f766e] text-gray-700 placeholder-gray-400"
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                aria-label="Decrease quantity"
                className="p-2 rounded-full border-2 border-[#0f766e] text-[#0f766e] hover:bg-[#ccfbf1]"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="text-xl font-bold text-gray-900 w-8 text-center">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                aria-label="Increase quantity"
                className="p-2 rounded-full border-2 border-[#0f766e] text-[#0f766e] hover:bg-[#ccfbf1]"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={handleAddToCart}
              disabled={modifierGroups.some((g) => g.isRequired && (selections[g.id] ?? []).length === 0)}
              className="px-8 py-4 bg-[#0f766e] text-white rounded-lg hover:bg-[#1e3a5f] disabled:opacity-50 disabled:cursor-not-allowed flex items-center text-lg font-medium transition-colors"
            >
              <ShoppingBag className="w-5 h-5 mr-2" />
              Add to Cart - ${((item.price + modifiersTotal()) * quantity).toFixed(2)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}