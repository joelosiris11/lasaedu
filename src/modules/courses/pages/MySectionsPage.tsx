import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@app/store/authStore';
import {
  sectionService,
  courseService,
  legacyEnrollmentService,
  type DBSection,
  type DBEnrollment,
  type DBCourse,
} from '@shared/services/dataService';
import { firebaseDB } from '@shared/services/firebaseDataService';
import {
  Layers,
  BookOpen,
  Users,
  Calendar,
  Clock,
  Eye,
  Edit3,
  Plus,
  Loader2,
  ArrowRight,
  ClipboardList,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';

interface EnrichedSection extends DBSection {
  progress?: number;
  enrollmentStatus?: string;
}

const statusColors: Record<string, string> = {
  activa: 'bg-green-100 text-green-700',
  finalizada: 'bg-gray-100 text-gray-700',
  archivada: 'bg-yellow-100 text-yellow-700',
  borrador: 'bg-blue-100 text-blue-700',
};

function formatDateShort(ts: number): string {
  return new Date(ts).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function MySectionsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [sections, setSections] = useState<EnrichedSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [teacherCourses, setTeacherCourses] = useState<DBCourse[]>([]);
  const [showNewSectionPicker, setShowNewSectionPicker] = useState(false);

  const isStudent = user?.role === 'student';
  const isTeacher = user?.role === 'teacher';

  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      setLoading(true);
      try {
        if (isStudent) {
          // Students: load enrolled sections via enrollments
          const enrollments = await firebaseDB.getEnrollmentsByUser(user.id);
          const sectionEnrollments = enrollments.filter((e: DBEnrollment) => e.sectionId && e.status === 'active');

          const enriched: EnrichedSection[] = [];
          for (const enrollment of sectionEnrollments) {
            const section = await sectionService.getById(enrollment.sectionId!);
            if (section) {
              enriched.push({
                ...section,
                progress: enrollment.progress || 0,
                enrollmentStatus: enrollment.status,
              });
            }
          }
          setSections(enriched);
        } else if (isTeacher || user?.role === 'admin') {
          // Teachers/Admin: load all their sections
          const allSections = user.role === 'admin'
            ? await sectionService.getAll()
            : await sectionService.getByInstructor(user.id);
          setSections(allSections.sort((a, b) => b.createdAt - a.createdAt));
          // Also load courses for "new section" picker
          const courses = user.role === 'admin'
            ? await courseService.getAll()
            : await courseService.getByInstructor(user.id);
          setTeacherCourses(courses);
        }
      } catch (err) {
        console.error('Error loading sections:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.id]);

  const filtered = sections.filter(s => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return s.title.toLowerCase().includes(q) || s.courseTitle.toLowerCase().includes(q);
  });

  // Group by course for teacher view
  const groupedByCourse = new Map<string, EnrichedSection[]>();
  if (!isStudent) {
    for (const section of filtered) {
      const group = groupedByCourse.get(section.courseId) || [];
      group.push(section);
      groupedByCourse.set(section.courseId, group);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Layers className="h-6 w-6 text-red-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {isStudent ? 'Mis Secciones' : 'Mis Secciones de Curso'}
            </h1>
            <p className="text-sm text-gray-500">
              {isStudent
                ? 'Tus secciones inscritas con progreso y fechas'
                : 'Todas tus secciones agrupadas por curso'}
            </p>
          </div>
        </div>
        {!isStudent && teacherCourses.length > 0 && (
          <div className="relative">
            <Button onClick={() => setShowNewSectionPicker(!showNewSectionPicker)}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Sección
            </Button>
            {showNewSectionPicker && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNewSectionPicker(false)} />
                <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
                  <p className="px-4 py-2 text-xs font-medium text-gray-500 border-b">Selecciona un curso</p>
                  {teacherCourses.map(course => (
                    <button
                      key={course.id}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2"
                      onClick={() => {
                        setShowNewSectionPicker(false);
                        navigate(`/my-sections/course/${course.id}/new`);
                      }}
                    >
                      <BookOpen className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{course.title}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Search */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Input
            placeholder="Buscar por nombre de sección o curso..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-50 rounded-lg"><Layers className="h-5 w-5 text-red-600" /></div>
              <div>
                <p className="text-xs text-gray-500">Total Secciones</p>
                <p className="text-lg font-bold">{sections.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-50 rounded-lg"><Clock className="h-5 w-5 text-red-600" /></div>
              <div>
                <p className="text-xs text-gray-500">Activas</p>
                <p className="text-lg font-bold">{sections.filter(s => s.status === 'activa').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        {isStudent && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-50 rounded-lg"><BookOpen className="h-5 w-5 text-red-600" /></div>
                <div>
                  <p className="text-xs text-gray-500">Progreso Prom.</p>
                  <p className="text-lg font-bold">
                    {sections.length > 0
                      ? Math.round(sections.reduce((s, sec) => s + (sec.progress || 0), 0) / sections.length)
                      : 0}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        {!isStudent && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-50 rounded-lg"><Users className="h-5 w-5 text-red-600" /></div>
                <div>
                  <p className="text-xs text-gray-500">Estudiantes</p>
                  <p className="text-lg font-bold">{sections.reduce((s, sec) => s + sec.studentsCount, 0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-50 rounded-lg"><BookOpen className="h-5 w-5 text-red-600" /></div>
              <div>
                <p className="text-xs text-gray-500">Cursos</p>
                <p className="text-lg font-bold">{new Set(sections.map(s => s.courseId)).size}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Layers className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              {isStudent ? 'No tienes secciones inscritas' : 'No tienes secciones creadas'}
            </h3>
            <p className="text-gray-500 mb-4">
              {isStudent
                ? 'Explora los cursos disponibles para inscribirte en una sección.'
                : teacherCourses.length > 0
                  ? 'Selecciona un curso arriba para crear tu primera sección.'
                  : 'Primero crea un curso, luego podrás agregar secciones.'}
            </p>
            <Button onClick={() => navigate('/courses')}>
              {isStudent ? 'Explorar cursos' : teacherCourses.length > 0 ? 'Ver mis cursos' : 'Crear un curso'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Student view: flat list of enrolled sections */}
      {isStudent && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map(section => (
            <Card key={section.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">{section.courseTitle}</h3>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[section.status]}`}>
                        {section.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mb-2">{section.title}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDateShort(section.startDate)} — {formatDateShort(section.endDate)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {section.instructorName}
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500">Progreso</span>
                        <span className="font-medium text-gray-700">{section.progress || 0}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-red-500 transition-all"
                          style={{ width: `${Math.min(section.progress || 0, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="ml-4 flex-shrink-0"
                    onClick={() => navigate(`/sections/${section.id}`)}
                  >
                    <ArrowRight className="h-4 w-4 mr-1" />
                    Entrar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Teacher/Admin view: grouped by course */}
      {!isStudent && filtered.length > 0 && (
        <div className="space-y-6">
          {Array.from(groupedByCourse.entries()).map(([courseId, courseSections]) => {
            const first = courseSections[0];
            return (
              <div key={courseId}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-red-600" />
                    <h2 className="font-semibold text-gray-900">{first.courseTitle}</h2>
                    <span className="text-xs text-gray-400">{first.courseCategory} · {first.courseLevel}</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => navigate(`/my-sections/course/${courseId}/new`)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Nueva Sección
                  </Button>
                </div>
                <div className="space-y-2">
                  {courseSections.map(section => (
                    <Card key={section.id} className="hover:shadow-sm transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium text-gray-900">{section.title}</h3>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[section.status]}`}>
                                {section.status}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5" />
                                {formatDateShort(section.startDate)} — {formatDateShort(section.endDate)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Users className="h-3.5 w-3.5" />
                                {section.studentsCount} estudiantes
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 ml-4 flex-shrink-0">
                            <Button size="sm" variant="outline" onClick={() => navigate(`/sections/${section.id}/dates`)} title="Fechas">
                              <Calendar className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => navigate(`/sections/${section.id}/grades`)} title="Calificaciones">
                              <ClipboardList className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => navigate(`/my-sections/${section.id}/edit`)} title="Editar">
                              <Edit3 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
