/**
 * Página de gestión de paquetes SCORM
 * Lista, sube y elimina paquetes SCORM
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Trash2, ArrowLeft, Plus, Eye } from 'lucide-react';
import { Button } from '@shared/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@shared/components/ui/Card';
import { useAuthStore } from '@app/store/authStore';
import { scormPackageService } from '@shared/services/scorm/scormPackageService';
import SCORMUploader from '../components/SCORMUploader';
import type { SCORMPackage } from '@shared/types/elearning-standards';

export default function SCORMManagementPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [packages, setPackages] = useState<SCORMPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploader, setShowUploader] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    loadPackages();
  }, []);

  const loadPackages = async () => {
    try {
      setLoading(true);
      // Cargar todos los paquetes (sin filtro de curso por ahora)
      const snapshot = await import('firebase/database').then(m => {
        const { ref, get } = m;
        const { database } = require('@app/config/firebase');
        return get(ref(database, 'scormPackages'));
      });

      if (snapshot.exists()) {
        setPackages(Object.values(snapshot.val()) as SCORMPackage[]);
      } else {
        setPackages([]);
      }
    } catch (err) {
      console.error('Error cargando paquetes SCORM:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (packageId: string) => {
    if (!confirm('¿Estás seguro de eliminar este paquete SCORM? Esta acción no se puede deshacer.')) return;

    setDeleting(packageId);
    try {
      await scormPackageService.deletePackage(packageId);
      setPackages(prev => prev.filter(p => p.id !== packageId));
    } catch (err) {
      console.error('Error eliminando paquete:', err);
    } finally {
      setDeleting(null);
    }
  };

  const handleUploadComplete = (pkg: SCORMPackage) => {
    setPackages(prev => [pkg, ...prev]);
    setShowUploader(false);
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('es', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Paquetes SCORM</h1>
            <p className="text-gray-500">Gestiona los paquetes SCORM de la plataforma</p>
          </div>
        </div>
        <Button onClick={() => setShowUploader(!showUploader)}>
          <Plus className="h-4 w-4 mr-2" />
          Subir Paquete
        </Button>
      </div>

      {/* Uploader */}
      {showUploader && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Subir Paquete SCORM</CardTitle>
          </CardHeader>
          <CardContent>
            <SCORMUploader
              courseId=""
              lessonId=""
              uploadedBy={user?.id || ''}
              onUploadComplete={handleUploadComplete}
            />
          </CardContent>
        </Card>
      )}

      {/* Lista de paquetes */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Cargando paquetes...</div>
      ) : packages.length === 0 ? (
        <div className="text-center py-12">
          <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No hay paquetes SCORM subidos</p>
          <p className="text-gray-400 text-sm mt-1">Sube un paquete .zip con imsmanifest.xml</p>
        </div>
      ) : (
        <div className="space-y-3">
          {packages.map((pkg) => (
            <Card key={pkg.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Package className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">{pkg.title}</h3>
                      <div className="flex gap-3 text-sm text-gray-500 mt-0.5">
                        <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                          SCORM {pkg.version}
                        </span>
                        <span>{formatSize(pkg.packageSize)}</span>
                        <span>{formatDate(pkg.uploadedAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/courses/${pkg.courseId}/lesson/${pkg.lessonId}`)}
                      disabled={!pkg.courseId || !pkg.lessonId}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(pkg.id)}
                      disabled={deleting === pkg.id}
                    >
                      <Trash2 className={`h-4 w-4 ${deleting === pkg.id ? 'text-gray-300' : 'text-red-500'}`} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
