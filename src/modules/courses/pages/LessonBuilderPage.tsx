import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useBlocker } from 'react-router-dom';
import { 
  lessonService, 
  moduleService, 
  type DBLesson, 
  type DBModule 
} from '@shared/services/dataService';
import { RichTextEditor } from '@shared/components/editor';
import { blocksToHtml, type LegacyContentBlock } from '../utils/blocksToHtml';
import { fileUploadService } from '@shared/services/fileUploadService';
import { useHeaderStore } from '@app/store/headerStore';
import {
  Save,
  Eye,
  Settings,
  BookOpen,
  Video,
  Headphones,
  FileText,
  HelpCircle,
  MessageSquare,
  Image as ImageIcon,
  Upload,
  X as XIcon,
  Loader2,
  AlertTriangle,
  Trash2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { Label } from '@shared/components/ui/Label';
import ForumLessonEditor, { type ForumLessonContent, defaultForumContent } from '../components/ForumLessonEditor';
import QuizLessonEditor, { type QuizLessonContent, defaultQuizContent } from '../components/QuizLessonEditor';
import VideoLessonEditor, { type VideoLessonContent, defaultVideoContent } from '../components/VideoLessonEditor';
import ResourceLessonEditor, { type ResourceLessonContent, defaultResourceContent } from '../components/ResourceLessonEditor';
import TareaLessonEditor, { type TareaLessonContent, defaultTareaContent } from '../components/TareaLessonEditor';

interface LessonSettings {
  isRequired: boolean;
  timeLimit?: number;
  allowComments: boolean;
  showProgress: boolean;
  passingScore?: number;
  maxAttempts?: number;
  availableFrom?: string;
  availableUntil?: string;
  dueDate?: string;
  lateSubmissionDeadline?: string;
  excludeFromFinalGrade?: boolean;
  sideImage?: {
    url: string;
    position: 'left' | 'right';
    width?: number; // Percentage the image column takes (20–80). Default 50.
    fade?: boolean; // Whether to fade the inner edge to white. Default true.
    focalX?: number; // Horizontal focal point for object-position (0–100). Default 50.
  };
}

const LESSON_TYPES = [
  { 
    value: 'texto' as const, 
    label: 'Contenido de Texto', 
    icon: FileText, 
    description: 'Artículos, documentos y contenido escrito' 
  },
  { 
    value: 'video' as const, 
    label: 'Video Lección', 
    icon: Video, 
    description: 'Videos educativos con controles de progreso' 
  },
  { 
    value: 'recurso' as const, 
    label: 'Recursos/Audio', 
    icon: Headphones, 
    description: 'Contenido de audio, recursos y documentos' 
  },
  { 
    value: 'tarea' as const, 
    label: 'Tarea/Actividad', 
    icon: BookOpen, 
    description: 'Tareas y actividades prácticas' 
  },
  {
    value: 'quiz' as const,
    label: 'Quiz/Evaluación',
    icon: HelpCircle,
    description: 'Preguntas y evaluaciones interactivas'
  },
  {
    value: 'foro' as const,
    label: 'Foro de Discusión',
    icon: MessageSquare,
    description: 'Debate y discusión entre estudiantes'
  }
] as const;

export default function LessonBuilderPage() {
  const { courseId, moduleId, lessonId } = useParams<{ 
    courseId: string; 
    moduleId: string; 
    lessonId?: string; 
  }>();
  const navigate = useNavigate();
  // const { user } = useAuthStore(); // Unused for now

  const [_lesson, setLesson] = useState<DBLesson | null>(null);
  const [module, setModule] = useState<DBModule | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'content' | 'settings'>('content');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [lessonType, setLessonType] = useState<'texto' | 'video' | 'quiz' | 'tarea' | 'recurso' | 'foro'>('texto');
  const [forumContent, setForumContent] = useState<ForumLessonContent>(defaultForumContent);
  const [quizContent, setQuizContent] = useState<QuizLessonContent>(defaultQuizContent);
  const [videoContent, setVideoContent] = useState<VideoLessonContent>(defaultVideoContent);
  const [resourceContent, setResourceContent] = useState<ResourceLessonContent>(defaultResourceContent);
  const [tareaContent, setTareaContent] = useState<TareaLessonContent>(defaultTareaContent);
  const [wysiwygContent, setWysiwygContent] = useState('');
  const [settings, setSettings] = useState<LessonSettings>({
    isRequired: true,
    allowComments: true,
    showProgress: true
  });

  useEffect(() => {
    loadData();
  }, [courseId, moduleId, lessonId]);

  const loadData = async () => {
    if (!courseId || !moduleId) return;
    
    setLoading(true);
    try {
      // Load module info
      const moduleData = await moduleService.getById(moduleId);
      setModule(moduleData);

      // Load lesson if editing
      if (lessonId) {
        const lessonData = await lessonService.getById(lessonId);
        if (lessonData) {
          setLesson(lessonData);
          setTitle(lessonData.title);
          setDescription(lessonData.description || '');
          // Map DB type to component type
          const mappedType: 'texto' | 'video' | 'quiz' | 'tarea' | 'recurso' | 'foro' = lessonData.type || 'texto';
          setLessonType(mappedType);
          
          // Parse content
          try {
            const parsedContent = typeof lessonData.content === 'string'
              ? JSON.parse(lessonData.content)
              : lessonData.content;

            // Check if content is forum type
            if (mappedType === 'foro' && parsedContent && parsedContent.prompt !== undefined) {
              setForumContent(parsedContent as ForumLessonContent);
            // Check if content is quiz type
            } else if (mappedType === 'quiz' && parsedContent && parsedContent.questions !== undefined) {
              setQuizContent(parsedContent as QuizLessonContent);
            // Check if content is video type
            } else if (mappedType === 'video' && parsedContent && parsedContent.videoUrl !== undefined) {
              setVideoContent(parsedContent as VideoLessonContent);
            // Fallback: video URL stored at top level (legacy) or content didn't match
            } else if (mappedType === 'video' && lessonData.videoUrl) {
              setVideoContent({ videoUrl: lessonData.videoUrl, videoSource: '', textContent: typeof parsedContent === 'string' ? '' : (parsedContent?.textContent || '') });
            // Check if content is resource type
            } else if (mappedType === 'recurso' && parsedContent && parsedContent.textContent !== undefined) {
              setResourceContent(parsedContent as ResourceLessonContent);
            // Check if content is tarea type
            } else if (mappedType === 'tarea' && parsedContent && parsedContent.instructions !== undefined) {
              setTareaContent(parsedContent as TareaLessonContent);
            // Check if content is WYSIWYG (has editorMode field) or block-based
            } else if (parsedContent && typeof parsedContent === 'object' && parsedContent.editorMode === 'wysiwyg') {
              setWysiwygContent(parsedContent.html || '');
            } else if (Array.isArray(parsedContent)) {
              // Legacy block-based content → migrate to HTML on the fly
              setWysiwygContent(blocksToHtml(parsedContent as LegacyContentBlock[]));
            } else if (typeof parsedContent === 'string') {
              setWysiwygContent(parsedContent);
            }
          } catch {
            // If parsing fails, treat raw string as HTML or plain text
            if (typeof lessonData.content === 'string') {
              setWysiwygContent(lessonData.content);
            }
          }

          // Load settings - handle potential undefined
          const lessonSettings = (lessonData as any).settings;
          if (lessonSettings) {
            setSettings(prevSettings => ({ ...prevSettings, ...lessonSettings }));
          }
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = 'El título es obligatorio';
    }

    if (title.length > 100) {
      newErrors.title = 'El título no puede superar los 100 caracteres';
    }

    if (description.length > 500) {
      newErrors.description = 'La descripción no puede superar los 500 caracteres';
    }

    // Validate content based on lesson type / editor mode
    if (lessonType === 'foro') {
      if (!forumContent.prompt.trim()) {
        newErrors.content = 'El tema de discusión es obligatorio';
      }
    } else if (lessonType === 'quiz') {
      if (quizContent.questions.length === 0) {
        newErrors.content = 'El quiz debe tener al menos una pregunta';
      }
    } else if (lessonType === 'video') {
      if (!videoContent.videoUrl.trim()) {
        newErrors.content = 'La URL del video es obligatoria';
      }
    } else if (lessonType === 'recurso') {
      if (!resourceContent.textContent.trim() && resourceContent.files.length === 0) {
        newErrors.content = 'El recurso debe tener contenido de texto o archivos adjuntos';
      }
    } else if (lessonType === 'tarea') {
      if (!tareaContent.instructions.trim()) {
        newErrors.content = 'Las instrucciones de la tarea son obligatorias';
      }
    } else if (lessonType === 'texto' && !wysiwygContent.trim()) {
      newErrors.content = 'La lección debe tener contenido';
    }

    if (lessonType === 'quiz' && settings.passingScore !== undefined && (settings.passingScore < 0 || settings.passingScore > 100)) {
      newErrors.passingScore = 'La puntuación mínima debe estar entre 0 y 100';
    }

    if (settings.maxAttempts !== undefined && settings.maxAttempts < 1) {
      newErrors.maxAttempts = 'Debe permitir al menos 1 intento';
    }

    // Due date required for tarea; required for quiz unless it's marked as practice (not in final grade)
    const quizRequiresDueDate = lessonType === 'quiz' && !settings.excludeFromFinalGrade;
    if ((quizRequiresDueDate || lessonType === 'tarea') && !settings.dueDate) {
      newErrors.dueDate = 'La fecha de cierre es obligatoria';
    }

    // Cierre definitivo required for tarea
    if (lessonType === 'tarea' && !settings.lateSubmissionDeadline) {
      newErrors.lateSubmissionDeadline = 'La fecha de cierre definitivo es obligatoria';
    }

    // Cierre definitivo must be after fecha de entrega
    if (lessonType === 'tarea' && settings.dueDate && settings.lateSubmissionDeadline) {
      if (new Date(settings.lateSubmissionDeadline) <= new Date(settings.dueDate)) {
        newErrors.lateSubmissionDeadline = 'El cierre definitivo debe ser posterior a la fecha de entrega';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async (): Promise<boolean> => {
    if (saving) return false; // prevent double-save
    if (!validateForm() || !courseId || !moduleId) return false;

    setSaving(true);
    try {
      // Prepare content based on lesson type / editor mode
      let contentToSave: string;
      if (lessonType === 'foro') {
        contentToSave = JSON.stringify(forumContent);
      } else if (lessonType === 'quiz') {
        contentToSave = JSON.stringify(quizContent);
      } else if (lessonType === 'video') {
        contentToSave = JSON.stringify(videoContent);
      } else if (lessonType === 'recurso') {
        contentToSave = JSON.stringify(resourceContent);
      } else if (lessonType === 'tarea') {
        contentToSave = JSON.stringify(tareaContent);
      } else {
        contentToSave = JSON.stringify({ editorMode: 'wysiwyg', html: wysiwygContent });
      }

      const lessonData: Partial<DBLesson> = {
        title: title.trim(),
        description: description.trim() || undefined,
        type: lessonType,
        content: contentToSave,
        ...(lessonType === 'video' ? { videoUrl: videoContent.videoUrl } : {}),
        settings,
        moduleId,
        courseId,
        updatedAt: Date.now()
      };

      if (lessonId) {
        // Update existing lesson
        await lessonService.update(lessonId, lessonData);
        snapshotRef.current = currentSnapshot;
      } else {
        // Create new lesson
        const existingLessons = await lessonService.getByModule(moduleId);

        const newLesson: Omit<DBLesson, 'id'> = {
          ...lessonData,
          order: existingLessons.length,
          createdAt: Date.now()
        } as Omit<DBLesson, 'id'>;

        const createdLesson = await lessonService.create(newLesson);
        // Baseline must be reset BEFORE navigate so the guard doesn't treat
        // the redirect-to-edit as an unsaved-changes navigation.
        snapshotRef.current = currentSnapshot;
        bypassGuardRef.current = true;
        navigate(`/courses/${courseId}/modules/${moduleId}/lessons/${createdLesson.id}/edit`);
      }

      console.log('Lesson saved successfully');
      return true;
    } catch (error) {
      console.error('Error saving lesson:', error);
      setErrors({ submit: 'Error al guardar la lección. Intenta de nuevo.' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = () => {
    if (lessonId) {
      navigate(`/courses/${courseId}/lesson/${lessonId}`);
    }
  };

  // ── Unsaved-changes guard ──────────────────────────────────────────
  // Snapshot of the last saved (or freshly loaded) state. If the current
  // serialized state differs from it, the form is "dirty".
  const snapshotRef = useRef<string | null>(null);
  // Flip to `true` to let the next navigation pass through the blocker
  // unchallenged — used for the create→edit redirect after a successful save.
  const bypassGuardRef = useRef(false);
  const currentSnapshot = useMemo(
    () => JSON.stringify({
      title, description, lessonType,
      forumContent, quizContent, videoContent, resourceContent, tareaContent,
      wysiwygContent, settings,
    }),
    [title, description, lessonType, forumContent, quizContent, videoContent, resourceContent, tareaContent, wysiwygContent, settings]
  );

  useEffect(() => {
    // Set the initial snapshot once loadData finishes.
    if (!loading && snapshotRef.current === null) {
      snapshotRef.current = currentSnapshot;
    }
  }, [loading, currentSnapshot]);

  const dirty = snapshotRef.current !== null && snapshotRef.current !== currentSnapshot;

  const [confirmLeave, setConfirmLeave] = useState<null | { onDiscard: () => void }>(null);

  // In-app navigation guard.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => {
      if (bypassGuardRef.current) {
        bypassGuardRef.current = false;
        return false;
      }
      return dirty && currentLocation.pathname !== nextLocation.pathname;
    }
  );
  useEffect(() => {
    if (blocker.state === 'blocked') {
      setConfirmLeave({ onDiscard: () => blocker.proceed() });
    }
  }, [blocker]);

  // Browser-level guard (refresh / close tab).
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const requestBack = useCallback(() => {
    if (!dirty) {
      navigate(`/courses/${courseId}`);
      return;
    }
    setConfirmLeave({ onDiscard: () => navigate(`/courses/${courseId}`) });
  }, [dirty, navigate, courseId]);

  const handleSaveFromModal = async () => {
    const ok = await handleSave();
    if (ok !== false) {
      // Consider current state the new baseline.
      snapshotRef.current = currentSnapshot;
      bypassGuardRef.current = true;
      const action = confirmLeave;
      setConfirmLeave(null);
      action?.onDiscard();
    }
  };

  const handleDiscardFromModal = () => {
    // Proceed without saving.
    snapshotRef.current = currentSnapshot;
    bypassGuardRef.current = true;
    const action = confirmLeave;
    setConfirmLeave(null);
    action?.onDiscard();
  };

  const handleCancelLeave = () => {
    if (blocker.state === 'blocked') blocker.reset();
    setConfirmLeave(null);
  };

  // Sync the top header: title = "Editar/Nueva Lección", subtitle = Module name,
  // back button → course, actions = Guardar + Vista Previa.
  const setOverride = useHeaderStore((s) => s.setOverride);
  useEffect(() => {
    setOverride({
      title: lessonId ? 'Editar Lección' : 'Nueva Lección',
      subtitle: module?.title ? `Módulo: ${module.title}${dirty ? ' · cambios sin guardar' : ''}` : (dirty ? 'Cambios sin guardar' : undefined),
      onBack: requestBack,
      actions: (
        <>
          {lessonId && (
            <Button variant="outline" size="sm" onClick={handlePreview}>
              <Eye className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">Vista Previa</span>
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={saving || !dirty} className="bg-red-600 hover:bg-red-700">
            <Save className="w-4 h-4 mr-1.5" />
            {saving ? 'Guardando...' : dirty ? 'Guardar' : 'Guardado'}
          </Button>
        </>
      ),
    });
    return () => setOverride(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, module?.title, saving, courseId, dirty, requestBack, wysiwygContent, title, description, lessonType, forumContent, quizContent, videoContent, resourceContent, tareaContent, settings]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Error Messages */}
      {errors.submit && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">{errors.submit}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b mb-6">
        <button
          onClick={() => setActiveTab('content')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'content'
              ? 'border-b-2 border-red-500 text-red-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <BookOpen className="w-4 h-4 inline mr-2" />
          Contenido
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'settings'
              ? 'border-b-2 border-red-500 text-red-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Settings className="w-4 h-4 inline mr-2" />
          Configuración
        </button>
      </div>

      {activeTab === 'content' && (
        <div className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Información Básica</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Título de la Lección *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej: Introducción a JavaScript"
                  className={errors.title ? 'border-red-500' : ''}
                />
                {errors.title && (
                  <p className="text-red-500 text-sm mt-1">{errors.title}</p>
                )}
              </div>

              <div>
                <Label htmlFor="description">Descripción</Label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Breve descripción de la lección (opcional)"
                  className={`w-full min-h-[80px] p-3 border rounded-lg resize-none ${
                    errors.description ? 'border-red-500' : 'border-gray-300'
                  }`}
                  maxLength={500}
                />
                <div className="flex justify-between text-sm text-gray-500 mt-1">
                  {errors.description && (
                    <p className="text-red-500">{errors.description}</p>
                  )}
                  <span className="ml-auto">{description.length}/500</span>
                </div>
              </div>

              {!lessonId && (
              <div>
                <Label>Tipo de Lección</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
                  {LESSON_TYPES.map((type) => {
                    const Icon = type.icon;
                    return (
                      <button
                        key={type.value}
                        onClick={() => setLessonType(type.value)}
                        className={`p-4 border rounded-lg text-left transition-colors ${
                          lessonType === type.value
                            ? 'border-red-500 bg-red-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Icon className={`w-6 h-6 mb-2 ${
                          lessonType === type.value ? 'text-red-600' : 'text-gray-600'
                        }`} />
                        <h4 className="font-medium mb-1">{type.label}</h4>
                        <p className="text-sm text-gray-600">{type.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
              )}
            </CardContent>
          </Card>

          {/* Content Editor */}
          <Card>
            <CardHeader>
              <CardTitle>
                {lessonType === 'foro' ? 'Configuración del Foro'
                  : lessonType === 'quiz' ? 'Preguntas del Quiz'
                  : lessonType === 'video' ? 'Video y Contenido'
                  : lessonType === 'recurso' ? 'Recurso y Archivos'
                  : lessonType === 'tarea' ? 'Tarea/Actividad'
                  : 'Contenido de la Lección'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {errors.content && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <p className="text-red-800">{errors.content}</p>
                </div>
              )}

              {lessonType === 'foro' ? (
                <ForumLessonEditor content={forumContent} onChange={setForumContent} />
              ) : lessonType === 'quiz' ? (
                <QuizLessonEditor content={quizContent} onChange={setQuizContent} />
              ) : lessonType === 'video' ? (
                <VideoLessonEditor content={videoContent} onChange={setVideoContent} />
              ) : lessonType === 'recurso' ? (
                <ResourceLessonEditor content={resourceContent} onChange={setResourceContent} courseId={courseId} lessonId={lessonId} />
              ) : lessonType === 'tarea' ? (
                <TareaLessonEditor content={tareaContent} onChange={setTareaContent} courseId={courseId} lessonId={lessonId} />
              ) : (
                <div className="space-y-4">
                  <SideImagePanel
                    value={settings.sideImage}
                    onChange={(sideImage) => setSettings(prev => ({ ...prev, sideImage }))}
                    courseId={courseId}
                    lessonId={lessonId}
                  />
                  {(() => {
                    const si = settings.sideImage;
                    const editorEl = (
                      <div className="min-h-[400px]">
                        <RichTextEditor
                          content={wysiwygContent}
                          onChange={setWysiwygContent}
                          placeholder="Comienza a escribir el contenido de tu lección..."
                          className="min-h-[400px]"
                        />
                      </div>
                    );
                    if (!si?.url) return editorEl;
                    const w = Math.min(80, Math.max(20, si.width || 50));
                    const cols = si.position === 'left' ? `${w}% ${100 - w}%` : `${100 - w}% ${w}%`;
                    const imgEl = <SideImagePreview url={si.url} position={si.position} fade={si.fade !== false} focalX={si.focalX ?? 50} />;
                    return (
                      <div
                        className="flex flex-col gap-4 md:grid md:gap-0 md:[grid-template-columns:var(--side-cols)]"
                        style={{ ['--side-cols' as any]: cols }}
                      >
                        {si.position === 'left' ? <>{imgEl}{editorEl}</> : <>{editorEl}{imgEl}</>}
                      </div>
                    );
                  })()}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'settings' && (
        <Card>
          <CardHeader>
            <CardTitle>Configuración de la Lección</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Basic Settings */}
            <div className="space-y-4">
              <h3 className="font-medium">Configuración Básica</h3>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">Lección Obligatoria</Label>
                  <p className="text-sm text-gray-600">
                    Los estudiantes deben completar esta lección para avanzar
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.isRequired}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    isRequired: e.target.checked 
                  }))}
                  className="h-4 w-4 text-red-600 rounded"
                />
              </div>

            </div>

            {/* Quiz-specific settings */}
            {lessonType === 'quiz' && (
              <div className="space-y-4">
                <h3 className="font-medium">Configuración de Quiz</h3>

                <div className="flex items-start justify-between gap-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <div>
                    <Label className="font-medium">No contar para la nota final</Label>
                    <p className="text-sm text-gray-600">
                      Úsalo para quizzes de práctica. No tendrán límite de tiempo ni fecha de cierre.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={!!settings.excludeFromFinalGrade}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      excludeFromFinalGrade: e.target.checked,
                      ...(e.target.checked ? { timeLimit: undefined, dueDate: '', lateSubmissionDeadline: '' } : {}),
                    }))}
                    className="h-4 w-4 text-red-600 rounded mt-1"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="passingScore">Puntuación Mínima (%)</Label>
                    <Input
                      id="passingScore"
                      type="number"
                      value={settings.passingScore || ''}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        passingScore: e.target.value ? parseInt(e.target.value) : undefined
                      }))}
                      placeholder="70"
                      min="0"
                      max="100"
                      className={errors.passingScore ? 'border-red-500' : ''}
                    />
                    {errors.passingScore && (
                      <p className="text-red-500 text-sm mt-1">{errors.passingScore}</p>
                    )}
                  </div>
                  {!settings.excludeFromFinalGrade && (
                    <div>
                      <Label htmlFor="timeLimit">Límite de Tiempo (min)</Label>
                      <Input
                        id="timeLimit"
                        type="number"
                        value={settings.timeLimit || ''}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          timeLimit: e.target.value ? parseInt(e.target.value) : undefined
                        }))}
                        placeholder="Sin límite"
                        min="1"
                      />
                    </div>
                  )}
                  <div>
                    <Label htmlFor="maxAttempts">Máximo de Intentos</Label>
                    <Input
                      id="maxAttempts"
                      type="number"
                      value={settings.maxAttempts || ''}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        maxAttempts: e.target.value ? parseInt(e.target.value) : undefined
                      }))}
                      placeholder="Sin límite"
                      min="1"
                      className={errors.maxAttempts ? 'border-red-500' : ''}
                    />
                    {errors.maxAttempts && (
                      <p className="text-red-500 text-sm mt-1">{errors.maxAttempts}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Fechas - for tarea and for quiz (only when it counts for final grade) */}
            {((lessonType === 'quiz' && !settings.excludeFromFinalGrade) || lessonType === 'tarea') && (
              <div className="space-y-4">
                <h3 className="font-medium">
                  {lessonType === 'tarea' ? 'Fechas de Entrega' : 'Fecha Límite'}
                  <span className="text-xs font-normal text-gray-400 ml-2">(por defecto para nuevas secciones)</span>
                </h3>
                <p className="text-sm text-gray-500">
                  {lessonType === 'tarea'
                    ? 'Fechas por defecto. Cada sección puede sobrescribirlas.'
                    : 'Fecha por defecto. Cada sección puede sobrescribirla.'}
                </p>

                <div className={`grid grid-cols-1 ${lessonType === 'tarea' ? 'md:grid-cols-2' : ''} gap-4`}>
                  <div>
                    <Label htmlFor="dueDate">{lessonType === 'quiz' ? 'Fecha de cierre *' : 'Fecha de entrega *'}</Label>
                    <Input
                      id="dueDate"
                      type="datetime-local"
                      value={settings.dueDate || ''}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        dueDate: e.target.value
                      }))}
                      className={errors.dueDate ? 'border-red-500' : ''}
                    />
                    {errors.dueDate
                      ? <p className="text-red-500 text-xs mt-1">{errors.dueDate}</p>
                      : <p className="text-xs text-gray-500 mt-1">
                          {lessonType === 'tarea'
                            ? 'Después de esta fecha, la entrega se marca como tardía'
                            : 'Después de esta fecha, el quiz no estará disponible'}
                        </p>
                    }
                  </div>

                  {lessonType === 'tarea' && (
                    <div>
                      <Label htmlFor="lateSubmissionDeadline">Cierre definitivo *</Label>
                      <Input
                        id="lateSubmissionDeadline"
                        type="datetime-local"
                        value={settings.lateSubmissionDeadline || ''}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          lateSubmissionDeadline: e.target.value
                        }))}
                        className={errors.lateSubmissionDeadline ? 'border-red-500' : ''}
                      />
                      {errors.lateSubmissionDeadline
                        ? <p className="text-red-500 text-xs mt-1">{errors.lateSubmissionDeadline}</p>
                        : <p className="text-xs text-gray-500 mt-1">
                            Después de esta fecha, no se aceptan entregas
                          </p>
                      }
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Unsaved-changes confirm modal */}
      {confirmLeave && (
        <div
          className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4 animate-fadeIn"
          onClick={handleCancelLeave}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-2xl animate-modalIn"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="unsaved-title"
          >
            <div className="px-6 pt-6 pb-5">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div className="min-w-0">
                  <h3 id="unsaved-title" className="text-base font-semibold text-gray-900">
                    Cambios sin guardar
                  </h3>
                  <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                    Tu lección tiene cambios que aún no se guardaron. Si sales ahora se perderán.
                  </p>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 rounded-b-xl flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2">
              <Button
                variant="outline"
                onClick={handleDiscardFromModal}
                disabled={saving}
                className="group border-gray-300 text-gray-700 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm hover:border-red-300 hover:text-red-700 hover:bg-red-50 active:translate-y-0 active:shadow-none"
              >
                <Trash2 className="h-4 w-4 mr-1.5 transition-transform duration-200 group-hover:rotate-[-8deg]" />
                Descartar cambios
              </Button>
              <div className="flex flex-col-reverse sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={handleCancelLeave}
                  disabled={saving}
                  className="border-gray-300 text-gray-900 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm hover:bg-gray-100 active:translate-y-0 active:shadow-none"
                >
                  Seguir editando
                </Button>
                <Button
                  onClick={handleSaveFromModal}
                  disabled={saving}
                  className="group bg-red-600 transition-all duration-200 hover:bg-red-700 hover:-translate-y-0.5 hover:shadow-md hover:shadow-red-600/20 active:translate-y-0 active:shadow-none"
                >
                  <Save className="h-4 w-4 mr-1.5 transition-transform duration-200 group-hover:scale-110" />
                  {saving ? 'Guardando...' : 'Guardar y salir'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Side image panel (for texto lessons) ──────────────────────────

type SideImageValue = {
  url: string;
  position: 'left' | 'right';
  width?: number;
  fade?: boolean;
  focalX?: number;
};

function SideImagePanel({
  value,
  onChange,
  courseId,
  lessonId,
}: {
  value?: SideImageValue;
  onChange: (v: SideImageValue | undefined) => void;
  courseId?: string;
  lessonId?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const result = await fileUploadService.uploadImage(file, courseId, lessonId);
      onChange({ url: result.url, position: value?.position || 'right' });
    } catch (err: any) {
      console.error('[SideImage] upload failed:', err);
      const msg = err?.message || 'Error desconocido';
      setUploadError(`No se pudo subir: ${msg}. Puedes pegar la URL de una imagen como alternativa.`);
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const applyUrl = () => {
    const url = urlInput.trim();
    if (!url) return;
    onChange({ url, position: value?.position || 'right' });
    setUrlInput('');
    setUploadError(null);
  };

  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Imagen lateral</span>
          <span className="text-xs text-gray-500">— aparece al lado del texto</span>
        </div>
        {value?.url && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800"
          >
            <XIcon className="h-3.5 w-3.5" />
            Quitar
          </button>
        )}
      </div>

      {value?.url ? (
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <img src={value.url} alt="Lateral" className="w-24 h-24 object-cover rounded border border-gray-200 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div>
                <Label className="text-xs text-gray-600">Posición</Label>
                <div className="flex gap-2 mt-1">
                  {(['left', 'right'] as const).map(pos => (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => onChange({ ...value, position: pos })}
                      className={`flex-1 py-1.5 px-3 text-xs rounded border transition-colors ${
                        value.position === pos
                          ? 'bg-red-600 text-white border-red-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      {pos === 'left' ? '◧ Izquierda' : 'Derecha ◨'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-gray-600">Ancho de la imagen</Label>
                  <span className="text-xs font-mono text-gray-500">{value.width ?? 50}%</span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={80}
                  step={5}
                  value={value.width ?? 50}
                  onChange={(e) => onChange({ ...value, width: Number(e.target.value) })}
                  className="w-full h-2 mt-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-red-600"
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-0.5 font-mono">
                  <span>20%</span><span>50%</span><span>80%</span>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-gray-600">Centro horizontal de la foto</Label>
                  <span className="text-xs font-mono text-gray-500">{value.focalX ?? 50}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={value.focalX ?? 50}
                  onChange={(e) => onChange({ ...value, focalX: Number(e.target.value) })}
                  className="w-full h-2 mt-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-red-600"
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                  <span>← Izq</span><span>Centro</span><span>Der →</span>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={value.fade !== false}
                  onChange={(e) => onChange({ ...value, fade: e.target.checked })}
                  className="h-3.5 w-3.5 text-red-600 rounded"
                />
                <span className="text-xs text-gray-600">Difuminar borde hacia el texto</span>
              </label>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-white border border-dashed border-gray-300 rounded cursor-pointer hover:bg-gray-100 text-gray-600">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              <span>{uploading ? 'Subiendo...' : 'Subir imagen'}</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="O pega la URL de una imagen..."
              className="flex-1 text-sm"
            />
            <Button type="button" size="sm" onClick={applyUrl} disabled={!urlInput.trim()}>
              Usar URL
            </Button>
          </div>
          {uploadError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
              {uploadError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function SideImagePreview({
  url,
  position,
  fade,
  focalX = 50,
}: {
  url: string;
  position: 'left' | 'right';
  fade: boolean;
  focalX?: number;
}) {
  // Fade direction: the inner edge (toward the text) fades to white.
  const gradientDir = position === 'left' ? 'to right' : 'to left';
  return (
    <div className="relative min-h-[400px] overflow-hidden bg-gray-100">
      <img
        src={url}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        style={{ objectPosition: `${focalX}% 50%` }}
      />
      {fade && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `linear-gradient(${gradientDir}, transparent 55%, rgba(255,255,255,0.75) 85%, #ffffff 100%)`,
          }}
        />
      )}
    </div>
  );
}