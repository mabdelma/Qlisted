#!/usr/bin/env bash
# ─── Qlisted uploads backup — menu/room images ───────────────────────────────
# Install: copy to /usr/local/bin/qlisted-uploads-backup.sh (chmod +x), cron:
#   45 3 * * * /usr/local/bin/qlisted-uploads-backup.sh >> /var/log/qlisted-uploads-backup.log 2>&1
# Restore: docker run --rm -v qcart-prod_qcart_uploads:/d -v <dir>:/b alpine:3 \
#            sh -c 'tar xzf /b/<file.tar.gz> -C /d'
#
# The previous version of this script could never have worked:
#   tar czf "$F" -C /opt/qcart/uploads/
# has no path operand after -C, so tar had nothing to archive, and uploads do
# not live on the host filesystem at all — they are in the Docker named volume
# qcart_uploads, mounted at /app/uploads inside the API container. It was also
# never installed or cronned, so guest-visible images had NO backup of any kind.
set -euo pipefail

VOLUME=${QLISTED_UPLOADS_VOLUME:-qcart-prod_qcart_uploads}
DEST=${QLISTED_UPLOADS_BACKUP_DIR:-/var/backups/qlisted-uploads}
RETAIN_DAYS=${RETAIN_DAYS:-30}

mkdir -p "$DEST"
STAMP=$(date +%Y%m%d-%H%M%S)
FILE="$DEST/qlisted-uploads-$STAMP.tar.gz"

# Archive the volume contents via a throwaway container; "." so an empty volume
# still produces a valid (if tiny) archive instead of failing the whole run.
docker run --rm -v "$VOLUME":/data:ro -v "$DEST":/backup alpine:3 \
  tar czf "/backup/$(basename "$FILE")" -C /data .

# Integrity: the gzip stream must be valid and the archive must be listable.
if ! gzip -t "$FILE" 2>/dev/null; then
  echo "[qlisted-uploads] FAILED gzip integrity: $FILE" >&2
  rm -f "$FILE"; exit 1
fi
COUNT=$(tar tzf "$FILE" 2>/dev/null | grep -vc '/$' || true)
SIZE=$(stat -c%s "$FILE")

find "$DEST" -name 'qlisted-uploads-*.tar.gz' -mtime +"$RETAIN_DAYS" -delete
echo "[qlisted-uploads] ok $(date -Is) $FILE ($SIZE bytes, $COUNT files)"
