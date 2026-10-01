import { Routes, Route, Navigate } from 'react-router';
import { RestaurantHeader } from './RestaurantHeader';
import { Menu } from './Menu';
import { Cart } from './Cart';
import { Orders } from './Orders';
import { Checkout } from './Checkout';
import { CartProvider } from '../../contexts/CartContext';
import { NotificationsProvider } from '../../contexts/NotificationsContext';

export function RestaurantWebsite() {
  return (
    <CartProvider>
    <NotificationsProvider role="customer">
      <div className="min-h-screen bg-gray-50">
        <RestaurantHeader />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Routes>
            <Route index element={<Navigate to="/menu" replace />} />
            <Route path="menu" element={<Menu />} />
            <Route path="cart" element={<Cart />} />
            <Route path="orders" element={<Orders />} />
            <Route path="checkout" element={<Checkout />} />
          </Routes>
        </main>
      </div>
    </NotificationsProvider>
    </CartProvider>
  );
}