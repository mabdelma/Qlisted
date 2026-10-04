import { X, Clock } from 'lucide-react';

interface OrderItemDisplay {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
  notesTranslated?: string | null;
}

interface OrderDetailsProps {
  order: {
    id: string;
    status: string;
    paymentStatus?: string;
    total: number;
    createdAt: string;
    items: OrderItemDisplay[];
  };
  onClose: () => void;
}

export function OrderDetails({ order, onClose }: OrderDetailsProps) {
  const orderAge = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000);

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="relative top-20 mx-auto p-5 w-full max-w-2xl">
        <div className="bg-white rounded-lg shadow-xl">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Order #{order.id.slice(0, 8)}</h3>
                <div className="flex items-center mt-1 text-sm text-gray-500">
                  <Clock className="w-4 h-4 mr-1" />{orderAge} minutes ago
                </div>
              </div>
              <button onClick={onClose} aria-label="Close dialog" className="text-gray-400 hover:text-gray-500">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="text-sm text-gray-500 mb-2">Status</div>
              <div className="flex space-x-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  order.status === 'preparing' ? 'bg-blue-100 text-blue-800' :
                  order.status === 'ready' ? 'bg-green-100 text-green-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                </span>
                {order.paymentStatus && (
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    order.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1)}
                  </span>
                )}
              </div>
            </div>

            <div className="max-h-[calc(100vh-400px)] overflow-y-auto">
              <div className="space-y-4">
                {order.items.map((item) => (
                  <div key={item.id} className="bg-white border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h5 className="font-medium text-gray-900">{item.name}</h5>
                        <div className="mt-1 flex items-center">
                          <span className="text-sm text-gray-500">Quantity: {item.quantity}</span>
                          <span className="mx-2 text-gray-300">|</span>
                          <span className="text-sm text-gray-500">${(item.unitPrice * item.quantity).toFixed(2)}</span>
                        </div>
                        {item.notes && (
                          <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded-md">
                            <span className="font-medium">Note: </span>
                            {item.notesTranslated || item.notes}
                            {item.notesTranslated && (
                              // Reception sees their own language first, with the
                              // guest's exact words kept underneath.
                              <div className="mt-1 text-xs text-gray-400">{item.notes}</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t mt-6 pt-4">
              <div className="flex justify-between items-center text-lg font-bold">
                <span>Total</span>
                <span>${order.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
