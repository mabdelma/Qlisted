import { X, Bell } from 'lucide-react';
import { useNotifications } from '../../contexts/NotificationsContext';
import { useI18n } from '../../contexts/I18nContext';

interface NotificationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationsPanel({ isOpen, onClose }: NotificationsPanelProps) {
  const { t } = useI18n();
  const { state, dispatch } = useNotifications();

  const handleMarkAllAsRead = () => {
    dispatch({ type: 'MARK_ALL_AS_READ' });
  };

  const handleClearAll = () => {
    dispatch({ type: 'CLEAR_ALL' });
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity z-40"
          onClick={onClose}
        />
      )}

      <div className={`
        fixed top-0 right-0 h-full w-96 bg-white shadow-xl transform transition-transform duration-300 ease-in-out z-50
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}
        role="dialog"
        aria-modal="true"
        aria-label="Notifications"
      >
        <div className="h-full flex flex-col">
          <div className="p-4 border-b flex justify-between items-center">
            <div className="flex items-center">
              <Bell className="w-5 h-5 text-gray-500 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">{t('settings.notifications')}</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full"
              aria-label="Close notifications panel"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {state.notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <Bell className="w-12 h-12 mb-2" />
                <p>{t('common.noResults')}</p>
              </div>
            ) : (
              <div className="divide-y" aria-live="polite" role="region" aria-label="Notifications">
                {state.notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 ${notification.read ? 'bg-white' : 'bg-blue-50'}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">{notification.message}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(notification.createdAt).toLocaleString()}
                        </p>
                      </div>
                      {!notification.read && (
                        <button
                          onClick={() => dispatch({ type: 'MARK_AS_READ', payload: notification.id })}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          {t('common.done')}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {state.notifications.length > 0 && (
            <div className="border-t p-4 space-y-2">
              <button
                onClick={handleMarkAllAsRead}
                className="w-full py-2 text-blue-600 hover:bg-blue-50 rounded-md"
              >
                {t('common.done')}
              </button>
              <button
                onClick={handleClearAll}
                className="w-full py-2 text-red-600 hover:bg-red-50 rounded-md"
              >
                {t('common.remove')}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}