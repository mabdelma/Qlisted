# Phase 4 — Dead-code hygiene under `src/components/**`

**Scope:** `src/components/**` only. Nothing outside it was modified.
**Result:** 30 files / 3,654 lines removed. `src/components` went from 105 modules to 75.
**Status:** typecheck, lint, 142 unit tests and production build all green after the removals.

The working estimate going into this phase was "around eight" remaining orphans. The real
number was **30** — the earlier cleanup (commit `08cba78`) deleted five parent components but
left their entire private subtrees behind, and a second, larger cluster (the pre-`features/`
customer ordering flow) had never been looked at.

---

## Method

Grep alone is unreliable here: component names in this repo collide heavily with i18n keys,
API-endpoint names, server routes, lucide icons and route strings (`Menu`, `Orders`, `Cart`,
`Checkout`, `Header`, `Select`, `Switch`, `index`). Three separate techniques were combined:

1. **Full module-resolution import graph.** Every `.ts/.tsx/.js/.jsx/.mjs/.cjs/.json/.html`
   file in the repo (excluding `node_modules`, `dist`, `.git`, build output and the sibling
   git worktree under `.claude/worktrees/`) was parsed for every module specifier form used
   in this codebase: static `import … from`, `export … from`, bare `import 'x'`, dynamic
   `import('x')` (which is how every route in `src/App.tsx` is loaded), `require()`, and
   `vi.mock()` / `jest.mock()`. Specifiers were resolved the way the bundler does
   (extension probing, directory `index.*`, `.js`→`.ts` rewrite).
   **0 relative specifiers failed to resolve**, so the graph is complete for relative imports.
   `tsconfig.app.json` declares no `paths`, so there are no path aliases to miss.
2. **Transitive reachability** from real entry points — `index.html`, `src/main.tsx`, every
   `*.test.*`, everything under `e2e/`, `scripts/`, `server/`, `microservices/`, `platform/`,
   `mobile/` and the root config files. This is what catches *clusters*: a file whose only
   importer is itself dead.
3. **Symbol-level reference sweep** across every text file in the repo (including `.md`,
   `.yml`, `.json`, `.txt`) for each exported symbol, to catch non-import references. Every
   hit was then read in context to separate a real import from a word collision.

Route ownership was confirmed by reading `src/App.tsx` (read-only — Phase 3 owns that file)
and the two in-tree route hosts, `src/components/admin/AdminPortal.tsx` and
`src/components/staff/StaffPortal.tsx`.

Deletions were applied with plain `rm`, **not** `git rm`, to avoid staging anything in the
git index that two parallel agents share. All 30 deletions are unstaged working-tree changes.

---

## What was removed

### Cluster A — orphaned private subtrees of the five components deleted in `08cba78` (11 files)

Commit `08cba78` ("delete the dead admin duplicates") removed
`src/components/admin/{OrderManagement,TableManagement,MenuManagement,CategoryManagement,QRCodeModal}.tsx`
but not the child components those files privately owned. `git show 08cba78^:<file>` proves the
parent/child relationship directly.

| File | Evidence |
|---|---|
| `src/components/admin/order/OrderStats.tsx` | Sole importer was the deleted `admin/OrderManagement.tsx` (`git show 08cba78^:src/components/admin/OrderManagement.tsx` line 5). Zero importers now; symbol `OrderStats` has no reference anywhere in the repo. Live replacement: `src/features/admin/OrderManagement.tsx`, routed from `AdminPortal`. |
| `src/components/admin/order/OrderFilters.tsx` | Same parent (line 6). Zero importers; symbol unreferenced. |
| `src/components/admin/order/OrderList.tsx` | Same parent (line 7). Zero importers; symbol unreferenced. |
| `src/components/admin/table/TableEfficiencyStats.tsx` | Sole importer was the deleted `admin/TableManagement.tsx` (line 7). Zero importers; symbol unreferenced. Live replacement: `src/features/admin/TableManagement.tsx`. |
| `src/components/admin/table/TableFilters.tsx` | Same parent (line 8). Zero importers; symbol unreferenced. |
| `src/components/admin/table/TableList.tsx` | Same parent (line 9). Zero importers; symbol unreferenced. |
| `src/components/admin/charts/RevenueChart.tsx` | Sole importer was `admin/Analytics.tsx` until commit `b6ec701`, which converted `Analytics.tsx` into a tab shell rendering `<Outlet />` for `src/features/analytics/*`. `git log -S"OrdersTimeline"` shows `Analytics.tsx` as the only file that ever referenced it. Zero importers; symbol unreferenced. |
| `src/components/admin/charts/OrdersTimeline.tsx` | Same — orphaned by `b6ec701`. Zero importers; symbol unreferenced. |
| `src/components/admin/finance/FinancialInsights.tsx` | Same — `git log -S"FinancialInsights"` shows `admin/Analytics.tsx` as its only ever importer, removed in `b6ec701`. Zero importers; symbol unreferenced. Superseded by `src/features/analytics/{AnalyticsDashboard,SalesDashboard,ForecastInsights}.tsx`. |
| `src/components/admin/finance/PaymentsList.tsx` | Only importer was `admin/finance/FinancialInsights.tsx` (itself dead) — cluster boundary proven: no other module in the graph reaches either file. The `PaymentsList` hits in `src/components/staff/CashierPanel.tsx` are a **locally-declared** `const PaymentsList = () => (…)` on line 79 of that file, not an import. |
| `src/components/admin/finance/RevenueBreakdown.tsx` | Only importer was `admin/finance/FinancialInsights.tsx` (dead). No other reference in the repo. |

