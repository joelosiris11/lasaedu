#!/usr/bin/env node
/**
 * Restore Firestore from a local backup produced by backup-firestore.mjs.
 *
 * ⚠  WRITES to Firestore. Verify the target project BEFORE confirming.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     npm run restore -- --from ./backups/2026-04-23_150000_my-project
 *
 * Options:
 *   --from <path>          Backup directory produced by backup-firestore.mjs. REQUIRED.
 *   --only a,b,c           Restore only these collections.
 *   --dry-run              Print what would be restored; do not write.
 *   --mode merge|overwrite Default: merge. `overwrite` wipes the collection first.
 *   --yes                  Skip confirmation (CI only).
 *
 * Notes:
 *   - Document IDs are preserved from the backup.
 *   - Firestore Timestamp/GeoPoint/DocumentReference/Bytes are re-hydrated.
 *   - Firebase Auth users (_auth-users.json) are NOT restored automatically;
 *     use firebase-tools `auth:import` for that (passwords need the hash config).
 */

import admin from 'firebase-admin';
import { readFile, readdir } from 'node:fs/promises';
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

const FROM       = flagValue('--from');
const ONLY       = flagValue('--only')?.split(',').map(s => s.trim()).filter(Boolean);
const DRY_RUN    = flag('--dry-run');
const MODE       = (flagValue('--mode') ?? 'merge').toLowerCase();
const SKIP_CONFIRM = flag('--yes') || flag('-y');

if (!FROM) {
  console.error('Missing --from <backup-dir>. See --help or the script header.');
  process.exit(1);
}
if (!['merge', 'overwrite'].includes(MODE)) {
  console.error(`Invalid --mode "${MODE}". Use merge or overwrite.`);
  process.exit(1);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function assertEnv() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Missing GOOGLE_APPLICATION_CREDENTIALS.');
    process.exit(1);
  }
}

function getProjectId() {
  return (
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    admin.app().options.projectId ||
    'unknown-project'
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

/** Reverse of serialize() from backup-firestore.mjs. */
function deserialize(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(deserialize);
  if (typeof value === 'object') {
    if (value.__type === 'timestamp') {
      return new admin.firestore.Timestamp(value.seconds, value.nanoseconds);
    }
    if (value.__type === 'geopoint') {
      return new admin.firestore.GeoPoint(value.latitude, value.longitude);
    }
    if (value.__type === 'ref') {
      // Re-hydrates as a ref on the target project — same path.
      return admin.firestore().doc(value.path);
    }
    if (value.__type === 'bytes') {
      return Buffer.from(value.base64, 'base64');
    }
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = deserialize(v);
    return out;
  }
  return value;
}

async function loadMeta(dir) {
  const raw = await readFile(path.join(dir, '_meta.json'), 'utf8');
  return JSON.parse(raw);
}

async function listBackupCollections(dir) {
  const files = await readdir(dir);
  return files
    .filter(f => f.endsWith('.json') && !f.startsWith('_'))
    .map(f => f.replace(/\.json$/, ''))
    .sort();
}

/** Chunked batched writes — Firestore batches cap at 500 ops. */
async function writeDocs(firestore, collection, docs, mode) {
  if (mode === 'overwrite') {
    // Delete existing docs in chunks of 500 first.
    const existing = await firestore.collection(collection).listDocuments();
    for (let i = 0; i < existing.length; i += 500) {
      const batch = firestore.batch();
      existing.slice(i, i + 500).forEach(ref => batch.delete(ref));
      await batch.commit();
    }
  }

  let written = 0;
  for (let i = 0; i < docs.length; i += 500) {
    const batch = firestore.batch();
    for (const doc of docs.slice(i, i + 500)) {
      const { __id, ...rest } = doc;
      if (!__id) continue;
      const ref = firestore.collection(collection).doc(__id);
      batch.set(ref, deserialize(rest), { merge: mode === 'merge' });
    }
    await batch.commit();
    written += Math.min(500, docs.length - i);
  }
  return written;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  assertEnv();

  admin.initializeApp({ credential: admin.credential.applicationDefault() });
  const firestore = admin.firestore();
  const projectId = getProjectId();

  const dir = path.resolve(FROM);
  const meta = await loadMeta(dir).catch(() => null);
  const availableCollections = await listBackupCollections(dir);

  console.log('Firestore restore');
  console.log('  Target project : ' + projectId);
  console.log('  Backup dir     : ' + dir);
  if (meta?.projectId) {
    console.log('  Backup origin  : ' + meta.projectId);
    if (meta.projectId !== projectId) {
      console.log('  ⚠  Backup was taken from a DIFFERENT project.');
    }
  }
  console.log('  Mode           : ' + MODE + (MODE === 'overwrite' ? '  (⚠ destructive: deletes existing docs first)' : ''));
  console.log('  Dry run        : ' + (DRY_RUN ? 'yes' : 'no'));

  let toRestore = availableCollections;
  if (ONLY) {
    const requested = new Set(ONLY);
    toRestore = availableCollections.filter(n => requested.has(n));
    const missing = ONLY.filter(n => !toRestore.includes(n));
    if (missing.length) console.warn('  Skipped (not in backup): ' + missing.join(', '));
  }
  console.log('  Collections    : ' + toRestore.join(', '));

  if (toRestore.length === 0) {
    console.log('Nothing to restore.');
    return;
  }

  if (!SKIP_CONFIRM && !DRY_RUN) {
    const promptMsg = MODE === 'overwrite'
      ? `Overwrite ${toRestore.length} collection(s) in project "${projectId}"? Existing documents will be DELETED first. (y/N)`
      : `Merge ${toRestore.length} collection(s) into project "${projectId}"? Existing fields will be updated/added. (y/N)`;
    const ok = await confirm(promptMsg);
    if (!ok) { console.log('Aborted.'); process.exit(0); }
  }

  const results = {};
  for (const name of toRestore) {
    process.stdout.write(`  • ${name.padEnd(32)} `);
    try {
      const raw = await readFile(path.join(dir, `${name}.json`), 'utf8');
      const docs = JSON.parse(raw);
      if (DRY_RUN) {
        console.log(`${docs.length} docs (dry run — nothing written)`);
        results[name] = docs.length;
        continue;
      }
      const n = await writeDocs(firestore, name, docs, MODE);
      results[name] = n;
      console.log(`${n} docs restored`);
    } catch (err) {
      console.log(`ERROR — ${err?.message ?? err}`);
      results[name] = { error: err?.message ?? String(err) };
    }
  }

  const total = Object.values(results).reduce(
    (sum, v) => typeof v === 'number' ? sum + v : sum, 0,
  );
  console.log(`\n✓ ${DRY_RUN ? 'Dry run' : 'Restore'} complete — ${total} docs processed across ${toRestore.length} collections`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
