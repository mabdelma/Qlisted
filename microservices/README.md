# Qlisted microservices

A **strangler-fig** decomposition of the Qlisted backend, mirroring the Escoutly
services pattern. The live application is still the `server/` monolith — these
services run behind the `gateway/`, which rewrites one path prefix at a time.
**catalog**, **orders**, **engagement**, **billing** and **notifications** are
ported for real (shared Postgres + `@qlisted/shared` domain events); **auth**
and the gateway remain scaffolds.

```
microservices/
  packages/shared/        @qlisted/shared — jwt · logger · http envelopes · event bus · domain events
  services/
    gateway/              public seam; routes a prefix → a service, else the monolith
    auth/                 users, JWT, sessions, super_admin            ← server/src/routes/auth.ts
    catalog/              menu: categories, items, translations, import, reorder  ← server/src/routes/menu.ts
    orders/               carts, orders, KDS status, live feed (SSE)  ← server/src/routes/orders.ts
    billing/              Stripe payments + SaaS subscriptions         ← server/src/services/{payment,subscription}Service.ts
    engagement/           loyalty, promotions, campaigns, marketing    ← loyalty/promotions/marketing routes
    notifications/        email/SMS/push delivery + bus consumers      ← server/src/services/emailService
```

## Run locally

```bash
cd microservices
cp .env.example .env          # set AUTH_SECRET = the monolith JWT_SECRET
npm install                   # workspaces link @qlisted/shared
npm run dev:auth              # or dev:catalog / dev:orders / dev:gateway …
# health check
curl localhost:8080/health
```

Or the whole stack with Docker:

```bash
docker compose -f docker-compose.services.yml --env-file .env up -d --build
curl localhost:8080/health    # (gateway, if you publish a port)
```

## What's migrated

- **catalog** — full menu port: public reads, categories/items CRUD, per-item
  translations, bulk import, transactional reorder (items + categories). Auth:
  writes `admin|manager`, deletes `admin`, tenant-scoped. Publishes
  `menu.category.*` / `menu.item.*`. 20 route tests.
- **orders** — place → track → status flow, reads (list/table/server) with
  pagination, update-items, discount, comp, live SSE via the Redis
  `order:<tenantId>` channel (parity with the monolith `/events` KDS relay).
  Publishes `order.placed/updated/status.changed/ready`. 16 route tests.
- **engagement** — loyalty (earn/redeem/redeem-for-order with the order
  discount loop and tiers), promo validate/apply, campaigns CRUD, marketing
  segment sends that fan out to `notifications`. Publishes
  `loyalty.points.*`, `promo.validated`, `campaign.sent`. 18 route tests.
- **billing** — SaaS subscription read/checkout/cancel, Stripe webhook
  (subscription events + `payment_intent.succeeded`), receipt emails via
  `notifications`. Publishes `subscription.updated`, `payment.succeeded`.
- **notifications** — `/v1/notify/{send,email,sms,push}`, push subscription
  management (web-push + Twilio SMS with mock fallback), and bus consumers:
  `order.placed` → confirmation email, `order.ready` → web push.
- **shared** — `getEventBus()` (`LogBus` local, `RedisBus` when `REDIS_URL` is
  set), monolith-compatible `verifyHs256`/`bearer`, `ok`/`err` envelopes,
  `DomainEvent` union. 18 unit tests.

## Domain events

`order.*`, `payment.succeeded`, `subscription.updated`, `menu.*`,
`loyalty.*`, `promo.validated`, `campaign.sent`. Services that publish or
subscribe need `REDIS_URL` (RedisBus) + the `ioredis` dependency; in tests
`REDIS_URL` is unset so the bus stays local.

## Testing

Each ported service ships a vitest suite that mocks `pg` (and leaves Redis
unset), so no DB or Redis is needed:

```bash
cd microservices
npx vitest run --project shared catalog orders engagement   # from a workspace root, or:
npm test --workspace services/catalog                        # per service
npm run typecheck --workspace services/catalog               # tsc --noEmit per service
```

## Migration order (recommended)

1. **catalog** — pure reads, mirrors `/api/r/:slug/menu`; safest first cut. ✅
2. **notifications** — delivery owner; consumers already wired. ✅
3. **orders** — core flow with the Redis SSE feed and `order.*` events. ✅
4. **billing** — Stripe webhook (single source of truth for events). ✅
5. **engagement**, then **auth** — auth last, since every service depends on its tokens. (engagement ✅)

For each: implement the route in the service (porting from the monolith file
named in `src/server.ts`), point the gateway prefix at it, verify, then delete
the monolith route. `@qlisted/shared` `verifyHs256` accepts the monolith's
tokens once `AUTH_SECRET === JWT_SECRET`.
