import type { StockImage } from '../types';

const UNSPLASH_ENDPOINT = 'https://api.unsplash.com/search/photos';

interface UnsplashPhoto {
  id: string;
  description: string | null;
  alt_description: string | null;
  urls: { regular: string; small: string };
  links: { html: string };
  user: { name: string; links: { html: string } };
}

interface UnsplashSearchResponse {
  results: UnsplashPhoto[];
}

export interface SearchStockImagesOptions {
  query: string;
  orientation?: 'landscape' | 'portrait' | 'squarish';
  perPage?: number;
}

/**
 * Searches Unsplash for stock photos. Requires VITE_UNSPLASH_ACCESS_KEY.
 * Returns a small, curated shape so the AI model receives only what it needs.
 */
export async function searchStockImages({
  query,
  orientation,
  perPage = 6,
}: SearchStockImagesOptions): Promise<StockImage[]> {
  const key = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;
  if (!key) {
    throw new Error(
      'Falta VITE_UNSPLASH_ACCESS_KEY en el entorno. Registra una app en https://unsplash.com/developers y agrega la clave al .env.',
    );
  }

  const params = new URLSearchParams({
    query,
    per_page: String(Math.min(10, Math.max(1, perPage))),
    content_filter: 'high',
  });
  if (orientation) params.set('orientation', orientation);

  const res = await fetch(`${UNSPLASH_ENDPOINT}?${params.toString()}`, {
    headers: {
      Authorization: `Client-ID ${key}`,
      'Accept-Version': 'v1',
    },
  });

  if (!res.ok) {
    throw new Error(`Unsplash respondió ${res.status}: ${await res.text()}`);
  }

  const json = (await res.json()) as UnsplashSearchResponse;
  return json.results.map((p) => ({
    url: p.urls.regular,
    thumbUrl: p.urls.small,
    author: p.user.name,
    authorUrl: p.user.links.html,
    sourceUrl: p.links.html,
    description: p.description || p.alt_description || undefined,
  }));
}
