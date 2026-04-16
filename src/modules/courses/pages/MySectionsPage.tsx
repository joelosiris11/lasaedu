import { useCallback, useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@app/store/authStore';
import {
  sectionService,
  courseService,
  type DBSection,
  type DBEnrollment,
  type DBCourse,
} from '@shared/services/dataService';
import { firebaseDB } from '@shared/services/firebaseDataService';
import {
  Layers,
  BookOpen,
  Users,
  Plus,
  TrendingUp,
  CheckCircle,
  LayoutGrid,
  List as ListIcon,
  MoreHorizontal,
  Star,
  EyeOff,
  Eye,
  StarOff,
  CheckCircle2,
  Search,
} from 'lucide-react';
import { Card, CardContent } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';
import { CoursePattern } from '@shared/components/ui/CoursePattern';
import { getSectionBanner } from '@shared/utils/sectionBanner';
import CourseWizardModal from '@modules/courses/components/CourseWizardModal';
import SectionWizardModal from '@modules/courses/components/SectionWizardModal';

// ─── Types ────────────────────────────────────────────────────────────────────

type SectionFilter = 'activa' | 'finalizada' | 'archivada' | 'starred' | 'all';
type StudentStatusFilter = 'in_progress' | 'completed';
type SectionFlag = 'featured' | 'hidden' | null;

interface SectionWithMetrics extends DBSection {
  progress: number;
  enrollmentGrade?: number | null;
  lastAccess?: number | null;
  // teacher-only metrics (computed from enrollments when available)
  avgProgress: number;
  avgGrade: number | null;
  enrolledStudents: number;
}

// ─── Filter config ────────────────────────────────────────────────────────────

const FILTER_LABELS: Record<SectionFilter, string> = {
  activa: 'En curso',
  finalizada: 'Finalizadas',
  archivada: 'Archivadas',
  starred: 'Destacadas',
  all: 'Todas',
};

const FILTER_ORDER: SectionFilter[] = ['activa', 'finalizada', 'archivada', 'starred', 'all'];

// ─── Status styles ────────────────────────────────────────────────────────────

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

// ─── Flag persistence (shared key with TeacherDashboard) ─────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── SectionGridCard (Student variant) ───────────────────────────────────────
// Same anatomy as teacher card but stats are: Progreso / Último acceso / Nota

function StudentSectionGridCard({
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
  const progress = Math.min(section.progress, 100);

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

      {/* Body */}
      <div className="p-3 flex flex-col flex-1">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide truncate mb-0.5">
          {section.courseTitle}
        </p>
        <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 mb-3">
          {section.title}
        </h3>

        {/* Stats: Progreso / Último acceso / Nota */}
        <div className="flex items-center gap-3 mb-3">
          <div className="text-center min-w-0">
            <p className="text-base font-bold text-gray-900 leading-none">{progress}%</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Progreso</p>
          </div>
          <div className="w-px h-6 bg-gray-100 shrink-0" />
          <div className="text-center min-w-0 flex-1 overflow-hidden">
            <p className="text-[11px] font-semibold text-gray-700 leading-none truncate">
              {section.lastAccess ? formatAge(section.lastAccess) : '—'}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">Último acceso</p>
          </div>
          {section.enrollmentGrade != null && (
            <>
              <div className="w-px h-6 bg-gray-100 shrink-0" />
              <div className="text-center min-w-0">
                <p className="text-base font-bold text-gray-900 leading-none">
                  {section.enrollmentGrade}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">Nota</p>
              </div>
            </>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-auto w-full bg-gray-100 rounded-full h-1">
          <div
            className="bg-red-500 h-1 rounded-full transition-all"
            style={{ width: `${progress}%` }}
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

// ─── SectionListRow (Student variant) ─────────────────────────────────────────
// Uses enrollment progress directly instead of avgProgress

function StudentSectionListRow({
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
  const progress = Math.min(section.progress, 100);

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

      <div
        className="shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <SectionKebab flag={flag} onSetFlag={onSetFlag} />
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Cargando secciones">
      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-white shadow-sm px-3 py-2.5">
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

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 py-1">
        <div className="h-7 w-32 bg-gray-100 rounded-lg" />
        <div className="flex gap-2">
          <div className="h-7 w-7 bg-gray-100 rounded-lg" />
          <div className="h-7 w-7 bg-gray-100 rounded-lg" />
          <div className="h-7 w-24 bg-gray-100 rounded-lg" />
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-white p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-red-50 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-2.5 w-12 bg-gray-100 rounded" />
                <div className="h-4 w-3/4 bg-gray-100 rounded" />
              </div>
            </div>
            <div className="flex gap-4">
              <div className="h-3 w-16 bg-gray-50 rounded" />
              <div className="h-3 w-14 bg-gray-50 rounded" />
              <div className="h-3 w-10 bg-gray-50 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Empty states ─────────────────────────────────────────────────────────────

function EmptyState({
  isStudent,
  hasCourses,
  onAction,
}: {
  isStudent: boolean;
  hasCourses: boolean;
  onAction: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 rounded-xl border border-dashed border-gray-200">
      <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
        <Layers className="h-8 w-8 text-red-300" />
      </div>
      <p className="text-sm font-semibold text-gray-700 mb-1">
        {isStudent
          ? 'Aún no estás inscrito en ninguna sección'
          : 'Aún no has creado ninguna sección'}
      </p>
      <p className="text-xs text-gray-400 text-center max-w-xs mb-4">
        {isStudent
          ? 'Explora el catálogo de cursos y únete a una sección para comenzar.'
          : hasCourses
          ? 'Selecciona un curso en el menú de arriba para crear tu primera sección.'
          : 'Primero crea un curso; luego podrás agregar secciones aquí.'}
      </p>
      <Button size="sm" onClick={onAction}>
        {isStudent ? 'Explorar cursos' : hasCourses ? 'Ver mis cursos' : 'Crear un curso'}
      </Button>
    </div>
  );
}

function FilterEmptyState({
  label,
  onSwitch,
  switchLabel,
}: {
  label: string;
  onSwitch?: () => void;
  switchLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center py-10 px-4 text-center rounded-xl border border-dashed border-gray-200">
      <Search className="h-10 w-10 text-red-300 mx-auto mb-2" />
      <p className="text-sm text-gray-500">{label}</p>
      {onSwitch && switchLabel && (
        <button
          onClick={onSwitch}
          className="mt-3 text-sm text-red-600 hover:text-red-800 font-medium"
        >
          {switchLabel}
        </button>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MySectionsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthStore();

  const isStudent = user?.role === 'student';

  // ── Data state ───────────────────────────────────────────────────────────
  const [sections, setSections] = useState<SectionWithMetrics[]>([]);
  const [teacherCourses, setTeacherCourses] = useState<DBCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewSectionPicker, setShowNewSectionPicker] = useState(false);
  const [courseWizardOpen, setCourseWizardOpen] = useState(false);
  const [sectionWizardCourseId, setSectionWizardCourseId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [sectionFilter, setSectionFilter] = useState<SectionFilter>('activa');
  const [courseFilter, setCourseFilter] = useState<string | 'all'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [flags, setFlags] = useState<Record<string, SectionFlag>>({});
  const [searchQuery, setSearchQuery] = useState('');

  // Student status filter (synced to URL ?status=)
  const [studentFilter, setStudentFilter] = useState<StudentStatusFilter>(
    searchParams.get('status') === 'completed' ? 'completed' : 'in_progress'
  );

  // Load flags once
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

  // Sync URL ?status with studentFilter
  useEffect(() => {
    const urlStatus = searchParams.get('status');
    const desired = urlStatus === 'completed' ? 'completed' : 'in_progress';
    if (desired !== studentFilter) setStudentFilter(desired);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const setStudentFilterAndUrl = (next: StudentStatusFilter) => {
    setStudentFilter(next);
    const params = new URLSearchParams(searchParams);
    if (next === 'completed') params.set('status', 'completed');
    else params.delete('status');
    setSearchParams(params, { replace: true });
  };

  // ── Data loading ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      setLoading(true);
      try {
        if (isStudent) {
          const enrollments = await firebaseDB.getEnrollmentsByUser(user.id);
          const sectionEnrollments = enrollments.filter(
            (e: DBEnrollment) =>
              e.sectionId && (e.status === 'active' || e.status === 'completed')
          );
          const enriched: SectionWithMetrics[] = [];
          for (const enrollment of sectionEnrollments) {
            const section = await sectionService.getById(enrollment.sectionId!);
            if (section) {
              const progress = enrollment.progress || 0;
              enriched.push({
                ...section,
                progress,
                enrollmentGrade: enrollment.grade ?? null,
                lastAccess: enrollment.lastAccessedAt ? new Date(enrollment.lastAccessedAt).getTime() : null,
                // student cards don't use these but the type requires them
                avgProgress: progress,
                avgGrade: enrollment.grade ?? null,
                enrolledStudents: section.studentsCount,
              });
            }
          }
          setSections(enriched);
        } else {
          const [allSections, enrollments, courses] = await Promise.all([
            user.role === 'admin' || user.role === 'supervisor'
              ? sectionService.getAll()
              : sectionService.getByInstructor(user.id),
            firebaseDB.getEnrollments(),
            user.role === 'admin' || user.role === 'supervisor'
              ? courseService.getAll()
              : courseService.getByInstructor(user.id),
          ]);

          // Bucket enrollments by sectionId
          const bySection = new Map<string, DBEnrollment[]>();
          for (const e of enrollments) {
            if (!e.sectionId) continue;
            const bucket = bySection.get(e.sectionId) ?? [];
            bucket.push(e);
            bySection.set(e.sectionId, bucket);
          }

          const enriched: SectionWithMetrics[] = allSections
            .sort((a, b) => b.createdAt - a.createdAt)
            .map((section) => {
              const sectionEnrollments = bySection.get(section.id) ?? [];
              const active = sectionEnrollments.filter(
                (e) => e.status === 'active' || e.status === 'completed'
              );
              const enrolledStudents = active.length || section.studentsCount;
              const avgProgress =
                active.length > 0
                  ? Math.round(
                      active.reduce((sum, e) => sum + (e.progress || 0), 0) / active.length
                    )
                  : 0;
              const graded = active.filter((e) => e.grade != null);
              const avgGrade =
                graded.length > 0
                  ? Math.round(
                      graded.reduce((sum, e) => sum + (e.grade as number), 0) / graded.length
                    )
                  : null;
              return {
                ...section,
                progress: avgProgress,
                enrollmentGrade: null,
                lastAccess: null,
                avgProgress,
                avgGrade,
                enrolledStudents,
              };
            });

          setSections(enriched);
          setTeacherCourses(courses);
        }
      } catch (err) {
        console.error('Error loading sections:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.id, isStudent, reloadKey]);

  // ── KPI derivations ───────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    if (isStudent) {
      const total = sections.length;
      const avgProgress =
        total > 0
          ? Math.round(sections.reduce((sum, s) => sum + (s.progress || 0), 0) / total)
          : 0;
      const completed = sections.filter((s) => s.progress >= 100).length;
      const inProgress = sections.filter((s) => s.progress > 0 && s.progress < 100).length;
      return { avgProgress, completed, inProgress, total };
    } else {
      const total = sections.length;
      const active = sections.filter((s) => s.status === 'activa').length;
      const totalStudents = sections.reduce((sum, s) => sum + s.enrolledStudents, 0);
      const uniqueCourses = new Set(sections.map((s) => s.courseId)).size;
      return { total, active, totalStudents, uniqueCourses };
    }
  }, [sections, isStudent]);

  // ── Section flag sorting ──────────────────────────────────────────────────
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

  // ── Teacher buckets (by status) ───────────────────────────────────────────
  const teacherBuckets = useMemo(() => {
    if (isStudent) {
      return { activa: [], finalizada: [], archivada: [], starred: [], all: [] } as Record<SectionFilter, SectionWithMetrics[]>;
    }
    const visible = sections.filter((s) => flags[s.id] !== 'hidden');
    // Apply course filter
    const byCourse = courseFilter === 'all' ? visible : visible.filter((s) => s.courseId === courseFilter);
    // Apply search filter (case-insensitive, trim) — before bucketing so counts reflect search
    const q = searchQuery.trim().toLowerCase();
    const searched = q
      ? byCourse.filter(
          (s) =>
            s.title.toLowerCase().includes(q) ||
            (s.courseTitle ?? '').toLowerCase().includes(q)
        )
      : byCourse;
    return {
      activa: sortFeaturedFirst(searched.filter((s) => s.status === 'activa')),
      finalizada: sortFeaturedFirst(searched.filter((s) => s.status === 'finalizada')),
      archivada: sortFeaturedFirst(searched.filter((s) => s.status === 'archivada')),
      // starred: any status, flag === 'featured'
      starred: sortFeaturedFirst(searched.filter((s) => flags[s.id] === 'featured')),
      all: sortFeaturedFirst(searched),
    };
  }, [sections, flags, courseFilter, searchQuery, isStudent, sortFeaturedFirst]);

  const countFor = (key: SectionFilter): number => teacherBuckets[key].length;

  // Teacher: flat list for current filter (no course grouping)
  const teacherFlatSections = useMemo(() => {
    return teacherBuckets[sectionFilter];
  }, [teacherBuckets, sectionFilter]);

  // Student: filtered sections
  const studentFiltered = useMemo(() => {
    if (!isStudent) return [];
    const visible = sections.filter((s) => flags[s.id] !== 'hidden');
    const byStatus =
      studentFilter === 'completed'
        ? visible.filter((s) => s.progress >= 100)
        : visible.filter((s) => s.progress < 100);
    return sortFeaturedFirst(byStatus);
  }, [sections, flags, studentFilter, isStudent, sortFeaturedFirst]);

  const teacherDisplaySections = teacherFlatSections;

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleEmptyAction = () => {
    if (isStudent) navigate('/courses');
    else if (teacherCourses.length > 0) navigate('/courses');
    else setCourseWizardOpen(true);
  };

  const reloadData = () => setReloadKey((k) => k + 1);

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="px-4 sm:px-6 pt-2 pb-6">
        <PageSkeleton />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 pt-2 pb-4 sm:pb-6 space-y-3 sm:space-y-4">

      {/* ── KPI strip ── */}
      {isStudent ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label="Promedio"
            value={`${(kpis as { avgProgress: number }).avgProgress}%`}
            icon={TrendingUp}
          />
          <KpiCard
            label="Completados"
            value={(kpis as { completed: number }).completed}
            icon={CheckCircle}
          />
          <KpiCard
            label="En progreso"
            value={(kpis as { inProgress: number }).inProgress}
            icon={BookOpen}
          />
          <KpiCard
            label="Inscripciones"
            value={(kpis as { total: number }).total}
            icon={Layers}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label="Total secciones"
            value={(kpis as { total: number }).total}
            icon={Layers}
          />
          <KpiCard
            label="Secciones activas"
            value={(kpis as { active: number }).active}
            icon={CheckCircle}
          />
          <KpiCard
            label="Estudiantes activos"
            value={(kpis as { totalStudents: number }).totalStudents}
            icon={Users}
          />
          <KpiCard
            label="Cursos impartidos"
            value={(kpis as { uniqueCourses: number }).uniqueCourses}
            icon={BookOpen}
          />
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="bg-white border border-gray-200 rounded-xl px-3 py-2.5">
        <div className="flex items-center gap-2 flex-wrap">

          {/* Search — teacher/admin only */}
          {!isStudent && (
            <div className="relative min-w-[180px] max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar sección…"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-8 pr-7 py-1.5 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
                aria-label="Buscar sección"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded"
                  aria-label="Limpiar búsqueda"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          )}

          {/* Left: status filter chips */}
          {isStudent ? (
            /* Student: two chips — untouched */
            <div className="flex items-center gap-1.5 flex-wrap">
              {([
                { key: 'in_progress' as const, label: 'En curso', count: sections.filter((s) => s.progress < 100).length },
                { key: 'completed' as const, label: 'Completadas', count: sections.filter((s) => s.progress >= 100).length },
              ]).map((opt) => {
                const active = studentFilter === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => setStudentFilterAndUrl(opt.key)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 ${
                      active
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-red-300'
                    }`}
                  >
                    {opt.label}
                    <span className={`text-[10px] font-semibold ml-0.5 ${active ? 'text-red-100' : 'text-gray-400'}`}>
                      {opt.count}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            /* Teacher/admin: 5 status chips */
            <div className="flex items-center gap-1.5 flex-wrap">
              {FILTER_ORDER.map((key) => {
                const active = sectionFilter === key;
                return (
                  <button
                    key={key}
                    onClick={() => setSectionFilter(key)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 ${
                      active
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-red-300'
                    }`}
                  >
                    {key === 'starred' && (
                      <Star className={`h-3 w-3 ${active ? 'fill-white text-white' : 'fill-gray-400 text-gray-400'}`} />
                    )}
                    {FILTER_LABELS[key]}
                    <span className={`text-[10px] font-semibold ml-0.5 ${active ? 'text-red-100' : 'text-gray-400'}`}>
                      {countFor(key)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Teacher: course select — only when multiple courses */}
          {!isStudent && teacherCourses.length > 1 && (
            <select
              id="course-filter-select"
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-400 transition-colors cursor-pointer max-w-[180px]"
            >
              <option value="all">Todos los cursos</option>
              {teacherCourses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          )}

          {/* Right: view toggle + Nueva sección */}
          <div className="flex items-center gap-2 ml-auto">
            {/* View mode toggle */}
            <div className="inline-flex rounded-lg border border-gray-200 p-0.5">
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

            {/* Nueva sección — teacher only */}
            {!isStudent && teacherCourses.length > 0 && (
              <div className="relative">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowNewSectionPicker((v) => !v)}
                  className="text-xs"
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  <span className="hidden sm:inline">Nueva sección</span>
                  <span className="sm:hidden">Nueva</span>
                </Button>
                {showNewSectionPicker && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowNewSectionPicker(false)}
                    />
                    <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
                      <p className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                        Selecciona un curso
                      </p>
                      <div className="max-h-64 overflow-y-auto">
                        {teacherCourses.map((course) => (
                          <button
                            key={course.id}
                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-red-50 hover:text-red-700 flex items-center gap-2 transition-colors"
                            onClick={() => {
                              setShowNewSectionPicker(false);
                              setSectionWizardCourseId(course.id);
                            }}
                          >
                            <BookOpen className="h-4 w-4 text-red-400 shrink-0" />
                            <span className="truncate">{course.title}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Content ── */}

      {/* Empty: no sections at all */}
      {sections.length === 0 && (
        <EmptyState
          isStudent={isStudent}
          hasCourses={teacherCourses.length > 0}
          onAction={handleEmptyAction}
        />
      )}

      {/* ── Student view ── */}
      {isStudent && sections.length > 0 && (
        <>
          {/* Empty: status bucket is empty */}
          {studentFiltered.length === 0 && (
            <FilterEmptyState
              label={
                studentFilter === 'completed'
                  ? 'Aún no has completado ningún curso'
                  : 'No tienes cursos en proceso'
              }
              onSwitch={() =>
                setStudentFilterAndUrl(studentFilter === 'completed' ? 'in_progress' : 'completed')
              }
              switchLabel={
                studentFilter === 'completed' ? 'Ver en proceso' : 'Ver completados'
              }
            />
          )}

          {/* Grid */}
          {studentFiltered.length > 0 && viewMode === 'grid' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {studentFiltered.map((section) => (
                <StudentSectionGridCard
                  key={section.id}
                  section={section}
                  flag={flags[section.id] ?? null}
                  onOpen={() => navigate(`/sections/${section.id}`)}
                  onSetFlag={(next) => setFlag(section.id, next)}
                />
              ))}
            </div>
          )}

          {/* List */}
          {studentFiltered.length > 0 && viewMode === 'list' && (
            <div className="space-y-2">
              {studentFiltered.map((section) => (
                <StudentSectionListRow
                  key={section.id}
                  section={section}
                  flag={flags[section.id] ?? null}
                  onOpen={() => navigate(`/sections/${section.id}`)}
                  onSetFlag={(next) => setFlag(section.id, next)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Teacher / Admin view — flat list ── */}
      {!isStudent && sections.length > 0 && (
        <>
          {/* Empty: filter bucket is empty */}
          {teacherDisplaySections.length === 0 && (
            <FilterEmptyState
              label={
                searchQuery.trim()
                  ? `Sin resultados para "${searchQuery.trim()}"`
                  : sectionFilter === 'starred'
                  ? 'No tienes secciones destacadas'
                  : courseFilter !== 'all'
                  ? `No hay secciones ${FILTER_LABELS[sectionFilter].toLowerCase()} para este curso`
                  : `No hay secciones ${FILTER_LABELS[sectionFilter].toLowerCase()}`
              }
              onSwitch={(() => {
                if (searchQuery.trim()) return () => setSearchQuery('');
                if (sectionFilter === 'starred') return () => setSectionFilter('all');
                const best = FILTER_ORDER.filter((k) => k !== 'starred').find((k) => k !== sectionFilter && countFor(k) > 0);
                if (!best) return undefined;
                return () => setSectionFilter(best);
              })()}
              switchLabel={(() => {
                if (searchQuery.trim()) return 'Limpiar búsqueda';
                if (sectionFilter === 'starred') return 'Ver todas';
                const best = FILTER_ORDER.filter((k) => k !== 'starred').find((k) => k !== sectionFilter && countFor(k) > 0);
                if (!best) return undefined;
                return `Ver ${FILTER_LABELS[best].toLowerCase()} (${countFor(best)})`;
              })()}
            />
          )}

          {/* Grid */}
          {teacherDisplaySections.length > 0 && viewMode === 'grid' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {teacherDisplaySections.map((section) => (
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

          {/* List */}
          {teacherDisplaySections.length > 0 && viewMode === 'list' && (
            <div className="space-y-2">
              {teacherDisplaySections.map((section) => (
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
        </>
      )}

      <CourseWizardModal
        open={courseWizardOpen}
        onClose={() => setCourseWizardOpen(false)}
        onCreated={(created) => {
          setTeacherCourses((prev) => [created, ...prev]);
          navigate(`/courses/${created.id}`);
        }}
      />
      <SectionWizardModal
        open={!!sectionWizardCourseId}
        courseId={sectionWizardCourseId ?? undefined}
        onClose={() => setSectionWizardCourseId(null)}
        onSaved={reloadData}
      />
    </div>
  );
}
