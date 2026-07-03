// authService contra el backend self-host (/auth, JWT). Misma interfaz que la
// versión Firebase para que authStore no cambie. onAuthStateChanged se emula
// con un "usuario" mínimo compatible (email, emailVerified, getIdToken).
import { apiFetch, tokenStore } from '@shared/services/apiClient';
import { storage } from '@shared/utils/storage';
import type { User, UserRole } from '@shared/types';
import type { LoginCredentials, RegisterData } from './authService';

function mapUser(u: any): User {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role as UserRole,
    emailVerified: !!u.emailVerified,
    loginAttempts: u.loginAttempts || 0,
    profile: u.profile || {},
    preferences: {
      theme: 'light',
      notifications: {
        email: u.preferences?.notifications?.email ?? true,
        push: u.preferences?.notifications?.push ?? true,
        inApp: true,
      },
    },
    refreshTokens: {},
    supervisorScope: u.supervisorScope,
    createdAt: u.createdAt,
    lastActive: Date.now(),
  };
}

function pseudoFirebaseUser() {
  if (!tokenStore.access) return null;
  const stored = storage.getUser?.() as User | null;
  return {
    uid: stored?.id || '',
    email: stored?.email || '',
    emailVerified: stored?.emailVerified ?? true,
    displayName: stored?.name || '',
    refreshToken: tokenStore.refresh,
    getIdToken: async () => tokenStore.access,
  };
}

export const apiAuthService = {
  async login(credentials: LoginCredentials) {
    const res = await apiFetch<{ user: any; accessToken: string; refreshToken: string }>(
      '/auth/login',
      { method: 'POST', auth: false, body: credentials },
    );
    tokenStore.set(res.accessToken, res.refreshToken);
    const user = mapUser(res.user);
    storage.setToken?.(res.accessToken);
    storage.setRefreshToken?.(res.refreshToken);
    storage.setUser?.(user);
    return {
      user,
      accessToken: res.accessToken,
      refreshToken: res.refreshToken,
      mustChangePassword: !!res.user.mustChangePassword,
    };
  },

  async register(_data: RegisterData): Promise<{ user: User; accessToken: string; refreshToken: string }> {
    throw new Error('El registro se hace desde el panel de administración.');
  },

  async changeOwnCredential(newValue: string): Promise<void> {
    await apiFetch('/auth/change-password', { method: 'POST', body: { newPassword: newValue } });
  },

  async logout(): Promise<void> {
    try { await apiFetch('/auth/logout', { method: 'POST', auth: false, body: { refreshToken: tokenStore.refresh } }); }
    finally { tokenStore.clear(); storage.clear(); }
  },

  async resetPassword(email: string): Promise<void> {
    await apiFetch('/auth/reset', { method: 'POST', auth: false, body: { email } });
  },

  async refreshToken(): Promise<string> {
    const res = await apiFetch<{ accessToken: string }>('/auth/refresh', {
      method: 'POST', auth: false, body: { refreshToken: tokenStore.refresh },
    });
    tokenStore.set(res.accessToken);
    storage.setToken?.(res.accessToken);
    return res.accessToken;
  },

  onAuthStateChanged(callback: (user: any | null) => void): () => void {
    // Sin listener real: resolvemos el estado persistido una vez.
    Promise.resolve().then(() => callback(pseudoFirebaseUser()));
    return () => {};
  },

  getCurrentUser(): any | null {
    return pseudoFirebaseUser();
  },
};
