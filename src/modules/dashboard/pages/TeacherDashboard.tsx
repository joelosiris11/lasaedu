import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@app/store/authStore';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Users,
  ClipboardList,
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
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/Card';
import { CoursePattern } from '@shared/components/ui/CoursePattern';
import { getSectionBanner } from '@shared/utils/sectionBanner';
import {
  taskSubmissionService,
  sectionService,
  lessonService,
  type DBTaskSubmission,
  type DBSection,
  type DBEnrollment,
} from '@shared/services/dataService';
import { firebaseDB } from '@shared/services/firebaseDataService';

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

// ─── Section flags persistence (per-user, localStorage) ──────────────────────

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

// ─── Per-section enriched data ────────────────────────────────────────────────

interface SectionWithMetrics extends DBSection {
  avgProgress: number;
  avgGrade: number | null;
  enrolledStudents: number;
}

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

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TeacherDashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* KPI strip */}
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

      {/* Attention panel */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="h-4 w-48 bg-red-50 rounded" />
            <div className="h-5 w-8 rounded-full bg-red-50" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <div className="w-8 h-8 rounded-full bg-red-100 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-32 bg-gray-100 rounded" />
                  <div className="h-2.5 w-20 bg-gray-50 rounded" />
                </div>
                <div className="h-7 w-20 bg-red-50 rounded-lg" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Section grid skeleton */}
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
                <div className="flex gap-3 mt-2">
                  {[...Array(3)].map((_, j) => (
                    <div key={j} className="h-3 w-14 bg-gray-50 rounded" />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Pending submission row ───────────────────────────────────────────────────

interface PendingRow {
  submission: DBTaskSubmission;
  lessonTitle: string;
  sectionTitle: string;
  sectionId?: string;
}

function AttentionRow({
  row,
  onGrade,
}: {
  row: PendingRow;
  onGrade: () => void;
}) {
  const { submission, lessonTitle, sectionTitle } = row;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shrink-0">
        <span className="text-white text-[10px] font-bold leading-none">
          {initials(submission.studentName)}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{submission.studentName}</p>
        <p className="text-xs text-gray-500 truncate">
          {lessonTitle} · {sectionTitle}
        </p>
      </div>
      <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">
        {formatAge(submission.submittedAt)}
      </span>
      <button
        onClick={onGrade}
        className="ml-1 px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
      >
        Calificar
      </button>
    </div>
  );
}

// ─── SectionKebab ─────────────────────────────────────────────────────────────

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

// ─── SectionGridCard ──────────────────────────────────────────────────────────

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
      {/* Banner */}
      <div className="relative h-24 overflow-hidden">
        {getSectionBanner(section) ? (
          <img
            src={getSectionBanner(section)}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <CoursePattern courseKey={section.courseId} className="absolute inset-0 w-full h-full" />
        )}
        {/* Badges top-left */}
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
        {/* Kebab top-right */}
        <div className="absolute top-2 right-2">
          <SectionKebab flag={flag} onSetFlag={onSetFlag} darkBg />
        </div>
      </div>

      {/* Body */}
      <div className="p-3 flex flex-col flex-1">
        {/* Course title (small label) */}
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide truncate mb-0.5">
          {section.courseTitle}
        </p>
        {/* Section title */}
        <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 mb-3">
          {section.title}
        </h3>

        {/* Stats row */}
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

        {/* Progress bar */}
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

// ─── SectionListRow ───────────────────────────────────────────────────────────

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
      {/* Circle avatar with CoursePattern */}
      <div className="relative w-12 h-12 shrink-0 rounded-full overflow-hidden">
        {getSectionBanner(section) ? (
          <img
            src={getSectionBanner(section)}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <CoursePattern
            courseKey={section.courseId}
            circle
            className="absolute inset-0 w-full h-full"
          />
        )}
        {flag === 'featured' && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-white flex items-center justify-center shadow">
            <Star className="h-2.5 w-2.5 fill-red-600 text-red-600" />
          </span>
        )}
      </div>

      {/* Middle content */}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide truncate">
          {section.courseTitle}
        </p>
        <h3 className="font-medium text-gray-900 text-sm truncate">{section.title}</h3>
        <div className="flex items-center gap-3 mt-1">
          <div className="flex-1 bg-gray-100 rounded-full h-1.5 max-w-xs">
            <div
              className="h-1.5 rounded-full bg-red-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs font-medium text-gray-600 shrink-0">{progress}%</span>
        </div>
      </div>

      {/* Kebab */}
      <div
        className="shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <SectionKebab flag={flag} onSetFlag={onSetFlag} />
      </div>
    </div>
  );
}

