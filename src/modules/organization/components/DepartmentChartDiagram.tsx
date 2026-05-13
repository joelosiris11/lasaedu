import { useMemo, useState } from 'react';
import {
  Plus,
  Edit3,
  Lock,
  Building2,
  Briefcase,
  Users,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { DBDepartment, DBPosition } from '@shared/services/dataService';
import {
  buildDepartmentTree,
  type DepartmentTreeNode,
  type OrgTreeNode,
} from '@shared/utils/orgScope';
import { PanZoom } from './PanZoom';
import './ConceptOrgChart.css';

/**
 * Mapa conceptual del organigrama.
 *
 * Vista por defecto: solo se ven los DEPARTAMENTOS, jerarquizados a partir
 * del depto raíz (típicamente "Administración"). Al hacer click en un depto,
 * éste se expande inline mostrando un mini-mapa conceptual de sus puestos.
 *
 * Las "niveles" de la jerarquía se infieren visualmente por el espaciado
 * vertical uniforme entre filas — sin etiquetas explícitas de nivel.
 */

interface Props {
  departments: DBDepartment[];
  positions: DBPosition[];
  userCounts: Map<string, number>;
  canEditPosition: (id: string) => boolean;
  canManageDepartment: (id: string) => boolean;
  onEditPosition: (position: DBPosition) => void;
  onAddPosition: (departmentId: string, parentId: string | null) => void;
  onEditDepartment: (department: DBDepartment) => void;
  onAddSubDepartment: (parentId: string) => void;
  emptyHint?: string;
}

export function DepartmentChartDiagram({
  departments,
  positions,
  userCounts,
  canEditPosition,
  canManageDepartment,
  onEditPosition,
  onAddPosition,
  onEditDepartment,
  onAddSubDepartment,
  emptyHint,
}: Props) {
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(() => new Set());

  const toggleDept = (id: string) =>
    setExpandedDepts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const deptTree = useMemo(() => buildDepartmentTree(departments), [departments]);

  // Sub-árbol de puestos por depto: roots = puestos cuyo padre no está en el
  // mismo depto.
  const positionsByDept = useMemo(() => {
    const result = new Map<string, OrgTreeNode[]>();
    for (const dept of departments) {
      const inDept = positions.filter(p => p.departmentId === dept.id);
      const idsInDept = new Set(inDept.map(p => p.id));
      const byId = new Map<string, OrgTreeNode>(
        inDept.map(p => [p.id, { position: p, children: [] }]),
      );
      const roots: OrgTreeNode[] = [];
      for (const node of byId.values()) {
        const parentId = node.position.parentPositionId;
        if (parentId && idsInDept.has(parentId)) {
          byId.get(parentId)!.children.push(node);
        } else {
          roots.push(node);
        }
      }
      const sortFn = (a: OrgTreeNode, b: OrgTreeNode) =>
        (a.position.order ?? 0) - (b.position.order ?? 0) ||
        a.position.title.localeCompare(b.position.title);
      const sortRec = (node: OrgTreeNode) => {
        node.children.sort(sortFn);
        node.children.forEach(sortRec);
      };
      roots.sort(sortFn);
      roots.forEach(sortRec);
      result.set(dept.id, roots);
    }
    return result;
  }, [departments, positions]);

  if (departments.length === 0) {
    return (
      <div className="concept-empty">
        <Building2 className="mx-auto h-10 w-10 text-gray-300 mb-3" />
        <p className="text-sm">
          {emptyHint ?? 'Aún no hay departamentos. Crea uno para empezar.'}
        </p>
      </div>
    );
  }

  return (
    <PanZoom>
      <div className="concept-canvas">
        <ul className="concept-row">
          {deptTree.map(node => (
            <DepartmentSlot
              key={node.department.id}
              node={node}
              isRoot
              expandedDepts={expandedDepts}
              onToggle={toggleDept}
              positions={positions}
              userCounts={userCounts}
              positionsByDept={positionsByDept}
              canEditPosition={canEditPosition}
              canManageDepartment={canManageDepartment}
              onEditPosition={onEditPosition}
              onAddPosition={onAddPosition}
              onEditDepartment={onEditDepartment}
              onAddSubDepartment={onAddSubDepartment}
            />
          ))}
        </ul>
      </div>
    </PanZoom>
  );
}

// ─── Departamento ────────────────────────────────────────────────────────────

interface DeptSlotProps {
  node: DepartmentTreeNode;
  isRoot?: boolean;
  expandedDepts: Set<string>;
  onToggle: (id: string) => void;
  positions: DBPosition[];
  userCounts: Map<string, number>;
  positionsByDept: Map<string, OrgTreeNode[]>;
  canEditPosition: (id: string) => boolean;
  canManageDepartment: (id: string) => boolean;
  onEditPosition: (position: DBPosition) => void;
  onAddPosition: (departmentId: string, parentId: string | null) => void;
  onEditDepartment: (department: DBDepartment) => void;
  onAddSubDepartment: (parentId: string) => void;
}

function DepartmentSlot({
  node,
  isRoot,
  expandedDepts,
  onToggle,
  positions,
  userCounts,
  positionsByDept,
  canEditPosition,
  canManageDepartment,
  onEditPosition,
  onAddPosition,
  onEditDepartment,
  onAddSubDepartment,
}: DeptSlotProps) {
  const dept = node.department;
  const isOpen = expandedDepts.has(dept.id);
  const editableDept = canManageDepartment(dept.id);
  const accent = dept.color ?? '#94A3B8';

  const positionsInDept = positions.filter(p => p.departmentId === dept.id);
  const peopleCount = positionsInDept.reduce(
    (sum, p) => sum + (userCounts.get(p.id) ?? 0),
    0,
  );
  const trees = positionsByDept.get(dept.id) ?? [];

  return (
    <li className="concept-slot">
      <div
        className={`concept-card ${isRoot ? 'is-root' : ''} ${isOpen ? 'is-open' : ''}`}
        style={{ ['--accent' as any]: accent }}
      >
        <button
          type="button"
          className="concept-card-header"
          onClick={() => onToggle(dept.id)}
          aria-expanded={isOpen}
        >
          <span className="concept-card-icon">
            <Building2 className="h-4 w-4" />
          </span>

          <span className="concept-card-info">
            <span className="concept-card-title" title={dept.name}>
              {dept.name}
            </span>
            <span className="concept-card-meta">
              <Briefcase className="h-3 w-3" />
              {positionsInDept.length}
              <span className="concept-card-meta-sep">·</span>
              <Users className="h-3 w-3" />
              {peopleCount}
            </span>
          </span>

          <span className="concept-card-chevron">
            {isOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </span>
        </button>

        <div className="concept-card-actions">
          {editableDept ? (
            <>
              <button
                type="button"
                className="concept-card-action"
                title="Sub-departamento"
                onClick={e => { e.stopPropagation(); onAddSubDepartment(dept.id); }}
              >
                <Building2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="concept-card-action"
                title="Editar"
                onClick={e => { e.stopPropagation(); onEditDepartment(dept); }}
              >
                <Edit3 className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <span className="concept-card-lock" title="Fuera de tu alcance">
              <Lock className="h-3.5 w-3.5" />
            </span>
          )}
        </div>

        {isOpen && (
          <div className="concept-card-body">
            {trees.length === 0 ? (
              <div className="concept-card-empty">
                <span>Sin puestos en este departamento.</span>
                {editableDept && (
                  <button
                    type="button"
                    className="concept-card-add"
                    onClick={() => onAddPosition(dept.id, null)}
                  >
                    <Plus className="h-3 w-3" />
                    Agregar puesto
                  </button>
                )}
              </div>
            ) : (
              <>
                <ul className="concept-row">
                  {trees.map(child => (
                    <PositionSlot
                      key={child.position.id}
                      node={child}
                      isRoot
                      departmentColor={dept.color}
                      canEditPosition={canEditPosition}
                      onEdit={onEditPosition}
                      onAddChild={parentId => onAddPosition(dept.id, parentId)}
                    />
                  ))}
                </ul>
                {editableDept && (
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <button
                      type="button"
                      className="concept-card-add-row"
                      onClick={() => onAddPosition(dept.id, null)}
                    >
                      <Plus className="h-3 w-3" />
                      Puesto raíz
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {node.children.length > 0 && (
        <ul className="concept-row">
          {node.children.map(child => (
            <DepartmentSlot
              key={child.department.id}
              node={child}
              expandedDepts={expandedDepts}
              onToggle={onToggle}
              positions={positions}
              userCounts={userCounts}
              positionsByDept={positionsByDept}
              canEditPosition={canEditPosition}
              canManageDepartment={canManageDepartment}
              onEditPosition={onEditPosition}
              onAddPosition={onAddPosition}
              onEditDepartment={onEditDepartment}
              onAddSubDepartment={onAddSubDepartment}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// ─── Puesto ──────────────────────────────────────────────────────────────────

interface PositionSlotProps {
  node: OrgTreeNode;
  isRoot?: boolean;
  departmentColor?: string;
  canEditPosition: (id: string) => boolean;
  onEdit: (position: DBPosition) => void;
  onAddChild: (parentId: string) => void;
}

function PositionSlot({
  node,
  isRoot,
  departmentColor,
  canEditPosition,
  onEdit,
  onAddChild,
}: PositionSlotProps) {
  const [collapsed, setCollapsed] = useState(false);

  const pos = node.position;
  const hasChildren = node.children.length > 0;
  const editable = canEditPosition(pos.id);
  const accent = departmentColor ?? '#94A3B8';

  return (
    <li className="concept-slot">
      <div
        className={`concept-card ${isRoot ? 'is-root' : ''} ${editable ? '' : 'is-locked'}`}
        style={{ ['--accent' as any]: accent }}
      >
        <button
          type="button"
          className="concept-card-header"
          onClick={() => editable && onEdit(pos)}
          disabled={!editable}
          style={editable ? undefined : { cursor: 'default' }}
        >
          <span className="concept-card-icon">
            <Briefcase className="h-3.5 w-3.5" />
          </span>
          <span className="concept-card-info">
            <span className="concept-card-title" title={pos.title}>
              {pos.title}
            </span>
          </span>
          <span className="concept-card-chevron" />
        </button>

        {editable ? (
          <div className="concept-card-actions">
            <button
              type="button"
              className="concept-card-action"
              title="Agregar subordinado"
              onClick={e => { e.stopPropagation(); onAddChild(pos.id); }}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="concept-card-action"
              title="Editar"
              onClick={e => { e.stopPropagation(); onEdit(pos); }}
            >
              <Edit3 className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <span className="concept-card-lock" title="Fuera de tu alcance">
            <Lock className="h-3.5 w-3.5" />
          </span>
        )}

        {hasChildren && (
          <button
            type="button"
            className="concept-card-toggle"
            title={collapsed ? 'Expandir' : 'Contraer'}
            onClick={e => { e.stopPropagation(); setCollapsed(v => !v); }}
          >
            {collapsed ? (
              <ChevronRight className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>
        )}
      </div>

      {hasChildren && !collapsed && (
        <ul className="concept-row">
          {node.children.map(child => (
            <PositionSlot
              key={child.position.id}
              node={child}
              departmentColor={departmentColor}
              canEditPosition={canEditPosition}
              onEdit={onEdit}
              onAddChild={onAddChild}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default DepartmentChartDiagram;
