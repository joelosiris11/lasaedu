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
}

interface AuthActions {
  setUser: (user: User | null) => void;
  setSession: (session: AuthSession | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (data: { name: string; email: string; passwordHash: string; role: any }) => Promise<void>;
  refreshToken: () => Promise<void>;
  clearAuth: () => void;
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

        // Actions
        setUser: (user) => set({ user, isAuthenticated: !!user }),
        
        setSession: (session) => set({ session }),
        
        setLoading: (isLoading) => set({ isLoading }),
        
        setError: (error) => set({ error }),

        login: async (email: string, password: string) => {
          set({ isLoading: true, error: null });
          try {
            // Note: In real app, password should be hashed or sent securely
            const { user, accessToken, refreshToken } = await authService.login({ email, passwordHash: password }); // Passing password as hash for mock
            
            // Create session object
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
            
            // Also save to localStorage for backward compatibility
            localStorage.setItem('userRole', user.role);
          } catch (error: any) {
            set({ error: error.message || 'Error al iniciar sesión', isLoading: false });
            throw error;
          }
        },

        logout: async () => {
          set({ isLoading: true });
          try {
            await authService.logout();
            localStorage.removeItem('userRole');
            set({ user: null, session: null, isAuthenticated: false, isLoading: false, error: null });
          } catch (error: any) {
            console.error('Logout error:', error);
            // Force local cleanup anyway
            localStorage.removeItem('userRole');
            set({ user: null, session: null, isAuthenticated: false, isLoading: false, error: null });
          }
        },

        register: async (data) => {
          set({ isLoading: true, error: null });
          try {
            const { user, accessToken, refreshToken } = await authService.register(data);
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
            
            // Also save to localStorage for backward compatibility
            localStorage.setItem('userRole', user.role);
          } catch (error: any) {
             set({ error: error.message || 'Error al registrarse', isLoading: false });
             throw error;
          }
        },

        refreshToken: async () => {
             // Implementation for token refresh
             try {
                 const newToken = await authService.refreshToken();
                 const currentSession = get().session;
                 if (currentSession) {
                     set({ session: { ...currentSession, accessToken: newToken } });
                 }
             } catch (e) {
                 // specific handling for refresh fail
                 get().logout();
             }
        },
        
        clearAuth: () => set({ user: null, session: null, isAuthenticated: false, error: null })
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
