# QListed — Missing Phases & Steps

> Measured 2026-10-10 against commit `34fb3d7` (live in production).
> Every number below was read from the repo, the prod database, or the VPS at
> that moment. Nothing here is carried over from an earlier doc — several
> earlier docs turned out to be wrong, and that is itself one of the findings.

---

## 0. Read this first: there are two different "phase" systems

The word *phase* has meant two unrelated things in this project, which is why
"what's missing" has been hard to answer.

| System | Where it lives | Numbering | Status |
|---|---|---|---|
| **Product/infra roadmap** | `ROADMAP.md` | Phase 1 → 5 | **Stale and materially wrong** (see §0.1) |
| **Hardening audit** | `docs/PHASE1-SCHEMA.md`, `docs/PHASE4-DEADCODE.md`, `docs/DEPLOY-HARDENING.md`, `docs/PRODUCTION-VERIFICATION.md` | Phase 0 → 4 | Largely complete; leftovers in §2 |

They are not the same track and should never be merged. This document treats
the audit phases as **done-with-leftovers** and the roadmap as **needing a
rewrite before it can be used to plan anything**.

### 0.1 `ROADMAP.md` cannot be trusted as a gap list

It is dated `2026-06-17` and claims as "Phase 1 — now" and "Phase 4" several
things that are already built and shipping. Measured contradictions:

| ROADMAP claim | Reality (measured) |
|---|---|
| "Modifiers management UI" — *not built, 2–3 days* | `src/features/admin/ModifierManagement.tsx` exists; `modifier_groups`, `modifier_options`, `menu_item_modifiers` are real tables; `server/src/routes/modifiers.ts` exists |
| "Reservations" — *Phase 4, 2 weeks* | `ReservationManagement.tsx` + `reservations` table + `routes/reservations.ts` |
| "Waitlist" — *Phase 4, 1 week* | `WaitlistManagement.tsx` + `waitlist_entries` table + `routes/waitlist.ts` |
| "Analytics dashboard" — *Phase 4, 2 weeks* | `src/features/analytics/` + `routes/analytics.ts` + `routes/reports.ts` + `ReportsPage.tsx` |
| "Promotions & loyalty" — *backend logic minimal* | `loyalty_summary`, `loyalty_transactions`, `promo_campaigns`, `promo_code_usages` tables; `routes/loyalty.ts`, `routes/promos.ts`, `LoyaltyManagement.tsx` |
| "Kitchen Display System" — *Phase 4, 2–3 weeks* | `src/features/staff/KitchenDisplay.tsx` exists |
| "Push notifications" — *Phase 4, 1 week* | `push_subscriptions` + `expo_push_tokens` tables, `routes/push.ts`, `mobile/src/services/pushNotifications.ts` |
| "i18n (10 languages)" | **11** locales, at exact key parity |
| "Multi-language menu" — *Phase 4* | Superseded by the Language Bridge (order/item note translation), which is now the headline feature |

**Gap G-01 below is therefore "rewrite the roadmap", and it is a prerequisite
for planning, not a nice-to-have.** Planning against the current file would
fund roughly 8 weeks of work that is already in production.

---

## 1. Metrics snapshot (the baseline to measure progress against)

### Code & correctness

| Metric | Value | Notes |
|---|---:|---|
| Interface locales | 11 | Note translation itself is not capped at 11 |
| `en` translation keys | 1,137 | Source of `TranslationKey` |
| Locales out of key parity | **0** | Verified by set-diff against `en.ts` |
| Schema tables | 45 | `server/src/db/schema.ts` |
| Server route modules | 42 | incl. `index.ts` aggregator |
| Unit/integration test files | 51 | excludes E2E |
| E2E specs (Playwright) | 13 | |
| CI jobs | 7 | Frontend, Server, E2E, Microservices, Mobile, Lint, Lighthouse |
| Lint warnings | 2 | pre-existing, accepted |

### Security (production dependencies only, `--omit=dev`)

| Workspace | Critical | High | Moderate | Total |
|---|---:|---:|---:|---:|
| root (frontend) | 0 | 0 | 0 | **0** |
| `server/` | 0 | 0 | 0 | **0** |
| `microservices/` | 0 | 0 | 22 | **22** |
| `mobile/` | **1** | **36** | 19 | **56** |

The microservices total is **20 `@opentelemetry/*`** (transitive via Sentry,
telemetry-only, off the request path) + `@prisma/instrumentation` +
`@sentry/node`. The `nodemailer` High that was here is **fixed** — see G-02.

