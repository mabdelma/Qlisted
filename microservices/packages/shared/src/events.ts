import { createRequire } from "node:module";
import type { DomainEvent } from "./types.js";

const _require = createRequire(import.meta.url);

/**
 * Event-bus abstraction for async cross-service communication (mirrors the
 * Escoutly/GMT `packages/shared/events` contract). Producers `publish` domain
 * events; consumers `subscribe`. The default `LogBus` dispatches in-process and
 * logs (so a service runs with zero infrastructure); swap in the Redis adapter
 * (`createRedisBus`) in production so events fan out across instances:
 *
 *   order.placed      → notifications (email/SMS the guest)
 *   order.ready       → notifications (push the guest), billing (if any)
 *   payment.succeeded → billing / orders (mark paid)
 *   menu.item.created → engagement (recommendations), catalog consumers
 *   user.registered   → notifications (welcome / verify)
 */
export interface EventBus {
  publish(event: DomainEvent): Promise<void>;
  subscribe(
    type: DomainEvent["type"],
    handler: (e: DomainEvent) => Promise<void> | void,
  ): void;
}

type Handler = (e: DomainEvent) => Promise<void> | void;

/** In-process dispatch + structured log. Works with no broker at all. */
export class LogBus implements EventBus {
  private handlers = new Map<string, Handler[]>();

  async publish(event: DomainEvent): Promise<void> {
    const hs = this.handlers.get(event.type) ?? [];
    await Promise.all(hs.map((h) => h(event)));
  }

  subscribe(type: DomainEvent["type"], handler: Handler): void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler);
    this.handlers.set(type, list);
  }

  /** Number of subscribed handlers for a type (tests + observability). */
  handlerCount(type: DomainEvent["type"]): number {
    return (this.handlers.get(type) ?? []).length;
  }
}

interface RedisLike {
  publish(channel: string, message: string): Promise<number>;
  subscribe(channel: string): Promise<void>;
  unsubscribe(channel: string): Promise<void>;
  on(event: string, handler: (...args: unknown[]) => void): unknown;
  off(event: string, handler: (...args: unknown[]) => void): unknown;
}

type RedisConstructor = new (url: string, opts?: Record<string, unknown>) => RedisLike;

const CHANNEL = "qlisted:events";

function loadRedis(): RedisConstructor | null {
  try {
    // Lazy require keeps this module usable in edge runtimes / test runners.
    const mod = _require("ioredis") as { default?: RedisConstructor; Redis?: RedisConstructor };
    return mod.default ?? mod.Redis ?? null;
  } catch {
    return null;
  }
}

/**
 * Redis pub/sub bus. Publishes fan out to every instance (and back to local
 * in-process handlers so a single instance works too). Requires a `REDIS_URL`.
 */
export class RedisBus implements EventBus {
  private handlers = new Map<string, Handler[]>();
  private readonly pub: RedisLike;
  private readonly sub: RedisLike;
  private readonly onMessage = (...args: unknown[]) => {
    const [channel, message] = args as [string, string];
    if (channel !== CHANNEL) return;
    try {
      const event = JSON.parse(message) as DomainEvent;
      void this.dispatch(event);
    } catch {
      /* ignore malformed messages */
    }
  };

  constructor(redisUrl: string) {
    const Ctor = loadRedis();
    if (!Ctor) throw new Error("ioredis is required for RedisBus (add it to your service deps)");
    this.pub = new Ctor(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 3 });
    this.sub = new Ctor(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 3 });
    this.pub.connect?.();
    this.sub.connect?.();
    this.sub.on("message", this.onMessage);
  }

  async publish(event: DomainEvent): Promise<void> {
    await this.dispatch(event);
    try {
      await this.pub.publish(CHANNEL, JSON.stringify(event));
    } catch {
      /* local dispatch already happened; a broker outage must not drop it */
    }
  }

  subscribe(type: DomainEvent["type"], handler: Handler): void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler);
    this.handlers.set(type, list);
    this.sub.subscribe(CHANNEL).catch(() => {});
  }

  async close(): Promise<void> {
    try { await this.sub.unsubscribe(CHANNEL); } catch { /* ignore */ }
    this.sub.off("message", this.onMessage);
    this.sub.disconnect?.();
    this.pub.disconnect?.();
  }

  private async dispatch(event: DomainEvent): Promise<void> {
    const hs = this.handlers.get(event.type) ?? [];
    await Promise.all(hs.map((h) => h(event)));
  }
}

let _bus: EventBus | null = null;

/**
 * Returns the process-wide event bus. Defaults to `LogBus`; when `REDIS_URL` is
 * set (and ioredis is installed) it becomes a `RedisBus` so events fan out
 * across service instances. Call `setEventBus` first to inject a custom bus.
 */
export function getEventBus(): EventBus {
  if (!_bus) {
    const url = process.env.REDIS_URL;
    _bus = url ? new RedisBus(url) : new LogBus();
  }
  return _bus;
}

/** Override the process-wide bus (tests, or wiring in a custom adapter). */
export function setEventBus(bus: EventBus): EventBus {
  _bus = bus;
  return bus;
}

/** Reset the singleton (tests). */
export function resetEventBus(): void {
  if (_bus instanceof RedisBus) void _bus.close();
  _bus = null;
}
