import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@app/store/authStore';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Users,
  TrendingUp,
  Layers,
  ArrowUpRight,
  UserPlus,
  MessageSquare,
  CheckCircle2,
  Clock,
  Filter,
  ChevronDown,
  LayoutGrid,
  List as ListIcon,
  MoreHorizontal,
  Star,
  EyeOff,
  Eye,
  StarOff,
  GraduationCap,
  Activity,
  ClipboardList,
  History,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/Card';
import { CoursePattern } from '@shared/components/ui/CoursePattern';
import { getSectionBanner } from '@shared/utils/sectionBanner';
import {
  sectionService,
  courseService,
  userService,
  type DBSection,
  type DBEnrollment,
  type DBCourse,
  type DBUser,
} from '@shared/services/dataService';
import { firebaseDB } from '@shared/services/firebaseDataService';
import {
  listAuditLogs,
  listStudentActivity,
  type DBAuditLog,
  type DBStudentActivityLog,
  type AuditAction,
  type StudentActivityType,
} from '@shared/services/auditLogService';
import { useSupervisorScope } from '@shared/hooks/useSupervisorScope';
import { getResourceShortLabel } from '@modules/audit/utils/resourceDisplay';

// ─── Types ────────────────────────────────────────────────────────────────────

type SectionFilter = 'activa' | 'finalizada' | 'archivada' | 'all';
type SectionFlag = 'featured' | 'hidden' | null;

const FILTER_LABELS: Record<SectionFilter, string> = {
  activa: 'En curso',
  finalizada: 'Finalizadas',
  archivada: 'Archivadas',
  all: 'Todas',
};

const FILTER_ORDER: SectionFilter[] = ['activa', 'finalizada', 'archivada', 'all'];

const STATUS_STYLES: Record<string, string> = {
  activa: 'bg-red-50 text-red-700 border-red-100',
  finalizada: 'bg-gray-100 text-gray-600 border-gray-200',
  archivada: 'bg-gray-100 text-gray-500 border-gray-200',
  borrador: 'bg-gray-50 text-gray-500 border-gray-200',
};

const STATUS_LABELS: Record<string, string> = {
  activa: 'Activa',
  finalizada: 'Finalizada',
  archivada: 'Archivada',
  borrador: 'Borrador',
};

const ACTION_LABELS: Record<AuditAction, string> = {
  create: 'creó',
  update: 'editó',
  delete: 'borró',
};

const ACTION_ICONS: Record<AuditAction, React.ElementType> = {
  create: Plus,
  update: Pencil,
  delete: Trash2,
};

const ACTION_COLORS: Record<AuditAction, string> = {
  create: 'bg-red-50 text-red-700',
  update: 'bg-red-100 text-red-700',
  delete: 'bg-red-600 text-white',
};

const ACTIVITY_LABELS: Record<StudentActivityType, string> = {
  submission_created: 'envió tarea',
  submission_resubmitted: 're-envió tarea',
  submission_deleted: 'eliminó entrega',
  lesson_completed: 'completó lección',
  course_completed: 'completó curso',
  evaluation_submitted: 'entregó evaluación',
  certificate_issued: 'recibió certificado',
};

// ─── Section flags persistence ────────────────────────────────────────────────

function flagStorageKey(userId: string) {
  return `lasaedu.dashboard.sectionFlags.${userId}`;
}

