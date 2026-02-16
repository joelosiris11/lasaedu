/**
 * Servicio de gestión de contenido H5P
 * Maneja subida, almacenamiento y consulta de paquetes .h5p en Firebase
 */

import JSZip from 'jszip';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import { ref, get, set, push, remove, update, query, orderByChild, equalTo } from 'firebase/database';
import { database, storage } from '@app/config/firebase';
import type { H5PContentMeta, H5PPackageInfo } from '@shared/types/h5p';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html', '.htm': 'text/html',
  '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.xml': 'application/xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
};

function getMimeType(filename: string): string {
  const ext = '.' + filename.split('.').pop()?.toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

export class H5PContentService {
  // =============================================
  // VALIDACIÓN Y SUBIDA
  // =============================================

  async validatePackage(file: File): Promise<{
    isValid: boolean;
    packageInfo?: H5PPackageInfo;
    error?: string;
  }> {
    try {
      if (!file.name.endsWith('.h5p') && !file.name.endsWith('.zip')) {
        return { isValid: false, error: 'El archivo debe ser .h5p o .zip' };
      }

      const zip = await JSZip.loadAsync(file);
      const h5pJsonFile = zip.file('h5p.json');
      if (!h5pJsonFile) {
        return { isValid: false, error: 'No se encontró h5p.json en el paquete' };
      }

      const contentDir = zip.folder('content');
      if (!contentDir) {
        return { isValid: false, error: 'No se encontró el directorio content/ en el paquete' };
      }

      const h5pJsonStr = await h5pJsonFile.async('string');
      const packageInfo = JSON.parse(h5pJsonStr) as H5PPackageInfo;

      if (!packageInfo.mainLibrary) {
        return { isValid: false, error: 'El paquete no define una librería principal (mainLibrary)' };
      }

      return { isValid: true, packageInfo };
    } catch (error) {
      return {
        isValid: false,
        error: `Error al validar: ${error instanceof Error ? error.message : 'desconocido'}`
      };
    }
  }

  async uploadPackage(
    file: File,
    metadata: { title: string; description?: string; tags?: string[]; createdBy: string },
    onProgress?: (percent: number) => void
  ): Promise<H5PContentMeta> {
    const zip = await JSZip.loadAsync(file);
    const h5pJsonFile = zip.file('h5p.json');
    if (!h5pJsonFile) throw new Error('No se encontró h5p.json');

    const h5pJsonStr = await h5pJsonFile.async('string');
    const packageInfo = JSON.parse(h5pJsonStr) as H5PPackageInfo;

    const contentId = `h5p_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const basePath = `uploads/h5p/${contentId}`;

    // Subir todos los archivos del zip a Storage
    const files = Object.keys(zip.files).filter(name => !zip.files[name].dir);
    const totalFiles = files.length;
    let uploaded = 0;

    for (const filePath of files) {
      const zipEntry = zip.files[filePath];
      const data = await zipEntry.async('uint8array');
      const fileRef = storageRef(storage, `${basePath}/${filePath}`);
      await uploadBytes(fileRef, data, {
        contentType: getMimeType(filePath),
        customMetadata: { contentId }
      });
      uploaded++;
      onProgress?.(Math.round((uploaded / totalFiles) * 100));
    }

    const now = Date.now();
    const contentMeta: H5PContentMeta = {
      id: contentId,
      title: metadata.title || packageInfo.title || file.name,
      description: metadata.description,
      mainLibrary: packageInfo.mainLibrary,
      contentType: packageInfo.mainLibrary,
      storageBasePath: basePath,
      fileSize: file.size,
      tags: metadata.tags || [],
      isPublished: true,
      usageCount: 0,
      createdBy: metadata.createdBy,
      createdAt: now,
      updatedAt: now,
    };

    await set(ref(database, `h5pContent/${contentId}`), contentMeta);
    return contentMeta;
  }

  // =============================================
  // CONSULTAS
  // =============================================

  async getContent(id: string): Promise<H5PContentMeta | null> {
    const snapshot = await get(ref(database, `h5pContent/${id}`));
    return snapshot.exists() ? (snapshot.val() as H5PContentMeta) : null;
  }

  async getAllContent(): Promise<H5PContentMeta[]> {
    const snapshot = await get(ref(database, 'h5pContent'));
    if (!snapshot.exists()) return [];
    return Object.values(snapshot.val()) as H5PContentMeta[];
  }

  async getContentByType(contentType: string): Promise<H5PContentMeta[]> {
    const q = query(ref(database, 'h5pContent'), orderByChild('contentType'), equalTo(contentType));
    const snapshot = await get(q);
    if (!snapshot.exists()) return [];
    return Object.values(snapshot.val()) as H5PContentMeta[];
  }

  async getPublishedContent(): Promise<H5PContentMeta[]> {
    const q = query(ref(database, 'h5pContent'), orderByChild('isPublished'), equalTo(true));
    const snapshot = await get(q);
    if (!snapshot.exists()) return [];
    return Object.values(snapshot.val()) as H5PContentMeta[];
  }

  // =============================================
  // GESTIÓN
  // =============================================

  async updateMetadata(id: string, data: Partial<H5PContentMeta>): Promise<void> {
    await update(ref(database, `h5pContent/${id}`), {
      ...data,
      updatedAt: Date.now()
    });
  }

  async deleteContent(id: string): Promise<void> {
    const content = await this.getContent(id);
    if (!content) return;

    // Eliminar archivos de Storage
    try {
      const folderRef = storageRef(storage, content.storageBasePath);
      const result = await listAll(folderRef);
      await Promise.all(result.items.map(item => deleteObject(item)));
      for (const prefix of result.prefixes) {
        const subResult = await listAll(prefix);
        await Promise.all(subResult.items.map(item => deleteObject(item)));
      }
    } catch (err) {
      console.warn('Error eliminando archivos H5P de Storage:', err);
    }

    await remove(ref(database, `h5pContent/${id}`));
  }

  async incrementUsageCount(id: string): Promise<void> {
    const content = await this.getContent(id);
    if (content) {
      await update(ref(database, `h5pContent/${id}`), {
        usageCount: (content.usageCount || 0) + 1
      });
    }
  }

  /**
   * Obtiene la URL de descarga del directorio base del contenido H5P
   * Para h5p-standalone necesitamos la URL base donde están los archivos extraídos
   */
  async getContentUrl(id: string): Promise<string> {
    const content = await this.getContent(id);
    if (!content) throw new Error('Contenido H5P no encontrado');

    // Retornar URL del h5p.json como referencia base
    const h5pJsonRef = storageRef(storage, `${content.storageBasePath}/h5p.json`);
    const url = await getDownloadURL(h5pJsonRef);
    // Extraer URL base (sin el nombre del archivo)
    return url.substring(0, url.lastIndexOf('/'));
  }

  /**
   * Obtener contenido reutilizable
   */
  async getReusableContents(): Promise<H5PContentMeta[]> {
    const q = query(ref(database, 'h5pContent'), 
      orderByChild('isPublished'), equalTo(true));
    const snapshot = await get(q);
    if (!snapshot.exists()) return [];
    
    const allContent = Object.values(snapshot.val()) as H5PContentMeta[];
    return allContent.filter((c: any) => c.isReusable);
  }

  /**
   * Copiar contenido H5P a otro curso
   */
  async copyContent(
    sourceId: string,
    targetCourseId: string,
    newTitle?: string
  ): Promise<H5PContentMeta> {
    const source = await this.getContent(sourceId);
    if (!source) throw new Error('Contenido H5P origen no encontrado');

    const newId = `h5p_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newContent: H5PContentMeta = {
      ...source,
      id: newId,
      title: newTitle || `${source.title} (copia)`,
      usageCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await set(ref(database, `h5pContent/${newId}`), newContent);
    return newContent;
  }

  /**
   * Marcar contenido como reutilizable
   */
  async markAsReusable(id: string, isReusable: boolean): Promise<void> {
    await update(ref(database, `h5pContent/${id}`), {
      isReusable,
      updatedAt: Date.now()
    });
  }

  /**
   * Buscar contenido H5P
   */
  async searchContent(
    query: string,
    filters?: {
      contentType?: string;
      tags?: string[];
      reusableOnly?: boolean;
    }
  ): Promise<H5PContentMeta[]> {
    const allContent = await this.getAllContent();
    
    return allContent.filter((content: any) => {
      // Búsqueda por texto
      const matchesQuery = !query ||
        content.title.toLowerCase().includes(query.toLowerCase()) ||
        (content.description || '').toLowerCase().includes(query.toLowerCase()) ||
        content.tags.some((t: string) => t.toLowerCase().includes(query.toLowerCase()));

      // Filtros
      if (filters?.contentType && content.contentType !== filters.contentType) return false;
      if (filters?.reusableOnly && !content.isPublished) return false;
      if (filters?.tags && !filters.tags.some(t => content.tags.includes(t))) return false;

      return matchesQuery;
    });
  }
}

export const h5pContentService = new H5PContentService();
