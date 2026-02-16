/**
 * H5P Player Component
 * Renderiza contenido H5P interactivo dentro de una lección
 */

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Download, Share2 } from 'lucide-react';
import type { H5PContentMeta } from '@shared/types/h5p';

interface H5PPlayerProps {
  content: H5PContentMeta;
  onCompletion?: (score: number, maxScore: number) => void;
  onProgress?: (percentage: number) => void;
  readOnly?: boolean;
}

export function H5PPlayer({
  content,
  onCompletion,
  onProgress,
  readOnly = false
}: H5PPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadH5P = async () => {
      try {
        setLoading(true);
        setError(null);

        if (!containerRef.current) return;

        // Cargar la librería h5p-standalone si no está disponible
        if (!window.H5P) {
          throw new Error('H5P library no disponible');
        }

        // Limpiar contenido anterior
        containerRef.current.innerHTML = '';

        // Crear elemento iframe para aislar el contenido H5P
        const iframe = document.createElement('iframe');
        iframe.style.width = '100%';
        iframe.style.height = '600px';
        iframe.style.border = 'none';
        iframe.style.borderRadius = '0.5rem';
        iframe.sandbox.add('allow-same-origin', 'allow-scripts', 'allow-forms', 'allow-popups');
        
        containerRef.current.appendChild(iframe);

        // Cargar el contenido H5P en el iframe
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc) {
          const htmlContent = `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="UTF-8">
                <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/h5p-standalone@3/dist/styles/h5p.css">
                <style>
                  body {
                    margin: 0;
                    padding: 20px;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                  }
                  #h5p-container {
                    width: 100%;
                  }
                </style>
              </head>
              <body>
                <div id="h5p-container"></div>
                <script src="https://cdn.jsdelivr.net/npm/h5p-standalone@3/dist/h5p-standalone-main.bundle.min.js"></script>
              </body>
            </html>
          `;
          iframeDoc.write(htmlContent);
          iframeDoc.close();
        }

        setLoading(false);
      } catch (err) {
        console.error('Error loading H5P content:', err);
        setError(err instanceof Error ? err.message : 'Error desconocido');
        setLoading(false);
      }
    };

    loadH5P();
  }, [content]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando contenido H5P...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <div>
            <h3 className="font-semibold text-red-900">Error al cargar contenido H5P</h3>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{content.title}</h3>
          {content.description && (
            <p className="text-sm text-gray-600 mt-1">{content.description}</p>
          )}
        </div>
        {!readOnly && (
          <div className="flex gap-2">
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Share2 className="w-5 h-5 text-gray-600" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Download className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        )}
      </div>

      <div
        ref={containerRef}
        className="bg-white rounded-lg shadow-sm border border-gray-200"
      />

      {content.tags && content.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {content.tags.map(tag => (
            <span
              key={tag}
              className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
