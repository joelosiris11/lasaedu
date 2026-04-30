import { useState } from 'react';
import {
  Plus,
  Edit3,
  Lock,
  Briefcase,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import type { DBDepartment, DBPosition } from '@shared/services/dataService';
import type { OrgTreeNode } from '@shared/utils/orgScope';
import { PanZoom } from './PanZoom';
import './OrgChartDiagram.css';

/** #RRGGBB → rgba(r, g, b, alpha). Fallback a slate-400 al 50%. */
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
  tree: OrgTreeNode[];
  departments: DBDepartment[];
  /** Se reciben por compatibilidad — no se muestran en la caja en esta versión minimal. */
  userCounts: Map<string, number>;
  canEditPosition: (id: string) => boolean;
  onEdit: (position: DBPosition) => void;
  onAddChild: (parentId: string) => void;
  onAddRoot: () => void;
  emptyHint?: string;
}

export function OrgChartDiagram({
  tree,
  departments,
  canEditPosition,
  onEdit,
  onAddChild,
  onAddRoot,
  emptyHint,
}: Props) {
  const deptById = new Map(departments.map(d => [d.id, d]));

  if (tree.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-10 text-center">
        <Briefcase className="mx-auto h-10 w-10 text-gray-300 mb-3" />
        <p className="text-sm text-gray-600 mb-4">
          {emptyHint ?? 'Aún no hay puestos en el organigrama.'}
        </p>
        <button
          onClick={onAddRoot}
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium"
        >
          <Plus className="h-4 w-4" />
          Crear el primer puesto
        </button>
      </div>
    );
  }

  return (
    <PanZoom>
      <div className="org-chart-root">
        <ul className="org-chart">
          {tree.map(node => (
            <OrgChartNode
              key={node.position.id}
              node={node}
              isRoot
              deptById={deptById}
              canEditPosition={canEditPosition}
              onEdit={onEdit}
              onAddChild={onAddChild}
            />
          ))}
        </ul>
      </div>
    </PanZoom>
  );
}

interface NodeProps {
  node: OrgTreeNode;
  isRoot?: boolean;
  deptById: Map<string, DBDepartment>;
  canEditPosition: (id: string) => boolean;
  onEdit: (position: DBPosition) => void;
  onAddChild: (parentId: string) => void;
}

function OrgChartNode({
  node,
  isRoot,
  deptById,
  canEditPosition,
  onEdit,
  onAddChild,
}: NodeProps) {
  const [expanded, setExpanded] = useState(true);

  const pos = node.position;
  const dept = deptById.get(pos.departmentId);
  const hasChildren = node.children.length > 0;
  const editable = canEditPosition(pos.id);
  const bg = hexToRgba(dept?.color, 0.5);

  const handleClick = () => {
    if (editable) onEdit(pos);
  };

  return (
    <li>
      <div
        className={`org-node ${isRoot ? 'is-root' : ''} ${editable ? '' : 'is-locked'}`}
        style={{ ['--node-bg' as any]: bg }}
        onClick={handleClick}
        role={editable ? 'button' : undefined}
        tabIndex={editable ? 0 : undefined}
        onKeyDown={e => {
          if (!editable) return;
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit(pos); }
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
            title={expanded ? 'Contraer' : 'Expandir'}
            onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        )}
      </div>

      {hasChildren && expanded && (
        <ul>
          {node.children.map(child => (
            <OrgChartNode
              key={child.position.id}
              node={child}
              deptById={deptById}
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

export default OrgChartDiagram;
