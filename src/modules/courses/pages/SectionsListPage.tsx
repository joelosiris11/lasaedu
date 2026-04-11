import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@app/store/authStore';
import {
  courseService,
  sectionService,
  type DBCourse,
  type DBSection,
} from '@shared/services/dataService';
import {
  ArrowLeft,
  Plus,
  Users,
  Calendar,
  Edit3,
  Archive,
  Clock,
  Layers,
  Globe,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { Card, CardContent } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';

const statusColors: Record<DBSection['status'], string> = {
  activa: 'bg-green-100 text-green-800',
  finalizada: 'bg-gray-100 text-gray-800',
  archivada: 'bg-yellow-100 text-yellow-800',
  borrador: 'bg-blue-100 text-blue-800',
};

const statusLabels: Record<DBSection['status'], string> = {
  activa: 'Activa',
  finalizada: 'Finalizada',
  archivada: 'Archivada',
  borrador: 'Borrador',
};

const accessIcons: Record<DBSection['accessType'], typeof Globe> = {
  publico: Globe,
  privado: Lock,
  restringido: ShieldCheck,
};

const accessLabels: Record<DBSection['accessType'], string> = {
  publico: 'Público',
  privado: 'Privado (código)',
  restringido: 'Restringido (aprobación)',
};

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function SectionsListPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [course, setCourse] = useState<DBCourse | null>(null);
  const [sections, setSections] = useState<DBSection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!courseId) return;
    const load = async () => {
      setLoading(true);
      try {
        const [c, s] = await Promise.all([
          courseService.getById(courseId),
          sectionService.getByCourse(courseId),
        ]);
        setCourse(c);
        setSections(s.sort((a, b) => b.createdAt - a.createdAt));
      } catch (err) {
        console.error('Error loading sections:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [courseId]);

  const handleArchive = async (sectionId: string) => {
    if (!confirm('¿Archivar esta sección?')) return;
    const updated = await sectionService.update(sectionId, { status: 'archivada' });
    if (updated) {
      setSections(prev => prev.map(s => (s.id === sectionId ? { ...s, status: 'archivada' } : s)));
    }
  };

  const canEdit = user?.role === 'admin' || user?.role === 'teacher';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => navigate(`/courses/${courseId}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver al curso
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-red-600" />
              <h1 className="text-xl font-bold text-gray-900">Secciones</h1>
            </div>
            {course && (
              <p className="text-sm text-gray-500">
                {course.title}
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs bg-red-50 text-red-700 font-medium">
                  Template
                </span>
              </p>
            )}
          </div>
        </div>
        {canEdit && (
          <Button onClick={() => navigate(`/my-sections/course/${courseId}/new`)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nueva Sección
          </Button>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-50 rounded-lg">
                <Layers className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Total</p>
                <p className="text-lg font-bold">{sections.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-50 rounded-lg">
                <Clock className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Activas</p>
                <p className="text-lg font-bold">{sections.filter(s => s.status === 'activa').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-50 rounded-lg">
                <Users className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Estudiantes</p>
                <p className="text-lg font-bold">{sections.reduce((sum, s) => sum + s.studentsCount, 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-50 rounded-lg">
                <Archive className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Archivadas</p>
                <p className="text-lg font-bold">{sections.filter(s => s.status === 'archivada').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sections List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-5 bg-gray-200 rounded w-1/3 mb-3" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : sections.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Layers className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">Sin secciones</h3>
            <p className="text-gray-500 mb-4">
              Crea secciones para inscribir estudiantes con fechas diferentes.
            </p>
            {canEdit && (
              <Button onClick={() => navigate(`/my-sections/course/${courseId}/new`)}>
                <Plus className="h-4 w-4 mr-2" />
                Crear primera sección
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sections.map(section => {
            const AccessIcon = accessIcons[section.accessType];
            return (
              <Card key={section.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 truncate">{section.title}</h3>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[section.status]}`}>
                          {statusLabels[section.status]}
                        </span>
                      </div>
                      {section.description && (
                        <p className="text-sm text-gray-500 mb-2 line-clamp-1">{section.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(section.startDate)} - {formatDate(section.endDate)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {section.studentsCount} estudiantes
                          {section.enrollmentLimit && ` / ${section.enrollmentLimit}`}
                        </span>
                        <span className="flex items-center gap-1">
                          <AccessIcon className="h-3.5 w-3.5" />
                          {accessLabels[section.accessType]}
                        </span>
                      </div>
                    </div>

                    {canEdit && (
                      <div className="flex items-center gap-1 ml-4 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/sections/${section.id}/dates`)}
                          title="Fechas"
                        >
                          <Calendar className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/my-sections/${section.id}/edit`)}
                          title="Editar"
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/sections/${section.id}/grades`)}
                          title="Calificaciones"
                        >
                          <Users className="h-4 w-4" />
                        </Button>
                        {section.status !== 'archivada' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-yellow-600 hover:bg-yellow-50"
                            onClick={() => handleArchive(section.id)}
                            title="Archivar"
                          >
                            <Archive className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
