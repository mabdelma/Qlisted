import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { orderApi, tableApi } from '../../lib/api';
import { Clock, AlertTriangle, ChefHat, RefreshCw } from 'lucide-react';
import type { Order } from '../../lib/api/types';

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

export function KitchenDisplay() {
  const { state: { tenant } } = useAuth();
  const slug = tenant?.slug;
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [tables, setTables] = useState<Record<string, { number: number }>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!slug) return;
    try {
      const [allOrders, allTables] = await Promise.all([
        orderApi.list(slug),
        tableApi.list(slug),
      ]);
      const tablesMap = Object.fromEntries(allTables.map((t) => [t.id, t]));
      const active = allOrders.filter((o) => o.status === 'pending' || o.status === 'preparing');
      const details = (
        await Promise.all(
          active.map(async (o) => {
            try {
              return await orderApi.getDetail(slug, o.id);
            } catch {
              return null;
            }
          })
        )
      ).filter((o): o is OrderWithItems => o !== null)
       .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      setOrders(details);
      setTables(tablesMap);
    } catch {
      console.error('Failed to load kitchen orders');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [load]);

  async function updateStatus(orderId: string, status: 'preparing' | 'ready') {
    if (!slug) return;
    try {
      await orderApi.updateStatus(slug, orderId, status);
      await load();
    } catch {
      console.error('Failed to update order status');
    }
  }

  function getOrderAge(createdAt: string): number {
    return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  }

  if (!slug || loading) {
    return (
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-gray-100 rounded-xl h-40 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Kitchen Display</h2>
          <p className="text-sm text-gray-500">{orders.length} order{orders.length !== 1 ? 's' : ''} in queue</p>
        </div>
        <button onClick={load} className="flex items-center gap-1 px-3 py-1.5 bg-[#0f766e] text-white text-sm rounded-lg hover:bg-[#1e3a5f]">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {orders.map((order) => {
          const age = getOrderAge(order.createdAt);
          const warnColor = age > 20 ? 'red' : age > 10 ? 'yellow' : '[#0f766e]';

          return (
            <div
              key={order.id}
              className={`bg-white rounded-xl shadow-sm border-l-4 ${
                warnColor === 'red' ? 'border-red-500' :
                warnColor === 'yellow' ? 'border-yellow-500' :
                'border-[#0f766e]'
              }`}
            >
              <div className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      {order.orderType === 'dine_in' ? `Table ${tables[order.tableId]?.number || '?'}` : order.orderType === 'takeout' ? 'Takeout' : 'Delivery'}
                    </h3>
                    <div className="flex items-center gap-1 mt-1">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span className={`text-sm font-medium ${
                        age > 20 ? 'text-red-600' : age > 10 ? 'text-yellow-600' : 'text-gray-500'
                      }`}>
                        {age} min ago
                      </span>
                      {age > 20 && <AlertTriangle className="w-4 h-4 text-red-500" />}
                    </div>
                  </div>
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                    order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  {order.items?.map((item) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <span className="w-7 h-7 flex items-center justify-center bg-[#ccfbf1] text-[#0f766e] rounded-full text-sm font-bold">
                        {item.quantity}
                      </span>
                      <span className="text-gray-900 font-medium">{item.name}</span>
                      {item.notes && (
                        <span className="text-xs text-gray-400 italic">({item.notes})</span>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  {order.status === 'pending' && (
                    <button
                      onClick={() => updateStatus(order.id, 'preparing')}
                      className="flex-1 bg-[#0f766e] text-white py-3 rounded-lg text-sm font-medium hover:bg-[#1e3a5f]"
                    >
                      Start Preparing
                    </button>
                  )}
                  {order.status === 'preparing' && (
                    <button
                      onClick={() => updateStatus(order.id, 'ready')}
                      className="flex-1 bg-green-600 text-white py-3 rounded-lg text-sm font-medium hover:bg-green-700"
                    >
                      Mark Ready
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {orders.length === 0 && (
        <div className="text-center py-16">
          <ChefHat className="mx-auto h-16 w-16 text-gray-300" />
          <h3 className="mt-4 text-lg font-medium text-gray-500">All caught up!</h3>
          <p className="text-sm text-gray-400">No pending orders in the queue.</p>
        </div>
      )}
    </div>
  );
}
