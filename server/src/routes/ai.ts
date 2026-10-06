import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { resolveTenant } from '../middleware/tenant.js';
import { aiLimiter, voiceLimiter } from '../middleware/rateLimiter.js';
import { adminCopilot, customerChat, createRealtimeSession, generateMenuCopy, aiEnabled, type CustomerContext } from '../services/aiService.js';

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

const menuCopySchema = z.object({
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().max(120).optional(),
  price: z.number().min(0).optional(),
  currency: z.string().trim().max(8).optional(),
  existingDescription: z.string().max(2000).nullable().optional(),
});

/**
 * Generate a menu item's description and its translations.
 *
 * Returns the copy rather than writing it, so the admin sees what was produced
 * and can edit before saving — generated text about food is exactly the kind of
 * thing that should not be persisted unreviewed.
 *
 * Rate-limited with the other AI endpoints, and admin/manager only: it spends
 * provider credit.
 */
ai.post('/:slug/ai/menu-copy', authMiddleware, requireRole('admin', 'manager'), resolveTenant, aiLimiter, zValidator('json', menuCopySchema), async (c) => {
  if (!aiEnabled()) return c.json({ error: 'AI is not configured' }, 503);
  const input = c.req.valid('json');
  const copy = await generateMenuCopy(input.name, input);
  // A null description means the provider failed or returned nothing usable.
  // That is not a server error — the caller keeps whatever they typed.
  return c.json({ data: copy });
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
