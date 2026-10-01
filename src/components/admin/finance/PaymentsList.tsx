import { Clock, Check, AlertCircle } from 'lucide-react';
import type { Payment, Order } from '../../../lib/api/types';

interface PaymentsListProps {
  payments: Payment[];
  orders: Record<string, Order>;
}

export function PaymentsList({ payments, orders }: PaymentsListProps) {
  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="p-6 border-b">
        <h3 className="text-lg font-medium text-gray-900">Recent Payments</h3>
      </div>
      <div className="divide-y">
        {payments.map((payment) => {
          const order = orders[payment.orderId];
          const createdAt = new Date(payment.createdAt);
          const timeAgo = Math.floor((Date.now() - createdAt.getTime()) / 60000);
          
          return (
            <div key={payment.id} className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      payment.status === 'paid'
                        ? 'bg-green-100 text-green-800'
                        : payment.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {payment.status === 'paid' && <Check className="w-3 h-3 mr-1" />}
                      {payment.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                      {payment.status === 'failed' && <AlertCircle className="w-3 h-3 mr-1" />}
                      {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                    </span>
                    <span className="ml-2 text-sm text-gray-500">
                      {timeAgo} minutes ago
                    </span>
                  </div>
                  <div className="mt-1">
                    <span className="text-sm font-medium text-gray-900">
                      Order #{order?.id.slice(0, 8)}
                    </span>
                    <span className="mx-2 text-gray-500">•</span>
                    <span className="text-sm text-gray-500 capitalize">
                      {payment.method}
                    </span>
                  </div>
                </div>
                <span className="text-lg font-medium text-gray-900">
                  ${payment.amount.toFixed(2)}
                </span>
              </div>
              {payment.tip && (
                <div className="mt-2 text-sm text-gray-500">
                  Tip: ${payment.tip.toFixed(2)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}