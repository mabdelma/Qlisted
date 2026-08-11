import { useState, useEffect, createContext, useReducer } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { menuApi, tableApi, orderApi, paymentApi } from '../../lib/api';
import { useI18n } from '../../contexts/I18nContext';
import type { MenuItem, MenuCategory, TableData, OrderWithItems } from '../../lib/api/types';
import { StripePaymentForm } from './StripePaymentForm';
import { CustomerAiWidget } from '../../components/ai/CustomerAiWidget';
import { VoiceOrderWidget } from '../../components/ai/VoiceOrderWidget';

// Lazy, memoized Stripe loader. App.tsx imports this module eagerly, so calling
// loadStripe() at module scope would fire Stripe.js init on every page (incl. the
// homepage). Defer it until the payment UI actually needs it.
import type { Stripe } from '@stripe/stripe-js';
let stripePromise: Promise<Stripe | null> | null | undefined;
function getStripe(): Promise<Stripe | null> | null {
  if (stripePromise === undefined) {
    const key = import.meta.env.VITE_STRIPE_KEY || '';
    stripePromise = key ? loadStripe(key) : null;
  }
  return stripePromise;
}

interface CartItem { item: MenuItem; quantity: number; notes?: string }
interface CartState { items: CartItem[]; total: number }
type CartAction =
  | { type: 'ADD'; payload: { item: MenuItem; quantity?: number } }
  | { type: 'REMOVE'; payload: string }
  | { type: 'UPDATE_QTY'; payload: { id: string; quantity: number } }
  | { type: 'CLEAR' };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD': {
      const qty = action.payload.quantity ?? 1;
      const existing = state.items.find((c) => c.item.id === action.payload.item.id);
      if (existing) {
        const updated = state.items.map((c) =>
          c.item.id === action.payload.item.id ? { ...c, quantity: c.quantity + qty } : c
        );
        return { items: updated, total: updated.reduce((s, c) => s + c.item.price * c.quantity, 0) };
      }
      const updated = [...state.items, { item: action.payload.item, quantity: qty }];
      return { items: updated, total: updated.reduce((s, c) => s + c.item.price * c.quantity, 0) };
    }
    case 'REMOVE': {
      const updated = state.items.filter((c) => c.item.id !== action.payload);
      return { items: updated, total: updated.reduce((s, c) => s + c.item.price * c.quantity, 0) };
    }
    case 'UPDATE_QTY': {
      const updated = state.items.map((c) =>
        c.item.id === action.payload.id ? { ...c, quantity: action.payload.quantity } : c
      );
      return { items: updated, total: updated.reduce((s, c) => s + c.item.price * c.quantity, 0) };
    }
    case 'CLEAR': return { items: [], total: 0 };
    default: return state;
  }
}

const CartCtx = createContext<{ state: CartState; dispatch: React.Dispatch<CartAction> } | null>(null);

