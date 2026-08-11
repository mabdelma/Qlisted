import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router';
import { UtensilsCrossed, ArrowLeft, CalendarDays, Clock, X, BedDouble } from 'lucide-react';
import { tenantApi, menuApi, reservationApi, waitlistApi } from '../../lib/api';
import { useI18n } from '../../contexts/I18nContext';
import { BrandingProvider } from '../../contexts/BrandingProvider';
import type { Tenant, MenuCategory, MenuItem } from '../../lib/api/types';
import { MenuSkeleton } from '../../components/ui/Skeleton';

export function RestaurantLanding() {
  const { t } = useI18n();
  const { slug } = useParams<{ slug: string }>();

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showReservation, setShowReservation] = useState(false);
  const [resForm, setResForm] = useState({ customerName: '', customerEmail: '', customerPhone: '', partySize: 2, date: new Date().toISOString().split('T')[0], time: '19:00', specialRequests: '' });
  const [resSaving, setResSaving] = useState(false);
  const [resDone, setResDone] = useState(false);
  const [resError, setResError] = useState('');
  const [showWaitlist, setShowWaitlist] = useState(false);
  const [wlForm, setWlForm] = useState({ customerName: '', customerPhone: '', customerEmail: '', partySize: 2, notes: '' });
  const [wlSaving, setWlSaving] = useState(false);
  const [wlResult, setWlResult] = useState<{ position: number; estimatedWaitMinutes: number } | null>(null);
  const [wlError, setWlError] = useState('');

  useEffect(() => {
    if (!slug) { setLoading(false); setNotFound(true); return; }
    tenantApi.get(slug)
      .then(async (t) => {
        setTenant(t);
        try {
          const m = await menuApi.getFullMenu(slug);
          setCategories(m.categories);
          setItems(m.items);
        } catch { /* menu optional on landing */ }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  // Must run on every render (before any early return) to satisfy the rules of hooks.
  const mainCats = useMemo(() => categories.filter((c) => c.type === 'main'), [categories]);

  if (loading) return <div className="min-h-screen bg-gray-50"><MenuSkeleton /></div>;

  if (!slug || notFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-8 max-w-md">
          <UtensilsCrossed className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-400 mb-2">{t('error.notFound')}</h1>
          <p className="text-gray-500 mb-6">{t('common.notAvailable')}</p>
          <a href="/" className="inline-flex items-center px-6 py-3 bg-brand text-white rounded-lg hover:bg-brand-hover">
            <ArrowLeft className="w-4 h-4 mr-2" /> {t('common.back')}
          </a>
        </div>
      </div>
    );
  }

  const venue = tenant.venueType || 'restaurant';

  return (
    <BrandingProvider primaryColor={tenant.primaryColor} accentColor={tenant.accentColor} logoUrl={tenant.logoUrl} faviconUrl={tenant.faviconUrl}>
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-brand text-white p-8">
        <h1 className="text-3xl font-bold">{tenant.name}</h1>
        {tenant.logoUrl && <img src={tenant.logoUrl} alt={tenant.name} width="64" height="64" loading="lazy" className="h-16 w-16 rounded-full mt-4" />}
      {tenant.coverImage && <img src={tenant.coverImage} alt="" className="w-full h-48 object-cover mt-4 rounded-lg" />}
      </div>

      {/* Quick actions — adapt to the venue type */}
      <div className="max-w-lg mx-auto p-4 flex gap-3">
        {venue !== 'restaurant' && (
          <Link to={`/r/${slug}/book`}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-brand text-white rounded-lg hover:opacity-90 transition-opacity">
            <BedDouble className="w-5 h-5" /> {t('book.title')}
          </Link>
        )}
        {venue !== 'hotel' && (
          <>
            <button onClick={() => setShowReservation(true)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-opacity ${venue === 'both' ? 'border-2 border-brand text-brand hover:bg-brand hover:text-white' : 'bg-brand text-white hover:opacity-90'}`}>
              <CalendarDays className="w-5 h-5" /> Book a Table
            </button>
            <button onClick={() => setShowWaitlist(true)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-brand text-brand rounded-lg hover:bg-brand hover:text-white transition-colors">
              <Clock className="w-5 h-5" /> Join Waitlist
            </button>
          </>
        )}
      </div>

      {/* Waitlist modal */}
      {showWaitlist && (
        <div className="fixed inset-0 bg-gray-600/50 flex items-center justify-center p-4 z-50" onClick={() => setShowWaitlist(false)}>
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Join waitlist">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Join Waitlist</h3>
              <button onClick={() => { setShowWaitlist(false); setWlResult(null); setWlError(''); }} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            {wlResult ? (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 text-[#0f766e] mx-auto mb-3" />
                <p className="text-lg font-medium text-gray-900">You're #{wlResult.position} in line!</p>
                <p className="text-sm text-gray-500 mt-1">Estimated wait: ~{wlResult.estimatedWaitMinutes} minutes</p>
                <p className="text-xs text-gray-400 mt-4">We'll notify you when your table is ready.</p>
                <button onClick={() => { setShowWaitlist(false); setWlResult(null); }}
                  className="mt-4 px-4 py-2 bg-[#0f766e] text-white rounded-md hover:bg-[#1e3a5f]">Done</button>
              </div>
            ) : (
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!slug) return;
                setWlSaving(true);
                setWlError('');
                try {
                  const result = await waitlistApi.join(slug, wlForm);
                  setWlResult(result);
                } catch {
                  setWlError('Failed to join waitlist. Please try again.');
                }
                setWlSaving(false);
              }} className="space-y-4">
                {wlError && <div className="text-sm text-red-600 bg-red-50 p-3 rounded">{wlError}</div>}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name *</label>
                  <input type="text" required value={wlForm.customerName}
                    onChange={(e) => setWlForm({ ...wlForm, customerName: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Party Size *</label>
                  <input type="number" min="1" required value={wlForm.partySize}
                    onChange={(e) => setWlForm({ ...wlForm, partySize: parseInt(e.target.value) || 2 })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Phone (for notification)</label>
                  <input type="tel" value={wlForm.customerPhone} onChange={(e) => setWlForm({ ...wlForm, customerPhone: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email (optional)</label>
                  <input type="email" value={wlForm.customerEmail} onChange={(e) => setWlForm({ ...wlForm, customerEmail: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]" />
                </div>
                <button type="submit" disabled={wlSaving}
                  className="w-full px-4 py-2 bg-[#0f766e] text-white rounded-md hover:bg-[#1e3a5f] disabled:opacity-50">
                  {wlSaving ? 'Joining...' : 'Join Waitlist'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Reservation modal */}
      {showReservation && (
        <div className="fixed inset-0 bg-gray-600/50 flex items-center justify-center p-4 z-50" onClick={() => setShowReservation(false)}>
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Book a table">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Book a Table</h3>
              <button onClick={() => { setShowReservation(false); setResDone(false); setResError(''); }} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            {resDone ? (
              <div className="text-center py-8">
                <CalendarDays className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="text-lg font-medium text-gray-900">Reservation Request Sent!</p>
                <p className="text-sm text-gray-500 mt-1">We'll confirm your booking shortly.</p>
                <button onClick={() => { setShowReservation(false); setResDone(false); }}
                  className="mt-4 px-4 py-2 bg-[#0f766e] text-white rounded-md hover:bg-[#1e3a5f]">Done</button>
              </div>
            ) : (
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!slug) return;
                setResSaving(true);
                setResError('');
                try {
                  await reservationApi.create(slug, resForm);
                  setResDone(true);
                } catch {
                  setResError('Failed to submit reservation. Please try again.');
                }
                setResSaving(false);
              }} className="space-y-4">
                {resError && <div className="text-sm text-red-600 bg-red-50 p-3 rounded">{resError}</div>}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name *</label>
                  <input type="text" required value={resForm.customerName}
                    onChange={(e) => setResForm({ ...resForm, customerName: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <input type="email" value={resForm.customerEmail}
                      onChange={(e) => setResForm({ ...resForm, customerEmail: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Phone</label>
                    <input type="tel" value={resForm.customerPhone}
                      onChange={(e) => setResForm({ ...resForm, customerPhone: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Party Size *</label>
                  <input type="number" min="1" required value={resForm.partySize}
                    onChange={(e) => setResForm({ ...resForm, partySize: parseInt(e.target.value) || 2 })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Date *</label>
                    <input type="date" required value={resForm.date}
                      onChange={(e) => setResForm({ ...resForm, date: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Time *</label>
                    <input type="time" required value={resForm.time}
                      onChange={(e) => setResForm({ ...resForm, time: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Special Requests</label>
                  <textarea value={resForm.specialRequests} onChange={(e) => setResForm({ ...resForm, specialRequests: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#0f766e] focus:ring-[#0f766e]" rows={2} />
                </div>
                <button type="submit" disabled={resSaving}
                  className="w-full px-4 py-2 bg-[#0f766e] text-white rounded-md hover:bg-[#1e3a5f] disabled:opacity-50">
                  {resSaving ? 'Submitting...' : 'Request Reservation'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Menu preview — hidden for hotel-only venues */}
      {venue !== 'hotel' && (
      <div className="max-w-lg mx-auto p-4 space-y-4">
        <h2 className="text-xl font-bold text-gray-900">{t('nav.menu')}</h2>
        {mainCats.map((cat) => (
          <div key={cat.id} className="bg-white rounded-lg shadow-sm p-4">
            <h3 className="font-semibold text-gray-900 mb-2">{cat.name}</h3>
            <div className="space-y-2">
              {items.filter((i) => i.categoryId === cat.id && i.available).slice(0, 4).map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-gray-700">{item.name}</span>
                  <span className="font-medium">{tenant.currency} {item.price.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
    </BrandingProvider>
  );
}
