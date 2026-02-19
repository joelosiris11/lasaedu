import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@app/store/authStore';
import { courseService, moduleService, lessonService, type DBModule, type DBLesson, type DBCourse } from '@shared/services/dataService';
import { fileUploadService } from '@shared/services/fileUploadService';
import {
  BookOpen,
  ArrowLeft,
  Plus,
  Edit3,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Play,
  FileText,
  Video,
  File,
  HelpCircle,
  Clock,
  Users,
  Image,
  X,
  Loader2,
  Target,
  MessageSquare
} from 'lucide-react';
import { Card, CardContent } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { Label } from '@shared/components/ui/Label';
import { SortableList, arrayMove } from '@shared/components/dnd';
import { RichTextEditor } from '@shared/components/editor';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Tipos locales extendidos para la UI
interface CourseModuleWithLessons extends DBModule {
  lessons: DBLesson[];
}

type CourseData = DBCourse;

// ─── Sortable sub-components ───────────────────────────────────────

function SortableModuleCard({
  module,
  moduleIndex,
  canEdit,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
  onAddLesson,
  onEditLesson,
  onDeleteLesson,
  onLessonReorder,
  getLessonIcon,
  courseId,
}: {
  module: CourseModuleWithLessons;
  moduleIndex: number;
  canEdit: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddLesson: () => void;
  onEditLesson: (lesson: DBLesson) => void;
  onDeleteLesson: (lessonId: string) => void;
  onLessonReorder: (moduleId: string, oldIndex: number, newIndex: number) => void;
  getLessonIcon: (type: string) => React.ReactNode;
  courseId: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: module.id, disabled: !canEdit });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const navigate = useNavigate();

  return (
    <Card ref={setNodeRef} style={style} className="overflow-hidden">
      <div
        className="flex items-center justify-between p-4 bg-gray-50 cursor-pointer hover:bg-gray-100"
        onClick={onToggle}
      >
        <div className="flex items-center space-x-3">
          {canEdit && (
            <button
              ref={setActivatorNodeRef}
              {...listeners}
              {...attributes}
              className="cursor-grab active:cursor-grabbing touch-none p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 rounded"
              aria-label="Arrastrar para reordenar módulo"
              type="button"
              onClick={e => e.stopPropagation()}
            >
              <GripVertical className="h-5 w-5" />
            </button>
          )}
          {isExpanded ? (
            <ChevronDown className="h-5 w-5 text-gray-600" />
          ) : (
            <ChevronRight className="h-5 w-5 text-gray-600" />
          )}
          <div className="flex items-center gap-3">
            {module.image && (
              <img src={module.image} alt="" className="h-10 w-10 rounded object-cover" />
            )}
            <div>
              <h3 className="font-medium">
                Módulo {moduleIndex + 1}: {module.title}
              </h3>
              <p className="text-sm text-gray-600">
                {module.lessons.length} lecciones •
                {module.lessons.reduce((sum, l) => sum + parseInt(l.duration || '0'), 0)} min
              </p>
              {module.objectives && module.objectives.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {module.objectives.slice(0, 3).map((obj, i) => (
                    <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-indigo-100 text-indigo-700">
                      {obj}
                    </span>
                  ))}
                  {module.objectives.length > 3 && (
                    <span className="text-xs text-gray-500">+{module.objectives.length - 3} más</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {canEdit && (
          <div className="flex items-center space-x-2" onClick={e => e.stopPropagation()}>
            <Button
              size="sm"
              variant="outline"
              onClick={onAddLesson}
              title="Agregar lección"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onEdit}
            >
              <Edit3 className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 hover:bg-red-50"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="border-t">
          {module.lessons.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              No hay lecciones en este módulo
              {canEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-2"
                  onClick={onAddLesson}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Agregar
                </Button>
              )}
            </div>
          ) : (
            <SortableList
              items={module.lessons.map(l => l.id)}
              onReorder={(oldIdx, newIdx) => onLessonReorder(module.id, oldIdx, newIdx)}
              renderOverlay={(activeId) => {
                const lesson = module.lessons.find(l => l.id === activeId);
                if (!lesson) return null;
                return (
                  <div className="flex items-center space-x-3 p-4 bg-white border rounded-lg shadow-lg">
                    <GripVertical className="h-4 w-4 text-gray-400" />
                    {getLessonIcon(lesson.type)}
                    <p className="font-medium">{lesson.title}</p>
                  </div>
                );
              }}
            >
              {module.lessons.map((lesson, lessonIndex) => (
                <SortableLessonRow
                  key={lesson.id}
                  lesson={lesson}
                  lessonIndex={lessonIndex}
                  canEdit={canEdit}
                  getLessonIcon={getLessonIcon}
                  onView={() => navigate(`/courses/${courseId}/lesson/${lesson.id}`)}
                  onEdit={() => onEditLesson(lesson)}
                  onDelete={() => onDeleteLesson(lesson.id)}
                />
              ))}
            </SortableList>
          )}
        </div>
      )}
    </Card>
  );
}

