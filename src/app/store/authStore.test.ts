import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock authService before importing the store
vi.mock('@modules/auth/services/authService', () => ({
  authService: {
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    refreshToken: vi.fn(),
    resetPassword: vi.fn(),
    onAuthStateChanged: vi.fn(() => vi.fn()),
  },
}))

// Mock zustand persist middleware
vi.mock('zustand/middleware', async () => {
  const actual = await vi.importActual('zustand/middleware')
  return {
    ...actual,
    persist: (config: any) => config,
  }
})

// Import store after mocks
import { useAuthStore } from './authStore'

describe('authStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAuthStore.setState({
      user: null,
      session: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      initialized: false,
    })
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = useAuthStore.getState()

      expect(state.user).toBeNull()
      expect(state.session).toBeNull()
      expect(state.isAuthenticated).toBe(false)
      expect(state.isLoading).toBe(false)
      expect(state.error).toBeNull()
    })
  })

  describe('setUser', () => {
    it('should set user and update isAuthenticated to true', () => {
      const mockUser = {
        id: 'test-id',
        email: 'test@example.com',
        name: 'Test User',
        role: 'student' as const,
        createdAt: Date.now(),
      }

      useAuthStore.getState().setUser(mockUser as any)
      const state = useAuthStore.getState()

      expect(state.user).toEqual(mockUser)
      expect(state.isAuthenticated).toBe(true)
    })

    it('should set isAuthenticated to false when user is null', () => {
      // First set a user
      useAuthStore.getState().setUser({
        id: 'test-id',
        email: 'test@example.com',
        name: 'Test User',
        role: 'student',
      } as any)

      // Then set to null
      useAuthStore.getState().setUser(null)
      const state = useAuthStore.getState()

      expect(state.user).toBeNull()
      expect(state.isAuthenticated).toBe(false)
    })
  })

  describe('setSession', () => {
    it('should set session correctly', () => {
      const mockSession = {
        sessionId: 'sess_123',
        userId: 'user_123',
        accessToken: 'token_abc',
        refreshToken: 'refresh_xyz',
        expiresAt: Date.now() + 3600000,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        userAgent: 'test-agent',
        ipAddress: '127.0.0.1',
      }

      useAuthStore.getState().setSession(mockSession)
      const state = useAuthStore.getState()

      expect(state.session).toEqual(mockSession)
    })
  })

  describe('setLoading', () => {
    it('should set loading state', () => {
      useAuthStore.getState().setLoading(true)
      expect(useAuthStore.getState().isLoading).toBe(true)

      useAuthStore.getState().setLoading(false)
      expect(useAuthStore.getState().isLoading).toBe(false)
    })
  })

  describe('setError', () => {
    it('should set error message', () => {
      const errorMessage = 'Test error message'
      useAuthStore.getState().setError(errorMessage)

      expect(useAuthStore.getState().error).toBe(errorMessage)
    })

    it('should clear error when set to null', () => {
      useAuthStore.getState().setError('Some error')
      useAuthStore.getState().setError(null)

      expect(useAuthStore.getState().error).toBeNull()
    })
  })

  describe('login', () => {
    it('should set loading to true when starting login', async () => {
      const { authService } = await import('@modules/auth/services/authService')
      ;(authService.login as any).mockImplementation(() => new Promise(() => {})) // Never resolves

      // Start login (don't await)
      useAuthStore.getState().login('test@example.com', 'password').catch(() => {})

      // Check loading state immediately
      expect(useAuthStore.getState().isLoading).toBe(true)
    })

    it('should set user and session on successful login', async () => {
      const { authService } = await import('@modules/auth/services/authService')
      const mockResponse = {
        user: {
          id: 'user_123',
          email: 'test@example.com',
          name: 'Test User',
          role: 'student',
        },
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
      }
      ;(authService.login as any).mockResolvedValue(mockResponse)

      await useAuthStore.getState().login('test@example.com', 'password')
      const state = useAuthStore.getState()

      expect(state.user).toEqual(mockResponse.user)
      expect(state.isAuthenticated).toBe(true)
      expect(state.isLoading).toBe(false)
      expect(state.session).toBeTruthy()
      expect(state.session?.accessToken).toBe('access_token')
    })

    it('should set error on login failure', async () => {
      const { authService } = await import('@modules/auth/services/authService')
      ;(authService.login as any).mockRejectedValue({
        code: 'auth/wrong-password',
        message: 'Wrong password'
      })

      await expect(useAuthStore.getState().login('test@example.com', 'wrong'))
        .rejects.toThrow('Credenciales inválidas')

      const state = useAuthStore.getState()
      expect(state.error).toBe('Credenciales inválidas')
      expect(state.isLoading).toBe(false)
      expect(state.isAuthenticated).toBe(false)
    })
  })

  describe('logout', () => {
    it('should clear user and session on logout', async () => {
      const { authService } = await import('@modules/auth/services/authService')
      ;(authService.logout as any).mockResolvedValue(undefined)

      // Set initial authenticated state
      useAuthStore.setState({
        user: { id: 'test', email: 'test@test.com', name: 'Test', role: 'student' } as any,
        session: { sessionId: 'sess_123' } as any,
        isAuthenticated: true,
      })

      await useAuthStore.getState().logout()
      const state = useAuthStore.getState()

      expect(state.user).toBeNull()
      expect(state.session).toBeNull()
      expect(state.isAuthenticated).toBe(false)
    })

    it('should clear state even if logout service fails', async () => {
      const { authService } = await import('@modules/auth/services/authService')
      ;(authService.logout as any).mockRejectedValue(new Error('Service error'))

      useAuthStore.setState({
        user: { id: 'test' } as any,
        isAuthenticated: true,
      })

      await useAuthStore.getState().logout()
      const state = useAuthStore.getState()

      expect(state.user).toBeNull()
      expect(state.isAuthenticated).toBe(false)
    })
  })

  describe('clearAuth', () => {
    it('should clear all auth state', () => {
      useAuthStore.setState({
        user: { id: 'test' } as any,
        session: { sessionId: 'sess' } as any,
        isAuthenticated: true,
        error: 'Some error',
      })

      useAuthStore.getState().clearAuth()
      const state = useAuthStore.getState()

      expect(state.user).toBeNull()
      expect(state.session).toBeNull()
      expect(state.isAuthenticated).toBe(false)
      expect(state.error).toBeNull()
    })
  })
})
