import { useEffect, useMemo, useState } from 'react';
import {
  History,
  Download,
  Search,
  Plus,
  Pencil,
  Trash2,
  BookOpen,
  Users,
  Shield,
  X,
  TrendingUp,
  Activity,
  AlertTriangle,
  Eye,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';
import { Pagination } from '@shared/components/ui/Pagination';
import { usePagination } from '@shared/hooks/usePagination';
import { useAuthStore } from '@app/store/authStore';
import {
  userService,
  courseService,
  sectionService,
} from '@shared/services/dataService';
import {
  type DBAuditLog,
  type AuditAction,
  type AuditResourceType,
} from '@shared/services/auditLogService';
import type { DBUser, DBCourse, DBSection } from '@shared/services/dataService';
import { exportToCSV } from '@shared/services/exportService';
import AuditDetailsModal from '../components/AuditDetailsModal';
import { getResourceIcon, getResourceShortLabel } from '../utils/resourceDisplay';

// ─── Labels ──────────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<AuditAction, string> = {
  create: 'Creó',
  update: 'Editó',
  delete: 'Borró',
};

const RESOURCE_LABELS: Record<AuditResourceType, string> = {
  course: 'Curso',
  module: 'Módulo',
  lesson: 'Lección',
  section: 'Sección',
  user: 'Usuario',
  evaluation: 'Evaluación',
  department: 'Departamento',
  position: 'Puesto',
};

// All red shades — no green/blue/amber/purple/emerald
const ACTION_COLORS: Record<AuditAction, string> = {
  create: 'bg-red-50 text-red-700 border-red-200',
  update: 'bg-red-100 text-red-700 border-red-300',
  delete: 'bg-red-600 text-white border-red-600',
};

const ACTION_ICONS: Record<AuditAction, React.ElementType> = {
  create: Plus,
  update: Pencil,
  delete: Trash2,
};


// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

// ─── Avatar badge ─────────────────────────────────────────────────────────────

function AvatarBadge({ name, role }: { name: string; role: string }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <span
      aria-label={`${name} (${role})`}
      className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-red-700 text-white text-xs font-bold shrink-0 select-none"
    >
      {initials}
    </span>
  );
}

// ─── Role badge ───────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const Icon = role === 'admin' ? Shield : role === 'teacher' ? BookOpen : Users;
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-xs font-medium capitalize">
      <Icon className="h-2.5 w-2.5" />
      {role}
    </span>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: number | string;
  icon: React.ElementType;
  sub?: string;
}

