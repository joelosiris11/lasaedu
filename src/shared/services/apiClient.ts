// Cliente HTTP del backend self-host (Postgres + JWT). Reemplaza el acceso
// directo a Firestore. Maneja el token de acceso, el refresh automático y los
// errores. La base es VITE_API_URL (o '/' para el proxy de Vite).

const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/+$/, '');

const ACCESS_KEY = 'la_access_token';
const REFRESH_KEY = 'la_refresh_token';

export const tokenStore = {
  get access() { return localStorage.getItem(ACCESS_KEY) || ''; },
  get refresh() { return localStorage.getItem(REFRESH_KEY) || ''; },
  set(access: string, refresh?: string) {
    if (access) localStorage.setItem(ACCESS_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() { localStorage.removeItem(ACCESS_KEY); localStorage.removeItem(REFRESH_KEY); },
};

async function tryRefresh(): Promise<boolean> {
  const refresh = tokenStore.refresh;
  if (!refresh) return false;
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: refresh }),
  });
  if (!res.ok) return false;
  const { accessToken } = await res.json();
  if (!accessToken) return false;
  tokenStore.set(accessToken);
  return true;
}

export interface ReqOpts {
  method?: string;
  body?: unknown;
  auth?: boolean; // adjunta Authorization (default true)
}

export async function apiFetch<T = unknown>(path: string, opts: ReqOpts = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = opts;
  const doFetch = () =>
    fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(auth && tokenStore.access ? { Authorization: `Bearer ${tokenStore.access}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

  let res = await doFetch();
  if (res.status === 401 && auth && (await tryRefresh())) {
    res = await doFetch(); // reintenta una vez tras refrescar
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `Error ${res.status} en ${path}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const apiBase = API_BASE;

const USE_API = import.meta.env.VITE_BACKEND === 'api';

// Token para llamar al backend de archivos/IA. En modo API es el JWT;
// en modo Firebase, el ID token (import dinámico para no acoplar).
export async function getBackendToken(): Promise<string> {
  if (USE_API) return tokenStore.access;
  const { auth } = await import('@app/config/firebase');
  return (await auth.currentUser?.getIdToken().catch(() => '')) || '';
}

// Base de los endpoints de archivos/IA (/upload, /files, /ai/*). En modo API
// es el backend nuevo; en Firebase, el file-server existente.
export function mediaBase(): string {
  const v = USE_API
    ? (import.meta.env.VITE_API_URL as string | undefined)
    : (import.meta.env.VITE_FILE_SERVER_URL as string | undefined);
  return (v ?? '').replace(/\/+$/, '');
}
