import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@app/store/authStore';
import { courseService, type DBCourse } from '@shared/services/dataService';
import {
  BookOpen,
  Plus,
  Search,
  Edit3,
  Clock,
  Globe,
  Archive,
  Layers,
  X,
} from 'lucide-react';
import { Card, CardContent } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';
import { CoursePattern } from '@shared/components/ui/CoursePattern';
import CourseWizardModal from '@modules/courses/components/CourseWizardModal';
import SectionWizardModal from '@modules/courses/components/SectionWizardModal';

// ─── Types ────────────────────────────────────────────────────────────────────

type StatusFilter = 'publicado' | 'borrador' | 'archivado' | 'all';

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-gray-500 truncate">{label}</p>
            <p className="text-xl font-bold text-gray-900 leading-tight">{value}</p>
          </div>
          <div className="p-1.5 rounded-md bg-red-50 shrink-0">
            <Icon className="h-4 w-4 text-red-600" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Status badge helpers ─────────────────────────────────────────────────────

const STATUS_STYLES: Record<DBCourse['status'], string> = {
  borrador: 'bg-gray-50 text-gray-600 border-gray-200',
  publicado: 'bg-red-50 text-red-700 border-red-100',
  archivado: 'bg-gray-100 text-gray-500 border-gray-200',
};

const STATUS_LABELS: Record<DBCourse['status'], string> = {
  borrador: 'Borrador',
  publicado: 'Publicado',
  archivado: 'Archivado',
};

const LEVEL_STYLES: Record<DBCourse['level'], string> = {
  principiante: 'bg-red-50 text-red-700',
  intermedio: 'bg-red-100 text-red-800',
  avanzado: 'bg-red-200 text-red-900',
};

// ─── Course Grid Card ─────────────────────────────────────────────────────────

