#!/usr/bin/env bash
# ─── Qlisted backup + disk health check ──────────────────────────────────────
# Answers three questions that otherwise fail in total silence:
#   1. Is the root disk about to fill? (shared host, ~10 apps, 174 containers —
#      a full disk takes down every app on the box, not just Qlisted)
#   2. Is the nightly DB dump fresh, non-trivial and a valid gzip stream?
#   3. Is the nightly uploads archive fresh and valid? (menu/room images had NO
#      backup at all until 2026-10-10 — the script existed but was broken and
#      had never been installed or cronned)
#
# Exits non-zero with a loud message so cron, or an external monitor, catches
# it. Follows the convention already used by the other apps on this host.
#
# NOTE: there is no mail transport and no alert sink on this host, so today
# this only writes to its log. Until an uptime/alert service is wired up
# (MISSING-PHASES.md G-07), a human still has to read the log. The exit code is
# what makes that wiring a one-liner later.
#
# Install: /usr/local/bin/qlisted-backup-health.sh (chmod +x), cron daily after
# both backup jobs:
#   30 4 * * * /usr/local/bin/qlisted-backup-health.sh >> /var/log/qlisted-backup-health.log 2>&1
set -uo pipefail

DB_DIR=${QLISTED_BACKUP_DIR:-/var/backups/qlisted}
UP_DIR=${QLISTED_UPLOADS_BACKUP_DIR:-/var/backups/qlisted-uploads}
MAX_AGE_HOURS=${MAX_AGE_HOURS:-48}
DB_MIN_BYTES=${DB_MIN_BYTES:-8000}
UP_MIN_BYTES=${UP_MIN_BYTES:-100}
DISK_WARN_PCT=${DISK_WARN_PCT:-85}
DISK_CRIT_PCT=${DISK_CRIT_PCT:-92}

PROBLEMS=0
note() { echo "  $*"; }
bad()  { echo "FAIL: $*"; PROBLEMS=$((PROBLEMS+1)); }

echo "[health] $(date -Is)"

# ── 1. Disk ──────────────────────────────────────────────────────────────────
PCT=$(df --output=pcent / | tail -1 | tr -dc '0-9')
AVAIL=$(df -h --output=avail / | tail -1 | tr -d ' ')
note "root disk ${PCT}% used, ${AVAIL} free"
if   [ "$PCT" -ge "$DISK_CRIT_PCT" ]; then bad "root disk ${PCT}% >= ${DISK_CRIT_PCT}% CRITICAL — a full disk takes down every app on this host"
elif [ "$PCT" -ge "$DISK_WARN_PCT" ]; then bad "root disk ${PCT}% >= ${DISK_WARN_PCT}% — reclaim space now (docker system prune, old backups)"
fi

# ── 2 & 3. Backup freshness and validity ─────────────────────────────────────
check_backup() {
  local label=$1 dir=$2 glob=$3 minb=$4 testcmd=$5
  if [ ! -d "$dir" ]; then bad "$label: $dir does not exist"; return; fi
  local newest
  newest=$(ls -t "$dir"/$glob 2>/dev/null | head -1)
  if [ -z "$newest" ]; then bad "$label: no archives in $dir"; return; fi
  local age_h size
  age_h=$(( ( $(date +%s) - $(stat -c %Y "$newest") ) / 3600 ))
  size=$(stat -c %s "$newest")
  note "$label: $(basename "$newest") ${age_h}h old ${size} bytes"
  [ "$age_h" -le "$MAX_AGE_HOURS" ] || bad "$label is ${age_h}h old (limit ${MAX_AGE_HOURS}h) — the cron may be dead"
  [ "$size" -ge "$minb" ] || bad "$label is only ${size} bytes (min ${minb}) — probably truncated"
  $testcmd "$newest" >/dev/null 2>&1 || bad "$label is not a valid archive: $(basename "$newest")"
}

check_backup "db-backup"      "$DB_DIR" "qlisted-*.sql.gz"         "$DB_MIN_BYTES" "gzip -t"
check_backup "uploads-backup" "$UP_DIR" "qlisted-uploads-*.tar.gz" "$UP_MIN_BYTES" "gzip -t"

# ── Off-site reminder (not a failure, but it is the remaining single point) ───
command -v rclone >/dev/null 2>&1 || note "note: rclone absent — backups live on the SAME disk as the database; a disk failure loses both"

if [ "$PROBLEMS" -eq 0 ]; then
  echo "[health] OK — disk and both backup jobs healthy"
  exit 0
fi
echo "[health] $PROBLEMS PROBLEM(S) — see FAIL lines above" >&2
exit 1
