import { useState, useEffect, useCallback } from 'react';
import { PlusCircle } from 'lucide-react';
import { tableApi, orderApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import type { TableData, Order } from '../../lib/api/types';
import { QRCodeModal } from './QRCodeModal';
import { TableEfficiencyStats } from './table/TableEfficiencyStats';
import { TableFilters } from './table/TableFilters';
import { TableList } from './table/TableList';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { ErrorMessage } from '../ui/ErrorMessage';

export function TableManagement() {
  const { state: { tenant } } = useAuth();
  const slug = tenant?.slug;
  const [tables, setTables] = useState<TableData[]>([]);
  const [activeOrders, setActiveOrders] = useState<Record<string, Order>>({});
  const [editingTable, setEditingTable] = useState<TableData | null>(null);
  const [viewingQRCode, setViewingQRCode] = useState<TableData | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingTable, setDeletingTable] = useState<TableData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [efficiency, setEfficiency] = useState({
    averageTurnoverTime: 0,
    occupancyRate: 0,
    totalTurnovers: 0
  });

  const loadTables = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const [allTables, allOrders] = await Promise.all([
        tableApi.list(slug),
        orderApi.list(slug)
      ]);

      const activeOrdersMap = allOrders.reduce((acc, order) => {
        if (order.status !== 'delivered' && order.paymentStatus !== 'paid' && order.tableId) {
          acc[order.tableId] = order;
        }
        return acc;
      }, {} as Record<string, Order>);

      const completedOrders = allOrders.filter(o => o.paymentStatus === 'paid');
      const turnoverTimes = completedOrders.map(order => {
        const start = new Date(order.createdAt).getTime();
        const end = new Date(order.updatedAt).getTime();
        return (end - start) / 60000;
      });

      const avgTurnover = turnoverTimes.length > 0
        ? turnoverTimes.reduce((sum, time) => sum + time, 0) / turnoverTimes.length
        : 0;

      const occupiedTables = allTables.filter(t => t.status === 'occupied').length;
      const occupancyRate = occupiedTables / allTables.length;

      setTables(allTables.sort((a, b) => a.number - b.number));
      setActiveOrders(activeOrdersMap);
      setEfficiency({
        averageTurnoverTime: avgTurnover,
        occupancyRate,
        totalTurnovers: completedOrders.length
      });
      setError(null);
    } catch (err) {
      console.error('Failed to load tables:', err);
      setError('Failed to load table data');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (slug) {
      loadTables();
      const interval = setInterval(loadTables, 60000);
      return () => clearInterval(interval);
    }
  }, [slug, loadTables]);

  async function saveTable(table: TableData) {
    if (!slug) return;
    const isNew = !tables.find(t => t.id === table.id);

    table.number = Math.max(1, Math.floor(Number(table.number)));
    table.capacity = Math.max(1, Math.floor(Number(table.capacity)));

    if (isNew) {
      await tableApi.create(slug, {
        number: table.number,
        capacity: table.capacity,
      });
    } else {
      await tableApi.update(slug, table.id, {
        number: table.number,
        capacity: table.capacity,
        status: table.status,
      });
    }

    setEditingTable(null);
    loadTables();
  }

  async function handleDeleteTable(table: TableData) {
    if (!slug) return;
    try {
      const orders = await orderApi.list(slug);
      const activeOrdersForTable = orders.filter(
        order => order.tableId === table.id &&
        !['delivered', 'paid'].includes(order.status)
      );

      if (activeOrdersForTable.length > 0) {
        throw new Error('Cannot delete table with active orders');
      }

      await tableApi.delete(slug, table.id);
      setDeletingTable(null);
      loadTables();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to delete table');
    }
  }

  const filteredTables = tables
    .filter(table => {
      if (statusFilter && table.status !== statusFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          table.number.toString().includes(query) ||
          table.status.toLowerCase().includes(query)
        );
      }
      return true;
    });

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Table Management</h2>
          <p className="text-sm text-gray-500">Monitor and manage restaurant tables</p>
        </div>
        <button
          onClick={() => setEditingTable({
            id: crypto.randomUUID(),
            number: tables.length + 1,
            capacity: 4,
            status: 'available',
            tenantId: '',
            qrToken: '',
          })}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          <PlusCircle className="w-5 h-5 mr-2" />
          Add Table
        </button>
      </div>

      <TableEfficiencyStats
        tables={tables}
        averageTurnoverTime={efficiency.averageTurnoverTime}
        occupancyRate={efficiency.occupancyRate}
        totalTurnovers={efficiency.totalTurnovers}
      />

      <TableFilters
        statusFilter={statusFilter}
        searchQuery={searchQuery}
        onStatusFilterChange={setStatusFilter}
        onSearchChange={setSearchQuery}
      />

      <TableList
        tables={filteredTables}
        activeOrders={activeOrders}
        onViewQR={setViewingQRCode}
        onEditTable={setEditingTable}
        onDeleteTable={setDeletingTable}
        onStatusChange={async (tableId, status) => {
          const table = tables.find(t => t.id === tableId);
          if (table && slug) {
            await tableApi.update(slug, tableId, { status });
            loadTables();
          }
        }}
      />

      {editingTable && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">
              {editingTable.id ? 'Edit Table' : 'New Table'}
            </h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              saveTable(editingTable);
            }} className="space-y-4">
              <div>
                <label htmlFor="table-number" className="block text-sm font-medium text-gray-700">Table Number</label>
                <input
                  id="table-number"
                  type="number"
                  value={editingTable.number || ''}
                  onChange={(e) => setEditingTable({
                    ...editingTable,
                    number: e.target.value ? parseInt(e.target.value) : 0
                  })}
                  min="1"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label htmlFor="table-capacity" className="block text-sm font-medium text-gray-700">Capacity</label>
                <input
                  id="table-capacity"
                  type="number"
                  value={editingTable.capacity || ''}
                  onChange={(e) => setEditingTable({
                    ...editingTable,
                    capacity: e.target.value ? parseInt(e.target.value) : 0
                  })}
                  min="1"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label htmlFor="table-status" className="block text-sm font-medium text-gray-700">Status</label>
                <select
                  id="table-status"
                  value={editingTable.status}
                  onChange={(e) => setEditingTable({ ...editingTable, status: e.target.value as TableData['status'] })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                >
                  <option value="available">Available</option>
                  <option value="occupied">Occupied</option>
                  <option value="reserved">Reserved</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setEditingTable(null)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewingQRCode && (
        <QRCodeModal
          table={viewingQRCode}
          onClose={() => setViewingQRCode(null)}
        />
      )}

      {deletingTable && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Delete Table</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete Table {deletingTable.number}? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeletingTable(null)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteTable(deletingTable)}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Delete Table
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