`mobile/` is the newly-found one (G-22) and needs care in interpretation:
`--omit=dev` is a poor proxy for "ships to users" in an Expo app, because Expo
and React Native declare their **build toolchain as runtime dependencies**.
34 of the 37 high/critical are build-time — metro, jest, babel, `@expo/cli`,
`braces`, `micromatch`, `tar` (the one Critical). Exposure is a developer or CI
machine during a build, not an end user's phone. The two that are **not**
explicable as build tooling are `expo` and `react-native` themselves.

GitHub's Dependabot reports 127 across the repo (8 critical, 52 high). That
number counts **dev dependencies across all four lockfiles**; it is not
comparable to the production-only figures above and should not be quoted as
production risk.

### Infrastructure (VPS, shared host)

| Metric | Value | Notes |
|---|---:|---|
| Containers on host (all apps) | 174 | QListed is one of ~10 tenants of this box |
| Root disk used | **78%** | 150 G of 193 G; 44 G free |
| DB backups retained | 21 files | 384 KB total, gzipped |
| Consecutive successful DB backups | 12 days | `2026-09-29` → `2026-10-10`, integrity-checked |
| DB backup retention | 14 days | `RETAIN_DAYS` |
| **Uploads backup jobs** | **0** | ← G-03, data-loss risk |
| Uploads volume | 2.4 MB / 12 files | menu + room images |
| Off-site replication | **none** | `rclone` not installed |
| Backup encryption | **none** | `age` not installed |
| Restore drills ever performed | **0** | ← G-04 |
| Observability containers | **0** | no Loki/Promtail/Grafana/Netdata |
| PgBouncer / Redis Sentinel running | **0 / 0** | configs exist, never deployed |

---

## 2. Audit Phases 0–4 — leftovers

These phases are substantially complete. What remains:

| ID | Phase | Item | Why it is still open | Effort |
|---|---|---|---|---|
| **L-01** | 0 | `VPS_SSH_KEY` + `VITE_STRIPE_KEY` Actions secrets | **Blocked on you.** Until set, the Deploy workflow fails and every deploy is me over SSH — i.e. CI/CD is not actually continuous | 5 min (yours) |
| **L-02** | 0 | `docker-compose.vps.yml` committed default still points at `ghcr.io/anomalyco/...` | Deploy `sed`s the correct value in, so prod is right, but a manual `docker compose up` on the box would pull a foreign org's image | 10 min |
| **L-03** | 1 | 3 remaining swallowed `catch` blocks | Judged legitimately ignorable (model-event JSON parse, optional modifier probe, receipts list falling back to empty state) | — (accept) |
| **L-04** | 2 | Microservices images still tagged `abd7ad6` | Functionally current — no microservices source changed since — but the tag no longer matches the monolith's `34fb3d7`, so "what is deployed" can't be read off one tag | 20 min |
| **L-05** | 3 | WhatsApp routing, GMT Token pricing | Never started; Phase 3 scope | 1–2 wk |
| **L-06** | 4 | Dead code outside `src/components/**` | Explicitly out of scope of the Phase 4 pass | 2–3 d |
| **L-07** | — | Non-English copy has never had native review | 10 locales × 1,137 keys are machine-authored. Parity is proven; *quality* is not | ongoing |
| **L-08** | — | Tenant `adis` has 2 orphaned uploaded images | **Blocked on you** — needs re-attaching in the UI | 2 min (yours) |
| **L-09** | — | Room-service orders carry no guest notes field | So in-room requests cannot be translated even though the bridge works | 1 d |

---

## 3. Gap register — what is genuinely missing

Ordered by risk, not by phase. Each row carries the metric that proves it.

### Tier 1 — data loss and live vulnerabilities