function loadSectionFlags(userId: string): Record<string, SectionFlag> {
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

function saveSectionFlags(userId: string, flags: Record<string, SectionFlag>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(flagStorageKey(userId), JSON.stringify(flags));
  } catch {
    // ignore quota errors
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatAge(ts: number): string {
  const diffMs = Date.now() - ts;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return 'Ahora mismo';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays === 1) return 'Ayer';
  return `Hace ${diffDays} días`;
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

interface SectionWithMetrics extends DBSection {
  avgProgress: number;
  avgGrade: number | null;
  enrolledStudents: number;
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

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

// ─── SectionKebab (read-only: only hide/feature) ─────────────────────────────

function SectionKebab({
  flag,
  onSetFlag,
  darkBg = false,
}: {
  flag: SectionFlag;
  onSetFlag: (next: SectionFlag) => void;
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

// ─── SectionGridCard ─────────────────────────────────────────────────────────

function SectionGridCard({
  section,
  flag,
  onOpen,
  onSetFlag,
}: {
  section: SectionWithMetrics;
  flag: SectionFlag;
  onOpen: () => void;
  onSetFlag: (next: SectionFlag) => void;
}) {
  const statusStyle = STATUS_STYLES[section.status] ?? 'bg-gray-100 text-gray-500 border-gray-200';
  const statusLabel = STATUS_LABELS[section.status] ?? section.status;

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
      className={`group flex flex-col rounded-xl border overflow-hidden bg-white hover:shadow-md cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 ${
        flag === 'featured'
          ? 'border-red-400 ring-1 ring-red-200'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="relative h-24 overflow-hidden">
        {getSectionBanner(section) ? (
          <img src={getSectionBanner(section)} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <CoursePattern courseKey={section.courseId} className="absolute inset-0 w-full h-full" />
        )}
        <div className="absolute top-2 left-2 flex items-center gap-1">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusStyle}`}>
            {statusLabel}
          </span>
          {flag === 'featured' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/95 text-red-700 text-xs font-semibold">
              <Star className="h-3 w-3 fill-red-600 text-red-600" />
            </span>
          )}
        </div>
        <div className="absolute top-2 right-2">
          <SectionKebab flag={flag} onSetFlag={onSetFlag} darkBg />
        </div>
      </div>

      <div className="p-3 flex flex-col flex-1">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide truncate mb-0.5">
          {section.courseTitle}
        </p>
        <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 mb-3">
          {section.title}
        </h3>

        <div className="flex items-center gap-3 mb-3">
          <div className="text-center min-w-0">
            <p className="text-base font-bold text-gray-900 leading-none">{section.enrolledStudents}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Estudiantes</p>
          </div>
          <div className="w-px h-6 bg-gray-100 shrink-0" />
          <div className="text-center min-w-0">
            <p className="text-base font-bold text-gray-900 leading-none">{section.avgProgress}%</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Progreso Prom.</p>
          </div>
          <div className="w-px h-6 bg-gray-100 shrink-0" />
          <div className="text-center min-w-0">
            <p className={`text-base font-bold leading-none ${section.avgGrade !== null ? 'text-gray-900' : 'text-gray-400'}`}>
              {section.avgGrade !== null ? section.avgGrade : '—'}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">Promedio</p>
          </div>
        </div>

        <div className="mt-auto w-full bg-gray-100 rounded-full h-1">
          <div
            className="bg-red-500 h-1 rounded-full transition-all"
            style={{ width: `${Math.min(section.avgProgress, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── SectionListRow ──────────────────────────────────────────────────────────

function SectionListRow({
  section,
  flag,
  onOpen,
  onSetFlag,
}: {
  section: SectionWithMetrics;
  flag: SectionFlag;
  onOpen: () => void;
  onSetFlag: (next: SectionFlag) => void;
}) {
  const progress = Math.min(section.avgProgress, 100);

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
      <div className="relative w-12 h-12 shrink-0 rounded-full overflow-hidden">
        {getSectionBanner(section) ? (
          <img src={getSectionBanner(section)} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <CoursePattern courseKey={section.courseId} circle className="absolute inset-0 w-full h-full" />
        )}
        {flag === 'featured' && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-white flex items-center justify-center shadow">
            <Star className="h-2.5 w-2.5 fill-red-600 text-red-600" />
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide truncate">
          {section.courseTitle}
        </p>
        <h3 className="font-medium text-gray-900 text-sm truncate">{section.title}</h3>
        <div className="flex items-center gap-3 mt-1">
          <div className="flex-1 bg-gray-100 rounded-full h-1.5 max-w-xs">
            <div className="h-1.5 rounded-full bg-red-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-xs font-medium text-gray-600 shrink-0">{progress}%</span>
        </div>
      </div>

      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
        <SectionKebab flag={flag} onSetFlag={onSetFlag} />
      </div>
    </div>
  );
}

// ─── Activity row helpers ────────────────────────────────────────────────────

function TeacherActivityRow({ log }: { log: DBAuditLog }) {
  const Icon = ACTION_ICONS[log.action];
  const colorCls = ACTION_COLORS[log.action];
  const resourceLabel = getResourceShortLabel(log.resourceType, log.metadata).toLowerCase();

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shrink-0">
        <span className="text-white text-[10px] font-bold leading-none">{initials(log.actorName)}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900 truncate">
          <span className="font-medium">{log.actorName}</span>
          <span className="text-gray-500"> {ACTION_LABELS[log.action]} {resourceLabel} </span>
          <span className="font-medium">{log.resourceName}</span>
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${colorCls}`}>
            <Icon className="h-2.5 w-2.5" />
            {ACTION_LABELS[log.action]}
          </span>
          <span className="text-[11px] text-gray-400">{formatAge(log.timestamp)}</span>
        </div>
      </div>
    </div>
  );
}

function StudentActivityRow({ log }: { log: DBStudentActivityLog }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shrink-0">
        <span className="text-white text-[10px] font-bold leading-none">{initials(log.studentName)}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900 truncate">
          <span className="font-medium">{log.studentName}</span>
          <span className="text-gray-500"> {ACTIVITY_LABELS[log.activityType]}</span>
          {log.resourceName && <span className="font-medium"> · {log.resourceName}</span>}
        </p>
        <span className="text-[11px] text-gray-400">{formatAge(log.timestamp)}</span>
      </div>
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function SupervisorDashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-100 bg-white px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="space-y-1.5 flex-1">
                <div className="h-2.5 w-20 bg-red-50 rounded" />
                <div className="h-5 w-12 bg-red-100 rounded" />
              </div>
              <div className="w-7 h-7 rounded-md bg-red-50 shrink-0" />
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-gray-100 bg-white p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="h-8 w-36 bg-gray-100 rounded-lg" />
          <div className="h-8 w-16 bg-gray-100 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-xl border border-gray-100 bg-white overflow-hidden">
              <div className="h-24 bg-red-50" />
              <div className="p-3 space-y-2">
                <div className="h-3 w-20 bg-gray-100 rounded" />
                <div className="h-4 w-3/4 bg-gray-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── SupervisorDashboard ─────────────────────────────────────────────────────

const SupervisorDashboard = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { filterSections, filterCourses } = useSupervisorScope();

  const [sections, setSections] = useState<DBSection[]>([]);
  const [courses, setCourses] = useState<DBCourse[]>([]);
  const [users, setUsers] = useState<DBUser[]>([]);
  const [enrollments, setEnrollments] = useState<DBEnrollment[]>([]);
  const [teacherLogs, setTeacherLogs] = useState<DBAuditLog[]>([]);
  const [studentLogs, setStudentLogs] = useState<DBStudentActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  const [sectionFilter, setSectionFilter] = useState<SectionFilter>('activa');
  const [filterOpen, setFilterOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [flags, setFlags] = useState<Record<string, SectionFlag>>({});

  useEffect(() => {
    if (user?.id) setFlags(loadSectionFlags(user.id));
  }, [user?.id]);

  const setFlag = useCallback(
    (sectionId: string, next: SectionFlag) => {
      if (!user?.id) return;
      setFlags((prev) => {
        const copy = { ...prev };
        if (next === null) delete copy[sectionId];
        else copy[sectionId] = next;
        saveSectionFlags(user.id, copy);
        return copy;
      });
    },
    [user?.id]
  );

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    async function load() {
      try {
        const [allSections, allCourses, allUsers, allEnrollments] = await Promise.all([
          sectionService.getAll(),
          courseService.getAll(),
          userService.getAll(),
          firebaseDB.getEnrollments(),
        ]);
        if (cancelled) return;

        const scopedCourses = filterCourses(allCourses);
        const scopedSections = filterSections(allSections);
        const courseIds = scopedCourses.map((c) => c.id);
        const sectionIds = scopedSections.map((s) => s.id);

        const [tLogs, sLogs] = await Promise.all([
          listAuditLogs().then((all) =>
            all.filter((l) => {
              if (l.actorRole !== 'teacher' && l.actorRole !== 'admin') return false;
              if (l.courseId && courseIds.includes(l.courseId)) return true;
              if (l.sectionId && sectionIds.includes(l.sectionId)) return true;
              if (l.resourceType === 'course' && courseIds.includes(l.resourceId)) return true;
              if (l.resourceType === 'section' && sectionIds.includes(l.resourceId)) return true;
              return false;
            })
          ),
          listStudentActivity({ sectionIds, courseIds }),
        ]);
        if (cancelled) return;

        setSections(allSections);
        setCourses(allCourses);
        setUsers(allUsers);
        setEnrollments(allEnrollments);
        setTeacherLogs(tLogs);
        setStudentLogs(sLogs);
      } catch (err) {
        console.error('Error loading supervisor dashboard:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user?.id, filterCourses, filterSections]);

  // Scope-filtered collections
  const scopedCourses = useMemo(() => filterCourses(courses), [courses, filterCourses]);
  const scopedSections = useMemo(() => filterSections(sections), [sections, filterSections]);
  const scopedSectionIds = useMemo(() => new Set(scopedSections.map((s) => s.id)), [scopedSections]);

  const scopedEnrollments = useMemo(
    () => enrollments.filter((e) => e.sectionId && scopedSectionIds.has(e.sectionId)),
    [enrollments, scopedSectionIds]
  );

  // Bucket enrollments by sectionId
  const enrollmentsBySectionId = useMemo(() => {
    const map = new Map<string, DBEnrollment[]>();
    for (const e of scopedEnrollments) {
      if (!e.sectionId) continue;
      const bucket = map.get(e.sectionId) ?? [];
      bucket.push(e);
      map.set(e.sectionId, bucket);
    }
    return map;
  }, [scopedEnrollments]);

  const sectionsWithMetrics = useMemo<SectionWithMetrics[]>(() => {
    return scopedSections.map((section) => {
      const sectionEnrollments = enrollmentsBySectionId.get(section.id) ?? [];
      const activeEnrollments = sectionEnrollments.filter(
        (e) => e.status === 'active' || e.status === 'completed'
      );
      const enrolledStudents = activeEnrollments.length || section.studentsCount;
      const avgProgress =
        activeEnrollments.length > 0
          ? Math.round(
              activeEnrollments.reduce((sum, e) => sum + (e.progress || 0), 0) / activeEnrollments.length
            )
          : 0;
      const graded = activeEnrollments.filter((e) => e.grade != null);
      const avgGrade =
        graded.length > 0
          ? Math.round(graded.reduce((sum, e) => sum + (e.grade as number), 0) / graded.length)
          : null;
      return { ...section, avgProgress, avgGrade, enrolledStudents };
    });
  }, [scopedSections, enrollmentsBySectionId]);

  // KPIs
  const activeStudentCount = useMemo(() => {
    const set = new Set<string>();
    for (const e of scopedEnrollments) {
      if (e.status === 'active') set.add(e.userId);
    }
    return set.size;
  }, [scopedEnrollments]);

  const avgGradeKpi = useMemo(() => {
    const graded = sectionsWithMetrics.filter((s) => s.avgGrade !== null);
    if (graded.length === 0) return null;
    return Math.round(graded.reduce((sum, s) => sum + (s.avgGrade as number), 0) / graded.length);
  }, [sectionsWithMetrics]);

  const activeSectionsCount = useMemo(
    () => scopedSections.filter((s) => s.status === 'activa').length,
    [scopedSections]
  );

  // Progress distribution
  const progressDist = useMemo(() => {
    const dist = { low: 0, medium: 0, high: 0, complete: 0 };
    const relevant = scopedEnrollments.filter((e) => e.status === 'active' || e.status === 'completed');
    for (const e of relevant) {
      const p = e.progress || 0;
      if (p < 25) dist.low++;
      else if (p < 50) dist.medium++;
      else if (p < 100) dist.high++;
      else dist.complete++;
    }
    return dist;
  }, [scopedEnrollments]);

  // Section buckets
  const sortFeaturedFirst = useCallback(
    (arr: SectionWithMetrics[]) => {
      const copy = [...arr];
      copy.sort((a, b) => {
        const fa = flags[a.id] === 'featured' ? 1 : 0;
        const fb = flags[b.id] === 'featured' ? 1 : 0;
        return fb - fa;
      });
      return copy;
    },
    [flags]
  );

  const buckets = useMemo(() => {
    const visible = sectionsWithMetrics.filter((s) => flags[s.id] !== 'hidden');
    return {
      activa: sortFeaturedFirst(visible.filter((s) => s.status === 'activa')),
      finalizada: sortFeaturedFirst(visible.filter((s) => s.status === 'finalizada')),
      archivada: sortFeaturedFirst(visible.filter((s) => s.status === 'archivada')),
      all: sortFeaturedFirst(visible),
    };
  }, [sectionsWithMetrics, flags, sortFeaturedFirst]);

  const countFor = (key: SectionFilter): number => buckets[key].length;
  const displaySections = buckets[sectionFilter];

  // General app info — scoped counts
  const generalInfo = useMemo(() => {
    const teacherIds = new Set<string>();
    for (const section of scopedSections) {
      if (section.instructorId) teacherIds.add(section.instructorId);
    }
    for (const course of scopedCourses) {
      if (course.instructorId) teacherIds.add(course.instructorId);
    }
    const studentIds = new Set<string>();
    for (const e of scopedEnrollments) {
      if (e.status === 'active' || e.status === 'completed') studentIds.add(e.userId);
    }
    const teachersRegistered = users.filter((u) => u.role === 'teacher').length;
    const studentsRegistered = users.filter((u) => u.role === 'student').length;
    const completions = scopedEnrollments.filter((e) => e.status === 'completed').length;
    return {
      courses: scopedCourses.length,
      sections: scopedSections.length,
      teachers: teacherIds.size,
      students: studentIds.size,
      teachersRegistered,
      studentsRegistered,
      enrollments: scopedEnrollments.length,
      completions,
    };
  }, [scopedCourses, scopedSections, scopedEnrollments, users]);

  const totalDistStudents =
    progressDist.low + progressDist.medium + progressDist.high + progressDist.complete;

  const distBars = [
    { label: '0–25%', count: progressDist.low, color: 'bg-red-300' },
    { label: '25–50%', count: progressDist.medium, color: 'bg-red-400' },
    { label: '50–75%', count: progressDist.high, color: 'bg-red-500' },
    { label: '75–100%', count: progressDist.complete, color: 'bg-red-600' },
  ];

  if (loading) {
    return <SupervisorDashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* ── 1. KPI Strip ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Cursos supervisados" value={scopedCourses.length} icon={BookOpen} />
        <KpiCard label="Secciones activas" value={activeSectionsCount} icon={Layers} />
        <KpiCard label="Estudiantes activos" value={activeStudentCount} icon={Users} />
        <KpiCard
          label="Promedio general"
          value={avgGradeKpi !== null ? avgGradeKpi : '—'}
          icon={TrendingUp}
        />
      </div>

      {/* ── 2. Mis Secciones ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="space-y-2">
            <CardTitle className="flex items-center text-base">
              <Layers className="h-5 w-5 mr-2 text-red-600" />
              Secciones supervisadas
            </CardTitle>
            <div className="flex items-center justify-between gap-2">
              {/* Filter dropdown */}
              <div className="relative">
                <button
                  onClick={() => setFilterOpen((v) => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:border-red-400 hover:text-red-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                >
                  <Filter className="h-3.5 w-3.5" />
                  {FILTER_LABELS[sectionFilter]}
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-50 text-red-700 text-[10px] font-semibold">
                    {countFor(sectionFilter)}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                </button>
                {filterOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setFilterOpen(false)} />
                    <div className="absolute left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
                      {FILTER_ORDER.map((key) => {
                        const active = sectionFilter === key;
                        const Icon =
                          key === 'activa'
                            ? TrendingUp
                            : key === 'finalizada'
                            ? CheckCircle2
                            : key === 'archivada'
                            ? EyeOff
                            : Layers;
                        return (
                          <button
                            key={key}
                            onClick={() => {
                              setSectionFilter(key);
                              setFilterOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                              active ? 'bg-red-50 text-red-700 font-medium' : 'hover:bg-gray-50 text-gray-700'
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

              {/* View mode */}
              <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-white">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded transition-colors ${
                    viewMode === 'grid' ? 'bg-red-50 text-red-700' : 'text-gray-400 hover:text-gray-600'
                  }`}
                  aria-label="Vista cuadrícula"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded transition-colors ${
                    viewMode === 'list' ? 'bg-red-50 text-red-700' : 'text-gray-400 hover:text-gray-600'
                  }`}
                  aria-label="Vista lista"
                >
                  <ListIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {sectionsWithMetrics.length === 0 && (
            <div className="flex flex-col items-center py-16 px-4 rounded-xl border border-dashed border-gray-200">
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
                <Layers className="h-8 w-8 text-red-300" />
              </div>
              <p className="text-sm font-semibold text-gray-700 mb-1">
                No tienes secciones asignadas
              </p>
              <p className="text-xs text-gray-400 text-center max-w-xs">
                Pide a un administrador que te asigne cursos o secciones para comenzar a supervisar.
              </p>
            </div>
          )}

          {sectionsWithMetrics.length > 0 && displaySections.length === 0 && (
            <div className="flex flex-col items-center py-10 px-4 text-center">
              <CheckCircle2 className="h-10 w-10 text-red-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">
                No hay secciones {FILTER_LABELS[sectionFilter].toLowerCase()}
              </p>
              {(() => {
                const best = FILTER_ORDER.find((k) => k !== sectionFilter && countFor(k) > 0);
                if (!best) return null;
                return (
                  <button
                    onClick={() => setSectionFilter(best)}
                    className="mt-3 text-sm text-red-600 hover:text-red-800 font-medium"
                  >
                    Ver {FILTER_LABELS[best].toLowerCase()} ({countFor(best)})
                  </button>
                );
              })()}
            </div>
          )}

          {displaySections.length > 0 && viewMode === 'grid' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {displaySections.slice(0, 6).map((section) => (
                <SectionGridCard
                  key={section.id}
                  section={section}
                  flag={flags[section.id] ?? null}
                  onOpen={() => navigate(`/sections/${section.id}`)}
                  onSetFlag={(next) => setFlag(section.id, next)}
                />
              ))}
            </div>
          )}

          {displaySections.length > 0 && viewMode === 'list' && (
            <div className="space-y-2">
              {displaySections.slice(0, 8).map((section) => (
                <SectionListRow
                  key={section.id}
                  section={section}
                  flag={flags[section.id] ?? null}
                  onOpen={() => navigate(`/sections/${section.id}`)}
                  onSetFlag={(next) => setFlag(section.id, next)}
                />
              ))}
            </div>
          )}

          {displaySections.length > (viewMode === 'grid' ? 6 : 8) && (
            <div className="mt-3 text-center">
              <button
                onClick={() => navigate('/my-sections')}
                className="flex items-center gap-1 mx-auto text-xs text-red-600 hover:text-red-800 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 rounded"
              >
                Ver todas las secciones
                <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 3. Actividad: Profesores + Estudiantes ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Actividad de profesores */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-base">
              <History className="h-5 w-5 mr-2 text-red-600" />
              Actividad de profesores
              {teacherLogs.length > 0 && (
                <span className="ml-2 px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-xs font-semibold">
                  {teacherLogs.length}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {teacherLogs.length === 0 ? (
              <div className="flex flex-col items-center py-8 gap-2">
                <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                  <ClipboardList className="h-5 w-5 text-red-400" />
                </div>
                <p className="text-sm font-medium text-gray-700">Sin cambios recientes</p>
                <p className="text-xs text-gray-400 text-center max-w-xs">
                  Cuando un profesor edite o cree contenido en tus cursos aparecerá aquí.
                </p>
              </div>
            ) : (
              <>
                {teacherLogs.slice(0, 6).map((log) => (
                  <TeacherActivityRow key={log.id} log={log} />
                ))}
                {teacherLogs.length > 6 && (
                  <button
                    onClick={() => navigate('/audit-logs')}
                    className="flex items-center gap-1 mt-3 text-xs text-red-600 hover:text-red-800 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 rounded"
                  >
                    Ver todo ({teacherLogs.length})
                    <ArrowUpRight className="h-3 w-3" />
                  </button>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Actividad de estudiantes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-base">
              <Activity className="h-5 w-5 mr-2 text-red-600" />
              Actividad de estudiantes
              {studentLogs.length > 0 && (
                <span className="ml-2 px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-xs font-semibold">
                  {studentLogs.length}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {studentLogs.length === 0 ? (
              <div className="flex flex-col items-center py-8 gap-2">
                <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                  <GraduationCap className="h-5 w-5 text-red-400" />
                </div>
                <p className="text-sm font-medium text-gray-700">Sin movimiento reciente</p>
                <p className="text-xs text-gray-400 text-center max-w-xs">
                  Las entregas, completaciones y evaluaciones aparecerán aquí en tiempo real.
                </p>
              </div>
            ) : (
              <>
                {studentLogs.slice(0, 6).map((log) => (
                  <StudentActivityRow key={log.id} log={log} />
                ))}
                {studentLogs.length > 6 && (
                  <button
                    onClick={() => navigate('/student-activity')}
                    className="flex items-center gap-1 mt-3 text-xs text-red-600 hover:text-red-800 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 rounded"
                  >
                    Ver todo ({studentLogs.length})
                    <ArrowUpRight className="h-3 w-3" />
                  </button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── 4. Distribución + Resumen general ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribución de progreso */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-base">
              <TrendingUp className="h-5 w-5 mr-2 text-red-600" />
              Distribución de progreso
            </CardTitle>
          </CardHeader>
          <CardContent>
            {totalDistStudents === 0 ? (
              <div className="flex flex-col items-center py-6 gap-2">
                <Clock className="h-8 w-8 text-gray-200" />
                <p className="text-sm text-gray-400">No hay estudiantes inscritos aún</p>
              </div>
            ) : (
              <div className="space-y-3">
                {distBars.map((bar) => {
                  const pct =
                    totalDistStudents > 0 ? Math.round((bar.count / totalDistStudents) * 100) : 0;
                  return (
                    <div key={bar.label} className="flex items-center gap-3">
                      <span className="text-[11px] font-medium text-gray-400 w-12 text-right shrink-0">
                        {bar.label}
                      </span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div
                          className={`${bar.color} h-2 rounded-full transition-all`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-600 w-16 shrink-0">
                        {bar.count} ({pct}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resumen general */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-base">
              <Activity className="h-5 w-5 mr-2 text-red-600" />
              Resumen general
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
                <div className="flex items-center gap-2 mb-0.5">
                  <BookOpen className="h-3.5 w-3.5 text-red-600" />
                  <p className="text-[11px] font-medium text-gray-500">Cursos</p>
                </div>
                <p className="text-lg font-bold text-gray-900 leading-tight">{generalInfo.courses}</p>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
                <div className="flex items-center gap-2 mb-0.5">
                  <Layers className="h-3.5 w-3.5 text-red-600" />
                  <p className="text-[11px] font-medium text-gray-500">Secciones</p>
                </div>
                <p className="text-lg font-bold text-gray-900 leading-tight">{generalInfo.sections}</p>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
                <div className="flex items-center gap-2 mb-0.5">
                  <GraduationCap className="h-3.5 w-3.5 text-red-600" />
                  <p className="text-[11px] font-medium text-gray-500">Profesores</p>
                </div>
                <p className="text-lg font-bold text-gray-900 leading-tight">{generalInfo.teachers}</p>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
                <div className="flex items-center gap-2 mb-0.5">
                  <Users className="h-3.5 w-3.5 text-red-600" />
                  <p className="text-[11px] font-medium text-gray-500">Estudiantes</p>
                </div>
                <p className="text-lg font-bold text-gray-900 leading-tight">{generalInfo.students}</p>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
                <div className="flex items-center gap-2 mb-0.5">
                  <UserPlus className="h-3.5 w-3.5 text-red-600" />
                  <p className="text-[11px] font-medium text-gray-500">Inscripciones</p>
                </div>
                <p className="text-lg font-bold text-gray-900 leading-tight">{generalInfo.enrollments}</p>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
                <div className="flex items-center gap-2 mb-0.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-red-600" />
                  <p className="text-[11px] font-medium text-gray-500">Completaciones</p>
                </div>
                <p className="text-lg font-bold text-gray-900 leading-tight">{generalInfo.completions}</p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 grid grid-cols-2 gap-3">
              <button
                onClick={() => navigate('/enrollments')}
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:border-red-200 hover:bg-red-50 hover:text-red-700 text-sm font-medium text-gray-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
              >
                <UserPlus className="h-4 w-4" />
                Inscripciones
              </button>
              <button
                onClick={() => navigate('/grades')}
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:border-red-200 hover:bg-red-50 hover:text-red-700 text-sm font-medium text-gray-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
              >
                <ClipboardList className="h-4 w-4" />
                Calificaciones
              </button>
              <button
                onClick={() => navigate('/courses')}
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:border-red-200 hover:bg-red-50 hover:text-red-700 text-sm font-medium text-gray-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
              >
                <BookOpen className="h-4 w-4" />
                Cursos
              </button>
              <button
                onClick={() => navigate('/forums')}
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:border-red-200 hover:bg-red-50 hover:text-red-700 text-sm font-medium text-gray-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
              >
                <MessageSquare className="h-4 w-4" />
                Foros
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SupervisorDashboard;
