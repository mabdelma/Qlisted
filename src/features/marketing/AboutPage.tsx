import { useI18n } from '../../contexts/I18nContext';
import { Link } from 'react-router';
import {
  Sparkles, QrCode, Settings2, TrendingUp, ShieldCheck, Globe, Zap,
  ArrowRight, Building2,
} from 'lucide-react';
import { MarketingHeader } from '../../components/layout/MarketingHeader';
import { Footer } from '../../components/layout/Footer';

export function AboutPage() {
  const { t } = useI18n();

  const stats = [
    { value: '300+', label: t('marketing.statRestaurants') },
    { value: '1.2M+', label: t('marketing.statOrdersServed') },
    { value: '30%', label: t('marketing.statFasterTurnover') },
    { value: '4.9★', label: t('marketing.statOwnerRating') },
  ];

  const pillars = [
    { icon: QrCode, title: t('about.pillar1Title'), desc: t('about.pillar1Desc') },
    { icon: Settings2, title: t('about.pillar2Title'), desc: t('about.pillar2Desc') },
    { icon: TrendingUp, title: t('about.pillar3Title'), desc: t('about.pillar3Desc') },
  ];

  const values = [
    { icon: ShieldCheck, title: t('about.value1Title'), desc: t('about.value1Desc') },
    { icon: Globe, title: t('about.value2Title'), desc: t('about.value2Desc') },
    { icon: Zap, title: t('about.value3Title'), desc: t('about.value3Desc') },
  ];

  return (
    <div className="min-h-screen bg-white">
      <MarketingHeader />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-amber-50 via-white to-white">
        <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-[#0f766e]/10 blur-3xl" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-[#0f766e]/10 text-[#0f766e] mb-6">
            <Sparkles className="h-3.5 w-3.5 fill-current" /> {t('about.heroBadge')}
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight mb-6">{t('about.heroTitle')}</h1>
          <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto">{t('about.heroDesc')}</p>
        </div>
        <div className="relative border-t border-gray-100 bg-white/60 backdrop-blur">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {stats.map((s) => (
              <div key={s.label}>
                <div className="text-3xl font-bold text-[#0f766e]">{s.value}</div>
                <div className="text-sm text-gray-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Mission ──────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">{t('about.missionTitle')}</h2>
          <p className="text-lg text-gray-600 leading-relaxed">{t('about.missionBody')}</p>
        </div>
      </section>

      {/* ── What Qlisted does ────────────────────────────────────────────── */}
      <section className="py-20 md:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{t('about.offerTitle')}</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">{t('about.offerDesc')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {pillars.map((p, i) => (
              <div key={p.title} className="relative bg-white rounded-2xl border border-gray-100 p-6">
                <div className="w-12 h-12 bg-[#0f766e]/10 rounded-xl flex items-center justify-center mb-4">
                  <p.icon className="h-6 w-6 text-[#0f766e]" />
                </div>
                <div className="text-xs font-semibold text-[#0f766e] tracking-widest mb-2">{String(i + 1).padStart(2, '0')}</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{p.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Values ───────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">{t('about.valuesTitle')}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {values.map((v) => (
              <div key={v.title} className="text-center px-4">
                <div className="w-14 h-14 bg-[#0f766e] rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-[#0f766e]/20">
                  <v.icon className="h-7 w-7 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{v.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed max-w-xs mx-auto">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Built by ─────────────────────────────────────────────────────── */}
      <section className="py-16 bg-gray-50 border-y border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="w-12 h-12 bg-white border border-gray-200 rounded-xl flex items-center justify-center mx-auto mb-5">
            <Building2 className="h-6 w-6 text-[#0f766e]" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">{t('about.builtByTitle')}</h2>
          <p className="text-gray-600 leading-relaxed">{t('about.builtByBody')}</p>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-24 bg-[#0f766e] relative overflow-hidden">
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">{t('marketing.ctaTitle')}</h2>
          <p className="text-lg text-amber-100 mb-10 max-w-2xl mx-auto">{t('marketing.ctaDesc')}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/onboarding" className="inline-flex items-center justify-center px-8 py-3.5 bg-white text-[#0f766e] font-medium rounded-lg hover:bg-amber-50 transition-colors text-lg">
              {t('cta.startTrial')} <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
            <Link to="/features" className="inline-flex items-center justify-center px-8 py-3.5 border border-white/40 text-white font-medium rounded-lg hover:bg-white/10 transition-colors text-lg">
              {t('nav.features')}
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
