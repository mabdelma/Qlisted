# QCart — VPS Deployment (shared with qarrito + escoutly)

QCart runs on the **same VPS** as qarrito and escoutly. To avoid port clashes and
get automatic HTTPS, all apps follow one rule:

> **qarrito's stack owns the only Caddy reverse proxy** (it binds ports 80/443 and
> handles Let's Encrypt). Every other app — qcart, escoutly — publishes **no**
> ports and joins a shared external Docker network called **`edge`**. Caddy
> proxies each app by its container name.

QCart is **single-origin**: its own internal nginx serves the SPA and proxies
`/api` (including SSE) and `/uploads` to the qcart API. So Caddy only needs to
forward `qlisted.com` → `qcart-frontend:80`.

```
Internet ──HTTPS──▶ Caddy (qarrito stack, :443)
                      │  qlisted.com
                      ▼   (edge network, by name)
                 qcart-frontend:80  (nginx: SPA + /api + /uploads proxy)
                      │ (qcart internal network)
                      ▼
                   api:3001 ──▶ postgres:5432
                               redis:6379
```

## Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Base stack (postgres, migrate, api, frontend). |
| `docker-compose.vps.yml` | Prod overlay: joins `edge`, drops published ports, injects secrets, persists uploads. |
| `frontend.Dockerfile` | Builds the SPA (bakes `VITE_STRIPE_KEY`) + nginx with `/api` (SSE-safe) and `/uploads` proxies. |
| `.env.prod.example` | Template for production secrets → copy to `.env.prod` (gitignored). |
| `scripts/deploy-vps.sh` | Pull → build → migrate+seed → up. |
| `infrastructure/caddy/qcart.Caddyfile` | Reference block to paste into qarrito's Caddyfile (already added there). |

## One-time setup on the VPS

1. **DNS** — add an A record: `qlisted.com` → VPS public IP.

2. **Shared network** (skip if qarrito/escoutly already created it):
   ```bash
   docker network create edge
   ```

3. **Clone + configure secrets:**
   ```bash
   git clone <qcart-repo> qcart && cd qcart
   cp .env.prod.example .env.prod
   # edit .env.prod: strong POSTGRES_PASSWORD, JWT_SECRET (openssl rand -hex 32),
   # STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET (sk_live/whsec), VITE_STRIPE_KEY (pk_live),
   # SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD, REDIS_URL=redis://redis:6379
   ```

4. **Caddy block** — already added to qarrito's `infrastructure/caddy/Caddyfile`
   (the `qlisted.com {…}` block). If qarrito's Caddyfile on the VPS predates
   that change, paste `infrastructure/caddy/qcart.Caddyfile` into it.

## Deploy / redeploy

### Automatic (CI/CD)

Push to `main` on GitHub → CI runs → Deploy workflow:

1. Builds API + frontend images on GitHub Actions
2. Pushes to `ghcr.io/anomalyco/qcart/api:sha` and `ghcr.io/anomalyco/qcart/frontend:sha`
3. SSHes into the VPS, updates image tags in `docker-compose.vps.yml`, pulls, runs migrations, restarts

Full pipeline: `git push origin main` → wait for CI → deploy runs automatically.

### Off-box build → ship (recommended, safe)

> **Never build on the VPS.** It is a swapless, ~10-app shared 16GB host; an
> on-box `docker build` OOM-thrashed it into a ~15-min outage (2026-07-09).
> Build on your machine, ship the finished image, let the VPS only load + run.

From a dev machine with Docker + SSH access to the box (`qarrito` host alias):

```bash
# 1. Build off-box (frontend bakes the *publishable* VITE_STRIPE_KEY from .env.prod)
KEY=$(ssh qarrito 'grep ^VITE_STRIPE_KEY= /var/www/qcart/.env.prod | cut -d= -f2-')
docker build --build-arg VITE_STRIPE_KEY="$KEY" --build-arg VITE_API_URL= \
  -f frontend.Dockerfile -t ghcr.io/anomalyco/qcart/frontend:latest .
docker build -t ghcr.io/anomalyco/qcart/api:latest ./server

# 2. Ship straight into the VPS Docker (moves :latest; running containers keep going)
docker save ghcr.io/anomalyco/qcart/api:latest ghcr.io/anomalyco/qcart/frontend:latest \
  | gzip | ssh qarrito 'gunzip | docker load'
```

