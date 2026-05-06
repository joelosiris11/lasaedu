/**
 * Hub auth bridge for lasaedu.
 *
 * lasaedu does not have its own login. Authentication is delegated to
 * lasaHUB. The flow:
 *
 *   1. App mounts, ProtectedRoute or App init calls bootstrapHubAuth().
 *   2. If ?hubToken=<sso-ticket> is present → exchange it at the hub for a
 *      longer-lived "app session" token, store it, strip token from URL.
 *   3. Else if a stored hub session exists → verify with the hub. Valid =
 *      proceed; invalid = redirect.
 *   4. Else → redirect to hub login with ?next=<current-url>&app=lasaedu.
 *
 * The hub is the single source of truth. No fallback login UI lives here.
 */
import type { UserRole } from '@shared/types';

interface HubVerifyResponse {
  valid: boolean;
  reason?: string;
  claims?: { sub: string; email: string; role: string; app?: string };
}

interface HubExchangeResponse {
  token: string;
  user: {
    uid: string;
    email: string;
    name: string;
    role: string; // hub role: admin | hr | supervisor | employee
    photoUrl?: string | null;
    language?: string;
  };
  app: { id: string; slug: string; name: string };
}

const HUB_URL = (import.meta.env.VITE_HUB_URL ?? 'http://localhost:5180').replace(/\/$/, '');
const APP_SLUG = 'lasaedu';
const TOKEN_KEY = 'lasaedu.hubToken';
const USER_KEY = 'lasaedu.hubUser';

export interface HubSessionUser {
  uid: string;
  email: string;
  name: string;
  /** Hub role mapped onto lasaedu's role taxonomy. */
  role: UserRole;
  /** Original hub role string, kept for audit and re-mapping. */
  hubRole: string;
  photoUrl?: string | null;
}

export const hubTokenStore = {
  get(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },
  set(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  },
  clear(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

const hubUserStore = {
  get(): HubSessionUser | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as HubSessionUser;
    } catch {
      return null;
    }
  },
  set(user: HubSessionUser): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
};

/** Send the user to the hub login page, asking it to bounce back here. */
export function redirectToHubLogin(): never {
  hubTokenStore.clear();
  const next = encodeURIComponent(window.location.href);
  window.location.replace(`${HUB_URL}/?next=${next}&app=${APP_SLUG}`);
  throw new Error('redirecting-to-hub');
}

export async function bootstrapHubAuth(): Promise<HubSessionUser> {
  const params = new URLSearchParams(window.location.search);
  const incomingTicket = params.get('hubToken');

  if (incomingTicket) {
    try {
      const exchanged = await exchangeTicket(incomingTicket);
      const user = applyExchange(exchanged);
      stripHubTokenFromUrl();
      return user;
    } catch (err) {
      console.warn('[hubAuth] ticket exchange failed:', err);
      stripHubTokenFromUrl();
    }
  }

  const stored = hubTokenStore.get();
  const cached = hubUserStore.get();
  if (stored && cached) {
    try {
      const v = await verifyToken(stored);
      if (v.valid) return cached;
    } catch {
      // Network hiccup — keep cached session for this load.
      return cached;
    }
  }

  redirectToHubLogin();
}

async function exchangeTicket(ticket: string): Promise<HubExchangeResponse> {
  const r = await fetch(`${HUB_URL}/api/auth/exchange-ticket`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticket }),
  });
  if (!r.ok) {
    let msg = `exchange failed (${r.status})`;
    try {
      const j = await r.json();
      msg = j?.error ?? msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return (await r.json()) as HubExchangeResponse;
}

async function verifyToken(token: string): Promise<HubVerifyResponse> {
  const r = await fetch(`${HUB_URL}/api/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!r.ok) throw new Error(`verify HTTP ${r.status}`);
  return (await r.json()) as HubVerifyResponse;
}

function applyExchange(ex: HubExchangeResponse): HubSessionUser {
  const user: HubSessionUser = {
    uid: ex.user.uid,
    email: ex.user.email,
    name: ex.user.name,
    role: mapHubRoleToLasaedu(ex.user.role),
    hubRole: ex.user.role,
    photoUrl: ex.user.photoUrl ?? null,
  };
  hubTokenStore.set(ex.token);
  hubUserStore.set(user);
  return user;
}

function stripHubTokenFromUrl(): void {
  const params = new URLSearchParams(window.location.search);
  params.delete('hubToken');
  const search = params.toString();
  const clean = window.location.pathname + (search ? `?${search}` : '') + window.location.hash;
  window.history.replaceState({}, '', clean);
}

/**
 * Map hub roles → lasaedu roles. This is the default; per-user overrides
 * still come from lasaedu's own user records (looked up by email after
 * bootstrap). Keep this aligned with the team's policy for who gets what
 * default role on first login.
 */
function mapHubRoleToLasaedu(hubRole: string): UserRole {
  switch (hubRole) {
    case 'admin':
    case 'hr':
      return 'admin';
    case 'supervisor':
      return 'supervisor';
    case 'employee':
    default:
      return 'student';
  }
}

export function getCachedHubUser(): HubSessionUser | null {
  return hubUserStore.get();
}

export function logoutFromHub(): void {
  hubTokenStore.clear();
  redirectToHubLogin();
}

/**
 * Asks the hub to mint a Firebase Custom Token impersonating the current
 * user. The child then calls signInWithCustomToken() so Firestore / RTDB
 * see the hub uid + role custom claim and existing security rules pass.
 */
export async function fetchFirebaseCustomToken(): Promise<string> {
  const session = hubTokenStore.get();
  if (!session) throw new Error('No hay sesión del hub');
  const r = await fetch(`${HUB_URL}/api/auth/firebase-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session}`,
    },
    body: JSON.stringify({}),
  });
  if (!r.ok) {
    let msg = `firebase-token failed (${r.status})`;
    try {
      const j = await r.json();
      msg = j?.error ?? msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const data = (await r.json()) as { firebaseToken: string };
  return data.firebaseToken;
}
