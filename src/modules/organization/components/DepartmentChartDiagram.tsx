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
import './OrgChartDiagram.css';
import './DepartmentChartDiagram.css';

/** #RRGGBB → rgba(r, g, b, alpha). */
function hexToRgba(hex: string | undefined, alpha: number): string {
  if (!hex) return `rgba(148, 163, 184, ${alpha})`;
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return `rgba(148, 163, 184, ${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

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
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const toggle = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const deptTree = useMemo(() => buildDepartmentTree(departments), [departments]);

  // Sub-árbol de puestos por depto: posiciones del depto cuyo padre no está
  // en el mismo depto → raíces locales; el resto se cuelga de su padre.
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
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-10 text-center">
        <Building2 className="mx-auto h-10 w-10 text-gray-300 mb-3" />
        <p className="text-sm text-gray-600">
          {emptyHint ?? 'Aún no hay departamentos. Crea uno para empezar.'}
        </p>
      </div>
    );
  }

  return (
    <PanZoom>
      <div className="dept-chart-root">
        <ul className="dept-chart">
          {deptTree.map(node => (
            <DepartmentNode
              key={node.department.id}
              node={node}
              isRoot
              expanded={expanded}
              onToggle={toggle}
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

interface DeptNodeProps {
  node: DepartmentTreeNode;
  isRoot?: boolean;
  expanded: Set<string>;
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

function DepartmentNode({
  node,
  isRoot,
  expanded,
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
}: DeptNodeProps) {
  const dept = node.department;
  const isOpen = expanded.has(dept.id);
  const hasChildren = node.children.length > 0;
  const editableDept = canManageDepartment(dept.id);
  const accent = dept.color ?? '#94A3B8';
  const tint = hexToRgba(dept.color, 0.18);

  const positionsInDept = positions.filter(p => p.departmentId === dept.id);
  const peopleCount = positionsInDept.reduce(
    (sum, p) => sum + (userCounts.get(p.id) ?? 0),
    0,
  );
  const trees = positionsByDept.get(dept.id) ?? [];

  return (
    <li>
      <div
        className={`dept-node ${isRoot ? 'is-root' : ''}`}
        style={{
          ['--dept-accent' as any]: accent,
          backgroundColor: isOpen ? tint : '#fff',
        }}
      >
        {/* Cabecera — click para expandir */}
        <button
          type="button"
          onClick={() => onToggle(dept.id)}
          className="dept-node-header"
          aria-expanded={isOpen}
        >
          <span
            className="dept-node-icon"
            style={{ backgroundColor: hexToRgba(dept.color, 0.32) }}
          >
            <Building2 className="h-4 w-4" style={{ color: accent }} />
          </span>

          <span className="dept-node-info">
            <span className="dept-node-title" title={dept.name}>{dept.name}</span>
            <span className="dept-node-meta">
              <Briefcase className="h-3 w-3" />
              {positionsInDept.length}
              <span className="dept-node-meta-sep">·</span>
              <Users className="h-3 w-3" />
              {peopleCount}
            </span>
          </span>

          <span className="dept-node-chevron">
            {isOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </span>
        </button>

        {/* Acciones — solo visibles al hover */}
        <div className="dept-node-actions">
          {editableDept && (
            <>
              <button
                type="button"
                className="dept-node-action"
                title="Sub-departamento"
                onClick={e => { e.stopPropagation(); onAddSubDepartment(dept.id); }}
              >
                <Building2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="dept-node-action"
                title="Editar"
                onClick={e => { e.stopPropagation(); onEditDepartment(dept); }}
              >
                <Edit3 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          {!editableDept && (
            <span className="dept-node-lock" title="Fuera de tu alcance">
              <Lock className="h-3.5 w-3.5" />
            </span>
          )}
        </div>

        {/* Cuerpo expandido — puestos del departamento */}
        {isOpen && (
          <div className="dept-node-body">
            {trees.length === 0 ? (
              <div className="dept-node-empty">
                <span>Sin puestos en este departamento.</span>
                {editableDept && (
                  <button
                    type="button"
                    onClick={() => onAddPosition(dept.id, null)}
                    className="dept-node-add"
                  >
                    <Plus className="h-3 w-3" />
                    Agregar
                  </button>
                )}
              </div>
            ) : (
              <>
                <ul className="org-chart">
                  {trees.map(child => (
                    <PositionNode
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
                  <button
                    type="button"
                    onClick={() => onAddPosition(dept.id, null)}
                    className="dept-node-add-row"
                  >
                    <Plus className="h-3 w-3" />
                    Agregar puesto raíz
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {hasChildren && (
        <ul className="dept-chart">
          {node.children.map(child => (
            <DepartmentNode
              key={child.department.id}
              node={child}
              expanded={expanded}
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

interface PositionNodeProps {
  node: OrgTreeNode;
  isRoot?: boolean;
  departmentColor?: string;
  canEditPosition: (id: string) => boolean;
  onEdit: (position: DBPosition) => void;
  onAddChild: (parentId: string) => void;
}

function PositionNode({
  node,
  isRoot,
  departmentColor,
  canEditPosition,
  onEdit,
  onAddChild,
}: PositionNodeProps) {
  const [collapsed, setCollapsed] = useState(false);

  const pos = node.position;
  const hasChildren = node.children.length > 0;
  const editable = canEditPosition(pos.id);
  const bg = hexToRgba(departmentColor, 0.5);

  return (
    <li>
      <div
        className={`org-node ${isRoot ? 'is-root' : ''} ${editable ? '' : 'is-locked'}`}
        style={{ ['--node-bg' as any]: bg }}
        onClick={() => editable && onEdit(pos)}
        role={editable ? 'button' : undefined}
        tabIndex={editable ? 0 : undefined}
        onKeyDown={e => {
          if (!editable) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onEdit(pos);
          }
        }}
      >
        <div className="org-node-title" title={pos.title}>{pos.title}</div>

        {editable ? (
          <div className="org-node-actions">
            <button
              type="button"
              className="org-node-action"
              title="Agregar subordinado"
              onClick={e => { e.stopPropagation(); onAddChild(pos.id); }}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="org-node-action"
              title="Editar"
              onClick={e => { e.stopPropagation(); onEdit(pos); }}
            >
              <Edit3 className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <span className="org-node-lock" title="Fuera de tu alcance">
            <Lock className="h-3.5 w-3.5" />
          </span>
        )}

        {hasChildren && (
          <button
            type="button"
            className="org-node-toggle"
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
        <ul>
          {node.children.map(child => (
            <PositionNode
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
