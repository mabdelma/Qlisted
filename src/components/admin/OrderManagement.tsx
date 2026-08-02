import { useState, useEffect } from 'react';
import { menuApi, orderApi, tableApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import type { Order, MenuItem, TableData, OrderWithItems } from '../../lib/api/types';
import { OrderStats } from './order/OrderStats';
import { OrderFilters } from './order/OrderFilters';
import { OrderList } from './order/OrderList';
import { OrderDetails } from '../shared/OrderDetails';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { ErrorMessage } from '../ui/ErrorMessage';
import { ConfirmDialog } from '../ui/ConfirmDialog';

export function OrderManagement() {
  const { state: { tenant } } = useAuth();
  const slug = tenant?.slug;
  const currency = tenant?.currency;
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<Record<string, MenuItem>>({});
  const [tables, setTables] = useState<Record<string, TableData>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [timeFilter, setTimeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);

  useEffect(() => {
    if (slug) {
      loadOrders();
      const interval = setInterval(loadOrders, 30000);
      return () => clearInterval(interval);
    }
  }, [slug]);

  async function loadOrders() {
    if (!slug) return;
    try {
      const [allOrders, menuData, allTables] = await Promise.all([
        orderApi.list(slug),
        menuApi.getFullMenu(slug),
        tableApi.list(slug)
      ]);

      const menuItemsMap = Object.fromEntries(
        menuData.items.map(item => [item.id, item])
      );
      const tablesMap = Object.fromEntries(
        allTables.map(table => [table.id, table])
      );

      setOrders(allOrders.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ));
      setMenuItems(menuItemsMap);
      setTables(tablesMap);
      setError(null);
    } catch (err) {
      console.error('Failed to load orders:', err);
      setError('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(orderId: string, status: Order['status']) {
    if (!slug) return;
    try {
      await orderApi.updateStatus(slug, orderId, status);
      loadOrders();
    } catch (error) {
      console.error('Failed to update order status:', error);
    }
  }

  async function handleCancelOrder(orderId: string) {
    if (!slug) return;
    try {
      await orderApi.updateStatus(slug, orderId, 'cancelled');
      loadOrders();
    } catch (error) {
      console.error('Failed to cancel order:', error);
    } finally {
      setCancelTarget(null);
    }
  }

  async function handleViewDetails(order: Order) {
    if (!slug) return;
    try {
      const detail = await orderApi.getDetail(slug, order.id);
      setSelectedOrder(detail);
    } catch (err) {
      console.error('Failed to load order details:', err);
    }
  }

  const filteredOrders = orders.filter(order => {
    if (statusFilter) {
      if (statusFilter === 'paid') {
        if (order.paymentStatus !== 'paid') return false;
      } else if (order.status !== statusFilter) {
        return false;
      }
    }

    if (paymentFilter !== 'all') {
      if (paymentFilter !== order.paymentStatus) return false;
    }

    const orderTime = new Date(order.createdAt).getTime();
    const now = Date.now();
    if (timeFilter === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (orderTime < today.getTime()) return false;
    } else if (timeFilter === 'hour') {
      if (orderTime < now - 3600000) return false;
    } else if (timeFilter === 'delayed') {
      const age = (now - orderTime) / 60000;
      if (age <= 15 || order.paymentStatus === 'paid') return false;
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const table = order.tableId ? tables[order.tableId] : undefined;
      const tableMatch = table && table.number.toString().includes(query);
      if (!tableMatch) return false;
    }

    return true;
  });

  const stats = {
    pendingOrders: orders.filter(o => o.status === 'pending').length,
    preparingOrders: orders.filter(o => o.status === 'preparing').length,
    readyOrders: orders.filter(o => o.status === 'ready').length,
    delayedOrders: orders.filter(o => {
      const age = (Date.now() - new Date(o.createdAt).getTime()) / 60000;
      return age > 15 && o.status !== 'delivered';
    }).length
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Order Management</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Track and manage customer orders</p>
        </div>
      </div>

      <OrderStats {...stats} />

      <OrderFilters
        statusFilter={statusFilter}
        timeFilter={timeFilter}
        searchQuery={searchQuery}
        paymentFilter={paymentFilter}
        onStatusFilterChange={setStatusFilter}
        onTimeFilterChange={setTimeFilter}
        onSearchChange={setSearchQuery}
        onPaymentFilterChange={setPaymentFilter}
      />

      <OrderList
        orders={filteredOrders}
        menuItems={menuItems}
        tables={tables}
        currency={currency}
        onViewDetails={handleViewDetails}
        onStatusChange={handleStatusChange}
        onCancelOrder={(id) => setCancelTarget(orders.find(o => o.id === id) ?? null)}
      />

      {selectedOrder && (
        <OrderDetails
          order={{
            ...selectedOrder,
            items: selectedOrder.items.map(item => ({
              id: item.id,
              name: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              notes: item.notes,
            }))
          }}
          onClose={() => setSelectedOrder(null)}
        />
      )}

      <ConfirmDialog
        open={cancelTarget !== null}
        title="Cancel order"
        message={`Are you sure you want to cancel the order${cancelTarget ? ` for ${cancelTarget.orderType === 'dine_in' ? `Table ${cancelTarget.tableId ? tables[cancelTarget.tableId]?.number ?? '?' : '?'}` : cancelTarget.orderType === 'takeout' ? 'takeout' : 'delivery'}` : ''}?`}
        confirmLabel="Cancel order"
        tone="danger"
        onConfirm={() => cancelTarget && handleCancelOrder(cancelTarget.id)}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
}
