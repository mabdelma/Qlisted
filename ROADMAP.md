# Qlisted Roadmap

> Last verified: **2026-10-10** against commit `34fb3d7`, live in production.
>
> The previous version of this file was dated 2026-06-17 and listed as "not
> built" nine things that were already shipping — modifiers UI, reservations,
> waitlist, analytics, loyalty, promotions, the kitchen display and push
> notifications. Planning against it would have funded roughly eight weeks of
> work that was already in production. Every status below was measured, not
> remembered. If you are about to plan from this file, re-measure first.
>
> The companion document `docs/MISSING-PHASES.md` holds the gap register with
> metrics and the execution order. **That is the planning document.** This file
> is the state-of-the-world summary.

---

## Current state (measured)

| Area | Metric | Value |
|---|---|---|
| Interface locales | at exact key parity | **11** |
| Translation keys | `en.ts`, source of `TranslationKey` | 1,137 |
| Schema | tables | 45 |
| API | server route modules | 42 |
| Microservices | gateway + 6 services, all bundle and load | 7 |
| Tests | unit/integration files | 51 |
| Tests | E2E specs (Playwright) | 13 |
| CI | green jobs | 7 |
| Security | prod CVEs — frontend / server / microservices | 0 / 0 / 22 moderate |
| Backups | DB + uploads, nightly, integrity-checked | 2 jobs |
| Backups | restore drill, quarterly, row-count verified | passing |

### Platform

React 19 SPA (Vite, Tailwind v4, react-router v7) · Hono + Drizzle + Postgres 16
· Redis · Docker Compose on a shared VPS behind one Caddy · Expo/React Native
mobile app · OpenAI Realtime (WebRTC) for the voice portal.

**Two backends run at once.** The `microservices/` stack is production for the
revenue path — Caddy routes orders, order-status, payment intents, the Stripe
webhook, auth and the public menu to `qlisted-gateway`. Everything else falls
through to the monolith (`server/`). Treat both as live.

---

## Shipped and verified in production

Verified end-to-end on real production traffic, not merely present in the code:

| Capability | Evidence |
|---|---|
| Multi-tenant QR ordering (`/api/r/:slug`) | order via gateway → `201` |
| QR scan → menu | `302` → `/r/:slug/table/:token/menu` |
| Guest card payment | real `pi_…` client secret from Stripe |
| Guest cash payment | public cash-request endpoint reachable |
| Image upload + serve | 2 MB upload, fetched back over HTTPS |
| Signup / login / refresh | client signup `201`, login OK |
| Live order updates (SSE) | `streamSSE`; previously 500'd on every request |
| **Language Bridge** | order + item notes translated on the write path, original preserved |
| Menu, categories, modifiers, tax | `modifier_groups` / `modifier_options` / `tax_categories` |
| Tables with unique editable names | next-free-number allocation |
| Hotel: rooms, bookings, folios, check-in/out | `rooms`, `room_bookings`, `folio_items` |
| Staff: waiter, kitchen display, cashier, scheduling | `shifts`, `time_entries` |
| Receipts, invoices, exports, reports | `ReceiptsPage`, `routes/invoices.ts` |
| Loyalty, promos, gift cards | 6 tables |
| Reservations, waitlist | `reservations`, `waitlist_entries` |
| Inventory, suppliers, procurement | `stock_items`, `purchase_orders` |
| Super admin on `central.qlisted.com` | cross-tenant, assignable super admins |
| Push (web VAPID + Expo) | `push_subscriptions`, `expo_push_tokens` |
| Nightly backups + quarterly restore drill | see §Current state |

---

## Phase A — Close the operational gaps (now)

Hours, not weeks, and all of it is risk reduction rather than features. Detail
and metrics in `docs/MISSING-PHASES.md`.

| Item | Status |
|---|---|
| Patch the `nodemailer` High CVE in the notifications service | **done 2026-10-10** |
| Back up uploads (menu/room images had no backup at all) | **done 2026-10-10** |
| Prove a restore works — row-count drill vs prod | **done 2026-10-10, passing** |
| Disk + backup health check that can actually fail | **done 2026-10-10** |
| Off-site backup replication | **blocked** — needs a B2/R2 bucket |
| Encrypt backups at rest | **blocked** — needs a key-custody decision |
| `VPS_SSH_KEY` + `VITE_STRIPE_KEY` Actions secrets | **blocked** — until set, deploys are manual |
| OpenAI billing | **blocked** — the Language Bridge cannot translate without credits |
| Uptime monitoring + log aggregation | not started; configs written, never deployed |

## Phase B — Product depth

| Item | Notes |
|---|---|
| Extend translation past order notes | Needs a guest-notes field on room-service orders first |
| Native review of 10 non-English locales | Key parity is proven; copy *quality* is not |
| Ship the mobile app to the stores | Code exists (deep links, offline sync, push); never submitted |
| Finish self-serve onboarding end-to-end | The `toSlug` fix removed the worst failure mode |
| WhatsApp routing · GMT Token pricing | Carried over, never started |

## Phase C — Scale (deliberately not scheduled)

PgBouncer, Redis Sentinel, a CDN for `/uploads/`, multi-instance API, managed
Postgres, Cloudflare in front, Kubernetes.

Configs for several of these are already written in `infra/` and were never
deployed. **That is the correct state.** Each one solves a problem this
deployment does not have yet — the uploads volume is 2.4 MB, there is one API
container, and the host already runs 174 containers at 78% disk. Adding
machinery there adds failure modes, not capacity. Revisit when a measured
limit is actually hit, not on a calendar.

---

## Conventions

`AGENTS.md` for development conventions · `DEPLOYMENT.md` for infrastructure ·
`docs/MISSING-PHASES.md` for the gap register and what to do next.
