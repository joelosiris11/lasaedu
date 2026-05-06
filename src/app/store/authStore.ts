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

        // Local login is disabled: lasaedu delegates auth to lasaHUB. Anything
        // that previously called this should redirect via logoutFromHub() so
        // the user lands on the hub login.
        login: async () => {
          logoutFromHub();
        },

        logout: async () => {
          set({ isLoading: true });
          // Clear local state immediately so the brief redirect doesn't show
          // stale user data; logoutFromHub() then sends them to the hub.
          set({
            user: null,
            session: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
            mustChangePassword: false,
          });
          logoutFromHub();
        },

        // Registration is disabled here — users come from lasaHUB.
        register: async () => {
          throw new Error('El registro se hace en LASA Hub, no en lasaedu.');
        },

        // Password reset is handled in lasaHUB; here it just bounces to it.
        resetPassword: async () => {
          logoutFromHub();
        },

        // The hub's app session token cannot be "refreshed" — when it
        // expires, the user must round-trip through the hub again. We
        // surface that by clearing local state and sending them to log in.
        refreshToken: async () => {
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
          // lasaedu delegates auth to lasaHUB. The hub bootstrap either:
          //   • returns a HubSessionUser (we have a valid hub session), or
          //   • redirects the browser to the hub login (then never resolves).
          //
          // After hub bootstrap we ask the hub to mint a Firebase Custom
          // Token impersonating this user, and signInWithCustomToken() so
          // Firestore / RTDB rules see request.auth.uid = hub uid and
          // request.auth.token.role = hub role. Existing rules keep working
          // without modification.
          set({ isLoading: true });

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
