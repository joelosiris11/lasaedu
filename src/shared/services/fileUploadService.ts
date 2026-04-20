import { auth } from '@app/config/firebase';
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

// Default is empty string → requests are sent relative to the current origin
// (Vite dev server), which proxies /upload and /files to the file-server.
// To bypass the proxy, set VITE_FILE_SERVER_URL to an absolute URL.
const FILE_SERVER_URL = import.meta.env.VITE_FILE_SERVER_URL ?? '';

class FileUploadService {
  private async getAuthToken(): Promise<string> {
    try {
      const user = auth.currentUser;
      if (user) {
        return await user.getIdToken();
      }
    } catch { /* ignore */ }
    return '';
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
      image: 10 * 1024 * 1024,
      video: 500 * 1024 * 1024,
      audio: 50 * 1024 * 1024,
      document: 25 * 1024 * 1024
    };

    if (file.size > maxSizes[type]) {
      throw new Error(`El archivo es demasiado grande. Máximo permitido: ${Math.round(maxSizes[type] / (1024 * 1024))}MB`);
    }
  }

  private async uploadToServer(
    file: File,
    storagePath: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    const token = await this.getAuthToken();
    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();

    const result = await new Promise<UploadResult>((resolve, reject) => {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress({
            percent: Math.round((e.loaded / e.total) * 100),
            bytesTransferred: e.loaded,
            totalBytes: e.total,
          });
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve({
              url: data.url,
              filename: data.filename,
              size: data.size || file.size,
              contentType: data.contentType || file.type,
              metadata: data,
            });
          } catch {
            reject(new Error('Invalid response from file server'));
          }
        } else {
          reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
      xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

      xhr.open('POST', `${FILE_SERVER_URL}/upload/${storagePath}`);
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
      xhr.send(formData);
    });

    return result;
  }

  async uploadFile(
    file: File,
    type: 'image' | 'video' | 'audio' | 'document',
    courseId?: string,
    lessonId?: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    this.validateFile(file, type);
    const storagePath = courseId && lessonId
      ? `courses/${courseId}/lessons/${lessonId}/${type}`
      : courseId
      ? `courses/${courseId}/${type}`
      : `general/${type}`;

    return this.uploadToServer(file, storagePath, onProgress);
  }

  async uploadImage(file: File, courseId?: string, lessonId?: string, onProgress?: (progress: UploadProgress) => void): Promise<UploadResult> {
    return this.uploadFile(file, 'image', courseId, lessonId, onProgress);
  }

  async uploadVideo(file: File, courseId?: string, lessonId?: string, onProgress?: (progress: UploadProgress) => void): Promise<UploadResult> {
    return this.uploadFile(file, 'video', courseId, lessonId, onProgress);
  }

  async uploadAudio(file: File, courseId?: string, lessonId?: string, onProgress?: (progress: UploadProgress) => void): Promise<UploadResult> {
    return this.uploadFile(file, 'audio', courseId, lessonId, onProgress);
  }

  async uploadDocument(file: File, courseId?: string, lessonId?: string, onProgress?: (progress: UploadProgress) => void): Promise<UploadResult> {
    return this.uploadFile(file, 'document', courseId, lessonId, onProgress);
  }

  async uploadAttachment(
    file: File,
    courseId: string,
    lessonId: string,
    onProgress?: (progress: UploadProgress) => void,
    validationOptions?: FileValidationOptions
  ): Promise<UploadResult> {
    if (validationOptions) {
      const result = await validateFile(file, validationOptions);
      if (!result.valid) throw new Error(result.error);
    }
    return this.uploadToServer(file, `courses/${courseId}/lessons/${lessonId}/attachments`, onProgress);
  }

  async uploadSubmission(
    file: File,
    courseId: string,
    lessonId: string,
    studentId: string,
    onProgress?: (progress: UploadProgress) => void,
    validationOptions?: FileValidationOptions
  ): Promise<UploadResult> {
    if (validationOptions) {
      const result = await validateFile(file, validationOptions);
      if (!result.valid) throw new Error(result.error);
    }
    return this.uploadToServer(file, `courses/${courseId}/lessons/${lessonId}/submissions/${studentId}`, onProgress);
  }

  async deleteFile(url: string): Promise<void> {
    try {
      const token = await this.getAuthToken();
      const fileUrl = url.replace(`${FILE_SERVER_URL}/files/`, '');
      await fetch(`${FILE_SERVER_URL}/files/${fileUrl}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }

  getFileTypeFromUrl(url: string): 'image' | 'video' | 'audio' | 'document' | 'unknown' {
    const extension = url.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '')) return 'image';
    if (['mp4', 'webm', 'mov'].includes(extension || '')) return 'video';
    if (['mp3', 'wav', 'ogg', 'm4a'].includes(extension || '')) return 'audio';
    if (['pdf', 'doc', 'docx'].includes(extension || '')) return 'document';
    return 'unknown';
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async compressImage(file: File, maxWidth = 1920, maxHeight = 1080, quality = 0.8): Promise<File> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth) { height = (height * maxWidth) / width; width = maxWidth; }
        if (height > maxHeight) { width = (width * maxHeight) / height; height = maxHeight; }
        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => blob ? resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() })) : reject(new Error('Failed to compress')),
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }
}

export const fileUploadService = new FileUploadService();
export default fileUploadService;
