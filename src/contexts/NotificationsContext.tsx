import React, { createContext, useContext, useReducer, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { orderApi, tableApi } from '../lib/api';
import { useSSE } from '../hooks/useSSE';

interface Notification {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  createdAt: Date;
  read: boolean;
}

interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
}

type NotificationsAction =
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
  | { type: 'MARK_AS_READ'; payload: string }
  | { type: 'MARK_ALL_AS_READ' }
  | { type: 'CLEAR_ALL' };

const NotificationsContext = createContext<{
  state: NotificationsState;
  dispatch: React.Dispatch<NotificationsAction>;
} | null>(null);

function notificationsReducer(state: NotificationsState, action: NotificationsAction): NotificationsState {
  switch (action.type) {
    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notifications: [action.payload, ...state.notifications],
        unreadCount: state.unreadCount + 1
      };

    case 'MARK_AS_READ':
      return {
        ...state,
        notifications: state.notifications.map(notif =>
          notif.id === action.payload ? { ...notif, read: true } : notif
        ),
        unreadCount: Math.max(0, state.unreadCount - 1)
      };

    case 'MARK_ALL_AS_READ':
      return {
        ...state,
        notifications: state.notifications.map(notif => ({ ...notif, read: true })),
        unreadCount: 0
      };

    case 'CLEAR_ALL':
      return { notifications: [], unreadCount: 0 };

    default:
      return state;
  }
}

function areOrdersEqual(a: { id: string; status: string; tableId?: string }[], b: { id: string; status: string; tableId?: string }[]) {
  if (a.length !== b.length) return false;
  return a.every((oa, i) => oa.id === b[i].id && oa.status === b[i].status);
}

export function NotificationsProvider({
  children,
  role,
  formatNotification
}: {
  children: React.ReactNode;
  role: 'super_admin' | 'admin' | 'manager' | 'waiter' | 'kitchen' | 'cashier' | 'customer';
  formatNotification?: (type: string, context: Record<string, string | number>) => string;
}) {
  const { state: { tenant } } = useAuth();
  const slug = tenant?.slug;
  const [state, dispatch] = useReducer(notificationsReducer, {
    notifications: [],
    unreadCount: 0
  });

  const knownOrders = useRef<{ id: string; status: string; tableId?: string }[]>([]);

  const checkForUpdates = useCallback(async () => {
    if (!slug) return;

    try {
      const [orders, tables] = await Promise.all([
        orderApi.list(slug),
        tableApi.list(slug),
      ]);

      const current = orders.map((o) => ({ id: o.id, status: o.status, tableId: o.tableId }));
      const prev = knownOrders.current;

      if (areOrdersEqual(current, prev)) return;
      knownOrders.current = current;

      const tableMap = new Map(tables.map((t) => [t.id, t.number]));

      orders.forEach((order) => {
        const prevOrder = prev.find((p) => p.id === order.id);
        if (prevOrder?.status === order.status) return;

        const tableNumber = order.tableId ? (tableMap.get(order.tableId) || '?') : (order.orderType === 'takeout' ? 'Takeout' : 'Delivery');

        switch (role) {
          case 'kitchen':
            if (order.status === 'pending') {
              const msg = formatNotification ? formatNotification('newOrder', { tableNumber }) : `New order from Table ${tableNumber}`;
              dispatch({
                type: 'ADD_NOTIFICATION',
                payload: {
                  id: crypto.randomUUID(),
                  message: msg,
                  type: 'info',
                  createdAt: new Date(),
                  read: false,
                },
              });
            }
            break;

          case 'waiter':
            if (order.status === 'ready') {
              const msg = formatNotification ? formatNotification('orderReady', { tableNumber }) : `Order for Table ${tableNumber} is ready`;
              dispatch({
                type: 'ADD_NOTIFICATION',
                payload: {
                  id: crypto.randomUUID(),
                  message: msg,
                  type: 'success',
                  createdAt: new Date(),
                  read: false,
                },
              });
            }
            break;

          case 'admin':
            if (order.status === 'pending') {
              const msg = formatNotification ? formatNotification('newOrder', { tableNumber }) : `New order from Table ${tableNumber}`;
              dispatch({
                type: 'ADD_NOTIFICATION',
                payload: {
                  id: crypto.randomUUID(),
                  message: msg,
                  type: 'info',
                  createdAt: new Date(),
                  read: false,
                },
              });
            } else if (order.status === 'ready') {
              const msg = formatNotification ? formatNotification('orderReady', { tableNumber }) : `Order for Table ${tableNumber} is ready`;
              dispatch({
                type: 'ADD_NOTIFICATION',
                payload: {
                  id: crypto.randomUUID(),
                  message: msg,
                  type: 'success',
                  createdAt: new Date(),
                  read: false,
                },
              });
            }
            break;
        }
      });
    } catch {
      // Silently ignore polling errors
    }
  }, [slug, role, formatNotification]);

  React.useEffect(() => {
    checkForUpdates();
    const interval = setInterval(checkForUpdates, 30000);
    return () => clearInterval(interval);
  }, [checkForUpdates]);

  useSSE(slug, {
    onOrderCreated: checkForUpdates,
    onOrderUpdated: checkForUpdates,
    onOrderStatusChanged: checkForUpdates,
  });

  return (
    <NotificationsContext.Provider value={{ state, dispatch }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
}
