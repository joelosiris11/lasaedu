import { useState, useEffect, useRef } from 'react';
import { Video, ExternalLink, Upload, X, AlertCircle, Link2, FileVideo } from 'lucide-react';
import { Input } from '@shared/components/ui/Input';
import { Label } from '@shared/components/ui/Label';
import { RichTextEditor } from '@shared/components/editor';
import VideoPlayer from '@shared/components/media/VideoPlayer';
import { fileUploadService } from '@shared/services/fileUploadService';

export interface VideoLessonContent {
  videoUrl: string;
  videoSource: 'youtube' | 'vimeo' | 'direct' | '';
  textContent: string; // HTML
}

export const defaultVideoContent: VideoLessonContent = {
  videoUrl: '',
  videoSource: '',
  textContent: '',
};

interface VideoLessonEditorProps {
  content: VideoLessonContent;
  onChange: (content: VideoLessonContent) => void;
  courseId?: string;
  lessonId?: string;
}

const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm', '.m4v', '.ogv', '.avi', '.mkv'];
const VIDEO_ACCEPT = [
  ...VIDEO_EXTENSIONS,
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
  'video/x-m4v',
  'video/x-matroska',
  'video/x-msvideo',
].join(',');
const MAX_VIDEO_SIZE_MB = 500;

function detectVideoSource(url: string): 'youtube' | 'vimeo' | 'direct' | '' {
  if (!url) return '';
  if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube';
  if (/vimeo\.com/i.test(url)) return 'vimeo';
  if (/\.(mp4|webm|mov|m4v|ogv|avi|mkv)(\?|$)/i.test(url)) return 'direct';
  return 'direct';
}

