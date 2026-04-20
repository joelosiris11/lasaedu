import { useEffect } from 'react';
import {
  X,
  Plus,
  Pencil,
  Trash2,
  BookOpen,
  Users,
  Shield,
  AlertCircle,
  Calendar,
} from 'lucide-react';
import type {
  DBAuditLog,
  AuditAction,
} from '@shared/services/auditLogService';
import { getResourceIcon, getResourceLabel } from '../utils/resourceDisplay';

// ─── Friendly copy ────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<AuditAction, string> = {
  create: 'Creó',
  update: 'Editó',
  delete: 'Borró',
};

const ACTION_COLORS: Record<AuditAction, string> = {
  create: 'bg-red-50 text-red-700 border-red-200',
  update: 'bg-red-100 text-red-700 border-red-300',
  delete: 'bg-red-600 text-white border-red-600',
};

const ACTION_ICONS: Record<AuditAction, React.ElementType> = {
  create: Plus,
  update: Pencil,
  delete: Trash2,
};

// Hidden technical fields — users never need to see these
const HIDDEN_FIELDS = new Set([
  'id',
  'updatedAt',
  'createdAt',
  'lastUpdated',
  'updatedAtFs',
  'createdAtFs',
  'videoSource', // provider (youtube/vimeo/etc) — usuario no lo necesita
]);

const FIELD_LABELS: Record<string, string> = {
  title: 'Título',
  name: 'Nombre',
  description: 'Descripción',
  status: 'Estado',
  published: 'Publicado',
  isPublished: 'Publicado',
  order: 'Orden',
  duration: 'Duración (min)',
  type: 'Tipo',
  content: 'Contenido',
  textContent: 'Texto',
  html: 'Contenido',
  videoUrl: 'Video',
  instructorId: 'Profesor',
  courseId: 'Curso',
  moduleId: 'Módulo',
  sectionId: 'Sección',
  dueDate: 'Fecha de entrega',
  lateSubmissionDeadline: 'Cierre definitivo',
  availableFrom: 'Disponible desde',
  timeLimit: 'Tiempo límite (min)',
  passingScore: 'Nota para aprobar',
  attempts: 'Intentos permitidos',
  shuffleQuestions: 'Mezclar preguntas',
  shuffleOptions: 'Mezclar opciones',
  showResults: 'Mostrar resultados',
  showCorrectAnswers: 'Mostrar respuestas correctas',
  role: 'Rol',
  email: 'Correo',
  phone: 'Teléfono',
  settings: 'Configuración',
  totalPoints: 'Puntos totales',
  instructions: 'Instrucciones',
  submissionType: 'Tipo de entrega',
  files: 'Archivos',
  tags: 'Etiquetas',
};

const STATUS_LABELS: Record<string, string> = {
  borrador: 'Borrador',
  publicado: 'Publicado',
  archivado: 'Archivado',
  submitted: 'Entregada',
  graded: 'Calificada',
  returned: 'Devuelta',
  active: 'Activo',
  inactive: 'Inactivo',
  completed: 'Completado',
  on_time: 'A tiempo',
  late: 'Tarde',
};

function prettyField(path: string): string {
  const last = path.split('.').pop() || path;
  if (FIELD_LABELS[last]) return FIELD_LABELS[last];
  return last
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function looksLikeHtml(s: string): boolean {
  return /<[a-z][^>]*>/i.test(s);
}

function looksLikeJson(s: string): boolean {
  const t = s.trim();
  return (t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'));
}

function tryParseJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?/.test(s);
}

// ─── Content-block rendering ──────────────────────────────────────────────────
// Lesson "texto" content is stored as an array of blocks:
//   [{ id, type: 'heading'|'text'|'code'|'quote', content, metadata?, order }]
// We render each block as HTML and feed it into the same paragraph-diff flow.

interface ContentBlock {
  id?: string;
  type?: string;
  content?: string;
  metadata?: { level?: number; language?: string };
  order?: number;
}

function isBlockArray(v: unknown): v is ContentBlock[] {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    v.every(
      (b) =>
        typeof b === 'object' &&
        b !== null &&
        'type' in b &&
        'content' in b
    )
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return c;
    }
  });
}

