import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Clock, Search, Filter } from 'lucide-react';
import { orderApi } from '../../lib/api';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { ErrorMessage } from '../ui/ErrorMessage';

interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
}

interface OrderWithDetails {
  id: string;
  tableId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  total: number;
  kitchenStaffId?: string;
  preparationTime: number;
}

export function OrderHistory() {
  const { state: authState } = useAuth();
  const slug = authState.tenant?.slug;
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState({
    totalOrders: 0,
    avgPreparationTime: 0,
    completionRate: 0,
    delayedOrders: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'time' | 'duration'>('time');

  const loadOrders = useCallback(async () => {
    if (!slug || !authState.user) return;
    try {
      const allOrders = await orderApi.list(slug);

      const allOrderDetails = (
        await Promise.all(
          allOrders.map(async (o) => {
            try {
              return await orderApi.getDetail(slug, o.id);
            } catch {
              return null;
            }
          })
        )
      ).filter((o): o is OrderWithDetails => o !== null);

      const kitchenOrders = allOrderDetails
        .filter((order) => order.kitchenStaffId === authState.user?.id || true)
        .map((order) => {
          const startTime = new Date(order.createdAt).getTime();
          const endTime =
            order.status === 'ready' || order.status === 'delivered'
              ? new Date(order.updatedAt).getTime()
              : Date.now();
          return { ...order, preparationTime: Math.floor((endTime - startTime) / 60000) };
        })
        .sort((a, b) => {
          if (sortBy === 'duration') return b.preparationTime - a.preparationTime;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

      const completedOrders = kitchenOrders.filter((o) => ['ready', 'delivered'].includes(o.status));

      const totalPrepTime = completedOrders.reduce((sum, order) => {
        return sum + (new Date(order.updatedAt).getTime() - new Date(order.createdAt).getTime()) / 60000;
      }, 0);

      const delayed = completedOrders.filter((order) => {
        const diff = (new Date(order.updatedAt).getTime() - new Date(order.createdAt).getTime()) / 60000;
        return diff > 30;
      });

      setMetrics({
        totalOrders: completedOrders.length,
        avgPreparationTime: completedOrders.length > 0 ? totalPrepTime / completedOrders.length : 0,
        completionRate: allOrders.length > 0 ? (completedOrders.length / allOrders.length) * 100 : 0,
        delayedOrders: delayed.length,
      });

      setOrders(kitchenOrders);
      setError(null);
    } catch {
      setError('Failed to load order history');
    } finally {
      setLoading(false);
    }
  }, [slug, authState.user, sortBy]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const filteredOrders = orders.filter((order) => {
    if (statusFilter !== 'all') {
      if (statusFilter === 'ready' && !['ready', 'delivered'].includes(order.status)) return false;
      if (statusFilter === 'preparing' && order.status !== 'preparing') return false;
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return order.items.some((item) => item.name.toLowerCase().includes(query));
    }
    return true;
  });

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-[#1e3a5f]">Order History</h2>
          <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <p className="text-sm text-gray-500">Total Orders</p>
              <p className="text-xl font-bold text-[#1e3a5f]">{metrics.totalOrders}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <p className="text-sm text-gray-500">Avg Preparation Time</p>
              <p className="text-xl font-bold text-[#1e3a5f]">{metrics.avgPreparationTime.toFixed(1)} min</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <p className="text-sm text-gray-500">Completion Rate</p>
              <p className="text-xl font-bold text-[#1e3a5f]">{metrics.completionRate.toFixed(1)}%</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <p className="text-sm text-gray-500">Delayed Orders</p>
              <p className="text-xl font-bold text-red-600">{metrics.delayedOrders}</p>
            </div>
          </div>
        </div>
        <button onClick={loadOrders} className="px-4 py-2 bg-[#0f766e] text-white rounded-md hover:bg-[#1e3a5f]">Refresh</button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <input type="text" placeholder="Search orders by items..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#0f766e]" />
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Filter className="h-5 w-5 text-gray-400" />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-gray-300 py-2 pl-3 pr-10 focus:outline-none focus:ring-2 focus:ring-[#0f766e]">
              <option value="all">All</option>
              <option value="ready">Completed</option>
              <option value="preparing">In Progress</option>
            </select>
          </div>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'time' | 'duration')}
            className="rounded-lg border border-gray-300 py-2 pl-3 pr-10 focus:outline-none focus:ring-2 focus:ring-[#0f766e]">
            <option value="time">Sort by Time</option>
            <option value="duration">Sort by Duration</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredOrders.map((order) => (
          <div key={order.id} className="bg-white rounded-lg shadow-sm border-l-4 border-[#0f766e]">
            <div className="p-4">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Order #{order.id.slice(0, 8)}</h3>
                  <div className="flex items-center mt-1">
                    <Clock className="w-4 h-4 text-gray-400 mr-1" />
                    <span className="text-sm text-gray-500">{new Date(order.createdAt).toLocaleString()}</span>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  order.status === 'ready' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                }`}>{order.preparationTime} min</span>
              </div>

              <div className="space-y-2 mb-4">
                {order.items.map((item) => (
                  <div key={item.id} className="flex justify-between items-center">
                    <div className="flex items-center">
                      <span className="w-6 h-6 flex items-center justify-center bg-[#ccfbf1] text-[#0f766e] rounded-full text-sm font-medium">{item.quantity}</span>
                      <span className="ml-2 text-gray-900">{item.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredOrders.length === 0 && (
        <div className="text-center py-12">
          <Clock className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No orders found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchQuery || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Your order history will appear here'}
          </p>
        </div>
      )}
    </div>
  );
}
