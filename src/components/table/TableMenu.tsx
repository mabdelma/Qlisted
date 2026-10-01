import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router';
import { tableApi } from '../../lib/api';
import { Outlet } from 'react-router';
import { CartProvider } from '../../contexts/CartContext';
import { TableHeader } from './TableHeader';
import type { TableData } from '../../lib/api/types';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { ErrorMessage } from '../ui/ErrorMessage';

export function TableMenu() {
  const { slug, tableId } = useParams();
  const [table, setTable] = useState<TableData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTable = useCallback(async () => {
    if (!slug || !tableId) {
      setError('Invalid table');
      setLoading(false);
      return;
    }

    try {
      const tableData = await tableApi.getByQr(slug, tableId);
      setTable(tableData);
      setError(null);
    } catch (err) {
      console.error('Failed to load table:', err);
      setError('Failed to load table information');
    } finally {
      setLoading(false);
    }
  }, [slug, tableId]);

  useEffect(() => {
    loadTable();
  }, [loadTable]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!table) return null;
  if (table.status !== 'occupied') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Table Not Available</h2>
          <p className="text-gray-600">
            Please wait for a staff member to seat you at this table before placing orders.
          </p>
        </div>
      </div>
    );
  }

  return (
    <CartProvider>
      <div className="min-h-screen bg-gray-50">
        <TableHeader />
        <main>
          <Outlet />
        </main>
      </div>
    </CartProvider>
  );
}