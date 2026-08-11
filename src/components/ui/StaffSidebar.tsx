import React from 'react';
import { ChefHat, Users, ClipboardList, Store, Clock, Settings } from 'lucide-react';
import { useI18n, type TranslationKey } from '../../contexts/I18nContext';

interface SidebarProps {
  role: 'kitchen' | 'waiter' | 'cashier';
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabsByRole: Record<string, Array<{ id: string; icon: React.ComponentType }>> = {
  kitchen: [
    { id: 'orders', icon: ClipboardList },
    { id: 'history', icon: Clock },
    { id: 'profile', icon: Settings }
  ],
  waiter: [
    { id: 'tables', icon: Users },
    { id: 'pos', icon: Store },
    { id: 'orders', icon: ClipboardList },
    { id: 'history', icon: Clock },
    { id: 'profile', icon: Settings }
  ],
  cashier: [
    { id: 'pos', icon: Store },
    { id: 'payments', icon: ClipboardList },
    { id: 'history', icon: Clock },
    { id: 'profile', icon: Settings }
  ]
};

const tabKeyMap: Record<string, string> = {
  orders: 'staff.orders',
  history: 'staff.orderHistory',
  profile: 'staff.profileSettings',
  tables: 'staff.tables',
  pos: 'staff.pos',
  payments: 'staff.payments',
};

export function StaffSidebar({ role, activeTab, onTabChange }: SidebarProps) {
  const { t } = useI18n();
  const [collapsed, setCollapsed] = React.useState(true);
  const tabs = tabsByRole[role];

  return (
    <div 
      className={`${collapsed ? 'w-20' : 'w-64'} bg-[#1e3a5f] min-h-screen text-white p-4 transition-[width] duration-300 relative group hover:w-64`}
      onMouseEnter={() => setCollapsed(false)}
      onMouseLeave={() => setCollapsed(true)}
      onFocus={() => setCollapsed(false)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setCollapsed(true);
        }
      }}
    >
      <div className={`flex items-center mb-8 px-2 ${collapsed ? 'justify-center' : ''}`}>
        <ChefHat className="w-8 h-8 mr-2" />
        <span className={`text-xl font-bold transition-opacity duration-300 ${collapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>
          {{ kitchen: t('staff.kitchenDisplay'), waiter: t('staff.waiterPanel'), cashier: t('staff.cashierPanel') }[role]}
        </span>
      </div>
      
      <nav className="space-y-1" aria-label="Staff navigation">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`w-full flex items-center ${collapsed ? 'justify-center group-hover:justify-start' : ''} px-4 py-3 text-sm rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-[#0f766e] text-white'
                  : 'text-[#ccfbf1] hover:bg-[#115e59]'
              }`}
            >
              <Icon className={`w-5 h-5 ${collapsed ? '' : 'mr-3'}`} />
              <span className={`transition-opacity duration-300 ${collapsed ? 'opacity-0 w-0 group-hover:opacity-100 group-hover:w-auto group-hover:ml-3' : 'opacity-100'}`}>
                {t(tabKeyMap[tab.id] as TranslationKey)}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
