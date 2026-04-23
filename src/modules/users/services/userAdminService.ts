/**
 * Admin-level user operations: create Firebase Auth users and reset passwords
 * without logging out the current admin session.
 */
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  connectAuthEmulator,
} from 'firebase/auth';
import { auth, isUsingEmulator } from '@app/config/firebase';
import { userService } from '@shared/services/dataService';
import type { DBUser } from '@shared/services/firebaseDataService';

// Base URL for the backend (same server that handles file uploads). Empty
// string → use the current origin so Vite's proxy forwards `/admin/*` to the
// dev file-server. Set VITE_FILE_SERVER_URL in production.
const API_BASE_URL = import.meta.env.VITE_FILE_SERVER_URL ?? '';

// Reuse the same config as the main app
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'demo-project.firebaseapp.com',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'http://127.0.0.1:9000/?ns=demo-project-default-rtdb',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo-project',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'demo-project.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '123456789',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:123456789:web:abc123',
};

/**
 * Create a Firebase Auth user using a temporary secondary app
 * so the current admin session is not affected.
 */
export async function createAuthUser(email: string, password: string): Promise<string> {
  const tempApp = initializeApp(firebaseConfig, `admin-create-${Date.now()}`);
  const tempAuth = getAuth(tempApp);

  if (isUsingEmulator) {
    connectAuthEmulator(tempAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
  }

  try {
    const cred = await createUserWithEmailAndPassword(tempAuth, email, password);
    return cred.user.uid;
  } finally {
    await tempAuth.signOut();
    await deleteApp(tempApp);
  }
}

/**
 * Reset a user's password.
 * - Emulator: uses the Identity Toolkit REST API to update directly.
 * - Production: calls the backend `/admin/reset-password` endpoint, which uses
 *   the Firebase Admin SDK to change the password instantly — no email
 *   round-trip so the new credential works right away.
 *
 * Sends the email to the backend so it can resolve the Firebase Auth UID
 * server-side. Legacy users have a Firestore doc id that does not match
 * their Auth UID, which previously caused `auth/user-not-found` (HTTP 404).
 */
export async function resetAuthPassword(
  uid: string,
  email: string,
  newPassword: string,
): Promise<{ method: 'direct' | 'email' }> {
  if (isUsingEmulator) {
    // Emulator REST API lets us update any user's password directly
    const apiKey = import.meta.env.VITE_FIREBASE_API_KEY || 'fake-api-key';
    const resp = await fetch(
      `http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:update?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ localId: uid, password: newPassword }),
      },
    );
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Error actualizando contraseña en emulator');
    }
    return { method: 'direct' };
  }

  // Production: call the backend, which verifies the caller is admin and uses
  // Firebase Admin SDK to change the password. The new password is usable
  // immediately.
  const current = auth.currentUser;
  if (!current) {
    throw new Error('Debes iniciar sesión como admin para cambiar contraseñas.');
  }
  const token = await current.getIdToken();
  const resp = await fetch(`${API_BASE_URL}/admin/reset-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ uid, email, password: newPassword }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `Error ${resp.status} al resetear la contraseña`);
  }
  return { method: 'direct' };
}

/**
 * Full flow: create a new user (Auth + DB) from the admin panel.
 * Returns the created DBUser.
 */
export async function adminCreateUser(data: {
  firstName: string;
  lastName: string;
  email: string;
  role: DBUser['role'];
  phone?: string;
  address?: string;
  birthDate?: string;
  password: string;
}): Promise<DBUser> {
  // 1. Create the Firebase Auth user and capture its UID so we can mirror it
  //    as the Firestore doc id. Matching ids is required for the users/{uid}
  //    security rule (`request.auth.uid == uid`) to let the user later clear
  //    their own `mustChangePassword` flag after the first login.
  const authUid = await createAuthUser(data.email, data.password);

  // 2. Create DB record keyed by the Auth UID.
  const now = Date.now();
  const dbUser = await userService.createWithId(authUid, {
    email: data.email,
    firstName: data.firstName,
    lastName: data.lastName,
    name: `${data.firstName} ${data.lastName}`.trim(),
    role: data.role,
    emailVerified: false,
    loginAttempts: 0,
    mustChangePassword: true,
    profile: {
      phone: data.phone || '',
      address: data.address || '',
      birthDate: data.birthDate || '',
    },
    preferences: {
      language: 'es',
      timezone: 'America/Santo_Domingo',
      notifications: { email: true, push: true, sms: false, marketing: false },
      privacy: { showProfile: true, showProgress: true, showBadges: true },
    },
    createdAt: now,
    updatedAt: now,
    lastActive: 0,
  } as Omit<DBUser, 'id'>);

  return dbUser;
}

/**
 * Admin resets a user's password and flags them for change on next login.
 */
export async function adminResetPassword(
  user: DBUser,
  newPassword: string,
): Promise<{ method: 'direct' | 'email' }> {
  const result = await resetAuthPassword(user.id, user.email, newPassword);

  // Flag user to change password on next login
  await userService.update(user.id, { mustChangePassword: true });

  return result;
}
