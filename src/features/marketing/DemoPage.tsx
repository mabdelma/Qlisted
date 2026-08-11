import { useI18n } from '../../contexts/I18nContext';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Check, Send } from 'lucide-react';
import { MarketingHeader } from '../../components/layout/MarketingHeader';
import { Footer } from '../../components/layout/Footer';
import { api } from '../../lib/api/client';

export function DemoPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: '',
    email: '',
    restaurant: '',
    phone: '',
    size: '',
    message: '',
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.post<{ id: string }>('/demo', form, { skipAuth: true });
      setStep('success');
    } catch {
      setError(t('demo.errorMessage'));
    } finally {
      setLoading(false);
    }
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-white">
        <MarketingHeader />
        <div className="max-w-lg mx-auto px-4 py-24 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{t('demo.successTitle')}</h1>
          <p className="text-lg text-gray-600 mb-8">
            {t('demo.successDesc')}
          </p>
          <p className="text-sm text-gray-500 mb-8">
            {t('demo.successExplorer')}{' '}
            <button onClick={() => navigate('/onboarding')} className="text-[#0f766e] underline hover:text-[#1e3a5f]">
              {t('demo.successWizardLink')}
            </button>{' '}
            {t('demo.successAfterLink')}
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-[#0f766e] text-white rounded-lg hover:bg-[#1e3a5f] transition-colors"
          >
            {t('demo.backToHome')}
          </button>
        </div>
        <Footer />
      </div>
    );
  }

  const sizeOptions = [
    t('demo.formSizeOption0'),
    t('demo.formSizeOption1'),
    t('demo.formSizeOption2'),
    t('demo.formSizeOption3'),
  ];

  return (
    <div className="min-h-screen bg-white">
      <MarketingHeader />

      <section className="bg-gradient-to-b from-amber-50 to-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">{t('demo.pageTitle')}</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {t('demo.pageDesc')}
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-lg mx-auto px-4 sm:px-6 lg:px-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="demo-name" className="block text-sm font-medium text-gray-700 mb-1">{t('demo.formName')}</label>
              <input id="demo-name" type="text" required value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-[#0f766e] focus:border-[#0f766e]"
                placeholder={t('demo.formNamePlaceholder')}
              />
            </div>
            <div>
              <label htmlFor="demo-email" className="block text-sm font-medium text-gray-700 mb-1">{t('demo.formEmail')}</label>
              <input id="demo-email" type="email" required value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-[#0f766e] focus:border-[#0f766e]"
                placeholder={t('demo.formEmailPlaceholder')}
              />
            </div>
            <div>
              <label htmlFor="demo-restaurant" className="block text-sm font-medium text-gray-700 mb-1">{t('demo.formRestaurant')}</label>
              <input id="demo-restaurant" type="text" required value={form.restaurant}
                onChange={(e) => setForm({ ...form, restaurant: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-[#0f766e] focus:border-[#0f766e]"
                placeholder={t('demo.formRestaurantPlaceholder')}
              />
            </div>
            <div>
              <label htmlFor="demo-phone" className="block text-sm font-medium text-gray-700 mb-1">{t('demo.formPhone')}</label>
              <input id="demo-phone" type="tel" value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-[#0f766e] focus:border-[#0f766e]"
                placeholder={t('demo.formPhonePlaceholder')}
              />
            </div>
            <div>
              <label htmlFor="demo-size" className="block text-sm font-medium text-gray-700 mb-1">{t('demo.formSize')}</label>
              <select id="demo-size" value={form.size} required
                onChange={(e) => setForm({ ...form, size: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-[#0f766e] focus:border-[#0f766e]"
              >
                <option value="">{t('demo.formSizePlaceholder')}</option>
                <option value="1-10">{sizeOptions[0]}</option>
                <option value="11-25">{sizeOptions[1]}</option>
                <option value="26-50">{sizeOptions[2]}</option>
                <option value="50+">{sizeOptions[3]}</option>
              </select>
            </div>
            <div>
              <label htmlFor="demo-message" className="block text-sm font-medium text-gray-700 mb-1">{t('demo.formMessage')}</label>
              <textarea id="demo-message" rows={3} value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-[#0f766e] focus:border-[#0f766e]"
                placeholder={t('demo.formMessagePlaceholder')}
              />
            </div>
            {error && <p className="text-sm text-red-600 text-center" role="alert">{error}</p>}
            <div className="flex items-center space-x-4 pt-2">
              <button
                type="submit" disabled={loading}
                className="flex-1 bg-[#0f766e] text-white py-3 rounded-lg font-medium hover:bg-[#1e3a5f] transition-colors disabled:opacity-50 flex items-center justify-center"
              >
                {loading ? t('demo.sending') : t('demo.requestDemo')}
                {!loading && <Send className="ml-2 h-4 w-4" />}
              </button>
              <button
                type="button" onClick={() => navigate('/onboarding')}
                className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                {t('demo.selfServiceSetup')}
              </button>
            </div>
          </form>
        </div>
      </section>

      <Footer />
    </div>
  );
}
