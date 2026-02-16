/**
 * Servicio de gestión de paquetes SCORM
 * Maneja subida, extracción y almacenamiento de paquetes .zip
 */

import JSZip from 'jszip';
import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import { storage } from '@app/config/firebase';
import { scormManifestParser } from './scormManifestParser';
import { scormDataService } from './scormDataService';
import type { SCORMPackage, SCORMVersion } from '@shared/types/elearning-standards';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.htm': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.xsd': 'application/xml',
  '.dtd': 'application/xml-dtd',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.pdf': 'application/pdf',
  '.swf': 'application/x-shockwave-flash',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
};

function getMimeType(filename: string): string {
  const ext = '.' + filename.split('.').pop()?.toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

export class SCORMPackageService {
  async validatePackage(file: File): Promise<{
    isValid: boolean;
    version?: SCORMVersion;
    title?: string;
    error?: string;
  }> {
    try {
      if (!file.name.endsWith('.zip')) {
        return { isValid: false, error: 'El archivo debe ser un .zip' };
      }

      const zip = await JSZip.loadAsync(file);
      const manifestFile = zip.file('imsmanifest.xml');

      if (!manifestFile) {
        return { isValid: false, error: 'No se encontró imsmanifest.xml en el paquete' };
      }

      const xmlString = await manifestFile.async('string');
      const { version, manifest } = scormManifestParser.parseManifest(xmlString);
      const title = manifest.organizations[0]?.title || manifest.identifier;

      return { isValid: true, version, title };
    } catch (error) {
      return {
        isValid: false,
        error: `Error al validar el paquete: ${error instanceof Error ? error.message : 'desconocido'}`
      };
    }
  }

  async uploadPackage(
    file: File,
    courseId: string,
    lessonId: string,
    uploadedBy: string,
    onProgress?: (percent: number) => void
  ): Promise<SCORMPackage> {
    const zip = await JSZip.loadAsync(file);

    const manifestFile = zip.file('imsmanifest.xml');
    if (!manifestFile) {
      throw new Error('No se encontró imsmanifest.xml en el paquete');
    }

    const xmlString = await manifestFile.async('string');
    const { version, manifest } = scormManifestParser.parseManifest(xmlString);
    const launchUrl = scormManifestParser.getLaunchUrl(manifest);

    const packageId = `scorm_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const storagePath = `uploads/scorm/${courseId}/${packageId}`;

    const files = Object.keys(zip.files).filter(name => !zip.files[name].dir);
    const totalFiles = files.length;
    let uploadedFiles = 0;

    for (const filePath of files) {
      const zipEntry = zip.files[filePath];
      const data = await zipEntry.async('uint8array');
      const fileRef = ref(storage, `${storagePath}/${filePath}`);
      const contentType = getMimeType(filePath);

      await uploadBytes(fileRef, data, {
        contentType,
        customMetadata: {
          packageId,
          courseId,
          originalPath: filePath
        }
      });

      uploadedFiles++;
      onProgress?.(Math.round((uploadedFiles / totalFiles) * 100));
    }

    const title = manifest.organizations[0]?.title || manifest.identifier || file.name;

    const pkg = await scormDataService.createPackage({
      courseId,
      lessonId,
      version,
      title,
      storageBasePath: storagePath,
      launchUrl,
      manifest,
      packageSize: file.size,
      uploadedBy,
      uploadedAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    return pkg;
  }

  async deletePackage(packageId: string): Promise<void> {
    const pkg = await scormDataService.getPackageById(packageId);
    if (!pkg) throw new Error('Paquete SCORM no encontrado');

    try {
      const folderRef = ref(storage, pkg.storageBasePath);
      const result = await listAll(folderRef);

      const deletePromises = result.items.map(item => deleteObject(item));
      await Promise.all(deletePromises);

      for (const prefix of result.prefixes) {
        const subResult = await listAll(prefix);
        await Promise.all(subResult.items.map(item => deleteObject(item)));
      }
    } catch (error) {
      console.warn('Error al eliminar archivos de Storage:', error);
    }

    await scormDataService.deletePackage(packageId);
  }

  async getLaunchUrl(packageId: string): Promise<string> {
    const pkg = await scormDataService.getPackageById(packageId);
    if (!pkg) throw new Error('Paquete SCORM no encontrado');

    const fileRef = ref(storage, `${pkg.storageBasePath}/${pkg.launchUrl}`);
    return getDownloadURL(fileRef);
  }

  async getPackage(packageId: string): Promise<SCORMPackage | null> {
    return scormDataService.getPackageById(packageId);
  }
}

export const scormPackageService = new SCORMPackageService();
