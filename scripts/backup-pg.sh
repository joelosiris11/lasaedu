#!/usr/bin/env bash
# backup-pg.sh — Dump de PostgreSQL con retención. Correr por cron diario.
# Uso: PGHOST=127.0.0.1 PGDATABASE=lasaacademy PGUSER=lasaacademy BACKUP_DIR=/var/lasaacademy/backups ./backup-pg.sh
set -euo pipefail

DB="${PGDATABASE:-lasaacademy}"
DIR="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DIR"
OUT="$DIR/${DB}_${STAMP}.sql.gz"

echo "→ pg_dump $DB → $OUT"
pg_dump "$DB" | gzip -9 > "$OUT"
echo "   $(du -h "$OUT" | cut -f1)"

# retención
find "$DIR" -name "${DB}_*.sql.gz" -type f -mtime +"$KEEP_DAYS" -delete 2>/dev/null || true
echo "✅ backup listo. Retención: ${KEEP_DAYS} días."
# MinIO: aparte, con `mc mirror local/<bucket> <destino>` o snapshot del dir de datos.
