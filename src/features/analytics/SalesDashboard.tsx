import { useEffect, useState } from 'react';
import { analyticsApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { DollarSign, ShoppingCart, Users, Clock, AlertTriangle, TrendingUp, CreditCard, Tag } from 'lucide-react';
import { StatsCard } from '../../components/admin/StatsCard';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { PeakHoursHeatmap } from './PeakHoursHeatmap';
import type { AnalyticsSummary, RevenueDataPoint, PeakHour, FinancialAnalytics, CategoryPerformanceItem, TrendingItem, HourlyTrafficPoint } from '../../lib/api/types';

export function SalesDashboard() {
  const { t } = useI18n();
  const { state: { tenant } } = useAuth();
  const slug = tenant?.slug;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [revenue, setRevenue] = useState<RevenueDataPoint[]>([]);
  const [peakHours, setPeakHours] = useState<PeakHour[]>([]);
  const [financial, setFinancial] = useState<FinancialAnalytics | null>(null);
  const [categoryPerf, setCategoryPerf] = useState<CategoryPerformanceItem[]>([]);
  const [trending, setTrending] = useState<TrendingItem[]>([]);
  const [hourly, setHourly] = useState<HourlyTrafficPoint[]>([]);

  useEffect(() => {
    if (!slug) return;
    async function loadData() {
      if (!slug) return;
      try {
        const [summaryData, revenueData, peakData, financialData, categoryData, trendingData, hourlyData] = await Promise.all([
          analyticsApi.summary(slug),
          analyticsApi.revenue(slug),
          analyticsApi.peakHours(slug),
          analyticsApi.financial(slug).catch(() => null),
          analyticsApi.categoryPerformance(slug).catch(() => ({ data: [] })),
          analyticsApi.trending(slug).catch(() => ({ data: [] })),
          analyticsApi.hourlyTraffic(slug).catch(() => ({ data: [] })),
        ]);
        setSummary(summaryData);
        setRevenue(revenueData.daily);
        setPeakHours(peakData.data);
        setFinancial(financialData);
        setCategoryPerf(categoryData.data);
        setTrending(trendingData.data);
        setHourly(hourlyData.data);
        setError(null);
      } catch {
        setError(t('analytics.loadError'));
      } finally {
        setLoading(false);
      }
    }
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [slug]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg p-6 shadow-sm space-y-2">
              <div className="h-4 bg-gray-200 rounded w-24" />
              <div className="h-8 bg-gray-200 rounded w-16" />
            </div>
          ))}
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="h-4 bg-gray-200 rounded w-32 mb-4" />
          <div className="h-48 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (error) return <ErrorMessage message={error} />;
  if (!summary) return null;

  const maxRevenue = Math.max(...revenue.map((r) => r.revenue), 1);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatsCard
          title={t('marketing.statTodaySales')}
          value={`$${summary.todaysSales.toFixed(2)}`}
          icon={DollarSign}
          iconColor="text-green-500"
          iconBgColor="bg-green-100"
        />
        <StatsCard
          title={t('analytics.totalSales')}
          value={`$${summary.totalSales.toFixed(2)}`}
          icon={ShoppingCart}
          iconColor="text-blue-500"
          iconBgColor="bg-blue-100"
        />
        <StatsCard
          title={t('analytics.activeTables')}
          value={`${summary.activeTables}/${summary.totalTables}`}
          icon={Users}
          iconColor="text-purple-500"
          iconBgColor="bg-purple-100"
        />
        <StatsCard
          title={t('analytics.pendingOrders')}
          value={summary.pendingOrders.toString()}
          icon={Clock}
          iconColor="text-orange-500"
          iconBgColor="bg-orange-100"
        />
        <StatsCard
          title={t('analytics.avgPrepTime')}
          value={`${summary.averagePreparationTime.toFixed(1)}m`}
          icon={AlertTriangle}
          iconColor="text-red-500"
          iconBgColor="bg-red-100"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">{t('analytics.revenue7Days')}</h3>
          <div className="flex items-end gap-2 h-48" style={{ paddingBottom: '24px' }}>
            {revenue.length === 0 ? (
              <p className="text-gray-500 text-sm">{t('analytics.noRevenue')}</p>
            ) : (
              <>
                <div className="flex items-end gap-2 flex-1 h-full">
                  {revenue.map((point) => {
                    const height = (point.revenue / maxRevenue) * 100;
                    const date = new Date(point.date);
                    const label = date.toLocaleDateString('en-US', { weekday: 'short' });
                    return (
                      <div key={point.date} className="flex-1 flex flex-col items-center justify-end h-full">
                        <span className="text-xs text-gray-500 mb-1">${point.revenue.toFixed(0)}</span>
                        <div
                          className="w-full bg-[#0f766e] rounded-t hover:opacity-80 transition-opacity"
                          style={{ height: `${Math.max(height, 2)}%` }}
                        />
                        <span className="text-xs text-gray-500 mt-1">{label}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">{t('analytics.popularItems')}</h3>
          {summary.popularItems.length === 0 ? (
            <p className="text-gray-500 text-sm">{t('analytics.noPopular')}</p>
          ) : (
            <div className="space-y-3">
              {summary.popularItems.slice(0, 5).map((item, idx) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <span className="w-6 h-6 rounded-full bg-[#0f766e] text-white text-xs flex items-center justify-center font-medium mr-2">
                      {idx + 1}
                    </span>
                    <span className="text-sm text-gray-700">{item.name}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">{item.quantity}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">{t('analytics.peakHours')}</h3>
        <PeakHoursHeatmap data={peakHours} />
      </div>

      {/* Hourly traffic — orders by hour of day */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="flex items-center gap-2 text-lg font-medium text-gray-900 mb-4"><Clock className="w-5 h-5 text-[#0f766e]" /> {t('analytics.hourlyTraffic')}</h3>
        {hourly.length === 0 ? (
          <p className="text-gray-500 text-sm">{t('analytics.noData')}</p>
        ) : (() => {
          const byHour = new Map(hourly.map((h) => [h.hour, h.orderCount]));
          const maxOrders = Math.max(...hourly.map((h) => h.orderCount), 1);
          return (
            <div className="flex items-end gap-0.5 h-40">
              {Array.from({ length: 24 }).map((_, h) => {
                const count = byHour.get(h) || 0;
                return (
                  <div key={h} className="flex-1 flex flex-col items-center justify-end h-full" title={`${h}:00 — ${count} ${t('analytics.orders')}`}>
                    <div className="w-full bg-[#0f766e] rounded-t hover:opacity-80 transition-opacity" style={{ height: `${count > 0 ? Math.max((count / maxOrders) * 100, 4) : 0}%` }} />
                    {h % 6 === 0 && <span className="text-[10px] text-gray-400 mt-1">{h}:00</span>}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Financial overview — today / week / month */}
      {financial && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatsCard title={t('analytics.today')} value={`$${financial.dailyRevenue.toFixed(2)}`} icon={DollarSign} iconColor="text-green-500" iconBgColor="bg-green-100" />
          <StatsCard title={t('analytics.thisWeek')} value={`$${financial.weeklyRevenue.toFixed(2)}`} icon={TrendingUp} iconColor="text-blue-500" iconBgColor="bg-blue-100" />
          <StatsCard title={t('analytics.thisMonth')} value={`$${financial.monthlyRevenue.toFixed(2)}`} icon={TrendingUp} iconColor="text-purple-500" iconBgColor="bg-purple-100" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment methods breakdown */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="flex items-center gap-2 text-lg font-medium text-gray-900 mb-4"><CreditCard className="w-5 h-5 text-[#0f766e]" /> {t('analytics.paymentMethods')}</h3>
          {!financial || Object.keys(financial.paymentMethods).length === 0 ? (
            <p className="text-gray-500 text-sm">{t('analytics.noData')}</p>
          ) : (() => {
            const entries = Object.entries(financial.paymentMethods);
            const total = entries.reduce((s, [, v]) => s + v, 0) || 1;
            return (
              <div className="space-y-3">
                {entries.map(([method, amount]) => (
                  <div key={method}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="capitalize text-gray-700">{method}</span>
                      <span className="font-medium text-gray-900">${amount.toFixed(2)} ({Math.round((amount / total) * 100)}%)</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-[#0f766e] rounded-full" style={{ width: `${(amount / total) * 100}%` }} /></div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        {/* Trending items */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="flex items-center gap-2 text-lg font-medium text-gray-900 mb-4"><TrendingUp className="w-5 h-5 text-[#0f766e]" /> {t('analytics.trending')}</h3>
          {trending.length === 0 ? (
            <p className="text-gray-500 text-sm">{t('analytics.noData')}</p>
          ) : (
            <div className="space-y-3">
              {trending.slice(0, 5).map((item, idx) => (
                <div key={item.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#0f766e] text-white text-xs flex items-center justify-center font-medium">{idx + 1}</span>
                    <span className="text-sm text-gray-700">{item.name}</span>
                  </div>
                  <span className="text-sm text-gray-500">{t('analytics.recentOrders', { count: item.recentOrders })}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Category performance */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="flex items-center gap-2 text-lg font-medium text-gray-900 mb-4"><Tag className="w-5 h-5 text-[#0f766e]" /> {t('analytics.categoryPerformance')}</h3>
        {categoryPerf.length === 0 ? (
          <p className="text-gray-500 text-sm">{t('analytics.noData')}</p>
        ) : (() => {
          const maxRev = Math.max(...categoryPerf.map((c) => c.totalRevenue), 1);
          return (
            <div className="space-y-3">
              {categoryPerf.map((cat) => (
                <div key={cat.categoryId}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700">{cat.categoryName}</span>
                    <span className="font-medium text-gray-900">${cat.totalRevenue.toFixed(2)} · {t('analytics.unitsSold', { count: cat.totalSold })}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-green-500 rounded-full" style={{ width: `${(cat.totalRevenue / maxRev) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
