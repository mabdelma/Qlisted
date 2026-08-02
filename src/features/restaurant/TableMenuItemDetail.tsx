import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useTableFlow } from './TableFlowLayout';
import { useCart } from '../../contexts/CartContext';
import { useI18n } from '../../contexts/I18nContext';
import { menuApi } from '../../lib/api';
import { ArrowLeft, Minus, Plus, ShoppingBag, Check, UtensilsCrossed } from 'lucide-react';
import type { ModifierGroup, ModifierSelection } from '../../lib/api/types';
import { Button } from '../../components/ui/Button';
import { Textarea } from '../../components/ui/Textarea';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatMoney } from '../../lib/pricing';

export function TableMenuItemDetail() {
  const { t } = useI18n();
  const { tenant, items, slug } = useTableFlow();
  const { dispatch } = useCart();
  const navigate = useNavigate();
  const { tableId, itemId } = useParams();
  const [quantity, setQuantity] = useState(1);
  const [comment, setComment] = useState('');
  const [showAdded, setShowAdded] = useState(false);
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const currency = tenant.currency;

  const item = items.find((i) => i.id === itemId);

  useEffect(() => {
    if (!item || !slug) return;
    menuApi.getMenuItemModifiers(slug, item.id).then((groups) => {
      setModifierGroups(groups);
      const defaults: Record<string, string[]> = {};
      for (const g of groups) {
        defaults[g.id] = [];
      }
      setSelections(defaults);
    }).catch(() => {});
  }, [item?.id, slug]);

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

  const hasRequiredUnselected = modifierGroups.some((g) => g.isRequired && (selections[g.id] ?? []).length === 0);
  const unitPrice = (item?.price ?? 0) + modifiersTotal();

  const resetForm = () => {
    setShowAdded(false);
    setQuantity(1);
    setComment('');
    setSelections((prev) => {
      const copy = { ...prev };
      for (const k of Object.keys(copy)) copy[k] = [];
      return copy;
    });
  };

  if (!item || !item.available) {
    return (
      <EmptyState
        icon={<UtensilsCrossed className="h-7 w-7" />}
        title={t('common.notAvailable')}
        description={t('error.notFound')}
        action={{ label: t('common.back'), onClick: () => navigate(`/r/${slug}/table/${tableId}/menu`) }}
      />
    );
  }

  if (showAdded) {
    return (
      <div className="text-center py-12 space-y-6 animate-scale-in">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto dark:bg-green-900/50">
          <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('common.done')}</h2>
          <p className="mt-1 text-gray-500 dark:text-gray-400">{item.name}</p>
        </div>
        <div className="flex gap-3 justify-center">
          <Button variant="secondary" onClick={resetForm}>{t('common.continue')}</Button>
          <Button onClick={() => navigate(`/r/${slug}/table/${tableId}/cart`)}>{t('nav.cart')}</Button>
        </div>
      </div>
    );
  }

  const handleAddToCart = () => {
    dispatch({
      type: 'ADD_ITEM',
      payload: item,
      quantity,
      comment: comment || undefined,
      selectedModifiers: getSelectedModifiers(),
    });
    setShowAdded(true);
  };

  return (
    <div className="space-y-4 pb-28 sm:pb-6">
      <button onClick={() => navigate(`/r/${slug}/table/${tableId}/menu`)}
        className="flex items-center text-sm text-gray-500 hover:text-brand-600 transition-colors dark:text-gray-400">
        <ArrowLeft className="h-4 w-4 me-1" /> {t('common.back')}
      </button>

      <div className="card overflow-hidden">
        <div className="h-64 sm:h-80 w-full overflow-hidden bg-gray-100 dark:bg-gray-800">
          {item.imageUrl ? (
            <img src={item.imageUrl} alt={item.name} width="640" height="320" loading="lazy" decoding="async" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <UtensilsCrossed className="w-16 h-16 text-gray-300 dark:text-gray-600" />
            </div>
          )}
        </div>

        <div className="p-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{item.name}</h2>
              {item.description && (
                <p className="mt-1 text-gray-600 dark:text-gray-400">{item.description}</p>
              )}
            </div>
            <Badge variant={item.available ? 'success' : 'neutral'} dot>
              {item.available ? t('menu.availableItems', { count: 1 }) : t('menu.soldOut')}
            </Badge>
          </div>
          <p className="text-2xl font-bold text-brand-600 dark:text-brand-400">
            {formatMoney(unitPrice, currency)}
          </p>

          {modifierGroups.length > 0 && (
            <div className="space-y-4 border-t pt-5 dark:border-gray-800">
              {modifierGroups.map((group) => (
                <fieldset key={group.id}>
                  <legend className="flex flex-wrap items-center gap-2 mb-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {group.name}
                    {group.isRequired && <Badge variant="danger">{t('order.required')}</Badge>}
                    <span className="text-xs font-normal text-gray-400">
                      {group.selectionType === 'single' ? t('menu.chooseOne') : t('menu.chooseAny')}
                    </span>
                  </legend>
                  <div className="space-y-1.5">
                    {group.options.map((opt) => {
                      const isSelected = (selections[group.id] ?? []).includes(opt.id);
                      return (
                        <label
                          key={opt.id}
                          className={`flex items-center justify-between px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                            isSelected
                              ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/40 dark:border-brand-400'
                              : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type={group.selectionType === 'single' ? 'radio' : 'checkbox'}
                              name={`modifier-${group.id}`}
                              checked={isSelected}
                              onChange={() => toggleOption(group.id, opt.id, group.selectionType)}
                              className="h-4 w-4 text-brand-500 border-gray-300 focus:ring-brand-500/40 dark:border-gray-600 dark:bg-gray-800"
                            />
                            <span className="text-sm text-gray-900 dark:text-gray-100">{opt.name}</span>
                          </div>
                          {opt.priceAdjustment !== 0 && (
                            <span className={`text-sm ${opt.priceAdjustment > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}`}>
                              {opt.priceAdjustment > 0 ? '+' : ''}{formatMoney(opt.priceAdjustment, currency)}
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </div>
          )}

          <div>
            <Textarea
              label={t('order.specialInstructions')}
              name="item-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('order.addNotes')}
              rows={3}
            />
          </div>

          {/* Desktop: inline controls */}
          <div className="hidden sm:flex items-center justify-between gap-4 border-t pt-5 dark:border-gray-800">
            <QuantityStepper quantity={quantity} onDecrease={() => setQuantity(Math.max(1, quantity - 1))} onIncrease={() => setQuantity(quantity + 1)} />
            <Button size="lg" onClick={handleAddToCart} disabled={hasRequiredUnselected} leftIcon={<ShoppingBag className="w-5 h-5" />}>
              {t('menu.addToCart')} · {formatMoney(unitPrice * quantity, currency)}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile: sticky bottom add-to-cart bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 backdrop-blur p-4 sm:hidden dark:border-gray-800 dark:bg-gray-900/95">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <QuantityStepper quantity={quantity} onDecrease={() => setQuantity(Math.max(1, quantity - 1))} onIncrease={() => setQuantity(quantity + 1)} />
          <Button className="flex-1" size="lg" onClick={handleAddToCart} disabled={hasRequiredUnselected} leftIcon={<ShoppingBag className="w-5 h-5" />}>
            {t('menu.addToCart')} · {formatMoney(unitPrice * quantity, currency)}
          </Button>
        </div>
      </div>
    </div>
  );
}

function QuantityStepper({ quantity, onDecrease, onIncrease }: { quantity: number; onDecrease: () => void; onIncrease: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <button onClick={onDecrease}
        aria-label="Decrease quantity"
        className="p-2 rounded-full border-2 border-brand-500 text-brand-600 hover:bg-brand-50 transition-colors dark:border-brand-400 dark:text-brand-300 dark:hover:bg-brand-900/40">
        <Minus className="w-4 h-4" />
      </button>
      <span className="text-xl font-bold text-gray-900 w-8 text-center tabular-nums dark:text-gray-100">{quantity}</span>
      <button onClick={onIncrease}
        aria-label="Increase quantity"
        className="p-2 rounded-full border-2 border-brand-500 text-brand-600 hover:bg-brand-50 transition-colors dark:border-brand-400 dark:text-brand-300 dark:hover:bg-brand-900/40">
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}
