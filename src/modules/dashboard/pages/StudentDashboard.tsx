import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@app/store/authStore';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Trophy,
  TrendingUp,
  ClipboardList,
  Award,
  Clock,
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Filter,
  LayoutGrid,
  List as ListIcon,
  MoreHorizontal,
  Star,
  EyeOff,
  Eye,
  StarOff,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/Card';
import { CoursePattern } from '@shared/components/ui/CoursePattern';
import { useStudentCourses, useStudentGrades, useStudentDeadlines } from '@shared/hooks/useDashboard';

type CourseFilter = 'in_progress' | 'completed' | 'featured' | 'hidden' | 'all';
type CourseFlag = 'featured' | 'hidden' | null;

const FILTER_LABELS: Record<CourseFilter, string> = {
  in_progress: 'En progreso',
  completed: 'Completados',
  featured: 'Destacados',
  hidden: 'Ocultos',
  all: 'Todos',
};

const FILTER_ORDER: CourseFilter[] = ['in_progress', 'completed', 'featured', 'hidden', 'all'];

// ─── Course flags persistence (per-user, local) ─────────────────────────────
// Stored locally so the student controls their own view without writing to
// shared course records. Migrate to Firestore if/when this needs to sync.

function flagStorageKey(userId: string) {
  return `lasaedu.dashboard.courseFlags.${userId}`;
}

function loadFlags(userId: string): Record<string, CourseFlag> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(flagStorageKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveFlags(userId: string, flags: Record<string, CourseFlag>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(flagStorageKey(userId), JSON.stringify(flags));
  } catch {
    // ignore quota errors
  }
}

function courseKey(course: any): string {
  return String(course.sectionId || course.id || course.title);
}

