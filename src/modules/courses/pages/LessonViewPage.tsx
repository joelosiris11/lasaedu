import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@app/store/authStore';
import {
  courseService,
  moduleService,
  lessonService,
  legacyEnrollmentService as enrollmentService,
  userService,
  taskSubmissionService,
  sectionService,
  type DBCourse,
  type DBModule,
  type DBLesson,
  type DBEnrollment,
  type DBTaskSubmission,
  type DBUser,
  type DBSectionLessonOverride,
} from '@shared/services/dataService';
import { firebaseDB } from '@shared/services/firebaseDataService';
import type { DBEvaluationAttempt } from '@shared/services/firebaseDataService';
import { isAvailable, resolveDeadlines } from '@shared/utils/deadlines';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Clock,
  BookOpen,
  Video,
  FileText,
  File,
  HelpCircle,
  Trophy,
  MessageSquare,
  Download,
  Users,
  Circle,
  X,
  Loader2,
} from 'lucide-react';
import { Button } from '@shared/components/ui/Button';
import { Card, CardContent } from '@shared/components/ui/Card';
import LessonForumView from '../components/LessonForumView';
import QuizLessonView from '../components/QuizLessonView';
import VideoLessonView from '../components/VideoLessonView';
import TareaLessonView from '../components/TareaLessonView';
import SubmissionReviewView from '../components/SubmissionReviewView';
import StudentLessonDetail from '../components/StudentLessonDetail';
import type { ResourceLessonContent } from '../components/ResourceLessonEditor';
import type { TareaLessonContent } from '../components/TareaLessonEditor';

interface ModuleWithLessons extends DBModule {
  lessons: DBLesson[];
}

type StudentLessonStatus = 'completed' | 'in_progress' | 'not_started';

interface StudentLessonData {
  userId: string;
  userName: string;
  status: StudentLessonStatus;
  enrollment: DBEnrollment;
  // tarea
  submission?: DBTaskSubmission;
  // quiz
  attempts?: DBEvaluationAttempt[];
  bestScore?: number;
}

