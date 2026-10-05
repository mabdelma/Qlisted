# Phase 1 — Production schema & data risks

Owner: Phase 1. Scope of changes in this phase: `server/drizzle/**`,
`docker-compose.yml`, `docker-compose.vps.yml`, this file.

**Nothing in this document has been executed against production.** Every prod
command below is for a human to review and run. All prod inspection done to
write this was read-only (`psql` SELECT / catalog queries, `docker inspect`,
`docker logs`).

---

## 1. The big risk: prod schema is managed by `drizzle-kit push --force`

### What was true before this change

`docker-compose.yml`'s `migrate` service ran:

```
npx drizzle-kit push --config=drizzle.config.ts --force 2>&1 && node dist/db/seed.js
```

`drizzle-kit push` is a **declarative diff**: it introspects the live DB,
compares it to `src/db/schema.ts`, and emits whatever DDL reconciles the two.
`--force` suppresses the interactive data-loss confirmation. Running unattended,
that means **a renamed column in `schema.ts` becomes a silent `DROP` + `ADD` in
prod** — the old column and its data are gone, no migration file, no record.

Meanwhile **CI uses `drizzle-kit migrate`** (versioned `.sql` files). So the two
environments reconcile the schema by different mechanisms: CI can be green on a
path prod never runs, and prod can diverge from the migration files without CI
ever noticing.

### Verified facts on prod (2026-10-05, read-only)

- `drizzle` schema exists; `drizzle.__drizzle_migrations` exists with the
  expected shape (`id serial pk`, `hash text not null`, `created_at bigint`) and
  **0 rows**.
- Schema is otherwise current: all columns/indexes/FKs from migrations through
  `0026_language_bridge` are present (`tenants.venue_type`,
  `tenants.operating_language`, `orders.booking_id`,
  `menu_items.room_service_available`, `room_bookings.access_token`, etc.).
- 45 base tables in `public`.
- The running images are `qlisted/api:3081fe4` and `qlisted/frontend:3081fe4`
  (local tags, **not** the `ghcr.io/...` refs in the committed compose — see §2).

An empty migrations table + a current schema is the signature of a DB built by
`push`, not `migrate`. There is **no record of what was applied**.

#### One real drift already found

The unique index from `0025_guest_self_checkin`,
`room_bookings_access_token_idx`, is **MISSING on prod**, even though the four
`room_bookings` columns from that same migration are present. `push` reconciles
state, not steps, so a partial apply like this leaves no trace. `migrate` would
have either fully applied 0025 or failed loudly. (`room_bookings` currently has
0 rows, so the index can be created safely — see §1.6.)

This matters more now because automated deploys are about to run the `migrate`
service on **every push**.

### 1.1 Goal

Make prod use `drizzle-kit migrate` safely, so the schema only ever changes via
reviewed, versioned `.sql` files — the same mechanism CI already runs.

### 1.2 The committed change (already made in this phase)

`docker-compose.yml`, `migrate` service, command changed to:

```
npx drizzle-kit migrate --config=drizzle.config.ts && node dist/db/seed.js
```

- `drizzle-kit migrate` reads `out: './drizzle'` and the default
  `migrationsSchema=drizzle` / `migrationsTable=__drizzle_migrations` from
  `drizzle.config.ts`.
- The `2>&1` was dropped: it was only there to make `push`'s progress spinner
  land on stdout; `migrate` doesn't need it and it obscured the real exit code.
- The image already ships everything `migrate` needs: `drizzle/` (the `.sql`
  files + `meta/_journal.json`), `drizzle.config.ts`, `node_modules`
  (`drizzle-kit` 0.31.10, `drizzle-orm` 0.45.2, `pg` 8), and `src/`.

**This change is safe on a fresh/empty DB** (local dev, CI): `migrate` creates
the `drizzle` schema and `__drizzle_migrations` table, then runs 0000..0026 in
order. **It is NOT safe against the existing prod DB until prod is baselined**
(§1.4) — without a baseline, `migrate` sees an empty table and replays from
0000, whose first statement is `CREATE TABLE "tenants"`, which fails because the
table already exists. The deploy would abort (good — it blocks on the migrate
exit code) but prod would be stuck until baselined. **So the baseline must be
applied before the first deploy that carries this compose change.**

