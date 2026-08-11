import { useState } from 'react';
import { Link2, Copy, Check, Plus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { paymentApi } from '../../lib/api';
import { useI18n } from '../../contexts/I18nContext';

/**
 * Generate shareable Stripe payment links for catering, events, deposits, or
 * any off-table charge (qlub-style payment links). The collect/consume side
 * already lives at /pay/:token.
 */
export function PaymentLinks() {
  const { t } = useI18n();
  const slug = useAuth().state.tenant?.slug;
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [links, setLinks] = useState<{ url: string; amount: number; description: string; copied: boolean }[]>([]);

  async function generate() {
    const amt = parseFloat(amount);
    if (!slug || !amt || amt <= 0) { setError(t('paymentLinks.amountError')); return; }
    setBusy(true); setError('');
    try {
      const r = await paymentApi.createLink(slug, { amount: amt, description: description || undefined });
      const full = `${window.location.origin}${r.url}`;
      setLinks((prev) => [{ url: full, amount: amt, description: description || '—', copied: false }, ...prev]);
      setAmount(''); setDescription('');
    } catch (e) {
      setError((e as { message?: string }).message || 'Failed to create link');
    } finally { setBusy(false); }
  }

  function copy(i: number) {
    navigator.clipboard?.writeText(links[i].url);
    setLinks((prev) => prev.map((l, idx) => (idx === i ? { ...l, copied: true } : l)));
    setTimeout(() => setLinks((prev) => prev.map((l, idx) => (idx === i ? { ...l, copied: false } : l))), 1500);
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Link2 className="h-6 w-6 text-[#0f766e]" />
        <h1 className="text-2xl font-bold text-gray-900">{t('paymentLinks.title')}</h1>
      </div>
      <p className="text-sm text-gray-500">{t('paymentLinks.subtitle')}</p>

      <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
        {error && <div className="rounded-lg border-l-4 border-red-400 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <div className="grid sm:grid-cols-[8rem_1fr] gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('paymentLinks.amount')}</label>
            <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00" className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-[#0f766e] focus:border-[#0f766e]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('paymentLinks.description')}</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder={t('paymentLinks.descPlaceholder')} className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-[#0f766e] focus:border-[#0f766e]" />
          </div>
        </div>
        <button onClick={generate} disabled={busy}
          className="flex items-center gap-2 rounded-lg bg-[#0f766e] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1e3a5f] disabled:opacity-50">
          <Plus className="h-4 w-4" /> {busy ? '…' : t('paymentLinks.generate')}
        </button>
      </div>

      {links.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm divide-y divide-gray-100">
          {links.map((l, i) => (
            <div key={l.url} className="flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900">${l.amount.toFixed(2)} · <span className="text-gray-500">{l.description}</span></div>
                <div className="truncate text-xs text-[#0f766e]">{l.url}</div>
              </div>
              <button onClick={() => copy(i)} className="shrink-0 rounded-lg border border-gray-300 p-2 text-gray-500 hover:bg-gray-50" aria-label="Copy link">
                {l.copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
