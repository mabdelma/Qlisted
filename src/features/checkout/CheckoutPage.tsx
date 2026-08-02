import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useTableFlow } from '../restaurant/TableFlowLayout';
import { useCart } from '../../contexts/CartContext';
import { useI18n } from '../../contexts/I18nContext';
import { orderApi } from '../../lib/api';
import { ArrowLeft, ShoppingBag, CheckCircle, RotateCcw, ClipboardList } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Card } from '../../components/ui/Card';
import { Stepper } from '../../components/ui/Stepper';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { formatMoney } from '../../lib/pricing';

export function CheckoutPage() {
  const { t } = useI18n();
  const { slug, table, tenant } = useTableFlow();
  const { state, dispatch } = useCart();
  const navigate = useNavigate();
  const { tableId } = useParams();
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState(() => sessionStorage.getItem('guestName') || '');
  const [notes, setNotes] = useState('');
  const currency = tenant.currency;

  useEffect(() => {
    sessionStorage.setItem('guestName', customerName);
  }, [customerName]);

  const steps = [
    { id: 'menu', label: t('nav.menu') },
    { id: 'cart', label: t('nav.cart') },
    { id: 'checkout', label: t('nav.checkout') },
  ];

  async function placeOrder() {
    if (!slug || !table) return;
    setPlacing(true);
    setError(null);
    try {
      const res = await orderApi.create(slug, {
        tableId: table.id,
        items: state.items.map((c) => ({
          menuItemId: c.menuItem.id,
          name: c.menuItem.name,
          quantity: c.quantity,
          unitPrice: c.menuItem.price,
          notes: c.comment,
          modifiers: c.selectedModifiers ? JSON.stringify(c.selectedModifiers.map((m) => ({ name: m.optionName, groupName: m.groupName, priceAdjustment: m.priceAdjustment }))) : undefined,
        })),
        customerName: customerName || undefined,
        notes: notes || undefined,
      });
      setOrderId(res.id);
      dispatch({ type: 'CLEAR_CART' });
      setSuccess(true);
    } catch (err) {
      setError((err as { message?: string }).message || 'Failed to place order');
    } finally {
      setPlacing(false);
    }
  }

  if (success) {
    return (
      <div className="text-center py-12 space-y-5 animate-scale-in">
        <div className="relative mx-auto w-16 h-16">
          <div className="absolute inset-0 bg-green-100 rounded-full scale-110 animate-ping opacity-75" />
          <div className="relative w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('order.newOrder')}</h2>
          <p className="mt-1 text-gray-500 dark:text-gray-400">{t('order.orderReady')}</p>
        </div>
        {orderId && (
          <p className="text-sm text-gray-400">
            {t('order.placedAt')}: <span className="font-mono font-medium text-gray-600 dark:text-gray-300">#{orderId.slice(0, 8)}</span>
          </p>
        )}
        <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-center">
          <Button onClick={() => navigate(`/r/${slug}/table/${tableId}/orders`)} leftIcon={<ClipboardList className="w-4 h-4" />}>
            {t('nav.orders')}
          </Button>
          <Button variant="secondary" onClick={() => navigate(`/r/${slug}/table/${tableId}/menu`)} leftIcon={<RotateCcw className="w-4 h-4" />}>
            {t('order.newOrder')}
          </Button>
        </div>
      </div>
    );
  }

  if (state.items.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingBag className="h-7 w-7" />}
        title={t('order.emptyCart')}
        action={{ label: t('nav.menu'), onClick: () => navigate(`/r/${slug}/table/${tableId}/menu`) }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <button onClick={() => navigate(`/r/${slug}/table/${tableId}/cart`)}
        className="flex items-center text-sm text-gray-500 hover:text-brand-600 transition-colors dark:text-gray-400">
        <ArrowLeft className="h-4 w-4 me-1" /> {t('common.back')}
      </button>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('nav.checkout')}</h2>
        <Stepper steps={steps} current={2} className="hidden sm:flex" />
      </div>

      <Card padded className="space-y-4">
        <Input
          label={t('auth.name')}
          name="customer-name"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder={t('auth.name')}
        />
        <Textarea
          label={t('order.addNotes')}
          name="checkout-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder={t('order.addNotes')}
        />
      </Card>

      <Card padded>
        <h3 className="font-semibold text-gray-700 dark:text-gray-300">{t('payment.orderSummary')}</h3>
        <div className="mt-3 space-y-2">
          {state.items.map((item) => (
            <div key={item.menuItem.id} className="flex justify-between gap-3 text-sm">
              <span className="text-gray-700 dark:text-gray-300">
                {item.menuItem.name} <span className="text-gray-400">x{item.quantity}</span>
              </span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {formatMoney(item.menuItem.price * item.quantity, currency)}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 border-t pt-3 flex justify-between font-bold text-lg dark:border-gray-800">
          <span>{t('common.total')}</span>
          <span className="text-brand-600 dark:text-brand-400">{formatMoney(state.total, currency)}</span>
        </div>
      </Card>

      {error && <ErrorMessage message={error} />}

      <Button size="lg" fullWidth onClick={placeOrder} loading={placing}>
        {placing ? t('order.processOrder') : `${t('order.processOrder')} · ${formatMoney(state.total, currency)}`}
      </Button>

      <p className="text-xs text-gray-400 text-center">
        {t('payment.cash')} / {t('payment.card')}
      </p>
    </div>
  );
}
