import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { resolveTenant } from '../middleware/tenant.js';
import { onOrderEvent } from '../lib/events.js';

const events = new Hono();

/**
 * Live order stream (SSE). The kitchen display and the admin order list both
 * consume it.
 *
 * This was written against Node's `ServerResponse` — `c.res as unknown as
 * ServerResponse`, then `writeHead`/`write`/`on`. In Hono `c.res` is a web
 * `Response`, which has none of those methods, so the very first line threw
 * `res.writeHead is not a function` and EVERY request to this endpoint
 * returned 500. Live updates never worked anywhere, and because the client
 * reconnects on error, a connected browser retried every few seconds forever.
 * The `as unknown as` cast is what let it compile.
 *
 * Rewritten on Hono's own SSE helper, which owns the response and the headers.
 */
events.get('/:slug/events', resolveTenant, (c) => {
  const tenantId = c.get('tenantId');

  return streamSSE(c, async (stream) => {
    let unsubscribe: (() => void) | null = null;
    let keepAlive: ReturnType<typeof setInterval> | null = null;

    const teardown = () => {
      unsubscribe?.();
      unsubscribe = null;
      if (keepAlive) { clearInterval(keepAlive); keepAlive = null; }
    };

    // The callback must stay pending for as long as the client is listening:
    // returning closes the stream. Resolve only once the client goes away.
    await new Promise<void>((resolve) => {
      stream.onAbort(() => { teardown(); resolve(); });

      unsubscribe = onOrderEvent(tenantId, (event) => {
        // A write to a stream the client has already dropped rejects; tear
        // down rather than letting it surface as an unhandled rejection.
        void stream
          .writeSSE({ event: event.type, data: JSON.stringify(event) })
          .catch(() => { teardown(); resolve(); });
      });

      // Without periodic traffic an idle SSE connection is dropped by proxies
      // and by some mobile networks.
      keepAlive = setInterval(() => {
        void stream
          .writeSSE({ event: 'ping', data: '' })
          .catch(() => { teardown(); resolve(); });
      }, 15000);
    });
  });
});

export default events;
