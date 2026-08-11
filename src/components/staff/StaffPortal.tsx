import React, { useState } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { KitchenPortal } from '../kitchen/KitchenPortal';
import { WaiterPortal } from '../waiter/WaiterPortal';
import { CashierPanel } from './CashierPanel';
import { KitchenDisplay } from '../../features/staff/KitchenDisplay';
import { WaiterPanel } from '../../features/staff/WaiterPanel';
import { NotificationsProvider } from '../../contexts/NotificationsContext';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { ChefHat, ClipboardList, CreditCard } from 'lucide-react';
import { LanguageSwitcher } from '../ui/LanguageSwitcher';

export function StaffPortal() {
  const { state } = useAuth();
  const location = useLocation();
  const [staffView, setStaffView] = useState<'classic' | 'enhanced'>('classic');

  if (state.loading) {
    return <LoadingSpinner />;
  }

  if (!state.user || !['kitchen', 'waiter', 'cashier'].includes(state.user.role)) {
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  const viewToggle = (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-1 bg-white rounded-lg shadow-md border border-gray-200 p-1">
      <LanguageSwitcher />
      <span className="w-px h-5 bg-gray-200" />
      <button
        onClick={() => setStaffView('classic')}
        className={`px-3 py-1.5 text-xs font-medium rounded-md ${staffView === 'classic' ? 'bg-[#0f766e] text-white' : 'text-gray-600 hover:bg-gray-100'}`}
      >
        Classic
      </button>
      <button
        onClick={() => setStaffView('enhanced')}
        className={`px-3 py-1.5 text-xs font-medium rounded-md ${staffView === 'enhanced' ? 'bg-[#0f766e] text-white' : 'text-gray-600 hover:bg-gray-100'}`}
      >
        Enhanced
      </button>
    </div>
  );

  if (staffView === 'enhanced') {
    const role = state.user.role;
    if (role === 'kitchen' || role === 'waiter' || role === 'cashier') {
      const tabs = role === 'kitchen'
        ? [{ id: 'display', label: 'Kitchen Display', icon: ChefHat } as const]
        : role === 'waiter'
          ? [{ id: 'panel', label: 'Waiter Panel', icon: ClipboardList } as const]
          : [{ id: 'payments', label: 'Cashier', icon: CreditCard } as const];
      // `role` is fixed for the component's lifetime, so this hook's call order is
      // stable across renders — safe despite the conditional branch.
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const [activeTab, setActiveTab] = useState<string>(tabs[0].id);

      return (
        <NotificationsProvider role={role}>
          {viewToggle}
          <div className="min-h-screen bg-gray-50">
            <div className="bg-[#1e3a5f] text-white px-6 py-3 flex items-center gap-4">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === tab.id ? 'bg-[#0f766e] text-white' : 'text-[#ccfbf1] hover:bg-[#115e59]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
            <main className="p-8">
              {activeTab === 'display' && role === 'kitchen' && <KitchenDisplay />}
              {activeTab === 'panel' && role === 'waiter' && <WaiterPanel />}
              {activeTab === 'payments' && role === 'cashier' && <CashierPanel />}
            </main>
          </div>
        </NotificationsProvider>
      );
    }
  }

  return (
    <NotificationsProvider role={state.user.role}>
      {viewToggle}
      {(() => {
        switch (state.user.role) {
          case 'kitchen':
            return <KitchenPortal />;
          case 'cashier':
            return (
              <div className="min-h-screen bg-gray-50">
                <CashierPanel />
              </div>
            );
          case 'waiter':
            return <WaiterPortal />;
          default:
            return <Navigate to="/signin" replace />;
        }
      })()}
    </NotificationsProvider>
  );
}