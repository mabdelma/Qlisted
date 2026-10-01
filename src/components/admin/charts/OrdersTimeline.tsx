import { useEffect, useState, useCallback } from 'react';
import { orderApi } from '../../../lib/api';
import { useAuth } from '../../../contexts/AuthContext';
import type { Order } from '../../../lib/api/types';
import { Clock } from 'lucide-react';
import { Skeleton } from '../../ui/Skeleton';

export function OrdersTimeline() {
  const { state } = useAuth();
  const slug = state.tenant?.slug;
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOrders = useCallback(async () => {
    if (!slug) return;
    try {
      const allOrders = await orderApi.list(slug);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todaysOrders = allOrders
        .filter(order => new Date(order.createdAt) >= today)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5);

      setOrders(todaysOrders);
    } catch (error) {
      console.error('Failed to load orders:', error);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    loadOrders();
    const interval = setInterval(loadOrders, 60000);
    return () => clearInterval(interval);
  }, [slug, loadOrders]);

  if (loading) return <div className="h-64 p-4 space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>;

  if (orders.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        No orders to display
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => {
        const orderAge = Math.floor(
          (Date.now() - new Date(order.createdAt).getTime()) / 60000
        );
        
        return (
          <div
            key={order.id}
            className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg"
          >
            <div className={`w-2 h-2 rounded-full ${
              order.status === 'pending'
                ? 'bg-yellow-400'
                : order.status === 'preparing'
                ? 'bg-blue-400'
                : order.status === 'ready'
                ? 'bg-green-400'
                : 'bg-gray-400'
            }`} />
            <div className="flex-1">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-sm font-medium text-gray-900">
                    {order.orderType === 'dine_in' ? `Table ${order.tableId?.slice(0, 8) || '?'}` : order.orderType === 'takeout' ? 'Takeout' : 'Delivery'}
                  </span>
                  <span className="ml-2 text-sm text-gray-500">
                    ${order.total.toFixed(2)}
                  </span>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  order.status === 'pending'
                    ? 'bg-yellow-100 text-yellow-800'
                    : order.status === 'preparing'
                    ? 'bg-blue-100 text-blue-800'
                    : order.status === 'ready'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {order.status}
                </span>
              </div>
              <div className="flex items-center mt-1 text-xs text-gray-500">
                <Clock className="w-3 h-3 mr-1" />
                {orderAge} min ago
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}