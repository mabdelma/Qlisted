import { createRequire } from "node:module";
import { createLogger } from "@qlisted/shared";

const log = createLogger("notifications.sms");
const _require = createRequire(import.meta.url);

/** Lazily load Twilio; logs-only fallback when unconfigured (monolith parity). */
function getTwilio(): { client: { messages: { create: (o: { body: string; from: string; to: string }) => Promise<unknown> } }; from: string } | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;
  if (!accountSid || !authToken || !fromNumber) return null;
  try {
    const twilio = _require("twilio") as (sid: string, token: string) => { messages: { create: (o: { body: string; from: string; to: string }) => Promise<unknown> } };
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
