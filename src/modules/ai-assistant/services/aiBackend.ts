import { getBackendToken, mediaBase } from '@shared/services/apiClient';

// Client for the admin-only AI backend endpoints on the file server:
//   POST /ai/image  → Gemini image generation (returns a gated /ai/files URL)
//   POST /ai/pdf    → Puppeteer HTML→PDF (returns a /files download URL)
//
// Both are gated server-side (auth + admin role). We attach the Firebase ID
// token the same way ollamaClient does for /ai/chat. The base URL reuses the
// file-server origin (VITE_FILE_SERVER_URL); empty in dev so Vite proxies it.

const backendBase = mediaBase;

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getBackendToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * 'course' → PUBLIC image (served by /files), embeddable in lessons/covers that
 * students see. 'private' → admin-only (gated /ai/files), for chat/reports.
 */
export type ImageScope = 'course' | 'private';

export interface GenerateImageResult {
  /** Public /files URL (course scope) or gated /ai/files URL (private scope). */
  url: string;
  prompt: string;
  mimeType?: string;
  scope?: ImageScope;
}

export type ImageAspectRatio =
  | '1:1'
  | '16:9'
  | '9:16'
  | '4:3'
  | '3:4'
  | '3:2'
  | '2:3';

export async function generateImage(
  prompt: string,
  aspectRatio?: ImageAspectRatio,
  scope: ImageScope = 'private',
): Promise<GenerateImageResult> {
  const res = await fetch(`${backendBase()}/ai/image`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ prompt, scope, ...(aspectRatio ? { aspectRatio } : {}) }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || `Error al generar la imagen (${res.status}).`);
  }
  return (await res.json()) as GenerateImageResult;
}

export interface GeneratePdfResult {
  /** Download URL (/files/reports/...). */
  url: string;
  title: string;
  filename?: string;
}

export async function generatePdf(title: string, html: string): Promise<GeneratePdfResult> {
  const res = await fetch(`${backendBase()}/ai/pdf`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ title, html }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || `Error al generar el PDF (${res.status}).`);
  }
  return (await res.json()) as GeneratePdfResult;
}
