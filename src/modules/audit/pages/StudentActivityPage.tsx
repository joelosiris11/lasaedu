import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Award,
  Download,
  Search,
  FileCheck,
  FileX,
  RefreshCw,
  GraduationCap,
  BookOpen,
  ClipboardList,
  X,
  Users,
  TrendingUp,
  CalendarDays,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';
import { useAuthStore } from '@app/store/authStore';
import { sectionService, courseService, userService } from '@shared/services/dataService';
import type { DBSection, DBUser } from '@shared/services/dataService';
import {
  listStudentActivity,
  type DBStudentActivityLog,
  type StudentActivityType,
} from '@shared/services/auditLogService';
import { exportToCSV } from '@shared/services/exportService';

// ─── Labels ──────────────────────────────────────────────────────────────────

const ACTIVITY_LABELS: Record<StudentActivityType, string> = {
  submission_created: 'Envió tarea',
  submission_resubmitted: 'Re-envió tarea',
  submission_deleted: 'Eliminó entrega',
  lesson_completed: 'Completó lección',
  course_completed: 'Completó curso',
  evaluation_submitted: 'Entregó evaluación',
  certificate_issued: 'Certificado emitido',
};

// All red shades — no blue/green/amber/purple/emerald
const ACTIVITY_COLORS: Record<StudentActivityType, string> = {
  submission_created: 'bg-red-50 text-red-700 border-red-200',
  submission_resubmitted: 'bg-red-100 text-red-700 border-red-300',
  submission_deleted: 'bg-red-200 text-red-800 border-red-400',
  lesson_completed: 'bg-rose-50 text-rose-700 border-rose-200',
  course_completed: 'bg-red-600 text-white border-red-600',
  evaluation_submitted: 'bg-red-500 text-white border-red-500',
  certificate_issued: 'bg-red-700 text-white border-red-700',
};

// Icons per activity type — all red-tinted when rendered
const ACTIVITY_ICONS: Record<StudentActivityType, React.ElementType> = {
  submission_created: FileCheck,
  submission_resubmitted: RefreshCw,
  submission_deleted: FileX,
  lesson_completed: BookOpen,
  course_completed: GraduationCap,
  evaluation_submitted: ClipboardList,
  certificate_issued: Award,
};

// ─── Avatar ───────────────────────────────────────────────────────────────────

function AvatarBadge({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <span
      aria-label={name}
      className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-red-700 text-white text-xs font-bold shrink-0 select-none"
    >
      {initials}
    </span>
  );
}