function SortableLessonRow({
  lesson,
  lessonIndex,
  canEdit,
  getLessonIcon,
  onView,
  onEdit,
  onDelete,
}: {
  lesson: DBLesson;
  lessonIndex: number;
  canEdit: boolean;
  getLessonIcon: (type: string) => React.ReactNode;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lesson.id, disabled: !canEdit });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between p-4 border-b last:border-b-0 hover:bg-gray-50"
    >
      <div className="flex items-center space-x-3">
        {canEdit && (
          <button
            ref={setActivatorNodeRef}
            {...listeners}
            {...attributes}
            className="cursor-grab active:cursor-grabbing touch-none p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 rounded"
            aria-label="Arrastrar para reordenar lección"
            type="button"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <span className="text-gray-400 text-sm w-6">{lessonIndex + 1}.</span>
        {getLessonIcon(lesson.type)}
        <div>
          <p className="font-medium">{lesson.title}</p>
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <span className="capitalize">{lesson.type}</span>
            <span>•</span>
            <span>{lesson.duration} min</span>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        {!canEdit && (
          <Button size="sm" variant="outline" onClick={onView}>
            <Play className="h-4 w-4 mr-1" />
            Ver
          </Button>
        )}
        {canEdit && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={onEdit}
            >
              <Edit3 className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 hover:bg-red-50"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────

export default function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [course, setCourse] = useState<CourseData | null>(null);
  const [modules, setModules] = useState<CourseModuleWithLessons[]>([]);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showModuleModal, setShowModuleModal] = useState(false);
  const [selectedModule, setSelectedModule] = useState<CourseModuleWithLessons | null>(null);

  // Module form states (enhanced)
  const [moduleForm, setModuleForm] = useState({
    title: '',
    description: '',
    image: '',
    objectives: [] as string[],
    duration: '',
    availableFrom: '',
  });
  const [newObjective, setNewObjective] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const isInstructor = user?.role === 'teacher' || user?.role === 'admin';
  const canEdit = isInstructor && (course?.instructorId === user?.id || user?.role === 'admin');

  useEffect(() => {
    loadCourseData();
  }, [courseId]);

  const loadCourseData = async () => {
    if (!courseId) return;

    try {
      setLoading(true);

      const courseData = await courseService.getById(courseId);
      if (courseData) {
        setCourse(courseData as CourseData);
      }

      const courseModules = await moduleService.getByCourse(courseId);
      const sortedModules = courseModules.sort((a, b) => a.order - b.order);

      const modulesWithLessons: CourseModuleWithLessons[] = await Promise.all(
        sortedModules.map(async (module) => {
          const lessons = await lessonService.getByModule(module.id);
          return {
            ...module,
            lessons: lessons.sort((a, b) => a.order - b.order)
          };
        })
      );

      setModules(modulesWithLessons);

      if (modulesWithLessons.length > 0) {
        setExpandedModules(new Set([modulesWithLessons[0].id]));
      }
    } catch (error) {
      console.error('Error loading course:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleModuleExpand = (moduleId: string) => {
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

  // ─── Module CRUD ──────────────────────────────────────────────

  const handleCreateModule = () => {
    setSelectedModule(null);
    setModuleForm({ title: '', description: '', image: '', objectives: [], duration: '', availableFrom: '' });
    setNewObjective('');
    setShowModuleModal(true);
  };

  const handleEditModule = (module: CourseModuleWithLessons) => {
    setSelectedModule(module);
    setModuleForm({
      title: module.title,
      description: module.description,
      image: module.image || '',
      objectives: module.objectives || [],
      duration: module.duration || '',
      availableFrom: module.availableFrom ? new Date(module.availableFrom).toISOString().slice(0, 16) : '',
    });
    setNewObjective('');
    setShowModuleModal(true);
  };

  const handleSaveModule = async () => {
    if (!courseId || !moduleForm.title.trim()) return;

    try {
      const updateData: Partial<DBModule> = {
        title: moduleForm.title,
        description: moduleForm.description,
        image: moduleForm.image || undefined,
        objectives: moduleForm.objectives.length > 0 ? moduleForm.objectives : undefined,
        duration: moduleForm.duration || '0',
        availableFrom: moduleForm.availableFrom ? new Date(moduleForm.availableFrom).getTime() : undefined,
      };

      if (selectedModule) {
        await moduleService.update(selectedModule.id, updateData);
      } else {
        const now = Date.now();
        await moduleService.create({
          courseId,
          ...updateData,
          title: moduleForm.title,
          description: moduleForm.description,
          order: modules.length + 1,
          status: 'borrador',
          duration: moduleForm.duration || '0',
          createdAt: now,
          updatedAt: now,
        });
      }

      setShowModuleModal(false);
      loadCourseData();
    } catch (error) {
      console.error('Error saving module:', error);
    }
  };

  const handleDeleteModule = async (moduleId: string) => {
    if (confirm('¿Estás seguro de eliminar este módulo? Se eliminarán todas las lecciones.')) {
      try {
        const moduleLessons = await lessonService.getByModule(moduleId);
        await Promise.all(moduleLessons.map(lesson => lessonService.delete(lesson.id)));
        await moduleService.delete(moduleId);
        loadCourseData();
      } catch (error) {
        console.error('Error deleting module:', error);
      }
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const result = await fileUploadService.uploadImage(file, courseId);
      setModuleForm(prev => ({ ...prev, image: result.url }));
    } catch (error) {
      console.error('Error uploading image:', error);
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const handleAddObjective = () => {
    const trimmed = newObjective.trim();
    if (!trimmed) return;
    setModuleForm(prev => ({ ...prev, objectives: [...prev.objectives, trimmed] }));
    setNewObjective('');
  };

  const handleRemoveObjective = (index: number) => {
    setModuleForm(prev => ({
      ...prev,
      objectives: prev.objectives.filter((_, i) => i !== index),
    }));
  };

  // ─── Lesson actions (redirect to LessonBuilderPage) ──────────

  const handleCreateLesson = (moduleId: string) => {
    navigate(`/courses/${courseId}/modules/${moduleId}/lessons/new`);
  };

  const handleEditLesson = (lesson: DBLesson) => {
    navigate(`/courses/${courseId}/modules/${lesson.moduleId}/lessons/${lesson.id}/edit`);
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (confirm('¿Estás seguro de eliminar esta lección?')) {
      try {
        await lessonService.delete(lessonId);
        loadCourseData();
      } catch (error) {
        console.error('Error deleting lesson:', error);
      }
    }
  };

  // ─── Drag & Drop handlers ────────────────────────────────────

  const handleModuleReorder = async (oldIndex: number, newIndex: number) => {
    const reordered = arrayMove(modules, oldIndex, newIndex);
    // Optimistic update
    setModules(reordered);

    // Persist new order
    try {
      await Promise.all(
        reordered.map((mod, idx) =>
          moduleService.update(mod.id, { order: idx + 1 })
        )
      );
    } catch (error) {
      console.error('Error persisting module order:', error);
      loadCourseData(); // revert on failure
    }
  };

  const handleLessonReorder = async (moduleId: string, oldIndex: number, newIndex: number) => {
    setModules(prev =>
      prev.map(mod => {
        if (mod.id !== moduleId) return mod;
        const reordered = arrayMove(mod.lessons, oldIndex, newIndex);
        return { ...mod, lessons: reordered };
      })
    );

    const mod = modules.find(m => m.id === moduleId);
    if (!mod) return;
    const reorderedLessons = arrayMove(mod.lessons, oldIndex, newIndex);

    try {
      await Promise.all(
        reorderedLessons.map((lesson, idx) =>
          lessonService.update(lesson.id, { order: idx + 1 })
        )
      );
    } catch (error) {
      console.error('Error persisting lesson order:', error);
      loadCourseData();
    }
  };

  // ─── Helpers ──────────────────────────────────────────────────

  const getLessonIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <Video className="h-4 w-4 text-purple-500" />;
      case 'texto':
        return <FileText className="h-4 w-4 text-blue-500" />;
      case 'recurso':
        return <File className="h-4 w-4 text-red-500" />;
      case 'quiz':
        return <HelpCircle className="h-4 w-4 text-green-500" />;
      case 'tarea':
        return <Edit3 className="h-4 w-4 text-orange-500" />;
      case 'foro':
        return <MessageSquare className="h-4 w-4 text-teal-500" />;
      default:
        return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTotalDuration = () => {
    return modules.reduce((total, module) => {
      return total + module.lessons.reduce((sum, lesson) => sum + parseInt(lesson.duration || '0'), 0);
    }, 0);
  };

  const getTotalLessons = () => {
    return modules.reduce((total, module) => total + module.lessons.length, 0);
  };

  // ─── Render ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="text-center py-12">
        <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900">Curso no encontrado</h3>
        <Button onClick={() => navigate('/courses')} className="mt-4">
          Volver a cursos
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={() => navigate('/courses')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{course.title}</h1>
            <p className="text-gray-600">{course.description}</p>
          </div>
        </div>
        {canEdit && (
          <Button onClick={handleCreateModule}>
            <Plus className="h-4 w-4 mr-2" />
            Agregar Módulo
          </Button>
        )}
      </div>

      {/* Course Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center">
            <BookOpen className="h-8 w-8 text-indigo-600 mr-3" />
            <div>
              <p className="text-2xl font-bold">{modules.length}</p>
              <p className="text-sm text-gray-600">Módulos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center">
            <FileText className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <p className="text-2xl font-bold">{getTotalLessons()}</p>
              <p className="text-sm text-gray-600">Lecciones</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center">
            <Clock className="h-8 w-8 text-green-600 mr-3" />
            <div>
              <p className="text-2xl font-bold">{getTotalDuration()}</p>
              <p className="text-sm text-gray-600">Minutos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center">
            <Users className="h-8 w-8 text-purple-600 mr-3" />
            <div>
              <p className="text-2xl font-bold">{course.studentsCount}</p>
              <p className="text-sm text-gray-600">Estudiantes</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modules List with Drag & Drop */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Contenido del Curso</h2>

        {modules.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Sin módulos</h3>
              <p className="text-gray-600 mb-4">Este curso aún no tiene módulos. Comienza agregando el primer módulo.</p>
              {canEdit && (
                <Button onClick={handleCreateModule}>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear primer módulo
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <SortableList
            items={modules.map(m => m.id)}
            onReorder={handleModuleReorder}
            renderOverlay={(activeId) => {
              const mod = modules.find(m => m.id === activeId);
              if (!mod) return null;
              return (
                <Card className="shadow-lg border-indigo-300">
                  <div className="flex items-center space-x-3 p-4 bg-gray-50">
                    <GripVertical className="h-5 w-5 text-gray-400" />
                    <h3 className="font-medium">{mod.title}</h3>
                    <span className="text-sm text-gray-500">
                      ({mod.lessons.length} lecciones)
                    </span>
                  </div>
                </Card>
              );
            }}
          >
            {modules.map((module, moduleIndex) => (
              <SortableModuleCard
                key={module.id}
                module={module}
                moduleIndex={moduleIndex}
                canEdit={canEdit}
                isExpanded={expandedModules.has(module.id)}
                onToggle={() => toggleModuleExpand(module.id)}
                onEdit={() => handleEditModule(module)}
                onDelete={() => handleDeleteModule(module.id)}
                onAddLesson={() => handleCreateLesson(module.id)}
                onEditLesson={handleEditLesson}
                onDeleteLesson={(id) => handleDeleteLesson(id)}
                onLessonReorder={handleLessonReorder}
                getLessonIcon={getLessonIcon}
                courseId={courseId!}
              />
            ))}
          </SortableList>
        )}
      </div>

      {/* Enhanced Module Modal */}
      {showModuleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4">
              {selectedModule ? 'Editar Módulo' : 'Nuevo Módulo'}
            </h2>

            <div className="space-y-4">
              {/* Title */}
              <div>
                <Label>Título del Módulo</Label>
                <Input
                  value={moduleForm.title}
                  onChange={e => setModuleForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Ej: Introducción al curso"
                />
              </div>

              {/* Cover image */}
              <div>
                <Label>Imagen de portada</Label>
                <div className="flex items-center gap-3 mt-1">
                  {moduleForm.image ? (
                    <div className="relative">
                      <img src={moduleForm.image} alt="" className="h-20 w-32 object-cover rounded" />
                      <button
                        type="button"
                        onClick={() => setModuleForm(prev => ({ ...prev, image: '' }))}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      className="h-20 w-32 border-2 border-dashed border-gray-300 rounded flex flex-col items-center justify-center text-gray-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors"
                      disabled={uploadingImage}
                    >
                      {uploadingImage ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          <Image className="h-5 w-5" />
                          <span className="text-xs mt-1">Subir</span>
                        </>
                      )}
                    </button>
                  )}
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </div>
              </div>

              {/* Rich description */}
              <div>
                <Label>Descripción</Label>
                <RichTextEditor
                  content={moduleForm.description}
                  onChange={html => setModuleForm(prev => ({ ...prev, description: html }))}
                  placeholder="Describe el contenido de este módulo..."
                  className="min-h-[120px]"
                />
              </div>

              {/* Objectives */}
              <div>
                <Label className="flex items-center gap-1">
                  <Target className="h-4 w-4" />
                  Objetivos del módulo
                </Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={newObjective}
                    onChange={e => setNewObjective(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddObjective(); } }}
                    placeholder="Ej: Comprender los fundamentos..."
                  />
                  <Button type="button" variant="outline" onClick={handleAddObjective} disabled={!newObjective.trim()}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {moduleForm.objectives.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {moduleForm.objectives.map((obj, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm bg-indigo-100 text-indigo-700">
                        {obj}
                        <button
                          type="button"
                          onClick={() => handleRemoveObjective(i)}
                          className="hover:text-red-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Estimated duration & availability */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Duración estimada (min)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={moduleForm.duration}
                    onChange={e => setModuleForm(prev => ({ ...prev, duration: e.target.value }))}
                    placeholder="60"
                  />
                </div>
                <div>
                  <Label>Disponible desde</Label>
                  <Input
                    type="datetime-local"
                    value={moduleForm.availableFrom}
                    onChange={e => setModuleForm(prev => ({ ...prev, availableFrom: e.target.value }))}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Si se establece, el módulo estará oculto para estudiantes hasta esta fecha
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <Button variant="outline" onClick={() => setShowModuleModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveModule}>
                {selectedModule ? 'Guardar Cambios' : 'Crear Módulo'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
