import { useEffect, useMemo, useState } from 'react';
import { Building2, Briefcase, Plus, Loader2, Shield, Users } from 'lucide-react';
import { Card, CardContent } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';
import { useOrgChart } from '@shared/hooks/useOrgChart';
import { departmentService, positionService, userService } from '@shared/services/dataService';
import type { DBDepartment, DBPosition, DBUser } from '@shared/services/dataService';
import { useHeaderStore } from '@app/store/headerStore';
import { DepartmentChartDiagram } from '../components/DepartmentChartDiagram';
import { PositionFormModal } from '../components/PositionFormModal';
import { DepartmentFormModal } from '../components/DepartmentFormModal';

type PositionDraft = Omit<DBPosition, 'id' | 'createdAt' | 'updatedAt'>;
type DepartmentDraft = Omit<DBDepartment, 'id' | 'createdAt' | 'updatedAt'>;

export default function OrganizationPage() {
  const {
    loading,
    departments,
    positions,
    scope,
    canEditPosition,
    canManageDepartment,
    reload,
  } = useOrgChart();

  const setOverride = useHeaderStore((s) => s.setOverride);

  // Conteo de usuarios por puesto — se calcula una vez.
  const [users, setUsers] = useState<DBUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    userService.getAll()
      .then(data => { if (!cancelled) setUsers(data); })
      .catch(err => console.error('Error loading users', err))
      .finally(() => { if (!cancelled) setUsersLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const userCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const u of users) {
      if (!u.positionId) continue;
      map.set(u.positionId, (map.get(u.positionId) ?? 0) + 1);
    }
    return map;
  }, [users]);

  // Modal state
  const [positionModal, setPositionModal] = useState<{
    open: boolean;
    position: DBPosition | null;
    defaultParentId?: string | null;
    defaultDepartmentId?: string;
  }>({ open: false, position: null });

  const [departmentModal, setDepartmentModal] = useState<{
    open: boolean;
    department: DBDepartment | null;
    defaultParentId?: string | null;
  }>({ open: false, department: null });

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const handleSavePosition = async (data: PositionDraft, id?: string) => {
    if (id) {
      await positionService.update(id, data);
    } else {
      await positionService.create({
        ...data,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as any);
    }
    await reload();
  };

  const handleDeletePosition = async (id: string) => {
    await positionService.delete(id);
    await reload();
  };

  const handleSaveDepartment = async (data: DepartmentDraft, id?: string) => {
    if (id) {
      await departmentService.update(id, data);
    } else {
      await departmentService.create({
        ...data,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as any);
    }
    await reload();
  };

  const handleDeleteDepartment = async (id: string) => {
    await departmentService.delete(id);
    await reload();
  };

  const visibleDepartments = useMemo(
    () => (scope.kind === 'global'
      ? departments
      : departments.filter(d => canManageDepartment(d.id))),
    [scope.kind, departments, canManageDepartment],
  );

  const totalPositionsInScope = useMemo(
    () => (scope.kind === 'global'
      ? positions.length
      : positions.filter(p => canEditPosition(p.id)).length),
    [scope.kind, positions, canEditPosition],
  );

  // ─── Header (topbar) override ──────────────────────────────────────────────
  useEffect(() => {
    if (scope.kind === 'none') {
      setOverride({ title: 'Organigrama', subtitle: 'Sin alcance asignado' });
      return () => setOverride(null);
    }
    setOverride({
      title: 'Organigrama',
      subtitle: scope.kind === 'global'
        ? 'Tienes alcance total — puedes editar toda la estructura.'
        : `Alcance: ${totalPositionsInScope} puesto${totalPositionsInScope === 1 ? '' : 's'} bajo tu rama.`,
      actions: (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDepartmentModal({ open: true, department: null })}
            disabled={scope.kind !== 'global'}
            title={scope.kind !== 'global' ? 'Solo el admin raíz crea departamentos' : undefined}
          >
            <Building2 className="h-4 w-4 mr-2" />
            Nuevo departamento
          </Button>
          <Button
            size="sm"
            onClick={() => setPositionModal({ open: true, position: null, defaultParentId: null })}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nuevo puesto
          </Button>
        </>
      ),
    });
    return () => setOverride(null);
  }, [scope.kind, totalPositionsInScope, setOverride]);

  // ─── Guards ────────────────────────────────────────────────────────────────
  if (scope.kind === 'none') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Shield className="h-14 w-14 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">Acceso restringido</h3>
          <p className="text-gray-500 text-sm">No tienes alcance sobre el organigrama.</p>
        </div>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Kpi label="Departamentos" value={visibleDepartments.length} icon={Building2} />
        <Kpi label="Puestos en tu alcance" value={totalPositionsInScope} icon={Briefcase} />
        <Kpi label="Personas asignadas" value={Array.from(userCounts.values()).reduce((a, b) => a + b, 0)} icon={Users} />
      </div>

      {/* Diagrama por departamentos — cada uno se expande para mostrar puestos */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-red-600" />
              <p className="text-xs text-gray-500 mt-2">Cargando organigrama...</p>
            </div>
          ) : (
            <DepartmentChartDiagram
              departments={visibleDepartments}
              positions={positions}
              userCounts={userCounts}
              canEditPosition={canEditPosition}
              canManageDepartment={canManageDepartment}
              onEditPosition={pos => setPositionModal({ open: true, position: pos })}
              onAddPosition={(departmentId, parentId) =>
                setPositionModal({
                  open: true,
                  position: null,
                  defaultParentId: parentId,
                  defaultDepartmentId: departmentId,
                })
              }
              onEditDepartment={d => setDepartmentModal({ open: true, department: d })}
              onAddSubDepartment={parentId =>
                setDepartmentModal({ open: true, department: null, defaultParentId: parentId })
              }
              emptyHint={
                departments.length === 0
                  ? 'Primero crea un departamento para empezar.'
                  : undefined
              }
            />
          )}
        </CardContent>
      </Card>

      {(usersLoading) && (
        <p className="text-[11px] text-gray-400">Actualizando conteos de personas...</p>
      )}

      {positionModal.open && (
        <PositionFormModal
          position={positionModal.position}
          positions={positions}
          departments={departments}
          scope={scope}
          defaultParentId={positionModal.defaultParentId}
          defaultDepartmentId={positionModal.defaultDepartmentId}
          onSave={handleSavePosition}
          onDelete={positionModal.position ? handleDeletePosition : undefined}
          onClose={() => setPositionModal({ open: false, position: null })}
        />
      )}

      {departmentModal.open && (
        <DepartmentFormModal
          department={departmentModal.department}
          departments={departments}
          defaultParentId={departmentModal.defaultParentId}
          onSave={handleSaveDepartment}
          onDelete={departmentModal.department ? handleDeleteDepartment : undefined}
          onClose={() => setDepartmentModal({ open: false, department: null })}
        />
      )}
    </div>
  );
}

function Kpi({ label, value, icon: Icon }: { label: string; value: number; icon: React.ElementType }) {
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
