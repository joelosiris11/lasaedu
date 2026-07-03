import { useEffect, useState } from 'react';
import { ImageOff, Loader2 } from 'lucide-react';
import { getBackendToken, mediaBase } from '@shared/services/apiClient';

// Renders an image that lives behind an authenticated endpoint (e.g. the
// admin-only /ai/files route). A bare <img src> can't send the Firebase ID
// token, so we fetch the bytes with an Authorization header and show them via
// an object URL. The object URL is revoked on unmount / src change.

interface AuthedImageProps {
  /** Path or URL. Relative paths resolve against VITE_FILE_SERVER_URL. */
  src: string;
  alt?: string;
  className?: string;
}

function resolveUrl(src: string): string {
  if (/^https?:\/\//i.test(src)) return src;
  return `${mediaBase()}${src.startsWith('/') ? '' : '/'}${src}`;
}

export function AuthedImage({ src, alt = '', className }: AuthedImageProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let revoked = false;
    let created: string | null = null;

    (async () => {
      setError(false);
      setObjectUrl(null);
      try {
        const idToken = await getBackendToken();
        const res = await fetch(resolveUrl(src), {
          headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (revoked) return;
        created = URL.createObjectURL(blob);
        setObjectUrl(created);
      } catch {
        if (!revoked) setError(true);
      }
    })();

    return () => {
      revoked = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [src]);

  if (error) {
    return (
      <div
        className={`flex items-center justify-center gap-2 rounded-md bg-gray-100 text-xs text-gray-500 ${className ?? ''}`}
      >
        <ImageOff className="h-4 w-4" /> No se pudo cargar la imagen
      </div>
    );
  }

  if (!objectUrl) {
    return (
      <div
        className={`flex items-center justify-center rounded-md bg-gray-100 ${className ?? ''}`}
      >
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return <img src={objectUrl} alt={alt} className={className} />;
}

export default AuthedImage;
