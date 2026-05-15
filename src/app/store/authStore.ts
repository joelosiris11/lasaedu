import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@app/config/firebase';
import type { User, AuthSession, UserRole } from '@shared/types';
import { authService } from '@modules/auth/services/authService';
import {
  bootstrapHubAuth,
  fetchFirebaseCustomToken,
  hubTokenStore,
  isLocalAuthMode,
  logoutFromHub,
  type HubSessionUser,
} from '@shared/services/hubAuth';

interface AuthState {
  user: User | null;
  session: AuthSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  initialized: boolean;
  mustChangePassword: boolean;
}

interface AuthActions {
  setUser: (user: User | null) => void;
  setSession: (session: AuthSession | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (data: { name: string; email: string; password: string; role: any }) => Promise<void>;
  refreshToken: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  dismissChangePassword: () => void;
  clearAuth: () => void;
  initializeAuth: () => () => void;
}

export type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        user: null,
        session: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        initialized: false,
        mustChangePassword: false,

        // Actions
        setUser: (user) => set({ user, isAuthenticated: !!user }),

        setSession: (session) => set({ session }),

        setLoading: (isLoading) => set({ isLoading }),

        setError: (error) => set({ error }),

        // Auth is normally delegated to lasaHUB, but when VITE_LOCAL_AUTH is
        // set lasaedu falls back to its own Firebase email/password flow.
        login: async (email: string, password: string) => {
          if (!isLocalAuthMode()) {
            logoutFromHub();
            return;
          }
          set({ isLoading: true, error: null });
          try {
            const { user, accessToken, refreshToken, mustChangePassword } =
              await authService.login({ email, password });
            const session: AuthSession = {
              sessionId: `sess_${Date.now()}`,
              userId: user.id,
              accessToken,
              refreshToken,
              expiresAt: Date.now() + 3600000,
              createdAt: Date.now(),
              lastUsed: Date.now(),
              userAgent: navigator.userAgent,
              ipAddress: '127.0.0.1',
            };
            set({
              user,
              session,
              isAuthenticated: true,
              isLoading: false,
              mustChangePassword: !!mustChangePassword,
            });
          } catch (error: any) {
            let msg = 'Error al iniciar sesión';
            if (error?.code === 'auth/user-not-found' || error?.code === 'auth/wrong-password' || error?.code === 'auth/invalid-credential') msg = 'Credenciales inválidas';
            else if (error?.code === 'auth/invalid-email') msg = 'Email inválido';
            else if (error?.code === 'auth/user-disabled') msg = 'Usuario deshabilitado';
            else if (error?.code === 'auth/too-many-requests') msg = 'Demasiados intentos. Intente más tarde.';
            else if (error?.message) msg = error.message;
            set({ error: msg, isLoading: false });
            throw new Error(msg);
          }
        },

        logout: async () => {
          set({ isLoading: true });
          set({
            user: null,
            session: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
            mustChangePassword: false,
          });
          if (isLocalAuthMode()) {
            try {
              await authService.logout();
            } catch (e) {
              console.error('local logout failed:', e);
            }
            return;
          }
          logoutFromHub();
        },

        register: async (data) => {
          if (!isLocalAuthMode()) {
            throw new Error('El registro se hace en LASA Hub, no en lasaedu.');
          }
          set({ isLoading: true, error: null });
          try {
            const { user, accessToken, refreshToken } = await authService.register({
              email: data.email,
              password: data.password,
              name: data.name,
              role: data.role,
            });
            const session: AuthSession = {
              sessionId: `sess_${Date.now()}`,
              userId: user.id,
              accessToken,
              refreshToken,
              expiresAt: Date.now() + 3600000,
              createdAt: Date.now(),
              lastUsed: Date.now(),
              userAgent: navigator.userAgent,
              ipAddress: '127.0.0.1',
            };
            set({ user, session, isAuthenticated: true, isLoading: false });
          } catch (error: any) {
            let msg = 'Error al registrarse';
            if (error?.code === 'auth/email-already-in-use') msg = 'El email ya está registrado';
            else if (error?.code === 'auth/invalid-email') msg = 'Email inválido';
            else if (error?.code === 'auth/weak-password') msg = 'La contraseña debe tener al menos 6 caracteres';
            else if (error?.message) msg = error.message;
            set({ error: msg, isLoading: false });
            throw new Error(msg);
          }
        },