// ─── KPI strip ───────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number | string;
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

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({
  hasFilters,
  onClear,
}: {
  hasFilters: boolean;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
        <Activity className="h-8 w-8 text-red-400" />
      </div>
      <p className="text-base font-semibold text-gray-700 mb-1">
        {hasFilters ? 'Sin resultados para estos filtros' : 'Aún no hay actividad registrada'}
      </p>
      <p className="text-sm text-gray-500 text-center max-w-xs mb-4">
        {hasFilters
          ? 'Prueba con un rango de fechas más amplio o elimina algún filtro.'
          : 'La actividad de los estudiantes (entregas, completaciones, evaluaciones) aparecerá aquí en tiempo real.'}
      </p>
      {hasFilters && (
        <button
          onClick={onClear}
          className="text-sm font-medium text-red-600 hover:text-red-800 underline underline-offset-2 transition-colors"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-3 py-4" aria-busy="true" aria-label="Cargando actividad">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 animate-pulse">
          <div className="w-8 h-8 rounded-full bg-red-100 shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 bg-gray-100 rounded w-1/3" />
            <div className="h-3 bg-gray-100 rounded w-1/2" />
          </div>
          <div className="h-5 w-24 bg-red-50 rounded-full" />
          <div className="h-3 w-28 bg-gray-100 rounded hidden sm:block" />
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function StudentActivityPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<DBStudentActivityLog[]>([]);
  const [sections, setSections] = useState<DBSection[]>([]);
  const [students, setStudents] = useState<DBUser[]>([]);

  const [sectionFilter, setSectionFilter] = useState<string>('');
  const [studentFilter, setStudentFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const isTeacher = user?.role === 'teacher';

  useEffect(() => {
    (async () => {
      if (!user) return;
      setLoading(true);
      try {
        // Teacher: sus secciones + sus cursos (union) → ver todo su movimiento.
        // Admin/Supervisor: todo.
        const [visibleSections, teacherCourses] = await Promise.all([
          isTeacher
            ? sectionService.getByInstructor(user.id)
            : sectionService.getAll(),
          isTeacher ? courseService.getByInstructor(user.id) : Promise.resolve([]),
        ]);

        const sectionIds = visibleSections.map((s) => s.id);
        const courseIds = teacherCourses.map((c) => c.id);

        const [logsData, usersData] = await Promise.all([
          listStudentActivity(isTeacher ? { sectionIds, courseIds } : {}),
          userService.getAll(),
        ]);

        setSections(visibleSections);
        setStudents(usersData.filter((u) => u.role === 'student'));
        setLogs(logsData);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, isTeacher]);

  const filteredLogs = useMemo(() => {
    const fromTs = fromDate ? new Date(fromDate).getTime() : null;
    const toTs = toDate ? new Date(toDate).getTime() + 24 * 60 * 60 * 1000 : null;
    const needle = searchTerm.trim().toLowerCase();

    return logs.filter((l) => {
      if (sectionFilter && l.sectionId !== sectionFilter) return false;
      if (studentFilter && l.studentId !== studentFilter) return false;
      if (typeFilter && l.activityType !== typeFilter) return false;
      if (fromTs && l.timestamp < fromTs) return false;
      if (toTs && l.timestamp > toTs) return false;
      if (needle) {
        const hay = `${l.studentName} ${l.resourceName ?? ''}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [logs, sectionFilter, studentFilter, typeFilter, fromDate, toDate, searchTerm]);

  const sectionsById = useMemo(
    () => new Map(sections.map((s) => [s.id, s])),
    [sections]
  );

  // ── KPI derivations ────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);

    const submissionTypes: StudentActivityType[] = [
      'submission_created',
      'submission_resubmitted',
      'evaluation_submitted',
    ];

    const entregasHoy = logs.filter(
      (l) =>
        l.timestamp >= todayStart.getTime() && submissionTypes.includes(l.activityType)
    ).length;

    const entregasSemana = logs.filter(
      (l) =>
        l.timestamp >= weekStart.getTime() && submissionTypes.includes(l.activityType)
    ).length;

    const completacionesTotales = logs.filter(
      (l) =>
        l.activityType === 'lesson_completed' || l.activityType === 'course_completed'
    ).length;

    const estudiantesActivos = new Set(
      logs
        .filter((l) => l.timestamp >= weekStart.getTime())
        .map((l) => l.studentId)
    ).size;

    return { entregasHoy, entregasSemana, completacionesTotales, estudiantesActivos };
  }, [logs]);

  // ── Filter active check ────────────────────────────────────────────────────

  const hasActiveFilters =
    !!sectionFilter || !!studentFilter || !!typeFilter || !!fromDate || !!toDate || !!searchTerm;

  const clearFilters = () => {
    setSectionFilter('');
    setStudentFilter('');
    setTypeFilter('');
    setFromDate('');
    setToDate('');
    setSearchTerm('');
  };

  // ── Export ─────────────────────────────────────────────────────────────────

  const handleExport = () => {
    const rows = filteredLogs.map((l) => {
      const section = l.sectionId ? sectionsById.get(l.sectionId) : undefined;
      return {
        fecha: new Date(l.timestamp).toLocaleString(),
        estudiante: l.studentName,
        actividad: ACTIVITY_LABELS[l.activityType],
        recurso: l.resourceName ?? '',
        seccion: section?.title ?? '',
        curso: section?.courseTitle ?? '',
      };
    });
    exportToCSV(
      rows,
      [
        { key: 'fecha', header: 'Fecha' },
        { key: 'estudiante', header: 'Estudiante' },
        { key: 'actividad', header: 'Actividad' },
        { key: 'recurso', header: 'Recurso' },
        { key: 'seccion', header: 'Sección' },
        { key: 'curso', header: 'Curso' },
      ],
      {
        filename: `actividad_estudiantes_${new Date().toISOString().split('T')[0]}`,
        includeDate: true,
      }
    );
  };

  // ── Format date helper ─────────────────────────────────────────────────────

  const fmtDate = (ts: number) => {
    const d = new Date(ts);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const time = d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });

    if (d.toDateString() === today.toDateString()) return `Hoy ${time}`;
    if (d.toDateString() === yesterday.toDateString()) return `Ayer ${time}`;
    return d.toLocaleDateString('es', { day: 'numeric', month: 'short' }) + ' ' + time;
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Entregas hoy"
          value={loading ? '—' : kpis.entregasHoy}
          icon={FileCheck}
        />
        <KpiCard
          label="Entregas esta semana"
          value={loading ? '—' : kpis.entregasSemana}
          icon={CalendarDays}
        />
        <KpiCard
          label="Completaciones totales"
          value={loading ? '—' : kpis.completacionesTotales}
          icon={CheckCircle2}
        />
        <KpiCard
          label="Estudiantes activos"
          value={loading ? '—' : kpis.estudiantesActivos}
          icon={Users}
        />
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-gray-200 rounded-xl px-3 py-2.5">
        <div className="flex items-center gap-2 flex-wrap">

          {/* Search */}
          <div className="relative min-w-[180px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            <label htmlFor="activity-search" className="sr-only">Buscar estudiante o recurso</label>
            <input
              id="activity-search"
              type="text"
              placeholder="Buscar estudiante o recurso…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-8 pr-7 py-1.5 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
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

          {/* Sección — solo si hay más de 1 */}
          {sections.length > 1 && (
            <>
              <label htmlFor="filter-section" className="sr-only">Sección</label>
              <select
                id="filter-section"
                value={sectionFilter}
                onChange={(e) => setSectionFilter(e.target.value)}
                className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
              >
                <option value="">Todas las secciones</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} — {s.courseTitle}
                  </option>
                ))}
              </select>
            </>
          )}

          {/* Estudiante */}
          {students.length > 0 && (
            <>
              <label htmlFor="filter-student" className="sr-only">Estudiante</label>
              <select
                id="filter-student"
                value={studentFilter}
                onChange={(e) => setStudentFilter(e.target.value)}
                className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
              >
                <option value="">Todos los estudiantes</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </>
          )}

          {/* Tipo de actividad */}
          <label htmlFor="filter-type" className="sr-only">Tipo de actividad</label>
          <select
            id="filter-type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
          >
            <option value="">Todas las actividades</option>
            {Object.entries(ACTIVITY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          {/* Fecha desde */}
          <label htmlFor="filter-from" className="sr-only">Desde</label>
          <input
            id="filter-from"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
            aria-label="Desde"
          />

          {/* Fecha hasta */}
          <label htmlFor="filter-to" className="sr-only">Hasta</label>
          <input
            id="filter-to"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
            aria-label="Hasta"
          />

          {/* Right actions */}
          <div className="ml-auto flex items-center gap-2">
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs font-medium text-red-600 hover:text-red-800 transition-colors"
              >
                Limpiar
              </button>
            )}
            <Button
              onClick={handleExport}
              variant="outline"
              size="sm"
              disabled={filteredLogs.length === 0}
              className="text-xs border-gray-200 text-gray-700 hover:border-red-300 hover:text-red-700"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              <span className="hidden sm:inline">Exportar</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Results card */}
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-4">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-gray-900">
            <TrendingUp className="h-4 w-4 text-red-600" />
            Actividad
            <span className="ml-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-xs font-semibold">
              {loading ? '…' : filteredLogs.length}
            </span>
          </CardTitle>
        </CardHeader>

        <CardContent className="pt-0">
          {loading ? (
            <LoadingSkeleton />
          ) : filteredLogs.length === 0 ? (
            <EmptyState hasFilters={hasActiveFilters} onClear={clearFilters} />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left">
                      <th className="pb-3 pr-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Estudiante
                      </th>
                      <th className="pb-3 pr-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Actividad
                      </th>
                      <th className="pb-3 pr-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Recurso
                      </th>
                      <th className="pb-3 pr-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Sección / Curso
                      </th>
                      <th className="pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">
                        Fecha
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredLogs.map((l) => {
                      const section = l.sectionId ? sectionsById.get(l.sectionId) : undefined;
                      const Icon = ACTIVITY_ICONS[l.activityType];
                      return (
                        <tr
                          key={l.id}
                          className="hover:bg-red-50/40 transition-colors group"
                        >
                          {/* Student */}
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2.5">
                              <AvatarBadge name={l.studentName} />
                              <span className="font-medium text-gray-900 text-sm">
                                {l.studentName}
                              </span>
                            </div>
                          </td>

                          {/* Activity badge */}
                          <td className="py-3 pr-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${ACTIVITY_COLORS[l.activityType]}`}
                            >
                              <Icon className="h-3 w-3" />
                              {ACTIVITY_LABELS[l.activityType]}
                            </span>
                          </td>

                          {/* Resource */}
                          <td className="py-3 pr-4 text-gray-700 text-sm max-w-[200px] truncate">
                            {l.resourceName ?? (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>

                          {/* Section / Course */}
                          <td className="py-3 pr-4">
                            {section ? (
                              <div>
                                <p className="text-sm text-gray-800 font-medium">{section.title}</p>
                                <p className="text-xs text-gray-500">{section.courseTitle}</p>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-sm">—</span>
                            )}
                          </td>

                          {/* Date */}
                          <td className="py-3 text-right">
                            <span className="text-xs text-gray-500 whitespace-nowrap">
                              {fmtDate(l.timestamp)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile card list */}
              <div className="md:hidden space-y-2">
                {filteredLogs.map((l) => {
                  const section = l.sectionId ? sectionsById.get(l.sectionId) : undefined;
                  const Icon = ACTIVITY_ICONS[l.activityType];
                  return (
                    <div
                      key={l.id}
                      className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50/50"
                    >
                      <AvatarBadge name={l.studentName} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-semibold text-sm text-gray-900 truncate">
                            {l.studentName}
                          </span>
                          <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">
                            {fmtDate(l.timestamp)}
                          </span>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold mb-1 ${ACTIVITY_COLORS[l.activityType]}`}
                        >
                          <Icon className="h-3 w-3" />
                          {ACTIVITY_LABELS[l.activityType]}
                        </span>
                        {l.resourceName && (
                          <p className="text-xs text-gray-600 truncate">{l.resourceName}</p>
                        )}
                        {section && (
                          <p className="text-xs text-gray-500 truncate">
                            {section.title} — {section.courseTitle}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
