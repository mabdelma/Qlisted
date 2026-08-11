import { useI18n, type TranslationKey } from '../../contexts/I18nContext';
import { useState } from 'react';
import { Mail, Phone, MapPin, Send } from 'lucide-react';
import { MarketingHeader } from '../../components/layout/MarketingHeader';
import { Footer } from '../../components/layout/Footer';

const contactInfo = [
  {
    icon: Mail,
    labelKey: 'contact.email',
    items: [{ text: 'infor@qcart.com', href: 'mailto:infor@qcart.com' }],
  },
  {
    icon: Phone,
    labelKey: 'contact.phone',
    items: [
      { text: '+971 56 827 9154', href: 'tel:+971568279154' },
      { text: '+34 637 592 801', href: 'tel:+34637592801' },
    ],
  },
  {
    icon: MapPin,
    labelKey: 'contact.location',
    items: [
      { text: 'Abu Dhabi, UAE' },
      { text: 'Valladolid, Spain' },
    ],
  },
];

export function ContactPage() {
  const { t } = useI18n();
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSent(true);
  }

  return (
    <div className="min-h-screen bg-white">
      <MarketingHeader />

      <section className="bg-gradient-to-b from-amber-50 to-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">{t('contact.pageTitle')}</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {t('contact.pageDesc')}
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            {contactInfo.map((item) => (
              <div key={item.labelKey} className="text-center p-6 bg-gray-50 rounded-xl">
                <div className="w-12 h-12 bg-[#0f766e]/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <item.icon className="h-6 w-6 text-[#0f766e]" />
                </div>
                <h3 className="font-medium text-gray-900 mb-1">{t(item.labelKey as TranslationKey)}</h3>
                <div className="space-y-1">
                  {item.items.map((c) => (
                    <p key={c.text} className="text-sm text-gray-600">
                      {'href' in c && c.href
                        ? <a href={c.href} className="hover:text-[#0f766e] transition-colors">{c.text}</a>
                        : c.text}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="max-w-2xl mx-auto">
            {sent ? (
              <div className="text-center p-12 bg-green-50 rounded-xl">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Send className="h-8 w-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">{t('contact.successTitle')}</h2>
                <p className="text-gray-600">{t('contact.successDesc')}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="contact-name" className="block text-sm font-medium text-gray-700 mb-1">{t('contact.formName')}</label>
                    <input id="contact-name" type="text" required className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-[#0f766e] focus:border-[#0f766e]" placeholder={t('contact.formNamePlaceholder')} />
                  </div>
                  <div>
                    <label htmlFor="contact-email" className="block text-sm font-medium text-gray-700 mb-1">{t('contact.formEmail')}</label>
                    <input id="contact-email" type="email" required className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-[#0f766e] focus:border-[#0f766e]" placeholder={t('contact.formEmailPlaceholder')} />
                  </div>
                </div>
                <div>
                  <label htmlFor="contact-subject" className="block text-sm font-medium text-gray-700 mb-1">{t('contact.formSubject')}</label>
                  <input id="contact-subject" type="text" required className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-[#0f766e] focus:border-[#0f766e]" placeholder={t('contact.formSubjectPlaceholder')} />
                </div>
                <div>
                  <label htmlFor="contact-message" className="block text-sm font-medium text-gray-700 mb-1">{t('contact.formMessage')}</label>
                  <textarea id="contact-message" rows={5} required className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-[#0f766e] focus:border-[#0f766e]" placeholder={t('contact.formMessagePlaceholder')} />
                </div>
                <button type="submit" className="w-full bg-[#0f766e] text-white py-3 rounded-lg font-medium hover:bg-[#1e3a5f] transition-colors">
                  {t('contact.sendMessage')}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
