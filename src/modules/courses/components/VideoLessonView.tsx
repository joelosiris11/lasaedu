import VideoPlayer from '@shared/components/media/VideoPlayer';
import type { DBLesson } from '@shared/services/dataService';

interface VideoLessonViewProps {
  lesson: DBLesson;
  onProgress?: (progress: number) => void;
  onComplete?: () => void;
}

interface VideoLessonContent {
  videoUrl: string;
  videoSource: string;
  textContent: string;
}

function parseVideoContent(lesson: DBLesson): { videoUrl: string; textContent: string } {
  // Try to parse structured content
  try {
    const parsed: VideoLessonContent = typeof lesson.content === 'string'
      ? JSON.parse(lesson.content)
      : lesson.content;

    if (parsed && parsed.videoUrl) {
      return { videoUrl: parsed.videoUrl, textContent: parsed.textContent || '' };
    }
  } catch {
    // Not JSON, fall through
  }

  // Backward compatibility: lesson.videoUrl or raw content as URL
  return {
    videoUrl: lesson.videoUrl || (typeof lesson.content === 'string' ? lesson.content : ''),
    textContent: '',
  };
}

export default function VideoLessonView({ lesson, onProgress, onComplete }: VideoLessonViewProps) {
  const { videoUrl, textContent } = parseVideoContent(lesson);

  return (
    <div>
      {videoUrl && (
        <VideoPlayer
          url={videoUrl}
          title={lesson.title}
          onProgress={onProgress}
          onComplete={onComplete}
          completionThreshold={90}
        />
      )}

      {textContent && (
        <div className="p-6 prose prose-blue max-w-none border-t border-gray-100">
          <div dangerouslySetInnerHTML={{ __html: textContent }} />
        </div>
      )}
    </div>
  );
}
