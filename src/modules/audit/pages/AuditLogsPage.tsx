import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  History,
  Download,
  Search,
  Plus,
  Pencil,
  Trash2,
  BookOpen,
  Layers,
  FileText,
  Users,
  GraduationCap,
  ClipboardList,
  Shield,
  X,
  TrendingUp,
  Activity,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';
import { userService } from '@shared/services/dataService';
import {
  listAuditLogs,
  type DBAuditLog,
  type AuditAction,
  type AuditResourceType,
} from '@shared/services/auditLogService';
import type { DBUser } from '@shared/services/dataService';
import { exportToCSV } from '@shared/services/exportService';

// ─── Labels ──────────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<AuditAction, string> = {
  create: 'Creó',
  update: 'Editó',
  delete: 'Eliminó',
};

const RESOURCE_LABELS: Record<AuditResourceType, string> = {
  course: 'Curso',
  module: 'Módulo',
  lesson: 'Lección',
  section: 'Sección',
  user: 'Usuario',
  evaluation: 'Evaluación',
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

const RESOURCE_ICONS: Record<AuditResourceType, React.ElementType> = {
  course: BookOpen,
  module: Layers,
  lesson: FileText,
  section: GraduationCap,
  user: Users,
  evaluation: ClipboardList,
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

// ─── Diff row ─────────────────────────────────────────────────────────────────

function DiffPanel({ changes }: { changes: Record<string, { from: unknown; to: unknown }> }) {
  return (
    <div className="mt-1 rounded-lg border border-red-100 bg-red-50/60 overflow-hidden">
      <div className="px-4 py-2 border-b border-red-100 flex items-center gap-1.5">
        <AlertTriangle className="h-3 w-3 text-red-500" />
        <span className="text-xs font-semibold text-red-700 uppercase tracking-wide">
          Cambios de campo
        </span>
      </div>
      <div className="px-4 py-3 space-y-2">
        {Object.entries(changes).map(([field, { from, to }]) => (
          <div key={field} className="grid grid-cols-[auto_1fr_auto_1fr] items-start gap-x-3 gap-y-0.5 text-xs">
            <span className="font-semibold text-gray-600 min-w-[80px] pt-0.5 capitalize">
              {field}
            </span>
            {/* from — struck-through in neutral gray for legibility on red-50 background */}
            <span className="text-gray-400 line-through max-w-xs truncate pt-0.5" title={formatValue(from)}>
              {formatValue(from)}
            </span>
            <span className="text-gray-400 pt-0.5">→</span>
            {/* to — solid, darker red (no green) */}
            <span className="text-red-800 font-medium max-w-xs truncate pt-0.5" title={formatValue(to)}>
              {formatValue(to)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<DBAuditLog[]>([]);
  const [users, setUsers] = useState<DBUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Filters
  const [actorFilter, setActorFilter] = useState<string>('');
  const [resourceFilter, setResourceFilter] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [logsData, usersData] = await Promise.all([
          listAuditLogs(),
          userService.getAll(),
        ]);
        setLogs(logsData);
        setUsers(usersData);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredLogs = useMemo(() => {
    const fromTs = fromDate ? new Date(fromDate).getTime() : null;
    const toTs = toDate ? new Date(toDate).getTime() + 24 * 60 * 60 * 1000 : null;
    const needle = searchTerm.trim().toLowerCase();

    return logs.filter((l) => {
      if (actorFilter && l.actorId !== actorFilter) return false;
      if (resourceFilter && l.resourceType !== resourceFilter) return false;
      if (actionFilter && l.action !== actionFilter) return false;
      if (fromTs && l.timestamp < fromTs) return false;
      if (toTs && l.timestamp > toTs) return false;
      if (needle) {
        const hay = `${l.actorName} ${l.resourceName} ${l.resourceType}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [logs, actorFilter, resourceFilter, actionFilter, fromDate, toDate, searchTerm]);

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── KPI derivations ────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);

    // Outcome: contenido nuevo publicado (creates de course/module/lesson/section) esta semana
    const contenidoPublicado = logs.filter(
      (l) =>
        l.timestamp >= weekStart.getTime() &&
        l.action === 'create' &&
        (l.resourceType === 'course' ||
          l.resourceType === 'module' ||
          l.resourceType === 'lesson' ||
          l.resourceType === 'section')
    ).length;

    // Outcome: eliminaciones irreversibles (histórico) — señal crítica
    const eliminacionesIrreversibles = logs.filter((l) => l.action === 'delete').length;

    // Outcome: profesores que han realizado cambios (no solo registrados)
    const profesoresActivos = new Set(
      logs.filter((l) => l.actorRole === 'teacher').map((l) => l.actorId)
    ).size;

    // Outcome: actores distintos con actividad
    const actoresActivos = new Set(logs.map((l) => l.actorId)).size;

    return {
      contenidoPublicado,
      eliminacionesIrreversibles,
      profesoresActivos,
      actoresActivos,
    };
  }, [logs]);

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

      {/* Filter card */}
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-4">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-gray-900">
            <History className="h-4 w-4 text-red-600" />
            Filtros
            {hasActiveFilters && (
              <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-600 text-white text-xs font-bold">
                !
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-3">
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-800 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
                Limpiar todo
              </button>
            )}
            <Button
              onClick={handleExport}
              variant="outline"
              size="sm"
              disabled={filteredLogs.length === 0}
              className="text-xs"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Exportar CSV
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {/* Search row */}
          <div className="mb-3 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar recurso o actor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors"
            />
          </div>

          {/* Select row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Actor
              </label>
              <select
                value={actorFilter}
                onChange={(e) => setActorFilter(e.target.value)}
                className={`px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors ${
                  actorFilter
                    ? 'border-red-400 bg-red-50 text-red-800 font-medium'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <option value="">Todos los actores</option>
                {users
                  .filter((u) => u.role === 'admin' || u.role === 'teacher')
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Tipo de recurso
              </label>
              <select
                value={resourceFilter}
                onChange={(e) => setResourceFilter(e.target.value)}
                className={`px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors ${
                  resourceFilter
                    ? 'border-red-400 bg-red-50 text-red-800 font-medium'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <option value="">Todos los tipos</option>
                {Object.entries(RESOURCE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Acción
              </label>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className={`px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors ${
                  actionFilter
                    ? 'border-red-400 bg-red-50 text-red-800 font-medium'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <option value="">Todas las acciones</option>
                {Object.entries(ACTION_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Rango de fechas
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-gray-400 uppercase px-0.5">De</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className={`flex-1 min-w-0 px-2 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors ${
                    fromDate
                      ? 'border-red-400 bg-red-50 text-red-800'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                />
                <span className="text-[11px] font-medium text-gray-400 uppercase px-0.5">a</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className={`flex-1 min-w-0 px-2 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors ${
                    toDate
                      ? 'border-red-400 bg-red-50 text-red-800'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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
                      {/* expand toggle col */}
                      <th className="pb-3 pr-2 w-6" />
                      <th className="pb-3 pr-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Actor
                      </th>
                      <th className="pb-3 pr-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Acción
                      </th>
                      <th className="pb-3 pr-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Recurso
                      </th>
                      <th className="pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">
                        Fecha
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((l) => {
                      const isOpen = expanded.has(l.id);
                      const hasChanges = l.changes && Object.keys(l.changes).length > 0;
                      const ActionIcon = ACTION_ICONS[l.action];
                      const ResourceIcon = RESOURCE_ICONS[l.resourceType];

                      return (
                        <Fragment key={l.id}>
                          <tr
                            className={`border-b border-gray-50 transition-colors group ${
                              hasChanges ? 'cursor-pointer hover:bg-red-50/40' : ''
                            }`}
                            onClick={() => hasChanges && toggleExpanded(l.id)}
                          >
                            {/* Expand chevron — fixed-width slot avoids row jitter when some rows lack changes */}
                            <td className="py-3 pr-2 w-6">
                              <span className="inline-flex items-center justify-center w-4 h-4">
                                {hasChanges ? (
                                  isOpen ? (
                                    <ChevronDown className="h-4 w-4 text-red-400" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-red-400 transition-colors" />
                                  )
                                ) : (
                                  <span className="w-1 h-1 rounded-full bg-gray-200" aria-hidden="true" />
                                )}
                              </span>
                            </td>

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
                                  <p className="text-xs text-gray-500">
                                    {RESOURCE_LABELS[l.resourceType]}
                                  </p>
                                </div>
                              </div>
                            </td>

                            {/* Date */}
                            <td className="py-3 text-right">
                              <span className="text-xs text-gray-500 whitespace-nowrap">
                                {fmtDate(l.timestamp)}
                              </span>
                            </td>
                          </tr>

                          {/* Expanded diff */}
                          {isOpen && hasChanges && (
                            <tr className="border-b border-gray-50 bg-transparent">
                              <td />
                              <td colSpan={4} className="pb-4 pr-4">
                                <DiffPanel changes={l.changes!} />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile card list */}
              <div className="md:hidden space-y-2">
                {filteredLogs.map((l) => {
                  const isOpen = expanded.has(l.id);
                  const hasChanges = l.changes && Object.keys(l.changes).length > 0;
                  const ActionIcon = ACTION_ICONS[l.action];
                  const ResourceIcon = RESOURCE_ICONS[l.resourceType];

                  return (
                    <div
                      key={l.id}
                      className={`rounded-xl border border-gray-100 bg-gray-50/50 overflow-hidden ${
                        hasChanges ? 'cursor-pointer' : ''
                      }`}
                      onClick={() => hasChanges && toggleExpanded(l.id)}
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
                              {RESOURCE_LABELS[l.resourceType]}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 truncate">{l.resourceName}</p>
                        </div>
                        {hasChanges && (
                          <div className="shrink-0 mt-1">
                            {isOpen ? (
                              <ChevronDown className="h-4 w-4 text-red-400" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-gray-400" />
                            )}
                          </div>
                        )}
                      </div>

                      {isOpen && hasChanges && (
                        <div className="px-3 pb-3">
                          <DiffPanel changes={l.changes!} />
                        </div>
                      )}
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