function blockToHtml(b: ContentBlock): string {
  const content = escapeHtml(String(b.content ?? ''));
  switch (b.type) {
    case 'heading': {
      const level = b.metadata?.level ?? 2;
      if (level === 1) return `<h1>${content}</h1>`;
      if (level === 2) return `<h2>${content}</h2>`;
      return `<h3>${content}</h3>`;
    }
    case 'text':
      return `<p>${content.replace(/\n/g, '<br/>')}</p>`;
    case 'code':
      return `<pre><code>${content}</code></pre>`;
    case 'quote':
      return `<blockquote>${content}</blockquote>`;
    default:
      return `<p>${content}</p>`;
  }
}

function blockArrayToHtml(blocks: ContentBlock[]): string {
  return blocks.map(blockToHtml).join('\n');
}

function fmtDateFull(ts: number | string): string {
  const d = typeof ts === 'number' ? new Date(ts) : new Date(ts);
  if (isNaN(d.getTime())) return String(ts);
  return d.toLocaleString('es', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Flatten nested object changes ────────────────────────────────────────────

interface FlatChange {
  field: string;
  from: unknown;
  to: unknown;
}

function flattenChange(
  field: string,
  from: unknown,
  to: unknown,
  depth = 0
): FlatChange[] {
  const lastKey = field.split('.').pop() || field;
  if (HIDDEN_FIELDS.has(lastKey)) return [];

  // Auto-parse JSON strings so we can flatten them too
  let a = from;
  let b = to;
  if (typeof a === 'string' && looksLikeJson(a)) a = tryParseJson(a);
  if (typeof b === 'string' && looksLikeJson(b)) b = tryParseJson(b);

  // Content-block arrays → render as HTML string (reuses paragraph diff).
  if (isBlockArray(a)) a = blockArrayToHtml(a);
  if (isBlockArray(b)) b = blockArrayToHtml(b);

  if (depth < 3 && (isObject(a) || isObject(b))) {
    const oa = isObject(a) ? a : {};
    const ob = isObject(b) ? b : {};
    const keys = Array.from(new Set([...Object.keys(oa), ...Object.keys(ob)]));
    const out: FlatChange[] = [];
    for (const k of keys) {
      if (HIDDEN_FIELDS.has(k)) continue;
      const va = oa[k];
      const vb = ob[k];
      if (JSON.stringify(va) !== JSON.stringify(vb)) {
        out.push(...flattenChange(`${field}.${k}`, va, vb, depth + 1));
      }
    }
    return out;
  }

  // Skip if somehow equal after parsing
  if (JSON.stringify(a) === JSON.stringify(b)) return [];

  return [{ field, from: a, to: b }];
}

// ─── Paragraph-level text diff ────────────────────────────────────────────────

function splitParagraphs(s: string): string[] {
  if (!s) return [];
  if (looksLikeHtml(s)) {
    // Extract block-level HTML elements as separate paragraphs
    const blocks: string[] = [];
    const re = /<(p|h[1-6]|ul|ol|li|blockquote|pre|figure)\b[^>]*>[\s\S]*?<\/\1>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) {
      blocks.push(m[0]);
    }
    if (blocks.length === 0) return [s];
    return blocks;
  }
  return s.split(/\n+/).map((p) => p.trim()).filter((p) => p.length > 0);
}

type DiffOp = { type: 'same' | 'removed' | 'added'; text: string };
type DiffGroup = { removed: string[]; added: string[] };

// LCS-based paragraph diff → groups of consecutive changes.
function diffParagraphs(a: string[], b: string[]): DiffGroup[] {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const ops: DiffOp[] = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      ops.unshift({ type: 'same', text: a[i - 1] });
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      ops.unshift({ type: 'removed', text: a[i - 1] });
      i--;
    } else {
      ops.unshift({ type: 'added', text: b[j - 1] });
      j--;
    }
  }
  while (i > 0) {
    ops.unshift({ type: 'removed', text: a[i - 1] });
    i--;
  }
  while (j > 0) {
    ops.unshift({ type: 'added', text: b[j - 1] });
    j--;
  }

  // Group consecutive non-same ops — "same" paragraphs are dropped entirely.
  const groups: DiffGroup[] = [];
  let current: DiffGroup | null = null;
  for (const op of ops) {
    if (op.type === 'same') {
      if (current) {
        groups.push(current);
        current = null;
      }
      continue;
    }
    if (!current) current = { removed: [], added: [] };
    if (op.type === 'removed') current.removed.push(op.text);
    else current.added.push(op.text);
  }
  if (current) groups.push(current);
  return groups;
}

