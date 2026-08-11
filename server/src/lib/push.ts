import webpush from 'web-push';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { logger } from './logger.js';

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    'mailto:support@qcart.app',
    vapidPublicKey,
    vapidPrivateKey,
  );
}

export async function addSubscription(endpoint: string, p256dh: string, auth: string, tenantId: string, userAgent?: string) {
  const existing = await db
    .select({ id: schema.pushSubscriptions.id })
    .from(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.endpoint, endpoint))
    .limit(1);

  if (existing.length > 0) {
    await db.update(schema.pushSubscriptions)
      .set({ p256dh, auth, userAgent })
      .where(eq(schema.pushSubscriptions.endpoint, endpoint));
    return;
  }

  await db.insert(schema.pushSubscriptions).values({
    id: uuid(),
    tenantId,
    endpoint,
    p256dh,
    auth,
    userAgent,
  });
}

export async function removeSubscription(endpoint: string) {
  await db.delete(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.endpoint, endpoint));
}

async function getSubscriptionsForTenant(tenantId: string) {
  return db
    .select()
    .from(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.tenantId, tenantId));
}

export async function sendPushNotification(tenantId: string, title: string, body: string, icon?: string, data?: Record<string, unknown>) {
  if (!vapidPublicKey || !vapidPrivateKey) {
    logger.warn({ tenantId }, 'Push notifications not configured — set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY');
    return { sent: 0, failed: 0, error: 'Push not configured' };
  }

  const subs = await getSubscriptionsForTenant(tenantId);
  if (subs.length === 0) return { sent: 0, failed: 0 };

  const payload = JSON.stringify({ title, body, icon: icon || '/icon.svg', data });

  const results = await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
      } catch (err: unknown) {
        const statusCode = err && typeof err === 'object' && 'statusCode' in err
          ? (err as { statusCode: number }).statusCode : 0;
        if (statusCode === 410) {
          await removeSubscription(sub.endpoint);
          logger.info({ endpoint: sub.endpoint.slice(0, 30) }, 'Removed expired push subscription');
        }
      }
    })
  );

  return {
    sent: results.filter(r => r.status === 'fulfilled').length,
    failed: results.filter(r => r.status === 'rejected').length,
  };
}

export function getVapidPublicKey() {
  return vapidPublicKey;
}
