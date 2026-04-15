import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@app/store/authStore';
import {
  sectionService,
  courseService,
  moduleService,
  lessonService,
  type DBSection,
  type DBCourse,
  type DBModule,
  type DBLesson,
  type DBEnrollment,
} from '@shared/services/dataService';
import { firebaseDB } from '@shared/services/firebaseDataService';
import { resolveDeadlines } from '@shared/utils/deadlines';
import {
  BookOpen,
  Video,
  FileText,
  HelpCircle,
  File,
  MessageSquare,
  Clock,
  Calendar,
  Check,
  Loader2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Card } from '@shared/components/ui/Card';
import { CoursePattern } from '@shared/components/ui/CoursePattern';
import DeadlineBadge from '@shared/components/ui/DeadlineBadge';

interface ModuleWithLessons extends DBModule {
  lessons: (DBLesson & { resolved?: ReturnType<typeof resolveDeadlines> })[];
}

function getLessonIcon(type: string) {
  // All red shades — brand rule.
  const cls = 'h-4 w-4 text-red-500';
  switch (type) {
    case 'video': return <Video className={cls} />;
    case 'texto': return <FileText className={cls} />;
    case 'quiz': return <HelpCircle className={cls} />;
    case 'tarea': return <File className={cls} />;
    case 'recurso': return <BookOpen className={cls} />;
    case 'foro': return <MessageSquare className={cls} />;
    default: return <FileText className="h-4 w-4 text-gray-400" />;
  }
}

// Completion circle: filled with red check when done, hollow gray ring otherwise.
function CompletionCircle({ done }: { done: boolean }) {
  if (done) {
    return (
      <span
        aria-label="Completado"
        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-600 text-white shrink-0"
      >
        <Check className="h-3 w-3" strokeWidth={3} />
      </span>
    );
  }
  return (
    <span
      aria-label="Pendiente"
      className="inline-block w-5 h-5 rounded-full border-2 border-gray-300 shrink-0"
    />
  );
}

