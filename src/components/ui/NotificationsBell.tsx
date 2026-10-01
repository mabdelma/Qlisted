import { useState } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '../../contexts/NotificationsContext';
import { NotificationsPanel } from './NotificationsPanel';

export function NotificationsBell() {
  const [isOpen, setIsOpen] = useState(false);
  const { state } = useNotifications();

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="relative p-2 text-gray-400 hover:text-gray-500"
        aria-label="Open notifications"
      >
        <Bell className="w-6 h-6" />
        {state.unreadCount > 0 && (
          <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
        )}
      </button>
      <NotificationsPanel isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}