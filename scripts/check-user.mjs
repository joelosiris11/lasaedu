#!/usr/bin/env node
/**
 * Diagnose a user's access state: checks Firebase Auth + the matching
 * Firestore users/{uid} doc + any mismatches that would break Firestore rules.
 *
 * Usage:
 *   npm run check-user -- a.rosario@t-ecogroup.net
 *
 *   # Force a different project:
 *   npm run check-user -- a.rosario@t-ecogroup.net --project lasaedurd
 *
 *   # Also fix: ensure users/{uid} exists with role=admin (asks for confirmation).
 *   npm run check-user -- a.rosario@t-ecogroup.net --fix-admin
 */

import admin from 'firebase-admin';
import { readFile, stat, readdir } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const flagValue = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const email = args.find(a => a.includes('@'));
const PROJECT_ARG = flagValue('--project');
const FIX_ADMIN   = flag('--fix-admin');

if (!email) {
  console.error('Usage: npm run check-user -- <email> [--project id] [--fix-admin]');
  process.exit(1);
}

async function exists(p) { try { await stat(p); return true; } catch { return false; } }

async function resolveAuth() {
  let projectId = PROJECT_ARG || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
  let serviceAccount = null;

  const candidates = [];
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) candidates.push(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  candidates.push('./service-account.json');
  try {
    for (const f of await readdir('.')) {
      if (/^service-account.*\.json$/.test(f) && !candidates.includes('./' + f)) candidates.push('./' + f);
    }
  } catch {}
  for (const c of candidates) {
    if (await exists(c)) {
      try {
        const parsed = JSON.parse(await readFile(c, 'utf8'));
        if (parsed.type === 'service_account' && parsed.private_key) {
          serviceAccount = parsed;
          if (!projectId) projectId = parsed.project_id;
          break;
        }
      } catch {}
    }
  }
  if (!projectId) {
    const rc = path.resolve('./.firebaserc');
    if (await exists(rc)) {
      try { projectId = JSON.parse(await readFile(rc, 'utf8'))?.projects?.default; } catch {}
    }
  }
  if (!projectId) { console.error('No projectId.'); process.exit(1); }
  return { projectId, serviceAccount };
}

async function confirm(msg) {
  if (!stdin.isTTY) { console.error('Non-interactive — pass confirmation another way.'); process.exit(1); }
  const rl = createInterface({ input: stdin, output: stdout });
  const a = await rl.question(msg + ' ');
  rl.close();
  return /^(y|yes|s|si|sí)$/i.test(a.trim());
}

async function main() {
  const { projectId, serviceAccount } = await resolveAuth();
  admin.initializeApp({
    credential: serviceAccount ? admin.credential.cert(serviceAccount) : admin.credential.applicationDefault(),
    projectId,
  });

  const auth = admin.auth();
  const firestore = admin.firestore();

  console.log(`Checking "${email}" on project "${projectId}"\n`);

  // 1. Firebase Auth record
  let authUser = null;
  try {
    authUser = await auth.getUserByEmail(email);
    console.log('✓ Firebase Auth');
    console.log('    uid            : ' + authUser.uid);
    console.log('    emailVerified  : ' + authUser.emailVerified);
    console.log('    disabled       : ' + authUser.disabled);
    console.log('    customClaims   : ' + JSON.stringify(authUser.customClaims ?? {}));
  } catch (err) {
    console.log('✗ Firebase Auth: no user with that email');
    console.log('  Error: ' + (err?.message ?? err));
    return;
  }

  // 2. Firestore users/{uid}
  const docRef = firestore.collection('users').doc(authUser.uid);
  const snap = await docRef.get();
  if (!snap.exists) {
    console.log('\n✗ Firestore users/' + authUser.uid + ' does not exist');
    console.log('  This is why Firestore rules deny everything — rules read');
    console.log('  this doc to resolve the role.');

    // Also check for stray docs with matching email but a different ID
    const orphans = await firestore.collection('users').where('email', '==', email).get();
    if (!orphans.empty) {
      console.log('\n  Found ' + orphans.size + ' user doc(s) with the same email but a different ID:');
      orphans.forEach(d => {
        console.log('    id=' + d.id + '  role=' + (d.data()?.role ?? '—'));
      });
      console.log('  → The UID in Auth does not match the document ID in Firestore.');
      console.log('  → Rules look up users/' + authUser.uid + ', which does not exist.');
    }
  } else {
    const data = snap.data();
    console.log('\n✓ Firestore users/' + authUser.uid);
    console.log('    name           : ' + (data.name ?? '—'));
    console.log('    role           : ' + (data.role ?? '—'));
    console.log('    departmentId   : ' + (data.departmentId ?? '—'));
    console.log('    positionId     : ' + (data.positionId ?? '—'));
    console.log('    emailVerified  : ' + (data.emailVerified ?? '—'));
  }

  // 3. Rule-eval simulation (best-effort)
  console.log('\n— Rule evaluation —');
  const roleFromDoc = snap.exists ? snap.data()?.role : null;
  const canRead = !!roleFromDoc;                      // any signed-in user can read most collections
  const canWriteOrg = roleFromDoc === 'admin' || roleFromDoc === 'supervisor';
  console.log('  isSignedIn()    : true');
  console.log('  userRole()      : ' + (roleFromDoc ?? '(rule throws — user doc missing)'));
  console.log('  Can read /departments, /positions, /users : ' + (canRead ? 'YES' : 'NO'));
  console.log('  Can write /departments, /positions        : ' + (canWriteOrg ? 'YES' : 'NO'));

  // 4. Optional fix
  if (FIX_ADMIN) {
    console.log('\n--fix-admin flag set.');
    if (snap.exists && roleFromDoc === 'admin') {
      console.log('Already admin. Nothing to do.');
      return;
    }
    const ok = await confirm(
      `Promote ${email} to role=admin in Firestore? This writes to users/${authUser.uid} on project "${projectId}". (y/N)`
    );
    if (!ok) { console.log('Aborted.'); return; }

    const now = Date.now();
    await docRef.set({
      id: authUser.uid,
      email,
      name: authUser.displayName ?? email.split('@')[0],
      role: 'admin',
      emailVerified: true,
      loginAttempts: 0,
      updatedAt: now,
      ...(snap.exists ? {} : { createdAt: now, lastActive: now, profile: {}, preferences: {} }),
    }, { merge: true });

    await auth.setCustomUserClaims(authUser.uid, { role: 'admin' });
    console.log('✓ users/' + authUser.uid + ' set role=admin (custom claim also set)');
    console.log('  Cerrá sesión y volvé a entrar para refrescar las claims en el cliente.');
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
