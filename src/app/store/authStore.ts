import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { User, AuthSession } from '@shared/types';
import { authService } from '@modules/auth/services/authService';

interface AuthState {
  user: User | null;
  session: AuthSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  initialized: boolean;
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

        // Actions
        setUser: (user) => set({ user, isAuthenticated: !!user }),

        setSession: (session) => set({ session }),

        setLoading: (isLoading) => set({ isLoading }),

        setError: (error) => set({ error }),

        login: async (email: string, password: string) => {
          set({ isLoading: true, error: null });
          try {
            const { user, accessToken, refreshToken } = await authService.login({
              email,
              password
            });

            // Create session object
            const session: AuthSession = {
              sessionId: `sess_${Date.now()}`,
              userId: user.id,
              accessToken,
              refreshToken,
              expiresAt: Date.now() + 3600000, // 1 hour
              createdAt: Date.now(),
              lastUsed: Date.now(),
              userAgent: navigator.userAgent,
              ipAddress: '127.0.0.1'
            };

            set({ user, session, isAuthenticated: true, isLoading: false });
          } catch (error: any) {
            // Map Firebase Auth error messages to Spanish
            let errorMessage = 'Error al iniciar sesión';
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
              errorMessage = 'Credenciales inválidas';
            } else if (error.code === 'auth/invalid-email') {
              errorMessage = 'Email inválido';
            } else if (error.code === 'auth/user-disabled') {
              errorMessage = 'Usuario deshabilitado';
            } else if (error.code === 'auth/too-many-requests') {
              errorMessage = 'Demasiados intentos. Intente más tarde.';
            } else if (error.code === 'auth/invalid-credential') {
              errorMessage = 'Credenciales inválidas';
            } else if (error.message) {
              errorMessage = error.message;
            }

            set({ error: errorMessage, isLoading: false });
            throw new Error(errorMessage);
          }
        },

        logout: async () => {
          set({ isLoading: true });
          try {
            await authService.logout();
            set({ user: null, session: null, isAuthenticated: false, isLoading: false, error: null });
          } catch (error: any) {
            console.error('Logout error:', error);
            // Force local cleanup anyway
            set({ user: null, session: null, isAuthenticated: false, isLoading: false, error: null });
          }
        },

        register: async (data) => {
          set({ isLoading: true, error: null });
          try {
            const { user, accessToken, refreshToken } = await authService.register({
              email: data.email,
              password: data.password,
              name: data.name,
              role: data.role
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
              ipAddress: '127.0.0.1'
            };

            set({ user, session, isAuthenticated: true, isLoading: false });
          } catch (error: any) {
            // Map Firebase Auth error messages to Spanish
            let errorMessage = 'Error al registrarse';
            if (error.code === 'auth/email-already-in-use') {
              errorMessage = 'El email ya está registrado';
            } else if (error.code === 'auth/invalid-email') {
              errorMessage = 'Email inválido';
            } else if (error.code === 'auth/weak-password') {
              errorMessage = 'La contraseña debe tener al menos 6 caracteres';
            } else if (error.message) {
              errorMessage = error.message;
            }

            set({ error: errorMessage, isLoading: false });
            throw new Error(errorMessage);
          }
        },

        refreshToken: async () => {
          try {
            const newToken = await authService.refreshToken();
            const currentSession = get().session;
            if (currentSession) {
              set({ session: { ...currentSession, accessToken: newToken } });
            }
          } catch (e) {
            // Token refresh failed, logout user
            get().logout();
          }
        },

        resetPassword: async (email: string) => {
          set({ isLoading: true, error: null });
          try {
            await authService.resetPassword(email);
            set({ isLoading: false });
          } catch (error: any) {
            let errorMessage = 'Error al enviar email de recuperación';
            if (error.code === 'auth/user-not-found') {
              errorMessage = 'No existe una cuenta con este email';
            } else if (error.code === 'auth/invalid-email') {
              errorMessage = 'Email inválido';
            }
            set({ error: errorMessage, isLoading: false });
            throw new Error(errorMessage);
          }
        },

        clearAuth: () => set({ user: null, session: null, isAuthenticated: false, error: null }),

        initializeAuth: () => {
          // Subscribe to Firebase Auth state changes
          const unsubscribe = authService.onAuthStateChanged(async (firebaseUser) => {
            if (firebaseUser) {
              // User is signed in, but we might already have their data from persist
              const currentUser = get().user;
              if (!currentUser) {
                // Need to fetch user data from database
                try {
                  const { firebaseDB } = await import('@shared/services/firebaseDataService');
                  const dbUser = await firebaseDB.getUserByEmail(firebaseUser.email!);

                  if (dbUser) {
                    const user: User = {
                      id: dbUser.id,
                      email: dbUser.email,
                      name: dbUser.name,
                      role: dbUser.role as any,
                      emailVerified: dbUser.emailVerified || firebaseUser.emailVerified,
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
                      ipAddress: '127.0.0.1'
                    };

                    set({ user, session, isAuthenticated: true, initialized: true });
                  }
                } catch (error) {
                  console.error('Error fetching user data:', error);
                  set({ initialized: true });
                }
              } else {
                set({ initialized: true });
              }
            } else {
              // User is signed out
              const wasAuthenticated = get().isAuthenticated;
              if (wasAuthenticated) {
                set({ user: null, session: null, isAuthenticated: false, initialized: true });
              } else {
                set({ initialized: true });
              }
            }
          });

          return unsubscribe;
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
