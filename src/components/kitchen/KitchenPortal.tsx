import React from 'react';
import { StaffSidebar } from '../ui/StaffSidebar';
import { Header } from '../admin/Header';
import { OrdersDisplay } from './OrdersDisplay';
import { OrderHistory } from './OrderHistory';
import { StaffProfile } from '../profile/StaffProfile';
import { NotificationsProvider } from '../../contexts/NotificationsContext';

export function KitchenPortal() {
  const [activeView, setActiveView] = React.useState<'orders' | 'history' | 'profile'>('orders');

  return (
    <NotificationsProvider role="kitchen">
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        <StaffSidebar
          role="kitchen"
          activeTab={activeView}
          onTabChange={(tab) => setActiveView(tab as typeof activeView)}
        />
        <div className="flex-1">
          <Header />
          <main className="p-8">
            {activeView === 'orders' && <OrdersDisplay />}
            {activeView === 'history' && <OrderHistory />}
            {activeView === 'profile' && <StaffProfile />}
          </main>
        </div>
      </div>
    </div>
    </NotificationsProvider>
  );
}