        resetPassword: async (email: string) => {
          if (!isLocalAuthMode()) {
            logoutFromHub();
            return;
          }
          set({ isLoading: true, error: null });
          try {
            await authService.resetPassword(email);
            set({ isLoading: false });
          } catch (error: any) {
            let msg = 'Error al enviar email de recuperación';
            if (error?.code === 'auth/user-not-found') msg = 'No existe una cuenta con este email';
            else if (error?.code === 'auth/invalid-email') msg = 'Email inválido';
            else if (error?.message) msg = error.message;
            set({ error: msg, isLoading: false });
            throw new Error(msg);
          }
        },

        refreshToken: async () => {
          if (isLocalAuthMode()) {
            try {
              const newToken = await authService.refreshToken();
              const currentSession = get().session;
              if (currentSession) {
                set({ session: { ...currentSession, accessToken: newToken } });
              }
            } catch {
              await get().logout();
            }
            return;
          }
          set({
            user: null,
            session: null,
            isAuthenticated: false,
            error: null,
            mustChangePassword: false,
          });
          logoutFromHub();
        },

        dismissChangePassword: () => set({ mustChangePassword: false }),

        clearAuth: () => set({ user: null, session: null, isAuthenticated: false, error: null, mustChangePassword: false }),

        initializeAuth: () => {
          // Two paths:
          //   • Local mode (VITE_LOCAL_AUTH): subscribe to Firebase Auth state
          //     and hydrate the user from RTDB — same as before the hub
          //     migration.
          //   • Hub mode: bootstrap from lasaHUB and mint a Firebase Custom
          //     Token so Firestore/RTDB rules keep working.
          set({ isLoading: true });

          if (isLocalAuthMode()) {
            const unsubscribe = authService.onAuthStateChanged(async (firebaseUser) => {
              if (!firebaseUser) {
                const wasAuthenticated = get().isAuthenticated;
                set({
                  user: wasAuthenticated ? null : get().user,
                  session: wasAuthenticated ? null : get().session,
                  isAuthenticated: false,
                  isLoading: false,
                  initialized: true,
                });
                return;
              }
              try {
                const { firebaseDB } = await import('@shared/services/firebaseDataService');
                const dbUser = await firebaseDB.getUserByEmail(firebaseUser.email!);
                if (!dbUser) {
                  set({ isLoading: false, initialized: true });
                  return;
                }
                const user: User = {
                  id: dbUser.id,
                  email: dbUser.email,
                  name: dbUser.name,
                  role: dbUser.role as UserRole,
                  emailVerified: dbUser.emailVerified || firebaseUser.emailVerified,
                  loginAttempts: dbUser.loginAttempts || 0,
                  profile: dbUser.profile || {},
                  preferences: {
                    theme: 'light',
                    notifications: {
                      email: dbUser.preferences?.notifications?.email ?? true,
                      push: dbUser.preferences?.notifications?.push ?? true,
                      inApp: true,
                    },
                  } as any,
                  refreshTokens: {},
                  supervisorScope: dbUser.supervisorScope,
                  createdAt: dbUser.createdAt,
                  lastActive: Date.now(),
                };
                const accessToken = await firebaseUser.getIdToken();
                const session: AuthSession = {
                  sessionId: `sess_${Date.now()}`,
                  userId: user.id,
                  accessToken,
                  refreshToken: firebaseUser.refreshToken,
                  expiresAt: Date.now() + 3600000,
                  createdAt: Date.now(),
                  lastUsed: Date.now(),
                  userAgent: navigator.userAgent,
                  ipAddress: '127.0.0.1',
                };
                set({
                  user,
                  session,
                  isAuthenticated: true,
                  isLoading: false,
                  initialized: true,
                  error: null,
                });
              } catch (err) {
                console.error('[authStore] local auth hydration failed:', err);
                set({ isLoading: false, initialized: true });
              }
            });
            return unsubscribe;
          }

          (async () => {
            try {
              const hubUser = await bootstrapHubAuth();

              try {
                const fbToken = await fetchFirebaseCustomToken();
                await signInWithCustomToken(auth, fbToken);
              } catch (e) {
                // Firebase sign-in failed — this means Firestore writes will
                // be denied. Surface the error to the user instead of
                // silently degrading; the admin needs to drop a service
                // account JSON in the hub.
                console.error('[authStore] Firebase custom-token sign-in failed:', e);
                throw e;
              }

              const lasaeduUser = await mergeWithLasaeduRecord(hubUser);

              const session: AuthSession = {
                sessionId: `sess_${Date.now()}`,
                userId: lasaeduUser.id,
                accessToken: hubTokenStore.get() ?? '',
                refreshToken: '',
                expiresAt: Date.now() + 12 * 3600 * 1000,
                createdAt: Date.now(),
                lastUsed: Date.now(),
                userAgent: navigator.userAgent,
                ipAddress: '127.0.0.1',
              };

              set({
                user: lasaeduUser,
                session,
                isAuthenticated: true,
                isLoading: false,
                initialized: true,
                error: null,
              });
            } catch (err) {
              if ((err as Error)?.message === 'redirecting-to-hub') return;
              console.error('[authStore] hub bootstrap failed:', err);
              set({
                user: null,
                session: null,
                isAuthenticated: false,
                isLoading: false,
                initialized: true,
                error: (err as Error)?.message ?? 'Error de autenticación',
              });
            }
          })();

          // Nothing to unsubscribe from — return a no-op for callers that
          // expect a cleanup function.
          return () => {};
        }
      }),
      {
        name: 'auth-storage',
        partialize: (state) => ({
          user: state.user,
          session: state.session,
          isAuthenticated: state.isAuthenticated
        }),
      }
    )
  )
);

