#!/usr/bin/env node
/**
 * Seed production admins using the Firebase Admin SDK.
 *
 * Required env:
 *   GOOGLE_APPLICATION_CREDENTIALS   path to a service-account JSON for the
 *                                    target Firebase project.
 *   ADMIN_ROSARIO_PASSWORD           password for a.rosario@t-ecogroup.net
 *   ADMIN_LORENZO_PASSWORD           password for laura.lorenzo@t-ecogroup.net
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *   ADMIN_ROSARIO_PASSWORD=... \
 *   ADMIN_LORENZO_PASSWORD=... \
 *   npm run seed
 *
 * The script is idempotent: re-running it resets each admin's password and
 * refreshes the Firestore profile.
 */

import admin from 'firebase-admin';

const ADMINS = [
  {
    email: 'a.rosario@t-ecogroup.net',
    passwordEnv: 'ADMIN_ROSARIO_PASSWORD',
    name: 'A. Rosario',
  },
  {
    email: 'laura.lorenzo@t-ecogroup.net',
    passwordEnv: 'ADMIN_LORENZO_PASSWORD',
    name: 'Laura Lorenzo',
  },
];

function assertEnv() {
  const missing = [];
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) missing.push('GOOGLE_APPLICATION_CREDENTIALS');
  for (const a of ADMINS) {
    if (!process.env[a.passwordEnv]) missing.push(a.passwordEnv);
  }
  if (missing.length) {
    console.error(`Missing required env vars:\n  - ${missing.join('\n  - ')}`);
    process.exit(1);
  }
}

async function upsertAdmin(auth, firestore, record) {
  const { email, passwordEnv, name } = record;
  const secret = process.env[passwordEnv];

  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(email);
    await auth.updateUser(userRecord.uid, {
      password: secret,
      displayName: name,
      emailVerified: true,
      disabled: false,
    });
    console.log(`→ Updated ${email} (uid=${userRecord.uid}, password reset)`);
  } catch (err) {
    if (err?.code !== 'auth/user-not-found') throw err;
    userRecord = await auth.createUser({
      email,
      password: secret,
      displayName: name,
      emailVerified: true,
    });
    console.log(`✓ Created ${email} (uid=${userRecord.uid})`);
  }

  await auth.setCustomUserClaims(userRecord.uid, { role: 'admin' });

  const now = Date.now();
  const userDoc = firestore.collection('users').doc(userRecord.uid);
  const snapshot = await userDoc.get();
  const base = snapshot.exists ? snapshot.data() : {};

  await userDoc.set(
    {
      ...base,
      id: userRecord.uid,
      email,
      name,
      role: 'admin',
      status: 'active',
      emailVerified: true,
      createdAt: base?.createdAt ?? now,
      updatedAt: now,
    },
    { merge: true }
  );

  console.log(`  • users/${userRecord.uid} upserted with role=admin`);
}

async function main() {
  assertEnv();

  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });

  const auth = admin.auth();
  const firestore = admin.firestore();

  console.log(`Seeding ${ADMINS.length} admin(s)...`);
  for (const record of ADMINS) {
    try {
      await upsertAdmin(auth, firestore, record);
    } catch (err) {
      console.error(`✗ Failed ${record.email}:`, err?.message ?? err);
      process.exitCode = 1;
    }
  }
  console.log('Done.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
