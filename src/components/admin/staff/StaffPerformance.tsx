import { useState, useEffect } from 'react';
import { userApi, orderApi } from '../../../lib/api';
import { useAuth } from '../../../contexts/AuthContext';
import type { User, Order } from '../../../lib/api/types';
import { StaffStats } from './StaffStats';
import { StaffList } from './StaffList';
import { LoadingSpinner } from '../../ui/LoadingSpinner';
import { ErrorMessage } from '../../ui/ErrorMessage';

/**
 * Per-staff metrics. Exported so the presentational components share one shape
 * with the component that computes it instead of re-declaring it.
 */
export interface StaffMetrics {
  ordersHandled: number;
  avgServiceTime: number;
  totalSales: number;
  rating: number;
  /**
   * Cashier payment-method breakdown. Not currently computed — the UI that
   * renders it is guarded on its presence, so it stays optional until a
   * producer supplies it again.
   */
  paymentMethods?: { cash: number; card: number; wallet: number };
}

export function StaffPerformance() {
  const { state: { tenant } } = useAuth();
  const slug = tenant?.slug;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [staffMetrics, setStaffMetrics] = useState<Record<string, StaffMetrics>>({});
  const [staff, setStaff] = useState<User[]>([]);
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month'>('week');

  useEffect(() => {
    if (!slug) return;
    async function loadStaffData() {
      if (!slug) return;
      try {
        const [users, orders] = await Promise.all([
          userApi.list(slug),
          orderApi.list(slug),
        ]);

        const staffMembers = users.filter(
          (u) => ['waiter', 'kitchen', 'cashier'].includes(u.role)
        );

        const now = new Date();
        const rangeStart = new Date();
        if (timeRange === 'day') rangeStart.setHours(0, 0, 0, 0);
        else if (timeRange === 'week') rangeStart.setDate(now.getDate() - 7);
        else rangeStart.setMonth(now.getMonth() - 1);

        const metrics: Record<string, StaffMetrics> = {};

        staffMembers.forEach((member) => {
          const memberOrders = orders.filter((o) => {
            const orderDate = new Date(o.createdAt);
            return o.serverId === member.id && orderDate >= rangeStart && orderDate <= now;
          });

          const serviceTimes = memberOrders
            .filter((o) => o.completedAt)
            .map((o) => (new Date(o.completedAt!).getTime() - new Date(o.createdAt).getTime()) / 60000);

          metrics[member.id] = {
            ordersHandled: memberOrders.length,
            avgServiceTime: serviceTimes.length > 0
              ? serviceTimes.reduce((a, b) => a + b, 0) / serviceTimes.length
              : 0,
            totalSales: memberOrders.reduce((sum, o) => sum + o.total, 0),
            rating: calculateRating(memberOrders),
          };
        });

        setStaff(staffMembers);
        setStaffMetrics(metrics);
        setError(null);
      } catch {
        setError('Failed to load staff performance data');
      } finally {
        setLoading(false);
      }
    }
    loadStaffData();
    const interval = setInterval(loadStaffData, 300000);
    return () => clearInterval(interval);
  }, [slug, timeRange]);

  function calculateRating(orders: Order[]): number {
    if (orders.length === 0) return 0;
    const avgTime = orders
      .filter((o) => o.completedAt)
      .reduce((sum, o) => sum + (new Date(o.completedAt!).getTime() - new Date(o.createdAt).getTime()) / 60000, 0)
      / Math.max(1, orders.filter((o) => o.completedAt).length);
    const completionScore = Math.min(1, 30 / (avgTime || 30)) * 4;
    const volumeScore = Math.min(1, orders.length / 20) * 3;
    const cancelledPenalty = orders.filter((o) => o.status === 'cancelled').length;
    const accuracyScore = Math.max(0, 1 - cancelledPenalty / Math.max(1, orders.length)) * 3;
    return completionScore + volumeScore + accuracyScore;
  }

  if (!slug) return <div className="p-4 text-gray-500">Loading tenant...</div>;
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Staff Performance</h2>
          <p className="text-sm text-gray-500">Monitor and analyze staff efficiency</p>
        </div>
        <div className="flex items-center space-x-4">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as 'day' | 'week' | 'month')}
            className="rounded-lg border border-gray-300 py-2 pl-3 pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="day">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
        </div>
      </div>

      <StaffStats staff={staff} metrics={staffMetrics} />
      <StaffList staff={staff} metrics={staffMetrics} />
    </div>
  );
}
