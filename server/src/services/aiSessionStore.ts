import { createRequire } from 'module';
import { logger } from '../lib/logger.js';

// Small Redis-backed key/value store for AI conversation sessions.
// Falls back to an in-memory map when Redis is not configured (local dev,
// tests) — the app's real-time event bus already requires REDIS_URL, so this
// store only uses Redis when one is available.
const _require = createRequire(import.meta.url);

interface RedisInstance {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: 'EX', ttl: number): Promise<unknown>;
  del(key: string): Promise<number>;
  on(event: string, handler: (...args: unknown[]) => void): unknown;
}
type RedisConstructor = new (url: string, opts: Record<string, unknown>) => RedisInstance;

let RedisClass: RedisConstructor | null = null;
try {
  RedisClass = _require('ioredis');
} catch {
  // ioredis missing — memory only.
}

const redisUrl = process.env.REDIS_URL;
const memory = new Map<string, { value: unknown; expiresAt: number }>();
let redis: RedisInstance | null = null;

if (RedisClass && redisUrl) {
  redis = new RedisClass(redisUrl, { maxRetriesPerRequest: 2, lazyConnect: true });
  redis.on('error', (err: unknown) => logger.warn({ err }, 'AI session Redis unavailable — using memory store'));
}

const DEFAULT_TTL_SEC = 60 * 60; // 1h idle, matches the previous in-memory cart TTL

export async function sessionGet<T>(key: string): Promise<T | null> {
  if (redis) {
    try {
      const raw = await redis.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }
  const rec = memory.get(key);
  if (!rec) return null;
  if (rec.expiresAt < Date.now()) {
    memory.delete(key);
    return null;
  }
  return rec.value as T;
}

export async function sessionSet<T>(key: string, value: T, ttlSec = DEFAULT_TTL_SEC): Promise<void> {
  if (redis) {
    try {
      await redis.set(key, JSON.stringify(value), 'EX', ttlSec);
    } catch {
      // fall through — the value is best-effort; the client re-seeds from its cart
    }
    return;
  }
  memory.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
}

export async function sessionDelete(key: string): Promise<void> {
  if (redis) {
    try {
      await redis.del(key);
    } catch {
      // ignore
    }
    return;
  }
  memory.delete(key);
}
