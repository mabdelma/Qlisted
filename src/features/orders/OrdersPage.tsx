import { useState, useEffect, useCallback } from 'react';
import { useTableFlow } from '../restaurant/TableFlowLayout';
import { orderApi, paymentApi } from '../../lib/api';
import { useI18n, type TranslationKey } from '../../contexts/I18nContext';
import { useSSE } from '../../hooks/useSSE';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { StripePaymentForm } from '../menu/StripePaymentForm';
import { Package, RefreshCw, Clock } from 'lucide-react';
import type { Order } from '../../lib/api/types';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Spinner } from '../../components/ui/Spinner';
import { OrderStatusTimeline } from '../../components/orders/OrderStatusTimeline';
import { formatMoney } from '../../lib/pricing';

let stripePromise: Promise<Stripe | null> | null | undefined;
function getStripe() {
  if (stripePromise === undefined) {
    const key = import.meta.env.VITE_STRIPE_KEY || '';
    stripePromise = key ? loadStripe(key) : null;
  }
  return stripePromise;
}

export function OrdersPage() {
  const { t } = useI18n();
  const { table, slug, tenant } = useTableFlow();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);
  const currency = tenant.currency;

  const loadOrders = useCallback(() => {
    if (!slug || !table?.id) return;
    orderApi.getForTable(slug, table.id)
      .then(setOrders)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug, table?.id]);

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 15000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  useSSE(slug, {
    onOrderCreated: () => { loadOrders(); },
    onOrderUpdated: () => { loadOrders(); },
    onOrderStatusChanged: () => { loadOrders(); },
  });

  async function handlePayCash(orderId: string, total: number) {
    if (!slug) return;
    try {
      await paymentApi.recordCash(slug, { orderId, amount: total });
      setPayingOrderId(null);
      loadOrders();
    } catch {
      // payment failed silently
    }
  }

  return (
    <div className="space-y-4" aria-live="polite">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('nav.orders')}</h2>
        <Button variant="ghost" size="sm" onClick={loadOrders} leftIcon={<RefreshCw className="w-4 h-4" />}>
          {t('common.retry')}
        </Button>
      </div>

      {loading ? (
        <div className="py-10"><Spinner className="mx-auto" /></div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={<Package className="h-7 w-7" />}
          title={t('common.noResults')}
          description={t('order.emptyCart')}
        />
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Card key={order.id} padded>
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={
                      order.status === 'cancelled' ? 'danger'
                        : order.status === 'delivered' ? 'neutral'
                          : order.status === 'ready' ? 'success'
                            : order.status === 'preparing' ? 'info'
                              : 'warning'
                    } dot>
                      {t(`order.${order.status}` as TranslationKey)}
                    </Badge>
                    <Badge variant={order.paymentStatus === 'paid' ? 'success' : 'neutral'}>
                      {order.paymentStatus === 'paid' ? t('payment.paid') : t('payment.unpaid')}
                    </Badge>
                  </div>
                  <p className="mt-1.5 flex items-center text-xs text-gray-400">
                    <Clock className="w-3 h-3 me-1" aria-hidden />
                    {new Date(order.createdAt).toLocaleTimeString()}
                  </p>
                </div>
                <span className="font-bold text-lg text-brand-600 dark:text-brand-400">{formatMoney(order.total, currency)}</span>
              </div>

              <div className="mt-4">
                <OrderStatusTimeline status={order.status} />
              </div>

              {(order.status === 'ready' || order.status === 'delivered') && order.paymentStatus !== 'paid' && (
                <div className="mt-4 pt-4 border-t dark:border-gray-800">
                  {payingOrderId === order.id ? (
                    <div className="space-y-3">
                      {getStripe() ? (
                        <Elements stripe={getStripe()!}>
                          <StripePaymentForm
                            stripePromise={getStripe()}
                            slug={slug}
                            orderId={order.id}
                            amount={order.total}
                            onSuccess={() => { setPayingOrderId(null); loadOrders(); }}
                            onCancel={() => setPayingOrderId(null)}
                          />
                        </Elements>
                      ) : (
                        <p className="text-sm text-red-600 dark:text-red-400">{t('common.notAvailable')}</p>
                      )}
                      <Button variant="success" fullWidth onClick={() => handlePayCash(order.id, order.total)}>
                        {t('payment.cash')}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="success" className="flex-1" onClick={() => handlePayCash(order.id, order.total)}>
                        {t('payment.cash')}
                      </Button>
                      {getStripe() && (
                        <Button className="flex-1" onClick={() => setPayingOrderId(order.id)}>
                          {t('payment.card')}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
