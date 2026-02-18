import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '@app/config/firebase';
import { validateFile, type FileValidationOptions } from '@shared/utils/fileValidation';

export interface UploadProgress {
  percent: number;
  bytesTransferred: number;
  totalBytes: number;
}

export interface UploadResult {
  url: string;
  filename: string;
  size: number;
  contentType: string;
  metadata?: any;
}

class FileUploadService {
  private getStoragePath(type: string, courseId?: string, lessonId?: string): string {
    const basePath = 'uploads';
    if (courseId && lessonId) {
      return `${basePath}/courses/${courseId}/lessons/${lessonId}/${type}`;
    } else if (courseId) {
      return `${basePath}/courses/${courseId}/${type}`;
    }
    return `${basePath}/${type}`;
  }

  private generateUniqueFilename(originalName: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    const extension = originalName.split('.').pop();
    const nameWithoutExtension = originalName.replace(/\.[^/.]+$/, '');
    return `${nameWithoutExtension}_${timestamp}_${random}.${extension}`;
  }

  private validateFile(file: File, type: 'image' | 'video' | 'audio' | 'document'): void {
    const maxSizes = {
      image: 10 * 1024 * 1024, // 10MB
      video: 500 * 1024 * 1024, // 500MB
      audio: 50 * 1024 * 1024, // 50MB
      document: 25 * 1024 * 1024 // 25MB
    };

    const allowedTypes = {
      image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      video: ['video/mp4', 'video/webm', 'video/quicktime'],
      audio: ['audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a'],
      document: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.oasis.opendocument.text',
        'application/vnd.oasis.opendocument.spreadsheet',
        'application/vnd.oasis.opendocument.presentation',
        'application/zip',
        'application/x-zip-compressed',
        'application/x-rar-compressed',
        'application/vnd.rar',
        'text/csv',
        'text/plain',
      ]
    };

    if (file.size > maxSizes[type]) {
      throw new Error(`El archivo es demasiado grande. Máximo permitido: ${Math.round(maxSizes[type] / (1024 * 1024))}MB`);
    }

