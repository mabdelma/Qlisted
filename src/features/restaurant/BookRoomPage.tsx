import { useState, useCallback } from 'react';
import { useParams } from 'react-router';
import { BedDouble, Search, Check, Loader2, ArrowLeft } from 'lucide-react';
import { bookingApi } from '../../lib/api';
import { useI18n } from '../../contexts/I18nContext';

type Room = { id: string; number: string; type?: string | null; rate: number };

export function BookRoomPage() {
  const { t } = useI18n();
  const { slug } = useParams<{ slug: string }>();

  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Room | null>(null);
  const [guest, setGuest] = useState({ name: '', email: '', phone: '' });
  const [booking, setBooking] = useState(false);
  const [done, setDone] = useState(false);
  const [deposit, setDeposit] = useState<{ url: string; amount: number } | null>(null);

  const nights = checkIn && checkOut && checkOut > checkIn
    ? Math.max(1, Math.round((new Date(checkOut + 'T00:00:00Z').getTime() - new Date(checkIn + 'T00:00:00Z').getTime()) / 86400000)) : 0;
  const price = (n: number) => n.toFixed(2);

  const search = useCallback(async () => {
    if (!slug || !checkIn || !checkOut || checkOut <= checkIn) return;
    setSearching(true); setSelected(null);
    try { setRooms(await bookingApi.availability(slug, checkIn, checkOut)); }
    catch { setRooms([]); } finally { setSearching(false); }
  }, [slug, checkIn, checkOut]);

  async function confirm() {
    if (!slug || !selected || !guest.name.trim() || !checkIn || !checkOut) return;
    setBooking(true);
    try {
      const res = await bookingApi.book(slug, { roomId: selected.id, guestName: guest.name, guestEmail: guest.email || undefined, guestPhone: guest.phone || undefined, checkIn, checkOut });
      if (res.deposit) setDeposit(res.deposit); else setDone(true);
    } catch { /* ignore */ } finally { setBooking(false); }
  }

  if (deposit && !done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-amber-50 p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-[#0f766e]/10 rounded-full flex items-center justify-center mx-auto mb-4"><BedDouble className="w-8 h-8 text-[#0f766e]" /></div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">{t('book.secure')}</h1>
          <p className="text-gray-600 mb-2">{t('book.securePrompt')}</p>
          <p className="text-2xl font-bold text-gray-900 mb-6">{price(deposit.amount)}</p>
          <div className="flex flex-col gap-2">
            <a href={deposit.url} target="_blank" rel="noopener noreferrer" onClick={() => setDone(true)}
              className="px-5 py-2.5 bg-[#0f766e] text-white rounded-lg hover:bg-[#1e3a5f]">{t('book.payNow')}</a>
            <button onClick={() => setDone(true)} className="px-5 py-2.5 text-gray-600 hover:text-gray-800 text-sm">{t('book.payLater')}</button>
          </div>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-amber-50 p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><Check className="w-8 h-8 text-green-600" /></div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">{t('book.confirmed')}</h1>
          <p className="text-gray-600 mb-6">{t('book.confirmedDesc')}</p>
          <button onClick={() => { setDone(false); setDeposit(null); setRooms(null); setSelected(null); setGuest({ name: '', email: '', phone: '' }); }}
            className="px-5 py-2.5 bg-[#0f766e] text-white rounded-lg hover:bg-[#1e3a5f]">{t('book.bookAnother')}</button>
        </div>
      </div>
    );
  }

  const field = 'block w-full rounded-lg border-gray-300 text-sm focus:ring-[#0f766e] focus:border-[#0f766e]';

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <header className="bg-gradient-to-r from-[#0f766e] to-[#1e3a5f] text-white px-4 py-8">
        <div className="max-w-xl mx-auto">
          <h1 className="text-2xl font-bold flex items-center gap-2"><BedDouble className="w-6 h-6" /> {t('book.title')}</h1>
          <p className="text-sm text-white/80 mt-1">{t('book.subtitle')}</p>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-6 space-y-6">
        {/* date search */}
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs text-gray-500 mb-1">{t('hotel.checkInDate')}</label>
              <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className={field} /></div>
            <div><label className="block text-xs text-gray-500 mb-1">{t('hotel.checkOutDate')}</label>
              <input type="date" value={checkOut} min={checkIn || undefined} onChange={(e) => setCheckOut(e.target.value)} className={field} /></div>
          </div>
          <button onClick={search} disabled={!checkIn || !checkOut || checkOut <= checkIn || searching}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0f766e] text-white rounded-lg hover:bg-[#1e3a5f] disabled:opacity-50">
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} {t('book.search')}
          </button>
        </div>

        {/* results / selection */}
        {selected ? (
          <div className="bg-white rounded-xl shadow-sm p-4 space-y-4">
            <button onClick={() => setSelected(null)} className="flex items-center gap-1 text-sm text-[#0f766e] hover:underline"><ArrowLeft className="w-4 h-4" /> {t('book.available')}</button>
            <div className="flex items-center justify-between rounded-lg bg-amber-50 p-3">
              <div><p className="font-semibold text-gray-900">{selected.number}{selected.type ? ` · ${selected.type}` : ''}</p>
                <p className="text-xs text-gray-500">{checkIn} → {checkOut} · {t('hotel.nights', { n: String(nights) })}</p></div>
              <p className="font-bold text-gray-900">{price(selected.rate * nights)}</p>
            </div>
            <p className="text-sm font-semibold text-gray-700">{t('book.details')}</p>
            <input value={guest.name} onChange={(e) => setGuest({ ...guest, name: e.target.value })} placeholder={t('common.name')} className={field} />
            <div className="grid grid-cols-2 gap-3">
              <input type="email" value={guest.email} onChange={(e) => setGuest({ ...guest, email: e.target.value })} placeholder={t('common.email')} className={field} />
              <input value={guest.phone} onChange={(e) => setGuest({ ...guest, phone: e.target.value })} placeholder={t('common.phone')} className={field} />
            </div>
            <button onClick={confirm} disabled={booking || !guest.name.trim()}
              className="w-full px-4 py-3 bg-[#0f766e] text-white rounded-lg font-medium hover:bg-[#1e3a5f] disabled:opacity-50">
              {booking ? `${t('common.loading')}...` : t('book.confirm')}
            </button>
          </div>
        ) : rooms === null ? (
          <p className="text-center text-gray-500 text-sm py-6">{t('book.selectDates')}</p>
        ) : rooms.length === 0 ? (
          <p className="bg-white rounded-xl shadow-sm p-6 text-center text-gray-500 text-sm">{t('book.noRooms')}</p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-700">{t('book.available')}</p>
            {rooms.map((r) => (
              <button key={r.id} onClick={() => setSelected(r)}
                className="w-full flex items-center justify-between bg-white rounded-xl shadow-sm p-4 text-left hover:ring-2 hover:ring-[#0f766e]/30">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center"><BedDouble className="w-5 h-5 text-[#0f766e]" /></span>
                  <div><p className="font-medium text-gray-900">{r.number}</p><p className="text-xs text-gray-500">{r.type || t('hotel.room')}</p></div>
                </div>
                <div className="text-right"><p className="font-bold text-gray-900">{price(r.rate)}</p><p className="text-[11px] text-gray-500">{t('book.perNight')}</p></div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
