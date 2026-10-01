import { Menu, User } from 'lucide-react';
import { useI18n } from '../../contexts/I18nContext';

interface HeaderProps {
  role?: 'customer' | 'waiter' | 'kitchen' | 'admin';
  onMenuClick: () => void;
}

export function Header({ role = 'customer', onMenuClick }: HeaderProps) {
  const { t } = useI18n();
  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center">
            <button
              onClick={onMenuClick}
              className="p-2 rounded-md hover:bg-gray-100"
              aria-label={t('nav.menu')}
            >
              <Menu className="h-6 w-6 text-gray-600" aria-hidden />
            </button>
            <h1 className="ml-4 text-xl font-semibold text-gray-900">
              {t('app.name')}
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            {role !== 'customer' && (
              <span className="px-3 py-1 rounded-full text-sm font-medium capitalize bg-blue-100 text-blue-800">
                {role}
              </span>
            )}
            <button
              className="p-2 rounded-md hover:bg-gray-100"
              aria-label={t('settings.profile')}
            >
              <User className="h-6 w-6 text-gray-600" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}