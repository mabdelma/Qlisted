import React from 'react';
import { NavLink } from 'react-router';
import { ShoppingCart, ClipboardList, ChefHat } from 'lucide-react';
import { CartPanel } from './CartPanel';
import { useCart } from '../../contexts/CartContext';
import { useI18n } from '../../contexts/I18nContext';

export function RestaurantHeader() {
  const { t } = useI18n();
  const [isCartOpen, setIsCartOpen] = React.useState(false);
  const { state } = useCart();

  return (
    <>
    <header className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <ChefHat className="h-8 w-8 text-[#0f766e]" />
            <h1 className="ml-3 text-2xl font-bold text-gray-900">
              {t('app.name')}
            </h1>
          </div>
          
          <nav className="flex space-x-8">
            <NavLink
              to="/menu"
              className={({ isActive }) =>
                `flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                  isActive
                    ? 'text-[#0f766e] bg-[#ccfbf1]'
                    : 'text-gray-500 hover:text-gray-700'
                }`
              }
            >
              {t('nav.menu')}
            </NavLink>
            <button
              onClick={() => setIsCartOpen(true)}
              className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-500 hover:text-gray-700 relative"
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
              to="/orders"
              className={({ isActive }) =>
                `flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                  isActive
                    ? 'text-[#0f766e] bg-[#ccfbf1]'
                    : 'text-gray-500 hover:text-gray-700'
                }`
              }
            >
              <ClipboardList className="h-5 w-5 mr-1" />
              {t('nav.orders')}
            </NavLink>
          </nav>
        </div>
      </div>
    </header>
    <CartPanel isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </>
  );
}