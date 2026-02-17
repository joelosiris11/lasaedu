import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  type User as FirebaseUser
} from 'firebase/auth';
import { auth } from '@app/config/firebase';
import { firebaseDB } from '@shared/services/firebaseDataService';
import { storage } from '@shared/utils/storage';
import type { User, UserRole } from '@shared/types';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  role: UserRole;
}

export const authService = {
  /**
   * Login with email and password using Firebase Auth
   */
  async login(credentials: LoginCredentials): Promise<{ user: User; accessToken: string; refreshToken: string }> {
    // Sign in with Firebase Auth
    const userCredential = await signInWithEmailAndPassword(
      auth,
      credentials.email,
      credentials.password
    );

    // Get the ID token
    const accessToken = await userCredential.user.getIdToken();
    const refreshToken = userCredential.user.refreshToken;

    // Get user data from Realtime Database - try by Auth UID first, then email
    let dbUser = await firebaseDB.getUserById(userCredential.user.uid);
    if (!dbUser) {
      dbUser = await firebaseDB.getUserByEmail(credentials.email);
    }

    // If user doesn't exist in DB, create it (for backward compatibility)
    if (!dbUser) {
      const now = Date.now();
      dbUser = await firebaseDB.createUser({
        email: credentials.email,
        name: userCredential.user.displayName || credentials.email.split('@')[0],
        role: 'student',
        emailVerified: userCredential.user.emailVerified,
        loginAttempts: 0,
        profile: {},
        preferences: {
          language: 'es',
          timezone: 'America/Santo_Domingo',
          notifications: { email: true, push: true, sms: false, marketing: false },
          privacy: { showProfile: true, showProgress: true, showBadges: true }
        },
        createdAt: now,
        updatedAt: now,
        lastActive: now
      });
    }

    // Map DB user to User type
    const user: User = {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role as UserRole,
      emailVerified: dbUser.emailVerified || userCredential.user.emailVerified,
      loginAttempts: dbUser.loginAttempts || 0,
      profile: dbUser.profile || {},
      preferences: {
        theme: 'light',
        notifications: {
          email: dbUser.preferences?.notifications?.email ?? true,
          push: dbUser.preferences?.notifications?.push ?? true,
          inApp: true
        }
      },
      refreshTokens: {},
      createdAt: dbUser.createdAt,
      lastActive: Date.now()
    };

    // Update last active in database
    await firebaseDB.updateUser(dbUser.id, { lastActive: Date.now() });

    // Store in local storage for persistence
    storage.setToken(accessToken);
    storage.setRefreshToken(refreshToken);
    storage.setUser(user);

    return { user, accessToken, refreshToken };
  },

  /**
   * Register a new user with Firebase Auth and create DB record
   */
  async register(data: RegisterData): Promise<{ user: User; accessToken: string; refreshToken: string }> {
    // Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      data.email,
      data.password
    );

    // Get tokens
    const accessToken = await userCredential.user.getIdToken();
    const refreshToken = userCredential.user.refreshToken;

    // Create user in Realtime Database
    const now = Date.now();
    const dbUser = await firebaseDB.createUser({
      email: data.email,
      name: data.name,
      role: data.role,
      emailVerified: false,
      loginAttempts: 0,
      profile: {},
      preferences: {
        language: 'es',
        timezone: 'America/Santo_Domingo',
        notifications: { email: true, push: true, sms: false, marketing: false },
        privacy: { showProfile: true, showProgress: true, showBadges: true }
      },
      createdAt: now,
      updatedAt: now,
      lastActive: now
    });

    // Map to User type
    const user: User = {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role as UserRole,
      emailVerified: false,
      loginAttempts: 0,
      profile: {},
      preferences: {
        theme: 'light',
        notifications: { email: true, push: true, inApp: true }
      },
      refreshTokens: {},
      createdAt: dbUser.createdAt,
      lastActive: Date.now()
    };

    // Store in local storage
    storage.setToken(accessToken);
    storage.setRefreshToken(refreshToken);
    storage.setUser(user);

    return { user, accessToken, refreshToken };
  },

  /**
   * Logout the current user
   */
  async logout(): Promise<void> {
    await signOut(auth);
    storage.clear();
  },

  /**
   * Send password reset email
   */
  async resetPassword(email: string): Promise<void> {
    await sendPasswordResetEmail(auth, email);
  },

  /**
   * Refresh the access token
   */
  async refreshToken(): Promise<string> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('No user logged in');
    }

    const newToken = await currentUser.getIdToken(true);
    storage.setToken(newToken);
    return newToken;
  },

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChanged(callback: (user: FirebaseUser | null) => void): () => void {
    return onAuthStateChanged(auth, callback);
  },

  /**
   * Get the current Firebase user
   */
  getCurrentUser(): FirebaseUser | null {
    return auth.currentUser;
  }
};
