import { useState, useEffect, useCallback } from 'react';
import { Plus, X, BedDouble, Hotel, LogIn, LogOut, Ban, User as UserIcon, ChevronLeft, ChevronRight, Receipt, Trash2, RefreshCw, Check, CreditCard } from 'lucide-react';
import { hotelApi, userApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { formatPrice } from '../../lib/pricing';
import type { Room, RoomStatus, RoomStats, RoomBooking, BookingStatus, Folio, HotelReport, User } from '../../lib/api/types';

const STATUSES: RoomStatus[] = ['available', 'occupied', 'reserved', 'cleaning', 'maintenance'];

const BOOKING_STYLE: Record<BookingStatus, string> = {
  booked: 'bg-amber-100 text-amber-800',
  checked_in: 'bg-blue-100 text-blue-800',
  checked_out: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-700 line-through',
};

const STATUS_STYLE: Record<RoomStatus, string> = {
  available: 'bg-green-50 border-green-300 text-green-800',
  occupied: 'bg-blue-50 border-blue-300 text-blue-800',
  reserved: 'bg-amber-50 border-amber-300 text-amber-800',
  cleaning: 'bg-purple-50 border-purple-300 text-purple-800',
  maintenance: 'bg-gray-100 border-gray-300 text-gray-700',
};
const DOT: Record<RoomStatus, string> = {
  available: 'bg-green-500',
  occupied: 'bg-blue-500',
  reserved: 'bg-amber-500',
  cleaning: 'bg-purple-500',
  maintenance: 'bg-gray-400',
};

export function RoomsPage() {
  const { t, locale } = useI18n();
  const { state: { tenant } } = useAuth();
  const slug = tenant?.slug;
  const money = (n: number) => formatPrice(n, locale);
  const rsUrl = (token: string) => `${window.location.origin}/r/${slug ?? ''}/room/${token}`;

  const [rooms, setRooms] = useState<Room[]>([]);
  const [stats, setStats] = useState<RoomStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<RoomStatus | 'all'>('all');
  const [editing, setEditing] = useState<Room | null>(null);
  const [creating, setCreating] = useState<{ number: string; type: string; floor: string; rate: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<'rooms' | 'bookings' | 'calendar' | 'report'>('rooms');
  const [calRef, setCalRef] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [reportRange, setReportRange] = useState(() => {
    const now = new Date(); const first = new Date(now.getFullYear(), now.getMonth(), 1); const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { from: first.toISOString().slice(0, 10), to: next.toISOString().slice(0, 10) };
  });
  const [report, setReport] = useState<HotelReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [staff, setStaff] = useState<User[]>([]);
  const staffName = (id?: string | null) => staff.find((u) => u.id === id)?.name;

  useEffect(() => { if (slug) userApi.list(slug).then(setStaff).catch(() => { /* ignore */ }); }, [slug]);
  const [bookings, setBookings] = useState<RoomBooking[]>([]);
  const [booking, setBooking] = useState<{ roomId: string; guestName: string; guestEmail: string; guestPhone: string; checkIn: string; checkOut: string } | null>(null);
  const [bookingError, setBookingError] = useState('');
  const [availRooms, setAvailRooms] = useState<Room[] | null>(null);
  const [folioFor, setFolioFor] = useState<string | null>(null);
  const [folioData, setFolioData] = useState<Folio | null>(null);
  const [folioLine, setFolioLine] = useState({ description: '', amount: '' });
  const today = new Date().toISOString().slice(0, 10);
  const arrivals = bookings.filter((b) => b.status === 'booked' && b.checkIn === today);
  const departures = bookings.filter((b) => b.status === 'checked_in' && b.checkOut === today);
  const bookedRevenue = bookings.filter((b) => b.status !== 'cancelled').reduce((sum, b) => sum + (b.total || 0), 0);

  // When the booking's dates are set, offer only rooms free for that window.
  const bChkIn = booking?.checkIn, bChkOut = booking?.checkOut;
  useEffect(() => {
    if (!slug || !bChkIn || !bChkOut || bChkOut <= bChkIn) { setAvailRooms(null); return; }
    let cancelled = false;
    hotelApi.available(slug, bChkIn, bChkOut).then((r) => { if (!cancelled) setAvailRooms(r); }).catch(() => { /* ignore */ });
    return () => { cancelled = true; };
  }, [slug, bChkIn, bChkOut]);

  const roomOptions = availRooms ?? rooms;
  const selRoom = booking ? rooms.find((r) => r.id === booking.roomId) : undefined;
  const bNights = booking && booking.checkIn && booking.checkOut && booking.checkOut > booking.checkIn
    ? Math.max(1, Math.round((new Date(booking.checkOut + 'T00:00:00Z').getTime() - new Date(booking.checkIn + 'T00:00:00Z').getTime()) / 86400000)) : 0;
  const bTotal = selRoom && bNights ? selRoom.rate * bNights : 0;

  // Occupancy calendar (client-side from the loaded bookings)
  const daysInMonth = new Date(calRef.y, calRef.m + 1, 0).getDate();
  const calPad = (n: number) => String(n).padStart(2, '0');
  const calDate = (day: number) => `${calRef.y}-${calPad(calRef.m + 1)}-${calPad(day)}`;
  const activeBookings = bookings.filter((b) => b.status !== 'cancelled');
  const bookingOn = (roomId: string, ds: string) => activeBookings.find((b) => b.roomId === roomId && b.checkIn <= ds && ds < b.checkOut);
  const monthLabel = new Date(calRef.y, calRef.m, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const shiftMonth = (delta: number) => setCalRef(({ y, m }) => { const d = new Date(y, m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const CAL_FILL: Record<BookingStatus, string> = { booked: 'bg-amber-300', checked_in: 'bg-blue-400', checked_out: 'bg-gray-300', cancelled: '' };

  const statusLabel = (s: RoomStatus) => t(`hotel.status.${s}`);
  const bookingLabel = (s: BookingStatus) => t(`hotel.bookingStatus.${s}`);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const [r, s, b] = await Promise.all([hotelApi.list(slug), hotelApi.stats(slug), hotelApi.listBookings(slug)]);
      setRooms(r); setStats(s); setBookings(b);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [slug]);
  useEffect(() => { load(); }, [load]);

  async function saveBooking() {
    if (!slug || !booking || !booking.roomId || !booking.guestName.trim() || !booking.checkIn || !booking.checkOut) return;
    setSaving(true); setBookingError('');
    try {
      await hotelApi.createBooking(slug, {
        roomId: booking.roomId, guestName: booking.guestName,
        guestEmail: booking.guestEmail || undefined, guestPhone: booking.guestPhone || undefined,
        checkIn: booking.checkIn, checkOut: booking.checkOut,
      });
      setBooking(null); await load();
    } catch (e) { setBookingError((e as { message?: string }).message || t('error.generic')); }
    finally { setSaving(false); }
  }

  async function runReport() {
    if (!slug) return;
    setReportLoading(true);
    try { setReport(await hotelApi.report(slug, reportRange.from, reportRange.to)); }
    catch { /* ignore */ } finally { setReportLoading(false); }
  }

  async function openFolio(id: string) {
    if (!slug) return;
    setFolioFor(id); setFolioData(null); setFolioLine({ description: '', amount: '' });
    try { setFolioData(await hotelApi.getFolio(slug, id)); } catch { /* ignore */ }
  }
  async function addFolioLine() {
    if (!slug || !folioFor || !folioLine.description.trim()) return;
    setSaving(true);
    try {
      await hotelApi.addFolioItem(slug, folioFor, { description: folioLine.description, amount: Number(folioLine.amount) || 0 });
      setFolioLine({ description: '', amount: '' });
      setFolioData(await hotelApi.getFolio(slug, folioFor));
    } catch { /* ignore */ } finally { setSaving(false); }
  }
  async function deleteFolioLine(id: string) {
    if (!slug || !folioFor) return;
    try { await hotelApi.deleteFolioItem(slug, id); setFolioData(await hotelApi.getFolio(slug, folioFor)); } catch { /* ignore */ }
  }
  async function openPayLink() {
    if (!slug || !folioFor) return;
    try { const { url } = await hotelApi.folioPayLink(slug, folioFor); window.open(url, '_blank', 'noopener'); } catch { /* ignore */ }
  }
  async function markSettled() {
    if (!slug || !folioFor) return;
    setSaving(true);
    try { await hotelApi.settleFolio(slug, folioFor); setFolioData(await hotelApi.getFolio(slug, folioFor)); }
    catch { /* ignore */ } finally { setSaving(false); }
  }
  async function takeDeposit() {
    if (!slug || !folioFor) return;
    try { const { url } = await hotelApi.takeDeposit(slug, folioFor); window.open(url, '_blank', 'noopener'); setFolioData(await hotelApi.getFolio(slug, folioFor)); }
    catch { /* ignore */ }
  }

  async function bookingAction(id: string, action: 'check-in' | 'check-out' | 'cancel') {
    if (!slug) return;
    try {
      if (action === 'check-in') await hotelApi.checkIn(slug, id);
      else if (action === 'check-out') await hotelApi.checkOut(slug, id);
      else await hotelApi.cancelBooking(slug, id);
    } catch { /* ignore */ }
    await load();
  }

  const shown = rooms.filter((r) => filter === 'all' || r.status === filter);

  async function setStatus(room: Room, status: RoomStatus) {
    if (!slug || room.status === status) return;
    setRooms((prev) => prev.map((r) => (r.id === room.id ? { ...r, status } : r)));
    try { await hotelApi.setStatus(slug, room.id, status); } catch { /* ignore */ }
    await load();
  }

  async function create() {
    if (!slug || !creating?.number.trim()) return;
    setSaving(true);
    try {
      await hotelApi.create(slug, { number: creating.number, type: creating.type || undefined, floor: creating.floor || undefined, rate: Number(creating.rate) || 0 });
      setCreating(null); await load();
    } catch { /* ignore */ } finally { setSaving(false); }
  }

  async function saveEdit() {
    if (!slug || !editing) return;
    setSaving(true);
    try {
      await hotelApi.update(slug, editing.id, { number: editing.number, type: editing.type || undefined, floor: editing.floor || undefined, rate: Number(editing.rate) || 0, housekeeperId: editing.housekeeperId || null, notes: editing.notes || undefined });
      if (editing.status !== 'available') await hotelApi.setStatus(slug, editing.id, editing.status, editing.guestName || undefined);
      setEditing(null); await load();
    } catch { /* ignore */ } finally { setSaving(false); }
  }

  async function regenToken() {
    if (!slug || !editing) return;
    setSaving(true);
    try {
      const { serviceToken } = await hotelApi.regenerateToken(slug, editing.id);
      setEditing({ ...editing, serviceToken });
      await load();
    } catch { /* ignore */ } finally { setSaving(false); }
  }

  async function remove() {
    if (!slug || !editing) return;
    setSaving(true);
    try { await hotelApi.delete(slug, editing.id); setEditing(null); await load(); }
    catch { /* ignore */ } finally { setSaving(false); }
  }

  const statCards: { key: RoomStatus | 'occupancy'; value: number; label: string }[] = stats ? [
    { key: 'occupancy', value: stats.occupancy, label: t('hotel.occupancy') },
    { key: 'available', value: stats.available, label: statusLabel('available') },
    { key: 'occupied', value: stats.occupied, label: statusLabel('occupied') },
    { key: 'cleaning', value: stats.cleaning, label: statusLabel('cleaning') },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Hotel className="w-6 h-6 text-[#0f766e]" /> {t('hotel.title')}</h2>
        <div className="flex items-center gap-2">
        <button onClick={() => slug && navigator.clipboard?.writeText(`${window.location.origin}/r/${slug}/book`)}
          title={`${window.location.origin}/r/${slug ?? ''}/book`}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-50">
          <BedDouble className="w-4 h-4" /> {t('book.title')}
        </button>
        {view === 'rooms' && (
          <button onClick={() => setCreating({ number: '', type: '', floor: '', rate: '' })}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0f766e] text-white text-sm hover:bg-[#1e3a5f]">
            <Plus className="w-4 h-4" /> {t('hotel.addRoom')}
          </button>
        )}
        {view !== 'rooms' && (
          <button onClick={() => { setBookingError(''); setBooking({ roomId: '', guestName: '', guestEmail: '', guestPhone: '', checkIn: '', checkOut: '' }); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0f766e] text-white text-sm hover:bg-[#1e3a5f]">
            <Plus className="w-4 h-4" /> {t('hotel.addBooking')}
          </button>
        )}
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {(['rooms', 'bookings', 'calendar', 'report'] as const).map((v) => (
          <button key={v} onClick={() => setView(v)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${view === v ? 'border-[#0f766e] text-[#0f766e]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {v === 'rooms' ? t('hotel.title') : v === 'bookings' ? t('hotel.bookings') : v === 'calendar' ? t('hotel.calendar') : t('hotel.report')}
          </button>
        ))}
      </div>

      {view === 'rooms' && stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {statCards.map((s) => (
            <div key={s.key} className="bg-white rounded-lg shadow p-4">
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className="text-2xl font-bold text-gray-900">{s.value}{s.key === 'occupancy' ? '%' : ''}</p>
            </div>
          ))}
        </div>
      )}

      {view === 'rooms' && (
        <div className="flex gap-2 flex-wrap">
          {(['all', ...STATUSES] as const).map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm ${filter === s ? 'bg-[#0f766e] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {s !== 'all' && <span className={`w-2 h-2 rounded-full ${DOT[s]}`} />}
              {s === 'all' ? t('menu.categoryAll') : statusLabel(s)}
            </button>
          ))}
        </div>
      )}

      {view === 'rooms' && (loading ? <p className="text-gray-500">{t('common.loading')}...</p> : shown.length === 0 ? (
        <p className="bg-white rounded-lg shadow p-6 text-center text-gray-500 text-sm">{t('hotel.noRooms')}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {shown.map((room) => (
            <div key={room.id} className={`rounded-xl border p-4 ${STATUS_STYLE[room.status]}`}>
              <div className="flex items-start justify-between">
                <button onClick={() => setEditing(room)} className="text-left">
                  <p className="font-bold text-lg flex items-center gap-1.5"><BedDouble className="w-4 h-4" /> {room.number}</p>
                  <p className="text-xs opacity-80">{room.type || t('hotel.room')}{room.floor ? ` · ${t('hotel.floor')} ${room.floor}` : ''}{room.rate ? ` · ${money(room.rate)}` : ''}</p>
                </button>
              </div>
              {room.guestName && <p className="text-xs mt-1 font-medium truncate">{room.guestName}</p>}
              {room.status === 'cleaning' && staffName(room.housekeeperId) && <p className="text-xs mt-1 opacity-80 truncate">🧹 {staffName(room.housekeeperId)}</p>}
              <select value={room.status} onChange={(e) => setStatus(room, e.target.value as RoomStatus)}
                className="mt-3 w-full text-xs rounded-md border-0 bg-white/70 py-1.5 font-medium focus:ring-1 focus:ring-[#0f766e]">
                {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
              </select>
            </div>
          ))}
        </div>
      ))}

      {view === 'bookings' && (
        <div className="space-y-4">
        {bookings.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-xs text-gray-500 flex items-center gap-1"><LogIn className="w-3.5 h-3.5" /> {t('hotel.arrivalsToday')}</p>
              <p className="text-2xl font-bold text-gray-900">{arrivals.length}</p>
              {arrivals.length > 0 && <p className="text-xs text-gray-500 mt-1 truncate">{arrivals.map((a) => a.guestName).join(', ')}</p>}
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-xs text-gray-500 flex items-center gap-1"><LogOut className="w-3.5 h-3.5" /> {t('hotel.departuresToday')}</p>
              <p className="text-2xl font-bold text-gray-900">{departures.length}</p>
              {departures.length > 0 && <p className="text-xs text-gray-500 mt-1 truncate">{departures.map((a) => a.guestName).join(', ')}</p>}
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-xs text-gray-500">{t('hotel.bookingRevenue')}</p>
              <p className="text-2xl font-bold text-gray-900">{money(bookedRevenue)}</p>
            </div>
          </div>
        )}
        {loading ? <p className="text-gray-500">{t('common.loading')}...</p> : bookings.length === 0 ? (
          <p className="bg-white rounded-lg shadow p-6 text-center text-gray-500 text-sm">{t('hotel.noBookings')}</p>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr>
                <th className="text-left p-3">{t('hotel.guest')}</th>
                <th className="text-left p-3">{t('hotel.room')}</th>
                <th className="text-left p-3 hidden sm:table-cell">{t('hotel.checkInDate')}</th>
                <th className="text-left p-3 hidden sm:table-cell">{t('hotel.checkOutDate')}</th>
                <th className="text-right p-3 hidden md:table-cell">{t('hotel.total')}</th>
                <th className="text-left p-3">{t('hotel.status.label')}</th>
                <th className="p-3"></th>
              </tr></thead>
              <tbody>{bookings.map((b) => (
                <tr key={b.id} className="border-t border-gray-100">
                  <td className="p-3 font-medium text-gray-800 flex items-center gap-1.5"><UserIcon className="w-3.5 h-3.5 text-gray-400" />{b.guestName}</td>
                  <td className="p-3 text-gray-600">{b.roomNumber || '—'}</td>
                  <td className="p-3 text-gray-500 hidden sm:table-cell">{b.checkIn}</td>
                  <td className="p-3 text-gray-500 hidden sm:table-cell">{b.checkOut}</td>
                  <td className="p-3 text-right font-medium text-gray-700 hidden md:table-cell">{b.total ? money(b.total) : '—'}</td>
                  <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${BOOKING_STYLE[b.status]}`}>{bookingLabel(b.status)}</span></td>
                  <td className="p-3 text-right whitespace-nowrap">
                    {b.status !== 'cancelled' && (
                      <button onClick={() => openFolio(b.id)} title={t('hotel.folio')} className="inline-flex items-center px-2 py-1 rounded text-xs text-gray-500 hover:bg-gray-100 mr-1"><Receipt className="w-3.5 h-3.5" /></button>
                    )}
                    {b.status === 'booked' && (
                      <button onClick={() => bookingAction(b.id, 'check-in')} title={t('hotel.checkIn')} className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 mr-1"><LogIn className="w-3.5 h-3.5" />{t('hotel.checkIn')}</button>
                    )}
                    {b.status === 'checked_in' && (
                      <button onClick={() => bookingAction(b.id, 'check-out')} title={t('hotel.checkOut')} className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-purple-50 text-purple-700 hover:bg-purple-100 mr-1"><LogOut className="w-3.5 h-3.5" />{t('hotel.checkOut')}</button>
                    )}
                    {(b.status === 'booked' || b.status === 'checked_in') && (
                      <button onClick={() => bookingAction(b.id, 'cancel')} title={t('common.cancel')} className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-red-600 hover:bg-red-50"><Ban className="w-3.5 h-3.5" /></button>
                    )}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        </div>
      )}

      {view === 'calendar' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={() => shiftMonth(-1)} className="p-1.5 rounded-md hover:bg-gray-100"><ChevronLeft className="w-4 h-4" /></button>
              <span className="text-sm font-semibold text-gray-800 min-w-[9rem] text-center capitalize">{monthLabel}</span>
              <button onClick={() => shiftMonth(1)} className="p-1.5 rounded-md hover:bg-gray-100"><ChevronRight className="w-4 h-4" /></button>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-300" /> {bookingLabel('booked')}</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-400" /> {bookingLabel('checked_in')}</span>
            </div>
          </div>
          {rooms.length === 0 ? (
            <p className="bg-white rounded-lg shadow p-6 text-center text-gray-500 text-sm">{t('hotel.noRooms')}</p>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-x-auto">
              <table className="text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-gray-50 p-2 text-left font-medium text-gray-600 border-b border-gray-100">{t('hotel.room')}</th>
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => (
                      <th key={day} className="w-7 p-1 text-center font-normal text-gray-400 border-b border-gray-100">{day}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((room) => (
                    <tr key={room.id}>
                      <td className="sticky left-0 z-10 bg-white p-2 font-medium text-gray-700 border-b border-gray-100 whitespace-nowrap">{room.number}</td>
                      {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                        const b = bookingOn(room.id, calDate(day));
                        return (
                          <td key={day} className="border-b border-l border-gray-50 p-0.5" title={b ? `${b.guestName} (${b.checkIn} → ${b.checkOut})` : ''}>
                            <div className={`h-6 w-6 rounded-sm ${b ? CAL_FILL[b.status] : 'bg-gray-50'}`} />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {view === 'report' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 bg-white rounded-lg shadow p-4">
            <div><label className="block text-xs text-gray-500 mb-1">{t('hotel.from')}</label>
              <input type="date" value={reportRange.from} onChange={(e) => setReportRange({ ...reportRange, from: e.target.value })} className="rounded-md border-gray-300 text-sm focus:ring-[#0f766e] focus:border-[#0f766e]" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">{t('hotel.to')}</label>
              <input type="date" value={reportRange.to} min={reportRange.from} onChange={(e) => setReportRange({ ...reportRange, to: e.target.value })} className="rounded-md border-gray-300 text-sm focus:ring-[#0f766e] focus:border-[#0f766e]" /></div>
            <button onClick={runReport} disabled={reportLoading || reportRange.to <= reportRange.from}
              className="px-4 py-2 rounded-lg bg-[#0f766e] text-white text-sm hover:bg-[#1e3a5f] disabled:opacity-50">{reportLoading ? `${t('common.loading')}...` : t('hotel.run')}</button>
          </div>
          {report && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: t('hotel.occupancy'), value: `${report.occupancy}%` },
                { label: 'ADR', value: money(report.adr) },
                { label: 'RevPAR', value: money(report.revpar) },
                { label: t('hotel.bookingRevenue'), value: money(report.roomRevenue) },
                { label: t('hotel.bookings'), value: report.bookings },
                { label: t('hotel.arrivals'), value: report.arrivals },
                { label: t('hotel.departures'), value: report.departures },
                { label: t('hotel.title'), value: report.rooms },
              ].map((c) => (
                <div key={c.label} className="bg-white rounded-lg shadow p-4">
                  <p className="text-xs text-gray-500">{c.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{c.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {booking && (
        <Modal title={t('hotel.addBooking')} onClose={() => { setBooking(null); setBookingError(''); }}>
          {bookingError && <div className="bg-red-50 border-l-4 border-red-400 p-3 text-sm text-red-700">{bookingError}</div>}
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('hotel.checkInDate')}><input type="date" value={booking.checkIn} onChange={(e) => setBooking({ ...booking, checkIn: e.target.value })} className="block w-full rounded-md border-gray-300 text-sm focus:ring-[#0f766e] focus:border-[#0f766e]" /></Field>
            <Field label={t('hotel.checkOutDate')}><input type="date" value={booking.checkOut} min={booking.checkIn || undefined} onChange={(e) => setBooking({ ...booking, checkOut: e.target.value })} className="block w-full rounded-md border-gray-300 text-sm focus:ring-[#0f766e] focus:border-[#0f766e]" /></Field>
          </div>
          <Field label={t('hotel.room')}>
            <select value={booking.roomId} onChange={(e) => setBooking({ ...booking, roomId: e.target.value })} className="block w-full rounded-md border-gray-300 text-sm focus:ring-[#0f766e] focus:border-[#0f766e]">
              <option value="">{t('hotel.selectRoom')}</option>
              {roomOptions.map((r) => <option key={r.id} value={r.id}>{r.number}{r.type ? ` · ${r.type}` : ''}{r.rate ? ` — ${money(r.rate)}` : ''}</option>)}
            </select>
            {availRooms && <p className="text-xs text-gray-500 mt-1">{t('hotel.roomsAvailable', { n: String(availRooms.length) })}</p>}
          </Field>
          <Field label={t('hotel.guest')}><input value={booking.guestName} onChange={(e) => setBooking({ ...booking, guestName: e.target.value })} className="block w-full rounded-md border-gray-300 text-sm focus:ring-[#0f766e] focus:border-[#0f766e]" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('common.email')}><input type="email" value={booking.guestEmail} onChange={(e) => setBooking({ ...booking, guestEmail: e.target.value })} className="block w-full rounded-md border-gray-300 text-sm focus:ring-[#0f766e] focus:border-[#0f766e]" /></Field>
            <Field label={t('common.phone')}><input value={booking.guestPhone} onChange={(e) => setBooking({ ...booking, guestPhone: e.target.value })} className="block w-full rounded-md border-gray-300 text-sm focus:ring-[#0f766e] focus:border-[#0f766e]" /></Field>
          </div>
          {bTotal > 0 && (
            <div className="flex items-center justify-between rounded-lg bg-amber-50 px-4 py-2.5 text-sm">
              <span className="text-gray-600">{money(selRoom!.rate)} × {t('hotel.nights', { n: String(bNights) })}</span>
              <span className="font-bold text-gray-900">{money(bTotal)}</span>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={() => setBooking(null)} className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50">{t('common.cancel')}</button>
            <button onClick={saveBooking} disabled={saving || !booking.roomId || !booking.guestName.trim() || !booking.checkIn || !booking.checkOut} className="px-4 py-2 bg-[#0f766e] text-white rounded-md hover:bg-[#1e3a5f] disabled:opacity-50">{t('common.save')}</button>
          </div>
        </Modal>
      )}

      {folioFor && (
        <Modal title={t('hotel.folio')} onClose={() => { setFolioFor(null); setFolioData(null); }}>
          {!folioData ? <p className="text-gray-500 text-sm">{t('common.loading')}...</p> : (
            <>
              <div>
                <p className="font-semibold text-gray-900">{folioData.booking.guestName}</p>
                <p className="text-xs text-gray-500">{t('hotel.room')} {folioData.booking.roomNumber || '—'} · {folioData.booking.checkIn} → {folioData.booking.checkOut}</p>
              </div>
              <div className="border-y border-gray-100 divide-y divide-gray-100">
                <div className="flex justify-between py-2 text-sm"><span className="text-gray-600">{t('hotel.roomCharge')}</span><span className="font-medium">{money(folioData.roomCharge)}</span></div>
                {folioData.items.map((it) => (
                  <div key={it.id} className="flex justify-between items-center py-2 text-sm">
                    <span className="text-gray-600">{it.description}</span>
                    <span className="flex items-center gap-2"><span className="font-medium">{money(it.amount)}</span>
                      <button onClick={() => deleteFolioLine(it.id)} className="text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button></span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between py-1 text-sm text-gray-700"><span>{t('hotel.grandTotal')}</span><span className="font-medium">{money(folioData.grandTotal)}</span></div>
              {folioData.deposit > 0 && (
                <div className="flex justify-between py-1 text-sm text-green-700"><span>{t('hotel.deposit')}</span><span>− {money(folioData.deposit)}</span></div>
              )}
              <div className="flex justify-between py-1 text-base font-bold text-gray-900 border-t border-gray-100"><span>{t('hotel.balance')}</span><span>{money(folioData.balance)}</span></div>
              {folioData.paidAt ? (
                <div className="flex items-center justify-center gap-1.5 rounded-lg bg-green-50 px-4 py-2 text-sm font-medium text-green-700"><Check className="w-4 h-4" /> {t('hotel.paid')}</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {folioData.deposit <= 0 && <button onClick={takeDeposit} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 whitespace-nowrap">{t('hotel.deposit')}</button>}
                  {folioData.balance > 0 && <button onClick={openPayLink} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 whitespace-nowrap"><CreditCard className="w-4 h-4" /> {t('hotel.paymentLink')}</button>}
                  <button onClick={markSettled} disabled={saving} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-[#0f766e] text-white text-sm hover:bg-[#1e3a5f] disabled:opacity-50 whitespace-nowrap"><Check className="w-4 h-4" /> {t('hotel.markPaid')}</button>
                </div>
              )}
              <div className="flex gap-2 items-end pt-3 border-t border-gray-100">
                <div className="flex-1"><label className="block text-xs text-gray-500 mb-1">{t('hotel.chargeDesc')}</label><input value={folioLine.description} onChange={(e) => setFolioLine({ ...folioLine, description: e.target.value })} placeholder={t('hotel.chargeHint')} className="block w-full rounded-md border-gray-300 text-sm focus:ring-[#0f766e] focus:border-[#0f766e]" /></div>
                <div className="w-24"><label className="block text-xs text-gray-500 mb-1">{t('hotel.amount')}</label><input type="number" min="0" step="0.01" value={folioLine.amount} onChange={(e) => setFolioLine({ ...folioLine, amount: e.target.value })} className="block w-full rounded-md border-gray-300 text-sm focus:ring-[#0f766e] focus:border-[#0f766e]" /></div>
                <button onClick={addFolioLine} disabled={saving || !folioLine.description.trim()} className="px-3 py-2 bg-[#0f766e] text-white rounded-md text-sm hover:bg-[#1e3a5f] disabled:opacity-50 whitespace-nowrap">{t('hotel.addCharge')}</button>
              </div>
            </>
          )}
        </Modal>
      )}

      {creating && (
        <Modal title={t('hotel.addRoom')} onClose={() => setCreating(null)}>
          <Field label={t('hotel.roomNumber')}><input autoFocus value={creating.number} onChange={(e) => setCreating({ ...creating, number: e.target.value })} className="block w-full rounded-md border-gray-300 text-sm focus:ring-[#0f766e] focus:border-[#0f766e]" /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label={t('hotel.roomType')}><input value={creating.type} onChange={(e) => setCreating({ ...creating, type: e.target.value })} placeholder={t('hotel.roomTypeHint')} className="block w-full rounded-md border-gray-300 text-sm focus:ring-[#0f766e] focus:border-[#0f766e]" /></Field>
            <Field label={t('hotel.floor')}><input value={creating.floor} onChange={(e) => setCreating({ ...creating, floor: e.target.value })} className="block w-full rounded-md border-gray-300 text-sm focus:ring-[#0f766e] focus:border-[#0f766e]" /></Field>
            <Field label={t('hotel.ratePerNight')}><input type="number" min="0" step="0.01" value={creating.rate} onChange={(e) => setCreating({ ...creating, rate: e.target.value })} placeholder="0" className="block w-full rounded-md border-gray-300 text-sm focus:ring-[#0f766e] focus:border-[#0f766e]" /></Field>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setCreating(null)} className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50">{t('common.cancel')}</button>
            <button onClick={create} disabled={saving || !creating.number.trim()} className="px-4 py-2 bg-[#0f766e] text-white rounded-md hover:bg-[#1e3a5f] disabled:opacity-50">{t('common.save')}</button>
          </div>
        </Modal>
      )}

      {editing && (
        <Modal title={`${t('hotel.room')} ${editing.number}`} onClose={() => setEditing(null)}>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('hotel.roomNumber')}><input value={editing.number} onChange={(e) => setEditing({ ...editing, number: e.target.value })} className="block w-full rounded-md border-gray-300 text-sm focus:ring-[#0f766e] focus:border-[#0f766e]" /></Field>
            <Field label={t('hotel.floor')}><input value={editing.floor || ''} onChange={(e) => setEditing({ ...editing, floor: e.target.value })} className="block w-full rounded-md border-gray-300 text-sm focus:ring-[#0f766e] focus:border-[#0f766e]" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('hotel.roomType')}><input value={editing.type || ''} onChange={(e) => setEditing({ ...editing, type: e.target.value })} className="block w-full rounded-md border-gray-300 text-sm focus:ring-[#0f766e] focus:border-[#0f766e]" /></Field>
            <Field label={t('hotel.ratePerNight')}><input type="number" min="0" step="0.01" value={editing.rate ?? 0} onChange={(e) => setEditing({ ...editing, rate: Number(e.target.value) })} className="block w-full rounded-md border-gray-300 text-sm focus:ring-[#0f766e] focus:border-[#0f766e]" /></Field>
          </div>
          <Field label={t('hotel.status.label')}>
            <select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as RoomStatus })} className="block w-full rounded-md border-gray-300 text-sm focus:ring-[#0f766e] focus:border-[#0f766e]">
              {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
            </select>
          </Field>
          {(editing.status === 'occupied' || editing.status === 'reserved') && (
            <Field label={t('hotel.guest')}><input value={editing.guestName || ''} onChange={(e) => setEditing({ ...editing, guestName: e.target.value })} className="block w-full rounded-md border-gray-300 text-sm focus:ring-[#0f766e] focus:border-[#0f766e]" /></Field>
          )}
          <Field label={t('hotel.housekeeper')}>
            <select value={editing.housekeeperId || ''} onChange={(e) => setEditing({ ...editing, housekeeperId: e.target.value || null })} className="block w-full rounded-md border-gray-300 text-sm focus:ring-[#0f766e] focus:border-[#0f766e]">
              <option value="">{t('hotel.unassigned')}</option>
              {staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label={t('common.notes')}><textarea value={editing.notes || ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} rows={2} className="block w-full rounded-md border-gray-300 text-sm focus:ring-[#0f766e] focus:border-[#0f766e]" /></Field>
          <div className="rounded-lg bg-gray-50 p-2.5">
            <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Receipt className="w-3.5 h-3.5" /> {t('roomService.title')}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate text-xs text-gray-700">{editing.serviceToken ? rsUrl(editing.serviceToken) : '—'}</code>
              <button onClick={() => editing.serviceToken && navigator.clipboard?.writeText(rsUrl(editing.serviceToken))} className="px-2 py-1 text-xs rounded bg-white border border-gray-200 hover:bg-gray-100 whitespace-nowrap">{t('common.copy')}</button>
              <button onClick={regenToken} disabled={saving} title={t('hotel.regenerateLink')} className="p-1.5 rounded bg-white border border-gray-200 hover:bg-gray-100"><RefreshCw className="w-3.5 h-3.5 text-gray-500" /></button>
            </div>
          </div>
          <div className="flex justify-between gap-2">
            <button onClick={remove} disabled={saving} className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-md disabled:opacity-50">{t('common.delete')}</button>
            <div className="flex gap-2">
              <button onClick={() => setEditing(null)} className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50">{t('common.cancel')}</button>
              <button onClick={saveEdit} disabled={saving} className="px-4 py-2 bg-[#0f766e] text-white rounded-md hover:bg-[#1e3a5f] disabled:opacity-50">{t('common.save')}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}