function CourseGridCard({
  course,
  onView,
  onNewSection,
  readOnly,
}: {
  course: DBCourse;
  onView: () => void;
  onNewSection: () => void;
  readOnly?: boolean;
}) {
  const statusStyle = STATUS_STYLES[course.status];
  const statusLabel = STATUS_LABELS[course.status];
  const levelStyle = LEVEL_STYLES[course.level];
  const levelLabel = course.level.charAt(0).toUpperCase() + course.level.slice(1);

  return (
    <div
      className="group flex flex-col rounded-xl border border-gray-200 hover:border-gray-300 overflow-hidden bg-white hover:shadow-md cursor-pointer transition-all focus-visible:outline-none"
      onClick={onView}
    >
      {/* Banner */}
      <div className="relative h-24 overflow-hidden">
        {course.image ? (
          <img
            src={course.image}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <CoursePattern courseKey={course.id} className="absolute inset-0 w-full h-full" />
        )}
        {/* Status badge — top-left */}
        <div className="absolute top-2 left-2">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusStyle}`}>
            {statusLabel}
          </span>
        </div>
        {/* Level badge — top-right */}
        <div className="absolute top-2 right-2">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${levelStyle}`}>
            {levelLabel}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="p-3 flex flex-col flex-1">
        <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 mb-1">
          {course.title}
        </h3>
        <p className="text-xs text-gray-600 line-clamp-2 mb-3">
          {course.description}
        </p>

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-gray-500 mb-4 mt-auto">
          <div className="flex items-center gap-1">
            <Layers className="h-3.5 w-3.5" />
            <span>{course.sectionsCount || 0} secciones</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            <span>{course.duration}</span>
          </div>
        </div>

        {/* Actions */}
        {!readOnly && (
          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            <button
              onClick={onNewSection}
              title="Nueva sección"
              aria-label="Nueva sección"
              className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 shrink-0"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const CoursesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isSupervisor = user?.role === 'supervisor';
  const [courses, setCourses] = useState<DBCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [courseWizardOpen, setCourseWizardOpen] = useState(false);
  const [sectionWizardCourseId, setSectionWizardCourseId] = useState<string | null>(null);

  const loadCourses = async () => {
    setLoading(true);
    try {
      const data = await courseService.getAll();
      setCourses(data);
    } catch (error) {
      console.error('Error loading courses:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, []);

  // Role-scoped base list (admin & supervisor see all, teacher sees own)
  const ownCourses = courses.filter(course =>
    user?.role === 'teacher' ? course.instructorId === user.id : true
  );

  const filteredCourses = ownCourses.filter(course => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      course.title.toLowerCase().includes(q) ||
      course.description.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || course.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: ownCourses.length,
    published: ownCourses.filter(c => c.status === 'publicado').length,
    draft: ownCourses.filter(c => c.status === 'borrador').length,
    archived: ownCourses.filter(c => c.status === 'archivado').length,
  };

  const STATUS_CHIPS: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'publicado', label: 'Publicados', count: stats.published },
    { key: 'borrador', label: 'Borradores', count: stats.draft },
    { key: 'archivado', label: 'Archivados', count: stats.archived },
    { key: 'all', label: 'Todos', count: stats.total },
  ];

  return (
    <div className="space-y-4">

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total" value={stats.total} icon={BookOpen} />
        <KpiCard label="Publicados" value={stats.published} icon={Globe} />
        <KpiCard label="Borradores" value={stats.draft} icon={Edit3} />
        <KpiCard label="Archivados" value={stats.archived} icon={Archive} />
      </div>

      {/* ── Toolbar ── */}
      <div className="bg-white border border-gray-200 rounded-xl px-3 py-2.5">
        <div className="flex items-center gap-2 flex-wrap">

          {/* Search */}
          <div className="relative min-w-[180px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar curso…"
              className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-8 pr-7 py-1.5 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
              aria-label="Buscar curso"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded"
                aria-label="Limpiar búsqueda"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Status chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {STATUS_CHIPS.map(({ key, label, count }) => {
              const active = statusFilter === key;
              return (
                <button
                  key={key}
                  onClick={() => setStatusFilter(key)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 ${
                    active
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-red-300'
                  }`}
                >
                  {label}
                  <span className={`text-[10px] font-semibold ml-0.5 ${active ? 'text-red-100' : 'text-gray-400'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Nuevo Curso — pushed right */}
          {!isSupervisor && (
            <div className="ml-auto">
              <Button
                size="sm"
                onClick={() => setCourseWizardOpen(true)}
                className="bg-red-600 hover:bg-red-700 text-white text-xs border-0"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                <span className="hidden sm:inline">Nuevo Curso</span>
                <span className="sm:hidden">Nuevo</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-gray-200 overflow-hidden bg-white animate-pulse">
              <div className="h-24 bg-gray-100" />
              <div className="p-3 space-y-2">
                <div className="h-4 bg-gray-100 rounded w-3/4" />
                <div className="h-3 bg-gray-100 rounded w-full" />
                <div className="h-3 bg-gray-100 rounded w-2/3" />
                <div className="h-8 bg-gray-100 rounded mt-4" />
              </div>
            </div>
          ))
        ) : filteredCourses.length === 0 ? (
          <div className="col-span-full text-center py-16">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-50 mb-4">
              <BookOpen className="h-7 w-7 text-red-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">
              {searchTerm || statusFilter !== 'all'
                ? 'Sin resultados'
                : user?.role === 'teacher'
                ? 'Aún no has creado ningún curso'
                : 'No hay cursos'}
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              {searchTerm || statusFilter !== 'all'
                ? 'Prueba con otro término o cambia el filtro de estado.'
                : 'Crea tu primer curso para empezar a organizar secciones y lecciones.'}
            </p>
            {!searchTerm && statusFilter === 'all' && !isSupervisor && (
              <Button
                size="sm"
                onClick={() => setCourseWizardOpen(true)}
                className="bg-red-600 hover:bg-red-700 text-white border-0"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Crear Curso
              </Button>
            )}
          </div>
        ) : (
          filteredCourses.map((course) => (
            <CourseGridCard
              key={course.id}
              course={course}
              readOnly={isSupervisor}
              onView={() => navigate(`/courses/${course.id}`)}
              onNewSection={() => setSectionWizardCourseId(course.id)}
            />
          ))
        )}
      </div>

      {/* ── Modals ── */}
      <CourseWizardModal
        open={courseWizardOpen}
        onClose={() => setCourseWizardOpen(false)}
        onCreated={() => {
          setCourseWizardOpen(false);
          loadCourses();
        }}
      />
      <SectionWizardModal
        open={!!sectionWizardCourseId}
        courseId={sectionWizardCourseId ?? undefined}
        onClose={() => setSectionWizardCourseId(null)}
        onSaved={loadCourses}
      />
    </div>
  );
};

export default CoursesPage;
