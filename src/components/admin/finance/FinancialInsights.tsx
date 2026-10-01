import { useState, useEffect, useCallback } from 'react';
import { paymentApi, orderApi } from '../../../lib/api';
import { useAuth } from '../../../contexts/AuthContext';
import type { Payment, Order } from '../../../lib/api/types';
import { RevenueBreakdown } from './RevenueBreakdown';
import { PaymentsList } from './PaymentsList';
import { LoadingSpinner } from '../../ui/LoadingSpinner';
import { ErrorMessage } from '../../ui/ErrorMessage';

export function FinancialInsights() {
  const { state } = useAuth();
  const slug = state.tenant?.slug;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [orders, setOrders] = useState<Record<string, Order>>({});

  const loadData = useCallback(async () => {
    if (!slug) return;
    try {
      const [allPayments, allOrders] = await Promise.all([
        paymentApi.list(slug),
        orderApi.list(slug)
      ]);

      const ordersMap = Object.fromEntries(
        allOrders.map(order => [order.id, order])
      );

      setPayments(allPayments.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ));
      setOrders(ordersMap);
      setError(null);
    } catch (err) {
      console.error('Failed to load financial data:', err);
      setError('Failed to load financial insights');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    loadData();
    const interval = setInterval(loadData, 300000);
    return () => clearInterval(interval);
  }, [slug, loadData]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="space-y-6">
      <RevenueBreakdown />
      
      <PaymentsList
        payments={payments.slice(0, 10)} // Show last 10 payments
        orders={orders}
      />
    </div>
  );
}