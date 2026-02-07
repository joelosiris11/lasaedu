import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock Firebase
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
  getApps: vi.fn(() => []),
  getApp: vi.fn(() => ({})),
}))

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({
    currentUser: null,
  })),
  connectAuthEmulator: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn((_auth, callback) => {
    callback(null)
    return vi.fn()
  }),
  sendPasswordResetEmail: vi.fn(),
}))

vi.mock('firebase/database', () => ({
  getDatabase: vi.fn(() => ({})),
  connectDatabaseEmulator: vi.fn(),
  ref: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  push: vi.fn(() => ({ key: 'mock-key' })),
  update: vi.fn(),
  remove: vi.fn(),
  onValue: vi.fn((_ref, callback) => {
    callback({ val: () => null, exists: () => false })
    return vi.fn()
  }),
  query: vi.fn(),
  orderByChild: vi.fn(),
  equalTo: vi.fn(),
  limitToLast: vi.fn(),
}))

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe = vi.fn()
  disconnect = vi.fn()
  unobserve = vi.fn()
}
Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: MockIntersectionObserver,
})

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn()
  disconnect = vi.fn()
  unobserve = vi.fn()
}
Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: MockResizeObserver,
})
