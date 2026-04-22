import { CheckCircle2, AlertTriangle, Loader2, Undo2 } from 'lucide-react';
import { useUndoStack } from '../services/undoStack';
import type { ToolCallRecord } from '../types';

const LABELS: Record<string, string> = {
  list_courses: 'Listando cursos',
  get_course_tree: 'Leyendo estructura del curso',
  get_lesson: 'Leyendo lección',
  create_course: 'Creando curso',
  update_course: 'Editando curso',
  create_module: 'Creando módulo',
  update_module: 'Editando módulo',
  create_lesson: 'Creando lección',
  update_lesson: 'Editando lección',
  update_lesson_content: 'Reescribiendo contenido',
  search_stock_images: 'Buscando imágenes',
};

export function ToolCallCard({ call }: { call: ToolCallRecord }) {
  const entries = useUndoStack((s) => s.entries);
  const undo = useUndoStack((s) => s.undo);
  const undoEntry = call.undoId ? entries.find((e) => e.id === call.undoId) : undefined;

  const label = LABELS[call.name] ?? call.name;

  const icon =
    call.status === 'running' ? (
      <Loader2 className="h-3.5 w-3.5 text-gray-500 animate-spin" />
    ) : call.status === 'error' ? (
      <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
    ) : (
      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
    );

  const handleUndo = async () => {
    if (!call.undoId) return;
    await undo(call.undoId);
  };

  return (
    <div className="mt-2 flex items-start gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-800">{label}</div>
        <div className="text-gray-600 truncate">
          {call.status === 'error' ? call.error : call.summary || '…'}
        </div>
      </div>
      {undoEntry && !undoEntry.applied && call.status === 'success' && (
        <button
          type="button"
          onClick={handleUndo}
          className="shrink-0 flex items-center gap-1 text-red-600 hover:text-red-800 font-medium"
          title={undoEntry.description}
        >
          <Undo2 className="h-3.5 w-3.5" />
          Deshacer
        </button>
      )}
      {undoEntry?.applied && (
        <span className="shrink-0 text-gray-400 italic">Deshecho</span>
      )}
    </div>
  );
}

export default ToolCallCard;
