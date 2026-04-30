#!/usr/bin/env node
/**
 * Full Firebase backup — Firestore + Realtime Database + Auth users.
 *
 * Credentials (pick one):
 *   a) Put service-account.json at the repo root (gitignored) — auto-detected.
 *   b) Set GOOGLE_APPLICATION_CREDENTIALS to a service-account JSON path.
 *   c) gcloud auth application-default login  (ADC)
 *
 * Usage:
 *   npm run backup                            # everything (Firestore + RTDB + Auth)
 *   npm run backup -- --yes                   # skip confirmation
 *   npm run backup -- --only users,courses    # only these Firestore collections
 *   npm run backup -- --no-firestore          # skip Firestore
 *   npm run backup -- --no-rtdb               # skip Realtime Database
 *   npm run backup -- --no-auth               # skip Firebase Auth users
 *   npm run backup -- --project lasaedurd     # force a project id
 *   npm run backup -- --db-url https://...    # custom Realtime DB URL
 *   npm run backup -- --out ./my-backups      # custom output root
 *
 * Output:
 *   backups/
 *     YYYY-MM-DD_HHmmss_<projectId>/
 *       _meta.json                   // projectId, timestamp, counts
 *       firestore/<collection>.json  // one file per root collection
 *       rtdb.json                    // full RTDB tree
 *       auth-users.json              // Firebase Auth users (no passwords)
 *
 * Safety: read-only — cannot corrupt data. Confirms projectId before running.
 */

import admin from 'firebase-admin';
import { mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import path from 'node:path';

// ─── CLI parsing ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const flagValue = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const SKIP_CONFIRM   = flag('--yes') || flag('-y');
const ONLY           = flagValue('--only')?.split(',').map(s => s.trim()).filter(Boolean);
const SKIP_AUTH      = flag('--no-auth');
const SKIP_FIRESTORE = flag('--no-firestore');
const SKIP_RTDB      = flag('--no-rtdb');
const OUT_ROOT       = flagValue('--out') ?? './backups';
const PROJECT_ARG    = flagValue('--project');
const DB_URL_ARG     = flagValue('--db-url');
// Backwards-compat alias of earlier version:
const WITH_AUTH_FLAG = flag('--with-auth'); // no-op; auth is now default

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

/**
 * Resolve project + credentials. Order:
 *   1. --project <id> flag
 *   2. $GOOGLE_APPLICATION_CREDENTIALS (if file exists)
 *   3. ./service-account.json at repo root (if exists)
 *   4. ./service-account*.json globbed at repo root
 *   5. gcloud Application Default Credentials
 * Returns { projectId, serviceAccount, credentialSource, databaseURL }.
 */
async function resolveAuth() {
  let projectId = PROJECT_ARG || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
  let serviceAccount = null;
  let credentialSource = 'application-default (gcloud)';

  // Candidate service-account paths to check automatically.
  const candidates = [];
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    candidates.push(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  }
  candidates.push('./service-account.json');

  // Also glob for any service-account*.json (covers service-account-prod.json etc.)
  try {
    const { readdir: rd } = await import('node:fs/promises');
    const files = await rd('.');
    for (const f of files) {
      if (/^service-account.*\.json$/.test(f) && !candidates.includes('./' + f)) {
        candidates.push('./' + f);
      }
    }
  } catch { /* ignore */ }

  for (const candidate of candidates) {
    if (await exists(candidate)) {
      try {
        const parsed = JSON.parse(await readFile(candidate, 'utf8'));
        if (parsed.type === 'service_account' && parsed.private_key) {
          serviceAccount = parsed;
          if (!projectId) projectId = parsed.project_id;
          credentialSource = `service-account (${candidate})`;
          break;
        }
      } catch { /* not valid JSON or not a service account — skip */ }
    }
  }

  // If user set GOOGLE_APPLICATION_CREDENTIALS but it pointed to a missing file
  // and we did NOT find any alternate account, guide them.
  if (
    !serviceAccount &&
    process.env.GOOGLE_APPLICATION_CREDENTIALS &&
    !(await exists(process.env.GOOGLE_APPLICATION_CREDENTIALS))
  ) {
    console.error(`\n  ⚠  GOOGLE_APPLICATION_CREDENTIALS points to a missing file:\n     ${process.env.GOOGLE_APPLICATION_CREDENTIALS}\n`);
    console.error('  Fix:');
    console.error('    a) Descarga el service-account JSON de Firebase Console →');
    console.error('       Project Settings → Service Accounts → "Generate new private key".');
    console.error('       Guárdalo como service-account.json en la raíz del repo');
    console.error('       (está en .gitignore) y corre: npm run backup');
    console.error('    b) O usa ADC:');
    console.error('       unset GOOGLE_APPLICATION_CREDENTIALS');
    console.error('       gcloud auth application-default login --project=' + (projectId ?? '<projectId>'));
    console.error('       npm run backup\n');
    process.exit(1);
  }

  // Fallback: .firebaserc del repo local.
  if (!projectId) {
    const firebaseRc = path.resolve('./.firebaserc');
    if (await exists(firebaseRc)) {
      try {
        const parsed = JSON.parse(await readFile(firebaseRc, 'utf8'));
        projectId = parsed?.projects?.default;
      } catch { /* ignore */ }
    }
  }

  if (!projectId) {
    console.error('No pude detectar el projectId. Pasa --project <id> o setea GOOGLE_CLOUD_PROJECT.');
    process.exit(1);
  }

  const databaseURL = DB_URL_ARG ?? `https://${projectId}-default-rtdb.firebaseio.com`;

  return { projectId, serviceAccount, credentialSource, databaseURL };
}

function timestampForPath(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    date.getFullYear() +
    '-' + pad(date.getMonth() + 1) +
    '-' + pad(date.getDate()) +
    '_' + pad(date.getHours()) +
    pad(date.getMinutes()) +
    pad(date.getSeconds())
  );
}

