/**
 * orgScope — utilidades puras para navegar el árbol del organigrama.
 *
 * El scope de cada usuario se deriva de su posición en el árbol:
 *   - Puede ver/editar TODO lo que cuelgue debajo de su puesto (descendientes).
 *   - No puede ver ni tocar ancestros ni hermanos.
 *   - Si no tiene puesto asignado (legacy), su alcance se define por su role
 *     de plataforma (admin = global, el resto = nada).
 *
 * Este módulo es puro — recibe las listas completas y calcula en memoria.
 * Así es testeable y no ensucia la UI con fetches redundantes.
 */

import type { DBDepartment, DBPosition, DBUser, DBSection } from '@shared/services/dataService';

// ─── Tipos auxiliares ────────────────────────────────────────────────────────

export interface OrgTreeNode {
  position: DBPosition;
  children: OrgTreeNode[];
}

export interface DepartmentTreeNode {
  department: DBDepartment;
  children: DepartmentTreeNode[];
}

export type OrgScopeResult =
  | { kind: 'global' }                    // admin raíz o usuario sin puesto con role admin
  | { kind: 'scoped'; positionIds: Set<string> } // descendientes (incluido el propio puesto)
  | { kind: 'none' };                     // sin alcance (usuario sin puesto y sin role admin)

// ─── Construcción del árbol ──────────────────────────────────────────────────

/**
 * Construye el bosque del organigrama a partir de la lista plana de puestos.
 * Devuelve los nodos raíz; cada nodo incluye sus hijos ordenados por `order`.
 */
