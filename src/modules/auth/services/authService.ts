import { storage } from '../../../shared/utils/storage';
import type { User, UserRole } from '../../../shared/types';

// Mock delay to simulate network request
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock users for development
const MOCK_USERS: Record<string, User> = {
  'admin@lasaedu.com': {
    id: '1',
    email: 'admin@lasaedu.com',
    name: 'Administrador Principal',
    role: 'admin',
    emailVerified: true,
    loginAttempts: 0,
    profile: {},
    preferences: {
      theme: 'light',
      notifications: { email: true, push: true, inApp: true }
    },
    refreshTokens: {},
    createdAt: Date.now(),
    lastActive: Date.now()
  },
  'teacher@lasaedu.com': {
    id: '2',
    email: 'teacher@lasaedu.com',
    name: 'Juan Profesor',
    role: 'teacher',
    emailVerified: true,
    loginAttempts: 0,
    profile: {},
    preferences: {
      theme: 'light',
      notifications: { email: true, push: true, inApp: true }
    },
    refreshTokens: {},
    createdAt: Date.now(),
    lastActive: Date.now()
  },
  'student@lasaedu.com': {
    id: '3',
    email: 'student@lasaedu.com',
    name: 'Ana Estudiante',
    role: 'student',
    emailVerified: true,
    loginAttempts: 0,
    profile: {},
    preferences: {
      theme: 'light',
      notifications: { email: true, push: true, inApp: true }
    },
    refreshTokens: {},
    createdAt: Date.now(),
    lastActive: Date.now()
  }
};

export interface LoginCredentials {
  email: string;
  passwordHash: string; // Pre-hashed or verify function in real backend
}

export interface RegisterData {
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<{ user: User; accessToken: string; refreshToken: string }> {
    await delay(800); // Simulate network

    const user = MOCK_USERS[credentials.email];
    
    // In a real app, verify passwordHash
    if (!user) {
      throw new Error('Credenciales inválidas');
    }

    const accessToken = `mock_access_token_${user.id}_${Date.now()}`;
    const refreshToken = `mock_refresh_token_${user.id}_${Date.now()}`;

    storage.setToken(accessToken);
    storage.setRefreshToken(refreshToken);
    storage.setUser(user);

    return {
      user,
      accessToken,
      refreshToken
    };
  },

  async register(data: RegisterData): Promise<{ user: User; accessToken: string; refreshToken: string }> {
    await delay(1000);
    
    if (MOCK_USERS[data.email]) {
      throw new Error('El usuario ya existe');
    }

    const newUser: User = {
      id: Math.random().toString(36).substr(2, 9),
      email: data.email,
      name: data.name,
      role: data.role,
      emailVerified: false,
      loginAttempts: 0,
      profile: {},
      preferences: {
        theme: 'light',
        notifications: { email: true, push: true, inApp: true }
      },
      refreshTokens: {},
      createdAt: Date.now(),
      lastActive: Date.now()
    };

    // Store in mock db
    MOCK_USERS[data.email] = newUser;

    const accessToken = `mock_access_token_${newUser.id}_${Date.now()}`;
    const refreshToken = `mock_refresh_token_${newUser.id}_${Date.now()}`;

    storage.setToken(accessToken);
    storage.setRefreshToken(refreshToken);
    storage.setUser(newUser);

    return {
      user: newUser,
      accessToken,
      refreshToken
    };
  },

  async logout(): Promise<void> {
    await delay(500);
    storage.clear();
  },

  async refreshToken(): Promise<string> {
    await delay(500);
    const newToken = `mock_access_token_${Date.now()}`;
    storage.setToken(newToken);
    return newToken;
  }
};
