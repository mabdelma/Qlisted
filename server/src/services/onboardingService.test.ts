import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed-password'),
    compare: vi.fn(),
  },
  hash: vi.fn().mockResolvedValue('hashed-password'),
  compare: vi.fn(),
}));

vi.mock('uuid', () => ({
  v4: vi.fn().mockReturnValue('mock-uuid'),
}));

vi.mock('crypto', () => ({
  default: {
    randomBytes: vi.fn(),
  },
  randomBytes: vi.fn(),
}));

import { onboardTenant, getPlans, createPlan } from './onboardingService.js';
import { db } from '../db/index.js';
import crypto from 'crypto';

describe('onboardingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(crypto.randomBytes).mockReturnValue({ toString: () => 'mock-verification-token' } as unknown as Buffer);
  });

  describe('onboardTenant', () => {
    it('returns error if slug already taken', async () => {
      db.__setQueryData([{ id: 'existing', slug: 'taken' }]);

      const result = await onboardTenant({
        restaurantName: 'Test',
        slug: 'taken',
        email: 'admin@test.com',
        password: 'pass123',
      });

      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toBe('Restaurant slug already taken');
        expect(result.status).toBe(409);
      }
    });

    it('creates tenant, user, and trial subscription', async () => {
      db.__setQueryQueue([
        [],
        [{ id: 'plan-1', name: 'Basic', price: 0 }],
      ]);

      const result = await onboardTenant({
        restaurantName: 'New Cafe',
        slug: 'new-cafe',
        email: 'admin@cafe.com',
        password: 'secure123',
      });

      expect(db.insert).toHaveBeenCalledTimes(3);
      expect('data' in result).toBe(true);
      if ('data' in result) {
        expect(result.data.slug).toBe('new-cafe');
        expect(result.data.tenantId).toBeTruthy();
        expect(result.status).toBe(201);
      }
    });

    it('creates tenant and user when no default plan exists', async () => {
      db.__setQueryQueue([[], []]);

      const result = await onboardTenant({
        restaurantName: 'No Plan Cafe',
        slug: 'no-plan',
        email: 'admin@noplan.com',
        password: 'pass123',
      });

      expect(db.insert).toHaveBeenCalledTimes(2);
      expect('data' in result).toBe(true);
      if ('data' in result) {
        expect(result.status).toBe(201);
      }
    });

    it('accepts optional fields', async () => {
      db.__setQueryQueue([[], [{ id: 'plan-1' }]]);

      const result = await onboardTenant({
        restaurantName: 'Full Cafe',
        slug: 'full-cafe',
        email: 'admin@full.com',
        password: 'secure123',
        phone: '+1-555-0100',
        address: '123 Main St',
        currency: 'EUR',
        timezone: 'Europe/Berlin',
      });

      expect('data' in result).toBe(true);
      if ('data' in result) {
        expect(result.status).toBe(201);
      }
      expect(db.insert).toHaveBeenCalledTimes(3);
    });
  });

  describe('getPlans', () => {
    it('returns plans ordered by price', async () => {
      const plans = [
        { id: 'p1', name: 'Free', price: 0 },
        { id: 'p2', name: 'Pro', price: 29 },
      ];
      db.__setQueryData(plans);

      const result = await getPlans();

      expect(result).toEqual(plans);
      expect(db.orderBy).toHaveBeenCalled();
    });

    it('returns empty array when no plans', async () => {
      db.__setQueryData([]);

      const result = await getPlans();

      expect(result).toEqual([]);
    });
  });

  describe('createPlan', () => {
    it('creates a plan and returns its id', async () => {
      const result = await createPlan({ name: 'Premium', price: 49 });

      expect(db.insert).toHaveBeenCalledOnce();
      expect(result.id).toBe('mock-uuid');
    });

    it('accepts optional plan fields', async () => {
      const result = await createPlan({
        name: 'Enterprise', price: 99,
        maxMenus: 50, maxTables: 100, maxStaff: 20,
        features: 'analytics,api',
      });

      expect(db.insert).toHaveBeenCalledOnce();
      expect(result.id).toBe('mock-uuid');
    });
  });
});