export default function LessonViewPage() {
  const { courseId, lessonId, sectionId } = useParams<{ courseId: string; lessonId: string; sectionId?: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [course, setCourse] = useState<DBCourse | null>(null);
  const [modules, setModules] = useState<ModuleWithLessons[]>([]);
  const [currentLesson, setCurrentLesson] = useState<DBLesson | null>(null);
  const [enrollment, setEnrollment] = useState<DBEnrollment | null>(null);
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [sectionOverride, setSectionOverride] = useState<DBSectionLessonOverride | null>(null);
  const [effectiveCourseId, setEffectiveCourseId] = useState<string | undefined>(courseId);

  // Teacher panel state
  const isTeacherOrAdmin = user?.role === 'teacher' || user?.role === 'admin';
  const [showStudentPanel, setShowStudentPanel] = useState(false);
  const [studentData, setStudentData] = useState<StudentLessonData[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [reviewingSubmission, setReviewingSubmission] = useState<DBTaskSubmission | null>(null);
  const [expandedQuizStudent, setExpandedQuizStudent] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<{ id: string; name: string } | null>(null);

  // Time tracking refs
  const lessonStartTime = useRef<number>(Date.now());
  const enrollmentRef = useRef<DBEnrollment | null>(null);

  // Keep enrollmentRef in sync
  useEffect(() => {
    enrollmentRef.current = enrollment;
  }, [enrollment]);

  const saveTimeSpent = useCallback(async () => {
    const enr = enrollmentRef.current;
    if (!enr) return;

    const elapsed = Date.now() - lessonStartTime.current;
    const minutes = Math.floor(elapsed / 60000);
    if (minutes < 1) return; // threshold: at least 1 minute

    const newTotal = (enr.totalTimeSpent || 0) + minutes;
    try {
      await enrollmentService.update(enr.id, { totalTimeSpent: newTotal } as any);
      // Update local state so subsequent saves are cumulative
      enrollmentRef.current = { ...enr, totalTimeSpent: newTotal };
      setEnrollment(prev => prev ? { ...prev, totalTimeSpent: newTotal } : prev);
    } catch (e) {
      console.error('Error saving time spent:', e);
    }
    // Reset timer
    lessonStartTime.current = Date.now();
  }, []);

  // Visibility change & beforeunload listeners
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        saveTimeSpent();
      } else {
        // Reset timer when returning
        lessonStartTime.current = Date.now();
      }
    };

    const handleBeforeUnload = () => {
      // Use sendBeacon-style sync save: best-effort with navigator.sendBeacon not available for firestore,
      // so just fire and forget the async call
      saveTimeSpent();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Save time on unmount
      saveTimeSpent();
    };
  }, [saveTimeSpent]);

  useEffect(() => {
    if (courseId || sectionId) {
      loadData();
    }
  }, [courseId, lessonId, sectionId]);

  const loadData = async () => {
    setLoading(true);

    // If accessed via /sections/:sectionId/lesson/:lessonId, resolve courseId from section
    let resolvedCourseId = courseId;
    if (!resolvedCourseId && sectionId) {
      const sec = await sectionService.getById(sectionId);
      if (sec) resolvedCourseId = sec.courseId;
    }
    if (!resolvedCourseId) return;
    setEffectiveCourseId(resolvedCourseId);

    try {
      // Load section overrides for this lesson if sectionId is present
      if (sectionId && lessonId) {
        const overrides = await sectionService.getLessonOverrides(sectionId);
        const override = overrides.find(o => o.lessonId === lessonId) || null;
        setSectionOverride(override);
      }

      // Cargar curso
      const courseData = await courseService.getById(resolvedCourseId);
      setCourse(courseData);

      // Cargar módulos con lecciones
      const courseModules = await moduleService.getByCourse(resolvedCourseId);
      const sortedModules = courseModules.sort((a, b) => a.order - b.order);
      
      const allModulesWithLessons: ModuleWithLessons[] = await Promise.all(
        sortedModules.map(async (module) => {
          const lessons = await lessonService.getByModule(module.id);
          return {
            ...module,
            lessons: lessons.sort((a, b) => a.order - b.order)
          };
        })
      );

      // Para estudiantes: filtrar módulos y lecciones no disponibles aún
      const isStudent = user?.role === 'student';
      const modulesWithLessons = isStudent
        ? allModulesWithLessons
            .filter(m => isAvailable(m.availableFrom))
            .map(m => ({
              ...m,
              lessons: m.lessons.filter(l => isAvailable(l.settings?.availableFrom))
            }))
        : allModulesWithLessons;

      setModules(modulesWithLessons);

      // Cargar inscripción del usuario
      if (user?.id) {
        const userEnrollments = await enrollmentService.getAll();
        const userEnrollment = userEnrollments.find((e: any) => e.userId === user.id && e.courseId === resolvedCourseId) as DBEnrollment;
        if (userEnrollment) {
          setEnrollment(userEnrollment);
          setCompletedLessons(new Set(userEnrollment.completedLessons || []));
        }
      }

      // Seleccionar lección actual o la primera
      if (lessonId) {
        const allLessons = modulesWithLessons.flatMap(m => m.lessons);
        const lesson = allLessons.find(l => l.id === lessonId);
        setCurrentLesson(lesson || null);
      } else if (modulesWithLessons.length > 0 && modulesWithLessons[0].lessons.length > 0) {
        setCurrentLesson(modulesWithLessons[0].lessons[0]);
      }
    } catch (error) {
      console.error('Error loading lesson data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load student data for teacher panel
  const loadStudentData = useCallback(async (targetLessonId: string) => {
    if (!effectiveCourseId || !isTeacherOrAdmin) return;
    setLoadingStudents(true);
    try {
      const [courseEnrollments, allUsers] = await Promise.all([
        enrollmentService.getByCourse(effectiveCourseId),
        userService.getAll(),
      ]);

      const userMap = new Map<string, DBUser>();
      for (const u of allUsers) userMap.set(u.id, u);

      // Get the current lesson to determine type
      const allLessons = modules.flatMap((m) => m.lessons);
      const targetLesson = allLessons.find((l) => l.id === targetLessonId);
      const lessonType = targetLesson?.type;

      let submissionsMap = new Map<string, DBTaskSubmission>();
      let attemptsMap = new Map<string, DBEvaluationAttempt[]>();

      if (lessonType === 'tarea') {
        const submissions = await taskSubmissionService.getByLesson(targetLessonId);
        for (const s of submissions) submissionsMap.set(s.studentId, s);
      } else if (lessonType === 'quiz') {
        const attempts = await firebaseDB.getAttemptsByEvaluation(targetLessonId);
        for (const a of attempts) {
          const existing = attemptsMap.get(a.userId) || [];
          existing.push(a);
          attemptsMap.set(a.userId, existing);
        }
      }

      const rows: StudentLessonData[] = courseEnrollments
        .filter((e: DBEnrollment) => {
          const u = userMap.get(e.userId);
          return u && u.role === 'student';
        })
        .map((enrollment: DBEnrollment) => {
          const u = userMap.get(enrollment.userId);
          const completedLessons = enrollment.completedLessons || [];
          const isCompleted = completedLessons.includes(targetLessonId);

          let status: StudentLessonStatus;
          if (isCompleted) {
            status = 'completed';
          } else if (enrollment.lastAccessedAt && (enrollment.progress || 0) > 0) {
            status = 'in_progress';
          } else {
            status = 'not_started';
          }

          const row: StudentLessonData = {
            userId: enrollment.userId,
            userName: u?.name || 'Usuario desconocido',
            status,
            enrollment,
          };

          if (lessonType === 'tarea') {
            row.submission = submissionsMap.get(enrollment.userId);
          } else if (lessonType === 'quiz') {
            const userAttempts = attemptsMap.get(enrollment.userId) || [];
            row.attempts = userAttempts.sort((a, b) => b.percentage - a.percentage);
            row.bestScore =
              userAttempts.length > 0
                ? Math.max(...userAttempts.map((a) => a.percentage))
                : undefined;
          }

          return row;
        });

      // Sort: completed first, in_progress, not_started
      const order: Record<StudentLessonStatus, number> = {
        completed: 0,
        in_progress: 1,
        not_started: 2,
      };
      rows.sort((a, b) => order[a.status] - order[b.status]);

      setStudentData(rows);
    } catch (err) {
      console.error('Error loading student data:', err);
    } finally {
      setLoadingStudents(false);
    }
  }, [effectiveCourseId, isTeacherOrAdmin, modules]);

  // Load student data when teacher and lesson changes
  useEffect(() => {
    if (isTeacherOrAdmin && currentLesson && modules.length > 0) {
      loadStudentData(currentLesson.id);
    }
  }, [isTeacherOrAdmin, currentLesson?.id, modules.length, loadStudentData]);

  const selectLesson = (lesson: DBLesson) => {
    saveTimeSpent();
    setSelectedStudent(null);
    setCurrentLesson(lesson);
    if (sectionId) {
      navigate(`/sections/${sectionId}/lesson/${lesson.id}`, { replace: true });
    } else {
      navigate(`/courses/${effectiveCourseId}/lesson/${lesson.id}`, { replace: true });
    }
  };

  const handleLessonComplete = async () => {
    if (!currentLesson || !enrollment || !user) return;
    
    // Verificar si ya está completada
    if (completedLessons.has(currentLesson.id)) return;

    try {
      // Actualizar inscripción con lección completada
      const newCompletedLessons = [...(enrollment.completedLessons || []), currentLesson.id];
      const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0);
      const newProgress = Math.round((newCompletedLessons.length / totalLessons) * 100);

      await enrollmentService.update(enrollment.id, {
        completedLessons: newCompletedLessons,
        progress: newProgress,
        lastLessonId: currentLesson.id,
        lastAccessedAt: new Date().toISOString(),
        lastUpdated: Date.now()
      } as any); // Type cast to avoid type mismatch issues

      setCompletedLessons(prev => new Set([...prev, currentLesson.id]));
      setShowCompletionModal(true);

    } catch (error) {
      console.error('Error completing lesson:', error);
    }
  };

  const handleVideoComplete = () => {
    handleLessonComplete();
  };

  const handleVideoProgress = (progress: number) => {
    // Guardar progreso del video (opcional)
    console.log('Video progress:', progress);
  };

  const getNextLesson = (): DBLesson | null => {
    if (!currentLesson) return null;
    const allLessons = modules.flatMap(m => m.lessons);
    const currentIndex = allLessons.findIndex(l => l.id === currentLesson.id);
    return allLessons[currentIndex + 1] || null;
  };

  const getPrevLesson = (): DBLesson | null => {
    if (!currentLesson) return null;
    const allLessons = modules.flatMap(m => m.lessons);
    const currentIndex = allLessons.findIndex(l => l.id === currentLesson.id);
    return allLessons[currentIndex - 1] || null;
  };

  const goToNextLesson = () => {
    const next = getNextLesson();
    if (next) selectLesson(next);
  };

  const goToPrevLesson = () => {
    const prev = getPrevLesson();
    if (prev) selectLesson(prev);
  };

  const getLessonIcon = (type: string, isCompleted: boolean) => {
    const iconClass = `h-4 w-4 ${isCompleted ? 'text-red-500' : 'text-gray-400'}`;
    
    switch (type) {
      case 'video':
        return <Video className={iconClass} />;
      case 'texto':
        return <FileText className={iconClass} />;
      case 'recurso':
        return <File className={iconClass} />;
      case 'quiz':
        return <HelpCircle className={iconClass} />;
      case 'foro':
        return <MessageSquare className={iconClass} />;
      default:
        return <FileText className={iconClass} />;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-[100dvh]">
        {/* Skeleton top bar */}
        <div className="bg-white border-b border-gray-200 pl-[4.5rem] md:pl-6 pr-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-40 bg-gray-200 rounded animate-pulse hidden sm:block" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-4 w-10 bg-gray-200 rounded animate-pulse" />
            <div className="w-24 h-2 bg-gray-200 rounded-full animate-pulse" />
          </div>
        </div>
        {/* Skeleton content */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
          <div className="max-w-4xl mx-auto p-4 md:p-6">
            <div className="bg-white rounded-lg border shadow-sm p-6 space-y-4">
              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
              <div className="h-7 w-3/4 bg-gray-200 rounded animate-pulse" />
              <div className="h-px bg-gray-100 my-4" />
              <div className="space-y-3">
                <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
                <div className="h-4 w-5/6 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 w-4/6 bg-gray-200 rounded animate-pulse" />
                <div className="h-24 w-full bg-gray-100 rounded animate-pulse" />
                <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
                <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!course || !currentLesson) {
    return (
      <div className="text-center py-12">
        <BookOpen className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900">Lección no encontrada</h2>
        <Button onClick={() => navigate(sectionId ? `/sections/${sectionId}` : `/courses/${effectiveCourseId}`)} className="mt-4">
          Volver al curso
        </Button>
      </div>
    );
  }

  const isLessonCompleted = completedLessons.has(currentLesson.id);
  const nextLesson = getNextLesson();
  const prevLesson = getPrevLesson();

  // Helper: get tarea totalPoints from lesson content
  const getTareaTotalPoints = (): number => {
    try {
      const parsed: TareaLessonContent =
        typeof currentLesson.content === 'string'
          ? JSON.parse(currentLesson.content)
          : currentLesson.content;
      return parsed?.totalPoints || 100;
    } catch {
      return 100;
    }
  };

  // Helper to get status icon for student panel
  const getStudentStatusIcon = (status: StudentLessonStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-yellow-500 flex-shrink-0" />;
      case 'not_started':
        return <Circle className="h-4 w-4 text-gray-400 flex-shrink-0" />;
    }
  };

  const getStudentStatusLabel = (status: StudentLessonStatus) => {
    switch (status) {
      case 'completed':
        return 'Completado';
      case 'in_progress':
        return 'En progreso';
      case 'not_started':
        return 'No iniciado';
    }
  };

  // Submissions list for SubmissionReviewView navigation
  const allTareaSubmissions = studentData
    .filter((s) => s.submission)
    .map((s) => s.submission!);

  // If teacher is reviewing a submission, show the review view
  if (reviewingSubmission) {
    return (
      <SubmissionReviewView
        submission={reviewingSubmission}
        lessonTitle={currentLesson.title}
        totalPoints={getTareaTotalPoints()}
        teacherId={user?.id || ''}
        allSubmissions={allTareaSubmissions}
        onClose={() => setReviewingSubmission(null)}
        onGraded={() => {
          if (currentLesson) loadStudentData(currentLesson.id);
        }}
      />
    );
  }

  // Render teacher student panel content
  const renderStudentPanel = () => {
    if (loadingStudents) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 text-red-600 animate-spin" />
        </div>
      );
    }

    if (studentData.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500 text-sm">
          No hay estudiantes inscritos.
        </div>
      );
    }

    const completedCount = studentData.filter((s) => s.status === 'completed').length;

    return (
      <>
        {/* Summary */}
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">{studentData.length} estudiantes</span>
            <span className="text-green-600 font-medium">
              {completedCount} completaron
            </span>
          </div>
        </div>

        {/* Student list */}
        <div className="overflow-y-auto flex-1">
          {studentData.map((student) => (
            <div key={student.userId}>
              <button
                onClick={() => setSelectedStudent({ id: student.userId, name: student.userName })}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 cursor-pointer"
              >
                {/* Avatar initial */}
                <div className="w-8 h-8 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {student.userName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {student.userName}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {getStudentStatusIcon(student.status)}
                    <span
                      className={`text-xs ${
                        student.status === 'completed'
                          ? 'text-green-600'
                          : student.status === 'in_progress'
                          ? 'text-yellow-600'
                          : 'text-gray-400'
                      }`}
                    >
                      {getStudentStatusLabel(student.status)}
                    </span>
                  </div>
                </div>

                {/* Tarea badge */}
                {currentLesson.type === 'tarea' && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                      student.submission?.status === 'graded'
                        ? 'bg-green-100 text-green-700'
                        : student.submission?.status === 'submitted'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {student.submission?.status === 'graded'
                      ? `${student.submission.grade?.score ?? '-'}/${student.submission.grade?.maxScore ?? '-'}`
                      : student.submission?.status === 'submitted'
                      ? 'Pendiente'
                      : 'Sin entregar'}
                  </span>
                )}

                {/* Quiz badge */}
                {currentLesson.type === 'quiz' && (
                  <>
                    {student.bestScore !== undefined ? (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full flex-shrink-0">
                        {student.bestScore}%
                      </span>
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full flex-shrink-0">
                        Sin intentos
                      </span>
                    )}
                  </>
                )}
              </button>

              {/* Expanded quiz attempts */}
              {currentLesson.type === 'quiz' &&
                expandedQuizStudent === student.userId &&
                student.attempts &&
                student.attempts.length > 0 && (
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 space-y-1.5">
                    {student.attempts.map((attempt, idx) => (
                      <div
                        key={attempt.id}
                        className="flex items-center justify-between text-xs bg-white rounded p-2 border"
                      >
                        <span className="text-gray-600">
                          Intento {idx + 1}
                        </span>
                        <span
                          className={`font-medium ${
                            attempt.passed ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {attempt.percentage}% ({attempt.score}/{attempt.maxScore})
                        </span>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          ))}
        </div>
      </>
    );
  };

  const renderContentBlocks = (blocks: any[]) => {
    // Skip the first heading if it matches the lesson title (avoid duplicate)
    const sorted = blocks.sort((a: any, b: any) => a.order - b.order);
    const filtered = sorted.filter((block: any, idx: number) => {
      if (idx === 0 && block.type === 'heading' && block.metadata?.level === 1) return false;
      return true;
    });

    return (
    <div className="space-y-4">
      {filtered.map((block: any) => {
        switch (block.type) {
          case 'heading': {
            const level = block.metadata?.level || 2;
            if (level === 1) return <h1 key={block.id} className="text-2xl font-bold">{block.content}</h1>;
            if (level === 2) return <h2 key={block.id} className="text-xl font-semibold">{block.content}</h2>;
            return <h3 key={block.id} className="text-lg font-medium">{block.content}</h3>;
          }
          case 'text':
            return <p key={block.id} className="text-gray-700 leading-relaxed whitespace-pre-line">{block.content}</p>;
          case 'code':
            return (
              <pre key={block.id} className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto text-sm">
                <code>{block.content}</code>
              </pre>
            );
          case 'quote':
            return <blockquote key={block.id} className="border-l-4 border-red-300 pl-4 italic text-gray-600">{block.content}</blockquote>;
          default:
            return null;
        }
      })}
    </div>
    );
  };

  // Shared lesson content renderer
  const renderLessonContent = () => (
    <Card className="mb-6">
      {/* Title inside the card */}
      <div className="p-6 pb-0">
        <div className="flex items-center text-sm text-gray-500 mb-2">
          {getLessonIcon(currentLesson.type, isLessonCompleted)}
          <span className="ml-2 capitalize">{currentLesson.type}</span>
          <span className="mx-2">•</span>
          <Clock className="h-4 w-4 mr-1" />
          <span>{currentLesson.duration} min</span>
          {isLessonCompleted && (
            <>
              <span className="mx-2">•</span>
              <CheckCircle className="h-4 w-4 mr-1 text-red-500" />
              <span className="text-red-600">Completada</span>
            </>
          )}
        </div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">{currentLesson.title}</h1>
      </div>

      <CardContent className="p-0 mt-4">
        {currentLesson.type === 'video' ? (
          <VideoLessonView
            lesson={currentLesson}
            onProgress={handleVideoProgress}
            onComplete={handleVideoComplete}
          />
        ) : currentLesson.type === 'texto' ? (
          <div className="p-6 prose prose-red max-w-none">
            {(() => {
              let html = '';
              try {
                const parsed = typeof currentLesson.content === 'string'
                  ? JSON.parse(currentLesson.content) : currentLesson.content;
                if (Array.isArray(parsed)) {
                  return renderContentBlocks(parsed);
                }
                if (parsed?.editorMode === 'wysiwyg') {
                  html = parsed.html || '';
                } else if (typeof currentLesson.content === 'string') {
                  html = currentLesson.content;
                }
              } catch {
                html = typeof currentLesson.content === 'string' ? currentLesson.content : '';
              }
              return html ? (
                <div dangerouslySetInnerHTML={{ __html: html }} />
              ) : (
                <p className="text-gray-500">No hay contenido disponible para esta leccion.</p>
              );
            })()}
          </div>
        ) : currentLesson.type === 'recurso' ? (
          <div className="p-6">
            {(() => {
              let resourceContent: ResourceLessonContent | null = null;
              try {
                const parsed = typeof currentLesson.content === 'string'
                  ? JSON.parse(currentLesson.content) : currentLesson.content;
                if (Array.isArray(parsed)) {
                  return renderContentBlocks(parsed);
                }
                if (parsed?.textContent !== undefined) resourceContent = parsed;
              } catch { /* ignore */ }

              if (!resourceContent) {
                return (
                  <div className="text-center text-gray-500">
                    <File className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                    <p>No hay contenido disponible.</p>
                  </div>
                );
              }
              return (
                <div className="space-y-6">
                  {resourceContent.textContent && (
                    <div className="prose prose-red max-w-none"
                      dangerouslySetInnerHTML={{ __html: resourceContent.textContent }}
                    />
                  )}
                  {resourceContent.files.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Archivos Adjuntos</h4>
                      <div className="space-y-2">
                        {resourceContent.files.map(file => (
                          <a
                            key={file.id}
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            <FileText className="w-5 h-5 text-red-500 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-700 truncate">{file.name}</p>
                              <p className="text-xs text-gray-400">
                                {file.size ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : ''}
                              </p>
                            </div>
                            <Download className="w-4 h-4 text-gray-400" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        ) : currentLesson.type === 'tarea' ? (
          <TareaLessonView
            lesson={currentLesson}
            courseId={effectiveCourseId || course?.id || ''}
            userId={user?.id || ''}
            userName={user?.name || ''}
            userRole={user?.role || 'student'}
            onComplete={handleLessonComplete}
            sectionOverride={sectionOverride}
          />
        ) : currentLesson.type === 'quiz' ? (
          <QuizLessonView
            lesson={currentLesson}
            onComplete={handleLessonComplete}
            userId={user?.id}
            courseId={effectiveCourseId || course?.id}
            readOnly={isTeacherOrAdmin}
            sectionOverride={sectionOverride}
          />
        ) : currentLesson.type === 'foro' ? (
          <LessonForumView
            lesson={currentLesson}
            courseId={effectiveCourseId || ''}
            userId={user?.id || ''}
            userName={user?.name || ''}
            userRole={user?.role || 'student'}
            onParticipated={handleLessonComplete}
          />
        ) : (
          <div className="p-6">
            <div className="bg-gray-100 rounded-lg p-6 text-center">
              <File className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Contenido de tipo: {currentLesson.type}</p>
            </div>
          </div>
        )}
        {/* Mark as complete - only for students */}
        {!isTeacherOrAdmin && !isLessonCompleted && currentLesson.type !== 'video' && currentLesson.type !== 'foro' && currentLesson.type !== 'quiz' && currentLesson.type !== 'tarea' && (
          <div className="p-6 pt-2 text-center border-t border-gray-100 mt-4">
            <Button
              onClick={handleLessonComplete}
              className="bg-red-600 hover:bg-red-700"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Marcar como completada
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col h-[100dvh]">
      {/* Top bar - replaces main header */}
      <div className="bg-white border-b border-gray-200 pl-[4.5rem] md:pl-6 pr-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(sectionId ? `/sections/${sectionId}` : `/courses/${effectiveCourseId}`)}
          >
            <ArrowLeft className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Volver a modulos</span>
          </Button>
          <span className="text-sm font-medium text-gray-600 hidden md:block truncate max-w-[200px] lg:max-w-none">{course.title}</span>
        </div>
        <div className="flex items-center gap-3">
          {!isTeacherOrAdmin && (
            <>
              <span className="text-sm text-gray-500">{enrollment?.progress || 0}%</span>
              <div className="w-20 sm:w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 transition-all duration-300"
                  style={{ width: `${enrollment?.progress || 0}%` }}
                />
              </div>
            </>
          )}
          {isTeacherOrAdmin && (
            <span className="text-xs text-gray-500 hidden lg:inline">
              Vista de profesor
            </span>
          )}
        </div>
      </div>

      {/* Main body with optional side panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Content area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto bg-gray-50">
            <div className={`mx-auto p-4 md:p-6 pb-24 md:pb-6 ${isTeacherOrAdmin ? 'max-w-4xl' : 'max-w-4xl'}`}>
              {renderLessonContent()}
            </div>
          </div>

          {/* Sticky bottom navigation */}
          <div className="flex-shrink-0 bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPrevLesson}
              disabled={!prevLesson}
            >
              <ArrowLeft className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Anterior</span>
            </Button>

            <Button
              size="sm"
              onClick={goToNextLesson}
              disabled={!nextLesson}
            >
              <span className="hidden sm:inline">Siguiente</span>
              <ArrowRight className="h-4 w-4 sm:ml-2" />
            </Button>
          </div>
        </div>

        {/* Desktop student panel (teacher only) */}
        {isTeacherOrAdmin && (
          <div className="hidden lg:flex w-80 flex-col border-l border-gray-200 bg-white flex-shrink-0">
            {selectedStudent ? (
              <StudentLessonDetail
                studentId={selectedStudent.id}
                studentName={selectedStudent.name}
                courseId={effectiveCourseId || ''}
                lessonId={currentLesson.id}
                lessonTitle={currentLesson.title}
                lessonType={currentLesson.type}
                teacherId={user?.id || ''}
                onBack={() => setSelectedStudent(null)}
              />
            ) : (
              <>
                <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
                  <Users className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-semibold text-gray-900">Estudiantes</span>
                </div>
                {renderStudentPanel()}
              </>
            )}
          </div>
        )}
      </div>

      {/* Mobile floating button (teacher only) */}
      {isTeacherOrAdmin && (
        <button
          onClick={() => setShowStudentPanel(true)}
          className="lg:hidden fixed bottom-20 right-4 z-40 flex items-center gap-2 bg-red-600 text-white px-4 py-2.5 rounded-full shadow-lg hover:bg-red-700 transition-colors"
        >
          <Users className="h-4 w-4" />
          <span className="text-sm font-medium">
            Estudiantes ({studentData.length})
          </span>
        </button>
      )}

      {/* Mobile student panel slide-up (teacher only) */}
      {isTeacherOrAdmin && showStudentPanel && (
        <div className="lg:hidden fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowStudentPanel(false)}
          />
          {/* Panel */}
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[80vh] flex flex-col animate-slide-up">
            {/* Handle */}
            <div className="flex items-center justify-center py-2">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>
            {selectedStudent ? (
              <StudentLessonDetail
                studentId={selectedStudent.id}
                studentName={selectedStudent.name}
                courseId={effectiveCourseId || ''}
                lessonId={currentLesson.id}
                lessonTitle={currentLesson.title}
                lessonType={currentLesson.type}
                teacherId={user?.id || ''}
                onBack={() => setSelectedStudent(null)}
              />
            ) : (
              <>
                <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-red-600" />
                    <span className="text-sm font-semibold text-gray-900">Estudiantes</span>
                  </div>
                  <button
                    onClick={() => setShowStudentPanel(false)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {renderStudentPanel()}
              </>
            )}
          </div>
        </div>
      )}

      {/* Completion Modal */}
      {showCompletionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4 animate-bounce-in">
            <CardContent className="p-8 text-center">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trophy className="h-10 w-10 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Leccion Completada!</h2>
              <p className="text-gray-600 mb-4">Has completado "{currentLesson.title}"</p>

              <div className="flex space-x-3 mt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowCompletionModal(false)}
                >
                  Cerrar
                </Button>
                {nextLesson && (
                  <Button
                    className="flex-1"
                    onClick={() => {
                      setShowCompletionModal(false);
                      goToNextLesson();
                    }}
                  >
                    Siguiente leccion
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
