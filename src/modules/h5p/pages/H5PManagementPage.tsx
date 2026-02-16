/**
 * H5P Management Page
 * Página para gestionar contenido H5P de un curso
 */

import { useState } from 'react';
import { Plus, UploadCloud, Zap } from 'lucide-react';
import { H5PUploader } from '../components/H5PUploader';
import { H5PContentBank } from '../components/H5PContentBank';
import { useAuthStore } from '@app/store/authStore';
import { useParams } from 'react-router-dom';

type TabType = 'upload' | 'library' | 'manage';

export default function H5PManagementPage() {
  const { user } = useAuthStore();
  const { courseId } = useParams<{ courseId: string }>();
  const [activeTab, setActiveTab] = useState<TabType>('upload');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!user || !courseId) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-600">No autorizado</p>
      </div>
    );
  }

  const handleUploadSuccess = (contentId: string) => {
    setSuccessMessage(`Contenido H5P subido exitosamente (ID: ${contentId})`);
    setTimeout(() => setSuccessMessage(null), 5000);
    setActiveTab('manage');
  };

  const handleUploadError = (error: string) => {
    console.error('Upload error:', error);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Gestor de Contenido H5P
        </h1>
        <p className="text-gray-600">
          Sube, gestiona y reutiliza contenido interactivo H5P en tus cursos
        </p>
      </div>

      {/* Mensaje de éxito */}
      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-700">{successMessage}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-8 border-b border-gray-200">
        <div className="flex gap-8">
          <button
            onClick={() => setActiveTab('upload')}
            className={`py-3 px-1 font-medium border-b-2 transition-colors ${
              activeTab === 'upload'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <UploadCloud className="w-5 h-5 inline mr-2" />
            Subir Contenido
          </button>

          <button
            onClick={() => setActiveTab('library')}
            className={`py-3 px-1 font-medium border-b-2 transition-colors ${
              activeTab === 'library'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Zap className="w-5 h-5 inline mr-2" />
            Biblioteca
          </button>

          <button
            onClick={() => setActiveTab('manage')}
            className={`py-3 px-1 font-medium border-b-2 transition-colors ${
              activeTab === 'manage'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Plus className="w-5 h-5 inline mr-2" />
            Mi Contenido
          </button>
        </div>
      </div>

      {/* Contenido de tabs */}
      <div>
        {activeTab === 'upload' && (
          <div className="bg-white rounded-lg border border-gray-200 p-8">
            <H5PUploader
              courseId={courseId}
              userId={user.id}
              onUploadSuccess={handleUploadSuccess}
              onUploadError={handleUploadError}
            />
          </div>
        )}

        {activeTab === 'library' && (
          <div className="bg-white rounded-lg border border-gray-200 p-8">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Biblioteca de Contenido Reutilizable
              </h2>
              <p className="text-gray-600">
                Explora y reutiliza contenido H5P de otros cursos y profesores
              </p>
            </div>
            <H5PContentBank courseId={courseId} isSelectable={true} />
          </div>
        )}

        {activeTab === 'manage' && (
          <div className="bg-white rounded-lg border border-gray-200 p-8">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Mi Contenido H5P
              </h2>
              <p className="text-gray-600">
                Gestiona el contenido H5P que has subido a este curso
              </p>
            </div>
            <H5PContentBank courseId={courseId} />
          </div>
        )}
      </div>

      {/* Info Cards */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-2">
            ¿Qué es H5P?
          </h3>
          <p className="text-sm text-blue-800">
            H5P es un estándar abierto para crear contenido interactivo HTML5
            como videos interactivos, juegos, cuestionarios y más.
          </p>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="font-semibold text-green-900 mb-2">
            Formatos Soportados
          </h3>
          <p className="text-sm text-green-800">
            Soportamos archivos .h5p y .zip estándar. Descarga plantillas desde
            h5p.org/content-types
          </p>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
          <h3 className="font-semibold text-purple-900 mb-2">
            Reutilización
          </h3>
          <p className="text-sm text-purple-800">
            Marca tu contenido como reutilizable para que otros profesores
            puedan usarlo en sus cursos.
          </p>
        </div>
      </div>
    </div>
  );
}
