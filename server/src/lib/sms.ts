import { createRequire } from 'module';
import { logger } from './logger.js';

const _require = createRequire(import.meta.url);

function getTwilio() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;
  if (!accountSid || !authToken || !fromNumber) return null;
  try {
    const twilio = _require('twilio');
    return { client: twilio(accountSid, authToken), from: fromNumber };
  } catch {
    logger.warn('twilio package not installed, SMS will be logged only');
    return null;
  }
}

export async function sendSms(to: string, message: string): Promise<boolean> {
  const tw = getTwilio();
  if (!tw) {
    logger.info({ to, message }, '[SMS MOCK] Would send SMS');
    return true;
  }
  try {
    await tw.client.messages.create({ body: message, from: tw.from, to });
    logger.info({ to }, 'SMS sent successfully');
    return true;
  } catch (err) {
    logger.error({ err, to }, 'Failed to send SMS');
    return false;
  }
}

export async function sendOrderSms(to: string, orderId: string, message: string) {
  const text = `[Order #${orderId.slice(0, 8).toUpperCase()}] ${message}`;
  return sendSms(to, text);
}