Four now-empty directories went with them: `admin/charts/`, `admin/finance/`, `admin/order/`,
`admin/table/`.

### Cluster B — the pre-`features/` customer ordering flow (11 files)

`src/App.tsx` routes the entire customer flow to `src/features/**`. The `src/components/restaurant/`
and `src/components/table/` trees are the superseded first implementation; nothing routes to them.

Routes as they actually exist in `src/App.tsx`:

| Route | Live component | Dead duplicate removed |
|---|---|---|
| `/r/:slug/table/:tableId` | `features/restaurant/TableFlowLayout` | `components/table/TableMenu` |
| `…/menu` | `features/restaurant/TableMenuPage` | `components/restaurant/Menu` |
| `…/menu/:itemId` | `features/restaurant/TableMenuItemDetail` | `components/restaurant/MenuItemDetail` |
| `…/cart` | `features/cart/CartPage` | `components/restaurant/Cart` |
| `…/orders` | `features/orders/OrdersPage` | `components/restaurant/Orders`, `components/table/TableOrders` |
| `…/checkout` | `features/checkout/CheckoutPage` | `components/restaurant/Checkout` |
| `/r/:slug` | `features/restaurant/RestaurantLanding` | `components/restaurant/RestaurantWebsite` |

| File | Evidence |
|---|---|
| `src/components/restaurant/RestaurantWebsite.tsx` | Zero importers — it is the cluster root. It declared its own `<Routes>` for `menu`/`cart`/`orders`/`checkout`, superseded by the `App.tsx` routes above. Only textual reference is a stale line in `PROJECT_MAP.md`. |
| `src/components/restaurant/RestaurantHeader.tsx` | Only importer `RestaurantWebsite.tsx` (dead). |
| `src/components/restaurant/Menu.tsx` | Only importer `RestaurantWebsite.tsx` (dead). The 29 files matching the symbol `Menu` are all collisions — i18n keys, `menuApi`, `server/src/routes/menu.ts`, `openapi.ts`, admin nav labels. |
| `src/components/restaurant/Cart.tsx` | Only importer `RestaurantWebsite.tsx` (dead). `Cart` hits in `ai/VoiceOrderWidget.tsx` and `features/menu/CustomerMenuPage.tsx` are *not* imports — verified by reading their import blocks; they are JSX text / `ShoppingCart`-style usage. |
| `src/components/restaurant/Orders.tsx` | Only importer `RestaurantWebsite.tsx` (dead). |
| `src/components/restaurant/Checkout.tsx` | Only importer `RestaurantWebsite.tsx` (dead). Server-side `Checkout` hits are Stripe Checkout sessions, unrelated. |
| `src/components/restaurant/CartPanel.tsx` | Only importers were `restaurant/RestaurantHeader.tsx` and `table/TableHeader.tsx` — both dead. Cluster boundary proven across both trees. |
| `src/components/restaurant/MenuItemDetail.tsx` | Zero importers; symbol `MenuItemDetail` has no reference anywhere. |
| `src/components/table/TableMenu.tsx` | Zero importers — cluster root for `table/`. Rendered `TableHeader` + `<Outlet/>`; replaced by `features/restaurant/TableFlowLayout.tsx`. |
| `src/components/table/TableHeader.tsx` | Only importer `table/TableMenu.tsx` (dead). |
| `src/components/table/TableOrders.tsx` | Zero importers; symbol `TableOrders` has no reference anywhere. |

Both directories (`restaurant/`, `table/`) were emptied and removed.

### Cluster C — standalone orphans (8 files)

