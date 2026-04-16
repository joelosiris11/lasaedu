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
 * - Production: sends a password-reset email via Firebase Auth.
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

  // Production: can't change another user's password from client SDK.
  // Send a password-reset email instead.
  const { sendPasswordResetEmail } = await import('firebase/auth');
  await sendPasswordResetEmail(auth, email);
  return { method: 'email' };
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
  // 1. Create Firebase Auth user (UID is auto-linked via email on login)
  await createAuthUser(data.email, data.password);

  // 2. Create DB record
  const now = Date.now();
  const dbUser = await userService.create({
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
