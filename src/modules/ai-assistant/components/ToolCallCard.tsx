import { CheckCircle2, AlertTriangle, Loader2, Undo2, Download } from 'lucide-react';
import { useUndoStack } from '../services/undoStack';
import AuthedImage from '@shared/components/ui/AuthedImage';
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
  generate_image: 'Generando imagen',
  create_pdf_report: 'Generando PDF',
  db_overview: 'Consultando la base de datos',
  db_count: 'Contando registros',
  db_query: 'Consultando registros',
};

// Resolves a relative /files URL against the file-server origin for download.
function resolveDownloadUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  const base = ((import.meta.env.VITE_FILE_SERVER_URL as string | undefined) ?? '').replace(
    /\/+$/,
    '',
  );
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}

// Pulls a typed { kind, url } payload out of a successful tool result.
function getAsset(
  call: ToolCallRecord,
): { kind: string; url: string; title?: string; scope?: string } | null {
  if (call.status !== 'success' || !call.result || typeof call.result !== 'object') return null;
  const data = call.result as Record<string, unknown>;
  if (typeof data.url !== 'string' || typeof data.kind !== 'string') return null;
  return {
    kind: data.kind,
    url: data.url,
    title: typeof data.title === 'string' ? data.title : undefined,
    scope: typeof data.scope === 'string' ? data.scope : undefined,
  };
}

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

  const asset = getAsset(call);

  return (
    <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs">
      <div className="flex items-start gap-2">
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

      {asset?.kind === 'image' &&
        (asset.scope === 'course' ? (
          // Public course image — plain <img> (anyone can load it).
          <img
            src={resolveDownloadUrl(asset.url)}
            alt={call.summary || 'Imagen generada'}
            className="mt-2 max-h-72 w-full rounded-md object-contain"
          />
        ) : (
          // Private admin image — needs the auth token to load.
          <AuthedImage
            src={asset.url}
            alt={call.summary || 'Imagen generada'}
            className="mt-2 max-h-72 w-full rounded-md object-contain"
          />
        ))}

      {asset?.kind === 'pdf' && (
        <a
          href={resolveDownloadUrl(asset.url)}
          target="_blank"
          rel="noopener noreferrer"
          download
          className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 font-medium text-white hover:bg-emerald-700"
        >
          <Download className="h-3.5 w-3.5" />
          Descargar {asset.title || 'PDF'}
        </a>
      )}
    </div>
  );
}

export default ToolCallCard;
