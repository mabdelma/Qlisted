import { Users, Clock, QrCode, Settings, AlertTriangle, Trash2 } from 'lucide-react';
import type { TableData, Order } from '../../../lib/api/types';

interface TableListProps {
  tables: TableData[];
  activeOrders: Record<string, Order>;
  onViewQR: (table: TableData) => void;
  onEditTable: (table: TableData) => void;
  onDeleteTable: (table: TableData) => void;
  onStatusChange: (tableId: string, status: TableData['status']) => void;
}

export function TableList({
  tables,
  activeOrders,
  onViewQR,
  onEditTable,
  onDeleteTable,
  onStatusChange
}: TableListProps) {
  function getTableOccupationTime(table: TableData): number {
    if (table.status !== 'occupied') return 0;
    const order = activeOrders[table.id];
    if (!order) return 0;
    return Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000);
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {tables.map((table) => {
        const occupationTime = getTableOccupationTime(table);
        const isDelayed = occupationTime > 90; // Flag if table occupied > 90 mins
        
        return (
          <article
            key={table.id}
            className={`bg-white rounded-lg shadow-sm border-l-4 ${
              table.status === 'occupied'
                ? isDelayed 
                  ? 'border-red-500'
                  : 'border-blue-500'
                : table.status === 'reserved'
                ? 'border-yellow-500'
                : table.status === 'closed'
                ? 'border-gray-500'
                : 'border-green-500'
            }`}
          >
            <div className="p-4">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">
                    Table {table.number}
                  </h3>
                  <div className="flex items-center mt-1">
                    <Users className="w-4 h-4 text-gray-400 mr-1" />
                    <span className="text-sm text-gray-500">
                      Capacity: {table.capacity}
                    </span>
                  </div>
                </div>
                
                <select
                  value={table.status}
                  onChange={(e) => onStatusChange(table.id, e.target.value as TableData['status'])}
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    table.status === 'occupied'
                      ? 'bg-blue-100 text-blue-800'
                      : table.status === 'reserved'
                      ? 'bg-yellow-100 text-yellow-800'
                      : table.status === 'closed'
                      ? 'bg-gray-100 text-gray-800'
                      : 'bg-green-100 text-green-800'
                  }`}
                >
                  <option value="available">Available</option>
                  <option value="occupied">Occupied</option>
                  <option value="reserved">Reserved</option>
                  <option value="out_of_service">Out of Service</option>
                </select>
              </div>

              {table.status === 'occupied' && (
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center text-gray-500">
                      <Clock className="w-4 h-4 mr-1" />
                      <span>Occupied for {occupationTime} min</span>
                    </div>
                    {isDelayed && (
                      <div className="flex items-center text-red-600">
                        <AlertTriangle className="w-4 h-4 mr-1" />
                        <span>Extended Stay</span>
                      </div>
                    )}
                  </div>
                  {activeOrders[table.id] && (
                    <div className="mt-2 text-sm text-gray-500">
                      Order Total: ${activeOrders[table.id].total.toFixed(2)}
                    </div>
                  )}
                </div>
              )}

              <div className="flex space-x-2">
                <button
                  onClick={() => onViewQR(table)}
                  className="flex-1 flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <QrCode className="w-4 h-4 mr-2" />
                  View QR
                </button>
                <button
                  onClick={() => onEditTable(table)}
                  className="flex-1 flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </button>
                <button
                  onClick={() => onDeleteTable(table)}
                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                  title="Delete Table"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}