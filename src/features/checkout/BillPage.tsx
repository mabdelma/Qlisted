import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router';
import { useTableFlow } from '../restaurant/TableFlowLayout';
import { orderApi, paymentApi } from '../../lib/api';
import { useI18n } from '../../contexts/I18nContext';
import type { TranslationKey } from '../../contexts/I18nContext';
import { useSSE } from '../../hooks/useSSE';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { StripePaymentForm } from '../menu/StripePaymentForm';
import { Receipt, Plus, Minus, Users, Check, ChevronDown, ChevronUp, AlertTriangle, Star } from 'lucide-react';
import { PromoCodeCheckout } from '../loyalty/PromoCodeCheckout';
import type { Order, OrderItem } from '../../lib/api/types';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatMoney } from '../../lib/pricing';

let stripePromise: Promise<Stripe | null> | null | undefined;
function getStripe() {
  if (stripePromise === undefined) {
    const key = import.meta.env.VITE_STRIPE_KEY || '';
    stripePromise = key ? loadStripe(key) : null;
  }
  return stripePromise;
}

function statusBadge(order: Order, t: (k: TranslationKey) => string) {
  if (order.paymentStatus === 'paid') return <Badge variant="success" dot>{t('payment.paid')}</Badge>;
  switch (order.status) {
    case 'preparing': return <Badge variant="info" dot>{t('order.preparing')}</Badge>;
    case 'ready': return <Badge variant="success" dot>{t('order.ready')}</Badge>;
    case 'delivered': return <Badge variant="neutral" dot>{t('order.delivered')}</Badge>;
    case 'cancelled': return <Badge variant="danger" dot>{t('order.cancelled')}</Badge>;
    default: return <Badge variant="warning" dot>{t('order.pending')}</Badge>;
  }
}

