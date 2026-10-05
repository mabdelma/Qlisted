import { useState, useEffect, useCallback } from 'react';
import { Link, useParams } from 'react-router';
import { BedDouble, CalendarDays, Check, ConciergeBell, DoorOpen, Loader2, LogOut, User } from 'lucide-react';
import { stayApi } from '../../lib/api';
import type { GuestStay } from '../../lib/api/endpoints';
import { useI18n } from '../../contexts/I18nContext';

/**
 * Guest self-service stay — reached by the per-booking token in the booking
 * confirmation (`/r/:slug/stay/:token`). Everything the guest may do is decided
 * by the SERVER from that one token; this page only renders what it is told:
 *
 *  - `status` drives which action is offered (check in / check out / nothing).
 *  - `serviceToken` is withheld by the server until the guest is checked in, so
 *    the room-service link is shown if and only if the server sent one. The page
 *    never derives it, and never guesses the room's ordering link.
 *  - check-in/check-out refusals ("too early", "settle the bill before checking
 *    out") come back as HTTP errors and are surfaced verbatim — the front-desk
 *    rules are not re-implemented here, where a guest could bypass them.
 */
export function StayPage() {
  const { t } = useI18n();
  const { slug, token } = useParams<{ slug: string; token: string }>();

  const [loading, setLoading] = useState(true);
  const [stay, setStay] = useState<GuestStay | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!slug || !token) return;
    setLoading(true);
    setLoadError(null);
    try {
      setStay(await stayApi.get(slug, token));
    } catch (e) {
      // 404 (bad/expired token) and 403 (requireVenue — a restaurant tenant has
      // no stays) both land here; either way the guest cannot proceed.
      setStay(null);
      setLoadError(apiMessage(e, t('stay.notFound')));
    } finally {
      setLoading(false);
    }
  }, [slug, token, t]);

  useEffect(() => { load(); }, [load]);

  async function act(which: 'in' | 'out') {
    if (!slug || !token || acting) return;
    setActing(true);
    setActionError(null);
    try {
      if (which === 'in') await stayApi.checkIn(slug, token);
      else await stayApi.checkOut(slug, token);
      // Re-read rather than trusting a local guess: check-in is what releases
      // the room number and the service token, and check-out may have been
      // refused for a reason only the server knows.
      setStay(await stayApi.get(slug, token));
    } catch (e) {
      setActionError(apiMessage(e, t('error.generic')));
    } finally {
      setActing(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-amber-50">
        <Loader2 className="w-8 h-8 text-[#0f766e] animate-spin" />
      </div>
    );
  }

  if (!stay) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-amber-50 p-6">
        <div className="text-center max-w-sm">
          <BedDouble className="w-12 h-12 text-[#0f766e] mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">{t('stay.title')}</h1>
          <p className="text-gray-600">{t('stay.notFound')}</p>
          {loadError && <p className="text-xs text-gray-400 mt-3">{loadError}</p>}
        </div>
      </div>
    );
  }

  const nights = nightsBetween(stay.checkIn, stay.checkOut);
  const balance = Math.max(0, round2(stay.total - stay.depositAmount));
  const statusLabel = {
    booked: t('stay.statusBooked'),
    checked_in: t('stay.statusCheckedIn'),
    checked_out: t('stay.statusCheckedOut'),
    cancelled: t('stay.statusCancelled'),
  }[stay.status];
  const statusTone = {
    booked: 'bg-amber-100 text-amber-800',
    checked_in: 'bg-green-100 text-green-800',
    checked_out: 'bg-gray-200 text-gray-700',
    cancelled: 'bg-red-100 text-red-800',
  }[stay.status];

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <header className="bg-gradient-to-r from-[#0f766e] to-[#1e3a5f] text-white px-4 py-8">
        <div className="max-w-xl mx-auto">
          <p className="flex items-center gap-1.5 text-sm text-white/80">
            <BedDouble className="w-4 h-4" /> {t('stay.title')}
          </p>
          <h1 className="text-2xl font-bold mt-1">{stay.guestName}</h1>
          <span className={`inline-block mt-3 rounded-full px-3 py-1 text-xs font-semibold ${statusTone}`}>{statusLabel}</span>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-6 space-y-5">
        <section className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
          <Row icon={<User className="w-4 h-4" />} label={t('stay.guest')} value={stay.guestName} />
          <Row
            icon={<DoorOpen className="w-4 h-4" />}
            label={t('stay.room')}
            value={stay.roomNumber || t('stay.roomPending')}
          />
          <Row icon={<CalendarDays className="w-4 h-4" />} label={t('stay.arrival')} value={stay.checkIn} />
          <Row
            icon={<CalendarDays className="w-4 h-4" />}
            label={t('stay.departure')}
            value={nights > 0 ? `${stay.checkOut} · ${t('hotel.nights', { n: String(nights) })}` : stay.checkOut}
          />
        </section>

        <section className="bg-white rounded-xl shadow-sm p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">{t('stay.total')}</span>
            <span className="font-semibold text-gray-900">{stay.total.toFixed(2)}</span>
          </div>
          {stay.depositAmount > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">{t('stay.deposit')}</span>
              <span className="font-semibold text-gray-900">−{stay.depositAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-gray-100 pt-2">
            <span className="text-gray-700 font-medium">{t('stay.balance')}</span>
            <span className="font-bold text-gray-900">
              {stay.folioPaidAt ? t('stay.folioPaid') : balance.toFixed(2)}
            </span>
          </div>
        </section>

        {actionError && (
          <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {actionError}
          </p>
        )}

        {/* The room-service link appears only when the SERVER sent a service
            token, which it does only once the guest is checked in. */}
        {stay.serviceToken && slug && (
          <Link
            to={`/r/${slug}/room/${stay.serviceToken}`}
            className="flex items-center gap-3 bg-white rounded-xl shadow-sm p-4 hover:ring-2 hover:ring-[#0f766e]/30"
          >
            <span className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
              <ConciergeBell className="w-5 h-5 text-[#0f766e]" />
            </span>
            <span className="min-w-0">
              <span className="block font-medium text-gray-900">{t('stay.roomService')}</span>
              <span className="block text-xs text-gray-500">{t('stay.roomServiceHint')}</span>
            </span>
          </Link>
        )}

        {stay.status === 'booked' && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => act('in')}
              disabled={acting}
              className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-[#0f766e] text-white rounded-xl font-medium shadow-sm hover:bg-[#1e3a5f] disabled:opacity-60"
            >
              {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {t('stay.checkIn')}
            </button>
            <p className="text-xs text-gray-500 text-center">{t('stay.checkInHint', { date: stay.checkIn })}</p>
          </div>
        )}

        {stay.status === 'checked_in' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-lg bg-green-50 text-green-800 px-3 py-2 text-sm">
              <Check className="w-4 h-4 shrink-0" />
              <span>{t('stay.checkedInDesc', { room: stay.roomNumber || '' })}</span>
            </div>
            <button
              type="button"
              onClick={() => act('out')}
              disabled={acting}
              className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-white border border-[#0f766e] text-[#0f766e] rounded-xl font-medium hover:bg-[#0f766e]/5 disabled:opacity-60"
            >
              {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
              {t('stay.checkOut')}
            </button>
            <p className="text-xs text-gray-500 text-center">{t('stay.checkOutHint')}</p>
          </div>
        )}

        {stay.status === 'checked_out' && (
          <p className="bg-white rounded-xl shadow-sm p-6 text-center text-gray-600 text-sm">{t('stay.checkedOutDesc')}</p>
        )}

        {stay.status === 'cancelled' && (
          <p className="bg-white rounded-xl shadow-sm p-6 text-center text-gray-600 text-sm">{t('stay.cancelledDesc')}</p>
        )}
      </main>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="w-8 h-8 rounded-lg bg-amber-50 text-[#0f766e] flex items-center justify-center shrink-0">{icon}</span>
      <span className="text-sm text-gray-500 flex-1">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-end">{value}</span>
    </div>
  );
}

/**
 * The API client throws a PLAIN OBJECT (`{ status, message }`), not an Error —
 * so `e instanceof Error` is always false and `e.message` must be read off the
 * object directly, or every server explanation is replaced by a generic one.
 */
export function apiMessage(e: unknown, fallback: string): string {
  if (typeof e === 'object' && e !== null) {
    const msg = (e as { message?: unknown }).message;
    if (typeof msg === 'string' && msg) return msg;
  }
  return fallback;
}

/** Whole nights between two YYYY-MM-DD dates; 0 when the range is invalid. */
export function nightsBetween(checkIn: string, checkOut: string): number {
  const a = Date.parse(`${checkIn}T00:00:00Z`);
  const b = Date.parse(`${checkOut}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 0;
  return Math.round((b - a) / 86400000);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