export function buildOrgTree(positions: DBPosition[]): OrgTreeNode[] {
  const byId = new Map<string, OrgTreeNode>();
  for (const p of positions) {
    byId.set(p.id, { position: p, children: [] });
  }
  const roots: OrgTreeNode[] = [];
  for (const node of byId.values()) {
    const parentId = node.position.parentPositionId;
    if (parentId && byId.has(parentId)) {
      byId.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortChildren = (node: OrgTreeNode) => {
    node.children.sort(
      (a, b) => (a.position.order ?? 0) - (b.position.order ?? 0) ||
                a.position.title.localeCompare(b.position.title)
    );
    node.children.forEach(sortChildren);
  };
  roots.sort((a, b) => (a.position.order ?? 0) - (b.position.order ?? 0) || a.position.title.localeCompare(b.position.title));
  roots.forEach(sortChildren);
  return roots;
}

/**
 * Construye el bosque de departamentos a partir de la lista plana.
 */
export function buildDepartmentTree(departments: DBDepartment[]): DepartmentTreeNode[] {
  const byId = new Map<string, DepartmentTreeNode>();
  for (const d of departments) {
    byId.set(d.id, { department: d, children: [] });
  }
  const roots: DepartmentTreeNode[] = [];
  for (const node of byId.values()) {
    const parentId = node.department.parentDepartmentId;
    if (parentId && byId.has(parentId)) {
      byId.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortFn = (a: DepartmentTreeNode, b: DepartmentTreeNode) =>
    (a.department.order ?? 0) - (b.department.order ?? 0) ||
    a.department.name.localeCompare(b.department.name);
  const sortRec = (node: DepartmentTreeNode) => {
    node.children.sort(sortFn);
    node.children.forEach(sortRec);
  };
  roots.sort(sortFn);
  roots.forEach(sortRec);
  return roots;
}

/** IDs de descendientes transitivos de un departamento (incluido él mismo). */
export function descendantDepartmentIds(
  departments: DBDepartment[],
  departmentId: string,
): Set<string> {
  const byParent = new Map<string | null | undefined, DBDepartment[]>();
  for (const d of departments) {
    const key = d.parentDepartmentId ?? null;
    const list = byParent.get(key) ?? [];
    list.push(d);
    byParent.set(key, list);
  }
  const result = new Set<string>();
  const stack: string[] = [departmentId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (result.has(id)) continue;
    result.add(id);
    for (const k of byParent.get(id) ?? []) stack.push(k.id);
  }
  return result;
}

/** ¿Reparentear `departmentId` bajo `newParentId` crearía un ciclo? */
export function wouldCreateDepartmentCycle(
  departments: DBDepartment[],
  departmentId: string,
  newParentId: string | null,
): boolean {
  if (!newParentId) return false;
  if (newParentId === departmentId) return true;
  const descendants = descendantDepartmentIds(departments, departmentId);
  return descendants.has(newParentId);
}

// ─── Navegación del árbol ────────────────────────────────────────────────────

/**
 * IDs de todos los descendientes transitivos de `positionId`, incluido el propio.
 */
export function descendantsOf(positions: DBPosition[], positionId: string): Set<string> {
  const byParent = new Map<string | null | undefined, DBPosition[]>();
  for (const p of positions) {
    const key = p.parentPositionId ?? null;
    const list = byParent.get(key) ?? [];
    list.push(p);
    byParent.set(key, list);
  }
  const result = new Set<string>();
  const stack: string[] = [positionId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (result.has(id)) continue;
    result.add(id);
    const kids = byParent.get(id) ?? [];
    for (const k of kids) stack.push(k.id);
  }
  return result;
}

/**
 * IDs de todos los ancestros de `positionId` (excluyendo el propio).
 * Útil para romper ciclos cuando se re-parentea un puesto.
 */
export function ancestorsOf(positions: DBPosition[], positionId: string): Set<string> {
  const byId = new Map(positions.map(p => [p.id, p]));
  const result = new Set<string>();
  let current = byId.get(positionId)?.parentPositionId ?? null;
  const guard = new Set<string>([positionId]);
  while (current && !guard.has(current)) {
    result.add(current);
    guard.add(current);
    current = byId.get(current)?.parentPositionId ?? null;
  }
  return result;
}

/**
 * Detecta si reparentear `positionId` bajo `newParentId` crearía un ciclo
 * (el nuevo padre no puede ser descendiente del propio puesto).
 */
export function wouldCreateCycle(
  positions: DBPosition[],
  positionId: string,
  newParentId: string | null,
): boolean {
  if (!newParentId) return false;
  if (newParentId === positionId) return true;
  const descendants = descendantsOf(positions, positionId);
  return descendants.has(newParentId);
}

// ─── Scope del usuario ───────────────────────────────────────────────────────

/**
 * Calcula el alcance del usuario dentro del organigrama.
 *
 * Reglas:
 *   - role === 'admin' sin puesto asignado → 'global' (admin raíz histórico).
 *   - Con puesto asignado → 'scoped' con los descendientes (incluido su puesto).
 *   - Sin puesto y sin role admin → 'none'.
 *
 * Nota: un usuario con puesto pierde el acceso global aunque su role sea admin,
 * salvo que su puesto sea una raíz del árbol Y su platformRole sea admin —
 * en ese caso también devolvemos 'global' para preservar el admin supremo.
 */
export function resolveUserScope(user: DBUser, positions: DBPosition[]): OrgScopeResult {
  if (!user.positionId) {
    if (user.role === 'admin') return { kind: 'global' };
    return { kind: 'none' };
  }
  const ownPosition = positions.find(p => p.id === user.positionId);
  if (!ownPosition) {
    // El puesto fue borrado pero el user quedó huérfano — fallback al role.
    if (user.role === 'admin') return { kind: 'global' };
    return { kind: 'none' };
  }
  // Admin raíz = puesto sin parent con platformRole admin.
  const isRootAdmin = !ownPosition.parentPositionId && ownPosition.platformRole === 'admin';
  if (isRootAdmin) return { kind: 'global' };
  return { kind: 'scoped', positionIds: descendantsOf(positions, ownPosition.id) };
}

/** ¿El viewer puede ver a target? */
export function canViewUser(scope: OrgScopeResult, target: DBUser): boolean {
  if (scope.kind === 'global') return true;
  if (scope.kind === 'none') return false;
  if (!target.positionId) return false;
  return scope.positionIds.has(target.positionId);
}

/** ¿El viewer puede editar/mover este puesto? Solo puestos bajo su scope. */
export function canEditPosition(scope: OrgScopeResult, positionId: string): boolean {
  if (scope.kind === 'global') return true;
  if (scope.kind === 'none') return false;
  // El propio puesto del viewer NO es editable por sí mismo para evitar
  // auto-promociones. Solo sus descendientes estrictos.
  return scope.positionIds.has(positionId);
}

/** ¿El viewer puede administrar un departamento?
 *  True si alguno de los puestos del depto está en su scope. */
export function canManageDepartment(
  scope: OrgScopeResult,
  departmentId: string,
  positions: DBPosition[],
): boolean {
  if (scope.kind === 'global') return true;
  if (scope.kind === 'none') return false;
  return positions.some(p => p.departmentId === departmentId && scope.positionIds.has(p.id));
}

/** ¿El viewer puede administrar esta sección según su audiencia? */
export function canManageSection(
  scope: OrgScopeResult,
  section: DBSection,
  positions: DBPosition[],
): boolean {
  if (scope.kind === 'global') return true;
  if (scope.kind === 'none') return false;
  const audience = section.audience;
  if (!audience) return false; // Secciones manuales legacy → solo admin global.
  const matchByPosition = (audience.positionIds ?? []).some(id => scope.positionIds.has(id));
  if (matchByPosition) return true;
  // Matching por departamento — alcanza si TODOS los puestos de ese depto
  // están dentro del scope del viewer. Si solo una parte lo está, el admin
  // de ese sub-área no debería poder editar una sección que también afecta a
  // puestos fuera de su scope.
  for (const deptId of audience.departmentIds ?? []) {
    const deptPositions = positions.filter(p => p.departmentId === deptId);
    if (deptPositions.length === 0) continue;
    const allInScope = deptPositions.every(p => scope.positionIds.has(p.id));
    if (allInScope) return true;
  }
  return false;
}

/**
 * Qué puestos puede elegir el viewer como PADRE al crear/mover un puesto.
 * Son los puestos dentro de su scope (o todos, si es global).
 * También excluye descendientes del propio puesto cuando se mueve
 * (eso lo hace wouldCreateCycle en el sitio de uso).
 */
export function selectableParentPositions(
  scope: OrgScopeResult,
  positions: DBPosition[],
): DBPosition[] {
  if (scope.kind === 'global') return positions;
  if (scope.kind === 'none') return [];
  return positions.filter(p => scope.positionIds.has(p.id));
}
