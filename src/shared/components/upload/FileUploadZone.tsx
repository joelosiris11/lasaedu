import { useState, useRef, useCallback } from 'react';
import { Upload, X, FileText, Image, FileArchive, AlertCircle } from 'lucide-react';
import { validateFile, getAcceptString, type FileValidationOptions } from '@shared/utils/fileValidation';
import { fileUploadService, type UploadResult } from '@shared/services/fileUploadService';

export interface UploadedFile {
  id: string;
  name: string;
  url: string;
  size: number;
  contentType: string;
}

interface FileUploadZoneProps {
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  maxFiles?: number;
  allowedExtensions?: string[];
  maxFileSize?: number;
  courseId?: string;
  lessonId?: string;
  storagePath?: 'attachment' | 'submission';
  studentId?: string;
  disabled?: boolean;
}

interface UploadingFile {
  id: string;
  name: string;
  progress: number;
  error?: string;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileIcon(contentType: string) {
  if (contentType.startsWith('image/')) return <Image className="w-5 h-5 text-blue-500" />;
  if (contentType.includes('zip') || contentType.includes('rar')) return <FileArchive className="w-5 h-5 text-yellow-500" />;
  return <FileText className="w-5 h-5 text-gray-500" />;
}

export default function FileUploadZone({
  files,
  onFilesChange,
  maxFiles = 10,
  allowedExtensions,
  maxFileSize = 25 * 1024 * 1024,
  courseId,
  lessonId,
  storagePath = 'attachment',
  studentId,
  disabled = false,
}: FileUploadZoneProps) {
  const [uploading, setUploading] = useState<UploadingFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const validationOptions: FileValidationOptions = {
    allowedExtensions,
    maxFileSize,
    maxFiles,
  };

  const processFiles = useCallback(async (fileList: FileList | File[]) => {
    const newFiles = Array.from(fileList);
    const newErrors: string[] = [];

    // Check max files limit
    if (files.length + newFiles.length > maxFiles) {
      newErrors.push(`Maximo ${maxFiles} archivos permitidos. Ya tienes ${files.length}.`);
      setErrors(newErrors);
      return;
    }

    setErrors([]);
    const uploadPromises: Promise<void>[] = [];

    for (const file of newFiles) {
      // Validate each file
      const result = await validateFile(file, validationOptions);
      if (!result.valid) {
        newErrors.push(result.error!);
        continue;
      }

      const uploadId = generateId();
      setUploading(prev => [...prev, { id: uploadId, name: file.name, progress: 0 }]);

      const uploadPromise = (async () => {
        try {
          let uploadResult: UploadResult;

          if (storagePath === 'submission' && courseId && lessonId && studentId) {
            uploadResult = await fileUploadService.uploadSubmission(
              file, courseId, lessonId, studentId,
              (p) => setUploading(prev =>
                prev.map(u => u.id === uploadId ? { ...u, progress: p.percent } : u)
              ),
              validationOptions
            );
          } else if (courseId && lessonId) {
            uploadResult = await fileUploadService.uploadAttachment(
              file, courseId, lessonId,
              (p) => setUploading(prev =>
                prev.map(u => u.id === uploadId ? { ...u, progress: p.percent } : u)
              ),
              validationOptions
            );
          } else {
            // Fallback to generic document upload
            uploadResult = await fileUploadService.uploadDocument(
              file, courseId, lessonId,
              (p) => setUploading(prev =>
                prev.map(u => u.id === uploadId ? { ...u, progress: p.percent } : u)
              )
            );
          }

          const uploadedFile: UploadedFile = {
            id: generateId(),
            name: file.name,
            url: uploadResult.url,
            size: uploadResult.size,
            contentType: uploadResult.contentType,
          };

          onFilesChange([...files, uploadedFile]);
          setUploading(prev => prev.filter(u => u.id !== uploadId));
        } catch (err: any) {
          setUploading(prev =>
            prev.map(u => u.id === uploadId ? { ...u, error: err.message } : u)
          );
          newErrors.push(`Error subiendo "${file.name}": ${err.message}`);
        }
      })();

      uploadPromises.push(uploadPromise);
    }

    await Promise.all(uploadPromises);
    if (newErrors.length > 0) {
      setErrors(prev => [...prev, ...newErrors]);
    }
  }, [files, maxFiles, onFilesChange, courseId, lessonId, studentId, storagePath, validationOptions]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    processFiles(e.dataTransfer.files);
  }, [disabled, processFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
    }
    // Reset input so same file can be re-selected
    e.target.value = '';
  }, [processFiles]);

  const handleRemove = useCallback((fileId: string) => {
    onFilesChange(files.filter(f => f.id !== fileId));
  }, [files, onFilesChange]);

  const dismissUploadError = useCallback((uploadId: string) => {
    setUploading(prev => prev.filter(u => u.id !== uploadId));
  }, []);

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
          ${disabled ? 'border-gray-200 bg-gray-50 cursor-not-allowed' : ''}
          ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
        `}
      >
        <Upload className={`w-8 h-8 mx-auto mb-2 ${dragOver ? 'text-blue-500' : 'text-gray-400'}`} />
        <p className="text-sm text-gray-600">
          Arrastra archivos aqui o <span className="text-blue-600 font-medium">haz clic para seleccionar</span>
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Max {formatFileSize(maxFileSize)} por archivo
          {maxFiles < 10 && ` · Max ${maxFiles} archivos`}
          {allowedExtensions && ` · ${allowedExtensions.join(', ')}`}
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={getAcceptString(allowedExtensions)}
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled}
        />
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="space-y-1">
          {errors.map((err, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-md p-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{err}</span>
              <button onClick={() => setErrors(prev => prev.filter((_, idx) => idx !== i))} className="ml-auto">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Uploading progress */}
      {uploading.map(u => (
        <div key={u.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-700 truncate">{u.name}</p>
            {u.error ? (
              <div className="flex items-center gap-1 text-xs text-red-600">
                <AlertCircle className="w-3 h-3" />
                <span>{u.error}</span>
              </div>
            ) : (
              <div className="mt-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${u.progress}%` }}
                />
              </div>
            )}
          </div>
          {u.error && (
            <button onClick={() => dismissUploadError(u.id)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ))}

      {/* Uploaded files list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map(file => (
            <div key={file.id} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg">
              {getFileIcon(file.contentType)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 truncate">{file.name}</p>
                <p className="text-xs text-gray-400">{formatFileSize(file.size)}</p>
              </div>
              {!disabled && (
                <button
                  onClick={() => handleRemove(file.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                  title="Eliminar archivo"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
