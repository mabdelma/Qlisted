import { useState, useEffect, useCallback } from 'react';
import { Users, Coffee, Clock, AlertTriangle } from 'lucide-react';
import { tableApi, orderApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import type { TableData, Order } from '../../lib/api/types';
import { Skeleton } from '../ui/Skeleton';

type TableWithOrders = TableData & {
  activeOrder?: Order;
  orderAge?: number;
};

export function TableGrid() {
  const { state: { tenant } } = useAuth();
  const slug = tenant?.slug;
  const [tables, setTables] = useState<TableWithOrders[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTables = useCallback(async () => {
    if (!slug) return;
    try {
      const [allTables, allOrders] = await Promise.all([
        tableApi.list(slug),
        orderApi.list(slug),
      ]);

      const tablesWithOrders = allTables.map((table) => {
        const activeOrder = allOrders
          .filter((o) => o.tableId === table.id && !['delivered', 'cancelled'].includes(o.status))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

        return {
          ...table,
          activeOrder,
          orderAge: activeOrder
            ? Math.floor((Date.now() - new Date(activeOrder.createdAt).getTime()) / 60000)
            : undefined,
        } as TableWithOrders;
      });

      setTables(tablesWithOrders.sort((a, b) => a.number - b.number));
    } catch {
      console.error('Failed to load tables');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadTables();
    const interval = setInterval(loadTables, 30000);
    return () => clearInterval(interval);
  }, [loadTables]);

  if (!slug) return <div className="p-4"><Skeleton className="h-32 w-full" /></div>;
  if (loading) return <div className="p-4 grid grid-cols-2 gap-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Table Overview</h2>
        <button onClick={loadTables} className="px-4 py-2 bg-[#0f766e] text-white rounded-md hover:bg-[#1e3a5f]">Refresh</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {tables.map((table) => (
          <article key={table.id}
            className={`bg-white rounded-lg shadow-sm border-l-4 p-4 ${
              table.status === 'occupied' ? 'border-orange-500' :
              table.status === 'available' ? 'border-green-500' :
              table.status === 'reserved' ? 'border-blue-500' : 'border-gray-500'
            }`}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Table {table.number}</h3>
                <p className="text-sm text-gray-500 flex items-center">
                  <Users className="w-4 h-4 mr-1" /> Capacity: {table.capacity}
                </p>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                table.status === 'available' ? 'bg-green-100 text-green-800' :
                table.status === 'occupied' ? 'bg-orange-100 text-orange-800' :
                table.status === 'reserved' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>{table.status}</span>
            </div>
            {table.activeOrder && table.orderAge !== undefined && (
              <div className="border-t pt-3 mt-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center text-gray-600">
                    <Coffee className="w-4 h-4 mr-1" /> Order active
                  </span>
                  <span className={`flex items-center ${table.orderAge > 15 ? 'text-red-600' : 'text-gray-500'}`}>
                    <Clock className="w-4 h-4 mr-1" />
                    {table.orderAge} min
                    {table.orderAge > 15 && <AlertTriangle className="w-4 h-4 ml-1 text-red-500" />}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {table.activeOrder.itemCount} items · ${table.activeOrder.total.toFixed(2)}
                </p>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
