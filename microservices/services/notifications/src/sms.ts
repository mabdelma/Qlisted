import { createRequire } from "node:module";
import { createLogger } from "@qlisted/shared";

const log = createLogger("notifications.sms");

/**
 * Same hazard as @qlisted/shared's events module: this was
 * `createRequire(import.meta.url)` at module scope, and esbuild cannot provide
 * `import.meta` in the CJS output every service Dockerfile produces. The
 * argument was undefined, createRequire threw while the module was still
 * evaluating, and the notifications service died on startup — the bundle built
 * cleanly and every test passed.
 *
 * Resolved lazily: real ESM uses `import.meta.url`, a CJS bundle falls back to
 * `__filename`, and if neither works the caller gets null and SMS degrades to
 * logs-only, which is this module's documented fallback anyway.
 */
let _cachedRequire: ((id: string) => unknown) | null = null;
function bundleSafeRequire(): ((id: string) => unknown) | null {
  if (_cachedRequire) return _cachedRequire;
  const metaUrl = typeof import.meta !== "undefined" ? import.meta.url : undefined;
  for (const from of [metaUrl, typeof __filename === "string" ? __filename : undefined]) {
    if (!from) continue;
    try {
      _cachedRequire = createRequire(from) as (id: string) => unknown;
      return _cachedRequire;
    } catch {
      /* try the next origin */
    }
  }
  return null;
}

/** Lazily load Twilio; logs-only fallback when unconfigured (monolith parity). */
function getTwilio(): { client: { messages: { create: (o: { body: string; from: string; to: string }) => Promise<unknown> } }; from: string } | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;
  if (!accountSid || !authToken || !fromNumber) return null;
  try {
    const req = bundleSafeRequire();
    if (!req) { log.warn("no require available for twilio, SMS will be logged only"); return null; }
    const twilio = req("twilio") as (sid: string, token: string) => { messages: { create: (o: { body: string; from: string; to: string }) => Promise<unknown> } };
    return { client: twilio(accountSid, authToken), from: fromNumber };
  } catch {
    log.warn("twilio package not installed, SMS will be logged only");
    return null;
  }
}

export async function sendSms(to: string, message: string): Promise<boolean> {
  const tw = getTwilio();
  if (!tw) {
    log.info({ to, message }, "[SMS MOCK] Would send SMS");
    return true;
  }
  try {
    await tw.client.messages.create({ body: message, from: tw.from, to });
    log.info({ to }, "SMS sent successfully");
    return true;
  } catch (err) {
    log.error({ err, to }, "Failed to send SMS");
    return false;
  }
}

export async function sendOrderSms(to: string, orderId: string, message: string): Promise<boolean> {
  return sendSms(to, `[Order #${orderId.slice(0, 8).toUpperCase()}] ${message}`);
}