export function CustomerMenuPage() {
  const { t } = useI18n();
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const [table, setTable] = useState<TableData | null>(null);
  const [slug, setSlug] = useState<string>('');
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [selectedCat, setSelectedCat] = useState<string>('');
  const [tab, setTab] = useState<'menu' | 'cart' | 'orders' | 'checkout'>('menu');
  const [cartState, dispatch] = useReducer(cartReducer, { items: [], total: 0 });
  const [placing, setPlacing] = useState(false);
  const [orderResult, setOrderResult] = useState<{ id: string; total: number } | null>(null);
  const [tableOrders, setTableOrders] = useState<OrderWithItems[]>([]);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { return; }
    tableApi.resolve(token)
      .then((data) => {
        setTable(data);
        setSlug(data.tenantSlug);
        return menuApi.getFullMenu(data.tenantSlug);
      })
      .then((menu) => {
        setCategories(menu.categories.filter((c) => c.type === 'main'));
        if (menu.categories.length > 0) setSelectedCat(menu.categories[0].id);
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!slug || !table?.id) return;
    orderApi.getForTable(slug, table.id).then(setTableOrders).catch(() => {});
  }, [slug, table?.id, orderResult]);

  async function placeOrder() {
    if (!slug || !table) return;
    setPlacing(true);
    try {
      const res = await orderApi.create(slug, {
        tableId: table.id,
        items: cartState.items.map((c) => ({
          menuItemId: c.item.id,
          name: c.item.name,
          quantity: c.quantity,
          unitPrice: c.item.price,
        })),
      });
      setOrderResult(res);
      dispatch({ type: 'CLEAR' });
      setTab('orders');
    } catch (err) {
      console.error('Failed to place order:', err);
    } finally {
      setPlacing(false);
    }
  }

  async function handlePayCash(orderId: string, total: number) {
    if (!slug) return;
    try {
      await paymentApi.recordCash(slug, { orderId, amount: total });
      setPayingOrderId(null);
    } catch (err) {
      console.error('Payment failed:', err);
    }
  }

  const content = (
    <CartCtx.Provider value={{ state: cartState, dispatch }}>
      <div className="min-h-screen bg-gray-50 max-w-lg mx-auto">
        <div className="bg-white shadow-sm p-4 sticky top-0 z-10">
          <h1 className="text-xl font-bold">{t('table.tableNumber')} {table?.number}</h1>
          <div className="flex space-x-4 mt-2">
            {(['menu', 'cart', 'orders', 'checkout'] as const).map((tabName) => (
              <button key={tabName} onClick={() => setTab(tabName)}
                className={`text-sm font-medium pb-1 border-b-2 ${tab === tabName ? 'border-[#0f766e] text-[#0f766e]' : 'border-transparent text-gray-500'}`}>
                {tabName === 'menu' ? t('nav.menu') : tabName === 'cart' ? `${t('nav.cart')} (${cartState.items.length})` : tabName === 'orders' ? t('nav.orders') : t('nav.checkout')}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          {tab === 'menu' && (
            <>
              <div className="flex space-x-2 overflow-x-auto pb-4">
                {categories.map((c) => (
                  <button key={c.id} onClick={() => setSelectedCat(c.id)}
                    className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium ${
                      selectedCat === c.id ? 'bg-[#0f766e] text-white' : 'bg-white text-gray-700 border border-gray-200'
                    }`}>
                    {c.name}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {filteredItems.filter((i) => i.available).map((item) => (
                  <div key={item.id} className="bg-white rounded-lg shadow-sm p-4 flex justify-between items-center">
                    <div className="flex-1 mr-4">
                      <h3 className="font-semibold text-gray-900">{item.name}</h3>
                      {item.description && <p className="text-sm text-gray-500">{item.description}</p>}
                      <p className="text-[#0f766e] font-bold mt-1">${item.price.toFixed(2)}</p>
                    </div>
                    <button
                      onClick={() => { dispatch({ type: 'ADD', payload: { item } }); setAddingId(item.id); setTimeout(() => setAddingId(null), 1000); }}
                      className="px-3 py-1.5 bg-[#0f766e] text-white rounded-full text-sm hover:bg-[#1e3a5f] flex-shrink-0">
                      {addingId === item.id ? t('common.done') : `+ ${t('menu.addToCart')}`}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === 'cart' && (
            <div className="space-y-4">
              {cartState.items.length === 0 && <p className="text-center text-gray-500 py-8">{t('order.emptyCart')}</p>}
              {cartState.items.map((c) => (
                <div key={c.item.id} className="bg-white rounded-lg shadow-sm p-4 flex justify-between items-center">
                  <div className="flex-1">
                    <h3 className="font-semibold">{c.item.name}</h3>
                    <p className="text-sm text-gray-500">${c.item.price.toFixed(2)} {t('common.item')}</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button onClick={() => dispatch({ type: 'UPDATE_QTY', payload: { id: c.item.id, quantity: Math.max(1, c.quantity - 1) } })}
                      className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50">-</button>
                    <span className="font-medium w-6 text-center">{c.quantity}</span>
                    <button onClick={() => dispatch({ type: 'UPDATE_QTY', payload: { id: c.item.id, quantity: c.quantity + 1 } })}
                      className="w-8 h-8 rounded-full bg-[#0f766e] text-white flex items-center justify-center hover:bg-[#1e3a5f]">+</button>
                    <button onClick={() => dispatch({ type: 'REMOVE', payload: c.item.id })}
                      className="text-red-500 text-sm ml-2">{t('common.remove')}</button>
                  </div>
                </div>
              ))}
              {cartState.items.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm p-4">
                  <div className="flex justify-between text-lg font-bold">
                    <span>{t('common.total')}</span>
                    <span>${cartState.total.toFixed(2)}</span>
                  </div>
                  <button onClick={() => setTab('checkout')}
                    className="w-full mt-4 py-3 bg-[#0f766e] text-white rounded-lg font-medium hover:bg-[#1e3a5f]">
                    {t('nav.checkout')}
                  </button>
                </div>
              )}
            </div>
          )}

          {tab === 'checkout' && (
            <div className="space-y-4">
              <div className="bg-white rounded-lg shadow-sm p-4">
                <h3 className="font-semibold mb-3">{t('payment.orderSummary')}</h3>
                {cartState.items.map((c) => (
                  <div key={c.item.id} className="flex justify-between text-sm py-1">
                    <span>{c.item.name} x{c.quantity}</span>
                    <span>${(c.item.price * c.quantity).toFixed(2)}</span>
                  </div>
                ))}
                <div className="border-t mt-3 pt-3 flex justify-between font-bold text-lg">
                  <span>{t('common.total')}</span>
                  <span>${cartState.total.toFixed(2)}</span>
                </div>
              </div>
              <button onClick={placeOrder} disabled={placing || cartState.items.length === 0}
                className="w-full py-3 bg-[#0f766e] text-white rounded-lg font-medium hover:bg-[#1e3a5f] disabled:opacity-50">
                {placing ? t('order.processOrder') + '...' : t('order.processOrder')}
              </button>
              <p className="text-xs text-gray-500 text-center">{t('payment.cash')}</p>
            </div>
          )}

          {tab === 'orders' && (
            <div className="space-y-4">
              {orderResult && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-semibold text-green-800">{t('order.newOrder')}</h3>
                  <p className="text-sm text-green-700">{t('order.orderReady')}</p>
                </div>
              )}
              {tableOrders.length === 0 && <p className="text-center text-gray-500 py-8">No orders yet</p>}
              {tableOrders.map((order) => (
                <div key={order.id} className="bg-white rounded-lg shadow-sm p-4">
                  <div className="flex justify-between items-start mb-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      order.status === 'preparing' ? 'bg-blue-100 text-blue-800' :
                      order.status === 'ready' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>{order.status}</span>
                    <span className="text-sm font-semibold">${order.total.toFixed(2)}</span>
                  </div>
                  {order.status === 'ready' && order.paymentStatus !== 'paid' && (
                    <div className="space-y-2 mt-2">
                      {payingOrderId === order.id ? (
                        getStripe() ? (
                          <StripePaymentForm
                            stripePromise={getStripe()}
                            slug={slug}
                            orderId={order.id}
                            amount={order.total}
                            onSuccess={() => setPayingOrderId(null)}
                            onCancel={() => setPayingOrderId(null)}
                          />
                        ) : (
                          <p className="text-sm text-red-600">Stripe not configured</p>
                        )
                      ) : (
                        <div className="flex gap-2">
                          <button onClick={() => handlePayCash(order.id, order.total)}
                            className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
                            Pay with Cash
                          </button>
                          {getStripe() && (
                            <button onClick={() => setPayingOrderId(order.id)}
                              className="flex-1 py-2 bg-[#0f766e] text-white rounded-lg text-sm hover:bg-[#1e3a5f]">
                              Pay with Card
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {tab !== 'cart' && cartState.items.length > 0 && (
          <button onClick={() => setTab('cart')}
            className="fixed bottom-6 right-6 bg-[#0f766e] text-white rounded-full px-6 py-3 shadow-lg flex items-center space-x-2 hover:bg-[#1e3a5f] z-20">
            <span>Cart ({cartState.items.length})</span>
            <span className="font-bold">${cartState.total.toFixed(2)}</span>
          </button>
        )}
      </div>
      {slug && <CustomerAiWidget slug={slug} />}
      {slug && (
        <VoiceOrderWidget
          slug={slug}
          onAddItem={(item, qty) => { for (let i = 0; i < qty; i++) dispatch({ type: 'ADD', payload: { item } }); }}
          onRemoveItem={(id) => dispatch({ type: 'REMOVE', payload: id })}
          getCart={() => ({ items: cartState.items.map((c) => ({ id: c.item.id, name: c.item.name, quantity: c.quantity })), total: cartState.total })}
        />
      )}
    </CartCtx.Provider>
  );

  return content;
}
