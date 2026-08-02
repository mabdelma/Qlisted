import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { resolveTenant } from '../middleware/tenant.js';
import { aiLimiter, voiceLimiter } from '../middleware/rateLimiter.js';
import { adminCopilot, customerChat, createRealtimeSession, aiEnabled, type CustomerContext } from '../services/aiService.js';

const ai = new Hono();

const chatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(4000),
  })).min(1).max(40),
});

const cartLineSchema = z.object({
  menuItemId: z.string(),
  name: z.string(),
  quantity: z.number().int().min(1).max(99),
  unitPrice: z.number().min(0),
  imageUrl: z.string().nullable().optional(),
});

const customerChatSchema = chatSchema.extend({
  context: z.object({
    cart: z.array(cartLineSchema).optional(),
    orderToken: z.string().optional(),
    orderId: z.string().optional(),
    locale: z.string().optional(),
    isMobile: z.boolean().optional(),
  }).optional(),
});

// Is the assistant configured? (cheap check for the UI to hide the feature)
ai.get('/:slug/ai/status', resolveTenant, (c) => c.json({ enabled: aiEnabled() }));

// Admin copilot — tenant-scoped tool-use over the restaurant's data.
ai.post('/:slug/ai/admin', authMiddleware, requireRole('admin', 'manager'), resolveTenant, aiLimiter, zValidator('json', chatSchema), async (c) => {
  const tenant = c.get('tenant');
  const { messages } = c.req.valid('json');
  const result = await adminCopilot(tenant.id, tenant.name, tenant.currency, messages);
  if ('error' in result) return c.json({ error: result.error }, result.status);
  return c.json(result.data);
});

// Customer menu chat — public (guest at a table). Tool-use over the menu plus a
// per-session cart mirror; the client passes its cart + order token as context.
ai.post('/:slug/ai/customer', resolveTenant, aiLimiter, zValidator('json', customerChatSchema), async (c) => {
  const tenant = c.get('tenant');
  const { messages, context } = c.req.valid('json');
  const result = await customerChat(tenant.id, tenant.name, tenant.currency, messages, context as CustomerContext | undefined);
  if ('error' in result) return c.json({ error: result.error }, result.status);
  return c.json(result.data);
});

// Voice ordering — mint an ephemeral OpenAI Realtime token for the browser's
// WebRTC connection (the real API key stays server-side). Public endpoint, so
// it is rate-limited tightly to stop token-minting abuse.
ai.post('/:slug/ai/voice-session', resolveTenant, voiceLimiter, async (c) => {
  const tenant = c.get('tenant');
  const result = await createRealtimeSession(tenant.id, tenant.name, tenant.currency);
  if ('error' in result) return c.json({ error: result.error }, result.status);
  return c.json(result.data);
});

export default ai;