### 1.3 How `drizzle-kit migrate` decides what to run (from the installed source)

`drizzle-kit migrate` (bin.cjs → `preparePostgresDB`, `pg` branch) delegates to
`drizzle-orm/node-postgres/migrator` → `PgDialect.migrate` in
`drizzle-orm/pg-core/dialect.js` (v0.45.2). The exact logic:

1. `CREATE SCHEMA IF NOT EXISTS "drizzle"`.
2. `CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (id SERIAL
   PRIMARY KEY, hash text NOT NULL, created_at bigint)`.
3. Read the single most-recent row:
   `select id, hash, created_at from "drizzle"."__drizzle_migrations" order by
   created_at desc limit 1`.
4. In one transaction, for each migration in journal order: **if there is no
   last row, or `Number(lastDbMigration.created_at) < migration.folderMillis`**,
   run its statements and
   `insert into "drizzle"."__drizzle_migrations" ("hash","created_at")
   values(<hash>, <folderMillis>)`.

Key consequences:

- **The decision is driven only by `created_at` vs `folderMillis`**, compared
  against the single newest recorded row. `hash` is stored but **not** used to
  decide whether to run (in this version). So the behavioral requirement for a
  baseline is simply: the newest recorded `created_at` must be ≥ the newest
  migration's `folderMillis`.
- `folderMillis` = the `when` field of that entry in
  `drizzle/meta/_journal.json`. Our journal's `when` values are strictly
  increasing (verified), max = **1791118101078** (`0026_language_bridge`).
- `id` is `SERIAL`; drizzle inserts only `(hash, created_at)` and lets the
  sequence assign `id`. The baseline does the same, so the sequence stays
  consistent and the next real migration gets a fresh id.

### 1.4 The baseline

File: **`server/drizzle/baseline/0000_baseline_existing_schema.sql`** (committed
in this phase). It lives in a `baseline/` subfolder, **not** in `drizzle/`
directly, so the migrator never treats it as a migration (`migrate` only reads
tags listed in `_journal.json` plus `meta/`). It is a **one-time, manual**
script for the existing prod DB — it is not wired into any automated path.

It inserts one row per existing migration (idx 0..26) as already-applied:

- `created_at` = each entry's `when` from `_journal.json`.
- `hash` = `sha256_hex` of the UTF-8 bytes of `drizzle/<tag>.sql` **with LF line
  endings** (how the files are shipped in the Linux-built image).
- `id` left to the `SERIAL` default.

It is guarded: it aborts (whole transaction rolled back) if the table is not
empty, and asserts 27 rows with max `created_at = 1791118101078` at the end.

#### How the hashes were derived and verified

The migrator computes `hash = crypto.createHash("sha256").update(query).digest("hex")`
where `query = fs.readFileSync(<tag>.sql).toString()` (UTF-8). For our files
(all pure ASCII — verified no byte > 0x7F in any `.sql`), the hashed string
re-encodes to bytes identical to the file, so the hash is `sha256` of the file
bytes.

The one subtlety is **line endings**. This working tree is Windows with
`core.autocrlf=true`, so the files on disk are CRLF and would hash differently.
The Docker image is built on Linux (CI/`deploy.yml` on `ubuntu-24.04`) from a
git checkout with **LF**, so the bytes the migrator actually reads are the **git
blob (LF)** bytes. The baseline hashes were therefore computed from
`git show HEAD:server/drizzle/<tag>.sql` (LF), **not** the CRLF worktree copies.

To avoid trusting a hand-rolled reimplementation, the hashes were cross-checked
by running **drizzle-orm 0.45.2's own `readMigrationFiles()`** (the exact
function `migrate` calls) against an LF-materialized copy of `server/drizzle`.
All 27 hashes and `folderMillis` values matched the committed baseline
byte-for-byte, and a simulation confirmed: with the baseline's newest row
(`created_at=1791118101078`) present, the number of migrations `migrate` would
run is **0**; with an empty table it is 27.

