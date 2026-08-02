import { useState, useEffect } from 'react';
import { useParams } from 'react-router';
import { useI18n } from '../../contexts/I18nContext';
import { orderApi } from '../../lib/api';
import type { Order, OrderItem } from '../../lib/api/types';
import { Package, ShoppingBag, RefreshCw } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { OrderStatusTimeline } from '../../components/orders/OrderStatusTimeline';
import { formatMoney } from '../../lib/pricing';

interface OrderWithItems extends Order {
  items: OrderItem[];
}

export function OrderTracking() {
  const { t } = useI18n();
  const { slug, orderId } = useParams<{ slug: string; orderId: string }>();
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchOrder() {
    if (!slug || !orderId) return;
    try {
      const data = await orderApi.trackOrder(slug, orderId);
      setOrder(data as OrderWithItems);
      setError(null);
    } catch {
      setError(t('tracking.notFound'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOrder();
    const interval = setInterval(fetchOrder, 10000);
    return () => clearInterval(interval);
  }, [slug, orderId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-amber-50 to-white dark:from-gray-950 dark:to-gray-950">
        <div className="text-center">
          <RefreshCw className="mx-auto mb-4 h-12 w-12 animate-spin text-brand-500" aria-hidden />
          <p className="text-gray-500">{t('tracking.loading')}</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-amber-50 to-white dark:from-gray-950 dark:to-gray-950">
        <div className="mx-auto max-w-md p-8 text-center">
          <Package className="mx-auto mb-4 h-16 w-16 text-gray-300" aria-hidden />
          <h2 className="mb-2 text-xl font-bold text-gray-900 dark:text-gray-100">{t('common.error')}</h2>
          <p className="text-gray-500">{error || t('tracking.notFound')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white dark:from-gray-950 dark:to-gray-950">
      <div className="mx-auto max-w-lg px-4 py-12" aria-live="polite">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-500">
            <ShoppingBag className="h-8 w-8 text-white" aria-hidden />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('tracking.title')} #{order.id.slice(0, 8)}</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            {order.orderType === 'dine_in' ? t('order.dineIn') : order.orderType === 'takeout' ? t('order.takeaway') : t('order.delivery')}
          </p>
          <div className="mt-2 flex items-center justify-center gap-2">
            <Badge variant={order.status === 'cancelled' ? 'danger' : order.status === 'delivered' ? 'neutral' : order.status === 'ready' ? 'success' : order.status === 'preparing' ? 'info' : 'warning'} dot>
              {t(`order.${order.status}` as never)}
            </Badge>
          </div>
        </div>

        <Card padded className="mb-6">
          <OrderStatusTimeline status={order.status} />
        </Card>

        <Card padded className="mb-6">
          <h3 className="mb-4 font-semibold text-gray-900 dark:text-gray-100">{t('common.items')}</h3>
          <div className="space-y-3">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-900 dark:text-brand-200">
                    {item.quantity}
                  </span>
                  <div>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.name}</span>
                    {item.notes && <p className="text-xs text-gray-400">{item.notes}</p>}
                  </div>
                </div>
                <span className="text-sm text-gray-600 dark:text-gray-300">{formatMoney(item.unitPrice * item.quantity)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card padded>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-500 dark:text-gray-400">
              <span>{t('common.subtotal')}</span>
              <span>{formatMoney(order.subtotal)}</span>
            </div>
            {order.discountAmount ? (
              <div className="flex justify-between text-red-500 dark:text-red-400">
                <span>{t('common.discount')}</span>
                <span>-{formatMoney(order.discountAmount)}</span>
              </div>
            ) : null}
            <div className="flex justify-between text-gray-500 dark:text-gray-400">
              <span>{t('common.tax')}</span>
              <span>{formatMoney(order.tax)}</span>
            </div>
            {order.deliveryFee ? (
              <div className="flex justify-between text-gray-500 dark:text-gray-400">
                <span>{t('common.price')}</span>
                <span>{formatMoney(order.deliveryFee)}</span>
              </div>
            ) : null}
            <div className="flex justify-between border-t pt-2 font-bold text-gray-900 dark:border-gray-800 dark:text-gray-100">
              <span>{t('common.total')}</span>
              <span>{formatMoney(order.total)}</span>
            </div>
          </div>
        </Card>

        <div className="mt-6 text-center">
          <Button variant="ghost" size="sm" onClick={fetchOrder} leftIcon={<RefreshCw className="w-4 h-4" />}>
            {t('common.retry')}
          </Button>
        </div>
        <p className="mt-2 text-center text-xs text-gray-400">{t('tracking.autoRefresh')}</p>
      </div>
    </div>
  );
}
