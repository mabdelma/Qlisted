import { useState, useEffect, useCallback } from 'react';
import { FileDown, Loader2, TrendingUp } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { reportApi } from '../../lib/api';
import type { PnLReport } from '../../lib/api/types';

function todayISO() { return new Date().toISOString().slice(0, 10); }
function monthStartISO() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); }

export function ReportsPage() {
  const { t } = useI18n();
  const { state: { tenant } } = useAuth();
  const slug = tenant?.slug;
  const currency = tenant?.currency || 'USD';

  const [start, setStart] = useState(monthStartISO());
  const [end, setEnd] = useState(todayISO());
  const [pnl, setPnl] = useState<PnLReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  // Convert the date inputs to full-day ISO bounds.
  const startISO = start ? `${start}T00:00:00.000Z` : undefined;
  const endISO = end ? `${end}T23:59:59.999Z` : undefined;

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true); setError('');
    try {
      setPnl(await reportApi.getPnL(slug, startISO, endISO));
    } catch (err) {
      setError((err as { message?: string }).message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [slug, startISO, endISO]);

  useEffect(() => { load(); }, [load]);

  async function downloadPdf() {
    if (!slug) return;
    setDownloading(true); setError('');
    try {
      const res = await fetch(`/api${reportApi.pnlPdfPath(slug, startISO, endISO)}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      });
      if (!res.ok) throw new Error('Failed to generate PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `pnl-${slug}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError((err as { message?: string }).message || 'Failed to download PDF');
    } finally {
      setDownloading(false);
    }
  }

  const money = (n: number) => `${currency} ${(n ?? 0).toFixed(2)}`;

  const rows: { label: string; value: string; strong?: boolean; muted?: boolean; good?: boolean }[] = pnl ? [
    { label: t('reports.grossRevenue'), value: money(pnl.grossRevenue) },
    { label: t('reports.refunds'), value: `- ${money(pnl.refunds)}`, muted: true },
    { label: t('reports.netRevenue'), value: money(pnl.netRevenue), strong: true },
    { label: t('reports.cogs'), value: `- ${money(pnl.cogs)}`, muted: true },
    { label: t('reports.grossProfit'), value: money(pnl.grossProfit), strong: true, good: pnl.grossProfit >= 0 },
    { label: t('reports.tips'), value: money(pnl.tips), muted: true },
    { label: t('reports.tax'), value: money(pnl.tax), muted: true },
    { label: t('reports.serviceCharge'), value: money(pnl.serviceCharge), muted: true },
    { label: t('reports.orders'), value: String(pnl.orderCount) },
    { label: t('reports.avgOrderValue'), value: money(pnl.avgOrderValue) },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-6 h-6 text-[#0f766e]" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('reports.title')}</h1>
      </div>

      <div className="flex flex-wrap items-end gap-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
        <label className="text-sm">
          <span className="block text-gray-600 dark:text-gray-300 mb-1">{t('reports.from')}</span>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 dark:bg-gray-900 dark:border-gray-600" />
        </label>
        <label className="text-sm">
          <span className="block text-gray-600 dark:text-gray-300 mb-1">{t('reports.to')}</span>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 dark:bg-gray-900 dark:border-gray-600" />
        </label>
        <button onClick={load} disabled={loading}
          className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50">
          {loading ? t('common.loading') : t('reports.apply')}
        </button>
        <button onClick={downloadPdf} disabled={downloading || !pnl}
          className="ml-auto inline-flex items-center gap-2 px-4 py-2 bg-[#0f766e] text-white rounded-lg text-sm font-medium hover:bg-[#1e3a5f] disabled:opacity-50">
          {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
          {t('reports.downloadPdf')}
        </button>
      </div>

      {error && <div className="bg-red-50 border-l-4 border-red-400 p-4 text-sm text-red-700">{error}</div>}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm divide-y divide-gray-100 dark:divide-gray-700">
        {loading && !pnl ? (
          <p className="p-6 text-gray-500">{t('common.loading')}</p>
        ) : rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between px-6 py-3">
            <span className={`text-sm ${r.muted ? 'text-gray-500' : r.strong ? 'font-semibold text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'}`}>{r.label}</span>
            <span className={`text-sm tabular-nums ${r.strong ? 'font-bold' : ''} ${r.good === true ? 'text-green-600' : r.good === false ? 'text-red-600' : 'text-gray-900 dark:text-gray-100'}`}>{r.value}</span>
          </div>
        ))}
      </div>

      {pnl && pnl.byMethod.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">{t('reports.byMethod')}</h2>
          <div className="space-y-2">
            {pnl.byMethod.map((m) => (
              <div key={m.method} className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-300 capitalize">{m.method} ({m.count})</span>
                <span className="tabular-nums text-gray-900 dark:text-gray-100">{money(m.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
