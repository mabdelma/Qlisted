import type { User } from '../api/types';

/** The roles these metrics are computed for. Mirrors `User['role']`. */
export type StaffRole = User['role'];

export function calculateSpeedScore(avgTime: number, role: StaffRole): number {
  if (!avgTime || avgTime <= 0) return 100; // Perfect score for instant service
  
  // Target times based on role:
  // Kitchen: 30 minutes for preparation
  // Cashier: 5 minutes for payment processing
  // Waiter: 15 minutes for service
  const targetTime = role === 'cashier' ? 5 : role === 'kitchen' ? 30 : 15;
  
  // Calculate score with diminishing returns for faster times
  const ratio = targetTime / avgTime;
  return Math.min(100, Math.max(0, ratio * 100));
}

export function calculateEfficiencyScore(ordersCount: number, role: StaffRole): number {
  if (!ordersCount) return 0;
  
  // Different target order counts based on role
  const targetOrders = role === 'kitchen' ? 30 : role === 'cashier' ? 40 : 20;
  
  // Calculate score with bonus for exceeding targets
  const ratio = ordersCount / targetOrders;
  return Math.min(100, ratio * 100);
}

export function getRoleMetricsLabel(role: StaffRole): {
  ordersLabel: string;
  speedLabel: string;
  efficiencyLabel: string;
} {
  switch (role) {
    case 'cashier':
      return {
        ordersLabel: 'Payments Processed',
        speedLabel: 'Payment Processing Speed',
        efficiencyLabel: 'Payment Processing Efficiency'
      };
    case 'kitchen':
      return {
        ordersLabel: 'Orders Prepared',
        speedLabel: 'Kitchen Speed',
        efficiencyLabel: 'Kitchen Efficiency'
      };
    default:
      return {
        ordersLabel: 'Orders Handled',
        speedLabel: 'Service Speed',
        efficiencyLabel: 'Service Efficiency'
      };
  }
}