Then, on the VPS:

```bash
cd /var/www/qcart
C="docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.vps.yml"

# 3. Fresh backup — rollback point
docker exec qcart-prod-postgres-1 pg_dump -U qcart qcart \
  | gzip > /var/backups/qlisted/qlisted-predeploy-$(date +%Y%m%d-%H%M%S).sql.gz

# 4. Rehearse the migration on a throwaway DB (drizzle push --force can be destructive)
set -a && . ./.env.prod && set +a
BK=$(ls -t /var/backups/qlisted/qlisted-predeploy-*.sql.gz | head -1)
docker exec qcart-prod-postgres-1 psql -U qcart -c "CREATE DATABASE migrate_rehearsal;"
gunzip -c "$BK" | docker exec -i qcart-prod-postgres-1 psql -U qcart -d migrate_rehearsal
docker run --rm --network qcart-prod_default \
  -e DATABASE_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@postgres:5432/migrate_rehearsal" \
  ghcr.io/anomalyco/qcart/api:latest sh -c "npx drizzle-kit push --config=drizzle.config.ts --force"
# confirm tables + tenants survive, then:
docker exec qcart-prod-postgres-1 psql -U qcart -c "DROP DATABASE migrate_rehearsal;"

# 5. Migrate prod, then 6. recreate the app tier (~2s blip)
$C up -d --force-recreate migrate        # wait for exit 0, logs "Changes applied"
$C up -d --force-recreate api qcart-frontend
```

7. Verify: `curl -I https://qlisted.com` (200), `/api/health`, a real data
   endpoint, served bundle has the new code, `docker ps` health, VPS load.

On first deploy (or after editing the Caddyfile), reload the shared Caddy from
the **qarrito** project so the new host routes and gets a cert:

```bash
cd /path/to/qarrito
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
```

### Manual on-box build — ⚠️ avoid on this host

```bash
./scripts/deploy-vps.sh                          # runs `docker compose build` ON the box
# or: docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.vps.yml up -d --build
```

⚠️ Both build on the VPS and can OOM the shared host — this is what caused the
2026-07-09 outage. Only use if the box has ample free RAM/swap and no other app
is under load. Prefer the off-box path above.

## Stripe webhook

Point your Stripe webhook endpoint at:
```
https://qlisted.com/api/webhooks/stripe
```
and set the resulting signing secret as `STRIPE_WEBHOOK_SECRET` in `.env.prod`.

## Notes / gotchas

- **Redis is required.** The API fails at startup if `REDIS_URL` is missing — it
  powers SSE pub/sub for cross-instance order notifications. Both the base
  `docker-compose.yml` and the VPS overlay include a `redis` service.
- **No published ports.** The overlay uses `ports: !reset []` so the base file's
  `80/3001/5434` don't leak — only Caddy faces the internet. Postgres and Redis
  are private to the internal network.
- **`VITE_STRIPE_KEY` is build-time.** Changing it requires `--build` (the deploy
  script always rebuilds). The publishable key is safe to expose; never put the
  secret key in `VITE_*`.
- **Uploads persist** in the `qcart_uploads` Docker volume mounted at the API's
  `/app/uploads`.
- **Migrations + seed** run automatically via the `migrate` service on every
  `up`. Seeding is idempotent-by-intent; review `server/src/db/seed.ts` before
  re-running against data you care about.
- **Unique names on `edge`.** Both the Compose *service name* and `container_name`
  of the edge-facing container must be unique across every stack on the VPS. The
  service name becomes a DNS alias on `edge`; a generic name like `frontend`
  collides with qarrito's own `frontend` upstream and 502s it. That's why the
  service is named `qcart-frontend`, not `frontend`.
```
