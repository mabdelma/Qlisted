# PROJECT_MAP.md — QCart → Hospitality QR Platform

> System date: 2026-06 | Target: Functional equivalent of qlub.io category platform

---

## [TECH_STACK]

### Current Stack (detected)

| Layer | Package | Version | Status |
|-------|---------|---------|--------|
| Framework | React | 18.3.1 | Active |
| Bundler | Vite | 5.4.2 | Active |
| Styling | Tailwind CSS | 3.4.1 (JS config) | Active |
| Routing | react-router-dom | 6.22.3 | Active |
| Icons | lucide-react | 0.344.0 | Active |
| DB | idb (IndexedDB) | 8.0.0 | Active |
| Language | TypeScript | 5.5.3 | Active |
| Linting | ESLint | 9.9.1 | Active |
| Backend | **None** | — | **Missing** |
| Payments | **None** | — | **Missing** |

### Proposed Stable Stack (as of June 2026)

| Layer | Package | Version | Reason |
|-------|---------|---------|--------|
| Framework | React | ^19.2.0 | Latest stable, improved perf, Actions, Server Components |
| Bundler | Vite | ^8.0.0 | Rolldown-powered, faster builds, Environment API |
| Styling | Tailwind CSS | ^4.3.0 | CSS-first config, Oxide engine, 5-10x faster |
| Routing | react-router | ^7.15.0 | Framework-agnostic, loader/action patterns |
| Icons | lucide-react | latest | Already used, no change needed |
| Backend | Hono | ^4.x | Lightweight, Edge-ready, RPC, TypeScript-native |
| Database ORM | Drizzle ORM | ^0.40+ | Type-safe, SQL-like, no magic |
| Database | PostgreSQL 16+ | via Supabase | Production-grade, row-level security |
| Auth | Better-Auth / Lucia | latest | Type-safe, session-based |
| Payments | Stripe SDK | latest | Industry standard |
| Real-time | WebSocket (Hono WS) | built-in | Order updates, kitchen display |
| Validation | Zod | ^3.24+ | Schema validation, shared types |
| Logging | pino | ^9.x | Structured, low-overhead, async |
| Testing | Vitest | ^3.x | Vite-native, fast |
| Hosting | Cloudflare Workers / Node | — | Edge-first or Node deployment |

### Required Dependency Changes
- **REMOVE**: `idb` (IndexedDB) — replaced by PostgreSQL + Drizzle
- **REMOVE**: `postcss.config.js`, `tailwind.config.js` (v3) — Tailwind v4 is CSS-first
- **ADD**: Hono, Drizzle ORM, pg, Zod, Stripe SDK, pino, Better-Auth, Vitest
- **UPGRADE**: React 18→19, Vite 5→8, Tailwind 3→4, react-router-dom 6→7

---

## [SYSTEM_FLOW]

### Verifiable Product Flows

```
FLOW 1: Public Marketing Website
  [Visitor] → Landing Page → Features → Pricing → Blog → Contact
  Success: Visitor can learn about the platform and request a demo.

FLOW 2: Restaurant Demo Request / Onboarding
  [Restaurant Owner] → Request Demo form → Email verification →
    → Admin provisions tenant → Onboarding wizard (menu upload, table config, staff invite)
  Success: Restaurant activates account with menu, tables, staff.

FLOW 3: Customer QR → Table → Menu Flow
  [Customer] → Scan QR (or visit /r/:restaurantSlug/table/:tableId) →
    → Table landing → Browse menu by category → Item detail
  Success: Customer browses full menu and adds items to cart.

FLOW 4: Cart / Order Flow
  [Customer] → Cart review → Add notes → Submit order → Order confirmation
  Success: Order enters `pending` status, visible to kitchen staff.

FLOW 5: Bill / Tip / Split / Payment Flow
  [Customer] → Request bill → View itemized bill → Add tip →
    → Split evenly or by item → Pay via Stripe (card/wallet) →
    → Payment confirmation → Receipt
  Success: Payment processed, order marked paid, receipt generated.

FLOW 6: Payment Link Flow
  [Customer or Staff] → Generate payment link → Share via SMS/Email/WhatsApp →
    → Recipient opens link → Pays without app → Confirmation
  Success: Payment completed via shareable link without QR scan.

FLOW 7: Merchant Dashboard Flow
  [Restaurant Admin] → Login → Dashboard (revenue, orders, tables, staff) →
    → Menu management → Table management → Staff management →
    → Analytics (sales trends, popular items, peak hours)
  Success: Admin manages full restaurant operations from dashboard.

FLOW 8: Staff Operations Flow
  [Waiter/Kitchen/Cashier] → Login → Role-specific interface:
    Waiter: table assignment, order taking, order delivery
    Kitchen: order queue, prep status, done marking
    Cashier: POS, payment reconciliation, cash management
  Success: Each role completes their operational tasks.

FLOW 9: Admin / Super-Admin Flow
  [Platform Admin] → Super admin panel → Tenant management →
    → Platform analytics → Revenue share → All restaurants view
  Success: Platform owner oversees all tenants.
```