**Confidence in the hash derivation: high**, with two stated dependencies:
1. The image is built from an LF checkout. True for CI/deploy (Linux). If anyone
   ever builds the image from a CRLF checkout, the file bytes — and thus the
   hashes drizzle computes at runtime — would differ from this baseline, and
   `migrate` would still be a no-op only because of the `created_at` comparison
   (§1.3), not the hash. The stored hashes would simply not match the files;
   harmless in 0.45.2 but worth knowing.
2. drizzle-orm stays at 0.45.2. A future version that validates stored hashes,
   or changes the algorithm, would need this revisited.

Because the run/no-run decision depends only on `created_at` (not `hash`) in
0.45.2, **the baseline is behaviorally correct even in the unlikely event a hash
is off** — but the hashes were verified exactly regardless, so the recorded
history is faithful.

### 1.5 Runbook — baseline prod, then cut over to `migrate`

Run as a human, in order. Assumes the Phase-1 commits (the `docker-compose.yml`
change and the baseline file) are merged to `main`.

```sh
# 0. From your machine: snapshot the DB first. This is the real rollback.
ssh qarrito
cd /var/www/qcart
docker exec qcart-prod-postgres-1 sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > /root/qcart-pre-baseline-$(date +%Y%m%d-%H%M%S).dump
ls -la /root/qcart-pre-baseline-*.dump   # confirm non-zero size

# 1. Confirm the starting state: table exists and is EMPTY.
docker exec qcart-prod-postgres-1 sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc \
   "select count(*) from drizzle.__drizzle_migrations"'
#   expect: 0   (if not 0, STOP — prod was already baselined; do not re-run)

# 2. Get the baseline SQL onto the box from the merged commit, then apply it.
#    (git pull here only updates the working tree; it does not touch the stack.)
git fetch origin main
git show origin/main:server/drizzle/baseline/0000_baseline_existing_schema.sql \
  > /tmp/baseline.sql
#    Apply it. The script is one transaction with its own guards; -1 wraps it
#    and -v ON_ERROR_STOP=1 aborts on any error.
docker exec -i qcart-prod-postgres-1 sh -c \
  'psql -v ON_ERROR_STOP=1 -1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < /tmp/baseline.sql
#    expect: BEGIN ... INSERT 0 27 ... COMMIT  (no ERROR lines)

# 3. Verify the baseline (see §1.6). Do this BEFORE deploying the new compose.

# 4. Only after the committed docker-compose.yml change (push->migrate) is on
#    main, let the normal deploy run — OR dry-run migrate by hand first:
docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.vps.yml \
  run --rm migrate
#    expect: "No migrations to run" (drizzle-kit) then the seed's idempotent
#    "already seeded, skipping." / "Super admin already exists" lines, exit 0.
```

### 1.6 Verification

```sh
# a) 27 rows, newest created_at is 0026's, ids are sequential from the sequence.
docker exec qcart-prod-postgres-1 sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc \
   "select count(*), min(created_at), max(created_at) from drizzle.__drizzle_migrations"'
#   expect: 27|1781603815302|1791118101078

# b) migrate is now a no-op (the real proof). Exit 0 and no DDL.
docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.vps.yml \
  run --rm migrate
#   drizzle-kit prints that there are no pending migrations.
```