// ─── TeacherDashboard ─────────────────────────────────────────────────────────

const TeacherDashboard = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  // ── Section data ──────────────────────────────────────────────────────────
  const [sections, setSections] = useState<DBSection[]>([]);
  const [enrollments, setEnrollments] = useState<DBEnrollment[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState(true);

  // ── Pending submissions ───────────────────────────────────────────────────
  const [pendingRows, setPendingRows] = useState<PendingRow[]>([]);
  const [totalPendingCount, setTotalPendingCount] = useState(0);
  const [submissionsThisWeek, setSubmissionsThisWeek] = useState(0);
  const [pendingLoading, setPendingLoading] = useState(true);

  // ── Widget UI state ───────────────────────────────────────────────────────
  const [sectionFilter, setSectionFilter] = useState<SectionFilter>('activa');
  const [filterOpen, setFilterOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [flags, setFlags] = useState<Record<string, SectionFlag>>({});

  // Load flags once when user id is known
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

  // ── Fetch sections + all enrollments (single round-trip) ─────────────────
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    async function fetchSectionsAndEnrollments() {
      try {
        const [fetchedSections, fetchedEnrollments] = await Promise.all([
          sectionService.getByInstructor(user!.id),
          firebaseDB.getEnrollments(),
        ]);
        if (cancelled) return;
        setSections(fetchedSections);
        setEnrollments(fetchedEnrollments);
      } catch {
        // fail silently
      } finally {
        if (!cancelled) setSectionsLoading(false);
      }
    }

    fetchSectionsAndEnrollments();
    return () => { cancelled = true; };
  }, [user?.id]);

  // ── Bucket enrollments by sectionId (O(n), single pass) ──────────────────
  const enrollmentsBySectionId = useMemo(() => {
    const map = new Map<string, DBEnrollment[]>();
    for (const enrollment of enrollments) {
      if (!enrollment.sectionId) continue;
      const bucket = map.get(enrollment.sectionId) ?? [];
      bucket.push(enrollment);
      map.set(enrollment.sectionId, bucket);
    }
    return map;
  }, [enrollments]);

  // ── Compute per-section metrics ───────────────────────────────────────────
  const sectionsWithMetrics = useMemo<SectionWithMetrics[]>(() => {
    return sections.map((section) => {
      const sectionEnrollments = enrollmentsBySectionId.get(section.id) ?? [];
      const activeEnrollments = sectionEnrollments.filter(
        (e) => e.status === 'active' || e.status === 'completed'
      );
      const enrolledStudents = activeEnrollments.length || section.studentsCount;
      const avgProgress =
        activeEnrollments.length > 0
          ? Math.round(
              activeEnrollments.reduce((sum, e) => sum + (e.progress || 0), 0) /
                activeEnrollments.length
            )
          : 0;
      const graded = activeEnrollments.filter((e) => e.grade != null);
      const avgGrade =
        graded.length > 0
          ? Math.round(
              graded.reduce((sum, e) => sum + (e.grade as number), 0) / graded.length
            )
          : null;

      return { ...section, avgProgress, avgGrade, enrolledStudents };
    });
  }, [sections, enrollmentsBySectionId]);

  // ── Fetch pending submissions ─────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id || sections.length === 0) return;
    let cancelled = false;

    async function fetchPending() {
      try {
        const sectionIds = new Set(sections.map((s) => s.id));
        const allSubmissions: DBTaskSubmission[] = await taskSubmissionService.getAll();
        const mine = allSubmissions.filter(
          (s) => s.sectionId && sectionIds.has(s.sectionId)
        );

        const pending = mine
          .filter((s) => s.status === 'submitted')
          .sort((a, b) => a.submittedAt - b.submittedAt);

        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const weekCount = mine.filter((s) => s.submittedAt >= sevenDaysAgo).length;

        if (cancelled) return;
        setSubmissionsThisWeek(weekCount);
        setTotalPendingCount(pending.length);

        const sliced = pending.slice(0, 5);
        const lessonCache = new Map<string, string>();
        await Promise.allSettled(
          [...new Set(sliced.map((s) => s.lessonId).filter(Boolean))].map(async (id) => {
            try {
              const lesson = await lessonService.getById(id as string);
              lessonCache.set(id as string, lesson?.title ?? 'Tarea sin título');
            } catch {
              lessonCache.set(id as string, 'Tarea sin título');
            }
          })
        );

        if (cancelled) return;

        const rows: PendingRow[] = sliced.map((sub) => {
          const sec = sections.find((s) => s.id === sub.sectionId);
          const sectionTitle = sec?.title ?? sec?.courseTitle ?? 'Sección';
          const lessonTitle =
            sub.lessonId && lessonCache.has(sub.lessonId)
              ? lessonCache.get(sub.lessonId)!
              : 'Tarea sin título';
          return { submission: sub, lessonTitle, sectionTitle, sectionId: sub.sectionId };
        });

        setPendingRows(rows);
      } catch {
        // fail silently
      } finally {
        if (!cancelled) setPendingLoading(false);
      }
    }

    fetchPending();
    return () => { cancelled = true; };
  }, [user?.id, sections]);

  // ── Progress distribution from section enrollments ────────────────────────
  const progressDist = useMemo(() => {
    const sectionIds = new Set(sections.map((s) => s.id));
    const relevant = enrollments.filter(
      (e) => e.sectionId && sectionIds.has(e.sectionId) &&
             (e.status === 'active' || e.status === 'completed')
    );
    const dist = { low: 0, medium: 0, high: 0, complete: 0 };
    for (const e of relevant) {
      const p = e.progress || 0;
      if (p < 25) dist.low++;
      else if (p < 50) dist.medium++;
      else if (p < 100) dist.high++;
      else dist.complete++;
    }
    return dist;
  }, [enrollments, sections]);

  // ── KPI derivations ───────────────────────────────────────────────────────
  const sectionIds = useMemo(() => new Set(sections.map((s) => s.id)), [sections]);

  const activeStudentCount = useMemo(() => {
    const distinctUsers = new Set<string>();
    for (const e of enrollments) {
      if (e.sectionId && sectionIds.has(e.sectionId) && e.status === 'active') {
        distinctUsers.add(e.userId);
      }
    }
    return distinctUsers.size;
  }, [enrollments, sectionIds]);

  const avgGradeKpi = useMemo(() => {
    const gradedSections = sectionsWithMetrics.filter((s) => s.avgGrade !== null);
    if (gradedSections.length === 0) return null;
    return Math.round(
      gradedSections.reduce((sum, s) => sum + (s.avgGrade as number), 0) / gradedSections.length
    );
  }, [sectionsWithMetrics]);

  // ── Section filter buckets ────────────────────────────────────────────────

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
    const activa = sortFeaturedFirst(visible.filter((s) => s.status === 'activa'));
    const finalizada = sortFeaturedFirst(visible.filter((s) => s.status === 'finalizada'));
    const archivada = sortFeaturedFirst(visible.filter((s) => s.status === 'archivada'));
    const all = sortFeaturedFirst(visible);
    return { activa, finalizada, archivada, all };
  }, [sectionsWithMetrics, flags, sortFeaturedFirst]);

  const countFor = (key: SectionFilter): number => buckets[key].length;

  const displaySections = buckets[sectionFilter];

  const totalDistStudents =
    progressDist.low + progressDist.medium + progressDist.high + progressDist.complete;

  const distBars = [
    { label: '0–25%', count: progressDist.low, color: 'bg-red-300' },
    { label: '25–50%', count: progressDist.medium, color: 'bg-red-400' },
    { label: '50–75%', count: progressDist.high, color: 'bg-red-500' },
    { label: '75–100%', count: progressDist.complete, color: 'bg-red-600' },
  ];

  if (sectionsLoading) {
    return <TeacherDashboardSkeleton />;
  }

  return (
    <div className="space-y-6">

      {/* ── 1. KPI Strip ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Pendientes por calificar"
          value={pendingLoading ? '—' : totalPendingCount}
          icon={ClipboardList}
        />
        <KpiCard
          label="Estudiantes activos"
          value={activeStudentCount}
          icon={Users}
        />
        <KpiCard
          label="Entregas esta semana"
          value={pendingLoading ? '—' : submissionsThisWeek}
          icon={TrendingUp}
        />
        <KpiCard
          label="Promedio general"
          value={avgGradeKpi !== null ? avgGradeKpi : '—'}
          icon={BookOpen}
        />
      </div>

      {/* ── 2. "Requiere tu atención" ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-base">
            <ClipboardList className="h-5 w-5 mr-2 text-red-600" />
            Requiere tu atención
            {!pendingLoading && totalPendingCount > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-xs font-semibold">
                {totalPendingCount}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingLoading ? (
            <div className="space-y-2 animate-pulse">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-2">
                  <div className="w-8 h-8 rounded-full bg-red-100 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-36 bg-gray-100 rounded" />
                    <div className="h-2.5 w-24 bg-gray-50 rounded" />
                  </div>
                  <div className="h-7 w-20 bg-red-50 rounded-lg" />
                </div>
              ))}
            </div>
          ) : pendingRows.length === 0 ? (
            <div className="flex flex-col items-center py-8 gap-2">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-red-400" />
              </div>
              <p className="text-sm font-medium text-gray-700">Todo al día</p>
              <p className="text-xs text-gray-400">No hay entregas pendientes de calificar.</p>
            </div>
          ) : (
            <>
              {pendingRows.map((row) => (
                <AttentionRow
                  key={row.submission.id}
                  row={row}
                  onGrade={() => {
                    if (row.sectionId) {
                      navigate(`/sections/${row.sectionId}`);
                    } else {
                      navigate('/grades');
                    }
                  }}
                />
              ))}
              {totalPendingCount > 5 && (
                <button
                  onClick={() => navigate('/grades')}
                  className="flex items-center gap-1 mt-3 text-xs text-red-600 hover:text-red-800 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 rounded"
                >
                  Ver todos ({totalPendingCount})
                  <ArrowUpRight className="h-3 w-3" />
                </button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── 3. Mis Secciones widget ───────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="space-y-2">
            <CardTitle className="flex items-center text-base">
              <Layers className="h-5 w-5 mr-2 text-red-600" />
              Mis Secciones
            </CardTitle>
            <div className="flex items-center justify-between gap-2">

              {/* Filter dropdown — LEFT */}
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
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setFilterOpen(false)}
                    />
                    <div className="absolute left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
                      {FILTER_ORDER.map((key) => {
                        const active = sectionFilter === key;
                        const Icon =
                          key === 'activa' ? TrendingUp :
                          key === 'finalizada' ? CheckCircle2 :
                          key === 'archivada' ? EyeOff :
                          Layers;
                        return (
                          <button
                            key={key}
                            onClick={() => {
                              setSectionFilter(key);
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
                  aria-label="Vista cuadrícula"
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
                  aria-label="Vista lista"
                >
                  <ListIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Empty: no sections at all */}
          {sectionsWithMetrics.length === 0 && (
            <div className="flex flex-col items-center py-16 px-4 rounded-xl border border-dashed border-gray-200">
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
                <Layers className="h-8 w-8 text-red-300" />
              </div>
              <p className="text-sm font-semibold text-gray-700 mb-1">
                Aún no tienes secciones creadas
              </p>
              <p className="text-xs text-gray-400 text-center max-w-xs mb-4">
                Crea tu primera sección desde "Mis Secciones" para gestionar estudiantes y progreso.
              </p>
              <button
                onClick={() => navigate('/my-sections')}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
              >
                Crear sección
              </button>
            </div>
          )}

          {/* Empty: filter bucket is empty but other buckets have data */}
          {sectionsWithMetrics.length > 0 && displaySections.length === 0 && (
            <div className="flex flex-col items-center py-10 px-4 text-center">
              <CheckCircle2 className="h-10 w-10 text-red-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">
                No hay secciones {FILTER_LABELS[sectionFilter].toLowerCase()}
              </p>
              {/* Link to most populated bucket */}
              {(() => {
                const best = FILTER_ORDER.find(
                  (k) => k !== sectionFilter && countFor(k) > 0
                );
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

          {/* Grid view */}
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

          {/* List view */}
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

          {/* "Ver todas" link when truncated */}
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

      {/* ── 4. Secondary row: Distribution + Quick Actions ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Progress Distribution — recomputed from section enrollments */}
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
                    totalDistStudents > 0
                      ? Math.round((bar.count / totalDistStudents) * 100)
                      : 0;
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

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Acciones rápidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: BookOpen, label: 'Crear Curso', path: '/courses/new' },
                { icon: ClipboardList, label: 'Calificaciones', path: '/grades' },
                { icon: UserPlus, label: 'Inscripciones', path: '/enrollments' },
                { icon: MessageSquare, label: 'Foros', path: '/forums' },
              ].map((action) => (
                <button
                  key={action.path}
                  onClick={() => navigate(action.path)}
                  className="flex flex-col items-center p-4 rounded-xl border border-gray-200 hover:border-red-200 hover:bg-red-50 hover:shadow-sm transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                >
                  <div className="p-2 rounded-lg bg-red-100 group-hover:bg-red-200 text-red-600 mb-2 transition-colors">
                    <action.icon className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-medium text-gray-700 group-hover:text-red-700 transition-colors">
                    {action.label}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TeacherDashboard;
