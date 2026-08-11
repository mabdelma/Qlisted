import { Link } from 'react-router';
import { Compass, ArrowRight } from 'lucide-react';
import { useI18n } from '../../contexts/I18nContext';
import { MarketingHeader } from '../../components/layout/MarketingHeader';
import { Footer } from '../../components/layout/Footer';

export function NotFoundPage() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <MarketingHeader />
      <main className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-[#0f766e]/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Compass className="h-8 w-8 text-[#0f766e]" />
          </div>
          <p className="text-6xl font-bold text-[#0f766e] mb-3">404</p>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">{t('notFound.title')}</h1>
          <p className="text-gray-600 mb-8">{t('notFound.desc')}</p>
          <Link to="/" className="inline-flex items-center justify-center px-6 py-3 bg-[#0f766e] text-white font-medium rounded-lg hover:bg-[#1e3a5f] transition-colors">
            {t('notFound.back')} <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
