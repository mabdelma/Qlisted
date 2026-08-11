import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Clock, AlertTriangle, Check } from 'lucide-react';
import { orderApi, tableApi } from '../../lib/api';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { ErrorMessage } from '../ui/ErrorMessage';
import { OrderEditDialog } from '../orders/OrderEditDialog';
import { OrderDetails } from '../shared/OrderDetails';

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
  tableId?: string;
  orderType: 'dine_in' | 'takeout' | 'delivery';
  status: string;
  paymentStatus: string;
  total: number;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  waiterStaffId?: string;
}

export function OrdersList() {
  const { state: authState } = useAuth();
  const slug = authState.tenant?.slug;
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [tables, setTables] = useState<Record<string, { id: string; number: number }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<OrderWithDetails | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null);

  const loadOrders = useCallback(async () => {
    if (!slug) return;
    try {
      const [allOrders, allTables] = await Promise.all([
        orderApi.list(slug),
        tableApi.list(slug),
      ]);

      const tablesMap = Object.fromEntries(allTables.map((t) => [t.id, t]));

      const ordersWithDetails = (
        await Promise.all(
          allOrders
            .filter((o) => o.status !== 'delivered' && o.status !== 'cancelled')
            .map(async (o) => {
              try {
                return await orderApi.getDetail(slug, o.id);
              } catch {
                return null;
              }
            })
        )
      )
        .filter((o): o is OrderWithDetails => o !== null)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setOrders(ordersWithDetails);
      setTables(tablesMap);
      setError(null);
    } catch {
      setError('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 30000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  async function handleCancelOrder(orderId: string) {
    if (!window.confirm('Are you sure you want to cancel this order?')) return;
    if (!slug) return;
    try {
      await orderApi.cancel(slug, orderId);
      await loadOrders();
    } catch {
      setError('Failed to cancel order');
    }
  }

  async function handleStatusChange(orderId: string, status: string) {
    if (!slug) return;
    try {
      await orderApi.updateStatus(slug, orderId, status);
      await loadOrders();
    } catch {
      setError('Failed to update order status');
    }
  }

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-[#1e3a5f]">Active Orders</h2>
        <button onClick={loadOrders} className="px-4 py-2 bg-[#0f766e] text-white rounded-md hover:bg-[#1e3a5f]">Refresh Orders</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {orders.map((order) => {
          const orderAge = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000);
          const isDelayed = orderAge > 15;
          const table = order.tableId ? tables[order.tableId] : undefined;

          return (
            <div key={order.id}
              className={`bg-white rounded-lg shadow-sm border-l-4 ${isDelayed ? 'border-red-500' : 'border-[#0f766e]'}`}>
              <div className="p-4">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{order.orderType === 'dine_in' ? `Table ${table?.number || '?'}` : order.orderType === 'takeout' ? 'Takeout' : 'Delivery'}</h3>
                    <div className="mt-2 flex space-x-2">
                      <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${
                        order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        order.status === 'preparing' ? 'bg-blue-100 text-blue-800' :
                        order.status === 'ready' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </span>
                      <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${
                        order.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' :
                        order.paymentStatus === 'partially' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1)}
                      </span>
                    </div>
                    <div className="flex items-center mt-1">
                      <Clock className="w-4 h-4 text-gray-400 mr-1" />
                      <span className="text-sm text-gray-500">{orderAge} min ago</span>
                      {isDelayed && <span className="ml-2 flex items-center text-red-600"><AlertTriangle className="w-4 h-4 mr-1" />Delayed</span>}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex justify-between items-center">
                      <div className="flex items-center">
                        <span className="text-gray-600">{item.name}</span>
                        <span className="text-sm text-gray-400 mx-2">×</span>
                        <span className="text-gray-900">{item.quantity}</span>
                      </div>
                      <span className="text-gray-600">${(item.unitPrice * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="pt-2 border-t flex justify-between font-medium">
                    <span>Total</span>
                    <span>${order.total.toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex space-x-2">
                  <button onClick={() => setEditingOrder(order)}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">Edit Order</button>
                  <button onClick={() => handleCancelOrder(order.id)}
                    className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700">Cancel Order</button>
                  <button onClick={() => setSelectedOrder(order)}
                    className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200">View Details</button>
                  {order.status === 'ready' && (
                    <button onClick={() => handleStatusChange(order.id, 'delivered')}
                      className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700">
                      <span className="flex items-center justify-center"><Check className="w-5 h-5 mr-2" />Delivered</span>
                    </button>
                  )}
                </div>
                {order.paymentStatus === 'paid' && (
                  <div className="text-sm text-green-600 mt-1">Payment Completed</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {editingOrder && <OrderEditDialog order={editingOrder as OrderWithDetails} onClose={() => setEditingOrder(null)} onUpdate={loadOrders} />}
      {selectedOrder && <OrderDetails order={selectedOrder} onClose={() => setSelectedOrder(null)} />}

      {orders.length === 0 && (
        <div className="text-center py-12">
          <Check className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No active orders</h3>
          <p className="mt-1 text-sm text-gray-500">All orders have been delivered</p>
        </div>
      )}
    </div>
  );
}
