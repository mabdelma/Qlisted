import React, { useMemo } from 'react';
import { Star, Clock, ShoppingBag, DollarSign } from 'lucide-react';
import type { StaffMetrics } from './StaffPerformance';
import type { User } from '../../../lib/api/types';
import { calculateSpeedScore, calculateEfficiencyScore } from '../../../lib/utils/performanceMetrics';

interface StaffListProps {
  staff: User[];
  metrics: Record<string, StaffMetrics>;
}

export const StaffList = React.memo(function StaffList({ staff, metrics }: StaffListProps) {
  const sortedStaff = useMemo(() => {
    return [...staff].sort((a, b) => {
      if (a.role !== b.role) {
        const roleOrder = { waiter: 0, kitchen: 1, cashier: 2 } as const;
        return roleOrder[a.role as keyof typeof roleOrder] - roleOrder[b.role as keyof typeof roleOrder];
      }
      const ratingA = metrics[a.id]?.rating || 0;
      const ratingB = metrics[b.id]?.rating || 0;
      return ratingB - ratingA;
    });
  }, [staff, metrics]);

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="p-6 border-b">
        <h3 className="text-lg font-medium text-gray-900">Staff Performance Details</h3>
      </div>
      <div className="divide-y">
        {sortedStaff.map((member) => {
          const memberMetrics = metrics[member.id] || {
            ordersHandled: 0,
            avgServiceTime: 0,
            totalSales: 0,
            rating: 0
          };
          
          return (
            <div key={member.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                    {member.avatar ? (
                      <img
                        src={member.avatar}
                        alt={member.name}
                        width="48"
                        height="48"
                        loading="lazy"
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-xl font-medium text-gray-600">
                        {member.name.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div className="ml-4">
                    <h4 className="text-lg font-medium text-gray-900">{member.name}</h4>
                    <p className={`text-sm font-medium capitalize ${
                      member.role === 'waiter' 
                        ? 'text-blue-600'
                        : member.role === 'kitchen'
                        ? 'text-green-600'
                        : 'text-yellow-600'
                    }`}>{member.role}</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <Star className="w-5 h-5 text-yellow-400" />
                  <span className="ml-1 text-lg font-medium">
                    {(memberMetrics.rating * 10).toFixed(1)}%
                  </span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center">
                  <ShoppingBag className="w-5 h-5 text-gray-400 mr-2" />
                  <div>
                    <p className="text-sm text-gray-500">
                      {member.role === 'cashier' ? 'Payments Processed' : 'Orders Handled'}
                    </p>
                    <p className="text-lg font-medium">{memberMetrics.ordersHandled}</p>
                    {member.role === 'cashier' && memberMetrics.paymentMethods && (
                      <div className="mt-1 text-xs text-gray-500">
                        <div>Cash: {memberMetrics.paymentMethods.cash}</div>
                        <div>Card: {memberMetrics.paymentMethods.card}</div>
                        <div>Wallet: {memberMetrics.paymentMethods.wallet}</div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center">
                  <Clock className="w-5 h-5 text-gray-400 mr-2" />
                  <div>
                    <p className="text-sm text-gray-500">
                      {member.role === 'cashier' 
                        ? 'Avg Processing Time' 
                        : member.role === 'kitchen'
                        ? 'Avg Preparation Time'
                        : 'Avg Service Time'
                      }
                    </p>
                    <p className="text-lg font-medium">
                      {memberMetrics.avgServiceTime.toFixed(1)} min
                    </p>
                  </div>
                </div>
                <div className="flex items-center">
                  <DollarSign className="w-5 h-5 text-gray-400 mr-2" />
                  <div>
                    <p className="text-sm text-gray-500">Total Sales</p>
                    <p className="text-lg font-medium">
                      ${memberMetrics.totalSales.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Performance Bars */}
              <div className="mt-4 space-y-2">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-500">Service Speed</span>
                    <span className="text-gray-900">
                      {calculateSpeedScore(memberMetrics.avgServiceTime, member.role).toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{
                        width: `${calculateSpeedScore(memberMetrics.avgServiceTime, member.role)}%`,
                      }}
                    ></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-500">Service Efficiency</span>
                    <span className="text-gray-900">
                      {calculateEfficiencyScore(memberMetrics.ordersHandled, member.role).toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full"
                      style={{
                        width: `${calculateEfficiencyScore(memberMetrics.ordersHandled, member.role)}%`,
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});