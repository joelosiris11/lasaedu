import { useMemo, useState } from 'react';
import { Loader2, Building2 } from 'lucide-react';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { Label } from '@shared/components/ui/Label';
import { Modal } from '@shared/components/ui/Modal';
import type { DBDepartment } from '@shared/services/dataService';
import { wouldCreateDepartmentCycle } from '@shared/utils/orgScope';

const PRESET_COLORS = [
  '#DC2626', // red
  '#2563EB', // blue
  '#059669', // emerald
  '#7C3AED', // violet
  '#EA580C', // orange
  '#0891B2', // cyan
  '#DB2777', // pink
  '#64748B', // slate
];

interface Props {
  department: DBDepartment | null;
  /** Lista completa de departamentos — se usa para el selector de padre. */
  departments?: DBDepartment[];
  /** Padre sugerido al crear un sub-departamento. */
  defaultParentId?: string | null;
  onSave: (data: Omit<DBDepartment, 'id' | 'createdAt' | 'updatedAt'>, id?: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onClose: () => void;
}

export function DepartmentFormModal({
  department,
  departments = [],
  defaultParentId,
  onSave,
  onDelete,
  onClose,
}: Props) {
  const isEdit = !!department;
  const [name, setName] = useState(department?.name ?? '');
  const [description, setDescription] = useState(department?.description ?? '');
  const [color, setColor] = useState(department?.color ?? PRESET_COLORS[0]);
  const [parentDepartmentId, setParentDepartmentId] = useState<string | null>(
    department?.parentDepartmentId ?? defaultParentId ?? null,
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  // Padres válidos: cualquier depto excepto el propio y sus descendientes.
  const parentOptions = useMemo(() => {
    if (!isEdit || !department) return departments;
    return departments.filter(
      d => d.id !== department.id && !wouldCreateDepartmentCycle(departments, department.id, d.id),
    );
  }, [departments, department, isEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('El nombre es requerido'); return; }
    if (
      isEdit && department && parentDepartmentId &&
      wouldCreateDepartmentCycle(departments, department.id, parentDepartmentId)
    ) {
      setError('Ese departamento no puede ser padre (crearía un ciclo)');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        parentDepartmentId,
        order: department?.order,
      }, department?.id);
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!department || !onDelete) return;
    if (!confirm(`¿Eliminar "${department.name}"?`)) return;
    setError('');
    setDeleting(true);
    try {
      await onDelete(department.id);
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
          <Building2 className="h-5 w-5 text-red-600" />
          <span>{isEdit ? 'Editar departamento' : 'Nuevo departamento'}</span>
        </div>
      }
      size="md"
      disableBackdropClose={saving || deleting}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
        )}

        <div>
          <Label htmlFor="dept-name">Nombre</Label>
          <Input
            id="dept-name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ej. Marketing"
            required
          />
        </div>

        <div>
          <Label htmlFor="dept-desc">Descripción</Label>
          <Input
            id="dept-desc"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Opcional"
          />
        </div>

        <div>
          <Label htmlFor="dept-parent">Departamento padre</Label>
          <select
            id="dept-parent"
            value={parentDepartmentId ?? ''}
            onChange={e => setParentDepartmentId(e.target.value || null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
          >
            <option value="">— Raíz (sin superior) —</option>
            {parentOptions.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-gray-500">
            Define la jerarquía del organigrama por departamentos.
          </p>
        </div>

        <div>
          <Label>Color</Label>
          <div className="flex flex-wrap gap-2 mt-1">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-8 w-8 rounded-full border-2 transition-transform ${
                  color === c ? 'border-gray-900 scale-110' : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: c }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" className="flex-1" disabled={saving || deleting}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isEdit ? 'Guardar' : 'Crear departamento'}
          </Button>
          {isEdit && onDelete && (
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

export default DepartmentFormModal;
