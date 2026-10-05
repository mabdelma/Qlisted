import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Receipt, Printer, Download, X, Copy, Check } from 'lucide-react';
import { paymentApi, receiptApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { formatPrice } from '../../lib/pricing';
import type { Payment } from '../../lib/api/types';

type MethodFilter = 'all' | Payment['method'];

/**
 * Receipts — every settled payment, with the receipt that was issued for it.
 *
 * The receipt body comes from the same `generateReceiptText` the thermal
 * printer uses, fetched on demand rather than with the list: it is plain text
 * per order, so loading one per row would be N requests for data nobody has
 * asked to see yet.
 *
 * Deliberately built on payments, not orders. A receipt only exists once money
 * has moved, so an order with no payment has nothing to show, and listing it
 * here would imply otherwise.
 */
export function ReceiptsPage() {
  const { t, locale } = useI18n();
  const { state: { tenant } } = useAuth();
  const slug = tenant?.slug;
  const money = (n: number) => formatPrice(n, locale);

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [method, setMethod] = useState<MethodFilter>('all');

  // The open receipt, kept separate from the list so closing it does not
  // refetch anything.
  const [viewing, setViewing] = useState<Payment | null>(null);
  const [body, setBody] = useState('');
  const [bodyState, setBodyState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    try { setPayments(await paymentApi.list(slug)); } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [slug]);
  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return payments
      // Only settled money has a receipt. A pending or failed attempt has
      // nothing to hand anyone.
      .filter((p) => p.status === 'paid' || p.status === 'refunded')
      .filter((p) => (method === 'all' ? true : p.method === method))
      .filter((p) => (q ? p.orderId.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) : true))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [payments, query, method]);

  const openReceipt = useCallback(async (p: Payment) => {
    if (!slug) return;
    setViewing(p);
    setBody('');
    setCopied(false);
    setBodyState('loading');
    try {
      setBody(await receiptApi.get(slug, p.orderId));
      setBodyState('ready');
    } catch {
      setBodyState('error');
    }
  }, [slug]);

  function printReceipt() {
    // Opening a window and writing the receipt into it keeps the browser's own
    // print dialog (and the user's printer choice) instead of inventing one.
    const w = window.open('', '_blank', 'width=380,height=640');
    if (!w) return;
    w.document.write(
      `<pre style="font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap">${
        body.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string))
      }</pre>`,
    );
    w.document.close();
    w.focus();
    w.print();
  }

  function downloadReceipt() {
    if (!viewing) return;
    const url = URL.createObjectURL(new Blob([body], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${viewing.orderId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyReceipt() {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked — the text is on screen to select */ }
  }

  const methods: MethodFilter[] = ['all', 'card', 'cash', 'wallet', 'crypto'];
  const methodLabel = (m: MethodFilter) =>
    m === 'all' ? t('receipts.allMethods')
      : m === 'card' ? t('payment.card')
        : m === 'cash' ? t('payment.cash')
          : m === 'wallet' ? t('payment.wallet')
            : t('payment.crypto');

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Receipt className="h-6 w-6 text-brand-500" /> {t('receipts.title')}
        </h1>
        <p className="text-sm text-gray-500 mt-1">{t('receipts.subtitle')}</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('receipts.searchPlaceholder')}
            className="w-full ps-9 pe-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-brand-500 focus:border-brand-500"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {methods.map((m) => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                method === m ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {methodLabel(m)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">{t('common.loading')}...</p>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white p-10 text-center">
          <Receipt className="h-8 w-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">{t('receipts.empty')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="text-start px-4 py-2.5 font-medium">{t('receipts.order')}</th>
                <th className="text-start px-4 py-2.5 font-medium">{t('common.date')}</th>
                <th className="text-start px-4 py-2.5 font-medium">{t('payment.method')}</th>
                <th className="text-end px-4 py-2.5 font-medium">{t('common.total')}</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => (
                <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-700">{p.orderId.slice(0, 8)}</td>
                  <td className="px-4 py-2.5 text-gray-600">{new Date(p.createdAt).toLocaleString(locale)}</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1.5 text-gray-700">
                      {methodLabel(p.method)}
                      {p.status === 'refunded' && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-700">
                          {t('receipts.refunded')}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-end font-semibold text-gray-900">
                    {money(p.amount + (p.tip || 0))}
                  </td>
                  <td className="px-4 py-2.5 text-end">
                    <button
                      onClick={() => openReceipt(p)}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                    >
                      {t('receipts.view')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={t('receipts.title')}>
          <div className="absolute inset-0 bg-black/50" onClick={() => setViewing(null)} aria-hidden />
          <div className="relative z-10 w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-card sm:rounded-card bg-white shadow-float">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <h2 className="font-semibold text-gray-900">{t('receipts.title')}</h2>
              <button onClick={() => setViewing(null)} aria-label={t('common.close')} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-5 py-4">
              {bodyState === 'loading' && <p className="text-sm text-gray-500">{t('common.loading')}...</p>}
              {bodyState === 'error' && <p className="text-sm text-red-600">{t('receipts.loadFailed')}</p>}
              {bodyState === 'ready' && (
                <pre className="whitespace-pre-wrap break-words rounded-lg bg-gray-50 p-4 font-mono text-xs text-gray-800">
                  {body}
                </pre>
              )}
            </div>

            {bodyState === 'ready' && (
              <div className="flex flex-wrap justify-end gap-2 border-t border-gray-200 px-5 py-4">
                <button onClick={copyReceipt} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  {copied ? t('common.copied') : t('common.copy')}
                </button>
                <button onClick={downloadReceipt} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">
                  <Download className="h-4 w-4" /> {t('receipts.download')}
                </button>
                <button onClick={printReceipt} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600">
                  <Printer className="h-4 w-4" /> {t('receipts.print')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
