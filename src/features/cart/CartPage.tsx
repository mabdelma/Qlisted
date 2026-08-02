import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useCart } from '../../contexts/CartContext';
import { useI18n } from '../../contexts/I18nContext';
import { useTableFlow } from '../restaurant/TableFlowLayout';
import { ShoppingBag, Minus, Plus, Trash2, ArrowRight, MessageCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Stepper } from '../../components/ui/Stepper';
import { EmptyState } from '../../components/ui/EmptyState';
import { Textarea } from '../../components/ui/Textarea';
import { formatMoney } from '../../lib/pricing';

export function CartPage() {
  const { t } = useI18n();
  const { state, dispatch } = useCart();
  const navigate = useNavigate();
  const { slug, tableId } = useParams();
  const { tenant } = useTableFlow();
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const currency = tenant.currency;

  const steps = [
    { id: 'menu', label: t('nav.menu') },
    { id: 'cart', label: t('nav.cart') },
    { id: 'checkout', label: t('nav.checkout') },
  ];

  const unitPrice = (item: (typeof state.items)[number]) =>
    item.menuItem.price + (item.selectedModifiers?.reduce((s, m) => s + m.priceAdjustment, 0) ?? 0);

  return (
    <div className="space-y-4 pb-32 sm:pb-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('nav.cart')}</h2>
        <Badge variant="brand">{t('order.itemCount', { count: state.items.length })}</Badge>
      </div>

      <Stepper steps={steps} current={1} className="hidden sm:flex" />

      {state.items.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="h-7 w-7" />}
          title={t('order.emptyCart')}
          description={t('menu.items')}
          action={{ label: t('nav.menu'), onClick: () => navigate(`/r/${slug}/table/${tableId}/menu`) }}
        />
      ) : (
        <>
          <div className="space-y-3">
            {state.items.map((item) => (
              <div key={item.menuItem.id} className="card p-4">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 dark:text-gray-100">{item.menuItem.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{formatMoney(unitPrice(item), currency)} {t('common.item')}</p>
                    {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.selectedModifiers.map((m, i) => (
                          <Badge key={i} variant="neutral">
                            {m.optionName}
                            {m.priceAdjustment > 0 ? ` +${formatMoney(m.priceAdjustment, currency)}` : ''}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                      <span className="text-xs text-gray-400">
                        {item.quantity} × {formatMoney(unitPrice(item), currency)}
                      </span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {formatMoney(unitPrice(item) * item.quantity, currency)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1.5 ms-2 flex-shrink-0">
                    <button onClick={() => {
                      if (item.quantity > 1) {
                        dispatch({ type: 'UPDATE_QUANTITY', payload: { id: item.menuItem.id, quantity: item.quantity - 1 } });
                      } else {
                        dispatch({ type: 'REMOVE_ITEM', payload: item.menuItem.id });
                      }
                    }}
                      aria-label={`Decrease quantity of ${item.menuItem.name}`}
                      className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="font-medium w-6 text-center tabular-nums">{item.quantity}</span>
                    <button onClick={() => dispatch({ type: 'UPDATE_QUANTITY', payload: { id: item.menuItem.id, quantity: item.quantity + 1 } })}
                      aria-label={`Increase quantity of ${item.menuItem.name}`}
                      className="w-8 h-8 rounded-full bg-brand-500 text-white flex items-center justify-center hover:bg-brand-600">
                      <Plus className="w-4 h-4" />
                    </button>
                    <button onClick={() => { setEditingComment(item.menuItem.id); setCommentText(item.comment || ''); }}
                      aria-label={`Add comment for ${item.menuItem.name}`}
                      aria-pressed={!!item.comment}
                      className={`p-1.5 rounded transition-colors ${item.comment ? 'text-brand-600 bg-brand-50 dark:bg-brand-900/50 dark:text-brand-300' : 'text-gray-400 hover:text-brand-600 hover:bg-brand-50'}`}>
                      <MessageCircle className="w-4 h-4" />
                    </button>
                    <button onClick={() => dispatch({ type: 'REMOVE_ITEM', payload: item.menuItem.id })}
                      aria-label={`Remove ${item.menuItem.name} from cart`}
                      className="p-1 text-red-500 hover:bg-red-50 rounded dark:hover:bg-red-950">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {editingComment === item.menuItem.id && (
                  <div className="mt-3 space-y-2">
                    <Textarea
                      name={`comment-${item.menuItem.id}`}
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder={t('order.addNotes')}
                      rows={2}
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setEditingComment(null)}>{t('common.cancel')}</Button>
                      <Button size="sm" onClick={() => { dispatch({ type: 'SET_COMMENT', payload: { id: item.menuItem.id, comment: commentText } }); setEditingComment(null); }}>
                        {t('common.save')}
                      </Button>
                    </div>
                  </div>
                )}

                {item.comment && editingComment !== item.menuItem.id && (
                  <p className="mt-1 text-sm text-gray-600 italic dark:text-gray-400">"{item.comment}"</p>
                )}
              </div>
            ))}
          </div>

          <div className="card p-4 space-y-3">
            <Textarea
              label={t('order.addNotes')}
              name="order-notes"
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              placeholder={t('order.addNotes')}
              rows={3}
            />
          </div>

          {/* Desktop: inline totals */}
          <div className="card hidden p-4 sm:block">
            <div className="flex justify-between text-lg font-bold">
              <span>{t('common.total')}</span>
              <span className="text-brand-600 dark:text-brand-400">{formatMoney(state.total, currency)}</span>
            </div>
            <div className="mt-4 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => dispatch({ type: 'CLEAR_CART' })}>
                {t('order.clearCart')}
              </Button>
              <Button className="flex-1" onClick={() => navigate(`/r/${slug}/table/${tableId}/checkout`)} rightIcon={<ArrowRight className="w-4 h-4" />}>
                {t('nav.checkout')}
              </Button>
            </div>
          </div>

          {/* Mobile: sticky totals bar */}
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 backdrop-blur p-4 sm:hidden dark:border-gray-800 dark:bg-gray-900/95">
            <div className="mx-auto flex max-w-3xl flex-col gap-2">
              <div className="flex justify-between text-lg font-bold">
                <span>{t('common.total')}</span>
                <span className="text-brand-600 dark:text-brand-400">{formatMoney(state.total, currency)}</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => dispatch({ type: 'CLEAR_CART' })}>
                  {t('order.clearCart')}
                </Button>
                <Button className="flex-1" onClick={() => navigate(`/r/${slug}/table/${tableId}/checkout`)} rightIcon={<ArrowRight className="w-4 h-4" />}>
                  {t('nav.checkout')}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