### Route-Level Journey Map (Frontend)

```
/                                   → Marketing landing
/pricing                            → Pricing page
/demo                               → Demo request form
/auth/login                         → Login (all roles)
/auth/register                      → Staff/admin registration
/onboarding/:token                  → Tenant setup wizard

/r/:restaurantSlug                  → Restaurant public website
/r/:restaurantSlug/menu             → Public menu view
/r/:restaurantSlug/table/:tableId   → Table QR landing
/r/:restaurantSlug/table/:tableId/menu    → Table menu
/r/:restaurantSlug/table/:tableId/cart    → Table cart
/r/:restaurantSlug/table/:tableId/checkout → Table checkout
/r/:restaurantSlug/table/:tableId/bill    → Bill & payment
/r/:restaurantSlug/book             → Hotel public booking flow (hotel venues only)
/r/:restaurantSlug/room/:token      → In-room room service (hotel venues only)
/pay/:paymentLinkId                 → Payment link page

/dashboard                          → Merchant dashboard
/dashboard/analytics                → Sales & analytics
/dashboard/orders                   → Order management
/dashboard/menu                     → Menu editor
/dashboard/tables                   → Table layout
/dashboard/staff                    → Staff management
/dashboard/staff/waiter             → Waiter panel
/dashboard/staff/kitchen            → Kitchen display (KDS)
/dashboard/staff/cashier            → Cashier POS
/dashboard/payments                 → Payment history
/dashboard/settings                 → Restaurant settings

/admin                              → Super admin panel
/admin/tenants                      → Tenant management
/admin/platform-analytics           → Platform-wide analytics
```

### User Roles & Permissions

| Role | Scope | Permissions |
|------|-------|-------------|
| `super_admin` | Platform | CRUD tenants, platform analytics, global settings |
| `admin` | Own restaurant | Full restaurant CRUD, staff mgmt, menu, analytics |
| `manager` | Own restaurant | Orders, staff oversight, reports (no billing) |
| `waiter` | Own restaurant | Table mgmt, order taking, delivery marking |
| `kitchen` | Own restaurant | View order queue, update prep status |
| `cashier` | Own restaurant | POS, payment reconciliation, refunds |
| `customer` | Public | Browse menu, order, pay (no auth required) |

---

## [ARCHITECTURE]

### Frontend Structure (Domain-Driven)

```
src/
├── app/                    # App shell, providers, routing
│   ├── main.tsx
│   ├── App.tsx
│   └── providers.tsx
├── features/               # Domain features (NOT flat components/)
│   ├── marketing/          # Landing, pricing, demo request
│   ├── auth/               # Login, register, session
│   ├── onboarding/         # Tenant setup wizard
│   ├── menu/               # Menu browsing, categories, item detail
│   ├── cart/               # Cart context, panel, persistence
│   ├── ordering/           # Submit order, order status
│   ├── payment/            # Bill, tip, split, Stripe integration
│   ├── payment-links/      # Payment link generation & landing
│   ├── table/              # QR landing, table context
│   ├── dashboard/          # Merchant dashboard
│   │   ├── analytics/
│   │   ├── orders/
│   │   ├── menu-editor/
│   │   ├── tables/
│   │   ├── staff/
│   │   └── settings/
│   ├── staff/              # Waiter, kitchen, cashier panels
|   ├──staff/              # Waiter, kitchen, cashier panels
|   ├──admin/              # Super admin panel
|   └──restaurant/         # Shared venue pages
|       ├──BookRoomPage.tsx       # /r/:slug/book (hotel)
|       └──RoomServicePage.tsx    # /r/:slug/room/:token (hotel)
├── shared/                 # Shared logic (only if used 2+ times)
│   ├── ui/                 # Button, Input, Modal, etc.
│   ├── lib/                # API client, format utils
│   └── types/              # Shared TypeScript types
└── styles/                 # Global styles (Tailwind v4 @import)
```

### Backend/API Structure

