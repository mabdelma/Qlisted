import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Hotel, LogIn, LogOut, ArrowRight } from 'lucide-react';
import { hotelApi } from '../../lib/api';
import { useI18n } from '../../contexts/I18nContext';
import type { RoomStats, RoomBooking } from '../../lib/api/types';

/**
 * Compact front-desk summary for the admin overview — occupancy plus today's
 * arrivals and departures. Renders nothing when the tenant has no rooms, so it
 * stays invisible for pure-restaurant tenants.
 */
export function FrontDeskWidget({ slug }: { slug?: string }) {
  const { t } = useI18n();
  const [stats, setStats] = useState<RoomStats | null>(null);
  const [bookings, setBookings] = useState<RoomBooking[]>([]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    Promise.all([hotelApi.stats(slug), hotelApi.listBookings(slug)])
      .then(([s, b]) => { if (!cancelled) { setStats(s); setBookings(b); } })
      .catch(() => { /* hotel features may be unused */ });
    return () => { cancelled = true; };
  }, [slug]);

  if (!stats || stats.total === 0) return null;

  const today = new Date().toISOString().slice(0, 10);
  const arrivals = bookings.filter((b) => b.status === 'booked' && b.checkIn === today).length;
  const departures = bookings.filter((b) => b.status === 'checked_in' && b.checkOut === today).length;

  const items = [
    { label: t('hotel.occupancy'), value: `${stats.occupancy}%`, icon: Hotel },
    { label: t('hotel.arrivalsToday'), value: arrivals, icon: LogIn },
    { label: t('hotel.departuresToday'), value: departures, icon: LogOut },
  ];

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
          <Hotel className="w-4 h-4 text-[#0f766e]" /> {t('hotel.title')}
        </h3>
        <Link to="/admin/rooms" aria-label={t('hotel.title')} className="text-[#0f766e] hover:text-[#1e3a5f]">
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {items.map((it) => (
          <div key={it.label} className="text-center">
            <p className="text-2xl font-bold text-gray-900">{it.value}</p>
            <p className="text-xs text-gray-500 flex items-center justify-center gap-1"><it.icon className="w-3 h-3" /> {it.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
