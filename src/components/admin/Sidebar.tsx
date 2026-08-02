import React from 'react';
import { LayoutGrid, Users, ChefHat, Table, ClipboardList, UserCheck, Settings, ToggleLeft, CreditCard, Palette, Tag, Star, CalendarDays, Clock, Percent, Grid3X3, Gift, Timer, FileBarChart, Sparkles, X, Boxes, CalendarClock, UserCircle, Hotel } from 'lucide-react';
import { useI18n, type TranslationKey } from '../../contexts/I18nContext';
import { useAuth } from '../../contexts/AuthContext';

// Nav items specific to one venue type; everything else is shared.
const RESTAURANT_ONLY = new Set(['orders', 'tables', 'layout', 'menu', 'modifiers', 'reservations', 'waitlist']);
const HOTEL_ONLY = new Set(['rooms']);

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  mobileOpen?: boolean;
  onClose?: () => void;
}

// Escoutly-style grouped navigation — sections instead of a flat list.
const groups = [
  { label: 'Overview', items: [
    { id: 'analytics', icon: LayoutGrid },
    { id: 'assistant', icon: Sparkles },
    { id: 'reports', icon: FileBarChart },
  ] },
  { label: 'Operations', items: [
    { id: 'orders', icon: ClipboardList },
    { id: 'tables', icon: Table },
    { id: 'layout', icon: Grid3X3 },
    { id: 'inventory', icon: Boxes },
    { id: 'rooms', icon: Hotel },
    { id: 'reservations', icon: CalendarDays },
    { id: 'waitlist', icon: Clock },
  ] },
  { label: 'Menu', items: [
    { id: 'menu', icon: ChefHat },
    { id: 'modifiers', icon: ToggleLeft },
  ] },
  { label: 'Team', items: [
    { id: 'staff', icon: UserCheck },
    { id: 'users', icon: Users },
    { id: 'schedule', icon: CalendarClock },
    { id: 'time-tracking', icon: Timer },
  ] },
  { label: 'Marketing', items: [
    { id: 'customers', icon: UserCircle },
    { id: 'campaigns', icon: Tag },
    { id: 'loyalty', icon: Star },
    { id: 'gift-cards', icon: Gift },
  ] },
  { label: 'Account', items: [
    { id: 'payment-links', icon: CreditCard },
    { id: 'subscription', icon: CreditCard },
    { id: 'branding', icon: Palette },
    { id: 'tax', icon: Percent },
    { id: 'settings', icon: Settings },
  ] },
] as const;

const tabKeyMap: Record<string, string> = {
  analytics: 'nav.dashboard',
  assistant: 'nav.assistant',
  orders: 'nav.orders',
  reports: 'nav.reports',
  staff: 'nav.staff',
  users: 'nav.customers',
  menu: 'nav.menu',
  modifiers: 'nav.modifiers',
  tables: 'staff.tables',
  layout: 'layout.title',
  inventory: 'nav.inventory',
  rooms: 'hotel.title',
  schedule: 'scheduling.title',
  customers: 'nav.customers',
  'payment-links': 'nav.paymentLinks',
  subscription: 'nav.subscription',
  branding: 'nav.branding',
  campaigns: 'nav.promotions',
  waitlist: 'waitlist.title',
  reservations: 'reservations.title',
  tax: 'tax.title',
  loyalty: 'nav.loyalty',
  'gift-cards': 'giftCards.title',
  'time-tracking': 'timeTracking.title',
  settings: 'common.settings',
};

export function Sidebar({ activeTab, onTabChange, mobileOpen = false, onClose }: SidebarProps) {
  const { t } = useI18n();
  const { state: { tenant } } = useAuth();
  const venue = tenant?.venueType || 'restaurant';
  const showItem = (id: string) =>
    venue === 'both' ? true : venue === 'hotel' ? !RESTAURANT_ONLY.has(id) : !HOTEL_ONLY.has(id);
  const visibleGroups = groups
    .map((g) => ({ label: g.label, items: g.items.filter((it) => showItem(it.id)) }))
    .filter((g) => g.items.length > 0);
  const [collapsed, setCollapsed] = React.useState(true);
  // Collapse is a DESKTOP-only behaviour (hover to expand). On mobile the sidebar
  // is a full-width off-canvas drawer with labels always visible.
  const hide = `lg:transition-opacity lg:duration-300 ${collapsed ? 'lg:opacity-0 lg:w-0 lg:group-hover:opacity-100 lg:group-hover:w-auto lg:group-hover:ms-3' : ''}`;

  return (
    <div
      className={`fixed inset-y-0 start-0 z-40 w-64 bg-sidebar-bg text-sidebar-text p-4 flex flex-col transition-transform duration-300 lg:static lg:z-auto lg:translate-x-0 lg:min-h-screen group lg:hover:w-64 ${collapsed ? 'lg:w-20' : 'lg:w-64'} ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      onMouseEnter={() => setCollapsed(false)}
      onMouseLeave={() => setCollapsed(true)}
    >
      <div className={`flex items-center justify-between mb-8 px-2 lg:${collapsed ? 'justify-center' : ''}`}>
        <div className="flex items-center">
          <ChefHat className="w-8 h-8 me-2" aria-hidden />
          <span className={`text-xl font-bold ${hide}`}>{t('nav.admin')}</span>
        </div>
        <button onClick={onClose} className="lg:hidden p-1 text-sidebar-text" aria-label="Close menu"><X className="w-5 h-5" /></button>
      </div>

      <nav className="space-y-4 overflow-y-auto" aria-label="Admin navigation">
        {visibleGroups.map((groupNav) => (
          <div key={groupNav.label} className="space-y-1">
            <p className={`px-4 text-[10px] font-semibold uppercase tracking-wider text-sidebar-label ${collapsed ? 'lg:opacity-0 lg:h-0 lg:group-hover:opacity-100 lg:group-hover:h-auto' : ''}`}>
              {groupNav.label}
            </p>
            {groupNav.items.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => { onTabChange(tab.id); onClose?.(); }}
                  aria-current={isActive ? 'page' : undefined}
                  className={`w-full flex items-center ${collapsed ? 'lg:justify-center lg:group-hover:justify-start' : ''} px-4 py-2.5 text-sm rounded-lg transition-colors ${
                    isActive
                      ? 'bg-sidebar-active text-white shadow-sm'
                      : 'text-sidebar-text hover:bg-sidebar-hover'
                  }`}
                >
                  <Icon className={`w-5 h-5 me-3 ${collapsed ? 'lg:me-0' : ''}`} aria-hidden />
                  <span className={hide}>{t(tabKeyMap[tab.id] as TranslationKey)}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>
    </div>
  );
}
