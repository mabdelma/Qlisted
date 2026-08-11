import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../../lib/api';
import type { Mailbox, MailAlias } from '../../lib/api/types';
import { Plus, Trash2, KeyRound, Check, Power, Pencil, AtSign, ArrowRight, X, RefreshCw } from 'lucide-react';

const gen = () => 'Ql' + Math.random().toString(36).slice(2, 8) + Math.floor(10 + Math.random() * 89) + 'x!';
const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString() : '—');
const errMsg = (e: unknown) => (e as { message?: string })?.message || 'Action failed';

/**
 * Full email dashboard for the platform owner — mailboxes (create, edit name/quota,
 * reset password, enable/disable, delete) and aliases/forwarders, all backed by the
 * shared mailcow over the admin API. Scoped to the Qlisted mail domain.
 */
export function MailDashboard() {
  const [domain, setDomain] = useState('qlisted.com');
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [aliases, setAliases] = useState<MailAlias[]>([]);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ localPart: '', name: '', password: gen(), quotaMb: 1024 });
  const [aliasForm, setAliasForm] = useState({ localPart: '', goto: '' });
  const [editing, setEditing] = useState<string | null>(null);
  const [editVals, setEditVals] = useState({ name: '', quotaMb: 0 });

  const load = useCallback(async () => {
    try {
      const [mb, al] = await Promise.all([
        adminApi.listMailboxes(),
        adminApi.listAliases().catch(() => ({ domain: 'qlisted.com', aliases: [] as MailAlias[] })),
      ]);
      setMailboxes(mb.mailboxes);
      setDomain(mb.domain);
      setAliases(al.aliases);
      setErr('');
    } catch (e) {
      setErr(errMsg(e) || 'Email service unavailable');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function run(fn: () => Promise<unknown>, okMsg?: string) {
    setBusy(true); setErr(''); setMsg('');
    try {
      await fn();
      if (okMsg) setMsg(okMsg);
      await load();
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function createMailbox() {
    if (!form.localPart || form.password.length < 8) { setErr('Address + password (≥8 chars) required'); return; }
    const pw = form.password;
    const lp = form.localPart;
    await run(
      () => adminApi.createMailbox({ localPart: lp, name: form.name, password: pw, quotaMb: form.quotaMb }),
      `Created ${lp}@${domain} — password: ${pw}  (copy it now)`,
    );
    setForm({ localPart: '', name: '', password: gen(), quotaMb: 1024 });
  }

  async function resetPw(email: string) {
    const pw = window.prompt(`New password for ${email} (min 8 chars):`, gen());
    if (!pw) return;
    if (pw.length < 8) { setErr('Password must be at least 8 characters'); return; }
    await run(() => adminApi.setMailboxPassword(email, pw), `Password updated for ${email}.`);
  }

  function startEdit(m: Mailbox) { setEditing(m.username); setEditVals({ name: m.name, quotaMb: m.quotaMb }); }
  async function saveEdit(email: string) {
    await run(() => adminApi.editMailbox({ email, name: editVals.name, quotaMb: editVals.quotaMb }), `Updated ${email}.`);
    setEditing(null);
  }

  async function addAlias() {
    const local = aliasForm.localPart.trim().toLowerCase();
    const address = (!local || local === '*') ? `@${domain}` : `${local}@${domain}`;
    if (!aliasForm.goto.trim()) { setErr('Destination is required'); return; }
    await run(
      () => adminApi.createAlias({ address, goto: aliasForm.goto.trim() }),
      `Alias ${address} → ${aliasForm.goto.trim()} created.`,
    );
    setAliasForm({ localPart: '', goto: '' });
  }

  return (
    <div className="space-y-6">
      {err && <div className="rounded-lg border-l-4 border-red-400 bg-red-50 p-3 text-sm text-red-700">{err}</div>}
      {msg && (
        <div className="flex items-start gap-2 rounded-lg border-l-4 border-green-400 bg-green-50 p-3 text-sm text-green-800">
          <Check className="w-4 h-4 mt-0.5 shrink-0" /> <span className="font-mono break-all">{msg}</span>
        </div>
      )}

      {/* Create mailbox */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="flex items-center gap-2 font-semibold text-gray-900 mb-4"><Plus className="w-5 h-5 text-[#0f766e]" /> New mailbox</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="flex">
            <input value={form.localPart} onChange={(e) => setForm({ ...form, localPart: e.target.value.replace(/[^a-z0-9._-]/gi, '').toLowerCase() })}
              placeholder="name" className="w-full rounded-l-md border-gray-300 text-sm focus:border-[#0f766e] focus:ring-[#0f766e]" />
            <span className="inline-flex items-center px-2 text-sm text-gray-400 bg-gray-50 border border-l-0 border-gray-300 rounded-r-md">@{domain}</span>
          </div>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Display name" className="rounded-md border-gray-300 text-sm focus:border-[#0f766e] focus:ring-[#0f766e]" />
          <div className="flex">
            <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Password" className="w-full rounded-l-md border-gray-300 text-sm font-mono focus:border-[#0f766e] focus:ring-[#0f766e]" />
            <button type="button" onClick={() => setForm({ ...form, password: gen() })} title="Generate"
              className="inline-flex items-center px-2 border border-l-0 border-gray-300 rounded-r-md text-gray-500 hover:bg-gray-50"><RefreshCw className="w-4 h-4" /></button>
          </div>
          <div className="flex items-center gap-2">
            <input type="number" min={64} step={256} value={form.quotaMb} onChange={(e) => setForm({ ...form, quotaMb: parseInt(e.target.value) || 1024 })}
              className="w-24 rounded-md border-gray-300 text-sm focus:border-[#0f766e] focus:ring-[#0f766e]" />
            <span className="text-xs text-gray-400">MB</span>
            <button onClick={createMailbox} disabled={busy}
              className="ml-auto inline-flex items-center gap-1 rounded-md bg-[#0f766e] px-4 py-2 text-sm font-medium text-white hover:bg-[#1e3a5f] disabled:opacity-50">
              <Plus className="w-4 h-4" /> Create
            </button>
          </div>
        </div>
      </div>

      {/* Mailboxes table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Mailboxes @{domain} ({mailboxes.length})</h2>
        </div>
        {loading ? (
          <p className="p-6 text-gray-500 text-sm">Loading…</p>
        ) : mailboxes.length === 0 ? (
          <p className="p-6 text-gray-500 text-sm">No mailboxes yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-6 py-3 font-medium">Mailbox</th>
                  <th className="px-6 py-3 font-medium">Usage</th>
                  <th className="px-6 py-3 font-medium">Last login</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {mailboxes.map((m) => (
                  <tr key={m.username} className={m.active ? '' : 'opacity-50'}>
                    <td className="px-6 py-3">
                      {editing === m.username ? (
                        <input value={editVals.name} onChange={(e) => setEditVals({ ...editVals, name: e.target.value })}
                          className="rounded-md border-gray-300 text-sm py-1 focus:border-[#0f766e] focus:ring-[#0f766e]" />
                      ) : (
                        <div className="font-medium text-gray-900">{m.name || '—'}</div>
                      )}
                      <div className="font-mono text-xs text-gray-500">{m.username}{!m.active && ' · disabled'}</div>
                    </td>
                    <td className="px-6 py-3 text-gray-600">
                      {editing === m.username ? (
                        <span className="inline-flex items-center gap-1">
                          <input type="number" min={64} step={256} value={editVals.quotaMb} onChange={(e) => setEditVals({ ...editVals, quotaMb: parseInt(e.target.value) || 64 })}
                            className="w-20 rounded-md border-gray-300 text-sm py-1 focus:border-[#0f766e] focus:ring-[#0f766e]" /> MB
                        </span>
                      ) : (
                        <>
                          <div>{m.usedMb} / {m.quotaMb} MB</div>
                          <div className="text-xs text-gray-400">{m.messages} messages</div>
                        </>
                      )}
                    </td>
                    <td className="px-6 py-3 text-gray-500">{fmtDate(m.lastLogin)}</td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {editing === m.username ? (
                          <>
                            <button onClick={() => saveEdit(m.username)} disabled={busy} title="Save" className="p-1.5 text-green-600 hover:bg-green-50 rounded"><Check className="w-4 h-4" /></button>
                            <button onClick={() => setEditing(null)} title="Cancel" className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(m)} title="Edit name / quota" className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-gray-100 rounded"><Pencil className="w-4 h-4" /></button>
                            <button onClick={() => resetPw(m.username)} disabled={busy} title="Reset password" className="p-1.5 text-gray-400 hover:text-[#0f766e] hover:bg-gray-100 rounded"><KeyRound className="w-4 h-4" /></button>
                            <button onClick={() => run(() => adminApi.setMailboxActive(m.username, !m.active))} disabled={busy} title={m.active ? 'Disable' : 'Enable'} className={`p-1.5 rounded hover:bg-gray-100 ${m.active ? 'text-gray-400 hover:text-amber-600' : 'text-green-600'}`}><Power className="w-4 h-4" /></button>
                            <button onClick={() => { if (window.confirm(`Delete ${m.username}? This permanently removes the mailbox and all its mail.`)) run(() => adminApi.deleteMailbox(m.username), `Deleted ${m.username}.`); }} disabled={busy} title="Delete" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Aliases / forwarders */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="flex items-center gap-2 font-semibold text-gray-900 mb-1"><AtSign className="w-5 h-5 text-[#0f766e]" /> Aliases &amp; forwarders</h2>
        <p className="text-xs text-gray-400 mb-4">Forward an address to any inbox. Use <span className="font-mono">*</span> as the name for a catch-all (everything @{domain}).</p>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto] gap-2 items-center mb-4">
          <div className="flex">
            <input value={aliasForm.localPart} onChange={(e) => setAliasForm({ ...aliasForm, localPart: e.target.value })}
              placeholder="sales or *" className="w-full rounded-l-md border-gray-300 text-sm focus:border-[#0f766e] focus:ring-[#0f766e]" />
            <span className="inline-flex items-center px-2 text-sm text-gray-400 bg-gray-50 border border-l-0 border-gray-300 rounded-r-md">@{domain}</span>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-400 mx-auto hidden sm:block" />
          <input value={aliasForm.goto} onChange={(e) => setAliasForm({ ...aliasForm, goto: e.target.value })}
            placeholder={`inbox@${domain}`} className="rounded-md border-gray-300 text-sm focus:border-[#0f766e] focus:ring-[#0f766e]" />
          <button onClick={addAlias} disabled={busy}
            className="inline-flex items-center gap-1 rounded-md bg-[#0f766e] px-4 py-2 text-sm font-medium text-white hover:bg-[#1e3a5f] disabled:opacity-50">
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
        {aliases.length === 0 ? (
          <p className="text-gray-500 text-sm">No aliases yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {aliases.map((a) => (
              <div key={a.id} className="flex items-center gap-2 py-2 text-sm">
                <span className="font-mono text-gray-900">{a.address}</span>
                <ArrowRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="font-mono text-gray-600 truncate">{a.goto}</span>
                <button onClick={() => { if (window.confirm(`Delete alias ${a.address}?`)) run(() => adminApi.deleteAlias(a.id), `Deleted alias ${a.address}.`); }} disabled={busy}
                  className="ml-auto inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50 shrink-0">
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
