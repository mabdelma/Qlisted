import { useI18n } from '../../contexts/I18nContext';
import { formatPrice } from '../../lib/pricing';
import { Link } from 'react-router';
import {
  QrCode, CreditCard, Clock, Users, ArrowRight, Shield, BarChart3,
  Check, Star, Zap, Utensils, ChevronDown, Sparkles, Bot, Send,
  Boxes, TrendingUp, CalendarClock, Heart, Megaphone, Hotel, ConciergeBell,
} from 'lucide-react';
import { MarketingHeader } from '../../components/layout/MarketingHeader';
import { Footer } from '../../components/layout/Footer';

export function MarketingLanding() {
  const { t, locale } = useI18n();

  const stats = [
    { value: '300+', label: t('marketing.statRestaurants') },
    { value: '1.2M+', label: t('marketing.statOrdersServed') },
    { value: '30%', label: t('marketing.statFasterTurnover') },
    { value: '4.9\u2605', label: t('marketing.statOwnerRating') },
  ];

  const features = [
    { icon: QrCode, title: t('marketing.featureQrCode'), desc: t('marketing.featureQrCodeDesc') },
    { icon: CreditCard, title: t('marketing.featurePayments'), desc: t('marketing.featurePaymentsDesc') },
    { icon: Clock, title: t('marketing.featureKitchen'), desc: t('marketing.featureKitchenDesc') },
    { icon: Users, title: t('marketing.featureStaff'), desc: t('marketing.featureStaffDesc') },
    { icon: CalendarClock, title: t('marketing.featureScheduling'), desc: t('marketing.featureSchedulingDesc') },
    { icon: Boxes, title: t('marketing.featureInventory'), desc: t('marketing.featureInventoryDesc') },
    { icon: BarChart3, title: t('marketing.featureAnalytics'), desc: t('marketing.featureAnalyticsDesc') },
    { icon: TrendingUp, title: t('marketing.featureForecasting'), desc: t('marketing.featureForecastingDesc') },
    { icon: Heart, title: t('marketing.featureCrm'), desc: t('marketing.featureCrmDesc') },
    { icon: Megaphone, title: t('marketing.featureMarketing'), desc: t('marketing.featureMarketingDesc') },
    { icon: Hotel, title: t('marketing.featureHotel'), desc: t('marketing.featureHotelDesc') },
    { icon: ConciergeBell, title: t('marketing.featureRoomService'), desc: t('marketing.featureRoomServiceDesc') },
    { icon: Shield, title: t('marketing.featureMultiLocation'), desc: t('marketing.featureMultiLocationDesc') },
  ];

  // Compact strip of the remaining capabilities (reuses existing localized labels).
  const alsoIncluded = [
    t('reservations.title'), t('waitlist.title'), t('nav.loyalty'), t('giftCards.title'),
    t('nav.promotions'), t('hotel.folio'), t('hotel.calendar'), t('hotel.occupancy'),
  ];

  const steps = [
    { num: '01', icon: Utensils, title: t('marketing.stepMenu'), desc: t('marketing.stepMenuDesc') },
    { num: '02', icon: QrCode, title: t('marketing.stepPrintQr'), desc: t('marketing.stepPrintQrDesc') },
    { num: '03', icon: Zap, title: t('marketing.stepStartServing'), desc: t('marketing.stepStartServingDesc') },
  ];

  const plans = [
    { name: t('marketing.planStarterName'), price: formatPrice(29, locale), period: t('pricing.perMonth'), desc: t('marketing.planStarterDesc'), features: [t('marketing.planStarterFeature0'), t('marketing.planStarterFeature1'), t('marketing.planStarterFeature2'), t('marketing.planStarterFeature3')] },
    { name: t('marketing.planGrowthName'), price: formatPrice(79, locale), period: t('pricing.perMonth'), desc: t('marketing.planGrowthDesc'), features: [t('marketing.planGrowthFeature0'), t('marketing.planGrowthFeature1'), t('marketing.planGrowthFeature2'), t('marketing.planGrowthFeature3'), t('marketing.planGrowthFeature4')], popular: true },
    { name: t('marketing.planEnterpriseName'), price: formatPrice(199, locale), period: t('pricing.perMonth'), desc: t('marketing.planEnterpriseDesc'), features: [t('marketing.planEnterpriseFeature0'), t('marketing.planEnterpriseFeature1'), t('marketing.planEnterpriseFeature2'), t('marketing.planEnterpriseFeature3'), t('marketing.planEnterpriseFeature4')] },
  ];

  const testimonials = [
    { quote: t('marketing.testimonial1Quote'), name: t('marketing.testimonial1Name'), role: t('marketing.testimonial1Role') },
    { quote: t('marketing.testimonial2Quote'), name: t('marketing.testimonial2Name'), role: t('marketing.testimonial2Role') },
    { quote: t('marketing.testimonial3Quote'), name: t('marketing.testimonial3Name'), role: t('marketing.testimonial3Role') },
  ];

  const faqs = [
    { q: t('marketing.faq1Q'), a: t('marketing.faq1A') },
    { q: t('marketing.faq2Q'), a: t('marketing.faq2A') },
    { q: t('marketing.faq3Q'), a: t('marketing.faq3A') },
    { q: t('marketing.faq4Q'), a: t('marketing.faq4A') },
  ];

  return (
    <div className="min-h-screen bg-white">
      <MarketingHeader />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-amber-50 via-white to-white">
        {/* decorative blobs */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-[#8B4513]/10 blur-3xl" />
        <div className="pointer-events-none absolute top-40 -left-24 h-80 w-80 rounded-full bg-amber-200/40 blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 md:pt-24 md:pb-28">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-left">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-[#8B4513]/10 text-[#8B4513] mb-6">
                <Star className="h-3.5 w-3.5 fill-current" /> {t('marketing.trustedBy')}
              </span>
              <h1 className="text-4xl md:text-6xl font-bold text-gray-900 tracking-tight mb-6">
                {t('marketing.heroTitle')}
              </h1>
              <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-xl mx-auto lg:mx-0">
                {t('marketing.heroDesc')}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link to="/onboarding" className="inline-flex items-center justify-center px-8 py-3.5 bg-[#8B4513] text-white font-medium rounded-lg hover:bg-[#5C4033] transition-colors text-lg shadow-sm">
                  {t('cta.startTrial')} <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
                <Link to="/demo" className="inline-flex items-center justify-center px-8 py-3.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors text-lg">
                  {t('cta.bookDemo')}
                </Link>
              </div>
              <p className="mt-5 text-sm text-gray-500 flex flex-wrap items-center gap-x-2 gap-y-1 justify-center lg:justify-start">
                <Check className="h-4 w-4 text-green-600" /> {t('marketing.noCreditCard')}
                <Link to="/pricing" className="font-medium text-[#8B4513] hover:underline">· {t('nav.pricing')}</Link>
              </p>
            </div>

            {/* Phone mockup */}
            <div className="flex justify-center lg:justify-end">
              <PhoneMockup />
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="relative border-t border-gray-100 bg-white/60 backdrop-blur">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {stats.map((s) => (
              <div key={s.label}>
                <div className="text-3xl font-bold text-[#8B4513]">{s.value}</div>
                <div className="text-sm text-gray-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{t('marketing.featuresTitle')}</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">{t('marketing.featuresDesc')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="group bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-xl hover:border-[#8B4513]/20 hover:-translate-y-1 transition-all">
                <div className="w-12 h-12 bg-[#8B4513]/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-[#8B4513] transition-colors">
                  <f.icon className="h-6 w-6 text-[#8B4513] group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* Everything-else capabilities strip */}
          <div className="mt-12 text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-[#8B4513] mb-4">{t('marketing.alsoTitle')}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {alsoIncluded.map((label) => (
                <span key={label} className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3.5 py-1.5 text-sm text-gray-700">
                  <Check className="h-3.5 w-3.5 text-green-600" /> {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{t('marketing.howItWorksTitle')}</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">{t('marketing.howItWorksDesc')}</p>
          </div>
          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="hidden md:block absolute top-8 left-[16.66%] right-[16.66%] h-px bg-gradient-to-r from-[#8B4513]/30 via-[#8B4513]/30 to-[#8B4513]/30" />
            {steps.map((s) => (
              <div key={s.num} className="relative text-center">
                <div className="w-16 h-16 bg-[#8B4513] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-[#8B4513]/20">
                  <s.icon className="h-7 w-7 text-white" />
                </div>
                <div className="text-xs font-semibold text-[#8B4513] tracking-widest mb-2">{t('marketing.stepLabel', { num: s.num })}</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{s.title}</h3>
                <p className="text-gray-600 max-w-xs mx-auto">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Showcase ────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-14 items-center">
          <div className="order-2 lg:order-1">
            <DashboardMockup />
          </div>
          <div className="order-1 lg:order-2">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">{t('marketing.showcaseTitle')}</h2>
            <p className="text-lg text-gray-600 mb-8">
              {t('marketing.showcaseDesc')}
            </p>
            <ul className="space-y-4">
              {[
                t('marketing.showcaseItem1'),
                t('marketing.showcaseItem2'),
                t('marketing.showcaseItem3'),
                t('marketing.showcaseItem4'),
              ].map((b) => (
                <li key={b} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100">
                    <Check className="h-4 w-4 text-green-600" />
                  </span>
                  <span className="text-gray-700">{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── AI copilot ──────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-gradient-to-b from-white to-amber-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-[#8B4513]/10 text-[#8B4513] mb-6">
              <Sparkles className="h-3.5 w-3.5 fill-current" /> {t('marketing.aiBadge')}
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">{t('marketing.aiTitle')}</h2>
            <p className="text-lg text-gray-600 mb-8">{t('marketing.aiDesc')}</p>
            <ul className="space-y-4">
              {[t('marketing.aiItem1'), t('marketing.aiItem2'), t('marketing.aiItem3')].map((b) => (
                <li key={b} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#8B4513]/10">
                    <Check className="h-4 w-4 text-[#8B4513]" />
                  </span>
                  <span className="text-gray-700">{b}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="w-full max-w-md lg:justify-self-end">
            <AiChatMockup />
          </div>
        </div>
      </section>

      {/* ── Testimonials ────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{t('marketing.testimonialsTitle')}</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">{t('marketing.testimonialsDesc')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((tItem) => (
              <figure key={tItem.name} className="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col">
                <div className="flex gap-1 mb-4 text-amber-400">
                  {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}
                </div>
                <blockquote className="text-gray-700 leading-relaxed flex-1">"{tItem.quote}"</blockquote>
                <figcaption className="mt-6 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-[#8B4513]/10 text-[#8B4513] flex items-center justify-center font-semibold">
                    {tItem.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{tItem.name}</div>
                    <div className="text-xs text-gray-500">{tItem.role}</div>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{t('marketing.pricingTitle')}</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">{t('marketing.pricingDesc')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto items-start">
            {plans.map((plan) => (
              <div key={plan.name} className={`relative rounded-2xl border p-8 bg-white ${plan.popular ? 'border-[#8B4513] shadow-xl md:scale-105' : 'border-gray-200'}`}>
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#8B4513] text-white text-xs font-medium rounded-full">{t('marketing.mostPopular')}</span>
                )}
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{plan.name}</h3>
                <p className="text-sm text-gray-600 mb-4">{plan.desc}</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                  <span className="text-gray-500">{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start text-sm text-gray-600">
                      <Check className="h-4 w-4 text-green-600 mr-2 mt-0.5 shrink-0" />{f}
                    </li>
                  ))}
                </ul>
                <Link to="/onboarding" className={`block text-center py-3 rounded-lg font-medium transition-colors ${plan.popular ? 'bg-[#8B4513] text-white hover:bg-[#5C4033]' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`}>
                  {t('cta.getStarted')}
                </Link>
              </div>
            ))}
          </div>
          {locale !== 'en' && <p className="text-center text-xs text-gray-400 mt-6">{t('pricing.fxNote')}</p>}
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{t('marketing.faqTitle')}</h2>
          </div>
          <div className="space-y-3">
            {faqs.map((f) => (
              <details key={f.q} className="group bg-white rounded-xl border border-gray-100 p-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer items-center justify-between font-medium text-gray-900">
                  {f.q}
                  <ChevronDown className="h-5 w-5 text-gray-400 transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-sm text-gray-600 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-[#8B4513] relative overflow-hidden">
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">{t('marketing.ctaTitle')}</h2>
          <p className="text-lg text-amber-100 mb-10 max-w-2xl mx-auto">{t('marketing.ctaDesc')}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/onboarding" className="inline-flex items-center justify-center px-8 py-3.5 bg-white text-[#8B4513] font-medium rounded-lg hover:bg-amber-50 transition-colors text-lg">
              {t('cta.startTrial')} <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
            <Link to="/demo" className="inline-flex items-center justify-center px-8 py-3.5 border border-white/40 text-white font-medium rounded-lg hover:bg-white/10 transition-colors text-lg">
              {t('cta.bookDemo')}
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

/* ── CSS-only phone mockup (no external images) ───────────────────────────── */
function PhoneMockup() {
  const { t } = useI18n();
  const items = [
    { name: t('marketing.phoneItemBurger'), price: '12.99' },
    { name: t('marketing.phoneItemPizza'), price: '14.99' },
    { name: t('marketing.phoneItemLemonade'), price: '4.99' },
  ];
  return (
    <div className="relative">
      {/* floating QR chip */}
      <div className="absolute -left-6 top-10 z-10 hidden sm:flex flex-col items-center gap-1 rounded-xl bg-white p-3 shadow-xl ring-1 ring-gray-100">
        <QrCode className="h-10 w-10 text-[#8B4513]" />
        <span className="text-[10px] font-medium text-gray-500">{t('marketing.scanToOrder')}</span>
      </div>

      <div className="w-[270px] rounded-[2.5rem] border-[10px] border-gray-900 bg-gray-900 shadow-2xl">
        <div className="relative overflow-hidden rounded-[1.8rem] bg-white">
          {/* notch */}
          <div className="absolute left-1/2 top-0 z-10 h-5 w-28 -translate-x-1/2 rounded-b-2xl bg-gray-900" />
          {/* app header */}
          <div className="bg-[#8B4513] px-5 pb-4 pt-7 text-white">
            <div className="text-xs/none opacity-80">{t('marketing.phoneTableDineIn', { num: '4' })}</div>
            <div className="mt-1 text-lg font-bold">{t('marketing.phoneDemoCafe')}</div>
          </div>
          {/* menu */}
          <div className="space-y-2 px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t('marketing.phonePopularSection')}</div>
            {items.map((it, i) => (
              <div key={it.name} className="flex items-center gap-3 rounded-xl border border-gray-100 p-2.5">
                <div className={`h-11 w-11 shrink-0 rounded-lg ${['bg-amber-100', 'bg-orange-100', 'bg-yellow-100'][i]}`} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-gray-900">{it.name}</div>
                  <div className="text-xs text-gray-500">${it.price}</div>
                </div>
                <button className="h-7 w-7 rounded-full bg-[#8B4513] text-base font-bold leading-none text-white">+</button>
              </div>
            ))}
          </div>
          {/* cart bar */}
          <div className="px-4 pb-5">
            <div className="flex items-center justify-between rounded-xl bg-[#8B4513] px-4 py-3 text-white shadow-lg">
              <span className="text-sm font-medium">{t('marketing.phoneViewCart', { count: '3' })}</span>
              <span className="text-sm font-bold">$32.97</span>
            </div>
          </div>
        </div>
      </div>

      {/* floating front-desk card — restaurants AND hotels on one platform */}
      <div className="absolute -right-6 bottom-6 z-10 hidden sm:block rounded-2xl bg-white p-3.5 shadow-xl ring-1 ring-gray-100 w-48">
        <p className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500"><Hotel className="h-3.5 w-3.5 text-[#8B4513]" /> {t('hotel.title')}</p>
        <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
          <div><p className="text-base font-bold text-gray-900">82%</p><p className="text-[9px] text-gray-500">{t('hotel.occupancy')}</p></div>
          <div><p className="text-base font-bold text-gray-900">6</p><p className="text-[9px] text-gray-500 truncate">{t('hotel.arrivalsToday')}</p></div>
          <div><p className="text-base font-bold text-gray-900">4</p><p className="text-[9px] text-gray-500 truncate">{t('hotel.departuresToday')}</p></div>
        </div>
      </div>
    </div>
  );
}

/* ── CSS-only AI copilot chat mockup ──────────────────────────────────────── */
function AiChatMockup() {
  const { t } = useI18n();
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xl">
      <div className="mb-4 flex items-center gap-2 border-b border-gray-100 pb-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-white">
          <Sparkles className="h-4 w-4" />
        </span>
        <span className="text-sm font-semibold text-gray-900">{t('marketing.aiBadge')}</span>
      </div>
      <div className="space-y-3">
        <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-brand-500 px-4 py-2.5 text-sm text-white">
          {t('marketing.aiChatUser')}
        </div>
        <div className="flex max-w-[92%] items-start gap-2">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-brand-500">
            <Bot className="h-4 w-4" />
          </span>
          <div className="rounded-2xl rounded-bl-sm bg-gray-100 px-4 py-2.5 text-sm text-gray-800">
            {t('marketing.aiChatBot')}
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2">
        <span className="flex-1 truncate text-sm text-gray-400">{t('marketing.aiChatPlaceholder')}</span>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-white">
          <Send className="h-3.5 w-3.5" />
        </span>
      </div>
    </div>
  );
}

/* ── CSS-only dashboard mockup ────────────────────────────────────────────── */
function DashboardMockup() {
  const { t } = useI18n();
  const bars = [40, 65, 50, 80, 60, 95, 75];
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xl">
      <div className="mb-4 flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
        <span className="ml-3 text-xs text-gray-400">qlisted.com/dashboard</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[{ l: t('marketing.statTodaySales'), v: '$1,284' }, { l: t('marketing.statOrders'), v: '96' }, { l: t('marketing.statAvgTicket'), v: '$13.4' }].map((k) => (
          <div key={k.l} className="rounded-xl bg-gray-50 p-3">
            <div className="text-[11px] text-gray-500">{k.l}</div>
            <div className="text-lg font-bold text-gray-900">{k.v}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-xl border border-gray-100 p-4">
        <div className="mb-3 text-xs font-medium text-gray-500">{t('marketing.statRevenueWeek')}</div>
        <div className="flex h-28 items-end gap-2">
          {bars.map((h, i) => (
            <div key={i} className="flex-1 rounded-t-md bg-[#8B4513]/80" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