// ─── Paragraph renderer ───────────────────────────────────────────────────────

type Tone = 'removed' | 'added';
const toneTextClass = (t: Tone) =>
  t === 'removed' ? 'text-red-600' : 'text-green-600';

function ParaRender({ text, tone }: { text: string; tone: Tone }) {
  const color = toneTextClass(tone);
  if (!text || !text.trim()) {
    return <span className="text-gray-400 italic">vacío</span>;
  }
  if (looksLikeHtml(text)) {
    return (
      <div
        className={`${color} prose prose-sm max-w-none leading-relaxed break-words [&_*]:!text-inherit`}
        dangerouslySetInnerHTML={{ __html: text }}
      />
    );
  }
  return (
    <p className={`${color} whitespace-pre-wrap break-words leading-relaxed`}>
      {text}
    </p>
  );
}

// ─── Scalar renderer (non-text values) ────────────────────────────────────────

function RenderScalar({ value, tone, fieldKey }: { value: unknown; tone: Tone; fieldKey: string }) {
  const color = toneTextClass(tone);

  if (value === null || value === undefined || value === '') {
    return <span className="text-gray-400 italic">vacío</span>;
  }
  if (typeof value === 'boolean') {
    return <span className={`${color} font-medium`}>{value ? 'Sí' : 'No'}</span>;
  }
  if (typeof value === 'number') {
    if (/date|at|deadline/i.test(fieldKey) && value > 1_000_000_000_000) {
      return <span className={color}>{fmtDateFull(value)}</span>;
    }
    return <span className={`${color} font-medium`}>{value}</span>;
  }
  if (typeof value === 'string') {
    if (STATUS_LABELS[value]) {
      return <span className={`${color} font-medium`}>{STATUS_LABELS[value]}</span>;
    }
    if (isIsoDate(value)) {
      return <span className={color}>{fmtDateFull(value)}</span>;
    }
    // Short text (single line, no HTML)
    return <ParaRender text={value} tone={tone} />;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-gray-400 italic">lista vacía</span>;
    }
    return (
      <ul className={`space-y-1 list-disc list-inside ${color}`}>
        {value.map((v, i) => (
          <li key={i} className="break-words">
            {typeof v === 'object' && v !== null
              ? <code className="text-[11px]">{JSON.stringify(v)}</code>
              : String(v)}
          </li>
        ))}
      </ul>
    );
  }
  if (isObject(value)) {
    return (
      <div className={`space-y-1 ${color}`}>
        {Object.entries(value).map(([k, v]) => (
          <div key={k} className="text-sm">
            <span className="font-semibold">{prettyField(k)}:</span>{' '}
            {typeof v === 'object' ? (
              <code className="text-[11px]">{JSON.stringify(v)}</code>
            ) : (
              String(v)
            )}
          </div>
        ))}
      </div>
    );
  }
  return <span className={color}>{String(value)}</span>;
}

// ─── Components ───────────────────────────────────────────────────────────────

function AvatarBadge({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <span className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-gradient-to-br from-red-500 to-red-700 text-white text-sm font-bold shrink-0 select-none">
      {initials}
    </span>
  );
}

function RoleChip({ role }: { role: string }) {
  const Icon = role === 'admin' ? Shield : role === 'teacher' ? BookOpen : Users;
  const label =
    role === 'admin'
      ? 'Admin'
      : role === 'teacher'
      ? 'Profe'
      : role === 'supervisor'
      ? 'Supervisor'
      : role;
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[11px] font-medium">
      <Icon className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}

// Single before/after card
function SideBySideCard({
  before,
  after,
  tone,
  fieldKey,
}: {
  before: React.ReactNode;
  after: React.ReactNode;
  tone?: 'string' | 'scalar';
  fieldKey: string;
}) {
  void tone;
  void fieldKey;
  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
        <div className="p-4">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Antes
          </p>
          <div className="text-sm">{before}</div>
        </div>
        <div className="p-4">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Después
          </p>
          <div className="text-sm">{after}</div>
        </div>
      </div>
    </div>
  );
}

