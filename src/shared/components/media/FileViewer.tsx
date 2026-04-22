import { useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, FileText, FileSpreadsheet, FileArchive, File as FileIcon, Eye, EyeOff } from 'lucide-react';
import VideoPlayer from './VideoPlayer';
import PptxViewer from './PptxViewer';

export type ViewerKind = 'pdf' | 'image' | 'video' | 'audio' | 'pptx' | 'office' | 'text' | 'archive' | 'other';

interface FileViewerProps {
  url: string;
  name?: string;
  contentType?: string;
  size?: number;
  /**
   * When true, viewer renders expanded by default. When false, it starts collapsed
   * and the user toggles it. Defaults to true for images, false for heavier assets.
   */
  defaultOpen?: boolean;
  /** Limit iframe/image height. Default 480px. */
  maxHeight?: number;
  className?: string;
}

const EXT_TO_KIND: Record<string, ViewerKind> = {
  // PDF
  pdf: 'pdf',
  // Images
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image', svg: 'image', bmp: 'image',
  // Video
  mp4: 'video', mov: 'video', webm: 'video', m4v: 'video', ogv: 'video', avi: 'video', mkv: 'video',
  // Audio
  mp3: 'audio', wav: 'audio', ogg: 'audio', oga: 'audio', m4a: 'audio', aac: 'audio', flac: 'audio',
  // Presentation (inline reader) + other office docs
  pptx: 'pptx', odp: 'pptx',
  ppt: 'office', doc: 'office', docx: 'office', xls: 'office', xlsx: 'office',
  odt: 'office', ods: 'office',
  // Text
  txt: 'text', csv: 'text', md: 'text', json: 'text', log: 'text',
  // Archive
  zip: 'archive', rar: 'archive', '7z': 'archive', tar: 'archive', gz: 'archive',
};

function getExt(nameOrUrl: string): string {
  const clean = nameOrUrl.split('?')[0].split('#')[0];
  const dot = clean.lastIndexOf('.');
  if (dot === -1) return '';
  return clean.slice(dot + 1).toLowerCase();
}

function detectKind(url: string, name?: string, contentType?: string): ViewerKind {
  const ext = getExt(name || url);
  // Extension wins for pptx/odp so we always route to the inline reader
  if (ext === 'pptx' || ext === 'odp') return 'pptx';

  const ct = (contentType || '').toLowerCase();
  if (ct.includes('presentationml') || ct.includes('opendocument.presentation')) return 'pptx';
  if (ct.startsWith('image/')) return 'image';
  if (ct.startsWith('video/')) return 'video';
  if (ct.startsWith('audio/')) return 'audio';
  if (ct === 'application/pdf') return 'pdf';
  if (ct.includes('officedocument') || ct.includes('msword') || ct.includes('ms-excel') ||
      ct.includes('ms-powerpoint') || ct.includes('opendocument')) return 'office';
  if (ct.startsWith('text/') || ct === 'application/json') return 'text';
  if (ct.includes('zip') || ct.includes('rar') || ct.includes('7z') || ct.includes('tar')) return 'archive';

  return EXT_TO_KIND[ext] ?? 'other';
}

