import webpush from "web-push";
import { randomUUID } from "node:crypto";
import { createLogger } from "@qlisted/shared";
import type { Pool } from "pg";

const log = createLogger("notifications.push");

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || "";
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || "";
if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:support@qcart.app", vapidPublicKey, vapidPrivateKey);
}

export interface PushService {
  addSubscription(endpoint: string, p256dh: string, auth: string, tenantId: string, userAgent?: string): Promise<void>;
  removeSubscription(endpoint: string): Promise<void>;
  sendPushNotification(tenantId: string, title: string, body: string, icon?: string, data?: Record<string, unknown>): Promise<{ sent: number; failed: number }>;
}

export function createPush(pool: Pick<Pool, "query">): PushService {
  return {
    async addSubscription(endpoint, p256dh, auth, tenantId, userAgent) {
      const existing = await pool.query("SELECT id FROM push_subscriptions WHERE endpoint = $1 LIMIT 1", [endpoint]);
      if (existing.rows[0]) {
        await pool.query("UPDATE push_subscriptions SET p256dh = $1, auth = $2, user_agent = $3 WHERE endpoint = $4", [p256dh, auth, userAgent ?? null, endpoint]);
        return;
      }
      await pool.query(
        "INSERT INTO push_subscriptions (id, tenant_id, endpoint, p256dh, auth, user_agent) VALUES ($1,$2,$3,$4,$5,$6)",
        [randomUUID(), tenantId, endpoint, p256dh, auth, userAgent ?? null],
      );
    },

    async removeSubscription(endpoint) {
      await pool.query("DELETE FROM push_subscriptions WHERE endpoint = $1", [endpoint]);
    },

    async sendPushNotification(tenantId, title, body, icon, data) {
      if (!vapidPublicKey || !vapidPrivateKey) {
        log.warn({ tenantId }, "Push notifications not configured — set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY");
        return { sent: 0, failed: 0 };
      }
      const subs = await pool.query("SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE tenant_id = $1", [tenantId]);
      if (!subs.rows.length) return { sent: 0, failed: 0 };
      const payload = JSON.stringify({ title, body, icon: icon || "/icon.svg", data });
      const results = await Promise.allSettled(subs.rows.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
        } catch (err: unknown) {
          const code = err && typeof err === "object" && "statusCode" in err ? (err as { statusCode: number }).statusCode : 0;
          if (code === 410) {
            await pool.query("DELETE FROM push_subscriptions WHERE endpoint = $1", [s.endpoint]);
            log.info({ endpoint: s.endpoint.slice(0, 30) }, "Removed expired push subscription");
          }
        }
      }));
      return {
        sent: results.filter((r) => r.status === "fulfilled").length,
        failed: results.filter((r) => r.status === "rejected").length,
      };
    },
  };
}

export function getVapidPublicKey() {
  return vapidPublicKey;
}