| ID | Gap | Evidence | Risk if ignored | Status |
|---|---|---|---|---|
| **G-02** | `nodemailer` High CVE in the notifications service | `services/notifications/package.json` pinned `^6.9.16` (installed 6.10.1); `GHSA-mm7p-fcc7-pg87` + SMTP command injection via unsanitised `envelope.size`; fixed in ≥10.1.0. Root and `server/` were patched to 10.0.16 in `34fb3d7` — the **separate microservices lockfile was missed** | SMTP command injection on the service that sends password resets and booking confirmations | **✅ DONE** — bumped to `^10.1.0`, microservices high count 1 → 0, all 7 bundles load, image `notifications:a1916c3` live, `health=200` |
| **G-03** | **Uploads were not backed up at all** | 0 uploads cron entries. `infra/backup/uploads-backup.sh` **could never have worked**: `tar czf "$F" -C /opt/qcart/uploads/` has no path operand, and uploads are in the `qcart_uploads` Docker volume, not on the host FS. Never installed either | Volume loss = every tenant's menu and room photos gone permanently | **✅ DONE** — rewritten to archive the volume, integrity-checked; first run 2,489,671 bytes / **12 files**, matching the volume exactly. Cron 03:45 |
| **G-04** | No restore had ever been proven | 12 green backup runs, **0 restore drills** | An untested backup is a hope. A dump truncated mid-`COPY` is still valid gzip and passes the daily check | **✅ DONE** — `restore-drill.sh` restores into a throwaway DB under `ON_ERROR_STOP=1` and compares 9 counters vs prod. First run identical on all 9: `5\|6\|15\|2\|0\|8\|5\|29\|45`. Cron quarterly |
| **G-05** | Backups sit on the same disk as the database | `/var/backups/qlisted` on `/dev/sda1`, same volume as Postgres; `rclone` absent | Single disk failure loses the data *and* the backups. Disk already 78% full | **BLOCKED** — needs a B2/R2 bucket + key |
| **G-06** | Backups are unencrypted | `age` not installed; plain gzip | Dumps contain customer PII and bcrypt hashes. Anything that reads the disk reads the database | **BLOCKED** — needs a key-custody decision. Generating a key unilaterally would risk making backups permanently unrecoverable if the private key is lost |

### Tier 2 — operability

| ID | Gap | Evidence | Risk | Effort |
|---|---|---|---|---|
| **G-07** | No uptime monitoring | 0 monitoring containers; no external checker | You find out the site is down because a customer tells you | 1 h |
| **G-08** | No log aggregation / dashboards | `infra/monitoring/docker-compose.yml`, `promtail-config.yml`, `loki.yml` all written, **never deployed** (0 containers) | Debugging prod = `docker logs` by hand across 9 containers. No error-rate or latency signal at all | 1 d |
| **G-09** | No disk-space or backup-freshness check | 78% used, 44 G free, 174 containers on a shared host | Disk-full takes down all ~10 apps, not just QListed. The single most likely outage cause right now | **✅ DONE** — `backup-health.sh` checks disk + freshness/size/validity of both archives. Verified it *actually trips* on a disk threshold, on staleness and on a missing dir. Cron 04:30. Still needs a sink (G-07) to page anyone |
| **G-10** | Deploy is not self-service | Depends on L-01 | Every deploy requires me. That is a bus factor of one | — (see L-01) |

### Tier 3 — scale (not yet needed, do not pre-build)

| ID | Gap | Evidence | When it becomes real |
|---|---|---|---|
| **G-11** | PgBouncer not deployed | `infra/pgbouncer/pgbouncer.ini` written, not running | Only at multi-instance API. Premature for one API container |
| **G-12** | Redis Sentinel not deployed | `infra/redis/sentinel.conf` written, not running | Only when Redis downtime becomes unacceptable |
| **G-13** | No CDN for `/uploads/` | `infra/nginx/cdn.conf` written, not wired | At meaningful image traffic — 2.4 MB today |
| **G-14** | Single API instance | one `qcart-api` container | At sustained CPU pressure |
| **G-15** | Cloudflare not in front | `infra/cloudflare-setup.md` is a guide, not a state | At first DDoS or real traffic |
| **G-16** | Postgres is self-hosted in Docker | — | When PITR matters more than cost |

### Tier 4 — product

