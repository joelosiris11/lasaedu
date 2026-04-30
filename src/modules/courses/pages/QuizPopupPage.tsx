import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuthStore } from '@app/store/authStore';
import {
  lessonService,
  sectionService,
  type DBLesson,
  type DBSectionLessonOverride,
} from '@shared/services/dataService';
import { Loader2 } from 'lucide-react';
import QuizLessonView from '../components/QuizLessonView';

/**
 * Standalone page for quiz-taking, rendered in a popup window.
 * No MainLayout (no sidebar, no header) — just the quiz.
 */
export default function QuizPopupPage() {
  const { sectionId, lessonId } = useParams<{ sectionId: string; lessonId: string }>();
  const { user } = useAuthStore();

  const [lesson, setLesson] = useState<DBLesson | null>(null);
  const [courseId, setCourseId] = useState<string | undefined>();
  const [sectionOverride, setSectionOverride] = useState<DBSectionLessonOverride | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!lessonId) return;
    (async () => {
      try {
        // Load lesson
        const lessonData = await lessonService.getById(lessonId);
        if (!lessonData) {
          setError('Quiz no encontrado');
          setLoading(false);
          return;
        }
        setLesson(lessonData);

        // Resolve courseId from section
        if (sectionId) {
          const section = await sectionService.getById(sectionId);
          if (section) setCourseId(section.courseId);

          // Load section override for this lesson
          const overrides = await sectionService.getLessonOverrides(sectionId);
          const override = overrides.find(o => o.lessonId === lessonId) || null;
          setSectionOverride(override);
        } else {
          setCourseId(lessonData.courseId);
        }
      } catch {
        setError('Error cargando el quiz');
      } finally {
        setLoading(false);
      }
    })();
  }, [lessonId, sectionId]);

  const handleComplete = () => {
    // Notify the parent window that the quiz was completed
    if (window.opener) {
      window.opener.postMessage({ type: 'quiz-completed', lessonId }, '*');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-red-600" />
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-white">
        <p className="text-gray-600 mb-4">{error || 'Quiz no encontrado'}</p>
        <button
          onClick={() => window.close()}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Cerrar ventana
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <QuizLessonView
        lesson={lesson}
        onComplete={handleComplete}
        userId={user?.id}
        courseId={courseId}
        sectionId={sectionId}
        sectionOverride={sectionOverride}
        popupMode
      />
    </div>
  );
}