export function BillPage() {
  const { t } = useI18n();
  const { slug, table, tenant } = useTableFlow();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [tipPercent, setTipPercent] = useState(0);
  const [customTipAmount, setCustomTipAmount] = useState<number | null>(null);
  const [splitCount, setSplitCount] = useState(1);
  const [splitMode, setSplitMode] = useState<'even' | 'item'>('even');
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [sharePartialAmount, setSharePartialAmount] = useState<number | null>(null);
  const [paying, setPaying] = useState(false);
  const [paidOrderId, setPaidOrderId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'split'>('cash');
  const [showAll, setShowAll] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [successPaid, setSuccessPaid] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});
  const [orderItemsMap, setOrderItemsMap] = useState<Record<string, OrderItem[]>>({});
  const [itemsLoading, setItemsLoading] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [paymentError, setPaymentError] = useState('');
  const currency = tenant.currency;
  const money = (n: number) => formatMoney(n, currency);

  const loadOrders = useCallback(() => {
    if (!slug || !table?.id) return;
    orderApi.getForTable(slug, table.id)
      .then(setOrders)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug, table?.id]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  useSSE(slug, {
    onOrderCreated: () => { loadOrders(); },
    onOrderUpdated: () => { loadOrders(); },
    onOrderStatusChanged: () => { loadOrders(); },
  });

  useEffect(() => {
    if (!slug || orders.length === 0) return;
    let cancelled = false;
    setItemsLoading(true);
    Promise.all(orders.map((o) => orderApi.getDetail(slug, o.id)))
      .then((results) => {
        if (cancelled) return;
        const map: Record<string, OrderItem[]> = {};
        results.forEach((detail) => {
          map[detail.id] = detail.items || [];
        });
        setOrderItemsMap(map);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setItemsLoading(false);
      });
    return () => { cancelled = true; };
  }, [slug, orders]);

  const displayedOrders = showAll ? orders : orders.filter((o) => o.paymentStatus !== 'paid');
  const unpaidOrders = orders.filter((o) => o.paymentStatus !== 'paid');
  const subtotal = unpaidOrders.reduce((s, o) => s + o.subtotal, 0);
  const tax = unpaidOrders.reduce((s, o) => s + o.tax, 0);
  const serviceCharge = unpaidOrders.reduce((s, o) => s + o.serviceCharge, 0);
  const totalBeforeTip = subtotal + tax + serviceCharge - discount;
  const tipAmount = customTipAmount !== null ? customTipAmount : totalBeforeTip * (tipPercent / 100);
  const grandTotal = totalBeforeTip + tipAmount;
  const alreadyPaid = unpaidOrders.reduce((s, o) => s + (o.paidAmount || 0), 0);
  const balanceDue = Math.max(0, grandTotal - alreadyPaid);
  const perPerson = splitCount > 1 ? grandTotal / splitCount : grandTotal;

  // ── Split by item: compute the diner's share from the items they tapped ──
  const allUnpaidItems = unpaidOrders.flatMap((o) =>
    (orderItemsMap[o.id] || []).map((it) => ({ ...it, orderId: o.id, lineTotal: it.unitPrice * it.quantity })),
  );
  const itemSubtotal = allUnpaidItems
    .filter((it) => selectedItemIds.has(it.id))
    .reduce((s, it) => s + it.lineTotal, 0);
  const subtotalRatio = subtotal > 0 ? itemSubtotal / subtotal : 0;
  const itemShareBeforeTip = itemSubtotal + (tax + serviceCharge - discount) * subtotalRatio;
  const itemTip = customTipAmount !== null ? customTipAmount * subtotalRatio : itemShareBeforeTip * (tipPercent / 100);
  const itemShare = itemShareBeforeTip + itemTip;
  const affectedOrderIds = unpaidOrders
    .filter((o) => (orderItemsMap[o.id] || []).some((it) => selectedItemIds.has(it.id)))
    .map((o) => o.id);

  function toggleItem(id: string) {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function perOrderContributions(): Record<string, { amount: number; tip: number }> {
    const byOrder: Record<string, { amount: number; tip: number }> = {};
    for (const o of unpaidOrders) {
      const items = (orderItemsMap[o.id] || []).filter((it) => selectedItemIds.has(it.id));
      if (items.length === 0) continue;
      const oItemSub = items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
      const oRatio = o.subtotal > 0 ? oItemSub / o.subtotal : 0;
      const amount = oItemSub + (o.tax + o.serviceCharge) * oRatio;
      const tip = itemSubtotal > 0 ? itemTip * (oItemSub / itemSubtotal) : 0;
      byOrder[o.id] = { amount: +amount.toFixed(2), tip: +tip.toFixed(2) };
    }
    return byOrder;
  }

  async function payShareCash() {
    if (!slug || itemSubtotal <= 0) return;
    setPaying(true);
    setPaymentError('');
    closeConfirmModal();
    try {
      const contributions = perOrderContributions();
      for (const [orderId, { amount, tip }] of Object.entries(contributions)) {
        await paymentApi.recordCash(slug, { orderId, amount, tip });
      }
      setSelectedItemIds(new Set());
      loadOrders();
    } catch (err) {
      setPaymentError((err as { message?: string }).message || 'Payment failed. Please try again.');
    } finally {
      setPaying(false);
    }
  }

  function toggleExpand(orderId: string) {
    setExpandedOrders((prev) => ({ ...prev, [orderId]: !prev[orderId] }));
  }

  function handleTipPercent(pct: number) {
    setTipPercent(pct);
    setCustomTipAmount(null);
  }

  function handleCustomTip(value: string) {
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0) {
      setCustomTipAmount(num);
      setTipPercent(0);
    } else if (value === '') {
      setCustomTipAmount(null);
    }
  }

  function openConfirmModal() {
    setShowConfirmModal(true);
  }

  function closeConfirmModal() {
    setShowConfirmModal(false);
  }

  async function processCashPayment() {
    if (!slug) return;
    setPaying(true);
    setPaymentError('');
    closeConfirmModal();
    try {
      const perOrderDiscount = unpaidOrders.length > 0 ? discount / unpaidOrders.length : 0;
      const perOrderTip = unpaidOrders.length > 0 ? tipAmount / unpaidOrders.length : 0;
      for (const order of unpaidOrders) {
        const orderAmount = order.total - perOrderDiscount;
        await paymentApi.recordCash(slug, { orderId: order.id, amount: Math.max(0, orderAmount), tip: perOrderTip });
      }
      setSuccessPaid(true);
      setPaidOrderId('all');
      loadOrders();
    } catch (err) {
      setPaymentError((err as { message?: string }).message || 'Cash payment failed. Please try again.');
    } finally {
      setPaying(false);
    }
  }

  function confirmCardPayment() {
    if (unpaidOrders.length !== 1) return;
    closeConfirmModal();
    setPaidOrderId(unpaidOrders[0].id);
  }

  function handleStripeSuccess() {
    setSuccessPaid(true);
    setPaidOrderId('all');
    loadOrders();
  }

  if (loading) return <div className="py-12"><Spinner className="mx-auto" /></div>;

  if (successPaid) {
    return (
      <div className="text-center py-12 space-y-6 animate-scale-in">
        <div className="mx-auto h-16 w-16 rounded-full bg-green-100 flex items-center justify-center dark:bg-green-900/50">
          <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('payment.paid')}!</h2>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            {t('payment.totalDue')}: <span className="font-semibold text-gray-900 dark:text-gray-100">{money(grandTotal)}</span>
          </p>
        </div>
        <p className="text-sm text-gray-400">
          {t('payment.paymentMethod')}: {paymentMethod === 'cash' ? t('payment.cash') : paymentMethod === 'card' ? t('payment.card') : t('payment.split')}
          {splitCount > 1 && ` (${splitCount})`}
        </p>
        {tipAmount > 0 && (
          <p className="text-sm text-gray-400">{t('payment.tip')}: {money(tipAmount)}</p>
        )}
        {tenant.googleReviewUrl && (
          <a
            href={tenant.googleReviewUrl}
            target="_blank"
            rel="noreferrer"
            className="mx-auto mt-2 inline-flex items-center gap-2 rounded-full bg-brand-500 px-6 py-3 font-medium text-white shadow-sm transition-colors hover:bg-brand-600"
          >
            <Star className="h-5 w-5 fill-current text-amber-300" /> {t('review.cta')}
          </a>
        )}
        <div className="flex flex-col gap-2 justify-center pt-4 sm:flex-row">
          <Link to={`/r/${slug}/orders`} className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-6 py-2.5 font-medium text-white transition-colors hover:bg-brand-600">
            {t('order.orderHistory')}
          </Link>
          <Link to={`/r/${slug}`} className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-6 py-2.5 font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-900">
            {t('nav.menu')}
          </Link>
        </div>
      </div>
    );
  }

  if (unpaidOrders.length === 0 && !showAll) {
    return (
      <EmptyState
        icon={<Receipt className="h-7 w-7" />}
        title={t('payment.paid')}
        description={t('common.noResults')}
        action={{ label: t('order.allOrders'), onClick: () => setShowAll(true) }}
      />
    );
  }

  const totalItems = unpaidOrders.reduce((s, o) => s + o.itemCount, 0);

  const confirmationFooter = (
    <>
      <Button variant="outline" onClick={closeConfirmModal}>{t('common.cancel')}</Button>
      <Button
        variant={paymentMethod === 'card' ? 'primary' : 'success'}
        onClick={paymentMethod === 'card' ? confirmCardPayment : processCashPayment}
        loading={paying}
      >
        {paymentMethod === 'card' ? `${t('payment.payNow')} ${money(grandTotal)}` : `${t('common.confirm')} ${money(grandTotal)}`}
      </Button>
    </>
  );

  return (
    <div className="space-y-6">
      <Modal open={showConfirmModal} onClose={closeConfirmModal} size="sm" title={t('payment.orderSummary')} footer={confirmationFooter}>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">{t('payment.paymentMethod')}</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {paymentMethod === 'cash' ? t('payment.cash') : paymentMethod === 'card' ? t('payment.card') : t('payment.split')}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">{t('payment.amount')}</span>
            <span className="text-gray-900 dark:text-gray-100">{money(totalBeforeTip)}</span>
          </div>
          {tipAmount > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">{t('payment.tip')}</span>
              <span className="text-gray-900 dark:text-gray-100">{money(tipAmount)}</span>
            </div>
          )}
          {splitCount > 1 && (
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">{t('payment.split')}</span>
              <span className="text-gray-900 dark:text-gray-100">{splitCount}</span>
            </div>
          )}
          <div className="flex justify-between border-t pt-2 text-base dark:border-gray-800">
            <span className="font-bold text-gray-900 dark:text-gray-100">{t('common.total')}</span>
            <span className="font-bold text-brand-600 dark:text-brand-400">{money(grandTotal)}</span>
          </div>
        </div>
      </Modal>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('payment.bill')}</h2>
        <Badge variant="neutral">
          {t('table.tableNumber', { number: table.number })} · {totalItems} {t('common.items')}
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowAll(false)}
          className={`px-4 py-1.5 text-sm rounded-full transition-colors ${
            !showAll ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
          }`}
          aria-pressed={!showAll}
        >
          {t('payment.unpaid')}
        </button>
        <button
          onClick={() => setShowAll(true)}
          className={`px-4 py-1.5 text-sm rounded-full transition-colors ${
            showAll ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
          }`}
          aria-pressed={showAll}
        >
          {t('order.allOrders')}
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="bg-brand-500 text-white px-4 py-3 flex items-center gap-2">
          <Receipt className="w-5 h-5" aria-hidden />
          <span className="font-semibold">{tenant.name}</span>
        </div>

        <div className="p-4 space-y-3">
          {displayedOrders.map((order) => (
            <div key={order.id} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0 dark:border-gray-800">
              <button onClick={() => toggleExpand(order.id)} className="w-full text-start">
                <div className="flex justify-between items-center mb-2 gap-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('common.items')} #{order.id.slice(0, 8)}
                  </span>
                  <span className="flex items-center gap-2">
                    {statusBadge(order, t)}
                    {expandedOrders[order.id] ? <ChevronUp className="w-4 h-4 text-gray-400" aria-hidden /> : <ChevronDown className="w-4 h-4 text-gray-400" aria-hidden />}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mb-1">
                  {new Date(order.createdAt).toLocaleTimeString()}
                </p>
                <div className="flex justify-between font-medium text-gray-900 dark:text-gray-100">
                  <span>{t('common.items')} ({order.itemCount})</span>
                  <span>{money(order.subtotal)}</span>
                </div>
              </button>
              {(expandedOrders[order.id] || splitMode === 'item') && (
                <div className="mt-2 ps-2 border-s-2 border-gray-200 space-y-1 dark:border-gray-700">
                  {itemsLoading ? (
                    <p className="text-xs text-gray-400">{t('common.loading')}...</p>
                  ) : (orderItemsMap[order.id] || []).length === 0 ? (
                    <p className="text-xs text-gray-400">{t('common.noResults')}</p>
                  ) : (
                    (orderItemsMap[order.id] || []).map((item) => {
                      const checked = selectedItemIds.has(item.id);
                      return splitMode === 'item' ? (
                        <label key={item.id} className={`flex items-center justify-between text-xs py-1.5 px-1 rounded cursor-pointer ${checked ? 'bg-brand-50 dark:bg-brand-900/40' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                          <span className="flex items-center gap-2">
                            <input type="checkbox" checked={checked} onChange={() => toggleItem(item.id)}
                              className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500/40 dark:border-gray-600 dark:bg-gray-800" />
                            <span className="text-gray-700 dark:text-gray-300"><span className="text-gray-400 me-1">{item.quantity}x</span>{item.name}</span>
                          </span>
                          <span className="text-gray-700 dark:text-gray-300">{money(item.unitPrice * item.quantity)}</span>
                        </label>
                      ) : (
                        <div key={item.id} className="flex justify-between text-xs text-gray-600 py-1 dark:text-gray-400">
                          <span>
                            <span className="text-gray-400 me-1">{item.quantity}x</span>
                            {item.name}
                          </span>
                          <span>{money(item.unitPrice * item.quantity)}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="border-t px-4 py-3 space-y-1 text-sm dark:border-gray-800">
          <div className="flex justify-between text-gray-600 dark:text-gray-400">
            <span>{t('common.subtotal')}</span>
            <span>{money(subtotal)}</span>
          </div>
          {tax > 0 && (
            <div className="flex justify-between text-gray-600 dark:text-gray-400">
              <span>{t('common.tax')}</span>
              <span>{money(tax)}</span>
            </div>
          )}
          {discount > 0 && (
            <div className="flex justify-between text-green-600 dark:text-green-400">
              <span>Discount</span>
              <span>-{money(discount)}</span>
            </div>
          )}
        </div>

        <PromoCodeCheckout
          slug={slug}
          subtotal={subtotal}
          onApply={(d) => setDiscount(d)}
          onRemove={() => setDiscount(0)}
        />

        <div className="border-t px-4 py-3 dark:border-gray-800">
          <div className="flex items-center justify-between mb-2 gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('payment.tip')}</span>
            <div className="flex gap-1 flex-wrap justify-end">
              {[0, 10, 15, 20].map((pct) => (
                <button key={pct} onClick={() => handleTipPercent(pct)}
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${
                    tipPercent === pct && customTipAmount === null ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
                  }`}>
                  {pct > 0 ? `${pct}%` : t('common.no')}
                </button>
              ))}
              {(() => {
                const roundUpTip = Math.ceil(totalBeforeTip) - totalBeforeTip;
                const active = customTipAmount !== null && Math.abs(customTipAmount - roundUpTip) < 0.005 && roundUpTip > 0;
                return (
                  <button
                    onClick={() => { setCustomTipAmount(Math.max(0, +roundUpTip.toFixed(2))); setTipPercent(0); }}
                    disabled={roundUpTip < 0.005}
                    className={`px-3 py-1 text-xs rounded-full transition-colors disabled:opacity-40 ${active ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'}`}
                  >
                    {t('payment.roundUp')}
                  </button>
                );
              })()}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-gray-500">{currency || '$'}</span>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder={t('payment.tip')}
              value={customTipAmount !== null ? customTipAmount : ''}
              onChange={(e) => handleCustomTip(e.target.value)}
              className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500/40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>
          {tipAmount > 0 && (
            <p className="text-sm text-brand-600 font-medium text-end dark:text-brand-400">
              +{money(tipAmount)}
            </p>
          )}
        </div>

        <div className="border-t px-4 py-3 space-y-2 dark:border-gray-800">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('payment.split')}</span>
            <div className="flex rounded-lg overflow-hidden border border-gray-300 text-xs dark:border-gray-700">
              {(['even', 'item'] as const).map((m) => (
                <button key={m} onClick={() => { setSplitMode(m); setSelectedItemIds(new Set()); }}
                  className={`px-3 py-1 font-medium transition-colors ${splitMode === m ? 'bg-brand-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-300'}`}>
                  {m === 'even' ? t('payment.splitEven') : t('payment.splitByItem')}
                </button>
              ))}
            </div>
          </div>

          {splitMode === 'even' ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{t('payment.numberOfPeople')}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSplitCount(Math.max(1, splitCount - 1))}
                    aria-label="Decrease split count"
                    className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-8 text-center font-medium text-sm flex items-center gap-1 text-gray-900 dark:text-gray-100">
                    <Users className="w-3 h-3" aria-hidden /> {splitCount}
                  </span>
                  <button onClick={() => setSplitCount(Math.min(20, splitCount + 1))}
                    aria-label="Increase split count"
                    className="w-7 h-7 rounded-full bg-brand-500 text-white flex items-center justify-center hover:bg-brand-600">
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
              {splitCount > 1 && (
                <p className="text-sm text-brand-600 font-medium text-end dark:text-brand-400">
                  {money(perPerson)} / {t('payment.split')}
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-xs text-gray-500">{t('payment.tapYourItems')}</p>
              {itemSubtotal > 0 && (
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-gray-700 dark:text-gray-300">{t('payment.yourShare')}</span>
                  <span className="text-brand-600 dark:text-brand-400">{money(itemShare)}</span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="border-t px-4 py-3 dark:border-gray-800">
          <span className="text-sm font-medium text-gray-700 block mb-2 dark:text-gray-300">{t('payment.paymentMethod')}</span>
          <div className="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-700">
            {(['cash', 'card', 'split'] as const).map((method) => (
              <button key={method} onClick={() => setPaymentMethod(method)}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  paymentMethod === method ? 'bg-brand-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-300'
                }`}>
                {method === 'cash' ? t('payment.cash') : method === 'card' ? t('payment.card') : t('payment.split')}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t-2 border-brand-500 px-4 py-4 dark:border-gray-800">
          {alreadyPaid > 0 && (
            <div className="flex justify-between text-sm text-green-600 mb-1 dark:text-green-400">
              <span>{t('payment.alreadyPaid')}</span>
              <span>-{money(alreadyPaid)}</span>
            </div>
          )}
          <div className="flex justify-between items-center mb-4">
            <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{alreadyPaid > 0 ? t('payment.balanceDue') : t('common.total')}</span>
            <span className="text-xl font-bold text-brand-600 dark:text-brand-400">{money(balanceDue)}</span>
          </div>
          {splitMode === 'even' && splitCount > 1 && (
            <p className="text-sm text-gray-500 text-end -mt-3 mb-3">
              {money(perPerson)} / {t('payment.split')}
            </p>
          )}

          {paidOrderId === 'all' ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 text-center dark:bg-green-900/40 dark:border-green-900 dark:text-green-300">
              {t('payment.paid')}!
            </div>
          ) : (
            <div className="space-y-2">
              {paymentError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300" role="alert">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" aria-hidden />
                  {paymentError}
                </div>
              )}

              {splitMode === 'item' ? (
                <>
                  {(paymentMethod === 'cash' || paymentMethod === 'split') && (
                    <Button variant="success" fullWidth onClick={payShareCash} loading={paying} disabled={itemSubtotal <= 0}>
                      {t('payment.payShare')} {money(itemShare)}
                    </Button>
                  )}
                  {paymentMethod === 'card' && getStripe() && (
                    affectedOrderIds.length === 1 ? (
                      <Button fullWidth onClick={() => { setSharePartialAmount(itemShare); setPaidOrderId(affectedOrderIds[0]); }} disabled={itemSubtotal <= 0}>
                        {t('payment.payShare')} {money(itemShare)}
                      </Button>
                    ) : (
                      <p className="text-xs text-gray-500 bg-amber-50 border border-amber-200 rounded-lg p-3 dark:bg-amber-950/40 dark:border-amber-900">{t('payment.cardOneOrder')}</p>
                    )
                  )}
                  {paymentMethod === 'card' && !getStripe() && (
                    <Button fullWidth disabled>{t('payment.card')} ({t('common.notAvailable')})</Button>
                  )}
                </>
              ) : (
                <>
                  {(paymentMethod === 'cash' || paymentMethod === 'split') && (
                    <Button variant="success" fullWidth onClick={openConfirmModal} loading={paying}>
                      {t('payment.payFull')} {money(balanceDue)}
                    </Button>
                  )}
                  {paymentMethod === 'card' && getStripe() && unpaidOrders.length === 1 && (
                    <Button fullWidth onClick={openConfirmModal}>{t('payment.payNow')} {money(balanceDue)}</Button>
                  )}
                  {paymentMethod === 'card' && !getStripe() && (
                    <Button fullWidth disabled>{t('payment.card')} ({t('common.notAvailable')})</Button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {paidOrderId && paidOrderId !== 'all' && (
        <div className="card p-4">
          <StripePaymentForm
            stripePromise={getStripe()}
            slug={slug}
            orderId={paidOrderId}
            amount={sharePartialAmount ?? (unpaidOrders.find((o) => o.id === paidOrderId)?.total || 0)}
            partialAmount={sharePartialAmount ?? undefined}
            onSuccess={() => {
              if (sharePartialAmount != null) {
                setSharePartialAmount(null);
                setSelectedItemIds(new Set());
                setPaidOrderId(null);
                loadOrders();
              } else {
                handleStripeSuccess();
              }
            }}
            onCancel={() => { setPaidOrderId(null); setSharePartialAmount(null); }}
          />
        </div>
      )}
    </div>
  );
}
