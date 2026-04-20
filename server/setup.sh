#!/usr/bin/env bash
# One-time setup for the file server on a fresh VPS.
# Run once after `git clone` and after you have filled in `.env`.
#
# Assumes: Node 20+ and npm are already installed.

set -euo pipefail

cd "$(dirname "$0")"

echo "==> Verifying .env"
if [[ ! -f .env ]]; then
  echo "ERROR: server/.env not found. Copy .env.example to .env and fill it in."
  exit 1
fi

echo "==> Installing dependencies"
npm ci --omit=dev

echo "==> Installing pm2 globally (if missing)"
if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi

echo "==> Creating logs directory"
mkdir -p logs

echo "==> Starting app with pm2"
pm2 start ecosystem.config.cjs --env production --update-env

echo "==> Saving pm2 process list (so it comes back after reboot)"
pm2 save

echo
echo "Done. Next steps:"
echo "  1. Run: pm2 startup   (and follow the command it prints to enable boot-start)"
echo "  2. Point your reverse proxy (nginx/caddy) at http://127.0.0.1:\$PORT"
echo "  3. Test: curl http://127.0.0.1:\$(grep '^PORT=' .env | cut -d= -f2)/health"
