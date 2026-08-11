import { useI18n } from '../../contexts/I18nContext';
import { formatPrice } from '../../lib/pricing';
import { Link } from 'react-router';
import { Check } from 'lucide-react';
import { MarketingHeader } from '../../components/layout/MarketingHeader';
import { Footer } from '../../components/layout/Footer';

export function PricingPage() {
  const { t, locale } = useI18n();

  const plans = [
    {
      name: t('marketing.planStarterName'),
      price: formatPrice(29, locale),
      period: t('pricing.perMonth'),
      desc: t('pricing.planStarterDesc'),
      features: [
        t('pricing.planStarterFeature0'),
        t('pricing.planStarterFeature1'),
        t('pricing.planStarterFeature2'),
        t('pricing.planStarterFeature3'),
        t('pricing.planStarterFeature4'),
        t('pricing.planStarterFeature5'),
      ],
    },
    {
      name: t('marketing.planGrowthName'),
      price: formatPrice(79, locale),
      period: t('pricing.perMonth'),
      desc: t('pricing.planGrowthDesc'),
      features: [
        t('pricing.planGrowthFeature0'),
        t('pricing.planGrowthFeature1'),
        t('pricing.planGrowthFeature2'),
        t('pricing.planGrowthFeature3'),
        t('pricing.planGrowthFeature4'),
        t('pricing.planGrowthFeature5'),
        t('pricing.planGrowthFeature6'),
        t('pricing.planGrowthFeature7'),
      ],
      popular: true,
    },
    {
      name: t('marketing.planEnterpriseName'),
      price: formatPrice(199, locale),
      period: t('pricing.perMonth'),
      desc: t('pricing.planEnterpriseDesc'),
      features: [
        t('pricing.planEnterpriseFeature0'),
        t('pricing.planEnterpriseFeature1'),
        t('pricing.planEnterpriseFeature2'),
        t('pricing.planEnterpriseFeature3'),
        t('pricing.planEnterpriseFeature4'),
        t('pricing.planEnterpriseFeature5'),
        t('pricing.planEnterpriseFeature6'),
        t('pricing.planEnterpriseFeature7'),
      ],
    },
  ];

  const faqs = [
    { q: t('pricing.faq1Q'), a: t('pricing.faq1A') },
    { q: t('pricing.faq2Q'), a: t('pricing.faq2A') },
    { q: t('pricing.faq3Q'), a: t('pricing.faq3A') },
    { q: t('pricing.faq4Q'), a: t('pricing.faq4A') },
  ];

  return (
    <div className="min-h-screen bg-white">
      <MarketingHeader />

      <section className="bg-gradient-to-b from-amber-50 to-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-[#0f766e]/10 text-[#0f766e] mb-6">
            {t('nav.pricing')}
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">{t('pricing.pageTitle')}</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {t('pricing.pageDesc')}
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl border p-8 ${
                  plan.popular
                    ? 'border-[#0f766e] shadow-xl bg-white scale-105 z-10'
                    : 'border-gray-200 bg-white'
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#0f766e] text-white text-xs font-medium rounded-full whitespace-nowrap">
                    {t('marketing.mostPopular')}
                  </span>
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
                      <Check className="h-4 w-4 text-green-500 mr-2 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/demo"
                  className={`block text-center py-3 rounded-lg font-medium transition-colors ${
                    plan.popular
                      ? 'bg-[#0f766e] text-white hover:bg-[#1e3a5f]'
                      : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  {t('cta.startTrial')}
                </Link>
              </div>
            ))}
          </div>
          {locale !== 'en' && <p className="text-center text-xs text-gray-400 mt-8">{t('pricing.fxNote')}</p>}
        </div>
      </section>

      <section className="py-16 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">{t('pricing.faqTitle')}</h2>
          <div className="space-y-6">
            {faqs.map((faq) => (
              <div key={faq.q} className="bg-white rounded-lg p-6 border border-gray-100">
                <h3 className="font-medium text-gray-900 mb-2">{faq.q}</h3>
                <p className="text-sm text-gray-600">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