| File | Evidence |
|---|---|
| `src/components/auth/SignUp.tsx` | Zero importers; symbol `SignUp` unreferenced. **There is no `/signup` route in `src/App.tsx` at all** — the only signup route is `/staff/signup`, which renders `components/auth/StaffSignUp.tsx` (still live). |
| `src/components/layout/Header.tsx` | Zero importers. Looked live because `Header` matches in five files, but every one of them imports `'../admin/Header'` — verified line by line in `AdminPortal.tsx:4`, `KitchenPortal.tsx:3`, `CashierPanel.tsx:8`, `WaiterPortal.tsx:3`. `src/components/admin/Header.tsx` is the live one. |
| `src/components/orders/OrderDetails.tsx` | Zero importers. Three `OrderDetails.tsx` files exist; the live ones are `kitchen/OrderDetails.tsx` (imported by `kitchen/OrdersDisplay.tsx:8` as `'./OrderDetails'`) and `shared/OrderDetails.tsx` (imported by `waiter/OrdersList.tsx:9` and `waiter/OrderHistory.tsx:8` as `'../shared/OrderDetails'`). Nothing imports `'../orders/OrderDetails'`. |
| `src/components/staff/PointOfSale.tsx` | Zero importers. `CashierPanel.tsx:10` and `WaiterPortal.tsx:7` both import `'../shared/PointOfSale'`. `shared/PointOfSale.tsx` is live; this 321-line sibling is not. |
| `src/components/kitchen/KitchenHeader.tsx` | Zero importers; symbol unreferenced. `KitchenPortal.tsx` builds its chrome from `ui/StaffSidebar` + `admin/Header` instead. |
| `src/components/staff/CashierHeader.tsx` | Zero importers; symbol unreferenced. Same reason — `CashierPanel.tsx` uses `ui/StaffSidebar` + `admin/Header`. |
| `src/components/waiter/WaiterHeader.tsx` | Zero importers; symbol unreferenced. Same reason — `WaiterPortal.tsx` uses `ui/StaffSidebar` + `admin/Header`. |
| `src/components/waiter/NewOrderForm.tsx` | Zero importers; symbol `NewOrderForm` has no reference anywhere. `WaiterPortal.tsx` renders `TableGrid` / `OrderHistory` / `OrdersList` / `shared/PointOfSale` only. |

No test file was removed. There are **no** test files under `src/components/**` at all, and
nothing under `e2e/` imports from `src/` — so the "a dead file whose only importer is its own
test" case did not arise.

---

## Looked dead, was live — the traps

| Thing | Why it looked dead | Why it is live |
|---|---|---|
| `src/components/layout/Header.tsx` vs `src/components/admin/Header.tsx` | A symbol grep for `Header` lights up five live portal files. | Those files import `'../admin/Header'`. Only the resolved import path distinguishes them — the symbol name is identical. This is exactly the trap that makes name-based dead-code hunting fail here. Resolved by reading each importer's import block. |
| `src/components/shared/OrderDetails.tsx`, `src/components/kitchen/OrderDetails.tsx` | Three same-named files; a grep makes all three look mutually referenced. | Both are really imported; only `orders/OrderDetails.tsx` is not. |
| `src/components/shared/PointOfSale.tsx` | Same-name collision with `staff/PointOfSale.tsx`. | `shared/` is the imported one. |
| The 11 locale files `src/lib/i18n/translations/{ar,de,es,fr,hi,it,ja,pt,ru,zh}.ts` | **Zero static importers** — they appear unreachable in any import graph. | `src/contexts/I18nContext.tsx:27` loads them with a **template-literal dynamic import**: `await import(\`../lib/i18n/translations/${locale}.ts\`)`. No static analyser can resolve this; Vite turns it into a glob at build time (the build output shows `ar-*.js`, `de-*.js`, … chunks). Deleting any of them would have silently broken 10 of 11 languages with a green typecheck. **Not touched.** |
| `stayApi` in `src/lib/api/endpoints.ts` | Zero consumers anywhere in the repo (confirmed: the only match is its own `export const stayApi = {` on line 458). | Phase 3 is building its UI right now. **Not flagged as dead, not touched.** |
| `src/components/ui/{index.ts,ConfirmDialog,Select,Sheet,Switch,ThemeToggle}.tsx` | `ui/index.ts` has zero importers, and those five are reachable only through it. Technically unreachable. | **Deliberately retained — see below.** |
| `src/vite-env.d.ts` | Zero importers. | Ambient type declaration; consumed by `tsconfig.app.json`'s `include`, never imported. |

