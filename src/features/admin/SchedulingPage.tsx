import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { schedulingApi, userApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import type { Shift, User } from '../../lib/api/types';

function mondayOf(iso: string) {
  const dt = new Date(iso + 'T00:00:00Z');
  const day = (dt.getUTCDay() + 6) % 7; // Mon=0
  dt.setUTCDate(dt.getUTCDate() - day);
  return dt.toISOString().slice(0, 10);
}
function addDays(iso: string, n: number) {
  const dt = new Date(iso + 'T00:00:00Z');
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

export function SchedulingPage() {
  const { t } = useI18n();
  const { state: { tenant } } = useAuth();
  const slug = tenant?.slug;
  const [weekStart, setWeekStart] = useState(mondayOf(new Date().toISOString().slice(0, 10)));
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [staff, setStaff] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ userId: '', date: weekStart, startTime: '09:00', endTime: '17:00', role: '' });

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const [sh, st] = await Promise.all([schedulingApi.list(slug, weekStart), userApi.list(slug).catch(() => [] as User[])]);
      setShifts(sh); setStaff(st); setError('');
    } catch (e) { setError((e as { message?: string }).message || t('error.generic')); }
    finally { setLoading(false); }
  }, [slug, weekStart, t]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setForm((f) => ({ ...f, date: weekStart })); }, [weekStart]);

  async function addShift() {
    if (!slug || !form.userId) return;
    try { await schedulingApi.create(slug, form); await load(); }
    catch (e) { setError((e as { message?: string }).message || t('error.generic')); }
  }
  async function del(id: string) {
    if (!slug) return;
    try { await schedulingApi.delete(slug, id); await load(); } catch { /* ignore */ }
  }

  const dow = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">{t('scheduling.title')}</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="p-2 rounded-lg border hover:bg-gray-50"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={() => setWeekStart(mondayOf(new Date().toISOString().slice(0, 10)))} className="px-3 py-2 rounded-lg border text-sm hover:bg-gray-50">{t('scheduling.thisWeek')}</button>
          <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="p-2 rounded-lg border hover:bg-gray-50"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>
      {error && <div className="bg-red-50 border-l-4 border-red-400 p-3 text-sm text-red-700">{error}</div>}

      {/* Add shift */}
      <div className="bg-white rounded-lg shadow p-4 grid grid-cols-2 md:grid-cols-6 gap-2">
        <select value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} className="col-span-2 rounded-md border-gray-300 text-sm">
          <option value="">{t('scheduling.staff')}…</option>
          {staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="rounded-md border-gray-300 text-sm">
          {days.map((d, i) => <option key={d} value={d}>{dow[i]} {d.slice(5)}</option>)}
        </select>
        <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="rounded-md border-gray-300 text-sm" />
        <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="rounded-md border-gray-300 text-sm" />
        <button onClick={addShift} disabled={!form.userId} className="flex items-center justify-center gap-1 bg-[#0f766e] text-white rounded-md text-sm hover:bg-[#1e3a5f] disabled:opacity-50"><Plus className="w-4 h-4" /> {t('scheduling.addShift')}</button>
      </div>

      {/* Week grid */}
      {loading ? <p className="text-gray-500">{t('common.loading')}...</p> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
          {days.map((d, i) => {
            const dayShifts = shifts.filter((s) => s.date === d).sort((a, b) => a.startTime.localeCompare(b.startTime));
            return (
              <div key={d} className="bg-white rounded-lg shadow p-3 min-h-[120px]">
                <div className="text-xs font-semibold text-gray-700 mb-2">{dow[i]} <span className="text-gray-400">{d.slice(5)}</span></div>
                <div className="space-y-2">
                  {dayShifts.length === 0 ? <p className="text-[11px] text-gray-300">—</p> : dayShifts.map((s) => (
                    <div key={s.id} className="group bg-[#ccfbf1]/30 rounded p-2 text-xs">
                      <div className="flex items-start justify-between">
                        <span className="font-medium text-gray-800">{s.userName || '—'}</span>
                        <button onClick={() => del(s.id)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                      </div>
                      <span className="text-gray-500">{s.startTime}–{s.endTime}</span>
                      {s.role && <span className="block text-[10px] text-[#0f766e]">{s.role}</span>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
