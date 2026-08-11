import { Link } from 'react-router';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '../../contexts/I18nContext';
import { LanguageSwitcher } from '../ui/LanguageSwitcher';
import { Logo } from '../ui/Logo';

export function MarketingHeader() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const navLinks = [
    { to: '/features', label: t('nav.features') },
    { to: '/restaurants', label: t('nav.restaurants') },
    { to: '/hotels', label: t('nav.hotels') },
    { to: '/pricing', label: t('nav.pricing') },
    { to: '/about', label: t('nav.about') },
    { to: '/contact', label: t('nav.contact') },
    { to: '/demo', label: t('cta.bookDemo') },
  ];

  return (
    <header className="bg-white/95 backdrop-blur border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center">
            <Logo size={34} />
          </Link>

          <nav className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="text-sm font-medium text-gray-600 hover:text-[#0f766e] transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <Link
              to="/signin"
              className="text-sm font-medium text-gray-600 hover:text-[#0f766e] transition-colors"
            >
              {t('cta.signIn')}
            </Link>
            <LanguageSwitcher />
            <Link
              to="/onboarding"
              className="px-4 py-2 bg-[#0f766e] text-white text-sm font-medium rounded-lg hover:bg-[#1e3a5f] transition-colors"
            >
              {t('cta.getStarted')}
            </Link>
          </nav>

          <div className="flex items-center gap-1 md:hidden">
            <LanguageSwitcher />
            <button className="p-2" onClick={() => setOpen(!open)} aria-label={t('nav.menu')} aria-expanded={open}>
              {open ? <X className="h-6 w-6" aria-hidden /> : <Menu className="h-6 w-6" aria-hidden />}
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-gray-100 bg-white" role="navigation" aria-label="Mobile navigation">
          <div className="px-4 py-4 space-y-3">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setOpen(false)}
                className="block text-sm font-medium text-gray-600 hover:text-[#0f766e] py-2"
              >
                {link.label}
              </Link>
            ))}
            <Link
              to="/signin"
              onClick={() => setOpen(false)}
              className="block text-sm font-medium text-gray-600 hover:text-[#0f766e] py-2"
            >
              {t('cta.signIn')}
            </Link>
            <Link
              to="/onboarding"
              onClick={() => setOpen(false)}
              className="block text-center px-4 py-2 bg-[#0f766e] text-white text-sm font-medium rounded-lg"
            >
              {t('cta.getStarted')}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
