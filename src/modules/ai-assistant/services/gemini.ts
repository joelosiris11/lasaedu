import { auth } from '@app/config/firebase';

export interface GeminiGeneratedImage {
  url: string; // public URL hosted by the file server
  prompt: string;
  model: string;
}

const PROXY_PATH = '/ai/generate-image';

function getProxyUrl(): string {
  const explicit = import.meta.env.VITE_AI_IMAGE_PROXY_URL as string | undefined;
  if (explicit) return explicit;
  const base = (import.meta.env.VITE_FILE_SERVER_URL as string | undefined) ?? '';
  return `${base.replace(/\/+$/, '')}${PROXY_PATH}`;
}

export interface GenerateImageOptions {
  prompt: string;
  aspectRatio?: '1:1' | '4:3' | '16:9' | '3:4' | '9:16';
}

/**
 * Calls the file-server proxy that forwards to Gemini's image generation
 * endpoint with the server-side GEMINI_API_KEY. The browser never sees the
 * key. The server saves the resulting image and returns a public URL ready
 * to embed in courses or lessons.
 */
export async function generateImageWithGemini(
  options: GenerateImageOptions,
): Promise<GeminiGeneratedImage> {
  const prompt = options.prompt.trim();
  if (!prompt) throw new Error('El prompt no puede estar vacío.');

  const idToken = await auth.currentUser?.getIdToken().catch(() => '');
  const res = await fetch(getProxyUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify({ prompt, aspectRatio: options.aspectRatio }),
  });

  if (!res.ok) {
    let message = `Gemini error ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      const text = await res.text().catch(() => '');
      if (text) message = `${message}: ${text}`;
    }
    throw new Error(message);
  }

  return (await res.json()) as GeminiGeneratedImage;
}
