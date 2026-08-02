import { Outlet, useNavigate, useLocation } from 'react-router';
import { useI18n } from '../../contexts/I18nContext';

export function Analytics() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const pathParts = location.pathname.split('/');
  const activeSub = pathParts[3] || '';

  const tabs = [
    { id: '', label: t('nav.dashboard') },
    { id: 'sales', label: t('nav.reports') },
    { id: 'insights', label: t('analytics.insights') },
    { id: 'exports', label: t('analytics.exports') },
  ];

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 dark:border-gray-800">
        <div className="flex gap-x-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => navigate(`/admin/analytics/${tab.id}`)}
              aria-current={activeSub === tab.id ? 'page' : undefined}
              className={`whitespace-nowrap border-b-2 pb-2 text-sm font-medium transition-colors ${
                activeSub === tab.id
                  ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <Outlet />
    </div>
  );
}