async function confirm(message) {
  if (!stdin.isTTY) {
    console.error('Non-interactive environment. Pass --yes to confirm.');
    process.exit(1);
  }
  const rl = createInterface({ input: stdin, output: stdout });
  const answer = await rl.question(message + ' ');
  rl.close();
  return /^(y|yes|s|si|sí)$/i.test(answer.trim());
}

/** Firestore values → plain JSON-serializable structures. */
function serialize(value) {
  if (value === null || value === undefined) return value;
  if (value instanceof admin.firestore.Timestamp) {
    return { __type: 'timestamp', seconds: value.seconds, nanoseconds: value.nanoseconds };
  }
  if (value instanceof admin.firestore.GeoPoint) {
    return { __type: 'geopoint', latitude: value.latitude, longitude: value.longitude };
  }
  if (value instanceof admin.firestore.DocumentReference) {
    return { __type: 'ref', path: value.path };
  }
  if (Buffer.isBuffer(value)) {
    return { __type: 'bytes', base64: value.toString('base64') };
  }
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = serialize(v);
    return out;
  }
  return value;
}

async function dumpCollection(firestore, name) {
  const snap = await firestore.collection(name).get();
  const docs = snap.docs.map(d => ({
    __id: d.id,
    ...serialize(d.data()),
  }));
  return docs;
}

async function dumpRealtimeDB(rtdb) {
  const snapshot = await rtdb.ref('/').once('value');
  return snapshot.val(); // entire tree as plain JSON
}