### Why `src/components/ui/**` was left alone

`ui/index.ts` is the barrel for the shared UI library added in `1f7d18e`
("shared UI component library"). Nothing imports the barrel — every consumer imports the
primitives directly (`'../ui/Button'`, `'../ui/LoadingSpinner'`, …). So the barrel is
unreferenced, and five primitives are reachable only through it:

- `ConfirmDialog.tsx`, `Select.tsx`, `Switch.tsx` — their only real consumers were
  `admin/MenuManagement.tsx`, `admin/CategoryManagement.tsx` and `admin/OrderManagement.tsx`,
  all deleted in `08cba78`. They are collateral orphans of that commit, not abandoned code.
- `Sheet.tsx`, `ThemeToggle.tsx` — never had a consumer.

These were **not** deleted, for three reasons:

1. Removing a design system's public API surface is an architectural decision, not dead-code
   hygiene. The barrel re-exports 28 symbols, 23 of which back live components.
2. Phase 3 is writing `src/features/**` in this same tree right now. `Select`, `Switch` and
   `ConfirmDialog` are exactly the generic form primitives a new admin screen reaches for;
   deleting them mid-flight would break another agent's work for no benefit.
3. `ThemeToggle` pairs with the live `src/contexts/ThemeContext.tsx` that `App.tsx` already
   mounts, and the Tailwind `dark:` variants are present throughout `admin/Analytics.tsx` and
   elsewhere — it reads as an unfinished feature, not an abandoned one.

Recommendation for the plan owner: decide whether `ui/index.ts` should become the enforced
import path (in which case all of it is live and the direct imports should migrate to it), or
be deleted along with `Sheet.tsx` and `ThemeToggle.tsx`. Either is a one-line call once
Phase 3 lands; it should not be made opportunistically during a deletion pass.

---

## Verification

Baseline before any deletion, and again after all 30 removals — identical, all green:

```
npx tsc --noEmit -p tsconfig.app.json   # exit 0, no output (224 files)
npm run lint                            # exit 0, no output
npm test -- --run                       # 14 files, 142 tests passed
npm run build                           # exit 0, built in 3.42s, PWA precache 88 entries
```

Note: `npx tsc --noEmit -p tsconfig.json` is **worthless as a check here** — the root config is
solution-style (`"files": []` + `references`) and `-p` does not follow project references, so it
type-checks zero files and passes no matter what you delete. `tsconfig.app.json` is the only
config that actually sees `src/`.

The full e2e suite was not run — Docker/Postgres are unavailable in this environment. The risk
is negligible: nothing under `e2e/` imports from `src/`, and every removed component was
unreachable from `src/main.tsx`, so no rendered route changed. The `AdminPortal` and
`StaffPortal` build chunks still emit (230.89 kB and 78.49 kB).

---

## Out of scope — dead code for a later pass

Found while mapping the graph; **not acted on**, as all of it lies outside `src/components/**`.
Each is unreachable from `src/main.tsx` and has no reference anywhere in the repo.

| File | Note |
|---|---|
| `src/lib/utils/imageUpload.ts` | `uploadImage()` — its only consumer was the deleted `admin/MenuManagement.tsx`; `features/admin/MenuManagement.tsx` does not use it. Collateral orphan of `08cba78`. |
| `src/lib/utils/orderUtils.ts` | Zero references. |
| `src/lib/utils/qrcode.ts` | Zero references. `ui/QrCodeModal.tsx` calls the `qrcode` package directly instead. |
| `src/lib/utils/sanitize.ts` | `sanitizeText` / `sanitizeHtml` — zero references. `ui/QrCodeModal.tsx` calls `DOMPurify.sanitize` directly. Worth a look before deleting: these may be the *intended* wrappers and the direct `DOMPurify` call the mistake. |
| `src/lib/storage.ts` | Zero references. |
| `src/lib/offlineQueue.ts` | Zero references. Pairs with `src/hooks/useOnlineStatus.ts` below — likely an unfinished offline feature; confirm intent before deleting. |
| `src/hooks/useOnlineStatus.ts` | Zero references. |
| `src/features/loyalty/LoyaltyPoints.tsx` | Zero importers. **Phase 3 owns `src/features/**` — check with Phase 3 before removing;** `features/admin/LoyaltyManagement.tsx` is live and routed, so this may be an intended customer-facing counterpart. |

Also stale, documentation-only: `PROJECT_MAP.md` still describes
`src/components/restaurant/RestaurantWebsite.tsx` as the customer flow, and
`docs/PRODUCTION-VERIFICATION.md` references `OrderDetails`. Neither affects the build.
