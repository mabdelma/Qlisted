import { useState } from 'react';
import { StaffSidebar } from '../ui/StaffSidebar';
import { Header } from '../admin/Header';
import { TableGrid } from './TableGrid';
import { OrderHistory } from './OrderHistory';
import { OrdersList } from './OrdersList';
import { PointOfSale } from '../shared/PointOfSale';
import { NotificationsProvider } from '../../contexts/NotificationsContext';
import { StaffProfile } from '../profile/StaffProfile';

export function WaiterPortal() {
  const [activeView, setActiveView] = useState<'tables' | 'orders' | 'pos' | 'history' | 'profile'>('tables');

  return (
    <NotificationsProvider role="waiter">
      <div className="min-h-screen bg-gray-50">
        <div className="flex">
          <StaffSidebar
            role="waiter"
            activeTab={activeView}
            onTabChange={(tab) => setActiveView(tab as typeof activeView)}
          />
          <div className="flex-1">
            <Header />
            <main className="p-8">
              {activeView === 'tables' && <TableGrid />}
              {activeView === 'orders' && <OrdersList />}
              {activeView === 'pos' && <PointOfSale />}
              {activeView === 'history' && <OrderHistory />}
              {activeView === 'profile' && <StaffProfile />}
            </main>
          </div>
        </div>
      </div>
    </NotificationsProvider>
  );
}