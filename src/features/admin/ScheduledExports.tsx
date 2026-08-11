import { useState } from 'react';
import { FileText, Download, DollarSign, Menu } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function thirtyDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

export function ScheduledExports() {
  const { t } = useI18n();
  const { state: { tenant } } = useAuth();
  const slug = tenant?.slug;
  const [startDate, setStartDate] = useState(thirtyDaysAgo());
  const [endDate, setEndDate] = useState(todayString());
  const [exporting, setExporting] = useState<string | null>(null);

  async function handleExport(type: 'orders' | 'payments' | 'menu') {
    if (!slug) return;
    setExporting(type);
    try {
      const token = localStorage.getItem('token');
      const params = type === 'menu' ? '' : `?startDate=${startDate}&endDate=${endDate}`;
      const res = await fetch(`${API_BASE}/r/${slug}/exports/${type}${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert(t('exports.failed'));
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-3 mb-6">
          <FileText className="w-6 h-6 text-[#0f766e]" />
          <h3 className="text-lg font-medium">{t('exports.title')}</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('promo.startDate')}</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-[#0f766e] focus:border-[#0f766e]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('promo.endDate')}</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-[#0f766e] focus:border-[#0f766e]"
            />
          </div>
        </div>

        <p className="text-xs text-gray-500 mb-4">{t('exports.dateHint')}</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => handleExport('orders')}
            disabled={exporting !== null || !slug}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-[#0f766e] text-white rounded-lg hover:bg-[#1e3a5f] disabled:opacity-50 transition-colors"
          >
            <Download className="w-5 h-5" />
            {exporting === 'orders' ? t('exports.exporting') : t('exports.exportOrders')}
          </button>
          <button
            onClick={() => handleExport('payments')}
            disabled={exporting !== null || !slug}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-[#0f766e] text-white rounded-lg hover:bg-[#1e3a5f] disabled:opacity-50 transition-colors"
          >
            <DollarSign className="w-5 h-5" />
            {exporting === 'payments' ? t('exports.exporting') : t('exports.exportPayments')}
          </button>
          <button
            onClick={() => handleExport('menu')}
            disabled={exporting !== null || !slug}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-[#0f766e] text-white rounded-lg hover:bg-[#1e3a5f] disabled:opacity-50 transition-colors"
          >
            <Menu className="w-5 h-5" />
            {exporting === 'menu' ? t('exports.exporting') : t('exports.exportMenu')}
          </button>
        </div>
      </div>
    </div>
  );
}
