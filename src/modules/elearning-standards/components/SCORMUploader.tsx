/**
 * Componente para subir paquetes SCORM (.zip)
 * Incluye drag-and-drop, validación y barra de progreso
 */

import { useState, useRef, useCallback } from 'react';
import { Upload, CheckCircle, AlertTriangle, X, Package } from 'lucide-react';
import { Button } from '@shared/components/ui/Button';
import { scormPackageService } from '@shared/services/scorm/scormPackageService';
import type { SCORMPackage, SCORMVersion } from '@shared/types/elearning-standards';

interface SCORMUploaderProps {
  courseId: string;
  lessonId: string;
  uploadedBy: string;
  onUploadComplete: (pkg: SCORMPackage) => void;
}

export default function SCORMUploader({
  courseId,
  lessonId,
  uploadedBy,
  onUploadComplete,
}: SCORMUploaderProps) {
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [validating, setValidating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [validation, setValidation] = useState<{
    isValid: boolean;
    version?: SCORMVersion;
    title?: string;
    error?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setValidation(null);
    setValidating(true);

    try {
      const result = await scormPackageService.validatePackage(selectedFile);
      setValidation(result);
    } catch (err) {
      setValidation({
        isValid: false,
        error: err instanceof Error ? err.message : 'Error de validación'
      });
    } finally {
      setValidating(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFile(droppedFile);
  }, [handleFile]);

  const handleUpload = async () => {
    if (!file || !validation?.isValid) return;

    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      const pkg = await scormPackageService.uploadPackage(
        file,
        courseId,
        lessonId,
        uploadedBy,
        (percent) => setProgress(percent)
      );
      onUploadComplete(pkg);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir el paquete');
    } finally {
      setUploading(false);
    }
  };

  const handleClear = () => {
    setFile(null);
    setValidation(null);
    setError(null);
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      {/* Zona de drop */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          dragOver
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <Upload className={`h-10 w-10 mx-auto mb-3 ${dragOver ? 'text-blue-500' : 'text-gray-400'}`} />
        <p className="text-gray-600 font-medium">
          Arrastra un paquete SCORM aquí o haz clic para seleccionar
        </p>
        <p className="text-gray-400 text-sm mt-1">Archivos .zip con imsmanifest.xml</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </div>

      {/* Archivo seleccionado */}
      {file && (
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package className="h-8 w-8 text-blue-500" />
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-gray-500">{formatSize(file.size)}</p>
              </div>
            </div>
            {!uploading && (
              <button onClick={handleClear} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Estado de validación */}
          {validating && (
            <p className="mt-3 text-sm text-gray-500">Validando paquete...</p>
          )}

          {validation && !validating && (
            <div className={`mt-3 flex items-center gap-2 text-sm ${
              validation.isValid ? 'text-green-600' : 'text-red-600'
            }`}>
              {validation.isValid ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  <span>SCORM {validation.version} &mdash; {validation.title}</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4" />
                  <span>{validation.error}</span>
                </>
              )}
            </div>
          )}

          {/* Barra de progreso */}
          {uploading && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                <span>Subiendo...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Botón de subida */}
          {validation?.isValid && !uploading && (
            <div className="mt-4">
              <Button onClick={handleUpload}>
                <Upload className="h-4 w-4 mr-2" />
                Subir Paquete SCORM
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Error de subida */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
          <AlertTriangle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
