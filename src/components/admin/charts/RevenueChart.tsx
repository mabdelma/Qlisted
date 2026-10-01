import { useEffect, useState, useCallback } from 'react';
import { analyticsApi } from '../../../lib/api';
import { useAuth } from '../../../contexts/AuthContext';
import type { RevenueDataPoint } from '../../../lib/api/types';
import { Skeleton } from '../../ui/Skeleton';

export function RevenueChart() {
  const { state } = useAuth();
  const slug = state.tenant?.slug;
  const [data, setData] = useState<RevenueDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!slug) return;
    try {
      const result = await analyticsApi.revenue(slug);
      const chartData = result.daily
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(-7);

      setData(chartData);
    } catch (error) {
      console.error('Failed to load revenue data:', error);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    loadData();
  }, [slug, loadData]);

  if (loading) return <div className="h-64 p-4 space-y-3"><Skeleton className="h-8 w-full" /><Skeleton className="h-32 w-full" /><Skeleton className="h-8 w-2/3" /></div>;
  
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        No revenue data available
      </div>
    );
  }

  // Calculate chart dimensions
  const maxRevenue = Math.max(...data.map(d => d.revenue));
  const chartHeight = 200;

  return (
    <div className="relative h-64">
      {/* Y-axis labels */}
      <div className="absolute left-0 top-0 bottom-0 w-16 flex flex-col justify-between text-xs text-gray-500">
        <span>${maxRevenue.toFixed(0)}</span>
        <span>${(maxRevenue / 2).toFixed(0)}</span>
        <span>$0</span>
      </div>

      {/* Chart area */}
      <div className="ml-16 h-full flex items-end space-x-4">
        {data.map((item, index) => (
          <div key={index} className="flex flex-col items-center">
            <div
              className="w-10 bg-indigo-500 rounded-t transition-all duration-300 hover:bg-indigo-600"
              style={{
                height: `${(item.revenue / maxRevenue) * chartHeight}px`
              }}
            />
            <span className="mt-2 text-xs text-gray-500 -rotate-45 origin-top-left">
              {new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}