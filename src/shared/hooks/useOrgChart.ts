/**
 * useOrgChart — carga el organigrama completo y calcula el scope del usuario actual.
 *
 * Expone:
 *   - departments: lista completa de departamentos
 *   - positions:   lista completa de puestos
 *   - tree:        bosque (roots[]) listo para render jerárquico
 *   - scope:       alcance del viewer — 'global' | 'scoped' | 'none'
 *   - canEditPosition / canManageDepartment: helpers ligados al viewer
 *   - reload:      re-fetch
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useAuthStore } from '@app/store/authStore';
import { departmentService, positionService } from '@shared/services/dataService';
import type { DBDepartment, DBPosition, DBUser } from '@shared/services/dataService';
import {
  buildOrgTree,
  resolveUserScope,
  canEditPosition as canEditPositionPure,
  canManageDepartment as canManageDepartmentPure,
  type OrgScopeResult,
  type OrgTreeNode,
} from '@shared/utils/orgScope';

export interface UseOrgChartReturn {
  loading: boolean;
  departments: DBDepartment[];
  positions: DBPosition[];
  tree: OrgTreeNode[];
  scope: OrgScopeResult;
  canEditPosition: (positionId: string) => boolean;
  canManageDepartment: (departmentId: string) => boolean;
  reload: () => Promise<void>;
}

export function useOrgChart(): UseOrgChartReturn {
  const { user } = useAuthStore();
  const [departments, setDepartments] = useState<DBDepartment[]>([]);
  const [positions, setPositions] = useState<DBPosition[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [depts, pos] = await Promise.all([
        departmentService.getAll(),
        positionService.getAll(),
      ]);
      setDepartments(depts);
      setPositions(pos);
    } catch (err) {
      console.error('useOrgChart: error loading org data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const tree = useMemo(() => buildOrgTree(positions), [positions]);

  const scope = useMemo<OrgScopeResult>(() => {
    if (!user) return { kind: 'none' };
    return resolveUserScope(user as unknown as DBUser, positions);
  }, [user, positions]);

  const canEditPosition = useCallback(
    (positionId: string) => canEditPositionPure(scope, positionId),
    [scope],
  );

  const canManageDepartment = useCallback(
    (departmentId: string) => canManageDepartmentPure(scope, departmentId, positions),
    [scope, positions],
  );

  return {
    loading,
    departments,
    positions,
    tree,
    scope,
    canEditPosition,
    canManageDepartment,
    reload: load,
  };
}
