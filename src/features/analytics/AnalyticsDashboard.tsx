import { useEffect, useState } from 'react';
import { analyticsApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { Clock, DollarSign, Users, AlertTriangle, Utensils, Link as LinkIcon, Copy, Check, ExternalLink } from 'lucide-react';
import { StatsCard } from '../../components/admin/StatsCard';
import { AnalyticsSkeleton } from '../../components/ui/Skeleton';
import { FrontDeskWidget } from './FrontDeskWidget';
import type { AnalyticsSummary } from '../../lib/api/types';

export function AnalyticsDashboard() {
  const { t } = useI18n();
  const { state: { tenant } } = useAuth();
  const slug = tenant?.slug;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [copied, setCopied] = useState(false);

  // The restaurant's public, customer-facing ordering page.
  const publicUrl = tenant?.customDomain
    ? `https://${tenant.customDomain}`
    : `${window.location.origin}/r/${slug ?? ''}`;

  function copyUrl() {
    navigator.clipboard?.writeText(publicUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => { /* clipboard may be blocked */ });
  }

  useEffect(() => {
    if (!slug) return;
    async function loadSummary() {
      if (!slug) return;
      try {
        const [data] = await Promise.all([
          analyticsApi.summary(slug),
        ]);
        setSummary(data);
        setError(null);
      } catch {
        setError(t('error.generic'));
      } finally {
        setLoading(false);
      }
    }
    loadSummary();
    const interval = setInterval(loadSummary, 300000);
    return () => clearInterval(interval);
  }, [slug, t]);

  if (loading) return <AnalyticsSkeleton />;
  if (error) return <ErrorMessage message={error} />;
  if (!summary) return null;

  const venue = tenant?.venueType || 'restaurant';

  return (
    <div className="space-y-6">
      {/* Public page — URL + quick actions */}
      <div className="bg-gradient-to-r from-[#0f766e] to-[#1e3a5f] rounded-lg shadow p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 text-white min-w-0">
          <LinkIcon className="w-5 h-5 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-white/70">{venue === 'hotel' ? t('nav.bookingPage') : t('nav.restaurantUrl')}</p>
            <p className="font-medium truncate">{publicUrl}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto shrink-0">
          <button onClick={copyUrl}
            className="flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/25 transition-colors">
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? t('common.copied') : t('common.copy')}
          </button>
          <a href={publicUrl} target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-[#0f766e] hover:bg-amber-50 transition-colors">
            <ExternalLink className="w-4 h-4" /> <span className="hidden sm:inline">{t('nav.viewStorefront')}</span>
          </a>
        </div>
      </div>

      <FrontDeskWidget slug={slug} />

      {venue !== 'hotel' && (<>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <StatsCard
          title={t('marketing.statTodaySales')}
          value={`$${summary.todaysSales.toFixed(2)}`}
          icon={DollarSign}
          iconColor="text-green-500"
          iconBgColor="bg-green-100"
        />
        <StatsCard
          title={t('staff.tables')}
          value={`${summary.activeTables}/${summary.totalTables}`}
          icon={Users}
          iconColor="text-blue-500"
          iconBgColor="bg-blue-100"
        />
        <StatsCard
          title={t('nav.dashboard')}
          value={`${summary.averagePreparationTime.toFixed(1)} min`}
          icon={Clock}
          iconColor="text-purple-500"
          iconBgColor="bg-purple-100"
        />
        <StatsCard
          title={t('order.pending')}
          value={summary.delayedOrders.toString()}
          icon={AlertTriangle}
          iconColor="text-red-500"
          iconBgColor="bg-red-100"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">{t('menu.items')}</h3>
          {summary.popularItems.length === 0 ? (
            <p className="text-gray-500 text-sm">{t('common.noResults')}</p>
          ) : (
            <div className="space-y-3">
              {summary.popularItems.map((item, idx) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <span className="w-6 text-sm font-medium text-gray-400">#{idx + 1}</span>
                    <Utensils className="w-4 h-4 text-gray-400 mr-2" aria-hidden />
                    <span className="text-sm text-gray-700">{item.name}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">{item.quantity} {t('common.done')}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">{t('order.pending')}</h3>
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <span className="text-4xl font-bold text-[#0f766e]">{summary.pendingOrders}</span>
              <p className="text-sm text-gray-500 mt-1">{t('order.preparing')}</p>
            </div>
          </div>
        </div>
      </div>
      </>)}
    </div>
  );
}