function hasVideoExtension(name: string): boolean {
  const lower = name.toLowerCase();
  return VIDEO_EXTENSIONS.some(ext => lower.endsWith(ext));
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function VideoLessonEditor({ content, onChange, courseId, lessonId }: VideoLessonEditorProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [mode, setMode] = useState<'url' | 'upload'>('url');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedName, setUploadedName] = useState<string>('');
  const [uploadError, setUploadError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleUrlChange = (url: string) => {
    const source = detectVideoSource(url);
    onChange({ ...content, videoUrl: url, videoSource: source });
  };

  // Auto-detect source when URL changes (on mount or external change)
  useEffect(() => {
    if (content.videoUrl && !content.videoSource) {
      const source = detectVideoSource(content.videoUrl);
      if (source) {
        onChange({ ...content, videoSource: source });
      }
    }
  }, []);

  const handleFileSelected = async (file: File) => {
    setUploadError('');

    if (!file.type.startsWith('video/') && !hasVideoExtension(file.name)) {
      setUploadError(`El archivo "${file.name}" no parece ser un video. Formatos permitidos: ${VIDEO_EXTENSIONS.join(', ')}`);
      return;
    }

    const maxBytes = MAX_VIDEO_SIZE_MB * 1024 * 1024;
    if (file.size > maxBytes) {
      setUploadError(`El video pesa ${formatSize(file.size)}. Maximo permitido: ${MAX_VIDEO_SIZE_MB}MB`);
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadedName(file.name);

    try {
      const result = await fileUploadService.uploadVideo(
        file,
        courseId,
        lessonId,
        (p) => setUploadProgress(p.percent),
      );

      onChange({
        ...content,
        videoUrl: result.url,
        videoSource: 'direct',
      });
      setUploadProgress(100);
    } catch (err: any) {
      setUploadError(err?.message || 'Error subiendo el video');
      setUploadedName('');
    } finally {
      setUploading(false);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelected(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelected(file);
  };

  const clearUploadedVideo = async () => {
    if (content.videoUrl && content.videoSource === 'direct') {
      try {
        await fileUploadService.deleteFile(content.videoUrl);
      } catch {
        // best-effort cleanup
      }
    }
    onChange({ ...content, videoUrl: '', videoSource: '' });
    setUploadedName('');
    setUploadProgress(0);
    setUploadError('');
  };

  const isDirectUploaded = content.videoSource === 'direct' && !!content.videoUrl;

  return (
    <div className="space-y-6">
      {/* Mode toggle: URL vs Upload */}
      <div className="inline-flex rounded-md border border-gray-200 bg-gray-50 p-1">
        <button
          type="button"
          onClick={() => setMode('url')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            mode === 'url' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Link2 className="w-4 h-4" />
          Usar URL
        </button>
        <button
          type="button"
          onClick={() => setMode('upload')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            mode === 'upload' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <FileVideo className="w-4 h-4" />
          Subir archivo
        </button>
      </div>

      {mode === 'url' ? (
        <div>
          <Label htmlFor="videoUrl">URL del Video *</Label>
          <div className="flex gap-2 mt-1">
            <Input
              id="videoUrl"
              value={content.videoUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=... o URL directa de video"
              className="flex-1"
            />
            {content.videoUrl && (
              <button
                onClick={() => setShowPreview(!showPreview)}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  showPreview
                    ? 'bg-red-100 text-red-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Video className="w-4 h-4" />
              </button>
            )}
          </div>

          {content.videoSource && (
            <div className="flex items-center gap-2 mt-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                content.videoSource === 'youtube' ? 'bg-red-100 text-red-700' :
                content.videoSource === 'vimeo' ? 'bg-blue-100 text-blue-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {content.videoSource === 'youtube' ? 'YouTube' :
                 content.videoSource === 'vimeo' ? 'Vimeo' : 'Video directo'}
              </span>
              <a
                href={content.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-red-600 hover:underline inline-flex items-center gap-1"
              >
                Abrir en nueva pestaña <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>
      ) : (
        <div>
          <Label>Subir archivo de video *</Label>
          <p className="text-sm text-gray-500 mb-2">
            Formatos: {VIDEO_EXTENSIONS.join(', ')} · Maximo {MAX_VIDEO_SIZE_MB}MB
          </p>

          {isDirectUploaded && !uploading ? (
            <div className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg">
              <FileVideo className="w-5 h-5 text-red-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 truncate">
                  {uploadedName || content.videoUrl.split('/').pop() || 'Video subido'}
                </p>
                <p className="text-xs text-gray-400 truncate">{content.videoUrl}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  showPreview ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Video className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={clearUploadedVideo}
                className="text-gray-400 hover:text-red-500 transition-colors"
                title="Quitar video"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div
              onDragOver={(e) => { e.preventDefault(); if (!uploading) setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={`
                border-2 border-dashed rounded-lg p-6 text-center transition-colors
                ${uploading ? 'border-gray-200 bg-gray-50 cursor-wait' : 'cursor-pointer'}
                ${dragOver ? 'border-red-400 bg-red-50' : 'border-gray-300 hover:border-gray-400'}
              `}
            >
              <Upload className={`w-8 h-8 mx-auto mb-2 ${dragOver ? 'text-red-500' : 'text-gray-400'}`} />
              <p className="text-sm text-gray-600">
                {uploading
                  ? `Subiendo ${uploadedName}... ${uploadProgress}%`
                  : <>Arrastra tu video aqui o <span className="text-red-600 font-medium">haz clic para seleccionar</span></>
                }
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {VIDEO_EXTENSIONS.join(', ')} · hasta {MAX_VIDEO_SIZE_MB}MB
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept={VIDEO_ACCEPT}
                onChange={handleFileInput}
                className="hidden"
                disabled={uploading}
              />
            </div>
          )}

          {uploading && (
            <div className="mt-3 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-500 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}

          {uploadError && (
            <div className="mt-3 flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-md p-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span className="flex-1">{uploadError}</span>
              <button type="button" onClick={() => setUploadError('')}>
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Video preview */}
      {showPreview && content.videoUrl && (
        <div className="rounded-lg overflow-hidden border border-gray-200">
          <VideoPlayer
            url={content.videoUrl}
            title="Vista previa"
          />
        </div>
      )}

      {/* Rich text content */}
      <div>
        <Label>Contenido Complementario</Label>
        <p className="text-sm text-gray-500 mb-2">
          Texto, notas o material adicional que acompaña al video
        </p>
        <RichTextEditor
          content={content.textContent}
          onChange={(html) => onChange({ ...content, textContent: html })}
          placeholder="Agrega notas, transcripcion o material complementario..."
          className="min-h-[200px]"
        />
      </div>
    </div>
  );
}