    if (!allowedTypes[type].includes(file.type)) {
      throw new Error(`Tipo de archivo no permitido. Tipos soportados: ${allowedTypes[type].join(', ')}`);
    }
  }

  async uploadFile(
    file: File,
    type: 'image' | 'video' | 'audio' | 'document',
    courseId?: string,
    lessonId?: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    try {
      this.validateFile(file, type);

      const filename = this.generateUniqueFilename(file.name);
      const storagePath = this.getStoragePath(type, courseId, lessonId);
      const storageRef = ref(storage, `${storagePath}/${filename}`);

      // Create custom metadata
      const metadata = {
        contentType: file.type,
        customMetadata: {
          originalName: file.name,
          uploadedAt: new Date().toISOString(),
          fileType: type,
          ...(courseId && { courseId }),
          ...(lessonId && { lessonId })
        }
      };

      // Upload with progress tracking (simplified for now)
      const snapshot = await uploadBytes(storageRef, file, metadata);
      
      if (onProgress) {
        onProgress({
          percent: 100,
          bytesTransferred: file.size,
          totalBytes: file.size
        });
      }

      const downloadURL = await getDownloadURL(snapshot.ref);

      return {
        url: downloadURL,
        filename,
        size: file.size,
        contentType: file.type,
        metadata: snapshot.metadata
      };
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }

  async uploadImage(
    file: File,
    courseId?: string,
    lessonId?: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    return this.uploadFile(file, 'image', courseId, lessonId, onProgress);
  }

  async uploadVideo(
    file: File,
    courseId?: string,
    lessonId?: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    return this.uploadFile(file, 'video', courseId, lessonId, onProgress);
  }

  async uploadAudio(
    file: File,
    courseId?: string,
    lessonId?: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    return this.uploadFile(file, 'audio', courseId, lessonId, onProgress);
  }

  async uploadDocument(
    file: File,
    courseId?: string,
    lessonId?: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    return this.uploadFile(file, 'document', courseId, lessonId, onProgress);
  }

  /**
   * Upload an attachment file (resource/reference) with magic bytes validation.
   */
  async uploadAttachment(
    file: File,
    courseId: string,
    lessonId: string,
    onProgress?: (progress: UploadProgress) => void,
    validationOptions?: FileValidationOptions
  ): Promise<UploadResult> {
    // Validate with magic bytes
    const result = await validateFile(file, validationOptions);
    if (!result.valid) {
      throw new Error(result.error);
    }

    const filename = this.generateUniqueFilename(file.name);
    const storagePath = `uploads/courses/${courseId}/lessons/${lessonId}/attachments`;
    const storageRef = ref(storage, `${storagePath}/${filename}`);

    const metadata = {
      contentType: file.type,
      customMetadata: {
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
        courseId,
        lessonId,
      },
    };

    const snapshot = await uploadBytes(storageRef, file, metadata);
    if (onProgress) {
      onProgress({ percent: 100, bytesTransferred: file.size, totalBytes: file.size });
    }

    const downloadURL = await getDownloadURL(snapshot.ref);
    return {
      url: downloadURL,
      filename,
      size: file.size,
      contentType: file.type,
      metadata: snapshot.metadata,
    };
  }

  /**
   * Upload a student submission file with magic bytes validation.
   */
  async uploadSubmission(
    file: File,
    courseId: string,
    lessonId: string,
    studentId: string,
    onProgress?: (progress: UploadProgress) => void,
    validationOptions?: FileValidationOptions
  ): Promise<UploadResult> {
    const result = await validateFile(file, validationOptions);
    if (!result.valid) {
      throw new Error(result.error);
    }

    const filename = this.generateUniqueFilename(file.name);
    const storagePath = `uploads/courses/${courseId}/lessons/${lessonId}/submissions/${studentId}`;
    const storageRef = ref(storage, `${storagePath}/${filename}`);

    const metadata = {
      contentType: file.type,
      customMetadata: {
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
        courseId,
        lessonId,
        studentId,
      },
    };

    const snapshot = await uploadBytes(storageRef, file, metadata);
    if (onProgress) {
      onProgress({ percent: 100, bytesTransferred: file.size, totalBytes: file.size });
    }

    const downloadURL = await getDownloadURL(snapshot.ref);
    return {
      url: downloadURL,
      filename,
      size: file.size,
      contentType: file.type,
      metadata: snapshot.metadata,
    };
  }

  async deleteFile(url: string): Promise<void> {
    try {
      const storageRef = ref(storage, url);
      await deleteObject(storageRef);
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }

  getFileTypeFromUrl(url: string): 'image' | 'video' | 'audio' | 'document' | 'unknown' {
    const extension = url.split('.').pop()?.toLowerCase();
    
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '')) {
      return 'image';
    }
    if (['mp4', 'webm', 'mov'].includes(extension || '')) {
      return 'video';
    }
    if (['mp3', 'wav', 'ogg', 'm4a'].includes(extension || '')) {
      return 'audio';
    }
    if (['pdf', 'doc', 'docx'].includes(extension || '')) {
      return 'document';
    }
    
    return 'unknown';
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async compressImage(file: File, maxWidth: number = 1920, maxHeight: number = 1080, quality: number = 0.8): Promise<File> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions
        let { width, height } = img;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }

        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        ctx?.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              resolve(compressedFile);
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }

  async getMediaDuration(file: File): Promise<number> {
    return new Promise((resolve, reject) => {
      const media = file.type.startsWith('video/') 
        ? document.createElement('video')
        : document.createElement('audio');

      media.addEventListener('loadedmetadata', () => {
        resolve(media.duration);
        URL.revokeObjectURL(media.src);
      });

      media.addEventListener('error', () => {
        reject(new Error('Failed to load media'));
        URL.revokeObjectURL(media.src);
      });

      media.src = URL.createObjectURL(file);
    });
  }
}

export const fileUploadService = new FileUploadService();
export default fileUploadService;