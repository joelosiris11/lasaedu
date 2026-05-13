import { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Undo2,
  ImageIcon,
  Check,
  Copy,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { useUndoStack, newUndoId } from '../services/undoStack';
import { useAssistantScope } from '../services/assistantScopeStore';
import {
  courseService,
  sectionService,
  type DBCourse,
  type DBSection,
} from '@shared/services/dataService';
import type { StockImage, ToolCallRecord } from '../types';

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
  generate_image: 'Generando imagen con Gemini',
  db_overview: 'Resumen de la base de datos',
  db_count: 'Contando registros',
  db_query: 'Consultando registros',
};

interface StockImagesPayload {
  kind: 'stock';
  query: string;
  images: StockImage[];
}

interface GeneratedImagePayload {
  kind: 'generated';
  url: string;
  prompt: string;
  model: string;
}

type ImagePayload = StockImagesPayload | GeneratedImagePayload;

function isImagePayload(call: ToolCallRecord): ImagePayload | null {
  if (call.status !== 'success') return null;
  if (call.name !== 'search_stock_images' && call.name !== 'generate_image') return null;
  const r = call.result as { kind?: string } | null | undefined;
  if (!r || typeof r !== 'object') return null;
  if (r.kind === 'stock' || r.kind === 'generated') return r as ImagePayload;
  return null;
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

  const imagePayload = isImagePayload(call);

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

      {imagePayload && <ImagePicker payload={imagePayload} />}
    </div>
  );
}

export default ToolCallCard;

// ─── Image picker ───────────────────────────────────────────────────────────
//
// Renders Unsplash search results as a clickable grid, or a single Gemini-
// generated preview, with apply-actions wired to the active assistant scope
// (course cover and optional section banner). All actions are reversible via
// the undo stack so the admin can revert with one click.

interface ImagePickerProps {
  payload: ImagePayload;
}

