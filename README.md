# QCart — QR Ordering Platform for Hospitality

Digital ordering and payment platform for restaurants. Customers scan a QR code, browse the menu, place orders, and pay from their phone — no app download required.

Live at: [qlisted.com](https://qlisted.com)

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                     Caddy                            │
│              (shared reverse proxy)                  │
│   qlisted.com → qcart-frontend:80             │
└──────────────┬──────────────────────────────────────┘
               │
┌──────────────┴──────────────────────────────────────┐
│          qcart-frontend (nginx)                      │
│   /api/* → qcart-api:3001                            │
│   /uploads/* → qcart-api:3001                        │
│   /* → index.html (SPA)                              │
└──────────────┬──────────────────────────────────────┘
               │
┌──────────────┴──────────────────────────────────────┐
│         api (Hono on Node 24)                        │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│   │ Routes   │→│Services  │→│PostgreSQL│            │
│   │(Hono)    │ │(Biz Logic)│ │(Drizzle) │            │
│   └──────────┘ └──────────┘ └──────────┘            │
│   ┌──────────┐ ┌──────────┐                          │
│   │Stripe    │ │Resend    │                          │
│   │Payments  │ │Emails    │                          │
│   └──────────┘ └──────────┘                          │
└──────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, Vite 8, Tailwind CSS v4, react-router v7 |
| **Backend** | Hono (lightweight HTTP framework), TypeScript |
| **Database** | PostgreSQL 16 via Drizzle ORM |
| **Auth** | JWT with bcryptjs password hashing |
| **Payments** | Stripe Elements + Payment Links |
| **Email** | Resend (optional, graceful fallback) |
| **Real-time** | Server-Sent Events (SSE) with 30s polling fallback |
| **Rate Limiting** | hono-rate-limiter (3 tiers) |
| **Error Monitoring** | Sentry (optional) |
| **Logging** | Pino |
| **Validation** | Zod |
| **Testing** | Vitest (server + frontend) |
| **CI** | GitHub Actions (lint → typecheck → test → build) |

## Project Structure

```
qcart/
├── src/                          # Frontend (React SPA)
│   ├── api/                      # API client & endpoint definitions
│   ├── components/               # Shared UI components
│   │   ├── admin/                # Admin portal views
│   │   ├── auth/                 # Sign-in/sign-up components
│   │   ├── layout/               # Headers, footers, navigation
│   │   └── staff/                # Staff portal views
│   ├── contexts/                 # React contexts (auth, notifications)
│   ├── features/                 # Page-level features
│   │   ├── admin/                # Admin sub-pages (settings, etc.)
│   │   ├── marketing/            # Marketing site pages
│   │   ├── menu/                 # Customer menu page
│   │   ├── onboarding/           # Tenant setup wizard
│   │   └── restaurant/           # Restaurant landing page
│   ├── hooks/                    # Custom hooks (useSSE, etc.)
│   ├── lib/                      # Utilities
│   └── App.tsx                   # Route definitions
├── server/                       # Backend (Hono API)
│   └── src/
│       ├── db/                   # Drizzle schema, connection, seed
│       │   ├── index.ts          # DB connection (drizzle + pg)
│       │   ├── schema.ts         # All table definitions
│       │   └── seed.ts           # Demo data seeder
│       ├── lib/                  # Shared utilities
│       │   ├── auth.ts           # JWT helpers
│       │   ├── events.ts         # SSE event emitter
│       │   ├── logger.ts         # Pino logger
│       │   ├── mail.ts           # Resend email wrapper
│       │   └── sentry.ts         # Sentry init
│       ├── middleware/           # Hono middleware
│       │   ├── auth.ts           # JWT auth & role guard
│       │   └── rateLimiter.ts    # 3-tier rate limiter
│       ├── routes/               # Route handlers
│       │   ├── admin.ts          # Admin aggregation endpoint
│       │   ├── auth.ts           # Register/login
│       │   ├── demo.ts           # Demo request form
│       │   ├── events.ts         # SSE endpoint
│       │   ├── menu.ts           # Menu CRUD
│       │   ├── orders.ts         # Order CRUD
│       │   ├── payments.ts       # Payment processing + webhooks
│       │   ├── tables.ts         # Table management
│       │   ├── tenants.ts        # Tenant (restaurant) CRUD
│       │   ├── uploads.ts        # Image uploads
│       │   └── users.ts          # Staff user CRUD
│       ├── services/             # Business logic layer
│       │   ├── authService.ts    # Auth operations
│       │   ├── demoService.ts    # Demo request handling
│       │   ├── orderService.ts   # Order operations
│       │   ├── paymentService.ts # Payment processing
│       │   └── tenantService.ts  # Tenant operations
│       └── test/
│           ├── setup.ts          # Vitest global mocks (DB, logger, mail)
│           └── api.test.ts       # API health check test
├── docker-compose.yml            # Base compose (dev)
├── docker-compose.vps.yml        # Production overlay
├── frontend.Dockerfile           # Frontend build (nginx)
└── server/Dockerfile             # API build (node)
```

## Quick Start (Development)

### Prerequisites

- Node.js 24+
- Docker (for PostgreSQL)

### 1. Start PostgreSQL

```bash
docker compose up postgres -d
```

### 2. Server Setup

```bash
cd server
cp .env.example .env          # edit secrets if needed
npm install
npx drizzle-kit push           # create tables
npx tsx src/db/seed.ts         # seed demo data
npm run dev                    # starts on :3001
```

### 3. Frontend Setup

```bash
# from project root
npm install
npm run dev                    # starts on :5173, proxies /api → :3001
```

Open http://localhost:5173. You should see the marketing landing page.

### Demo Credentials

After seeding:
- **Admin login**: owner@demo.com / pass123
- **Restaurant slug**: demo-cafe
- **Customer menu**: http://localhost:5173/r/demo-cafe (or scan the QR from the admin Tables tab)
- **Hotel slug**: demo-hotel (admin owner@demo.com / pass123), guest booking at http://localhost:5173/r/demo-hotel/book

Seed tokens are random per run. Pin them for deterministic E2E with `SEED_QR_TOKEN` and
`SEED_ROOM_TOKEN`; the in-room room-service link is `<tenantSlug>/room/<SEED_ROOM_TOKEN>`.

## Running Tests

```bash
# All tests (from project root)
npm run test:all

# Server only
cd server && npm test

# Frontend only
npm test
```

## CI Pipeline

GitHub Actions runs on push/PR to `main` in parallel:
1. **Frontend**: lint → typecheck → test → build
2. **Server**: lint → typecheck → test → build

## Environment Variables

### Server (`server/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | 3001 | API server port |
| `DATABASE_URL` | Yes | postgresql://qcart:qcart@localhost:5434/qcart | PostgreSQL connection |
| `JWT_SECRET` | Yes | — | JWT signing secret |
| `CORS_ORIGIN` | No | http://localhost:5173 | Allowed CORS origin |
| `STRIPE_SECRET_KEY` | No | — | Stripe secret key (payments disabled if empty) |
| `STRIPE_WEBHOOK_SECRET` | No | — | Stripe webhook signing secret |
| `SENTRY_DSN` | No | — | Sentry DSN (error reporting disabled if empty) |
| `SENTRY_TRACES_SAMPLE_RATE` | No | 0.1 | Sentry sampling rate |
| `LOG_LEVEL` | No | info | Pino log level |
| `RESEND_API_KEY` | No | — | Resend API key (email disabled if empty) |
| `MAIL_FROM` | No | noreply@qcart.app | Sender address for emails |

### Frontend (build args)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_STRIPE_KEY` | No | — | Stripe publishable key (card payments fall back to mock if empty) |
| `VITE_API_URL` | No | /api | API base URL (relative for same-origin) |

> **Note:** `VITE_*` vars are inlined at build time. The Stripe publishable key is baked into the Docker image. Changing it requires a rebuild.

## Hotel Vertical

Tenants declare a `venueType` of `restaurant`, `hotel`, or `both`. Hotel endpoints are gated by
`requireVenue('hotel', 'both')` in `server/src/middleware/tenant.ts`, so a restaurant-only tenant
gets `403` even with a valid token; `super_admin` bypasses the check. Restaurant endpoints stay
available to every venue type.

Seeding also provisions a `demo-hotel` tenant (venueType `hotel`) with five rooms, an in-house
checked-in guest, upcoming reservations, a folio, and a menu that mixes room-service-only items
with restaurant-only ones.

| Surface | URL |
|---------|-----|
| Guest booking flow | http://localhost:5173/r/demo-hotel/book |
| Room service (in-room QR link) | http://localhost:5173/r/demo-hotel/room/<room's serviceToken> |
| Front desk / housekeeping | `/admin/rooms` |

How it fits together:

- **Rooms** — `roomServiceToken` is an unguessable per-room token that backs the in-room ordering
  link. It rotates on check-out, so a departed guest's link dies with their stay. `PUT /rooms/:id`
  validates that `housekeeperId` belongs to the same tenant, and a DB-level FK backs it up.
- **Reservations** — `POST /book` and the admin route both reject overlapping active bookings for a
  room, snapshot the nightly rate, and flip an available room to `reserved`. Check-in sets the room
  to `occupied`; check-out sets it to `cleaning`, clears the guest, and rotates the token.
- **Folios** — a folio holds the room charge plus itemised extras, a deposit, and an outstanding
  balance. Settle in cash, or issue a Stripe pay-link for the balance.
- **Room service** — `GET /room/:token/menu` returns only items that are both `available` and
  flagged `roomServiceAvailable`, so restaurant-only dishes are never offered to a room.
  `POST /room/:token/order` re-prices every line from the live menu instead of trusting posted
  prices, links the order to the booking (`orders.booking_id`), and posts one folio line per item.
  Use the `roomServiceAvailable` toggle in `/admin/menu` to control what a room can order.
- **Reporting** — two occupancy numbers exist and they mean different things:
  `roomStats.occupancy` is live (rooms currently `occupied` ÷ total rooms), while
  `hotelReport.occupancyPct` is sold nights ÷ available room-nights for a period, alongside ADR,
  RevPAR, arrivals, departures and room revenue.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/health` | — | Health check |
| `POST` | `/api/auth/register` | — | Register staff user |
| `POST` | `/api/auth/login` | — | Login (returns JWT) |
| `GET` | `/api/auth/me` | JWT | Current user info |
| `POST` | `/api/tenants` | — | Create restaurant (onboarding) |
| `GET` | `/api/tenants/:slug` | — | Get restaurant by slug |
| `PUT` | `/api/tenants/:slug/settings` | Admin | Update restaurant settings |
| `POST` | `/api/demo` | — | Submit demo request |
| `GET` | `/api/r/:slug/menu` | — | Get full menu (categories + items) |
| `GET` | `/api/r/:slug/tables` | Auth | List tables |
| `POST` | `/api/r/:slug/tables` | Auth | Create table |
| `GET` | `/api/r/:slug/tables/resolve` | — | Resolve table by QR token |
| `GET` | `/api/r/:slug/orders` | Auth | List orders |
| `POST` | `/api/r/:slug/orders` | — | Create order (customer) |
| `PATCH` | `/api/r/:slug/orders/:id/status` | Auth | Update order status |
| `POST` | `/api/r/:slug/payments` | — | Record cash payment |
| `POST` | `/api/r/:slug/payments/stripe` | — | Create Stripe payment intent |
| `POST` | `/api/r/:slug/payments/links` | Auth | Generate payment link |
| `GET` | `/api/r/:slug/events` | — | SSE stream (real-time events) |
| `GET` | `/api/admin/:slug/*` | Admin | Admin dashboard data |
| `POST` | `/api/upload` | Auth | Upload image |
| `GET/POST/PUT/DELETE` | `/api/users` | Auth | Staff user CRUD |

### Hotel

All of these require a `hotel` or `both` tenant. See `server/src/openapi.ts` for the full spec.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET/POST` | `/api/r/:slug/rooms` | JWT | List / create rooms |
| `PUT/DELETE` | `/api/r/:slug/rooms/:id` | JWT | Update / delete a room |
| `GET` | `/api/r/:slug/rooms/stats` | JWT | Live room-status counts + occupancy |
| `GET` | `/api/r/:slug/rooms/available` | JWT | Rooms free in a window |
| `POST` | `/api/r/:slug/rooms/:id/status` | JWT | Front-desk / housekeeping status change |
| `POST` | `/api/r/:slug/rooms/:id/regenerate-token` | JWT | Rotate the in-room service token |
| `GET` | `/api/r/:slug/hotel-report` | JWT | Occupancy %, ADR, RevPAR for a range |
| `GET/POST` | `/api/r/:slug/bookings` | JWT | List / create reservations |
| `POST` | `/api/r/:slug/bookings/:id/check-in` | JWT | Check a guest in |
| `POST` | `/api/r/:slug/bookings/:id/check-out` | JWT | Check out (rotates room token) |
| `POST` | `/api/r/:slug/bookings/:id/cancel` | JWT | Cancel a reservation |
| `GET/POST` | `/api/r/:slug/bookings/:id/folio` | JWT | Read folio / post a charge |
| `DELETE` | `/api/r/:slug/folio/:folioItemId` | JWT | Remove a folio charge |
| `POST` | `/api/r/:slug/bookings/:id/folio/pay-link` | JWT | Stripe link for the balance |
| `POST` | `/api/r/:slug/bookings/:id/folio/settle` | JWT | Mark settled (cash / manual) |
| `POST` | `/api/r/:slug/bookings/:id/folio/deposit` | JWT | Record a deposit |
| `GET` | `/api/r/:slug/book/availability` | — | Public room availability |
| `POST` | `/api/r/:slug/book` | — | Public reservation (+ optional deposit link) |
| `GET` | `/api/r/:slug/room/:token/stay` | — | Resolve the active stay |
| `GET` | `/api/r/:slug/room/:token/menu` | — | In-room menu (deliverable items only) |
| `POST` | `/api/r/:slug/room/:token/order` | — | Place a room-service order |

## Deployment

### Production topology

QCart is deployed on a single VPS sharing a Caddy reverse proxy with other apps. See `docker-compose.vps.yml` for the production overlay.

```bash
# One-time setup on VPS
docker network create edge

# Deploy
cp server/.env.prod.example .env.prod   # fill in real secrets
docker compose --env-file .env.prod \
  -f docker-compose.yml \
  -f docker-compose.vps.yml \
  up -d --build
```

The `qcart-frontend` nginx container joins a shared `edge` Docker network. Caddy (from a separate stack) proxies `qlisted.com` → `qcart-frontend:80`.

### Updating

```bash
git pull
docker compose --env-file .env.prod \
  -f docker-compose.yml \
  -f docker-compose.vps.yml \
  up -d --build
```

## Database

### Schema (auto-generated by Drizzle)

Tables: `tenants`, `users`, `sessions`, `menu_categories`, `menu_items`, `tables`, `orders`, `order_items`, `payments`, `payment_links`, `demo_requests`

```bash
# Push schema changes (development)
cd server && npx drizzle-kit push

# Generate migration files
cd server && npx drizzle-kit generate

# Drizzle Studio (GUI)
cd server && npx drizzle-kit studio
```

## Rate Limiting

| Tier | Limit | Applied to |
|------|-------|------------|
| Auth | 20 requests/min | `/api/auth/*` |
| Public | 60 requests/min | `/api/r/*`, `/api/demo`, `/api/health` |
| General | 100 requests/min | `/api/tenants/*`, `/api/admin/*` |

## Real-time Orders

Orders update in real time via Server-Sent Events:

1. Client opens `GET /api/r/:slug/events`
2. Server pushes `order_created`, `order_status_changed` events
3. A 30-second polling fallback ensures delivery if SSE drops

**Limitation:** Uses in-process `EventEmitter` — not backed by Redis. SSE events only reach clients connected to the same server instance. Not suitable for horizontal scaling without adding Redis pub/sub.

## License

MIT
