#!/usr/bin/env bash
# ─── Qlisted restore drill ───────────────────────────────────────────────────
# Proves the newest DB backup is actually restorable, by restoring it into a
# throwaway database and comparing row counts against live production.
#
# An untested backup is a hope, not a backup: the daily job's integrity check
# only proves the gzip stream is valid and the file is non-trivial in size. A
# dump that is valid gzip but truncated mid-COPY passes that and still restores
# to a broken database. This script is what closes that gap.
#
# Safe to run against production: it only ever CREATEs and DROPs
# qlisted_restore_drill, and reads prod read-only. It never writes to prod.
#
# Install: /usr/local/bin/qlisted-restore-drill.sh (chmod +x). Run quarterly:
#   0 5 1 */3 * /usr/local/bin/qlisted-restore-drill.sh >> /var/log/qlisted-restore-drill.log 2>&1
#
# Exit 0 = every counter matched. Exit 1 = drill FAILED, investigate now.
set -euo pipefail

ENV_FILE=${QLISTED_ENV:-/var/www/qcart/.env.prod}
SRC=${QLISTED_BACKUP_DIR:-/var/backups/qlisted}
CONTAINER=${PG_CONTAINER:-qcart-prod-postgres-1}
SCRATCH=qlisted_restore_drill

val() { grep -E "^$1=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2-; }
PGUSER=$(val POSTGRES_USER); PGUSER=${PGUSER:-qcart}
PGDB=$(val POSTGRES_DB);     PGDB=${PGDB:-qcart}
PGPASS=$(val POSTGRES_PASSWORD)

psql_in() { docker exec -e PGPASSWORD="$PGPASS" "$CONTAINER" psql -U "$PGUSER" -d "$1" -t -A -F"|" "${@:2}"; }

LATEST=$(ls -t "$SRC"/qlisted-*.sql.gz 2>/dev/null | head -1)
[ -n "$LATEST" ] || { echo "[drill] FAIL: no backup found in $SRC" >&2; exit 1; }
echo "[drill] $(date -Is) restoring $LATEST"

cleanup() { psql_in postgres -q -c "DROP DATABASE IF EXISTS $SCRATCH;" >/dev/null 2>&1 || true; }
trap cleanup EXIT

psql_in postgres -q -c "DROP DATABASE IF EXISTS $SCRATCH;" -c "CREATE DATABASE $SCRATCH;" >/dev/null

# ON_ERROR_STOP is the point: a truncated dump must fail here, not restore
# halfway and look fine.
if ! gunzip -c "$LATEST" | docker exec -i -e PGPASSWORD="$PGPASS" "$CONTAINER" \
     psql -U "$PGUSER" -d "$SCRATCH" -v ON_ERROR_STOP=1 -q >/dev/null 2>/tmp/drill.err; then
  echo "[drill] FAIL: restore errored" >&2; tail -5 /tmp/drill.err >&2; exit 1
fi

# drizzle.__drizzle_migrations is in the `drizzle` schema, not public — getting
# this wrong makes the whole comparison error out instead of comparing.
Q="SELECT (SELECT count(*) FROM tenants),(SELECT count(*) FROM users),(SELECT count(*) FROM menu_items),(SELECT count(*) FROM orders),(SELECT count(*) FROM payments),(SELECT count(*) FROM tables),(SELECT count(*) FROM rooms),(SELECT count(*) FROM drizzle.__drizzle_migrations),(SELECT count(*) FROM information_schema.tables WHERE table_schema='public');"
PROD=$(psql_in "$PGDB" -c "$Q")
REST=$(psql_in "$SCRATCH" -c "$Q")

echo "[drill] columns: tenants|users|items|orders|payments|tables|rooms|migrations|public_tables"
echo "[drill] prod:     $PROD"
echo "[drill] restored: $REST"

if [ "$PROD" = "$REST" ]; then
  echo "[drill] PASS $(date -Is) — restored copy matches production on all counters"
else
  echo "[drill] FAIL $(date -Is) — MISMATCH between production and restored copy" >&2
  exit 1
fi