// Renders a field change. For long/multi-paragraph strings, renders one card per
// changed paragraph-group (skipping unchanged paragraphs).
function ChangeEntry({ change }: { change: FlatChange }) {
  const { field, from, to } = change;
  const lastKey = field.split('.').pop() || field;

  const isStringDiff =
    typeof from === 'string' &&
    typeof to === 'string' &&
    (from.includes('\n') || to.includes('\n') || looksLikeHtml(from) || looksLikeHtml(to));

  if (isStringDiff) {
    const before = from as string;
    const after = to as string;
    const groups = diffParagraphs(splitParagraphs(before), splitParagraphs(after));

    if (groups.length === 0) return null;

    return (
      <div className="space-y-2">
        <p className="text-xs font-bold text-gray-800 px-1">{prettyField(field)}</p>
        <div className="space-y-2">
          {groups.map((g, idx) => (
            <SideBySideCard
              key={idx}
              fieldKey={lastKey}
              before={
                g.removed.length === 0 ? (
                  <span className="text-gray-400 italic">vacío</span>
                ) : (
                  <div className="space-y-2">
                    {g.removed.map((p, i) => (
                      <ParaRender key={i} text={p} tone="removed" />
                    ))}
                  </div>
                )
              }
              after={
                g.added.length === 0 ? (
                  <span className="text-gray-400 italic">vacío</span>
                ) : (
                  <div className="space-y-2">
                    {g.added.map((p, i) => (
                      <ParaRender key={i} text={p} tone="added" />
                    ))}
                  </div>
                )
              }
            />
          ))}
        </div>
      </div>
    );
  }

  // Scalar (non-string) fallback — one card
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-gray-800 px-1">{prettyField(field)}</p>
      <SideBySideCard
        fieldKey={lastKey}
        before={<RenderScalar value={from} tone="removed" fieldKey={lastKey} />}
        after={<RenderScalar value={to} tone="added" fieldKey={lastKey} />}
      />
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface Props {
  log: DBAuditLog | null;
  onClose: () => void;
}

export default function AuditDetailsModal({ log, onClose }: Props) {
  useEffect(() => {
    if (!log) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [log, onClose]);

  if (!log) return null;

  const ActionIcon = ACTION_ICONS[log.action];
  const ResourceIcon = getResourceIcon(log.resourceType, log.metadata);
  const resourceLabel = getResourceLabel(log.resourceType, log.metadata);

  const flatChanges: FlatChange[] = [];
  if (log.changes) {
    for (const [field, { from, to }] of Object.entries(log.changes)) {
      if (HIDDEN_FIELDS.has(field)) continue;
      flatChanges.push(...flattenChange(field, from, to));
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-details-title"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full sm:max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh] overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3 min-w-0">
            <AvatarBadge name={log.actorName} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  id="audit-details-title"
                  className="text-base font-bold text-gray-900 leading-tight truncate"
                >
                  {log.actorName}
                </h2>
                <RoleChip role={log.actorRole} />
              </div>
              <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {fmtDateFull(log.timestamp)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Summary */}
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Qué hizo
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${ACTION_COLORS[log.action]}`}
            >
              <ActionIcon className="h-3 w-3" />
              {ACTION_LABELS[log.action]}
            </span>
            <span className="text-sm text-gray-700">{resourceLabel}:</span>
            <span className="inline-flex items-center gap-1.5 text-sm text-gray-900 font-medium">
              <ResourceIcon className="h-4 w-4 text-red-500" />
              {log.resourceName || 'Sin nombre'}
            </span>
          </div>
        </div>

        {/* Body — changes */}
        <div className="flex-1 overflow-y-auto px-5 py-4 bg-gray-50/30">
          {flatChanges.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-3">
                <AlertCircle className="h-6 w-6 text-red-400" />
              </div>
              <p className="text-sm font-semibold text-gray-700 mb-1">
                {log.action === 'create'
                  ? 'Se creó este elemento'
                  : log.action === 'delete'
                  ? 'Se eliminó este elemento'
                  : 'Sin cambios'}
              </p>
              <p className="text-xs text-gray-500 text-center max-w-xs">
                {log.action === 'create'
                  ? 'Es nuevo, así que no hay versión anterior para comparar.'
                  : log.action === 'delete'
                  ? 'Ya no existe en el sistema.'
                  : 'Nada que mostrar.'}
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Qué cambió
              </p>
              <div className="space-y-4">
                {flatChanges.map((c) => (
                  <ChangeEntry key={c.field} change={c} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