export default function SectionDetailPage() {
  const { sectionId } = useParams<{ sectionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [section, setSection] = useState<DBSection | null>(null);
  const [course, setCourse] = useState<DBCourse | null>(null);
  const [modules, setModules] = useState<ModuleWithLessons[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [completedLessonIds, setCompletedLessonIds] = useState<Set<string>>(new Set());

  const isStudent = user?.role === 'student';

  useEffect(() => {
    if (!sectionId) return;
    const load = async () => {
      setLoading(true);
      try {
        const sec = await sectionService.getById(sectionId);
        if (!sec) return;
        setSection(sec);

        const [c, mods, overrides, enrollments] = await Promise.all([
          courseService.getById(sec.courseId),
          moduleService.getByCourse(sec.courseId),
          sectionService.getLessonOverrides(sectionId),
          user?.id ? firebaseDB.getEnrollmentsByUser(user.id) : Promise.resolve([] as DBEnrollment[]),
        ]);
        setCourse(c);

        // Student completion tracking — find the enrollment for THIS section
        if (isStudent) {
          const sectionEnrollment = enrollments.find(
            e => e.sectionId === sectionId || e.courseId === sec.courseId
          );
          if (sectionEnrollment?.completedLessons) {
            setCompletedLessonIds(new Set(sectionEnrollment.completedLessons));
          }
        }

        const overrideMap = new Map(overrides.map(o => [o.lessonId, o]));

        const modulesWithLessons: ModuleWithLessons[] = [];
        for (const mod of mods.sort((a, b) => a.order - b.order)) {
          const lessons = await lessonService.getByModule(mod.id);
          modulesWithLessons.push({
            ...mod,
            lessons: lessons.sort((a, b) => a.order - b.order).map(lesson => ({
              ...lesson,
              resolved: resolveDeadlines(lesson.settings, overrideMap.get(lesson.id)),
            })),
          });
        }
        setModules(modulesWithLessons);
        // Expand first module by default
        if (modulesWithLessons.length > 0) {
          setExpandedModules(new Set([modulesWithLessons[0].id]));
        }
      } catch (err) {
        console.error('Error loading section detail:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [sectionId]);

  const toggleModule = (moduleId: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!section) {
    return <div className="text-center py-12 text-gray-500">Sección no encontrada</div>;
  }

  // Per-section override wins; fall back to course image; fall back to pattern.
  const bannerImage = section.image || course?.image || section.courseImage;
  const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const doneLessons = modules.reduce(
    (sum, m) => sum + m.lessons.filter(l => completedLessonIds.has(l.id)).length,
    0
  );
  const progressPct = totalLessons > 0 ? Math.round((doneLessons / totalLessons) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-0 space-y-4 sm:space-y-6">
      {/* Course hero card: banner + meta */}
      <Card className="overflow-hidden">
        {/* Banner */}
        <div
          className="relative h-40 sm:h-48 bg-cover bg-center overflow-hidden"
          style={bannerImage ? { backgroundImage: `url(${bannerImage})` } : undefined}
        >
          {!bannerImage && (
            <CoursePattern
              courseKey={section.courseId}
              className="absolute inset-0 w-full h-full"
            />
          )}
          {/* Gradient overlay for text legibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

          {/* Overlay content */}
          <div className="absolute inset-0 p-5 sm:p-6 flex flex-col justify-end">
            <p className="text-xs font-medium text-white/80 uppercase tracking-wider mb-1">
              {section.courseTitle}
            </p>
            <h1 className="text-xl sm:text-2xl font-bold text-white leading-tight line-clamp-2">
              {section.title}
            </h1>
          </div>
        </div>

        {/* Info body */}
        <div className="p-5 sm:p-6 space-y-4">
          {section.description && (
            <p className="text-sm text-gray-700 leading-relaxed">
              {section.description}
            </p>
          )}

          <div className="flex flex-wrap gap-4 text-sm">
            <span className="inline-flex items-center gap-1.5 text-gray-600">
              <Calendar className="h-4 w-4 text-red-500 shrink-0" />
              {new Date(section.startDate).toLocaleDateString('es-ES', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
              {' — '}
              {new Date(section.endDate).toLocaleDateString('es-ES', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            </span>
            <span className="inline-flex items-center gap-1.5 text-gray-600">
              <Clock className="h-4 w-4 text-red-500 shrink-0" />
              {section.status === 'activa' ? 'En curso' : section.status}
            </span>
          </div>

          {/* Student progress row */}
          {isStudent && totalLessons > 0 && (
            <div className="pt-2">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-gray-500">Progreso del curso</span>
                <span className="font-semibold text-gray-700">
                  {doneLessons}/{totalLessons} · {progressPct}%
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-red-500 transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Modules & Lessons */}
      <div className="space-y-3">
        {modules.map((mod, modIdx) => {
          const isExpanded = expandedModules.has(mod.id);
          const totalLessons = mod.lessons.length;
          const doneLessons = mod.lessons.filter(l => completedLessonIds.has(l.id)).length;
          const moduleComplete = totalLessons > 0 && doneLessons === totalLessons;

          return (
            <Card key={mod.id}>
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => toggleModule(mod.id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {isExpanded ? (
                    <ChevronDown className="h-5 w-5 text-gray-500 shrink-0" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-gray-500 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">
                      Módulo {modIdx + 1}: {mod.title}
                    </h3>
                    {/* Student view: progress dots instead of "N lecciones" */}
                    {isStudent ? (
                      totalLessons > 0 && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <div className="flex gap-0.5">
                            {mod.lessons.map((l) => (
                              <span
                                key={l.id}
                                className={`w-1.5 h-1.5 rounded-full ${
                                  completedLessonIds.has(l.id) ? 'bg-red-500' : 'bg-gray-200'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-xs text-gray-400">
                            {moduleComplete
                              ? 'Completo'
                              : `${doneLessons}/${totalLessons}`}
                          </span>
                        </div>
                      )
                    ) : (
                      <p className="text-sm text-gray-500">{totalLessons} lecciones</p>
                    )}
                  </div>
                </div>

                {/* Right side: completion check for students */}
                {isStudent && <CompletionCircle done={moduleComplete} />}
              </div>

              {isExpanded && (
                <div className="border-t">
                  {mod.lessons.map((lesson, lessonIdx) => {
                    const isDone = completedLessonIds.has(lesson.id);
                    return (
                      <div
                        key={lesson.id}
                        className="flex items-center justify-between p-4 border-b last:border-b-0 hover:bg-gray-50 cursor-pointer"
                        onClick={() => navigate(`/sections/${sectionId}/lesson/${lesson.id}`)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-gray-400 text-sm w-6 shrink-0">
                            {lessonIdx + 1}.
                          </span>
                          {getLessonIcon(lesson.type)}
                          <div className="min-w-0">
                            <p className={`font-medium truncate ${isDone ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                              {lesson.title}
                            </p>
                            <p className="text-xs text-gray-500">{lesson.duration} min</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {/* Non-student: keep deadline badge as before */}
                          {!isStudent &&
                            (lesson.type === 'tarea' || lesson.type === 'quiz') &&
                            lesson.resolved && (
                              <DeadlineBadge
                                dueDate={lesson.resolved.dueDate}
                                lateSubmissionDeadline={lesson.resolved.lateSubmissionDeadline}
                                availableFrom={lesson.resolved.availableFrom}
                              />
                            )}
                          {/* Student: completion circle instead of submission/deadline badge */}
                          {isStudent && <CompletionCircle done={isDone} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