```
api/
├── src/
│   ├── index.ts            # Entry point (Hono server)
│   ├── config/             # Env, DB, Stripe, Auth configs
│   ├── db/                 # Drizzle schema, migrations, seed
│   │   ├── schema/         # PostgreSQL table definitions
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── middleware/          # Auth, tenant resolution, logging, rate-limit
│   ├── routes/             # Route handlers (feature-aligned)
│   │   ├── marketing/      # GET /api/pages, POST /api/demo
│   │   ├── auth/           # POST /api/auth/login, /register
│   │   ├── tenants/        # CRUD /api/tenants
│   │   ├── menu/           # CRUD /api/r/:slug/menu
│   │   ├── tables/         # CRUD /api/r/:slug/tables
│   │   ├── orders/         # CRUD /api/r/:slug/orders, SSE/WS
│   │   ├── payments/       # POST /api/r/:slug/payments (Stripe)
│   │   ├── payment-links/  # CRUD /api/r/:slug/payment-links
│   │   ├── staff/          # Role-specific endpoints
|│   ├──admin/          # Super admin endpoints
|│   └──hotel/          # /api/r/:slug/rooms|bookings|folio (requireVenue('hotel','both'))
│   ├── services/           # Business logic (order, payment, notification)
│   ├── utils/              # Logger, helpers, validators
│   └── types/              # Shared types
├── drizzle.config.ts
├── package.json
└── tsconfig.json
```

### Data Model Overview

```sql
-- Tenants (multi-tenant core)
tenants: id, name, slug, email, phone, address, currency, timezone, is_active, created_at, updated_at

-- Restaurant settings per tenant
restaurant_settings: id, tenant_id, logo_url, cover_image, primary_color, tax_rate, service_charge, ...

-- Users
users: id, tenant_id, role (super_admin|admin|manager|waiter|kitchen|cashier), name, email, phone, password_hash, avatar, is_active, created_at

-- Menu
menu_categories: id, tenant_id, name, type (main|sub), parent_id, sort_order
menu_items: id, tenant_id, category_id, sub_category_id, name, description, price, image_url, available, sort_order, modifiers (JSON)

-- Tables
tables: id, tenant_id, number, capacity, status (available|occupied|reserved|closed), qr_token (unique), x_pos, y_pos

-- Orders
orders: id, tenant_id, table_id, customer_name, server_id, status (pending|preparing|ready|delivered|cancelled), item_count, subtotal, tax, service_charge, total, payment_status, notes, created_at, updated_at, completed_at

order_items: id, order_id, menu_item_id, quantity, unit_price, modifiers (JSON), notes

-- Payments
payments: id, tenant_id, order_id, amount, tip, method (card|wallet|cash|crypto), status, stripe_payment_intent_id, split_with (JSON), receipt_url, created_at

-- Payment Links
payment_links: id, tenant_id, amount, description, status (active|paid|expired|cancelled), token (unique), stripe_link_id, paid_at, created_at

-- Sessions (auth)
sessions: id, user_id, tenant_id, expires_at, created_at
```

### Hotel Vertical

`tenants.venueType` (`restaurant|hotel|both`) decides which surfaces a tenant gets. `requireVenue(...allowed)`
in `server/src/middleware/tenant.ts` gates every hotel route with `requireVenue('hotel','both')`, so a
restaurant-only tenant gets 403 even holding a valid token; `super_admin` bypasses it. Restaurant routes
stay open to all venue types.

```
server/src/routes/hotel.ts           # rooms, bookings, folio, hotel-report, public book, room service
server/src/services/hotelService.ts  # overlap checks, check-in/out, folio posting, room-service re-pricing
server/src/middleware/tenant.ts      # requireVenue
src/features/admin/RoomsPage.tsx          # front desk / housekeeping
src/features/restaurant/BookRoomPage.tsx    # guest booking
src/features/restaurant/RoomServicePage.tsx # in-room ordering
```

Data model additions:

```sql
-- menu_items gains room_service_available (default true): what a room may order.
-- Distinct from `available`, which means the item is in stock at all.
menu_items: ..., available, room_service_available

rooms: id, tenant_id, number, type, floor, status, rate, notes,
       service_token (unguessable, backs the in-room link, rotated at check-out),
       guest_name, housekeeper_id -> users.id (FK, tenant-validated)

room_bookings: id, tenant_id, room_id, guest_name/email/phone, check_in, check_out,
               status (booked|checked_in|checked_out|cancelled), nightly rate snapshot, ...

-- Room-service orders link back to the stay that incurred them.
orders: ..., booking_id -> room_bookings.id (nullable)

folio_items: id, booking_id, description, amount, created_at  -- one row per charge,
               so room-service orders post itemised lines, not a single summary line
```

Two occupancy numbers exist and must not be conflated:

| Metric | Meaning |
|--------|---------|
| `roomStats.occupancy` | Live: rooms currently `occupied` / total rooms |
| `hotelReport.occupancyPct` | Period: sold nights / available room-nights, with ADR and RevPAR |

Security properties worth preserving when extending this:

- `GET /room/:token/menu` filters on `available AND room_service_available`, so restaurant-only
  dishes are never offered to a room.
- `POST /room/:token/order` re-prices every line from the live menu and drops unavailable items
  rather than trusting client-posted prices, links `orders.booking_id`, and posts one folio line
  per item.
- Public availability returns only `id/number/type/rate` -- never `service_token`.
- `PUT /rooms/:id` rejects a `housekeeperId` from another tenant; the FK backs that up.