| ID | Gap | Evidence | Notes |
|---|---|---|---|
| **G-01** | **`ROADMAP.md` is materially wrong** | §0.1 — 9 measured contradictions | Prerequisite for any planning. Cheapest high-value item here |
| **G-17** | Language Bridge cannot actually translate | OpenAI returns `429 credit_balance_exhausted` | **Blocked on you** — the headline feature is inert until billing is topped up |
| **G-18** | Translation covers order + item notes only | `translateNote` called from exactly 2 sites, both order creation | Marketing copy was narrowed to match in all 11 locales. Extending to front desk/housekeeping is net-new work (and needs L-09) |
| **G-19** | Mobile app unreleased | `deepLink.ts`, `useOfflineSync.ts`, `pushNotifications.ts` all exist; CI bundles it | Never submitted to either store. No `eas submit` has run. Gated on G-22 |
| **G-22** | **Mobile is 5 Expo SDK versions behind** | pinned `expo ~52.0.0`, `react-native 0.76.9`, `react 18.3.1`; current Expo is **57.0.27**. 56 prod advisories (1 critical `tar`, 36 high) — 34 are build toolchain, but `expo` and `react-native` themselves are two of them | **This blocks store submission**, so it blocks G-19. Apple/Google require recent SDKs and EAS drops old ones. A 52 → 57 jump crosses RN 0.76 → 0.8x and React 18 → 19: breaking changes, not an `audit fix`. Size it as **3–5 days** with a real device test pass, not an afternoon |
| **G-20** | No public API docs | `routes/docs.ts` exists; no OpenAPI spec | Phase 5 "developer platform" |
| **G-21** | Self-serve onboarding incomplete | `routes/onboarding.ts` + `src/features/onboarding/` exist | The `toSlug` fix removed the worst failure; full flow unverified end-to-end |

---

## 4. Blocked on you (nothing I can do about these)

| # | Item | Why blocked | Unblocks |
|---|---|---|---|
| 1 | Set `VPS_SSH_KEY` + `VITE_STRIPE_KEY` in GitHub Actions secrets | Secret material — the permission classifier blocks me from reading or uploading it, and I did not work around that deliberately | L-01, G-10 — makes deploys actually automatic |
| 2 | Top up OpenAI billing | `429 credit_balance_exhausted` | G-17 — the headline feature |
| 3 | Backblaze B2 / Cloudflare R2 bucket + key | Needs your account | G-05 — off-site backups |
| 4 | Re-attach `adis`'s 2 orphaned images | Tenant-owned content | L-08 |

---

## 5. Target metrics (definition of done)

| Metric | At start of this pass | Now | Target |
|---|---:|---:|---:|
| Prod high/critical CVEs — server-side workspaces | 1 high | **0** ✅ | 0 |
| Prod high/critical CVEs — `mobile/` | 37 | 37 | 0 (via G-22) |
| Backup jobs covering DB **and** uploads | 1 of 2 | **2 of 2** ✅ | 2 of 2 |
| Restore drills passed | 0 | **1, cronned quarterly** ✅ | ≥1/quarter |
| Checks that can fail loudly | 0 | **1 (disk + both archives)** ✅ | — |
| `ROADMAP.md` measured contradictions | 9 | **0** ✅ | 0 |
| Off-site backup copies | 0 | 0 | ≥1 |
| Encrypted backups | 0% | 0% | 100% |
| Mean time to detect an outage | unbounded | unbounded | < 5 min |
| Deploys needing me | 100% | 100% | 0% |
| Locales out of key parity | 0 | 0 | 0 (hold) |
| Expo SDK versions behind | 5 | 5 | 0 |

---

## 6. Execution order

Tier 1 first — those are live vulnerabilities and unrecoverable data loss, and
all of them are hours, not weeks.

### Applied 2026-10-10 (commit `a1916c3`)

1. ✅ **G-02** nodemailer High → patched, notifications rebuilt and live, `health=200`
2. ✅ **G-03** uploads backup → rewritten (the old script was broken), installed, cronned, artifact proven
3. ✅ **G-04** restore drill → passed on all 9 counters, cronned quarterly
4. ✅ **G-09** disk + backup health check → installed, cronned, failure modes verified
5. ✅ **G-01** `ROADMAP.md` rewritten against measured reality

Cron on the VPS is now `03:30` db → `03:45` uploads → `04:30` health, plus the
drill quarterly.

### Next, in this order

6. **G-05** off-site replication — the moment a bucket exists. This is the
   largest remaining single point of failure: backups are on the same disk as
   the data they protect.
7. **G-06** encryption — needs the key-custody decision first.
8. **G-07** uptime monitoring — gives G-09's exit code somewhere to go.
9. **G-22** Expo SDK 52 → 57, which unblocks **G-19** (shipping the app).
10. **G-08** log aggregation — **deliberately last.** Loki/Promtail/Grafana is
    3 more containers plus log storage on a host at 78% disk with 44 G free.
    Doing it now trades a monitoring gap for a disk-full outage across all ~10
    apps. It needs a disk budget decided first, not just a `compose up`.

Tier 3 is deliberately **not** scheduled. PgBouncer, Sentinel, Kubernetes and a
CDN for 2.4 MB of images are all solutions to problems this deployment does not
have yet, and each one adds a failure mode to a host already running 174
containers at 78% disk.
