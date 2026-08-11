import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('uuid', () => ({
  v4: vi.fn().mockReturnValue('mock-uuid'),
}));

vi.mock('crypto', () => ({
  default: {
    randomBytes: vi.fn(),
    createHmac: vi.fn(),
  },
  randomBytes: vi.fn(),
  createHmac: vi.fn(),
}));

import {
  getIntegrations,
  createIntegration,
  updateIntegration,
  deleteIntegration,
  triggerWebhooks,
} from './integrationService.js';
import { db } from '../db/index.js';
import { logger } from '../lib/logger.js';
import crypto from 'crypto';

describe('integrationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(crypto.randomBytes).mockReturnValue({ toString: () => 'mock-secret' } as unknown as Buffer);
    vi.mocked(crypto.createHmac).mockReturnValue({
      update: vi.fn().mockReturnValue({
        digest: vi.fn().mockReturnValue('mock-signature'),
      }),
    } as unknown as ReturnType<typeof crypto.createHmac>);
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getIntegrations', () => {
    it('returns integrations for tenant', async () => {
      const integrations = [{ id: 'int-1', name: 'My Integration' }];
      db.__setQueryData(integrations);

      const result = await getIntegrations('tenant-1');

      expect(db.select).toHaveBeenCalled();
      expect(result).toEqual(integrations);
    });

    it('returns empty array when no integrations', async () => {
      db.__setQueryData([]);

      const result = await getIntegrations('tenant-1');

      expect(result).toEqual([]);
    });
  });

  describe('createIntegration', () => {
    it('creates integration and returns id and secret', async () => {
      const result = await createIntegration('tenant-1', {
        name: 'Delivery Webhook',
        provider: 'delivery',
        url: 'https://api.delivery.com/webhook',
      });

      expect(db.insert).toHaveBeenCalledOnce();
      expect(result.id).toBe('mock-uuid');
      expect(result.secret).toBe('mock-secret');
    });

    it('accepts events filter', async () => {
      const result = await createIntegration('tenant-1', {
        name: 'Accounting Sync',
        provider: 'accounting',
        url: 'https://api.accounting.com/hook',
        events: 'payment_completed',
      });

      expect(db.insert).toHaveBeenCalledOnce();
      expect(result.id).toBe('mock-uuid');
    });
  });

  describe('updateIntegration', () => {
    it('updates integration fields', async () => {
      await updateIntegration('int-1', 'tenant-1', { name: 'Updated', isActive: false });

      expect(db.update).toHaveBeenCalled();
    });
  });

  describe('deleteIntegration', () => {
    it('deletes integration', async () => {
      await deleteIntegration('int-1', 'tenant-1');

      expect(db.delete).toHaveBeenCalled();
    });
  });

  describe('triggerWebhooks', () => {
    const baseIntegration = {
      id: 'int-1',
      tenantId: 'tenant-1',
      url: 'https://example.com/webhook',
      secret: 'mock-secret',
      events: 'order.created,order.updated',
      isActive: true,
      lastTriggeredAt: null,
    };

    it('dispatches webhook with signature for matching event', async () => {
      db.__setQueryData([baseIntegration]);
      vi.mocked(global.fetch).mockResolvedValue({ status: 200 } as unknown as Response);

      await triggerWebhooks('tenant-1', 'order.created', { id: 'order-1' });

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Qlisted-Event': 'order.created',
            'X-Qlisted-Signature': 'mock-signature',
          }),
          body: JSON.stringify({ id: 'order-1' }),
        }),
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ integrationId: 'int-1', event: 'order.created' }),
        'Webhook triggered',
      );
    });

    it('skips integration when event does not match', async () => {
      db.__setQueryData([baseIntegration]);

      await triggerWebhooks('tenant-1', 'payment.received', { id: 'order-1' });

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('handles webhook URL errors gracefully', async () => {
      db.__setQueryData([baseIntegration]);
      vi.mocked(global.fetch).mockRejectedValue(new Error('Connection refused'));

      await triggerWebhooks('tenant-1', 'order.created', { id: 'order-1' });

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ integrationId: 'int-1', event: 'order.created' }),
        'Webhook trigger failed',
      );
    });

    it('processes multiple integrations and handles partial failures', async () => {
      const int2 = { ...baseIntegration, id: 'int-2', url: 'https://other.com/webhook' };
      db.__setQueryData([baseIntegration, int2]);
      vi.mocked(global.fetch)
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce({ status: 200 } as unknown as Response);

      await triggerWebhooks('tenant-1', 'order.created', { id: 'order-1' });

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ integrationId: 'int-1' }),
        'Webhook trigger failed',
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ integrationId: 'int-2' }),
        'Webhook triggered',
      );
    });

    it('does nothing when no active integrations exist', async () => {
      db.__setQueryData([]);

      await triggerWebhooks('tenant-1', 'order.created', { id: 'order-1' });

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('dispatches without signature when integration has no secret', async () => {
      const integrationNoSecret = { ...baseIntegration, secret: null };
      db.__setQueryData([integrationNoSecret]);
      vi.mocked(global.fetch).mockResolvedValue({ status: 200 } as unknown as Response);

      await triggerWebhooks('tenant-1', 'order.created', { id: 'order-1' });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
            'X-Qlisted-Event': 'order.created',
          },
        }),
      );
    });
  });
});