function ImagePicker({ payload }: ImagePickerProps) {
  const [selectedUrl, setSelectedUrl] = useState<string | null>(
    payload.kind === 'generated' ? payload.url : null,
  );

  const items: { url: string; thumbUrl: string; caption?: string; sourceUrl?: string; author?: string; authorUrl?: string }[] =
    payload.kind === 'stock'
      ? payload.images.map((i) => ({
          url: i.url,
          thumbUrl: i.thumbUrl,
          caption: i.description,
          sourceUrl: i.sourceUrl,
          author: i.author,
          authorUrl: i.authorUrl,
        }))
      : [
          {
            url: payload.url,
            thumbUrl: payload.url,
            caption: payload.prompt,
          },
        ];

  if (items.length === 0) return null;

  return (
    <div className="mt-2 rounded border border-gray-200 bg-white p-2">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-gray-600">
        {payload.kind === 'generated' ? (
          <>
            <Sparkles className="h-3 w-3 text-purple-500" />
            Imagen generada con Gemini Flash
          </>
        ) : (
          <>
            <ImageIcon className="h-3 w-3 text-gray-500" />
            Resultados de Unsplash · elige una manualmente
          </>
        )}
      </div>

      <div
        className={
          payload.kind === 'generated'
            ? 'grid grid-cols-1'
            : 'grid grid-cols-2 sm:grid-cols-3 gap-2'
        }
      >
        {items.map((img) => {
          const isSelected = img.url === selectedUrl;
          return (
            <button
              key={img.url}
              type="button"
              onClick={() => setSelectedUrl(img.url)}
              className={`group relative overflow-hidden rounded-md border-2 transition ${
                isSelected
                  ? 'border-red-500 ring-2 ring-red-500/30'
                  : 'border-transparent hover:border-red-300'
              }`}
            >
              <img
                src={img.thumbUrl}
                alt={img.caption || 'Imagen'}
                className="h-28 w-full object-cover"
                loading="lazy"
              />
              {isSelected && (
                <div className="absolute right-1 top-1 rounded-full bg-red-600 text-white p-0.5 shadow">
                  <Check className="h-3 w-3" />
                </div>
              )}
              {img.author && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-1.5 py-1 text-[9px] text-white opacity-0 group-hover:opacity-100 truncate">
                  © {img.author}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selectedUrl && (
        <ApplyActions
          url={selectedUrl}
          isStock={payload.kind === 'stock'}
          stockMeta={
            payload.kind === 'stock'
              ? items.find((i) => i.url === selectedUrl)
              : undefined
          }
        />
      )}
    </div>
  );
}

interface ApplyActionsProps {
  url: string;
  isStock: boolean;
  stockMeta?: {
    author?: string;
    authorUrl?: string;
    sourceUrl?: string;
  };
}

function ApplyActions({ url, isStock, stockMeta }: ApplyActionsProps) {
  const scope = useAssistantScope();
  const register = useUndoStack((s) => s.register);
  const [busy, setBusy] = useState<'course' | 'section' | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const courseId = scope.courseId;
  const sectionId = scope.sectionId;
  const canApplyCourse = !!courseId && !scope.isNewCourseScope;
  const canApplySection = !!sectionId && !scope.isNewCourseScope;

  const applyToCourse = async () => {
    if (!courseId) return;
    setBusy('course');
    setFeedback(null);
    try {
      const before = (await courseService.getById(courseId)) as DBCourse | undefined;
      if (!before) throw new Error('Curso no encontrado');
      const previousImage = before.image;
      await courseService.update(courseId, { image: url, updatedAt: Date.now() });
      register({
        id: newUndoId(),
        createdAt: Date.now(),
        description: `Restaurar portada anterior del curso "${before.title}"`,
        execute: async () => {
          try {
            await courseService.update(courseId, {
              image: previousImage,
              updatedAt: Date.now(),
            });
            return true;
          } catch {
            return false;
          }
        },
      });
      setFeedback({ tone: 'ok', text: `Portada del curso actualizada.` });
    } catch (err) {
      setFeedback({ tone: 'err', text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(null);
    }
  };

  const applyToSection = async () => {
    if (!sectionId) return;
    setBusy('section');
    setFeedback(null);
    try {
      const before = (await sectionService.getById(sectionId)) as DBSection | undefined;
      if (!before) throw new Error('Sección no encontrada');
      const previousImage = before.image;
      await sectionService.update(sectionId, { image: url, updatedAt: Date.now() });
      register({
        id: newUndoId(),
        createdAt: Date.now(),
        description: `Restaurar portada anterior de la sección "${before.title}"`,
        execute: async () => {
          try {
            await sectionService.update(sectionId, {
              image: previousImage,
              updatedAt: Date.now(),
            });
            return true;
          } catch {
            return false;
          }
        },
      });
      setFeedback({ tone: 'ok', text: `Portada de la sección actualizada.` });
    } catch (err) {
      setFeedback({ tone: 'err', text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(null);
    }
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setFeedback({ tone: 'err', text: 'No se pudo copiar al portapapeles.' });
    }
  };

  return (
    <div className="mt-2 border-t border-gray-100 pt-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={applyToCourse}
          disabled={!canApplyCourse || busy !== null}
          className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          title={
            scope.isNewCourseScope
              ? 'Crea o selecciona el curso primero'
              : !courseId
              ? 'Selecciona un curso desde el panel de scope'
              : `Aplicar como portada de "${scope.courseTitle ?? 'el curso'}"`
          }
        >
          {busy === 'course' ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Check className="h-3 w-3" />
          )}
          Aplicar como portada del curso
        </button>

        {canApplySection && (
          <button
            type="button"
            onClick={applyToSection}
            disabled={busy !== null}
            className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-white px-2.5 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
            title={`Aplicar como portada de la sección "${scope.sectionTitle ?? ''}"`}
          >
            {busy === 'section' ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3 w-3" />
            )}
            Portada de sección
          </button>
        )}

        <button
          type="button"
          onClick={copyUrl}
          className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50"
          title="Copiar URL"
        >
          <Copy className="h-3 w-3" />
          {copied ? 'Copiado' : 'Copiar URL'}
        </button>

        {isStock && stockMeta?.sourceUrl && (
          <a
            href={stockMeta.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50"
          >
            <ExternalLink className="h-3 w-3" />
            Unsplash
          </a>
        )}
      </div>

      {isStock && stockMeta?.author && (
        <div className="mt-1 text-[10px] text-gray-400">
          Foto por{' '}
          <a
            href={stockMeta.authorUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-gray-600"
          >
            {stockMeta.author}
          </a>{' '}
          · Unsplash
        </div>
      )}

      {feedback && (
        <div
          className={`mt-1.5 text-[11px] ${
            feedback.tone === 'ok' ? 'text-emerald-700' : 'text-red-600'
          }`}
        >
          {feedback.text}
        </div>
      )}
    </div>
  );
}
