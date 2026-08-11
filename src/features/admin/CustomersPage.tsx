import { useState, useEffect, useCallback } from 'react';
import { Search, X, Crown, UserMinus, Sparkles, Send } from 'lucide-react';
import { customerApi, marketingApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { formatPrice } from '../../lib/pricing';
import type { Customer } from '../../lib/api/types';

type Segment = 'all' | 'vip' | 'atRisk' | 'new';

export function CustomersPage() {
  const { t, locale } = useI18n();
  const { state: { tenant } } = useAuth();
  const slug = tenant?.slug;
  const money = (n: number) => formatPrice(n, locale);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [seg, setSeg] = useState<Segment>('all');
  const [editing, setEditing] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const [campaign, setCampaign] = useState<{ subject: string; message: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [sentInfo, setSentInfo] = useState('');

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    try { setCustomers(await customerApi.list(slug)); } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [slug]);
  useEffect(() => { load(); }, [load]);

  const daysSince = (d?: string | null) => (d ? (Date.now() - new Date(d).getTime()) / 86400000 : Infinity);
  const inSegment = (c: Customer) => {
    if (seg === 'vip') return Number(c.totalSpent) >= 200 || (c.totalVisits || 0) >= 5;
    if (seg === 'atRisk') return (c.totalVisits || 0) >= 2 && daysSince(c.lastVisit) > 30;
    if (seg === 'new') return (c.totalVisits || 0) <= 1 || daysSince(c.createdAt) <= 30;
    return true;
  };
  const filtered = customers.filter(inSegment).filter((c) => {
    const q = query.toLowerCase().trim();
    return !q || [c.name, c.email, c.phone].some((f) => (f || '').toLowerCase().includes(q));
  });

  const segs: { id: Segment; label: string; icon?: typeof Crown }[] = [
    { id: 'all', label: t('menu.categoryAll') },
    { id: 'vip', label: t('crm.vip'), icon: Crown },
    { id: 'atRisk', label: t('analytics.atRisk'), icon: UserMinus },
    { id: 'new', label: t('crm.new'), icon: Sparkles },
  ];

  async function sendCampaign() {
    if (!slug || !campaign) return;
    const target = (seg === 'new' ? 'all' : seg) as 'all' | 'vip' | 'atRisk';
    setSending(true); setSentInfo('');
    try {
      const r = await marketingApi.sendCampaign(slug, { segment: target, subject: campaign.subject, message: campaign.message });
      setSentInfo(t('crm.campaignSent', { sent: r.sent }));
      setCampaign(null);
    } catch (e) { setSentInfo((e as { message?: string }).message || t('error.generic')); }
    finally { setSending(false); }
  }

  async function save() {
    if (!slug || !editing) return;
    setSaving(true);
    try {
      await customerApi.update(slug, editing.id, { name: editing.name, email: editing.email || undefined, phone: editing.phone || undefined, notes: editing.notes || undefined });
      setEditing(null); await load();
    } catch { /* ignore */ } finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-gray-900">{t('nav.customers')}</h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('common.search')}
              className="pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-[#0f766e] focus:border-[#0f766e]" />
          </div>
          <button onClick={() => { setSentInfo(''); setCampaign({ subject: '', message: '' }); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0f766e] text-white text-sm hover:bg-[#1e3a5f]">
            <Send className="w-4 h-4" /> {t('crm.emailSegment')}
          </button>
        </div>
      </div>
      {sentInfo && <div className="bg-green-50 border-l-4 border-green-400 p-3 text-sm text-green-700">{sentInfo}</div>}

      <div className="flex gap-2 flex-wrap">
        {segs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setSeg(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm ${seg === id ? 'bg-[#0f766e] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {Icon && <Icon className="w-3.5 h-3.5" />}{label}
          </button>
        ))}
      </div>

      {loading ? <p className="text-gray-500">{t('common.loading')}...</p> : filtered.length === 0 ? (
        <p className="bg-white rounded-lg shadow p-6 text-center text-gray-500 text-sm">{t('crm.noCustomers')}</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr>
              <th className="text-left p-3">{t('common.name')}</th>
              <th className="text-left p-3 hidden sm:table-cell">{t('common.email')}</th>
              <th className="text-right p-3">{t('crm.spent')}</th>
              <th className="text-right p-3">{t('crm.visits')}</th>
              <th className="text-right p-3">{t('loyalty.points')}</th>
            </tr></thead>
            <tbody>{filtered.map((c) => (
              <tr key={c.id} onClick={() => setEditing(c)} className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer">
                <td className="p-3 font-medium text-gray-800">{c.name || '—'}{Number(c.totalSpent) >= 200 && <Crown className="inline w-3.5 h-3.5 text-amber-500 ml-1" />}</td>
                <td className="p-3 text-gray-500 hidden sm:table-cell">{c.email || c.phone || '—'}</td>
                <td className="p-3 text-right font-medium">{money(Number(c.totalSpent || 0))}</td>
                <td className="p-3 text-right text-gray-500">{c.totalVisits || 0}</td>
                <td className="p-3 text-right text-gray-500">{c.loyaltyPoints || 0}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{editing.name}</h3>
              <button onClick={() => setEditing(null)}><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="bg-gray-50 rounded p-2"><p className="text-xs text-gray-500">{t('crm.spent')}</p><p className="font-bold">{money(Number(editing.totalSpent || 0))}</p></div>
              <div className="bg-gray-50 rounded p-2"><p className="text-xs text-gray-500">{t('loyalty.points')}</p><p className="font-bold">{editing.loyaltyPoints || 0}</p></div>
              <div className="bg-gray-50 rounded p-2"><p className="text-xs text-gray-500">{t('analytics.lastVisit')}</p><p className="font-bold text-xs">{editing.lastVisit ? new Date(editing.lastVisit).toLocaleDateString() : '—'}</p></div>
            </div>
            <div><label className="block text-sm font-medium text-gray-700">{t('common.name')}</label>
              <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 text-sm" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-gray-700">{t('common.email')}</label>
                <input value={editing.email || ''} onChange={(e) => setEditing({ ...editing, email: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 text-sm" /></div>
              <div><label className="block text-sm font-medium text-gray-700">{t('common.phone')}</label>
                <input value={editing.phone || ''} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 text-sm" /></div>
            </div>
            <div><label className="block text-sm font-medium text-gray-700">{t('common.notes')}</label>
              <textarea value={editing.notes || ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} rows={3} className="mt-1 block w-full rounded-md border-gray-300 text-sm" /></div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50">{t('common.cancel')}</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 bg-[#0f766e] text-white rounded-md hover:bg-[#1e3a5f] disabled:opacity-50">{t('common.save')}</button>
            </div>
          </div>
        </div>
      )}

      {campaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setCampaign(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2"><Send className="w-4 h-4 text-[#0f766e]" /> {t('crm.emailSegment')}</h3>
              <button onClick={() => setCampaign(null)}><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <p className="text-xs text-gray-500">→ {segs.find((s) => s.id === (seg === 'new' ? 'all' : seg))?.label}</p>
            <input value={campaign.subject} onChange={(e) => setCampaign({ ...campaign, subject: e.target.value })} placeholder={t('contact.formSubject')} className="block w-full rounded-md border-gray-300 text-sm" />
            <textarea value={campaign.message} onChange={(e) => setCampaign({ ...campaign, message: e.target.value })} rows={5} placeholder={t('contact.formMessage')} className="block w-full rounded-md border-gray-300 text-sm" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setCampaign(null)} className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50">{t('common.cancel')}</button>
              <button onClick={sendCampaign} disabled={sending || !campaign.subject.trim() || !campaign.message.trim()}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#0f766e] text-white rounded-md hover:bg-[#1e3a5f] disabled:opacity-50">
                <Send className="w-4 h-4" /> {sending ? `${t('common.loading')}...` : t('crm.send')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
