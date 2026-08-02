import { useEffect, useState } from 'react';
import { analyticsApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { formatPrice } from '../../lib/pricing';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { TrendingUp, Package, UserMinus, Crown, Sparkles, Hotel } from 'lucide-react';
import type { ForecastInsights as Insights } from '../../lib/api/types';

export function ForecastInsights() {
  const { t, locale } = useI18n();
  const { state: { tenant } } = useAuth();
  const slug = tenant?.slug;
  const [data, setData] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    analyticsApi.insights(slug)
      .then(setData)
      .catch((e) => setError((e as { message?: string }).message || t('error.generic')))
      .finally(() => setLoading(false));
  }, [slug, t]);

  if (loading) return <p className="text-gray-500 p-4">{t('common.loading')}...</p>;
  if (error) return <ErrorMessage message={error} />;
  if (!data) return null;

  const money = (n: number) => formatPrice(n, locale);
  const maxProj = Math.max(...data.forecast.map((f) => f.projected), 1);

  return (
    <div className="space-y-6">
      {/* AI summary */}
      {data.narrative && (
        <div className="bg-gradient-to-br from-brand-500/5 to-brand-100/60 border border-brand-500/20 rounded-lg p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-brand-600 dark:text-brand-400 mb-2"><Sparkles className="w-4 h-4" /> {t('analytics.aiSummary')}</h3>
          <div className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{data.narrative}</div>
        </div>
      )}

      {/* Hotel front-desk (only when the tenant runs rooms) */}
      {data.hotel && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="flex items-center gap-2 text-lg font-medium text-gray-900 mb-4"><Hotel className="w-5 h-5 text-brand-600 dark:text-brand-400" /> {t('hotel.title')}</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div><p className="text-2xl font-bold text-gray-900">{data.hotel.occupancy}%</p><p className="text-xs text-gray-500">{t('hotel.occupancy')}</p></div>
            <div><p className="text-2xl font-bold text-gray-900">{money(data.hotel.upcomingRevenue)}</p><p className="text-xs text-gray-500">{t('hotel.bookingRevenue')}</p></div>
            <div><p className="text-2xl font-bold text-gray-900">{data.hotel.upcomingBookings}</p><p className="text-xs text-gray-500">{t('hotel.bookings')}</p></div>
          </div>
        </div>
      )}

      {/* 7-day revenue forecast */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="flex items-center gap-2 text-lg font-medium text-gray-900"><TrendingUp className="w-5 h-5 text-brand-600 dark:text-brand-400" /> {t('analytics.forecast')}</h3>
          <div className="text-right">
            <p className="text-xs text-gray-500">{t('analytics.projectedTotal')}</p>
            <p className="text-xl font-bold text-brand-600 dark:text-brand-400">{money(data.forecast7Total)}</p>
          </div>
        </div>
        <div className="flex items-end gap-2 h-40">
          {data.forecast.map((f) => (
            <div key={f.date} className="flex-1 flex flex-col items-center justify-end h-full" title={`${f.date} — ${money(f.projected)}`}>
              <span className="text-[10px] text-gray-500 mb-1">{money(f.projected)}</span>
              <div className="w-full bg-brand-500/80 rounded-t" style={{ height: `${(f.projected / maxProj) * 100}%` }} />
              <span className="text-[10px] text-gray-400 mt-1">{f.dow}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Reorder suggestions */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="flex items-center gap-2 text-lg font-medium text-gray-900"><Package className="w-5 h-5 text-brand-600 dark:text-brand-400" /> {t('analytics.reorderSuggestions')}</h3>
            {data.reorderCost > 0 && <span className="text-sm font-medium text-gray-500">~{money(data.reorderCost)}</span>}
          </div>
          {data.lowStock.length === 0 ? (
            <p className="text-gray-500 text-sm">{t('analytics.allStocked')}</p>
          ) : (
            <div className="space-y-2">
              {data.lowStock.map((s) => (
                <div key={s.name} className="flex items-center justify-between text-sm border-b border-gray-50 pb-2 last:border-0">
                  <div>
                    <span className="text-gray-800">{s.name}</span>
                    <span className="text-xs text-red-500 ml-2">{s.currentStock}/{s.minStock} {s.unit}</span>
                  </div>
                  <span className="font-medium text-brand-600 dark:text-brand-400">{t('analytics.reorderQty', { qty: `${s.suggestedReorder} ${s.unit}` })}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* At-risk customers */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="flex items-center gap-2 text-lg font-medium text-gray-900 mb-4"><UserMinus className="w-5 h-5 text-brand-600 dark:text-brand-400" /> {t('analytics.atRisk')}</h3>
          {data.atRisk.length === 0 ? (
            <p className="text-gray-500 text-sm">{t('analytics.noData')}</p>
          ) : (
            <div className="space-y-2">
              {data.atRisk.map((c, i) => (
                <div key={i} className="flex items-center justify-between text-sm border-b border-gray-50 pb-2 last:border-0">
                  <span className="text-gray-800">{c.name || '—'}</span>
                  <span className="text-xs text-gray-500">
                    {money(c.totalSpent)} · {c.lastVisit ? `${t('analytics.lastVisit')}: ${new Date(c.lastVisit).toLocaleDateString()}` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top customers */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="flex items-center gap-2 text-lg font-medium text-gray-900 mb-4"><Crown className="w-5 h-5 text-brand-600 dark:text-brand-400" /> {t('analytics.topCustomers')}</h3>
        {data.topCustomers.length === 0 ? (
          <p className="text-gray-500 text-sm">{t('analytics.noData')}</p>
        ) : (
          <div className="space-y-2">
            {data.topCustomers.map((c, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-600 text-xs flex items-center justify-center font-bold">{i + 1}</span>
                  <span className="text-gray-800">{c.name || '—'}</span>
                </div>
                <span className="text-gray-600">{money(c.totalSpent)} · {t('analytics.visitsCount', { count: c.totalVisits })}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
