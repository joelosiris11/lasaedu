import { useMemo, useState } from 'react';
import { Loader2, Briefcase } from 'lucide-react';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { Label } from '@shared/components/ui/Label';
import { Modal } from '@shared/components/ui/Modal';
import type { DBDepartment, DBPosition } from '@shared/services/dataService';
import {
  wouldCreateCycle,
  selectableParentPositions,
  type OrgScopeResult,
} from '@shared/utils/orgScope';

type PlatformRole = DBPosition['platformRole'];
type OnLeavePolicy = DBPosition['onLeavePolicy'];

const ROLE_OPTIONS: { value: PlatformRole; label: string; hint: string }[] = [
  { value: 'student',    label: 'Estudiante',    hint: 'Solo consume cursos asignados' },
  { value: 'teacher',    label: 'Profesor',      hint: 'Dicta cursos y corrige' },
  { value: 'supervisor', label: 'Supervisor',    hint: 'Observa a sus subordinados' },
  { value: 'support',    label: 'Soporte',       hint: 'Tickets y atención a usuarios' },
  { value: 'admin',      label: 'Administrador', hint: 'Administra su rama del árbol' },
];

interface Props {
  position: DBPosition | null;       // null = crear
  positions: DBPosition[];           // todos, para calcular padres válidos
  departments: DBDepartment[];
  scope: OrgScopeResult;
  /** Puesto sugerido como padre inicial al crear. */
  defaultParentId?: string | null;
  /** Departamento sugerido al crear (cuando se crea desde la card de un depto). */
  defaultDepartmentId?: string;
  onSave: (data: Omit<DBPosition, 'id' | 'createdAt' | 'updatedAt'>, id?: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onClose: () => void;
}

export function PositionFormModal({
  position,
  positions,
  departments,
  scope,
  defaultParentId,
  defaultDepartmentId,
  onSave,
  onDelete,
  onClose,
}: Props) {
  const isEdit = !!position;

  const [title, setTitle] = useState(position?.title ?? '');
  const [description, setDescription] = useState(position?.description ?? '');
  const [departmentId, setDepartmentId] = useState(
    position?.departmentId ?? defaultDepartmentId ?? departments[0]?.id ?? ''
  );
  const [parentPositionId, setParentPositionId] = useState<string | null>(
    position?.parentPositionId ?? defaultParentId ?? null
  );
  const [platformRole, setPlatformRole] = useState<PlatformRole>(position?.platformRole ?? 'student');
  const [onLeavePolicy, setOnLeavePolicy] = useState<OnLeavePolicy>(position?.onLeavePolicy ?? 'keep');

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  // Padres válidos: los del scope del viewer, menos los que generarían ciclo.
  const parentOptions = useMemo(() => {
    const inScope = selectableParentPositions(scope, positions);
    if (!isEdit || !position) return inScope;
    return inScope.filter(p => p.id !== position.id && !wouldCreateCycle(positions, position.id, p.id));
  }, [scope, positions, position, isEdit]);

  const canDelete = isEdit && !!onDelete;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) { setError('El título es requerido'); return; }
    if (!departmentId) { setError('Selecciona un departamento'); return; }

    if (isEdit && position && parentPositionId && wouldCreateCycle(positions, position.id, parentPositionId)) {
      setError('Ese puesto no puede ser padre (crearía un ciclo)');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || undefined,
        departmentId,
        parentPositionId: parentPositionId,
        platformRole,
        onLeavePolicy,
        order: position?.order,
      }, position?.id);
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!position || !onDelete) return;
    if (!confirm(`¿Eliminar el puesto "${position.title}"?`)) return;
    setError('');
    setDeleting(true);
    try {
      await onDelete(position.id);
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'Error al eliminar');
      setDeleting(false);
    }
  };

  return (
    <Modal
      open
      onClose={saving || deleting ? () => {} : onClose}
      title={
        <div className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-red-600" />
          <span>{isEdit ? 'Editar puesto' : 'Nuevo puesto'}</span>
        </div>
      }
      size="lg"
      disableBackdropClose={saving || deleting}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div>
          <Label htmlFor="pos-title">Nombre del puesto</Label>
          <Input
            id="pos-title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Ej. Inspector de Calidad"
            required
          />
        </div>

        <div>
          <Label htmlFor="pos-desc">Descripción</Label>
          <Input
            id="pos-desc"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Opcional — qué hace este puesto"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="pos-dept">Departamento</Label>
            <select
              id="pos-dept"
              value={departmentId}
              onChange={e => setDepartmentId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
              required
            >
              {departments.length === 0 && <option value="">Crea un departamento primero</option>}
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="pos-parent">Reporta a</Label>
            <select
              id="pos-parent"
              value={parentPositionId ?? ''}
              onChange={e => setParentPositionId(e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
            >
              <option value="">— Raíz (sin superior) —</option>
              {parentOptions.map(p => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-gray-500">
              Solo puedes elegir puestos dentro de tu alcance.
            </p>
          </div>
        </div>

        <div>
          <Label>Rol de plataforma</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
            {ROLE_OPTIONS.map(opt => (
              <label
                key={opt.value}
                className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  platformRole === opt.value
                    ? 'border-red-400 bg-red-50/50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="platformRole"
                  value={opt.value}
                  checked={platformRole === opt.value}
                  onChange={() => setPlatformRole(opt.value)}
                  className="mt-0.5 text-red-600 focus:ring-red-500"
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900">{opt.label}</div>
                  <div className="text-[11px] text-gray-500">{opt.hint}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div>
          <Label>Al dejar este puesto</Label>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <label
              className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer ${
                onLeavePolicy === 'keep' ? 'border-red-400 bg-red-50/50' : 'border-gray-200'
              }`}
            >
              <input
                type="radio"
                name="onLeave"
                checked={onLeavePolicy === 'keep'}
                onChange={() => setOnLeavePolicy('keep')}
                className="mt-0.5 text-red-600"
              />
              <div>
                <div className="text-sm font-medium">Conservar progreso</div>
                <div className="text-[11px] text-gray-500">Sigue con sus inscripciones actuales</div>
              </div>
            </label>
            <label
              className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer ${
                onLeavePolicy === 'discard' ? 'border-red-400 bg-red-50/50' : 'border-gray-200'
              }`}
            >
              <input
                type="radio"
                name="onLeave"
                checked={onLeavePolicy === 'discard'}
                onChange={() => setOnLeavePolicy('discard')}
                className="mt-0.5 text-red-600"
              />
              <div>
                <div className="text-sm font-medium">Descartar auto-inscripciones</div>
                <div className="text-[11px] text-gray-500">Se retira de cursos asignados por este puesto</div>
              </div>
            </label>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" className="flex-1" disabled={saving || deleting}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isEdit ? 'Guardar cambios' : 'Crear puesto'}
          </Button>
          {canDelete && (
            <Button
              type="button"
              variant="outline"
              onClick={handleDelete}
              disabled={saving || deleting}
              className="text-red-600 hover:bg-red-50"
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Eliminar
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onClose} disabled={saving || deleting}>
            Cancelar
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default PositionFormModal;
