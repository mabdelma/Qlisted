import React from 'react';
import { NavLink, useParams } from 'react-router';
import { ShoppingCart, ClipboardList, ChefHat } from 'lucide-react';
import { CartPanel } from '../restaurant/CartPanel';
import { useCart } from '../../contexts/CartContext';
import { useI18n } from '../../contexts/I18nContext';

export function TableHeader() {
  const { t } = useI18n();
  const { tableId } = useParams();
  const [isCartOpen, setIsCartOpen] = React.useState(false);
  const { state } = useCart();

  return (
    <>
      <header className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-8">
              <div className="flex items-center">
                <ChefHat className="h-8 w-8 text-[#0f766e]" />
                <span className="ml-2 text-xl font-bold text-gray-900">{t('app.name')}</span>
              </div>
              
              <NavLink
                to={`/table/${tableId}/menu`}
                className={({ isActive }) =>
                  `px-4 py-2 text-sm font-medium rounded-md ${
                    isActive
                      ? 'bg-[#ccfbf1] text-[#0f766e] shadow-sm'
                      : 'text-gray-500 hover:text-[#0f766e] hover:bg-[#ccfbf1]/50'
                  }`
                }
              >
                {t('nav.menu')}
              </NavLink>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setIsCartOpen(true)}
                className="flex items-center px-4 py-2 text-sm font-medium rounded-md text-gray-500 hover:text-[#0f766e] hover:bg-[#ccfbf1]/50 relative transition-colors"
              >
                <ShoppingCart className="h-5 w-5 mr-1" />
                {t('nav.cart')}
                {state.items.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#0f766e] text-white text-xs w-5 h-5 flex items-center justify-center rounded-full">
                    {state.items.length}
                  </span>
                )}
              </button>
              <NavLink
                to={`/table/${tableId}/orders`}
                className={({ isActive }) =>
                  `flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                    isActive
                      ? 'text-[#0f766e] bg-[#ccfbf1] shadow-sm'
                      : 'text-gray-500 hover:text-[#0f766e] hover:bg-[#ccfbf1]/50'
                  }`
                }
              >
                <ClipboardList className="h-5 w-5 mr-1" />
                {t('nav.orders')}
              </NavLink>
            </div>
          </div>
        </div>
      </header>
      <CartPanel isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} tableId={tableId} />
    </>
  );
}