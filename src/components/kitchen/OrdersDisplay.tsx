import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { Clock, AlertTriangle, ChefHat, Bell, Play, CheckCircle, ListChecks, Flame } from 'lucide-react';
import { orderApi, tableApi } from '../../lib/api';
import type { Order, TableData } from '../../lib/api/types';
import { OrderListSkeleton } from '../ui/Skeleton';
import { OrderDetails } from './OrderDetails';
import { ErrorMessage } from '../ui/ErrorMessage';

interface OrderWithItems extends Order {
  items: Array<{
    id: string;
    menuItemId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    notes?: string;
  }>;
}

type OrderStatus = 'pending' | 'preparing' | 'ready';
type SortMode = 'time' | 'priority' | 'table';
type GroupMode = 'status' | 'none';

function playAlertSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.value = 0.3;
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch { /* best-effort */ }
}

function playUrgentSound() {
  try {
    const ctx = new AudioContext();
    [660, 880, 1100].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.value = 0.25;
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.1);
    });
  } catch { /* best-effort */ }
}

export function OrdersDisplay() {
  const { t } = useI18n();
  const { state: authState } = useAuth();
  const slug = authState.tenant?.slug;
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [tables, setTables] = useState<Record<string, TableData>>({});
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortMode>('priority');
  const [groupBy, setGroupBy] = useState<GroupMode>('status');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const prevOrderCount = useRef(0);
  const eventSource = useRef<EventSource | null>(null);

  const getOrderStatusOrder = (status: string) => {
    if (status === 'pending') return 0;
    if (status === 'preparing') return 1;
    return 2;
  };

  const loadOrders = useCallback(async () => {
    if (!slug) return;
    try {
      const [allOrders, allTables] = await Promise.all([
        orderApi.list(slug),
        tableApi.list(slug),
      ]);

      const tablesMap = Object.fromEntries(allTables.map((t) => [t.id, t]));
      const orderDetails = await Promise.all(
        allOrders
          .filter((o) => o.status !== 'delivered' && o.status !== 'cancelled')
          .map(async (o) => {
            try {
              return await orderApi.getDetail(slug, o.id);
            } catch {
              return null;
            }
          })
      );

      const activeOrders = orderDetails
        .filter((od): od is OrderWithItems => od !== null)
        .sort((a, b) => {
          if (sortBy === 'priority') {
            const aStatus = getOrderStatusOrder(a.status);
            const bStatus = getOrderStatusOrder(b.status);
            if (aStatus !== bStatus) return aStatus - bStatus;
            const aAge = Date.now() - new Date(a.createdAt).getTime();
            const bAge = Date.now() - new Date(b.createdAt).getTime();
            return bAge - aAge;
          }
          if (sortBy === 'table') {
            return (tablesMap[a.tableId]?.number || 0) - (tablesMap[b.tableId]?.number || 0);
          }
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

      if (activeOrders.length > prevOrderCount.current && prevOrderCount.current > 0 && soundEnabled) {
        playAlertSound();
      }
      prevOrderCount.current = activeOrders.length;

      setOrders(activeOrders);
      setTables(tablesMap);
      setError(null);
    } catch {
      setError(t('error.generic'));
    } finally {
      setLoading(false);
    }
  }, [slug, sortBy, soundEnabled]);

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 15000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  const delayedOrderIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    const now = Date.now();
    orders.forEach((o) => {
      const age = Math.floor((now - new Date(o.createdAt).getTime()) / 60000);
      if (age >= 20 && !delayedOrderIds.current.has(o.id) && soundEnabled) {
        playUrgentSound();
        delayedOrderIds.current.add(o.id);
      }
    });
  }, [orders, soundEnabled]);

  useEffect(() => {
    if (!slug) return;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    function connect() {
      eventSource.current?.close();
      const es = new EventSource(`/api/r/${slug}/events`);
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type?.startsWith('order_')) loadOrders();
        } catch { /* best-effort */ }
      };
      es.onerror = () => {
        es.close();
        reconnectTimer = setTimeout(connect, 5000);
      };
      eventSource.current = es;
    }
    connect();
    return () => {
      eventSource.current?.close();
      clearTimeout(reconnectTimer);
    };
  }, [slug]);

  async function updateOrderStatus(orderId: string, status: OrderStatus) {
    if (!slug) return;
    try {
      await orderApi.updateStatus(slug, orderId, status);
      await loadOrders();
    } catch {
      setError(t('error.generic'));
    }
  }

  function getOrderAge(createdAt: string) {
    return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  }

  function getTimeColor(minutes: number) {
    if (minutes < 5) return 'text-green-600 bg-green-50';
    if (minutes < 10) return 'text-yellow-600 bg-yellow-50';
    if (minutes < 15) return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
  }

  function getTimeBarWidth(minutes: number) {
    return Math.min(100, (minutes / 30) * 100);
  }

  function getStatusBg(status: string) {
    switch (status) {
      case 'pending': return 'bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-300';
      case 'preparing': return 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-300';
      case 'ready': return 'bg-gradient-to-br from-green-50 to-green-100 border-green-300';
      default: return 'bg-white border-gray-200';
    }
  }

  function groupOrders() {
    if (groupBy === 'none') return [{ label: '', orders }];
    const groups = [
      { label: 'Pending', status: 'pending', orders: orders.filter((o) => o.status === 'pending') },
      { label: 'Preparing', status: 'preparing', orders: orders.filter((o) => o.status === 'preparing') },
      { label: 'Ready', status: 'ready', orders: orders.filter((o) => o.status === 'ready') },
    ];
    return groups.filter((g) => g.orders.length > 0);
  }

  if (!slug) return <OrderListSkeleton />;
  if (loading) return <OrderListSkeleton />;
  if (error) return <ErrorMessage message={error} />;

  const grouped = groupOrders();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-[#1e3a5f]">Kitchen Display</h2>
          <span className="text-sm bg-[#0f766e] text-white px-3 py-1 rounded-full">{orders.length} active</span>
        </div>
        <div className="flex items-center space-x-3">
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortMode)}
            className="rounded-md border-gray-300 text-sm focus:border-[#0f766e] focus:ring-[#0f766e]">
            <option value="priority">Priority (oldest first)</option>
            <option value="time">Newest first</option>
            <option value="table">Table number</option>
          </select>
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupMode)}
            className="rounded-md border-gray-300 text-sm focus:border-[#0f766e] focus:ring-[#0f766e]">
            <option value="status">Group by status</option>
            <option value="none">Flat list</option>
          </select>
          <button onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-lg ${soundEnabled ? 'bg-[#0f766e] text-white' : 'bg-gray-200 text-gray-500'}`}
            title={soundEnabled ? 'Mute alerts' : 'Enable alerts'}>
            <Bell className="w-4 h-4" />
          </button>
        </div>
      </div>

      {grouped.map((group) => (
        <div key={group.label}>
          {group.label && (
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-lg font-semibold text-gray-700">{group.label}</h3>
              <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{group.orders.length}</span>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {group.orders.map((order) => {
              const orderAge = getOrderAge(order.createdAt);
              const isDelayed = orderAge > 15;
              const isUrgent = orderAge > 20;
              return (
                <div key={order.id}
                  className={`relative rounded-lg shadow-sm border-2 ${getStatusBg(order.status)} ${isUrgent ? 'ring-2 ring-red-400 animate-pulse' : ''} transition-all hover:shadow-md`}>
                  {isUrgent && (
                    <div className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1">
                      <Flame className="w-4 h-4" />
                    </div>
                  )}
                  <div className="p-4 cursor-pointer" onClick={() => setSelectedOrder(order)}>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-gray-900">#{order.id.slice(0, 8)}</h3>
                          {order.customerName && (
                            <span className="text-sm text-gray-500">- {order.customerName}</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">{order.orderType === 'dine_in' ? `Table ${tables[order.tableId]?.number || '?'}` : order.orderType === 'takeout' ? 'Takeout' : 'Delivery'} &middot; {order.itemCount} items &middot; ${order.total.toFixed(2)}</p>
                      </div>
                      <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-semibold border ${
                        order.status === 'pending' ? 'bg-yellow-200 text-yellow-900 border-yellow-400' :
                        order.status === 'preparing' ? 'bg-blue-200 text-blue-900 border-blue-400' :
                        'bg-green-200 text-green-900 border-green-400'
                      }`}>
                        {order.status}
                      </span>
                    </div>

                    {/* Items */}
                    <div className="space-y-1.5 mb-3">
                      {order.items?.map((item) => (
                        <div key={item.id} className="flex items-center gap-2">
                          <span className="w-7 h-7 flex items-center justify-center bg-white/80 text-gray-800 rounded-full text-xs font-bold shadow-sm border">
                            {item.quantity}
                          </span>
                          <span className="text-sm font-medium text-gray-800">{item.name}</span>
                          {item.notes && <span className="text-xs text-gray-500 italic">({item.notes})</span>}
                        </div>
                      ))}
                    </div>

                    {/* Timer bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className={`flex items-center gap-1 font-medium px-1.5 py-0.5 rounded ${getTimeColor(orderAge)}`}>
                          <Clock className="w-3 h-3" />
                          {orderAge} min
                        </span>
                        {isDelayed && (
                          <span className="flex items-center gap-1 text-red-600 font-medium">
                            <AlertTriangle className="w-3 h-3" /> OVERDUE
                          </span>
                        )}
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-1000 ${
                          orderAge < 5 ? 'bg-green-500' : orderAge < 10 ? 'bg-yellow-500' : orderAge < 15 ? 'bg-orange-500' : 'bg-red-500'
                        }`} style={{ width: `${getTimeBarWidth(orderAge)}%` }} />
                      </div>
                    </div>
                  </div>

                  {/* Bump bar */}
                  <div className="flex border-t border-gray-200/50">
                    {order.status === 'pending' && (
                      <button onClick={() => updateOrderStatus(order.id, 'preparing')}
                        className="flex-1 flex items-center justify-center gap-1 py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium transition-colors rounded-b-lg">
                        <Play className="w-4 h-4" /> Start Prep
                      </button>
                    )}
                    {order.status === 'preparing' && (
                      <button onClick={() => updateOrderStatus(order.id, 'ready')}
                        className="flex-1 flex items-center justify-center gap-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors rounded-b-lg">
                        <CheckCircle className="w-4 h-4" /> Mark Ready
                      </button>
                    )}
                    {order.status === 'ready' && (
                      <button onClick={() => updateOrderStatus(order.id, 'delivered')}
                        className="flex-1 flex items-center justify-center gap-1 py-2.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium transition-colors rounded-b-lg">
                        <ListChecks className="w-4 h-4" /> Serve
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {selectedOrder && <OrderDetails order={selectedOrder as OrderWithItems & { paymentStatus?: string }} onClose={() => setSelectedOrder(null)} />}

      {orders.length === 0 && (
        <div className="text-center py-16">
          <ChefHat className="mx-auto h-16 w-16 text-gray-300" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">All caught up!</h3>
          <p className="mt-1 text-sm text-gray-500">No active orders in the kitchen.</p>
        </div>
      )}
    </div>
  );
}
