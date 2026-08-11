import { describe, it, expect, beforeEach } from "vitest";
import { LogBus, setEventBus, getEventBus, resetEventBus } from "./events";
import type { DomainEvent } from "./types";

describe("LogBus", () => {
  it("dispatches matching handlers on publish", async () => {
    const bus = new LogBus();
    const seen: DomainEvent[] = [];
    bus.subscribe("order.placed", (e) => { seen.push(e); });
    await bus.publish({ type: "order.placed", orderId: "o1", tenantId: "t1", total: 42 });
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ type: "order.placed", orderId: "o1" });
  });

  it("does not call handlers for other event types", async () => {
    const bus = new LogBus();
    const seen: string[] = [];
    bus.subscribe("order.ready", () => { seen.push("ready"); });
    await bus.publish({ type: "order.placed", orderId: "o1", tenantId: "t1", total: 1 });
    expect(seen).toHaveLength(0);
  });

  it("tracks handler counts", () => {
    const bus = new LogBus();
    bus.subscribe("payment.succeeded", () => {});
    bus.subscribe("payment.succeeded", () => {});
    expect(bus.handlerCount("payment.succeeded")).toBe(2);
  });
});

describe("getEventBus / setEventBus", () => {
  beforeEach(() => resetEventBus());

  it("defaults to an in-process bus without REDIS_URL", () => {
    delete process.env.REDIS_URL;
    expect(getEventBus()).toBeInstanceOf(LogBus);
  });

  it("honours an injected bus", async () => {
    const bus = new LogBus();
    setEventBus(bus);
    const evt: DomainEvent = { type: "promo.validated", campaignId: "c1", tenantId: "t1", code: "SAVE10" };
    const seen: DomainEvent[] = [];
    getEventBus().subscribe("promo.validated", (e) => { seen.push(e); });
    await getEventBus().publish(evt);
    expect(seen).toEqual([evt]);
  });
});
