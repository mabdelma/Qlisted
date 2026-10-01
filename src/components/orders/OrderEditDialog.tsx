import React, { useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { orderApi } from '../../lib/api';
import type { Order, OrderWithItems } from '../../lib/api/types';
import { useParams } from 'react-router';

interface OrderEditDialogProps {
  order: Order;
  onClose: () => void;
  onUpdate: () => void;
}

export function OrderEditDialog({ order, onClose, onUpdate }: OrderEditDialogProps) {
  const { slug } = useParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrderWithItems | null>(null);

  const loadDetail = useCallback(async () => {
    if (!slug) return;
    try {
      const data = await orderApi.getDetail(slug, order.id);
      setDetail(data);
    } catch (err) {
      console.error('Failed to load order details:', err);
      setError('Failed to load order details');
    }
  }, [slug, order.id]);

  React.useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const statusOptions = [
    { value: 'pending', label: 'Pending' },
    { value: 'preparing', label: 'Preparing' },
    { value: 'ready', label: 'Ready' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'cancelled', label: 'Cancelled' },
  ] as const;

  async function handleStatusChange(newStatus: string) {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      await orderApi.updateStatus(slug, order.id, newStatus);
      onUpdate();
      onClose();
    } catch (err) {
      console.error('Failed to update order:', err);
      setError('Failed to update order status');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">
              Order #{order.id.slice(0, 8)}
            </h2>
            <button onClick={onClose} aria-label="Close dialog" className="text-gray-400 hover:text-gray-500">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
        <div className="p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-400 text-red-700">
              {error}
            </div>
          )}

          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Current Status</h3>
            <span className={`inline-block px-3 py-1 text-sm font-semibold rounded-full ${
              order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
              order.status === 'preparing' ? 'bg-blue-100 text-blue-800' :
              order.status === 'ready' ? 'bg-green-100 text-green-800' :
              order.status === 'delivered' ? 'bg-gray-100 text-gray-800' :
              'bg-red-100 text-red-800'
            }`}>
              {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
            </span>
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Update Status</h3>
            <div className="grid grid-cols-2 gap-2">
              {statusOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleStatusChange(opt.value)}
                  disabled={loading || opt.value === order.status}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${
                    opt.value === order.status
                      ? 'bg-indigo-100 text-indigo-800 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  } disabled:opacity-50`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Order Items</h3>
            {!detail ? (
              <p className="text-sm text-gray-500">Loading items...</p>
            ) : (
              <div className="space-y-2">
                {detail.items.map(item => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-gray-600">{item.name} × {item.quantity}</span>
                    <span className="text-gray-600">${(item.unitPrice * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
                <div className="border-t pt-2 flex justify-between font-medium">
                  <span>Total</span>
                  <span>${detail.total.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="p-6 border-t">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}