Optional cleanup of the §1 drift — recreate the missing 0025 index (safe:
`room_bookings` has 0 rows; the statement is exactly 0025's, made idempotent):

```sh
docker exec qcart-prod-postgres-1 sh -c \
  'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
   "CREATE UNIQUE INDEX IF NOT EXISTS \"room_bookings_access_token_idx\" ON \"room_bookings\" (\"access_token\")"'
```

### 1.7 Rollback

- **If the baseline INSERT itself errors**: it runs in one transaction with
  `ON_ERROR_STOP=1`, so it rolls back automatically — the table stays empty,
  nothing changed. Fix the cause and re-run.
- **To undo a successful baseline** (e.g. you need to re-baseline): the rows are
  pure metadata, no schema was touched. Only while the compose still runs the
  old `push` command, or before any `migrate` has run, is this harmless:
  ```sh
  docker exec qcart-prod-postgres-1 sh -c \
    'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
     "TRUNCATE drizzle.__drizzle_migrations RESTART IDENTITY"'
  ```
- **Full rollback** (schema damaged by a bad migrate): restore the pre-baseline
  dump from step 0:
  ```sh
  # into a scratch DB first to inspect, or against the live DB during a window:
  docker exec -i qcart-prod-postgres-1 sh -c \
    'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' \
    < /root/qcart-pre-baseline-<TS>.dump
  ```
- **Revert the mechanism**: redeploy the previous `docker-compose.yml` (git
  revert the Phase-1 commit) to return the `migrate` service to `push --force`.

### 1.8 What could NOT be verified without a real database

- The baseline SQL was **not executed** anywhere (no local Postgres; prod is
  read-only for this phase). It is structurally correct and its hashes/logic are
  proven against drizzle's own code, but the actual `psql` run on prod is
  step 2 of the human runbook.
- `drizzle-kit migrate`'s exact stdout string for "nothing to run" was not
  captured against prod; the behavior (0 migrations) is proven by the
  `created_at` logic and the `readMigrationFiles` simulation.
- Whether the deploy pipeline's `docker wait migrate` + exit-code gate behaves
  identically for `migrate` vs `push` was reasoned from `deploy.yml`, not run.

---

## 2. `docker-compose.vps.yml` image defaults pointed at a foreign private org

### Before

```
migrate:        image: ghcr.io/anomalyco/qcart/api:latest
api:            image: ghcr.io/anomalyco/qcart/api:latest
qcart-frontend: image: ghcr.io/anomalyco/qcart/frontend:latest
```

`ghcr.io/anomalyco/qcart/*` is a **different GitHub org**, whose packages are
private (403 anonymous). The deploy rewrites these lines with `sed` at deploy
time, so it works today — but the committed default points prod at a registry we
don't control, and if the `sed` ever stops matching, prod pulls from there.

### After (changed in this phase)

```
migrate:        image: ghcr.io/mabdelma/qlisted/api:latest
api:            image: ghcr.io/mabdelma/qlisted/api:latest
qcart-frontend: image: ghcr.io/mabdelma/qlisted/frontend:latest
```

`ghcr.io/mabdelma/qlisted/{api,frontend}` matches what `deploy.yml` builds and
pushes (`${{ steps.repo.outputs.lc }}` = `mabdelma/qlisted`, lowercased).

### The deploy's `sed` still matches (verified)

`deploy.yml` runs, on the VPS:
```
sed -i "s|image:.*api:.*|image: .../api:<sha>|"      docker-compose.vps.yml
sed -i "s|image:.*frontend:.*|image: .../frontend:<sha>|" docker-compose.vps.yml
```
- `image:.*api:.*` matches both `migrate` and `api` lines
  (`...qlisted/api:latest`) and **not** the frontend or `redis:7-alpine` lines.
  Both become the api `<sha>` image — correct, the migrate service uses the api
  image.
- `image:.*frontend:.*` matches only the `qcart-frontend` line.
- Simulated both seds in order against the new file: the three image lines
  rewrite exactly as intended; `redis:7-alpine` is untouched.

> Note (not in Phase-1 scope to fix): prod is currently **running**
> `qlisted/api:3081fe4` / `qlisted/frontend:3081fe4` — local image tags with no
> registry prefix, i.e. images built on the box, not pulled from ghcr. That is a
> runtime-state artifact, separate from the committed default. The next deploy
> pins images to `ghcr.io/mabdelma/qlisted/*:<head_sha>` via the sed regardless.

---

## 3. `owner@demo.com` — weak default credential in a shared database (ACTION NEEDED)

### Finding (read-only)

Prod has exactly three users:

| email | role | tenant |
|---|---|---|
| `owner@demo.com` | admin | `demo-cafe` (507e9029-…) |
| `medores@g.com` | admin | `medores` (4012f415-…) — **a real paying customer** |
| `mohamed@grandmindstechnology.com` | super_admin | (none) |

`owner@demo.com`'s hash is `$2a$12$…` (bcrypt, cost 12). Tested offline with
`bcryptjs` against the real prod hash: it matches **`pass123`** — the default
seeded in `server/src/db/seed.ts` and **published in the repo README**
("Admin login: owner@demo.com / pass123"). Candidates `password123`, `password`,
`admin`, etc. did not match; `pass123` did.

This is an open door: anyone can log in as a tenant admin on a DB that is shared
(single Postgres, row-scoped by `tenant_id`) with a paying customer.

### Blast-radius check (read-only)

- Tables with a FK to `users`: `audit_logs`, `refresh_tokens`, `rooms`
  (`housekeeper_id`), `sessions`, `shifts`, `time_entries` — **all with
  `ON DELETE NO ACTION`**.
- Rows referencing `owner@demo.com`'s id in each of those: **0**. So a delete
  would **not** hit any FK and would not cascade.
- `demo-cafe` tenant: 4 `menu_items`, 0 orders. It **must not be deleted** — the
  deploy pipeline's final end-to-end smoke test is
  `GET https://qlisted.com/api/r/demo-cafe/menu` expecting 200, and the seed
  re-creates `demo-cafe` + `owner@demo.com` on every run anyway (idempotent
  "already seeded" guard keys off existing data).

### Recommendation: **rotate the password, do not delete**

Reasons: the account/tenant is the advertised public demo and the deploy smoke
test depends on `demo-cafe` existing; deleting the *user* is FK-safe but the
seed would just recreate it with `pass123` on the next deploy, reopening the
door. Rotating to a strong secret closes the door and survives re-seeding (the
seed only inserts when the user is absent).

> Durable fix (Phase 3 territory, flagged not done here): the seed should read
> the demo admin password from an env var and refuse to fall back to a literal
> in production, the same way it already requires `SUPER_ADMIN_PASSWORD`.
> Until that lands, a rotation performed by hand will stand only until someone
> deletes the user row and forces a re-seed.

### Exact prod commands (for review — NOT executed)

Rotate (recommended). Do the whole thing inside the `qcart-api` container, which
already has `bcryptjs` (cost 12, the exact library/cost the app verifies with),
`pg`, and `DATABASE_URL`. This is fully parameterized (`$1`/`$2` bind params — no
SQL-injection, no psql quoting to get wrong), and prints the new password once:

```sh
ssh qarrito
docker exec qcart-api node -e '
const b=require("bcryptjs");const{Client}=require("pg");const crypto=require("crypto");
(async()=>{
  const pw=crypto.randomBytes(18).toString("base64");
  const hash=b.hashSync(pw,12);
  const c=new Client({connectionString:process.env.DATABASE_URL});
  await c.connect();
  const r=await c.query("update users set password_hash=$1 where email=$2",[hash,"owner@demo.com"]);
  console.log("rows updated:",r.rowCount," (expect 1)");
  console.log("still accepts pass123?",b.compareSync("pass123",hash)," (expect false)");
  console.log("NEW PASSWORD — store in the secrets manager, not shown again:",pw);
  await c.end();
})().catch(e=>{console.error(e);process.exit(1);});
'
```

Alternative — delete the user (FK-safe today: 0 referencing rows, all FKs are
`ON DELETE NO ACTION`). Only do this **together with** the seed fix above, or the
next deploy's seed recreates the user with `pass123`:

```sh
docker exec qcart-api node -e '
const{Client}=require("pg");
(async()=>{
  const c=new Client({connectionString:process.env.DATABASE_URL});
  await c.connect();
  const r=await c.query("delete from users where email=$1",["owner@demo.com"]);
  console.log("rows deleted:",r.rowCount," (expect 1)");
  await c.end();
})().catch(e=>{console.error(e);process.exit(1);});
'
```

---

## Appendix — files changed in this phase

- `docker-compose.yml` — `migrate` service: `drizzle-kit push --force` →
  `drizzle-kit migrate`.
- `docker-compose.vps.yml` — image defaults: `ghcr.io/anomalyco/qcart/*` →
  `ghcr.io/mabdelma/qlisted/*` (3 lines).
- `server/drizzle/baseline/0000_baseline_existing_schema.sql` — new, one-time
  manual baseline for the existing prod DB.
- `docs/PHASE1-SCHEMA.md` — this file.
