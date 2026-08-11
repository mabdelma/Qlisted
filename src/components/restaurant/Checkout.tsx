import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useCart } from '../../contexts/CartContext';
import { orderApi } from '../../lib/api';

export function Checkout() {
  const { state, dispatch } = useCart();
  const navigate = useNavigate();
  const { slug, tableId } = useParams();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOrder = async () => {
    setProcessing(true);
    setError(null);

    try {
      await orderApi.create(slug || '', {
        tableId: tableId || '1',
        items: state.items.map(item => ({
          menuItemId: item.menuItem.id,
          name: item.menuItem.name,
          quantity: item.quantity,
          unitPrice: item.menuItem.price,
          notes: item.comment || undefined
        })),
      });

      dispatch({ type: 'CLEAR_CART' });

      navigate(slug ? `/r/${slug}/table/${tableId}/orders` : `/table/${tableId}/orders`);
    } catch (err) {
      console.error('Failed to place order:', err);
      setError('Failed to place order. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  if (state.items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <h2 className="text-2xl font-serif text-[#1e3a5f] mb-4">Your cart is empty</h2>
        <button
          onClick={() => navigate(tableId ? `/table/${tableId}/menu` : '/menu')}
          className="text-[#0f766e] hover:text-[#1e3a5f]"
        >
          Return to menu
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h2 className="text-2xl font-serif text-[#1e3a5f] mb-8">Checkout</h2>

      {/* Order Summary */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Order Summary</h3>
        <div className="space-y-4">
          {state.items.map((item) => (
            <div key={item.menuItem.id} className="flex justify-between">
              <div className="flex-1">
                <div className="flex items-center">
                  <span className="text-gray-800">{item.menuItem.name}</span>
                  <span className="text-gray-500 ml-2">×{item.quantity}</span>
                </div>
                {item.comment && (
                  <div className="mt-1 text-sm text-gray-600 italic">
                    "{item.comment}"
                  </div>
                )}
              </div>
              <span className="text-gray-800 ml-4">
                ${(item.menuItem.price * item.quantity).toFixed(2)}
              </span>
            </div>
          ))}
          <div className="border-t pt-4 flex justify-between font-medium">
            <span className="text-[#1e3a5f]">Total</span>
            <span className="text-[#0f766e]">${state.total.toFixed(2)}</span>
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={() => navigate(slug ? `/r/${slug}/table/${tableId}/menu` : '/menu')}
              className="text-[#0f766e] hover:text-[#1e3a5f]"
            >
              Continue Shopping
            </button>
            <button
              onClick={handleOrder}
              disabled={processing}
              className="px-4 py-2 bg-[#0f766e] text-white rounded-md hover:bg-[#1e3a5f] disabled:opacity-50"
            >
              {processing ? 'Processing...' : 'Place Order'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-8">
          {error}
        </div>
      )}
    </div>
  );
}