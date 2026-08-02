import { rateLimiter } from 'hono-rate-limiter';
import type { Context } from 'hono';

// NOTE: In-memory rate limiting. hono-rate-limiter's RedisStore expects a
// node-redis client (it calls client.scriptLoad); the ioredis client previously
// wired here was incompatible and threw "this.client.scriptLoad is not a
// function" on every rate-limited request — taking down /api/auth (login) with
// 500s. MemoryStore is correct for a single API instance. To share limits across
// instances later, pass a node-redis (`redis` package) client to RedisStore.
function keyGenerator(c: Context): string {
  const forwarded = c.req.header('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || c.req.header('x-real-ip') || 'unknown';
}

// Each limiter gets its own default MemoryStore (omit `store`), so the different
// windows/limits don't share counters.
export const generalLimiter = rateLimiter({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-7',
  keyGenerator,
  message: { error: 'Too many requests, please try again later' },
  statusCode: 429,
});

export const authLimiter = rateLimiter({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  keyGenerator,
  message: { error: 'Too many login attempts, please try again later' },
  statusCode: 429,
});

export const publicLimiter = rateLimiter({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  keyGenerator,
  message: { error: 'Too many requests, please try again later' },
  statusCode: 429,
});

export const paymentLimiter = rateLimiter({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  keyGenerator,
  message: { error: 'Too many payment requests, please try again later' },
  statusCode: 429,
});

export const pointsLimiter = rateLimiter({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  keyGenerator,
  message: { error: 'Too many requests, please try again later' },
  statusCode: 429,
});

// AI chat is an LLM round-trip per message — guard the public and admin endpoints
// so a scripted client can't burn the operator's API budget.
export const aiLimiter = rateLimiter({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  keyGenerator,
  message: { error: 'Too many requests, please try again later' },
  statusCode: 429,
});

// Voice sessions mint an expensive OpenAI Realtime token — keep it very tight.
export const voiceLimiter = rateLimiter({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  keyGenerator,
  message: { error: 'Too many voice requests, please try again later' },
  statusCode: 429,
});
