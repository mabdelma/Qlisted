import { describe, it, expect } from 'vitest';
import { calculateSpeedScore, calculateEfficiencyScore, getRoleMetricsLabel, type StaffRole } from '../performanceMetrics.js';

describe('calculateSpeedScore', () => {
  it('returns 100 for zero avg time (instant service)', () => {
    expect(calculateSpeedScore(0, 'kitchen' as StaffRole)).toBe(100);
  });

  it('returns 100 for negative avg time', () => {
    expect(calculateSpeedScore(-5, 'waiter' as StaffRole)).toBe(100);
  });

  describe('kitchen (target 30 min)', () => {
    it('scores 100 at target', () => {
      expect(calculateSpeedScore(30, 'kitchen' as StaffRole)).toBe(100);
    });

    it('scores 50 at twice the target', () => {
      expect(calculateSpeedScore(60, 'kitchen' as StaffRole)).toBe(50);
    });

    it('scores 200 when faster than target (capped at 100)', () => {
      expect(calculateSpeedScore(15, 'kitchen' as StaffRole)).toBe(100);
    });
  });

  describe('cashier (target 5 min)', () => {
    it('scores 100 at target', () => {
      expect(calculateSpeedScore(5, 'cashier' as StaffRole)).toBe(100);
    });

    it('scores 50 at twice the target', () => {
      expect(calculateSpeedScore(10, 'cashier' as StaffRole)).toBe(50);
    });
  });

  describe('waiter / default (target 15 min)', () => {
    it('scores 100 at target', () => {
      expect(calculateSpeedScore(15, 'waiter' as StaffRole)).toBe(100);
    });

    it('scores 50 at twice the target', () => {
      expect(calculateSpeedScore(30, 'waiter' as StaffRole)).toBe(50);
    });

    it('caps at 100', () => {
      expect(calculateSpeedScore(7.5, 'waiter' as StaffRole)).toBe(100);
    });
  });
});

describe('calculateEfficiencyScore', () => {
  it('returns 0 for zero orders', () => {
    expect(calculateEfficiencyScore(0, 'kitchen' as StaffRole)).toBe(0);
  });

  describe('kitchen (target 30 orders)', () => {
    it('scores 100 at target', () => {
      expect(calculateEfficiencyScore(30, 'kitchen' as StaffRole)).toBe(100);
    });

    it('scores 50 at half target', () => {
      expect(calculateEfficiencyScore(15, 'kitchen' as StaffRole)).toBe(50);
    });

    it('caps at 100 when exceeding target', () => {
      expect(calculateEfficiencyScore(60, 'kitchen' as StaffRole)).toBe(100);
    });
  });

  describe('cashier (target 40 payments)', () => {
    it('scores 100 at target', () => {
      expect(calculateEfficiencyScore(40, 'cashier' as StaffRole)).toBe(100);
    });

    it('scores 25 at quarter target', () => {
      expect(calculateEfficiencyScore(10, 'cashier' as StaffRole)).toBe(25);
    });
  });

  describe('waiter / default (target 20 orders)', () => {
    it('scores 100 at target', () => {
      expect(calculateEfficiencyScore(20, 'waiter' as StaffRole)).toBe(100);
    });

    it('scores 50 at half target', () => {
      expect(calculateEfficiencyScore(10, 'waiter' as StaffRole)).toBe(50);
    });
  });
});

describe('getRoleMetricsLabel', () => {
  it('returns cashier-specific labels', () => {
    const labels = getRoleMetricsLabel('cashier' as StaffRole);
    expect(labels.ordersLabel).toBe('Payments Processed');
    expect(labels.speedLabel).toBe('Payment Processing Speed');
    expect(labels.efficiencyLabel).toBe('Payment Processing Efficiency');
  });

  it('returns kitchen-specific labels', () => {
    const labels = getRoleMetricsLabel('kitchen' as StaffRole);
    expect(labels.ordersLabel).toBe('Orders Prepared');
    expect(labels.speedLabel).toBe('Kitchen Speed');
    expect(labels.efficiencyLabel).toBe('Kitchen Efficiency');
  });

  it('returns default labels for waiter', () => {
    const labels = getRoleMetricsLabel('waiter' as StaffRole);
    expect(labels.ordersLabel).toBe('Orders Handled');
    expect(labels.speedLabel).toBe('Service Speed');
    expect(labels.efficiencyLabel).toBe('Service Efficiency');
  });

  it('returns default labels for admin', () => {
    const labels = getRoleMetricsLabel('admin' as StaffRole);
    expect(labels.ordersLabel).toBe('Orders Handled');
    expect(labels.speedLabel).toBe('Service Speed');
    expect(labels.efficiencyLabel).toBe('Service Efficiency');
  });

  it('returns default labels for roles without a specialised label', () => {
    const labels = getRoleMetricsLabel('waiter' as StaffRole);
    expect(labels.ordersLabel).toBe('Orders Handled');
    expect(labels.speedLabel).toBe('Service Speed');
    expect(labels.efficiencyLabel).toBe('Service Efficiency');
  });
});
