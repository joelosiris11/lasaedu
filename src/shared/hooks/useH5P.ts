/**
 * Hook useH5P
 * Proporciona funcionalidades para trabajar con contenido H5P
 */

import { useState, useCallback } from 'react';
import { H5PContentService } from '@shared/services/h5p/h5pContentService';
import type { H5PContentMeta, H5PAttempt, H5PResult } from '@shared/types/h5p';

interface UseH5PReturn {
  contents: H5PContentMeta[];
  loading: boolean;
  error: string | null;
  uploadContent: (file: File, metadata: any) => Promise<H5PContentMeta>;
  deleteContent: (contentId: string) => Promise<void>;
  getContentById: (contentId: string) => H5PContentMeta | undefined;
  recordAttempt: (attempt: H5PAttempt) => Promise<void>;
  getResults: (contentId: string, userId: string) => Promise<H5PResult | null>;
}

export function useH5P(courseId?: string): UseH5PReturn {
  const [contents, setContents] = useState<H5PContentMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const h5pService = new H5PContentService();

  const uploadContent = useCallback(
    async (file: File, metadata: any): Promise<H5PContentMeta> => {
      try {
        setLoading(true);
        setError(null);
        
        const result = await h5pService.validatePackage(file);
        if (!result.isValid) {
          throw new Error(result.error || 'Archivo inválido');
        }

        const contentMeta = await h5pService.uploadPackage(file, metadata);
        setContents(prev => [...prev, contentMeta]);
        return contentMeta;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
        setError(errorMsg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const deleteContent = useCallback(async (contentId: string) => {
    try {
      setLoading(true);
      // TODO: Implementar eliminación en H5PContentService
      setContents(prev => prev.filter(c => c.id !== contentId));
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error al eliminar';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getContentById = useCallback((contentId: string): H5PContentMeta | undefined => {
    return contents.find(c => c.id === contentId);
  }, [contents]);

  const recordAttempt = useCallback(async (attempt: H5PAttempt) => {
    try {
      // TODO: Guardar intento en Firebase
      console.log('Recording H5P attempt:', attempt);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error al registrar intento';
      setError(errorMsg);
      throw err;
    }
  }, []);

  const getResults = useCallback(async (contentId: string, userId: string): Promise<H5PResult | null> => {
    try {
      // TODO: Obtener resultados de Firebase
      console.log('Getting H5P results:', { contentId, userId });
      return null;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error al obtener resultados';
      setError(errorMsg);
      throw err;
    }
  }, []);

  return {
    contents,
    loading,
    error,
    uploadContent,
    deleteContent,
    getContentById,
    recordAttempt,
    getResults
  };
}
