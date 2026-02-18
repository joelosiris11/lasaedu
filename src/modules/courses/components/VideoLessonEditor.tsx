import { useState, useEffect } from 'react';
import { Video, ExternalLink } from 'lucide-react';
import { Input } from '@shared/components/ui/Input';
import { Label } from '@shared/components/ui/Label';
import { RichTextEditor } from '@shared/components/editor';
import VideoPlayer from '@shared/components/media/VideoPlayer';

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
}

function detectVideoSource(url: string): 'youtube' | 'vimeo' | 'direct' | '' {
  if (!url) return '';
  if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube';
  if (/vimeo\.com/i.test(url)) return 'vimeo';
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) return 'direct';
  return 'direct';
}

export default function VideoLessonEditor({ content, onChange }: VideoLessonEditorProps) {
  const [showPreview, setShowPreview] = useState(false);

  const handleUrlChange = (url: string) => {
    const source = detectVideoSource(url);
    onChange({ ...content, videoUrl: url, videoSource: source });
  };

  // Auto-detect source when URL changes
  useEffect(() => {
    if (content.videoUrl && !content.videoSource) {
      const source = detectVideoSource(content.videoUrl);
      if (source) {
        onChange({ ...content, videoSource: source });
      }
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Video URL input */}
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
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Video className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Source badge */}
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
              className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
            >
              Abrir en nueva pestaña <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>

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
