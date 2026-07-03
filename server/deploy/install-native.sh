#!/usr/bin/env bash
# install-native.sh — Provisiona el stack self-host de LasaEdu en tecoserver
# (NATIVO, sin Docker). Idempotente donde se puede. Correr como usuario con sudo.
# ⚠️ tecoserver es Docker COMPARTIDO con SusRoot: esto NO toca Docker ni nada ajeno.
set -euo pipefail

DOMAIN="${DOMAIN:-lasaacademy.cloudteco.com}"
PG_DB="${PG_DB:-lasaacademy}"
PG_USER="${PG_USER:-lasaacademy}"
MINIO_DATA="${MINIO_DATA:-/var/lasaacademy/minio}"
REPO_DIR="${REPO_DIR:-$HOME/lasaedu}"

echo "== 1. Paquetes del sistema (Postgres, Chromium, herramientas) =="
sudo apt-get update -y
sudo apt-get install -y postgresql postgresql-contrib chromium curl ca-certificates
# En algunas distros el binario es 'chromium-browser'
command -v chromium >/dev/null || sudo ln -sf "$(command -v chromium-browser)" /usr/local/bin/chromium || true

echo "== 2. PostgreSQL: base + usuario =="
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='$PG_USER'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER $PG_USER WITH PASSWORD '${PG_PASSWORD:?define PG_PASSWORD}';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='$PG_DB'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE $PG_DB OWNER $PG_USER;"
echo "   cargando esquema…"
sudo -u postgres psql -d "$PG_DB" -f "$REPO_DIR/server/db/schema.sql"

echo "== 3. MinIO (binario + servicio systemd) =="
if ! command -v minio >/dev/null; then
  ARCH=$(uname -m); case "$ARCH" in x86_64) A=amd64;; aarch64|arm64) A=arm64;; *) A=amd64;; esac
  sudo curl -sSL "https://dl.min.io/server/minio/release/linux-$A/minio" -o /usr/local/bin/minio
  sudo chmod +x /usr/local/bin/minio
fi
sudo mkdir -p "$MINIO_DATA"
sudo id lasaedu >/dev/null 2>&1 || sudo useradd -r -s /usr/sbin/nologin lasaedu || true
sudo chown -R lasaedu:lasaedu "$MINIO_DATA"
sudo cp "$REPO_DIR/server/deploy/minio.service" /etc/systemd/system/minio.service
echo "   → edita /etc/systemd/system/minio.service con MINIO_ROOT_USER/PASSWORD reales, luego:"
echo "     sudo systemctl daemon-reload && sudo systemctl enable --now minio"

echo "== 4. Node deps del backend =="
cd "$REPO_DIR/server" && npm ci --omit=dev

echo "== 5. Migración de datos (con el SA de lasaedurd) =="
echo "   Firestore→PG:  GOOGLE_APPLICATION_CREDENTIALS=/ruta/sa.json PGDATABASE=$PG_DB node $REPO_DIR/scripts/migrate-firestore-to-pg.mjs"
echo "   Auth (scrypt): firebase auth:export users.json --project lasaedurd && node $REPO_DIR/scripts/import-auth.mjs users.json"
echo "   Archivos→MinIO: node $REPO_DIR/scripts/migrate-files-to-minio.mjs  (tras copiar el disco del file-server)"

echo "== 6. Backend con pm2 =="
echo "   pm2 start $REPO_DIR/server/api.mjs --name lasaacademy-api && pm2 save"

echo "== 7. Frontend estático + reverse proxy =="
echo "   Build:  VITE_BACKEND=api VITE_API_URL=https://$DOMAIN pnpm build   (→ dist/)"
echo "   Servir dist/ por Apache/Cloudflare y proxear /api /auth /files /ai → 127.0.0.1:3020"

echo ""
echo "✅ Base lista. Completa los pasos manuales marcados (env, systemctl, migración, proxy)."
