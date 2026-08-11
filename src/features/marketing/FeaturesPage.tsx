import { useI18n } from '../../contexts/I18nContext';
import {
  Smartphone, CreditCard, Users, BarChart3, Bell,
  Globe, Clock, Printer, Sliders,
  Boxes, CalendarClock, Hotel, TrendingUp, Heart, Megaphone,
} from 'lucide-react';
import { MarketingHeader } from '../../components/layout/MarketingHeader';
import { Footer } from '../../components/layout/Footer';

export function FeaturesPage() {
  const { t } = useI18n();

  const featureGroups = [
    {
      title: t('features.groupCustomers'),
      items: [
        { icon: Smartphone, title: t('features.itemScanOrder'), desc: t('features.itemScanOrderDesc') },
        { icon: CreditCard, title: t('features.itemPayAtTable'), desc: t('features.itemPayAtTableDesc') },
        { icon: Clock, title: t('features.itemOrderTracking'), desc: t('features.itemOrderTrackingDesc') },
      ],
    },
    {
      title: t('features.groupStaff'),
      items: [
        { icon: Bell, title: t('features.itemKitchenDisplay'), desc: t('features.itemKitchenDisplayDesc') },
        { icon: Users, title: t('features.itemRoleManagement'), desc: t('features.itemRoleManagementDesc') },
        { icon: Globe, title: t('features.itemMultiTable'), desc: t('features.itemMultiTableDesc') },
      ],
    },
    {
      title: t('features.groupManagement'),
      items: [
        { icon: BarChart3, title: t('features.itemAnalytics'), desc: t('features.itemAnalyticsDesc') },
        { icon: Sliders, title: t('features.itemMenuManagement'), desc: t('features.itemMenuManagementDesc') },
        { icon: Printer, title: t('features.itemPaymentLinks'), desc: t('features.itemPaymentLinksDesc') },
      ],
    },
    {
      title: t('features.groupOperations'),
      items: [
        { icon: Boxes, title: t('marketing.featureInventory'), desc: t('marketing.featureInventoryDesc') },
        { icon: CalendarClock, title: t('marketing.featureScheduling'), desc: t('marketing.featureSchedulingDesc') },
        { icon: Hotel, title: t('marketing.featureHotel'), desc: t('marketing.featureHotelDesc') },
      ],
    },
    {
      title: t('features.groupGrowth'),
      items: [
        { icon: TrendingUp, title: t('marketing.featureForecasting'), desc: t('marketing.featureForecastingDesc') },
        { icon: Heart, title: t('marketing.featureCrm'), desc: t('marketing.featureCrmDesc') },
        { icon: Megaphone, title: t('marketing.featureMarketing'), desc: t('marketing.featureMarketingDesc') },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <MarketingHeader />

      <section className="bg-gradient-to-b from-amber-50 to-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">{t('features.pageTitle')}</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {t('features.pageDesc')}
          </p>
        </div>
      </section>

      {featureGroups.map((group) => (
        <section key={group.title} className="py-16 border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-10">{group.title}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {group.items.map((item) => (
                <div key={item.title} className="bg-white rounded-xl border border-gray-100 p-6">
                  <div className="w-12 h-12 bg-[#0f766e]/10 rounded-lg flex items-center justify-center mb-4">
                    <item.icon className="h-6 w-6 text-[#0f766e]" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}

      <Footer />
    </div>
  );
}