async function dumpAuthUsers(auth) {
  const users = [];
  let pageToken;
  do {
    const res = await auth.listUsers(1000, pageToken);
    for (const u of res.users) {
      users.push({
        uid: u.uid,
        email: u.email,
        emailVerified: u.emailVerified,
        displayName: u.displayName,
        phoneNumber: u.phoneNumber,
        disabled: u.disabled,
        customClaims: u.customClaims ?? null,
        // passwordHash / salt — excluded; can't be re-imported anyway without
        // matching hash config, and they are sensitive.
        metadata: {
          creationTime: u.metadata.creationTime,
          lastSignInTime: u.metadata.lastSignInTime,
        },
        providerData: u.providerData.map(p => ({
          uid: p.uid, providerId: p.providerId, email: p.email, displayName: p.displayName,
        })),
      });
    }
    pageToken = res.pageToken;
  } while (pageToken);
  return users;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const { projectId, serviceAccount, credentialSource, databaseURL } = await resolveAuth();

  admin.initializeApp({
    credential: serviceAccount
      ? admin.credential.cert(serviceAccount)
      : admin.credential.applicationDefault(),
    projectId,
    databaseURL,
  });
  const firestore = admin.firestore();

  const ts = timestampForPath();
  const outDir = path.resolve(OUT_ROOT, `${ts}_${projectId}`);

  console.log('Firebase backup');
  console.log('  Project     : ' + projectId);
  console.log('  Credentials : ' + credentialSource);
  console.log('  RTDB URL    : ' + databaseURL);
  console.log('  Output      : ' + outDir);
  const includes = [];
  if (!SKIP_FIRESTORE) includes.push('Firestore' + (ONLY ? ` (only ${ONLY.join(',')})` : ''));
  if (!SKIP_RTDB)      includes.push('Realtime Database');
  if (!SKIP_AUTH)      includes.push('Auth users');
  console.log('  Includes    : ' + (includes.join(', ') || '(nothing)'));
  if (WITH_AUTH_FLAG) console.log('  Note: --with-auth is default now; no action needed.');

  if (!SKIP_CONFIRM) {
    const ok = await confirm(`Proceed with backup of project "${projectId}"? (y/N)`);
    if (!ok) { console.log('Aborted.'); process.exit(0); }
  }

  await mkdir(outDir, { recursive: true });

  // ── Firestore ──────────────────────────────────────────────────────────
  let firestoreNames = [];
  const firestoreCounts = {};
  if (!SKIP_FIRESTORE) {
    await mkdir(path.join(outDir, 'firestore'), { recursive: true });
    const allCollections = await firestore.listCollections();
    firestoreNames = allCollections.map(c => c.id).sort();
    if (ONLY) {
      const requested = new Set(ONLY);
      const filtered = firestoreNames.filter(n => requested.has(n));
      const missing = ONLY.filter(n => !filtered.includes(n));
      if (missing.length) console.warn('  Skipped (not found): ' + missing.join(', '));
      firestoreNames = filtered;
    }

    console.log('\nDumping Firestore collections:');
    for (const name of firestoreNames) {
      process.stdout.write(`  • ${name.padEnd(32)} `);
      try {
        const docs = await dumpCollection(firestore, name);
        await writeFile(
          path.join(outDir, 'firestore', `${name}.json`),
          JSON.stringify(docs, null, 2),
        );
        firestoreCounts[name] = docs.length;
        console.log(`${docs.length} docs`);
      } catch (err) {
        console.log(`ERROR — ${err?.message ?? err}`);
        firestoreCounts[name] = { error: err?.message ?? String(err) };
      }
    }
  }

  // ── Realtime Database ──────────────────────────────────────────────────
  let rtdbStats = null;
  if (!SKIP_RTDB) {
    console.log('\nDumping Realtime Database...');
    try {
      const tree = await dumpRealtimeDB(admin.database());
      await writeFile(path.join(outDir, 'rtdb.json'), JSON.stringify(tree, null, 2));
      const topKeys = tree && typeof tree === 'object' ? Object.keys(tree) : [];
      const perKey = Object.fromEntries(topKeys.map(k => {
        const v = tree[k];
        const count = v && typeof v === 'object' ? Object.keys(v).length : 1;
        return [k, count];
      }));
      rtdbStats = { topLevelKeys: topKeys.length, perKey };
      console.log(`  • ${topKeys.length} top-level key${topKeys.length === 1 ? '' : 's'}: ${topKeys.slice(0, 8).join(', ')}${topKeys.length > 8 ? '…' : ''}`);
    } catch (err) {
      console.log(`  ERROR — ${err?.message ?? err}`);
      rtdbStats = { error: err?.message ?? String(err) };
    }
  }

  // ── Firebase Auth ──────────────────────────────────────────────────────
  let authCount = null;
  if (!SKIP_AUTH) {
    console.log('\nDumping Firebase Auth users...');
    try {
      const users = await dumpAuthUsers(admin.auth());
      await writeFile(path.join(outDir, 'auth-users.json'), JSON.stringify(users, null, 2));
      authCount = users.length;
      console.log(`  • ${users.length} auth users (passwords NOT exported)`);
    } catch (err) {
      console.log(`  ERROR — ${err?.message ?? err}`);
      authCount = { error: err?.message ?? String(err) };
    }
  }

  // ── Meta ───────────────────────────────────────────────────────────────
  const meta = {
    projectId,
    databaseURL,
    timestamp: new Date().toISOString(),
    credentialSource,
    firestore: SKIP_FIRESTORE ? null : { collections: firestoreNames, counts: firestoreCounts },
    rtdb: rtdbStats,
    auth: authCount,
    tool: 'backup-firestore.mjs',
    version: 2,
  };
  await writeFile(path.join(outDir, '_meta.json'), JSON.stringify(meta, null, 2));

  const totalDocs = Object.values(firestoreCounts).reduce(
    (sum, v) => typeof v === 'number' ? sum + v : sum, 0,
  );
  console.log('\n✓ Backup complete');
  if (!SKIP_FIRESTORE) console.log(`  Firestore : ${firestoreNames.length} collections, ${totalDocs} docs`);
  if (!SKIP_RTDB && rtdbStats && !rtdbStats.error) console.log(`  RTDB      : ${rtdbStats.topLevelKeys} top-level keys`);
  if (!SKIP_AUTH && typeof authCount === 'number') console.log(`  Auth      : ${authCount} users`);
  console.log('  → ' + outDir);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
