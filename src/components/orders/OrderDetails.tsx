import { X, MessageCircle, Clock } from 'lucide-react';
import type { Order, MenuItem } from '../../lib/api/types';

interface OrderDetailsProps {
  order: Order & {
    items: Array<{
      menuItem: MenuItem;
      quantity: number;
      notes?: string;
    }>;
  };
  onClose: () => void;
}

export function OrderDetails({ order, onClose }: OrderDetailsProps) {
  const orderAge = Math.floor(
    (Date.now() - new Date(order.createdAt).getTime()) / 60000
  );

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="p-6 flex-shrink-0">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">
                Order #{order.id.slice(0, 8)}
              </h3>
              <div className="flex items-center mt-1 text-sm text-gray-500">
                <Clock className="w-4 h-4 mr-1" />
                {orderAge} minutes ago
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close dialog"
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-500 mb-2">Status</div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              order.status === 'pending'
                ? 'bg-yellow-100 text-yellow-800'
                : order.status === 'preparing'
                ? 'bg-blue-100 text-blue-800'
                : order.status === 'ready'
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'
            }`}>
              {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
            </span>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <div className="space-y-6">
            <div>
              <h4 className="text-lg font-medium text-gray-900 mb-4">Items</h4>
              <div className="space-y-4">
                {order.items.map((item, index) => (
                  <div
                    key={index}
                    className="bg-white border rounded-lg p-4"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h5 className="font-medium text-gray-900">
                          {item.menuItem.name}
                        </h5>
                        <div className="mt-1 flex items-center">
                          <span className="text-sm text-gray-500">
                            Quantity: {item.quantity}
                          </span>
                          <span className="mx-2 text-gray-300">|</span>
                          <span className="text-sm text-gray-500">
                            ${(item.menuItem.price * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {item.notes && (
                      <div className="mt-2 flex items-start space-x-2 bg-amber-50 p-3 rounded-md">
                        <MessageCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="text-sm font-medium text-amber-900 mb-1">
                            Special Instructions
                          </div>
                          <div className="text-sm text-amber-800">
                            {item.notes}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t flex-shrink-0">
          <div className="flex justify-between items-center text-lg font-bold">
            <span>Total</span>
            <span>${order.total.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
