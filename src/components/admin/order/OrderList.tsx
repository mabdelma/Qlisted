import { Clock, AlertTriangle, Check, Ban, ChefHat, Truck, Package } from 'lucide-react';
import type { Order, MenuItem, TableData, OrderItem } from '../../../lib/api/types';
import { Card } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { formatMoney } from '../../../lib/pricing';

interface OrderListProps {
  orders: Order[];
  menuItems: Record<string, MenuItem>;
  tables: Record<string, TableData>;
  currency?: string;
  onViewDetails: (order: Order) => void;
  onStatusChange: (orderId: string, status: Order['status']) => void;
  onCancelOrder: (orderId: string) => void;
}

const STATUS_VARIANT: Record<Order['status'], 'warning' | 'info' | 'success' | 'neutral' | 'danger'> = {
  pending: 'warning',
  preparing: 'info',
  ready: 'success',
  delivered: 'neutral',
  cancelled: 'danger',
};

const PAYMENT_VARIANT: Record<Order['paymentStatus'], 'success' | 'info' | 'warning' | 'neutral'> = {
  paid: 'success',
  partially_paid: 'info',
  unpaid: 'warning',
  refunded: 'neutral',
};

type OrderWithItemsList = Order & { items: OrderItem[] };

export function OrderList({
  orders,
  menuItems,
  tables,
  currency,
  onViewDetails,
  onStatusChange,
  onCancelOrder
}: OrderListProps) {
  function getOrderAge(createdAt: string): number {
    return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  }

  function isOrderDelayed(order: Order): boolean {
    const age = getOrderAge(order.createdAt);
    return age > 15 && order.status !== 'delivered';
  }

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={<Package className="h-7 w-7" />}
        title="No orders"
        description="Orders placed by customers will appear here."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {orders.map((order) => {
        const orderAge = getOrderAge(order.createdAt);
        const isDelayed = isOrderDelayed(order);
        const table = order.tableId ? tables[order.tableId] : undefined;

        return (
          <Card
            key={order.id}
            className={`cursor-pointer border-s-4 transition-shadow hover:shadow-card-hover ${
              isDelayed
                ? '!border-s-red-500'
                : order.status === 'pending'
                ? '!border-s-amber-500'
                : order.status === 'preparing'
                ? '!border-s-blue-500'
                : order.status === 'ready'
                ? '!border-s-green-500'
                : '!border-s-gray-400'
            }`}
            onClick={() => onViewDetails(order)}
          >
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold text-gray-900 dark:text-gray-100">
                    {order.orderType === 'dine_in' ? `Table ${table?.number ?? '?'}` : order.orderType === 'takeout' ? 'Takeout' : 'Delivery'}
                  </h3>
                  <div className="mt-1 flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                    <Clock className="h-3.5 w-3.5" aria-hidden />
                    <span>{orderAge} min ago</span>
                    {isDelayed && (
                      <span className="flex items-center gap-1 font-medium text-red-600 dark:text-red-400">
                        <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                        Delayed
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                  <Badge variant={STATUS_VARIANT[order.status]} dot>
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </Badge>
                  <Badge variant={PAYMENT_VARIANT[order.paymentStatus]}>
                    {order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1)}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                {(order as OrderWithItemsList).items.map((item) => {
                  const menuItem = menuItems[item.menuItemId];
                  return menuItem ? (
                    <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="truncate text-gray-600 dark:text-gray-300">{menuItem.name}</span>
                        <span className="shrink-0 text-gray-400">×</span>
                        <span className="shrink-0 font-semibold text-gray-900 dark:text-gray-100">{item.quantity}</span>
                      </div>
                      <span className="shrink-0 text-gray-600 dark:text-gray-300">
                        {formatMoney(menuItem.price * item.quantity, currency)}
                      </span>
                    </div>
                  ) : null;
                })}
                <div className="flex justify-between border-t pt-2 text-sm font-semibold text-gray-900 dark:border-gray-800 dark:text-gray-100">
                  <span>Total</span>
                  <span>{formatMoney(order.total, currency)}</span>
                </div>
              </div>

              <div className="flex gap-2">
                {order.status === 'pending' && (
                  <>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={(e) => { e.stopPropagation(); onStatusChange(order.id, 'preparing'); }}
                      leftIcon={<ChefHat className="h-4 w-4" />}
                    >
                      Start Preparing
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Cancel order"
                      onClick={(e) => { e.stopPropagation(); onCancelOrder(order.id); }}
                    >
                      <Ban className="h-4 w-4" />
                    </Button>
                  </>
                )}
                {order.status === 'preparing' && (
                  <Button
                    size="sm"
                    variant="success"
                    className="flex-1"
                    onClick={(e) => { e.stopPropagation(); onStatusChange(order.id, 'ready'); }}
                    leftIcon={<Check className="h-4 w-4" />}
                  >
                    Mark as Ready
                  </Button>
                )}
                {order.status === 'ready' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1"
                    onClick={(e) => { e.stopPropagation(); onStatusChange(order.id, 'delivered'); }}
                    leftIcon={<Truck className="h-4 w-4" />}
                  >
                    Mark as Delivered
                  </Button>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