// Relative formatter for "último acceso" — string (ISO) or number (ms) accepted.
function formatLastAccess(value: string | number | null | undefined): string {
  if (!value) return 'Sin acceso';
  const ts = typeof value === 'number' ? value : new Date(value).getTime();
  if (!Number.isFinite(ts) || ts <= 0) return 'Sin acceso';

  const now = Date.now();
  const diffMs = now - ts;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMs < 0) return 'Ahora mismo';
  if (diffMin < 1) return 'Ahora mismo';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} días`;
  return new Date(ts).toLocaleDateString('es', { day: 'numeric', month: 'short' });
}


const StudentDashboard = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { courses, loading } = useStudentCourses(user?.id || '');
  const { data: gradesData } = useStudentGrades(user?.id || '');
  const { deadlines } = useStudentDeadlines(user?.id || '');
  const [courseFilter, setCourseFilter] = useState<CourseFilter>('in_progress');
  const [filterOpen, setFilterOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [flags, setFlags] = useState<Record<string, CourseFlag>>({});

  // Load flags once when the user id is known
  useEffect(() => {
    if (user?.id) setFlags(loadFlags(user.id));
  }, [user?.id]);

  const setFlag = useCallback(
    (key: string, next: CourseFlag) => {
      if (!user?.id) return;
      setFlags((prev) => {
        const copy = { ...prev };
        if (next === null) delete copy[key];
        else copy[key] = next;
        saveFlags(user.id, copy);
        return copy;
      });
    },
    [user?.id]
  );

  // Sort: featured always first, then default order.
  const sortFeaturedFirst = useCallback(
    (arr: any[]) => {
      const copy = [...arr];
      copy.sort((a, b) => {
        const fa = flags[courseKey(a)] === 'featured' ? 1 : 0;
        const fb = flags[courseKey(b)] === 'featured' ? 1 : 0;
        return fb - fa;
      });
      return copy;
    },
    [flags]
  );

  // Buckets already applied flag-aware filtering so KPIs and badges stay honest.
  const featuredCourses = useMemo(
    () => sortFeaturedFirst(courses.filter((c: any) => flags[courseKey(c)] === 'featured')),
    [courses, flags, sortFeaturedFirst]
  );
  const hiddenCourses = useMemo(
    () => courses.filter((c: any) => flags[courseKey(c)] === 'hidden'),
    [courses, flags]
  );
  // "En progreso" excludes hidden (per Michael's spec)
  const activeCourses = useMemo(
    () =>
      sortFeaturedFirst(
        courses.filter(
          (c: any) => c.progress < 100 && flags[courseKey(c)] !== 'hidden'
        )
      ),
    [courses, flags, sortFeaturedFirst]
  );
  const completedCoursesList = useMemo(
    () =>
      sortFeaturedFirst(
        courses.filter(
          (c: any) => c.progress >= 100 && flags[courseKey(c)] !== 'hidden'
        )
      ),
    [courses, flags, sortFeaturedFirst]
  );
  // "Todos" also excludes hidden — they live in their own bucket
  const visibleCourses = useMemo(
    () => sortFeaturedFirst(courses.filter((c: any) => flags[courseKey(c)] !== 'hidden')),
    [courses, flags, sortFeaturedFirst]
  );

  const countFor = (key: CourseFilter): number => {
    switch (key) {
      case 'in_progress': return activeCourses.length;
      case 'completed':   return completedCoursesList.length;
      case 'featured':    return featuredCourses.length;
      case 'hidden':      return hiddenCourses.length;
      case 'all':         return visibleCourses.length;
    }
  };
  const totalCourses = courses.length;
  const avgProgress =
    courses.length > 0
      ? Math.round(
          courses.reduce((sum: number, course: any) => sum + course.progress, 0) /
            courses.length
        )
      : 0;
  const completedCourses = completedCoursesList.length;

  const stats = [
    {
      title: 'Cursos Inscritos',
      value: totalCourses.toString(),
      icon: BookOpen,
      color: 'bg-red-50 text-red-600',
    },
    {
      title: 'Progreso General',
      value: `${avgProgress}%`,
      icon: TrendingUp,
      color: 'bg-red-50 text-red-600',
    },
    {
      title: 'Promedio',
      value: gradesData?.avgGrade != null ? `${gradesData.avgGrade}` : '—',
      icon: ClipboardList,
      color: 'bg-red-50 text-red-600',
    },
    {
      title: 'Certificados',
      value: completedCourses.toString(),
      icon: Trophy,
      color: 'bg-red-50 text-red-600',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Cargando cursos...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <Card key={index} className="hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500">{stat.title}</p>
                  <p className="text-xl md:text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                </div>
                <div className={`p-2 rounded-lg ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Enrolled Courses */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="space-y-2">
                <CardTitle className="flex items-center text-base">
                  <BookOpen className="h-5 w-5 mr-2 text-red-600" />
                  Mis Cursos
                </CardTitle>
                <div className="flex items-center justify-between gap-2">
                  {/* Filter dropdown — LEFT */}
                  <div className="relative">
                    <button
                      onClick={() => setFilterOpen((v) => !v)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:border-red-400 hover:text-red-700 transition-colors"
                    >
                      <Filter className="h-3.5 w-3.5" />
                      {FILTER_LABELS[courseFilter]}
                      <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-50 text-red-700 text-[10px] font-semibold">
                        {countFor(courseFilter)}
                      </span>
                      <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                    </button>
                    {filterOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setFilterOpen(false)}
                        />
                        <div className="absolute left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
                          {FILTER_ORDER.map((key) => {
                            const active = courseFilter === key;
                            const Icon =
                              key === 'featured' ? Star :
                              key === 'hidden' ? EyeOff :
                              key === 'completed' ? CheckCircle2 :
                              key === 'in_progress' ? TrendingUp :
                              BookOpen;
                            return (
                              <button
                                key={key}
                                onClick={() => {
                                  setCourseFilter(key);
                                  setFilterOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                                  active
                                    ? 'bg-red-50 text-red-700 font-medium'
                                    : 'hover:bg-gray-50 text-gray-700'
                                }`}
                              >
                                <span className="flex items-center gap-2">
                                  <Icon className="h-3.5 w-3.5" />
                                  {FILTER_LABELS[key]}
                                </span>
                                <span className={`text-xs ${active ? 'text-red-700' : 'text-gray-400'}`}>
                                  {countFor(key)}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>

                  {/* View mode toggle — RIGHT */}
                  <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-white">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-1.5 rounded transition-colors ${
                        viewMode === 'grid'
                          ? 'bg-red-50 text-red-700'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                      title="Vista cuadrícula"
                    >
                      <LayoutGrid className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`p-1.5 rounded transition-colors ${
                        viewMode === 'list'
                          ? 'bg-red-50 text-red-700'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                      title="Vista lista"
                    >
                      <ListIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {(() => {
                const displayCourses =
                  courseFilter === 'in_progress' ? activeCourses
                  : courseFilter === 'completed' ? completedCoursesList
                  : courseFilter === 'featured'  ? featuredCourses
                  : courseFilter === 'hidden'    ? hiddenCourses
                  : visibleCourses;

                if (courses.length === 0) {
                  return (
                    <div className="text-center py-10">
                      <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 mb-4">
                        No tienes cursos inscritos aún
                      </p>
                      <button
                        onClick={() => navigate('/courses')}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                      >
                        Explorar cursos
                      </button>
                    </div>
                  );
                }

                if (displayCourses.length === 0) {
                  const emptyCopy: Record<CourseFilter, { text: string; alt: CourseFilter }> = {
                    in_progress: { text: '¡Sin cursos en progreso! Todo al día.', alt: 'completed' },
                    completed:   { text: 'Aún no has completado ningún curso', alt: 'in_progress' },
                    featured:    { text: 'No tienes cursos destacados. Usa el menú de cada tarjeta para destacar.', alt: 'in_progress' },
                    hidden:      { text: 'No tienes cursos ocultos.', alt: 'in_progress' },
                    all:         { text: 'No hay cursos visibles.', alt: 'hidden' },
                  };
                  const copy = emptyCopy[courseFilter];
                  return (
                    <div className="text-center py-8">
                      <CheckCircle2 className="h-10 w-10 text-red-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">{copy.text}</p>
                      <button
                        onClick={() => setCourseFilter(copy.alt)}
                        className="mt-3 text-sm text-red-600 hover:text-red-800 font-medium"
                      >
                        Ver {FILTER_LABELS[copy.alt].toLowerCase()}
                      </button>
                    </div>
                  );
                }

                const shown = displayCourses.slice(0, viewMode === 'grid' ? 6 : 8);
                const goTo = (course: any) =>
                  navigate(course.sectionId ? `/sections/${course.sectionId}` : `/courses/${course.id}`);

                if (viewMode === 'grid') {
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {shown.map((course: any) => {
                        const k = courseKey(course);
                        return (
                          <CourseGridCard
                            key={k}
                            course={course}
                            flag={flags[k] ?? null}
                            onOpen={() => goTo(course)}
                            onSetFlag={(next) => setFlag(k, next)}
                          />
                        );
                      })}
                    </div>
                  );
                }

                return (
                  <div className="space-y-2">
                    {shown.map((course: any) => {
                      const k = courseKey(course);
                      return (
                        <CourseListRow
                          key={k}
                          course={course}
                          flag={flags[k] ?? null}
                          onOpen={() => goTo(course)}
                          onSetFlag={(next) => setFlag(k, next)}
                        />
                      );
                    })}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>

        {/* Right column: Deadlines + Grades + Certificates */}
        <div className="space-y-6">
          {/* Upcoming Deadlines */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-base">
                <Calendar className="h-5 w-5 mr-2 text-red-600" />
                Próximas Entregas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {deadlines.length === 0 ? (
                <div className="text-center py-4">
                  <Clock className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No hay entregas pendientes</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {deadlines.slice(0, 5).map((dl, i) => {
                    const isUrgent = dl.dueTimestamp - Date.now() < 24 * 60 * 60 * 1000;
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer"
                        onClick={() => {
                          if (dl.sectionId) {
                            navigate(`/sections/${dl.sectionId}/lesson/${dl.lessonId}`);
                          } else {
                            navigate(`/courses/${dl.courseId}/lesson/${dl.lessonId}`);
                          }
                        }}
                      >
                        <div className={`p-1.5 rounded-lg ${isUrgent ? 'bg-red-50' : 'bg-gray-50'}`}>
                          {dl.type === 'quiz' ? (
                            <AlertCircle className={`h-4 w-4 ${isUrgent ? 'text-red-500' : 'text-gray-500'}`} />
                          ) : (
                            <ClipboardList className={`h-4 w-4 ${isUrgent ? 'text-red-500' : 'text-gray-500'}`} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{dl.lessonTitle}</p>
                          <p className="text-xs text-gray-500 truncate">{dl.courseTitle}</p>
                        </div>
                        <span className={`text-xs font-medium whitespace-nowrap ${isUrgent ? 'text-red-600' : 'text-gray-500'}`}>
                          {dl.timeRemaining}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Grades Quick View */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-base">
                <ClipboardList className="h-5 w-5 mr-2 text-red-600" />
                Mis Calificaciones
              </CardTitle>
            </CardHeader>
            <CardContent>
              {gradesData && gradesData.totalGrades > 0 ? (
                <div>
                  <div className="text-center mb-4">
                    <p className="text-xs font-medium text-gray-500 mb-1">
                      Promedio General
                    </p>
                    <p
                      className={`text-3xl md:text-4xl font-bold ${
                        (gradesData.avgGrade || 0) >= 80
                          ? 'text-red-700'
                          : (gradesData.avgGrade || 0) >= 60
                          ? 'text-red-500'
                          : 'text-gray-500'
                      }`}
                    >
                      {gradesData.avgGrade}
                    </p>
                    <p className="text-xs text-gray-500">
                      de {gradesData.totalGrades} evaluacion
                      {gradesData.totalGrades !== 1 ? 'es' : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/grades')}
                    className="w-full text-center text-sm text-red-600 hover:text-red-800 font-medium py-2 border-t border-gray-100"
                  >
                    Ver detalle
                  </button>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-500 mb-2">
                    Sin calificaciones aún
                  </p>
                  <button
                    onClick={() => navigate('/grades')}
                    className="text-sm text-red-600 hover:text-red-800 font-medium"
                  >
                    Ver calificaciones
                  </button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Certificates */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-base">
                <Award className="h-5 w-5 mr-2 text-red-600" />
                Certificados
              </CardTitle>
            </CardHeader>
            <CardContent>
              {completedCourses > 0 ? (
                <div>
                  <div className="text-center mb-4">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-50 mb-2">
                      <Trophy className="h-7 w-7 text-red-500" />
                    </div>
                    <p className="text-xl md:text-2xl font-bold text-gray-900">
                      {completedCourses}
                    </p>
                    <p className="text-xs text-gray-500">
                      Curso{completedCourses !== 1 ? 's' : ''} completado
                      {completedCourses !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/certificates')}
                    className="w-full text-center text-sm text-red-600 hover:text-red-800 font-medium py-2 border-t border-gray-100"
                  >
                    Ver certificados
                  </button>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-500 mb-1">
                    Completa un curso para obtener tu primer certificado
                  </p>
                  {avgProgress > 0 && (
                    <div className="mt-3 p-2 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500">Más cerca de completar:</p>
                      <p className="text-sm font-medium text-gray-900 mt-0.5">
                        {avgProgress}% promedio
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

// ─── CourseKebab ────────────────────────────────────────────────────────────
// Dropdown menu triggered from the "..." button. Mutates a single per-course
// flag: featured / hidden / normal (mutually exclusive).

function CourseKebab({
  flag,
  onSetFlag,
  darkBg = false,
}: {
  flag: CourseFlag;
  onSetFlag: (next: CourseFlag) => void;
  darkBg?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const isFeatured = flag === 'featured';
  const isHidden = flag === 'hidden';

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={`p-1 rounded-full transition-colors ${
          darkBg
            ? 'bg-black/30 text-white hover:bg-black/50'
            : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
        }`}
        aria-label="Más opciones"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
          />
          <div
            className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                onSetFlag(isFeatured ? null : 'featured');
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-700"
            >
              {isFeatured ? <StarOff className="h-3.5 w-3.5" /> : <Star className="h-3.5 w-3.5" />}
              {isFeatured ? 'Quitar destacado' : 'Destacar'}
            </button>
            <button
              onClick={() => {
                onSetFlag(isHidden ? null : 'hidden');
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-700"
            >
              {isHidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              {isHidden ? 'Mostrar' : 'Ocultar'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── CourseGridCard ─────────────────────────────────────────────────────────
// Card-style rendering: banner header (image or color fallback) + title/body.

function CourseGridCard({
  course,
  flag,
  onOpen,
  onSetFlag,
}: {
  course: any;
  flag: CourseFlag;
  onOpen: () => void;
  onSetFlag: (next: CourseFlag) => void;
}) {
  const progress = Math.min(course.progress || 0, 100);
  const isCompleted = progress >= 100;
  const key = String(course.id || course.sectionId || course.title);
  return (
    <div
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      role="button"
      tabIndex={0}
      className={`group border rounded-lg overflow-hidden hover:shadow-md transition-all cursor-pointer bg-white flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 ${
        flag === 'featured'
          ? 'border-red-400 ring-1 ring-red-200'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      {/* Banner */}
      <div
        className="relative h-24 bg-cover bg-center overflow-hidden"
        style={course.image ? { backgroundImage: `url(${course.image})` } : undefined}
      >
        {!course.image && (
          <CoursePattern courseKey={key} className="absolute inset-0 w-full h-full" />
        )}
        <div className="absolute top-2 right-2">
          <CourseKebab flag={flag} onSetFlag={onSetFlag} darkBg />
        </div>
        <div className="absolute top-2 left-2 flex items-center gap-1">
          {flag === 'featured' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/95 text-red-700 text-xs font-semibold">
              <Star className="h-3 w-3 fill-red-600 text-red-600" />
              Destacado
            </span>
          )}
          {isCompleted && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/95 text-red-700 text-xs font-semibold">
              <CheckCircle2 className="h-3 w-3" />
              Completado
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-3 flex-1 flex flex-col">
        <h3 className="font-medium text-gray-900 text-sm line-clamp-2 mb-1">
          {course.title}
        </h3>
        <p className="text-xs text-gray-500 truncate mb-2">por {course.instructor}</p>

        <div className="mt-auto">
          <div className="flex justify-between text-[11px] mb-1">
            <span className="text-gray-500">{progress}%</span>
            {course.lastAccessedAt && (
              <span className="text-gray-400">{formatLastAccess(course.lastAccessedAt)}</span>
            )}
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full bg-red-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CourseListRow ──────────────────────────────────────────────────────────
// Row-style rendering: circular avatar (image or color fallback) + title + progress.

function CourseListRow({
  course,
  flag,
  onOpen,
  onSetFlag,
}: {
  course: any;
  flag: CourseFlag;
  onOpen: () => void;
  onSetFlag: (next: CourseFlag) => void;
}) {
  const progress = Math.min(course.progress || 0, 100);
  const isCompleted = progress >= 100;
  const key = String(course.id || course.sectionId || course.title);
  return (
    <div
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      role="button"
      tabIndex={0}
      className={`flex items-center gap-3 p-3 rounded-lg border hover:shadow-sm transition-all cursor-pointer bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 ${
        flag === 'featured'
          ? 'border-red-400 ring-1 ring-red-200'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      {/* Circle avatar */}
      <div
        className="relative w-12 h-12 shrink-0 rounded-full bg-cover bg-center overflow-hidden"
        style={course.image ? { backgroundImage: `url(${course.image})` } : undefined}
      >
        {!course.image && (
          <CoursePattern courseKey={key} circle className="absolute inset-0 w-full h-full" />
        )}
        {flag === 'featured' && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-white flex items-center justify-center shadow">
            <Star className="h-2.5 w-2.5 fill-red-600 text-red-600" />
          </span>
        )}
      </div>

      {/* Middle content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-medium text-gray-900 text-sm truncate">{course.title}</h3>
          {isCompleted && (
            <CheckCircle2 className="h-4 w-4 text-red-600 shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-gray-100 rounded-full h-1.5 max-w-xs">
            <div
              className="h-1.5 rounded-full bg-red-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs font-medium text-gray-600 shrink-0">{progress}%</span>
          {course.lastAccessedAt && (
            <span className="text-xs text-gray-400 shrink-0 hidden sm:block">
              · {formatLastAccess(course.lastAccessedAt)}
            </span>
          )}
        </div>
      </div>

      {/* Kebab */}
      <div className="shrink-0">
        <CourseKebab flag={flag} onSetFlag={onSetFlag} />
      </div>
    </div>
  );
}

export default StudentDashboard;
