/**
 * H5P Uploader Component
 * Permite a los profesores subir paquetes H5P (.h5p o .zip)
 */

import { useState, useRef } from 'react';
import { Upload, AlertCircle, CheckCircle, X } from 'lucide-react';
import { H5PContentService } from '@shared/services/h5p/h5pContentService';
import type { H5PUploadProgress } from '@shared/types/h5p';

interface H5PUploaderProps {
  courseId: string;
  userId: string;
  onUploadSuccess?: (contentId: string) => void;
  onUploadError?: (error: string) => void;
}

export function H5PUploader({
  courseId,
  userId,
  onUploadSuccess,
  onUploadError
}: H5PUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<H5PUploadProgress | null>(null);
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    error?: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const h5pService = new H5PContentService();

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      const droppedFile = droppedFiles[0];
      await handleFileSelect(droppedFile);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setValidationResult(null);
    setUploadSuccess(false);

    // Validar el archivo
    const result = await h5pService.validatePackage(selectedFile);
    setValidationResult(result);

    if (!result.isValid) {
      onUploadError?.(result.error || 'Archivo inválido');
    }
  };

  const handleUpload = async () => {
    if (!file || !title || !validationResult?.isValid) {
      onUploadError?.('Por favor selecciona un archivo válido e ingresa un título');
      return;
    }

    try {
      setUploading(true);
      setProgress({
        fileSize: file.size,
        uploadedBytes: 0,
        percentage: 0,
        status: 'uploading'
      });

      const tagArray = tags
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      const contentMeta = await h5pService.uploadPackage(
        file,
        {
          title,
          description,
          tags: tagArray,
          createdBy: userId
        },
        (percent) => {
          setProgress(prev => prev ? { ...prev, percentage: percent } : null);
        }
      );

      setUploadSuccess(true);
      setFile(null);
      setTitle('');
      setDescription('');
      setTags('');
      setValidationResult(null);
      onUploadSuccess?.(contentMeta.id);

      setTimeout(() => setUploadSuccess(false), 5000);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
      onUploadError?.(errorMsg);
    } finally {
      setUploading(false);
      setProgress(null);
    }
  };

  const handleReset = () => {
    setFile(null);
    setTitle('');
    setDescription('');
    setTags('');
    setValidationResult(null);
    setUploadSuccess(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      {uploadSuccess && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <p className="text-green-700">¡Contenido H5P subido exitosamente!</p>
        </div>
      )}

      {/* Zona de carga */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".h5p,.zip"
          onChange={handleFileChange}
          className="hidden"
        />

        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <h3 className="font-semibold text-gray-900 mb-1">
          Arrastra un archivo H5P aquí
        </h3>
        <p className="text-sm text-gray-600">o haz clic para seleccionar</p>
        <p className="text-xs text-gray-500 mt-2">Formatos: .h5p, .zip</p>
      </div>

      {/* Validación */}
      {validationResult && (
        <div
          className={`p-4 rounded-lg border ${
            validationResult.isValid
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}
        >
          <div className="flex items-center gap-3">
            {validationResult.isValid ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600" />
            )}
            <div>
              <p
                className={`font-semibold ${
                  validationResult.isValid ? 'text-green-900' : 'text-red-900'
                }`}
              >
                {validationResult.isValid
                  ? 'Archivo válido'
                  : 'Archivo inválido'}
              </p>
              {validationResult.error && (
                <p className="text-sm text-red-700">{validationResult.error}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Detalles */}
      {file && validationResult?.isValid && (
        <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Nombre del contenido *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Introducción a Python"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Descripción
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe el contenido..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Etiquetas (separadas por comas)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="ej: programación, python, introducción"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Progreso */}
          {progress && uploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subiendo...</span>
                <span>{progress.percentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-3">
            <button
              onClick={handleUpload}
              disabled={uploading || !title}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {uploading ? 'Subiendo...' : 'Subir contenido H5P'}
            </button>
            <button
              onClick={handleReset}
              disabled={uploading}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
