# lasaedu file server

Express + multer server that stores uploads on the VPS disk and verifies
Firebase Auth tokens from the frontend. Fronted by nginx/caddy with HTTPS.

## Setup (once)

On the VPS:

```bash
# 1. Clone the repo (or just this folder) and cd in
git clone <repo-url> lasaedu
cd lasaedu/server

# 2. Fill in config
cp .env.example .env
nano .env   # set UPLOAD_DIR, BASE_URL, ALLOWED_ORIGINS, GOOGLE_APPLICATION_CREDENTIALS

# 3. Place the Firebase service-account JSON at the path you set in .env
#    (outside the repo, chmod 600)

# 4. Create the upload directory and take ownership
sudo mkdir -p /var/lasaedu/uploads
sudo chown -R $USER:$USER /var/lasaedu/uploads

# 5. Run the setup script (installs deps, starts pm2, saves state)
./setup.sh

# 6. Enable boot-start (one-time; pm2 prints the exact command to copy)
pm2 startup
# then:
pm2 save
```

Put nginx/caddy in front with HTTPS pointing at `http://127.0.0.1:$PORT`.

## Deploy updates

From the VPS, after pushing changes from your laptop:

```bash
cd lasaedu/server
npm run deploy
```

That runs: `git pull` → `npm ci --omit=dev` → `pm2 reload` → `pm2 save`.

## Useful commands

```bash
npm run pm2:logs     # tail logs
npm run pm2:status   # show process state
npm run pm2:reload   # zero-downtime reload
npm run pm2:stop     # stop the process
```

## Health check

```bash
curl http://127.0.0.1:3010/health
```

Should return `{"status":"ok","timestamp":...}`.
