import { useMemo } from 'react';
import VideoPlayer from './VideoPlayer';
import PptxViewer from './PptxViewer';

export type ViewerKind = 'pdf' | 'image' | 'video' | 'audio' | 'pptx' | 'office' | 'text' | 'archive' | 'other';

interface FileViewerProps {
  url: string;
  name?: string;
  contentType?: string;
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

function TextPreview({ url, maxHeight }: { url: string; maxHeight: number }) {
  return (
    <iframe
      src={url}
      className="w-full border-0 bg-gray-50"
      style={{ height: maxHeight }}
      title={url}
    />
  );
}

export default function FileViewer({
  url,
  name,
  contentType,
  maxHeight = 480,
  className = '',
}: FileViewerProps) {
  const kind = useMemo(() => detectKind(url, name, contentType), [url, name, contentType]);
  const displayName = name || url.split('/').pop() || 'archivo';

  return (
    <div className={`rounded-lg overflow-hidden bg-white ${className}`}>
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

      {(kind === 'office' || kind === 'archive' || kind === 'other') && (
        <iframe
          src={`https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`}
          title={displayName}
          className="w-full border-0 bg-gray-50"
          style={{ height: maxHeight }}
        />
      )}

      {kind === 'text' && <TextPreview url={url} maxHeight={maxHeight} />}
    </div>
  );
}
