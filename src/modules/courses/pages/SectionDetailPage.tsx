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
  type DBSectionLessonOverride,
} from '@shared/services/dataService';
import { resolveDeadlines } from '@shared/utils/deadlines';
import {
  ArrowLeft,
  BookOpen,
  Video,
  FileText,
  HelpCircle,
  File,
  MessageSquare,
  Clock,
  Calendar,
  CheckCircle,
  Circle,
  Loader2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';
import DeadlineBadge from '@shared/components/ui/DeadlineBadge';

interface ModuleWithLessons extends DBModule {
  lessons: (DBLesson & { resolved?: ReturnType<typeof resolveDeadlines> })[];
}

function getLessonIcon(type: string) {
  switch (type) {
    case 'video': return <Video className="h-4 w-4 text-blue-500" />;
    case 'texto': return <FileText className="h-4 w-4 text-green-500" />;
    case 'quiz': return <HelpCircle className="h-4 w-4 text-purple-500" />;
    case 'tarea': return <File className="h-4 w-4 text-orange-500" />;
    case 'recurso': return <BookOpen className="h-4 w-4 text-gray-500" />;
    case 'foro': return <MessageSquare className="h-4 w-4 text-cyan-500" />;
    default: return <FileText className="h-4 w-4 text-gray-400" />;
  }
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

  useEffect(() => {
    if (!sectionId) return;
    const load = async () => {
      setLoading(true);
      try {
        const sec = await sectionService.getById(sectionId);
        if (!sec) return;
        setSection(sec);

        const [c, mods, overrides] = await Promise.all([
          courseService.getById(sec.courseId),
          moduleService.getByCourse(sec.courseId),
          sectionService.getLessonOverrides(sectionId),
        ]);
        setCourse(c);

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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Button variant="ghost" onClick={() => navigate('/courses')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{section.title}</h1>
          <p className="text-sm text-gray-500">{section.courseTitle}</p>
        </div>
      </div>

      {/* Section info */}
      <div className="flex flex-wrap gap-4 text-sm text-gray-600">
        <span className="flex items-center gap-1">
          <Calendar className="h-4 w-4" />
          {new Date(section.startDate).toLocaleDateString('es-ES')} - {new Date(section.endDate).toLocaleDateString('es-ES')}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-4 w-4" />
          {section.status === 'activa' ? 'En curso' : section.status}
        </span>
      </div>

      {section.description && (
        <p className="text-gray-600">{section.description}</p>
      )}

      {/* Modules & Lessons */}
      <div className="space-y-3">
        {modules.map((mod, modIdx) => {
          const isExpanded = expandedModules.has(mod.id);
          return (
            <Card key={mod.id}>
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => toggleModule(mod.id)}
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="h-5 w-5 text-gray-500" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-gray-500" />
                  )}
                  <div>
                    <h3 className="font-medium">Módulo {modIdx + 1}: {mod.title}</h3>
                    <p className="text-sm text-gray-500">{mod.lessons.length} lecciones</p>
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t">
                  {mod.lessons.map((lesson, lessonIdx) => (
                    <div
                      key={lesson.id}
                      className="flex items-center justify-between p-4 border-b last:border-b-0 hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/sections/${sectionId}/lesson/${lesson.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-gray-400 text-sm w-6">{lessonIdx + 1}.</span>
                        {getLessonIcon(lesson.type)}
                        <div>
                          <p className="font-medium text-gray-900">{lesson.title}</p>
                          <p className="text-xs text-gray-500">{lesson.duration} min</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {(lesson.type === 'tarea' || lesson.type === 'quiz') && lesson.resolved && (
                          <DeadlineBadge
                            dueDate={lesson.resolved.dueDate}
                            lateSubmissionDeadline={lesson.resolved.lateSubmissionDeadline}
                            availableFrom={lesson.resolved.availableFrom}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
