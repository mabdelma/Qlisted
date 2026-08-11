import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Clock, Check, Search, DollarSign } from 'lucide-react';
import { orderApi, paymentApi } from '../../lib/api';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { ErrorMessage } from '../ui/ErrorMessage';
import { StaffSidebar } from '../ui/StaffSidebar';
import { Header } from '../admin/Header';
import { StaffProfile } from '../profile/StaffProfile';
import { PointOfSale } from '../shared/PointOfSale';
import { CashierHistory } from './CashierHistory';
import { NotificationsProvider } from '../../contexts/NotificationsContext';

interface CashPayment {
  orderId: string;
  orderTotal: number;
  createdAt: string;
}

export function CashierPanel() {
  const [activeView, setActiveView] = useState<'payments' | 'pos' | 'history' | 'profile'>('payments');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingPayments, setPendingPayments] = useState<CashPayment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'time' | 'amount'>('time');
  const { state: authState } = useAuth();
  const slug = authState.tenant?.slug;

  const loadPendingPayments = useCallback(async () => {
    if (!slug) return;
    try {
      const allOrders = await orderApi.list(slug);
      const unpaidOrders = allOrders
        .filter((order) => order.paymentStatus !== 'paid')
        .map((order) => ({
          orderId: order.id,
          orderTotal: order.total,
          createdAt: order.createdAt,
        }))
        .sort((a, b) => {
          if (sortBy === 'amount') return b.orderTotal - a.orderTotal;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

      setPendingPayments(unpaidOrders);
      setError(null);
    } catch {
      setError('Failed to load pending payments');
    } finally {
      setLoading(false);
    }
  }, [slug, sortBy]);

  useEffect(() => {
    loadPendingPayments();
    const interval = setInterval(loadPendingPayments, 30000);
    return () => clearInterval(interval);
  }, [loadPendingPayments]);

  async function processPayment(orderId: string) {
    if (!slug) { setError('Tenant not found'); return; }

    try {
      await paymentApi.recordCash(slug, { orderId, amount: 0 });
      await orderApi.updateStatus(slug, orderId, 'delivered');
      await loadPendingPayments();
      setError(null);
    } catch {
      setError('Failed to process payment');
    }
  }

  const filteredPayments = pendingPayments.filter((p) => {
    if (!searchQuery) return true;
    return p.orderId.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const PaymentsList = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-[#1e3a5f]">Pending Cash Payments</h2>
        <div className="flex items-center space-x-4">
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'time' | 'amount')}
            className="rounded-md border-gray-300 text-[#1e3a5f] focus:border-[#0f766e] focus:ring-[#0f766e]">
            <option value="time">Sort by Time</option>
            <option value="amount">Sort by Amount</option>
          </select>
          <button onClick={loadPendingPayments}
            className="px-4 py-2 bg-[#0f766e] text-white rounded-md hover:bg-[#1e3a5f]">Refresh Payments</button>
        </div>
      </div>

      <div className="relative">
        <input type="text" placeholder="Search by order ID..." value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#0f766e]" />
        <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <ErrorMessage message={error} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPayments.map((payment) => {
            const paymentAge = Math.floor((Date.now() - new Date(payment.createdAt).getTime()) / 60000);
            const isDelayed = paymentAge > 15;

            return (
              <div key={payment.orderId}
                className={`bg-white rounded-lg shadow-sm border-l-4 ${isDelayed ? 'border-red-500' : 'border-[#0f766e]'}`}>
                <div className="p-4">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">Order #{payment.orderId.slice(0, 8)}</h3>
                      <div className="flex items-center mt-1">
                        <Clock className="w-4 h-4 text-gray-400 mr-1" />
                        <span className="text-sm text-gray-500">{paymentAge} min ago</span>
                        {isDelayed && <span className="ml-2 text-red-600 text-sm">Delayed</span>}
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">Pending Payment</span>
                  </div>

                  <div className="mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center text-gray-500">
                        <DollarSign className="w-4 h-4 mr-1" />
                        <span>Amount Due</span>
                      </div>
                      <span className="text-lg font-semibold text-gray-900">${payment.orderTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  <button onClick={() => processPayment(payment.orderId)}
                    className="w-full flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">
                    <Check className="w-5 h-5 mr-2" />Process Payment
                  </button>
                </div>
              </div>
            );
          })}

          {filteredPayments.length === 0 && (
            <div className="col-span-full text-center py-12">
              <DollarSign className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No pending payments</h3>
              <p className="mt-1 text-sm text-gray-500">All cash payments have been processed</p>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <NotificationsProvider role="cashier">
      <div className="min-h-screen bg-gray-50">
        <div className="flex">
          <StaffSidebar role="cashier" activeTab={activeView} onTabChange={setActiveView} />
          <div className="flex-1">
            <Header />
            <main className="p-8">
              {activeView === 'pos' && <PointOfSale role="cashier" />}
              {activeView === 'payments' && <PaymentsList />}
              {activeView === 'history' && <CashierHistory />}
              {activeView === 'profile' && <StaffProfile />}
            </main>
          </div>
        </div>
      </div>
    </NotificationsProvider>
  );
}
