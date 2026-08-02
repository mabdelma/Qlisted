import { useState, useEffect, createContext, useContext } from 'react';
import { Outlet, NavLink, useParams, useLocation } from 'react-router';
import { ShoppingCart, ClipboardList, ChefHat, Receipt, UtensilsCrossed } from 'lucide-react';
import { BrandingProvider } from '../../contexts/BrandingProvider';
import { CartProvider, useCart } from '../../contexts/CartContext';
import { useI18n } from '../../contexts/I18nContext';
import { tenantApi, menuApi, tableApi } from '../../lib/api';
import type { Tenant, MenuItem, MenuCategory, TableData } from '../../lib/api/types';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { PushNotificationBanner } from '../../components/ui/PushNotificationBanner';
import { Stepper } from '../../components/ui/Stepper';
import { formatMoney } from '../../lib/pricing';
import { CustomerAiWidget } from '../../components/ai/CustomerAiWidget';
import { VoiceOrderWidget } from '../../components/ai/VoiceOrderWidget';

interface TableFlowContextValue {
  tenant: Tenant;
  table: TableData;
  categories: MenuCategory[];
  items: MenuItem[];
  slug: string;
}

const TableFlowContext = createContext<TableFlowContextValue | null>(null);
export function useTableFlow() {
  const ctx = useContext(TableFlowContext);
  if (!ctx) throw new Error('useTableFlow must be used within TableFlowLayout');
  return ctx;
}