function KpiCard({ label, value, icon: Icon, sub }: KpiCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">{label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
            {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
          </div>
          <div className="p-2.5 rounded-lg bg-red-50">
            <Icon className="h-5 w-5 text-red-600" />
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
        <History className="h-8 w-8 text-red-400" />
      </div>
      <p className="text-base font-semibold text-gray-700 mb-1">
        {hasFilters ? 'Sin resultados para estos filtros' : 'No hay registros de trazabilidad'}
      </p>
      <p className="text-sm text-gray-500 text-center max-w-xs mb-4">
        {hasFilters
          ? 'Prueba con un rango de fechas más amplio o elimina algún filtro.'
          : 'Los cambios realizados por administradores y profesores (cursos, módulos, lecciones, usuarios) quedarán registrados aquí.'}
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
    <div className="space-y-3 py-4" aria-busy="true" aria-label="Cargando registros">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 animate-pulse">
          <div className="w-4 h-4 bg-gray-100 rounded shrink-0" />
          <div className="w-8 h-8 rounded-full bg-red-100 shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 bg-gray-100 rounded w-1/4" />
            <div className="h-3 bg-gray-100 rounded w-1/6" />
          </div>
          <div className="h-5 w-16 bg-red-50 rounded-full" />
          <div className="h-3.5 w-20 bg-gray-100 rounded hidden sm:block" />
          <div className="h-3.5 w-32 bg-gray-100 rounded hidden lg:block" />
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AuditLogsPage() {
  const { user } = useAuthStore();
  const isTeacher = user?.role === 'teacher';

  const [users, setUsers] = useState<DBUser[]>([]);
  const [teacherCourses, setTeacherCourses] = useState<DBCourse[]>([]);
  const [teacherSections, setTeacherSections] = useState<DBSection[]>([]);
  const [scopeReady, setScopeReady] = useState(!isTeacher);
  const [selectedLog, setSelectedLog] = useState<DBAuditLog | null>(null);

  // Filters
  const [actorFilter, setActorFilter] = useState<string>('');
  const [resourceFilter, setResourceFilter] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Build Firestore filters from current filter state
  const firestoreFilters = useMemo(() => {
    const filters: { field: string; op: '==' | '>=' | '<='; value: unknown }[] = [];
    if (actorFilter) filters.push({ field: 'actorId', op: '==', value: actorFilter });
    if (resourceFilter) filters.push({ field: 'resourceType', op: '==', value: resourceFilter });
    if (actionFilter) filters.push({ field: 'action', op: '==', value: actionFilter });
    if (fromDate) {
      filters.push({ field: 'timestamp', op: '>=', value: new Date(fromDate).getTime() });
    }
    if (toDate) {
      filters.push({
        field: 'timestamp',
        op: '<=',
        value: new Date(toDate).getTime() + 24 * 60 * 60 * 1000,
      });
    }
    return filters;
  }, [actorFilter, resourceFilter, actionFilter, fromDate, toDate]);

  const {
    data,
    page,
    hasNext,
    hasPrev,
    loading,
    nextPage,
    prevPage,
  } = usePagination<DBAuditLog>({
    collectionName: 'auditLogs',
    pageSize: 50,
    orderByField: 'timestamp',
    orderDirection: 'desc',
    filters: firestoreFilters,
  });

  // Load users + teacher scope (for filtering)
  useEffect(() => {
    userService.getAll().then(setUsers);
    if (isTeacher && user?.id) {
      Promise.all([
        courseService.getByInstructor(user.id),
        sectionService.getByInstructor(user.id),
      ]).then(([c, s]) => {
        setTeacherCourses(c);
        setTeacherSections(s);
        setScopeReady(true);
      });
    } else {
      setScopeReady(true);
    }
  }, [isTeacher, user?.id]);

  const teacherCourseIds = useMemo(
    () => new Set(teacherCourses.map((c) => c.id)),
    [teacherCourses]
  );
  const teacherSectionIds = useMemo(
    () => new Set(teacherSections.map((s) => s.id)),
    [teacherSections]
  );

  // Client-side search filter + teacher scope
  const filteredLogs = useMemo(() => {
    let list = data;
    if (isTeacher && scopeReady && user?.id) {
      list = list.filter((l) => {
        if (l.actorId === user.id) return true;
        if (l.courseId && teacherCourseIds.has(l.courseId)) return true;
        if (l.sectionId && teacherSectionIds.has(l.sectionId)) return true;
        if (l.resourceType === 'course' && teacherCourseIds.has(l.resourceId)) return true;
        if (l.resourceType === 'section' && teacherSectionIds.has(l.resourceId)) return true;
        return false;
      });
    }
    const needle = searchTerm.trim().toLowerCase();
    if (needle) {
      list = list.filter((l) =>
        `${l.actorName} ${l.resourceName} ${l.resourceType}`.toLowerCase().includes(needle)
      );
    }
    return list;
  }, [data, isTeacher, scopeReady, user?.id, teacherCourseIds, teacherSectionIds, searchTerm]);

  // ── KPI derivations ────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);

    // Outcome: contenido nuevo publicado (creates de course/module/lesson/section) esta semana
    const contenidoPublicado = data.filter(
      (l) =>
        l.timestamp >= weekStart.getTime() &&
        l.action === 'create' &&
        (l.resourceType === 'course' ||
          l.resourceType === 'module' ||
          l.resourceType === 'lesson' ||
          l.resourceType === 'section')
    ).length;

    // Outcome: eliminaciones irreversibles (histórico) — señal crítica
    const eliminacionesIrreversibles = data.filter((l) => l.action === 'delete').length;

    // Outcome: profesores que han realizado cambios (no solo registrados)
    const profesoresActivos = new Set(
      data.filter((l) => l.actorRole === 'teacher').map((l) => l.actorId)
    ).size;

    // Outcome: actores distintos con actividad
    const actoresActivos = new Set(data.map((l) => l.actorId)).size;

    return {
      contenidoPublicado,
      eliminacionesIrreversibles,
      profesoresActivos,
      actoresActivos,
    };
  }, [data]);

  // ── Filter active check ────────────────────────────────────────────────────

  const hasActiveFilters =
    !!actorFilter || !!resourceFilter || !!actionFilter || !!fromDate || !!toDate || !!searchTerm;

  const clearFilters = () => {
    setActorFilter('');
    setResourceFilter('');
    setActionFilter('');
    setFromDate('');
    setToDate('');
    setSearchTerm('');
  };

  // ── Export ─────────────────────────────────────────────────────────────────

  const handleExport = () => {
    const rows = filteredLogs.map((l) => ({
      fecha: new Date(l.timestamp).toLocaleString(),
      actor: l.actorName,
      rol: l.actorRole,
      accion: ACTION_LABELS[l.action],
      tipo: RESOURCE_LABELS[l.resourceType],
      recurso: l.resourceName,
      cambios: l.changes
        ? Object.entries(l.changes)
            .map(([k, v]) => `${k}: ${formatValue(v.from)} → ${formatValue(v.to)}`)
            .join(' | ')
        : '',
    }));
    exportToCSV(
      rows,
      [
        { key: 'fecha', header: 'Fecha' },
        { key: 'actor', header: 'Actor' },
        { key: 'rol', header: 'Rol' },
        { key: 'accion', header: 'Acción' },
        { key: 'tipo', header: 'Tipo' },
        { key: 'recurso', header: 'Recurso' },
        { key: 'cambios', header: 'Cambios' },
      ],
      { filename: `trazabilidad_${new Date().toISOString().split('T')[0]}`, includeDate: true }
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard
          label="Contenido publicado"
          value={loading ? '—' : kpis.contenidoPublicado}
          icon={TrendingUp}
          sub="cursos, módulos y lecciones (7 días)"
        />
        <KpiCard
          label="Eliminaciones irreversibles"
          value={loading ? '—' : kpis.eliminacionesIrreversibles}
          icon={AlertTriangle}
          sub="histórico total"
        />
        <KpiCard
          label="Profesores activos"
          value={loading ? '—' : kpis.profesoresActivos}
          icon={Activity}
          sub="han realizado cambios"
        />
        <KpiCard
          label="Actores con actividad"
          value={loading ? '—' : kpis.actoresActivos}
          icon={Users}
          sub="admins + profesores"
        />
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-gray-200 rounded-xl px-3 py-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            <label htmlFor="audit-search" className="sr-only">Buscar</label>
            <input
              id="audit-search"
              type="text"
              placeholder="Buscar persona o cosa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-8 pr-7 py-1.5 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                aria-label="Limpiar búsqueda"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Persona */}
          <label htmlFor="audit-actor" className="sr-only">Persona</label>
          <select
            id="audit-actor"
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
          >
            <option value="">Todas las personas</option>
            {users
              .filter((u) => u.role === 'admin' || u.role === 'teacher')
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
          </select>

          {/* Tipo */}
          <label htmlFor="audit-resource" className="sr-only">Tipo</label>
          <select
            id="audit-resource"
            value={resourceFilter}
            onChange={(e) => setResourceFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
          >
            <option value="">Todos los tipos</option>
            {Object.entries(RESOURCE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>

          {/* Acción */}
          <label htmlFor="audit-action" className="sr-only">Qué hizo</label>
          <select
            id="audit-action"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
          >
            <option value="">Cualquier acción</option>
            {Object.entries(ACTION_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>

          {/* Fechas */}
          <label htmlFor="audit-from" className="sr-only">Desde</label>
          <input
            id="audit-from"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
            aria-label="Desde"
          />
          <label htmlFor="audit-to" className="sr-only">Hasta</label>
          <input
            id="audit-to"
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
            <Activity className="h-4 w-4 text-red-600" />
            Registro de acciones
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
                        Quién
                      </th>
                      <th className="pb-3 pr-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Qué hizo
                      </th>
                      <th className="pb-3 pr-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Sobre qué
                      </th>
                      <th className="pb-3 pr-4 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">
                        Cuándo
                      </th>
                      <th className="pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right w-24">
                        Detalles
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((l) => {
                      const ActionIcon = ACTION_ICONS[l.action];
                      const ResourceIcon = getResourceIcon(l.resourceType, l.metadata);
                      const resourceLabel = getResourceShortLabel(l.resourceType, l.metadata);

                      return (
                        <tr
                          key={l.id}
                          className="border-b border-gray-50 hover:bg-red-50/40 transition-colors cursor-pointer group"
                          onClick={() => setSelectedLog(l)}
                        >
                          {/* Actor */}
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2.5">
                              <AvatarBadge name={l.actorName} role={l.actorRole} />
                              <div>
                                <p className="font-medium text-gray-900 text-sm leading-tight">
                                  {l.actorName}
                                </p>
                                <RoleBadge role={l.actorRole} />
                              </div>
                            </div>
                          </td>

                          {/* Action badge */}
                          <td className="py-3 pr-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${ACTION_COLORS[l.action]}`}
                            >
                              <ActionIcon className="h-3 w-3" />
                              {ACTION_LABELS[l.action]}
                            </span>
                          </td>

                          {/* Resource */}
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-gray-100 shrink-0">
                                <ResourceIcon className="h-3.5 w-3.5 text-red-500" />
                              </span>
                              <div>
                                <p className="text-sm text-gray-900 font-medium max-w-[220px] truncate">
                                  {l.resourceName}
                                </p>
                                <p className="text-xs text-gray-500">{resourceLabel}</p>
                              </div>
                            </div>
                          </td>

                          {/* Date */}
                          <td className="py-3 pr-4 text-right">
                            <span className="text-xs text-gray-500 whitespace-nowrap">
                              {fmtDate(l.timestamp)}
                            </span>
                          </td>

                          {/* View details button */}
                          <td className="py-3 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLog(l);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                            >
                              <Eye className="h-3 w-3" />
                              Ver
                            </button>
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
                  const ActionIcon = ACTION_ICONS[l.action];
                  const ResourceIcon = getResourceIcon(l.resourceType, l.metadata);
                  const resourceLabel = getResourceShortLabel(l.resourceType, l.metadata);

                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setSelectedLog(l)}
                      className="w-full text-left rounded-xl border border-gray-100 bg-gray-50/50 hover:border-red-200 hover:shadow-sm transition-all overflow-hidden"
                    >
                      <div className="flex items-start gap-3 p-3">
                        <AvatarBadge name={l.actorName} role={l.actorRole} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-semibold text-sm text-gray-900 truncate">
                              {l.actorName}
                            </span>
                            <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">
                              {fmtDate(l.timestamp)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold ${ACTION_COLORS[l.action]}`}
                            >
                              <ActionIcon className="h-3 w-3" />
                              {ACTION_LABELS[l.action]}
                            </span>
                            <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                              <ResourceIcon className="h-3 w-3 text-red-500" />
                              {resourceLabel}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 truncate">{l.resourceName}</p>
                        </div>
                        <Eye className="h-4 w-4 text-red-400 shrink-0 mt-1" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Pagination */}
          <Pagination
            page={page}
            hasNext={hasNext}
            hasPrev={hasPrev}
            loading={loading}
            onNext={nextPage}
            onPrev={prevPage}
            itemCount={filteredLogs.length}
          />
        </CardContent>
      </Card>

      {/* Details popup */}
      <AuditDetailsModal log={selectedLog} onClose={() => setSelectedLog(null)} />
    </div>
  );
}
