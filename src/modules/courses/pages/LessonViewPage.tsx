import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@app/store/authStore';
import { 
  courseService, 
  moduleService, 
  lessonService, 
  legacyEnrollmentService as enrollmentService,
  type DBCourse, 
  type DBModule, 
  type DBLesson,
  type DBEnrollment
} from '@shared/services/dataService';
import { gamificationEngine } from '@shared/services/gamificationEngine';
import VideoPlayer from '@shared/components/media/VideoPlayer';
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  Circle,
  Clock,
  BookOpen,
  Video,
  FileText,
  File,
  HelpCircle,
  Trophy,
  MessageSquare
} from 'lucide-react';
import { Button } from '@shared/components/ui/Button';
import { Card, CardContent } from '@shared/components/ui/Card';
import LessonForumView from '../components/LessonForumView';
import QuizLessonView from '../components/QuizLessonView';

interface ModuleWithLessons extends DBModule {
  lessons: DBLesson[];
}

export default function LessonViewPage() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [course, setCourse] = useState<DBCourse | null>(null);
  const [modules, setModules] = useState<ModuleWithLessons[]>([]);
  const [currentLesson, setCurrentLesson] = useState<DBLesson | null>(null);
  const [enrollment, setEnrollment] = useState<DBEnrollment | null>(null);
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [pointsEarned, setPointsEarned] = useState(0);

  useEffect(() => {
    if (courseId) {
      loadData();
    }
  }, [courseId, lessonId]);

  const loadData = async () => {
    if (!courseId) return;
    setLoading(true);
    
    try {
      // Cargar curso
      const courseData = await courseService.getById(courseId);
      setCourse(courseData);

      // Cargar módulos con lecciones
      const courseModules = await moduleService.getByCourse(courseId);
      const sortedModules = courseModules.sort((a, b) => a.order - b.order);
      
      const modulesWithLessons: ModuleWithLessons[] = await Promise.all(
        sortedModules.map(async (module) => {
          const lessons = await lessonService.getByModule(module.id);
          return {
            ...module,
            lessons: lessons.sort((a, b) => a.order - b.order)
          };
        })
      );
      setModules(modulesWithLessons);

      // Cargar inscripción del usuario
      if (user?.id) {
        const userEnrollments = await enrollmentService.getAll();
        const userEnrollment = userEnrollments.find((e: any) => e.userId === user.id && e.courseId === courseId) as DBEnrollment;
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
        
        // Expandir el módulo de la lección actual
        if (lesson) {
          setExpandedModules(new Set([lesson.moduleId]));
        }
      } else if (modulesWithLessons.length > 0 && modulesWithLessons[0].lessons.length > 0) {
        setCurrentLesson(modulesWithLessons[0].lessons[0]);
        setExpandedModules(new Set([modulesWithLessons[0].id]));
      }
    } catch (error) {
      console.error('Error loading lesson data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleModule = (moduleId: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  };

  const selectLesson = (lesson: DBLesson) => {
    setCurrentLesson(lesson);
    navigate(`/courses/${courseId}/lesson/${lesson.id}`, { replace: true });
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

      // Otorgar puntos de gamificación
      const result = await gamificationEngine.onLessonComplete(
        user.id,
        currentLesson.id,
        courseId!,
        user.name
      );

      setPointsEarned(result.pointsAwarded);
      setCompletedLessons(prev => new Set([...prev, currentLesson.id]));
      
      // Mostrar modal de completado
      setShowCompletionModal(true);

      // Verificar si se completó el módulo
      const currentModule = modules.find(m => m.id === currentLesson.moduleId);
      if (currentModule) {
        const moduleLessons = currentModule.lessons.map(l => l.id);
        const completedInModule = newCompletedLessons.filter(id => moduleLessons.includes(id));
        if (completedInModule.length === moduleLessons.length) {
          await gamificationEngine.onModuleComplete(user.id, currentModule.id, courseId!, user.name);
        }
      }

      // Verificar si se completó el curso
      if (newProgress >= 100) {
        await gamificationEngine.onCourseComplete(user.id, courseId!, user.name);
      }

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
    const iconClass = `h-4 w-4 ${isCompleted ? 'text-green-500' : 'text-gray-400'}`;
    
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
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!course || !currentLesson) {
    return (
      <div className="text-center py-12">
        <BookOpen className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900">Lección no encontrada</h2>
        <Button onClick={() => navigate(`/courses/${courseId}`)} className="mt-4">
          Volver al curso
        </Button>
      </div>
    );
  }

  const isLessonCompleted = completedLessons.has(currentLesson.id);
  const nextLesson = getNextLesson();
  const prevLesson = getPrevLesson();

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar - Lista de lecciones */}
      <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto">
        <div className="p-4 border-b border-gray-200">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate(`/courses/${courseId}`)}
            className="mb-3"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver al curso
          </Button>
          <h2 className="font-semibold text-gray-900">{course.title}</h2>
          <div className="flex items-center mt-2 text-sm text-gray-500">
            <Clock className="h-4 w-4 mr-1" />
            <span>{enrollment?.progress || 0}% completado</span>
          </div>
          {/* Progress bar */}
          <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${enrollment?.progress || 0}%` }}
            />
          </div>
        </div>

        {/* Módulos y lecciones */}
        <div className="divide-y divide-gray-100">
          {modules.map(module => (
            <div key={module.id}>
              <button
                onClick={() => toggleModule(module.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 text-left"
              >
                <div className="flex items-center">
                  {expandedModules.has(module.id) ? (
                    <ChevronDown className="h-4 w-4 text-gray-400 mr-2" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-400 mr-2" />
                  )}
                  <span className="font-medium text-gray-900 text-sm">{module.title}</span>
                </div>
                <span className="text-xs text-gray-500">
                  {module.lessons.filter(l => completedLessons.has(l.id)).length}/{module.lessons.length}
                </span>
              </button>

              {expandedModules.has(module.id) && (
                <div className="bg-gray-50">
                  {module.lessons.map(lesson => {
                    const isActive = lesson.id === currentLesson.id;
                    const isCompleted = completedLessons.has(lesson.id);
                    
                    return (
                      <button
                        key={lesson.id}
                        onClick={() => selectLesson(lesson)}
                        className={`w-full flex items-center p-3 pl-10 text-left transition-colors ${
                          isActive 
                            ? 'bg-blue-50 border-l-4 border-blue-500' 
                            : 'hover:bg-gray-100 border-l-4 border-transparent'
                        }`}
                      >
                        <div className="mr-3">
                          {isCompleted ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : (
                            <Circle className="h-5 w-5 text-gray-300" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm truncate ${isActive ? 'font-medium text-blue-700' : 'text-gray-700'}`}>
                            {lesson.title}
                          </p>
                          <div className="flex items-center text-xs text-gray-500 mt-0.5">
                            {getLessonIcon(lesson.type, isCompleted)}
                            <span className="ml-1">{lesson.duration} min</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6">
          {/* Lesson header */}
          <div className="mb-6">
            <div className="flex items-center text-sm text-gray-500 mb-2">
              {getLessonIcon(currentLesson.type, isLessonCompleted)}
              <span className="ml-2 capitalize">{currentLesson.type}</span>
              <span className="mx-2">•</span>
              <Clock className="h-4 w-4 mr-1" />
              <span>{currentLesson.duration} min</span>
              {isLessonCompleted && (
                <>
                  <span className="mx-2">•</span>
                  <CheckCircle className="h-4 w-4 mr-1 text-green-500" />
                  <span className="text-green-600">Completada</span>
                </>
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{currentLesson.title}</h1>
          </div>

          {/* Lesson content */}
          <Card className="mb-6">
            <CardContent className="p-0">
              {currentLesson.type === 'video' ? (
                <VideoPlayer
                  url={currentLesson.videoUrl || currentLesson.content || 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'}
                  title={currentLesson.title}
                  onProgress={handleVideoProgress}
                  onComplete={handleVideoComplete}
                  completionThreshold={90}
                />
              ) : currentLesson.type === 'texto' ? (
                <div className="p-6 prose prose-blue max-w-none">
                  {currentLesson.content ? (
                    <div dangerouslySetInnerHTML={{ __html: currentLesson.content }} />
                  ) : (
                    <p className="text-gray-500">No hay contenido disponible para esta lección.</p>
                  )}
                </div>
              ) : currentLesson.type === 'quiz' ? (
                <QuizLessonView
                  lesson={currentLesson}
                  onComplete={handleLessonComplete}
                />
              ) : currentLesson.type === 'foro' ? (
                <LessonForumView
                  lesson={currentLesson}
                  courseId={courseId!}
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
                    {currentLesson.content && (
                      <a
                        href={currentLesson.content}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-block text-blue-600 hover:underline"
                      >
                        Abrir recurso
                      </a>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Mark as complete button */}
          {!isLessonCompleted && currentLesson.type !== 'video' && currentLesson.type !== 'foro' && currentLesson.type !== 'quiz' && (
            <div className="mb-6 text-center">
              <Button 
                onClick={handleLessonComplete}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Marcar como completada
              </Button>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between border-t border-gray-200 pt-6">
            <Button
              variant="outline"
              onClick={goToPrevLesson}
              disabled={!prevLesson}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Anterior
            </Button>

            <Button
              onClick={goToNextLesson}
              disabled={!nextLesson}
            >
              Siguiente
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>

      {/* Completion Modal */}
      {showCompletionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4 animate-bounce-in">
            <CardContent className="p-8 text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trophy className="h-10 w-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Lección Completada!</h2>
              <p className="text-gray-600 mb-4">Has completado "{currentLesson.title}"</p>
              
              <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-lg p-4 mb-6">
                <p className="text-sm opacity-90">Puntos ganados</p>
                <p className="text-3xl font-bold">+{pointsEarned}</p>
              </div>

              <div className="flex space-x-3">
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
                    Siguiente lección
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
