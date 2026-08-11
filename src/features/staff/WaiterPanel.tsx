import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { orderApi, tableApi } from '../../lib/api';
import { Clock, Users, Coffee, Check, AlertTriangle, RefreshCw } from 'lucide-react';
import type { Order, TableData } from '../../lib/api/types';

interface TableWithOrder extends TableData {
  activeOrder?: Order;
  orderAge?: number;
}

export function WaiterPanel() {
  const { state: { tenant } } = useAuth();
  const slug = tenant?.slug;
  const [tables, setTables] = useState<TableWithOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!slug) return;
    try {
      const [allTables, allOrders] = await Promise.all([
        tableApi.list(slug),
        orderApi.list(slug),
      ]);
      const activeOrders = allOrders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled');
      const withOrders = allTables.map((table) => {
        const activeOrder = activeOrders
          .filter((o) => o.tableId === table.id)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        return {
          ...table,
          activeOrder,
          orderAge: activeOrder
            ? Math.floor((Date.now() - new Date(activeOrder.createdAt).getTime()) / 60000)
            : undefined,
        } as TableWithOrder;
      });
      setTables(withOrders.sort((a, b) => a.number - b.number));
    } catch {
      console.error('Failed to load waiter data');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  async function handleDeliver(orderId: string) {
    if (!slug) return;
    try {
      await orderApi.updateStatus(slug, orderId, 'delivered');
      await load();
    } catch {
      console.error('Failed to deliver order');
    }
  }

  if (!slug || loading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-gray-100 rounded-xl h-28 animate-pulse" />
        ))}
      </div>
    );
  }

  const occupiedTables = tables.filter((t) => t.status === 'occupied' || t.activeOrder);
  const availableTables = tables.filter((t) => t.status === 'available' && !t.activeOrder);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Waiter Panel</h2>
        <button onClick={load} className="flex items-center gap-1 px-3 py-1.5 bg-[#0f766e] text-white text-sm rounded-lg hover:bg-[#1e3a5f]">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {occupiedTables.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-700 mb-3">Active Tables ({occupiedTables.length})</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {occupiedTables.map((table) => (
              <div key={table.id} className="bg-white rounded-xl shadow-sm border-l-4 border-orange-500 p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="text-lg font-bold text-gray-900">Table {table.number}</h4>
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <Users className="w-3 h-3" /> {table.capacity} seats
                    </p>
                  </div>
                  {table.activeOrder && (
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      table.activeOrder.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      table.activeOrder.status === 'preparing' ? 'bg-blue-100 text-blue-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {table.activeOrder.status}
                    </span>
                  )}
                </div>

                {table.activeOrder && (
                  <>
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                      <Clock className="w-3 h-3" />
                      <span>{table.orderAge} min</span>
                      {table.orderAge && table.orderAge > 15 && (
                        <AlertTriangle className="w-3 h-3 text-red-500" />
                      )}
                    </div>
                    <div className="text-sm text-gray-600 mb-3">
                      <span>{table.activeOrder.itemCount} items</span>
                      <span className="mx-2">·</span>
                      <span className="font-medium">${table.activeOrder.total.toFixed(2)}</span>
                    </div>
                    {table.activeOrder.status === 'ready' && (
                      <button
                        onClick={() => handleDeliver(table.activeOrder!.id)}
                        className="w-full flex items-center justify-center gap-1 bg-green-600 text-white text-sm py-2 rounded-lg hover:bg-green-700"
                      >
                        <Check className="w-4 h-4" /> Mark Delivered
                      </button>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {availableTables.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-700 mb-3">Available Tables ({availableTables.length})</h3>
          <div className="flex flex-wrap gap-3">
            {availableTables.map((table) => (
              <div key={table.id} className="bg-white rounded-xl shadow-sm border border-green-200 p-3 flex items-center gap-2">
                <Coffee className="w-4 h-4 text-green-500" />
                <span className="font-medium text-gray-900">Table {table.number}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tables.length === 0 && (
        <div className="text-center py-12 text-gray-500">No tables found.</div>
      )}
    </div>
  );
}
