import { useState, useEffect, useCallback } from 'react';
import { CalendarDays, Clock, User, Users, Phone, Mail, Edit, Trash2, Table as TableIcon } from 'lucide-react';
import { reservationApi, tableApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n, type TranslationKey } from '../../contexts/I18nContext';
import type { Reservation, TableData } from '../../lib/api/types';

const STATUS_OPTIONS = ['pending', 'confirmed', 'seated', 'cancelled', 'no_show'] as const;

export function ReservationManagement() {
  const { t } = useI18n();
  const { state: { tenant } } = useAuth();
  const slug = tenant?.slug;
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<TableData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterStatus, setFilterStatus] = useState('');
  const [editing, setEditing] = useState<Partial<Reservation> | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchReservations = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const data = await reservationApi.list(slug, filterDate, filterStatus || undefined);
      setReservations(data);
    } catch {
      setError('Failed to load reservations');
    }
    setLoading(false);
  }, [slug, filterDate, filterStatus]);

  const fetchTables = useCallback(async () => {
    if (!slug) return;
    try {
      const data = await tableApi.list(slug);
      setTables(data);
    } catch { /* tables are optional for the view */ }
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    fetchReservations();
    fetchTables();
  }, [slug, fetchReservations, fetchTables]);

  function resetForm() {
    setEditing(null);
    setEditingId(null);
  }

  function startEdit(reservation?: Reservation) {
    if (reservation) {
      setEditingId(reservation.id);
      setEditing({ ...reservation });
    } else {
      setEditingId(null);
      setEditing({
        customerName: '',
        customerEmail: '',
        customerPhone: '',
        partySize: 2,
        date: filterDate,
        time: '19:00',
        duration: 90,
        notes: '',
        specialRequests: '',
      });
    }
  }

  async function saveReservation(e: React.FormEvent) {
    e.preventDefault();
    if (!slug || !editing) return;
    try {
      if (editingId) {
        await reservationApi.update(slug, editingId, {
          customerName: editing.customerName,
          customerEmail: editing.customerEmail,
          customerPhone: editing.customerPhone,
          partySize: editing.partySize || 2,
          date: editing.date,
          time: editing.time,
          notes: editing.notes,
          specialRequests: editing.specialRequests,
        });
      } else {
        await reservationApi.create(slug, {
          customerName: editing.customerName || '',
          customerEmail: editing.customerEmail,
          customerPhone: editing.customerPhone,
          partySize: editing.partySize || 2,
          date: editing.date || filterDate,
          time: editing.time || '19:00',
          duration: editing.duration || 90,
          notes: editing.notes,
          specialRequests: editing.specialRequests,
        });
      }
      resetForm();
      await fetchReservations();
    } catch {
      setError('Failed to save reservation');
    }
  }

  async function changeStatus(reservationId: string, status: string) {
    if (!slug) return;
    try {
      await reservationApi.updateStatus(slug, reservationId, status);
      setReservations((prev) => prev.map((r) => r.id === reservationId ? { ...r, status: status as Reservation['status'] } : r));
    } catch {
      setError('Failed to update status');
    }
  }

  async function handleAssignTable(reservationId: string, tableId: string) {
    if (!slug) return;
    try {
      const result = await reservationApi.assignTable(slug, reservationId, tableId);
      if (result.success) {
        setReservations((prev) => prev.map((r) => r.id === reservationId ? { ...r, tableId, status: 'confirmed' } : r));
      }
    } catch {
      setError('Failed to assign table');
    }
  }

  async function deleteReservation(id: string) {
    if (!slug || !window.confirm('Delete this reservation?')) return;
    try {
      await reservationApi.delete(slug, id);
      setReservations((prev) => prev.filter((r) => r.id !== id));
    } catch {
      setError('Failed to delete reservation');
    }
  }

  function statusBadge(status: string) {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-blue-100 text-blue-800',
      seated: 'bg-green-100 text-green-800',
      cancelled: 'bg-gray-200 text-gray-600',
      no_show: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-600';
  }

  const statusLabel = (s: string) => t(`reservations.${s === 'no_show' ? 'noShow' : s}` as TranslationKey);

  if (!slug) return <div className="p-4 text-gray-500">{t('common.loading')}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">{t('reservations.title')}</h2>
        <div className="flex gap-3 items-center">
          <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)}
            className="rounded-md border-gray-300 shadow-sm text-sm focus:border-[#0f766e] focus:ring-[#0f766e]" />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-md border-gray-300 shadow-sm text-sm focus:border-[#0f766e] focus:ring-[#0f766e]">
            <option value="">{t('reservations.allStatuses')}</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>
          <button onClick={() => startEdit()}
            className="flex items-center px-4 py-2 bg-[#0f766e] text-white rounded-md hover:bg-[#1e3a5f] text-sm">
            <CalendarDays className="w-4 h-4 mr-2" /> {t('reservations.newReservation')}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">{t('common.loading')}</div>
      ) : reservations.length === 0 ? (
        <div className="text-center py-12 text-gray-500">{t('reservations.noReservations')}</div>
      ) : (
        <div className="space-y-3">
          {reservations.map((res) => {
            const table = tables.find((t) => t.id === res.tableId);
            return (
              <div key={res.id} className="bg-white rounded-lg shadow p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="bg-[#0f766e]/10 p-3 rounded-full">
                      <User className="w-5 h-5 text-[#0f766e]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{res.customerName}</h3>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-gray-500">
                        <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{t('reservations.guests', { count: res.partySize })}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{res.time} ({t('reservations.minutes', { count: res.duration })})</span>
                        {res.customerEmail && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{res.customerEmail}</span>}
                        {res.customerPhone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{res.customerPhone}</span>}
                        {table && <span className="flex items-center gap-1"><TableIcon className="w-3.5 h-3.5" />Table {table.number}</span>}
                      </div>
                      {res.specialRequests && (
                        <p className="mt-1 text-xs text-gray-400 italic">"{res.specialRequests}"</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(res.status)}`}>
                      {statusLabel(res.status)}
                    </span>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <select
                      value={res.tableId || ''}
                      onChange={(e) => e.target.value && handleAssignTable(res.id, e.target.value)}
                      className="text-xs rounded border-gray-200 py-1 focus:border-[#0f766e] focus:ring-[#0f766e]">
                      <option value="">{t('reservations.assignTable')}</option>
                      {tables.filter((tb) => tb.status === 'available' || tb.id === res.tableId).map((tb) => (
                        <option key={tb.id} value={tb.id}>Table {tb.number} (cap. {tb.capacity})</option>
                      ))}
                    </select>
                    <select
                      value={res.status}
                      onChange={(e) => changeStatus(res.id, e.target.value)}
                      className="text-xs rounded border-gray-200 py-1 focus:border-[#0f766e] focus:ring-[#0f766e]">
                      {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => startEdit(res)} className="p-1.5 text-gray-400 hover:text-indigo-600"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => deleteReservation(res.id)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-gray-600/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md" role="dialog" aria-label={editingId ? 'Edit reservation' : 'New reservation'}>
            <h3 className="text-xl font-semibold mb-4">{editingId ? t('reservations.edit') : t('reservations.create')}</h3>
            <form onSubmit={saveReservation} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('reservations.customerName')}</label>
                <input type="text" required value={editing.customerName || ''} onChange={(e) => setEditing({ ...editing, customerName: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('reservations.email')}</label>
                  <input type="email" value={editing.customerEmail || ''} onChange={(e) => setEditing({ ...editing, customerEmail: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('reservations.phone')}</label>
                  <input type="tel" value={editing.customerPhone || ''} onChange={(e) => setEditing({ ...editing, customerPhone: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('reservations.partySize')}</label>
                <input type="number" min="1" required value={editing.partySize || 2} onChange={(e) => setEditing({ ...editing, partySize: parseInt(e.target.value) || 2 })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('reservations.date')}</label>
                  <input type="date" required value={editing.date || filterDate} onChange={(e) => setEditing({ ...editing, date: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('reservations.time')}</label>
                  <input type="time" required value={editing.time || '19:00'} onChange={(e) => setEditing({ ...editing, time: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('reservations.specialRequests')}</label>
                <textarea value={editing.specialRequests || ''} onChange={(e) => setEditing({ ...editing, specialRequests: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]" rows={2} />
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button type="button" onClick={resetForm}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">{t('common.cancel')}</button>
                <button type="submit" className="px-4 py-2 bg-[#0f766e] text-white rounded-md hover:bg-[#1e3a5f]">{t('common.save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
