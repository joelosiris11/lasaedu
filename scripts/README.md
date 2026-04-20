# scripts

Operational scripts for lasaedu.

## seed-admins.mjs

Creates/updates the production admin users (`a.rosario@t-ecogroup.net` and
`laura.lorenzo@t-ecogroup.net`) in Firebase Auth + Firestore using the Admin
SDK. Idempotent — safe to re-run.

### Prerequisites

1. Download a service-account JSON from the target project:
   Firebase Console → Project settings → Service accounts → Generate new
   private key. Save it **outside the repo** (e.g. `~/keys/lasaedu-sa.json`).
2. Make sure `firebase-admin` is installed (`npm install`).

### Run

Passwords are read from env vars, not hardcoded in the repo. Export them
in your shell (or inline them in the command) alongside the credentials
path:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=~/keys/lasaedu-sa.json
export ADMIN_ROSARIO_PASSWORD='...'   # for a.rosario@t-ecogroup.net
export ADMIN_LORENZO_PASSWORD='...'   # for laura.lorenzo@t-ecogroup.net
npm run seed
```

The script will:
- upsert each admin in Firebase Auth (password reset on re-run),
- set the `{ role: 'admin' }` custom claim,
- write/merge `users/{uid}` in Firestore with `role: 'admin'`.

## seed-auth-users.mjs

Local **emulator only** seed — creates sample admin/teacher/student accounts
for the Firebase emulator suite. Never point this at production.
