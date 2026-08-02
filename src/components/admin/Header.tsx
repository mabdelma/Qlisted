import React from 'react';
import { User, Settings, LogOut, Menu, ExternalLink } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router';
import { NotificationsBell } from '../ui/NotificationsBell';
import { LanguageSwitcher } from '../ui/LanguageSwitcher';
import { Input } from '../ui/Input';
import { useI18n } from '../../contexts/I18nContext';
import { Search } from 'lucide-react';

interface HeaderProps {
  username?: string;
  onMenuClick?: () => void;
}

export function Header({ username = 'Admin User', onMenuClick }: HeaderProps) {
  const { t } = useI18n();
  const [showProfileMenu, setShowProfileMenu] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const { state, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/signin');
  };

  React.useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    }
    if (showProfileMenu) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [showProfileMenu]);

  return (
    <header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="flex h-16 max-w-full items-center justify-between gap-2 px-4">
        <button onClick={onMenuClick} className="lg:hidden p-2 -ms-2 shrink-0 text-gray-600 dark:text-gray-300" aria-label="Open menu"><Menu className="h-6 w-6" /></button>
        <div className="relative hidden w-full max-w-96 sm:block">
          <Input
            type="text"
            name="global-search"
            placeholder={t('common.search')}
            size="md"
            aria-label={t('common.search')}
            leftIcon={<Search className="h-4 w-4" />}
          />
        </div>

        <div className="flex items-center space-x-2 sm:space-x-4">
          {state.tenant?.slug && (
            <a
              href={`/r/${state.tenant.slug}`}
              target="_blank"
              rel="noreferrer"
              title={t('nav.viewStorefrontHint')}
              aria-label={t('nav.viewStorefront')}
              className="flex items-center gap-1.5 rounded-lg border border-brand-500 px-2.5 sm:px-3 py-1.5 text-sm font-medium text-brand-600 transition-colors hover:bg-brand-50 dark:border-brand-400 dark:text-brand-300 dark:hover:bg-brand-900/40"
            >
              <ExternalLink className="h-4 w-4" /> <span className="hidden sm:inline">{t('nav.viewStorefront')}</span>
            </a>
          )}
          <LanguageSwitcher />
          <NotificationsBell />

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center space-x-2 focus:outline-none"
              aria-expanded={showProfileMenu}
              aria-haspopup="true"
              aria-label="Profile menu"
            >
              <span className="hidden text-sm font-medium text-gray-700 dark:text-gray-200 sm:block">{state.user?.name || username}</span>
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900">
                {state.user?.avatar ? (
                  <img
                    src={state.user.avatar}
                    alt={state.user.name}
                    width="32"
                    height="32"
                    loading="lazy"
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <User className="w-5 h-5 text-brand-700 dark:text-brand-200" aria-hidden />
                )}
              </div>
            </button>

            {showProfileMenu && (
              <div className="absolute end-0 mt-2 w-48 bg-white rounded-md shadow-popover py-1 z-50 border border-gray-100 dark:bg-gray-900 dark:border-gray-800 animate-scale-in">
                <button
                  onClick={() => {
                    navigate('/admin/profile');
                    setShowProfileMenu(false);
                  }}
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  <Settings className="w-4 h-4 me-2" aria-hidden />
                  {t('staff.profileSettings')}
                </button>
                <button
                  onClick={handleLogout}
                  className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:text-red-400 dark:hover:bg-gray-800"
                >
                  <LogOut className="w-4 h-4 me-2" aria-hidden />
                  {t('staff.signOut')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