/**
 * Combines the hub-issued identity with lasaedu's own user record so the
 * rest of the app keeps seeing the rich `User` shape it expects.
 *
 *   1. Look up the lasaedu DB record by email.
 *   2. If found, the DB role wins (so per-app role assignments stick).
 *   3. If missing, fabricate a default record using the hub-mapped role.
 */
async function mergeWithLasaeduRecord(hub: HubSessionUser): Promise<User> {
  const now = Date.now();
  let dbUser: any = null;
  try {
    const { firebaseDB } = await import('@shared/services/firebaseDataService');
    dbUser = await firebaseDB.getUserByEmail(hub.email);
  } catch (e) {
    // RTDB read failed — proceed with hub-only profile.
    console.warn('[authStore] could not load lasaedu user record:', e);
  }

  const role: UserRole = (dbUser?.role as UserRole) ?? hub.role;

  return {
    id: dbUser?.id ?? hub.uid,
    email: hub.email,
    name: dbUser?.name ?? hub.name,
    role,
    emailVerified: dbUser?.emailVerified ?? true,
    loginAttempts: dbUser?.loginAttempts ?? 0,
    profile: dbUser?.profile ?? {},
    preferences: {
      theme: 'light',
      notifications: {
        email: dbUser?.preferences?.notifications?.email ?? true,
        push: dbUser?.preferences?.notifications?.push ?? true,
        inApp: true,
      },
    } as any,
    refreshTokens: {},
    supervisorScope: dbUser?.supervisorScope,
    createdAt: dbUser?.createdAt ?? now,
    lastActive: now,
  } as User;
}