function formatSize(bytes?: number): string {
  if (!bytes) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function KindIcon({ kind }: { kind: ViewerKind }) {
  if (kind === 'pptx' || kind === 'office') return <FileSpreadsheet className="w-5 h-5 text-red-500" />;
  if (kind === 'archive') return <FileArchive className="w-5 h-5 text-yellow-500" />;
  if (kind === 'text' || kind === 'pdf') return <FileText className="w-5 h-5 text-gray-500" />;
  return <FileIcon className="w-5 h-5 text-gray-500" />;
}

function TextPreview({ url, maxHeight }: { url: string; maxHeight: number }) {
  const [text, setText] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(url)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then(t => { if (!cancelled) setText(t.slice(0, 100_000)); })
      .catch(e => { if (!cancelled) setError(e.message || 'Error cargando archivo'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [url]);

  if (loading) return <div className="p-4 text-sm text-gray-500">Cargando preview...</div>;
  if (error) return <div className="p-4 text-sm text-red-600">No se pudo cargar el preview: {error}</div>;
  return (
    <pre
      className="p-4 bg-gray-50 text-xs text-gray-800 overflow-auto whitespace-pre-wrap break-words"
      style={{ maxHeight }}
    >
      {text}
    </pre>
  );
}

export default function FileViewer({
  url,
  name,
  contentType,
  size,
  defaultOpen,
  maxHeight = 480,
  className = '',
}: FileViewerProps) {
  const kind = useMemo(() => detectKind(url, name, contentType), [url, name, contentType]);

  const shouldDefaultOpen = defaultOpen ?? (kind === 'image' || kind === 'audio');
  const [open, setOpen] = useState(shouldDefaultOpen);

  const displayName = name || url.split('/').pop() || 'archivo';

  return (
    <div className={`border border-gray-200 rounded-lg bg-white overflow-hidden ${className}`}>
      {/* Header / metadata row */}
      <div className="flex items-center gap-3 p-3 bg-gray-50 border-b border-gray-200">
        <KindIcon kind={kind} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">{displayName}</p>
          <p className="text-xs text-gray-500">
            {kind.toUpperCase()}{size ? ` · ${formatSize(size)}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-white border border-gray-200 text-gray-700 hover:bg-gray-100"
          title={open ? 'Ocultar preview' : 'Ver preview'}
        >
          {open ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {open ? 'Ocultar' : 'Ver'}
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-white border border-gray-200 text-gray-700 hover:bg-gray-100"
          title="Abrir en nueva pestaña"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
        <a
          href={url}
          download={displayName}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-white border border-gray-200 text-gray-700 hover:bg-gray-100"
          title="Descargar"
        >
          <Download className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Body / preview */}
      {open && (
        <div className="bg-white">
          {kind === 'image' && (
            <img
              src={url}
              alt={displayName}
              className="block w-full object-contain bg-gray-50"
              style={{ maxHeight }}
            />
          )}

          {kind === 'video' && (
            <div style={{ maxHeight }} className="bg-black">
              <VideoPlayer url={url} title={displayName} />
            </div>
          )}

          {kind === 'audio' && (
            <div className="p-4">
              <audio controls preload="metadata" className="w-full">
                <source src={url} type={contentType || undefined} />
                Tu navegador no soporta la reproduccion de audio.
              </audio>
            </div>
          )}

          {kind === 'pdf' && (
            <iframe
              src={`${url}#view=FitH`}
              title={displayName}
              className="w-full border-0"
              style={{ height: maxHeight }}
            />
          )}

          {kind === 'pptx' && (
            <PptxViewer url={url} name={displayName} height={maxHeight} />
          )}

          {kind === 'office' && (
            <div className="p-6 text-sm text-gray-600 bg-gray-50">
              <p className="mb-2 font-medium text-gray-800">Preview inline no disponible para este formato</p>
              <p className="text-xs text-gray-500 mb-3">
                Los archivos .docx, .xlsx, .ods, .odt se pueden descargar y abrir en tu programa local.
              </p>
              <a
                href={url}
                download={displayName}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-red-600 text-white hover:bg-red-700"
              >
                <Download className="w-3.5 h-3.5" /> Descargar archivo
              </a>
            </div>
          )}

          {kind === 'text' && <TextPreview url={url} maxHeight={maxHeight} />}

          {(kind === 'archive' || kind === 'other') && (
            <div className="p-6 text-sm text-gray-600 bg-gray-50">
              <p className="mb-3">Este tipo de archivo no tiene preview inline.</p>
              <a
                href={url}
                download={displayName}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-red-600 text-white hover:bg-red-700"
              >
                <Download className="w-3.5 h-3.5" /> Descargar archivo
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