function Breadcrumb() {
  const { t } = useI18n();
  const { slug, tableId } = useParams();
  const location = useLocation();

  const steps = [
    { id: 'menu', label: t('nav.menu') },
    { id: 'cart', label: t('nav.cart') },
    { id: 'checkout', label: t('nav.checkout') },
    { id: 'bill', label: t('nav.bill') },
  ];

  const currentPath = location.pathname.split('/').pop() || 'menu';
  const currentIdx = steps.findIndex((s) => s.id === currentPath);
  const activeIdx = currentIdx === -1 ? 0 : currentIdx;

  return (
    <nav className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900" aria-label="Order progress">
      <div className="mx-auto max-w-3xl px-4 py-2.5 sm:px-6 lg:px-8">
        <Stepper steps={steps.map((s) => ({ id: s.id, label: s.label }))} current={activeIdx} className="hidden sm:flex" />
        <ol className="flex items-center gap-1 text-sm sm:hidden">
          {steps.slice(0, activeIdx + 1).map((s, i) => (
            <li key={s.id} className="flex items-center gap-1">
              {i > 0 && <span className="text-gray-300 dark:text-gray-600" aria-hidden>/</span>}
              <NavLink
                to={`/r/${slug}/table/${tableId}/${s.id}`}
                className={`whitespace-nowrap transition-colors ${
                  i === activeIdx ? 'font-medium text-brand-600 dark:text-brand-400' : 'text-gray-400 hover:text-brand-600'
                }`}
              >
                {s.label}
              </NavLink>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}

function TableFlowInner() {
  const { t } = useI18n();
  const { slug, tableId } = useParams();
  const location = useLocation();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [table, setTable] = useState<TableData | null>(null);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { state, dispatch } = useCart();

  useEffect(() => {
    if (!slug || !tableId) return;
    setLoading(true);
    Promise.all([
      tenantApi.get(slug),
      tableApi.getByQr(slug, tableId),
      menuApi.getFullMenu(slug),
    ])
      .then(([tenantData, tableData, menuData]) => {
        setTenant(tenantData);
        setTable(tableData);
        setCategories(menuData.categories);
        setItems(menuData.items);
      })
      .catch((err) => setError(err.message || t('error.generic')))
      .finally(() => setLoading(false));
  }, [slug, tableId, t]);

  if (loading) return <div className="py-12"><LoadingSpinner /></div>;
  if (error) return <ErrorMessage message={error} />;
  if (!tenant || !table) return <ErrorMessage message={t('common.notAvailable')} />;

  const value: TableFlowContextValue = { tenant, table, categories, items, slug: slug! };
  const isCartPage = location.pathname.endsWith('/cart');
  const currency = tenant.currency;

  return (
    <TableFlowContext.Provider value={value}>
      <BrandingProvider primaryColor={tenant.primaryColor} accentColor={tenant.accentColor} logoUrl={tenant.logoUrl} faviconUrl={tenant.faviconUrl}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <header className="sticky top-0 z-40 border-b border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-4">
                <div className="flex items-center">
                  {tenant.logoUrl ? (
                    <img src={tenant.logoUrl} alt={tenant.name} className="h-7 w-7 rounded-full object-cover" />
                  ) : (
                    <ChefHat className="h-6 w-6 text-brand-500 dark:text-brand-400" aria-hidden />
                  )}
                  <span className="ms-2 text-lg font-bold text-gray-900 dark:text-gray-100">{tenant.name}</span>
                </div>
                <span className="rounded bg-gray-100 px-2 py-1 text-sm font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                  {t('table.tableNumber')} {table.number}
                </span>
              </div>
              <nav className="flex items-center gap-1 sm:gap-3" aria-label="Main">
                <NavLink to={`/r/${slug}/table/${tableId}/menu`}
                  className={({ isActive }) => `px-2 sm:px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${isActive ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/50 dark:text-brand-300' : 'text-gray-500 hover:text-brand-600 hover:bg-brand-50/60 dark:text-gray-400 dark:hover:bg-brand-900/30'}`}>
                  <UtensilsCrossed className="h-4 w-4 inline sm:hidden" aria-hidden />
                  <span className="hidden sm:inline">{t('nav.menu')}</span>
                </NavLink>
                <NavLink to={`/r/${slug}/table/${tableId}/cart`}
                  className={({ isActive }) => `relative px-2 sm:px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${isActive ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/50 dark:text-brand-300' : 'text-gray-500 hover:text-brand-600 hover:bg-brand-50/60 dark:text-gray-400 dark:hover:bg-brand-900/30'}`}>
                  <ShoppingCart className="h-4 w-4 inline sm:hidden" aria-hidden />
                  <span className="hidden sm:inline">{t('nav.cart')}</span>
                  {state.items.length > 0 && (
                    <span className="absolute -top-1 -end-1 bg-brand-500 text-white text-xs w-4 h-4 flex items-center justify-center rounded-full" aria-label={`${state.items.length} items`}>
                      {state.items.length}
                    </span>
                  )}
                </NavLink>
                <NavLink to={`/r/${slug}/table/${tableId}/orders`}
                  className={({ isActive }) => `relative px-2 sm:px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${isActive ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/50 dark:text-brand-300' : 'text-gray-500 hover:text-brand-600 hover:bg-brand-50/60 dark:text-gray-400 dark:hover:bg-brand-900/30'}`}>
                  <ClipboardList className="h-4 w-4 inline sm:hidden" aria-hidden />
                  <span className="hidden sm:inline">{t('nav.orders')}</span>
                </NavLink>
                <NavLink to={`/r/${slug}/table/${tableId}/bill`}
                  className={({ isActive }) => `px-2 sm:px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${isActive ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/50 dark:text-brand-300' : 'text-gray-500 hover:text-brand-600 hover:bg-brand-50/60 dark:text-gray-400 dark:hover:bg-brand-900/30'}`}>
                  <Receipt className="h-4 w-4 inline sm:hidden" aria-hidden />
                  <span className="hidden sm:inline">{t('nav.bill')}</span>
                </NavLink>
              </nav>
            </div>
          </div>
        </header>
        <Breadcrumb />
        <main className="mx-auto max-w-3xl px-4 py-6 pb-20 sm:px-6 lg:px-8">
          <PushNotificationBanner slug={slug} />
          <Outlet />
        </main>
      </div>

      {state.items.length > 0 && !isCartPage && (
        <NavLink to={`/r/${slug}/table/${tableId}/cart`}
          aria-label={`View cart with ${state.items.length} items, total ${formatMoney(state.total, currency)}`}
          className="fixed bottom-6 end-6 z-30 flex items-center gap-2 rounded-full bg-brand-500 px-5 py-3 text-white shadow-float transition-colors hover:bg-brand-600">
          <ShoppingCart className="w-5 h-5" aria-hidden />
          <span className="font-medium">{state.items.length}</span>
          <span className="font-bold">{formatMoney(state.total, currency)}</span>
        </NavLink>
      )}

      {slug && (
        <>
          <CustomerAiWidget slug={slug} cartUrl={`/r/${slug}/table/${tableId}/cart`} />
          <VoiceOrderWidget
            slug={slug}
            onAddItem={(item, qty) => dispatch({ type: 'ADD_ITEM', payload: item, quantity: qty, tableId })}
            onRemoveItem={(id) => dispatch({ type: 'REMOVE_ITEM', payload: id })}
            getCart={() => ({ items: state.items.map((c) => ({ id: c.menuItem.id, name: c.menuItem.name, quantity: c.quantity })), total: state.total })}
          />
        </>
      )}
      </BrandingProvider>
    </TableFlowContext.Provider>
  );
}

export function TableFlowLayout() {
  return (
    <CartProvider>
      <TableFlowInner />
    </CartProvider>
  );
}