Demo data: `seed.ts` provisions a `demo-hotel` tenant with 5 rooms, a checked-in guest, upcoming
reservations, a folio, and a menu mixing room-service and restaurant-only items. `SEED_QR_TOKEN` /
`SEED_ROOM_TOKEN` pin the tokens for deterministic E2E.
### Integration Boundaries

| Integration | Type | Purpose |
|-------------|------|---------|
| Stripe | Server-side SDK | Payment intents, payment links, refunds, webhooks |
| SMTP (Resend/SendGrid) | Server-side | Demo notification, invoices, receipts |
| SMS (Twilio) | Optional | Payment links via SMS |
| Storage (S3/R2) | Server-side | Menu images, logos |
| QR generation (qrcode npm) | Server-side | Table QR PNG generation |

### Payment Architecture

```
[Customer] → Checkout → POST /api/r/:slug/payments/create-intent
  → Server creates Stripe PaymentIntent → Returns client_secret
  → Frontend uses Stripe Elements/Checkout → Confirms payment
  → Stripe webhook → POST /api/webhooks/stripe
  → Server updates order.payment_status = 'paid'
  → Server sends receipt email/SMS
  → Real-time push to kitchen/waiter (if order was pending payment)

Payment Link Flow:
[Staff] → Dashboard → Generate payment link → POST /api/payment-links
  → Server creates Stripe Payment Link → Returns URL
  → Share URL → Customer opens → Stripe Checkout → Webhook → Paid
```

### Logging & Error-Handling Approach

**Logger (`pino`)**:
```typescript
// pino logger with redaction
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: ['req.headers.authorization', 'req.body.card', '*.password', '*.stripeKey'],
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty' }
    : undefined,
});
```

**Levels**: `debug`, `info`, `warn`, `error`

**Rules**:
- Never log: secrets, tokens, payment card data, personal user data, password hashes.
- Always log: request IDs, tenant IDs (not names), operation timing, error codes.
- Non-blocking: pino writes asynchronously, no `await` on log calls.
- Structured JSON: all logs are machine-parseable.

**Error handling**:
- Centralized error middleware (Hono `onError`)
- Structured `ApiError` class with code, status, message, details
- All unexpected errors return 500 + correlation ID (no stack in production)

---

## [ORPHANS & PENDING]

### Broken Files
- `src/lib/db/schema.ts` imports `SmartWaiterDB` type in `seed.ts` (line 2) — type alias does not exist (`QCartDB` is correct)
- No TypeScript compilation check has been run recently; likely type issues in scattered files

### Dead Code
- `src/lib/db/` — Entire IndexedDB layer will be replaced by API client
- `src/lib/utils/adminCheck.ts` — Used only for initial setup flag, will be superseded
- `src/lib/utils/imageUpload.ts` — Uses placeholder logic, no real upload
- `src/lib/utils/qrcode.ts` — Relies on external API, will be replaced by server-side QR generation
- `src/lib/utils/exportReports.ts` — Client-side CSV only, needs server-side reporting
- `src/hooks/useCurrentUser.ts` — simplistic, will be replaced by auth context from server

### Incomplete Features
- **Payment**: Schema exists, UI skeleton exists, NO actual payment processing
- **Auth**: localStorage mock, NO password hashing, NO session management, NO multi-tenant
- **Analytics**: Client-side only, computed from IndexedDB, not scalable past single restaurant
- **Notifications**: Polling every 30s, no WebSocket/SSE
- **Multi-tenancy**: None — single hardcoded restaurant
- **Marketing site**: `RestaurantWebsite.tsx` is a plain menu page, not a marketing site
- **Onboarding**: No restaurant owner setup wizard
- **Payment links**: Not implemented at all
- **Localization**: None — English only, no i18n
- **Mobile responsive**: Partial, not production-grade
- **Error boundaries**: Not implemented

### Type Mismatches
- `seed.ts:2` imports `SmartWaiterDB` but type is `QCartDB`
- `CartContext.tsx:` CartItem stores full MenuItem object, should store only menuItemId + snapshot
- `Order.status` includes `'paid'` in `Analytics.tsx:102` filter but not in schema type `Order.status`
- `Payment.method` doesn't include `'cash'` in schema but `Analytics.tsx:96` uses it

### Missing Integrations
- Stripe SDK not installed
- No API server at all
- No database connection
- No email/SMS provider
- No file storage for images
- No real-time communication (WebSocket/SSE)

### Unverified Assumptions
- Assumes single-user single-restaurant deployment (no multi-tenancy)
- Assumes IndexedDB is sufficient for production (it is not — data loss risk, no server sync)
- Assumes localStorage is safe for auth state (XSS vulnerable, no real security)
- Assumes QR codes from external API are always available
- Assumes all images from Unsplash URLs will load reliably
