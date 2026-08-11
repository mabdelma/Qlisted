import { useI18n } from '../../contexts/I18nContext';
import { Link } from 'react-router';
import {
  Hotel, BedDouble, CalendarDays, LogIn, ConciergeBell, Receipt, TrendingUp,
  ArrowRight, Check, Star, Sparkles, Plus,
} from 'lucide-react';
import { MarketingHeader } from '../../components/layout/MarketingHeader';
import { Footer } from '../../components/layout/Footer';

export function HotelsLanding() {
  const { t } = useI18n();

  const features = [
    { icon: BedDouble, title: t('marketing.featureHotel'), desc: t('marketing.featureHotelDesc') },
    { icon: CalendarDays, title: t('reservations.title'), desc: t('hotels.resvDesc') },
    { icon: LogIn, title: t('hotels.checkTitle'), desc: t('hotels.checkDesc') },
    { icon: ConciergeBell, title: t('marketing.featureRoomService'), desc: t('marketing.featureRoomServiceDesc') },
    { icon: Receipt, title: t('hotel.folio'), desc: t('hotels.folioDesc') },
    { icon: TrendingUp, title: t('marketing.featureForecasting'), desc: t('hotels.forecastDesc') },
  ];

  const steps = [
    { icon: BedDouble, title: t('hotels.step1Title'), desc: t('hotels.step1Desc') },
    { icon: CalendarDays, title: t('hotels.step2Title'), desc: t('hotels.step2Desc') },
    { icon: ConciergeBell, title: t('hotels.step3Title'), desc: t('hotels.step3Desc') },
  ];

  return (
    <div className="min-h-screen bg-white">
      <MarketingHeader />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-amber-50 via-white to-white">
        <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-[#0f766e]/10 blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 md:pt-24 md:pb-28">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-left">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-[#0f766e]/10 text-[#0f766e] mb-6">
                <Hotel className="h-3.5 w-3.5" /> {t('hotels.heroBadge')}
              </span>
              <h1 className="text-4xl md:text-6xl font-bold text-gray-900 tracking-tight mb-6">{t('hotels.heroTitle')}</h1>
              <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-xl mx-auto lg:mx-0">{t('hotels.heroDesc')}</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link to="/onboarding" className="inline-flex items-center justify-center px-8 py-3.5 bg-[#0f766e] text-white font-medium rounded-lg hover:bg-[#1e3a5f] transition-colors text-lg shadow-sm">
                  {t('cta.startTrial')} <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
                <Link to="/demo" className="inline-flex items-center justify-center px-8 py-3.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors text-lg">
                  {t('cta.bookDemo')}
                </Link>
              </div>
              <p className="mt-5 text-sm text-gray-500 flex items-center gap-2 justify-center lg:justify-start">
                <Check className="h-4 w-4 text-green-600" /> {t('marketing.noCreditCard')}
              </p>
            </div>
            <div className="flex justify-center lg:justify-end">
              <HotelMockup />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{t('hotels.featuresTitle')}</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">{t('hotels.featuresDesc')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="group bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-xl hover:border-[#0f766e]/20 hover:-translate-y-1 transition-all">
                <div className="w-12 h-12 bg-[#0f766e]/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-[#0f766e] transition-colors">
                  <f.icon className="h-6 w-6 text-[#0f766e] group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 md:py-28 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{t('marketing.howItWorksTitle')}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {steps.map((s, i) => (
              <div key={s.title} className="relative text-center">
                <div className="w-16 h-16 bg-[#0f766e] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-[#0f766e]/20">
                  <s.icon className="h-7 w-7 text-white" />
                </div>
                <div className="text-xs font-semibold text-[#0f766e] tracking-widest mb-2">{String(i + 1).padStart(2, '0')}</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{s.title}</h3>
                <p className="text-gray-600 max-w-xs mx-auto">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-28 bg-[#0f766e] relative overflow-hidden">
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">{t('hotels.ctaTitle')}</h2>
          <p className="text-lg text-amber-100 mb-10 max-w-2xl mx-auto">{t('hotels.ctaDesc')}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/onboarding" className="inline-flex items-center justify-center px-8 py-3.5 bg-white text-[#0f766e] font-medium rounded-lg hover:bg-amber-50 transition-colors text-lg">
              {t('cta.startTrial')} <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
            <Link to="/pricing" className="inline-flex items-center justify-center px-8 py-3.5 border border-white/40 text-white font-medium rounded-lg hover:bg-white/10 transition-colors text-lg">
              {t('nav.pricing')}
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

/* ── CSS-only hotel scene: room-service phone + front-desk card ─────────────── */
function HotelMockup() {
  const { t } = useI18n();
  const items = [
    { name: t('marketing.phoneItemBurger'), price: '18.00' },
    { name: t('marketing.phoneItemPizza'), price: '16.00' },
  ];
  return (
    <div className="relative">
      {/* front-desk occupancy card */}
      <div className="absolute -left-6 -top-8 z-10 hidden sm:block rounded-2xl bg-white p-4 shadow-xl ring-1 ring-gray-100 w-52">
        <p className="flex items-center gap-1.5 text-xs font-medium text-gray-500"><Hotel className="h-3.5 w-3.5 text-[#0f766e]" /> {t('hotel.title')}</p>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <div><p className="text-lg font-bold text-gray-900">82%</p><p className="text-[10px] text-gray-500">{t('hotel.occupancy')}</p></div>
          <div><p className="text-lg font-bold text-gray-900">6</p><p className="text-[10px] text-gray-500">{t('hotel.arrivalsToday')}</p></div>
          <div><p className="text-lg font-bold text-gray-900">4</p><p className="text-[10px] text-gray-500">{t('hotel.departuresToday')}</p></div>
        </div>
      </div>

      {/* phone: room service */}
      <div className="w-[270px] rounded-[2.5rem] border-[10px] border-gray-900 bg-gray-900 shadow-2xl">
        <div className="relative overflow-hidden rounded-[1.8rem] bg-white">
          <div className="absolute left-1/2 top-0 z-10 h-5 w-28 -translate-x-1/2 rounded-b-2xl bg-gray-900" />
          <div className="bg-[#0f766e] px-5 pb-4 pt-7 text-white">
            <div className="flex items-center gap-1.5 text-xs/none opacity-80"><ConciergeBell className="h-3.5 w-3.5" /> {t('roomService.title')}</div>
            <div className="mt-1 text-lg font-bold">{t('roomService.welcome', { name: 'Alex' })}</div>
            <div className="text-[11px] opacity-80">{t('hotel.room')} 412</div>
          </div>
          <div className="space-y-2 px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t('marketing.phonePopularSection')}</div>
            {items.map((it, i) => (
              <div key={it.name} className="flex items-center gap-3 rounded-xl border border-gray-100 p-2.5">
                <div className={`h-11 w-11 shrink-0 rounded-lg ${['bg-amber-100', 'bg-orange-100'][i]}`} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-gray-900">{it.name}</div>
                  <div className="text-xs text-gray-500">{it.price}</div>
                </div>
                <button className="h-7 w-7 rounded-full bg-[#0f766e] text-white flex items-center justify-center"><Plus className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
          <div className="px-4 pb-5">
            <div className="flex items-center justify-between rounded-xl bg-[#0f766e] px-4 py-3 text-white shadow-lg">
              <span className="text-sm font-medium">{t('roomService.addToRoom')}</span>
              <span className="text-sm font-bold">34.00</span>
            </div>
          </div>
        </div>
      </div>

      {/* review chip */}
      <div className="absolute -right-4 bottom-8 z-10 hidden sm:flex items-center gap-1 rounded-xl bg-white px-3 py-2 shadow-xl ring-1 ring-gray-100">
        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
        <span className="text-xs font-semibold text-gray-700">4.9</span>
      </div>
      <Sparkles className="absolute -left-2 bottom-24 h-5 w-5 text-[#0f766e]/40 hidden sm:block" />
    </div>
  );
}
