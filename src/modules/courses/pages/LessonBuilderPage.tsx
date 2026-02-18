import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  lessonService, 
  moduleService, 
  type DBLesson, 
  type DBModule 
} from '@shared/services/dataService';
import ContentEditor from '../components/ContentEditor';
import { RichTextEditor } from '@shared/components/editor';
import {
  ArrowLeft,
  Save,
  Eye,
  Settings,
  BookOpen,
  Video,
  Headphones,
  FileText,
  HelpCircle,
  Layers,
  Type,
  MessageSquare
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { Label } from '@shared/components/ui/Label';
import ForumLessonEditor, { type ForumLessonContent, defaultForumContent } from '../components/ForumLessonEditor';
import QuizLessonEditor, { type QuizLessonContent, defaultQuizContent } from '../components/QuizLessonEditor';

interface ContentBlock {
  id: string;
  type: 'text' | 'heading' | 'image' | 'video' | 'audio' | 'file' | 'code' | 'quote';
  content: string;
  metadata?: any;
  formatting?: any;
  order: number;
}

interface LessonSettings {
  isRequired: boolean;
  timeLimit?: number;
  allowComments: boolean;
  showProgress: boolean;
  allowDownload: boolean;
  passingScore?: number;
  maxAttempts?: number;
  availableFrom?: string;
  availableUntil?: string;
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
  const [content, setContent] = useState<ContentBlock[]>([]);
  const [editorMode, setEditorMode] = useState<'blocks' | 'wysiwyg'>('blocks');
  const [wysiwygContent, setWysiwygContent] = useState('');
  const [settings, setSettings] = useState<LessonSettings>({
    isRequired: true,
    allowComments: true,
    showProgress: true,
    allowDownload: false
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
            // Check if content is WYSIWYG (has editorMode field) or block-based
            } else if (parsedContent && typeof parsedContent === 'object' && parsedContent.editorMode === 'wysiwyg') {
              setEditorMode('wysiwyg');
              setWysiwygContent(parsedContent.html || '');
              setContent([]);
            } else {
              setEditorMode('blocks');
              setContent(Array.isArray(parsedContent) ? parsedContent : []);
            }
          } catch {
            // If parsing fails, check if it's HTML content
            if (typeof lessonData.content === 'string' && lessonData.content.includes('<')) {
              setEditorMode('wysiwyg');
              setWysiwygContent(lessonData.content);
              setContent([]);
            } else {
              setEditorMode('blocks');
              setContent([]);
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
    } else if (editorMode === 'blocks' && content.length === 0) {
      newErrors.content = 'La lección debe tener al menos un bloque de contenido';
    } else if (editorMode === 'wysiwyg' && !wysiwygContent.trim()) {
      newErrors.content = 'La lección debe tener contenido';
    }

    if (lessonType === 'quiz' && settings.passingScore !== undefined && (settings.passingScore < 0 || settings.passingScore > 100)) {
      newErrors.passingScore = 'La puntuación mínima debe estar entre 0 y 100';
    }

    if (settings.maxAttempts !== undefined && settings.maxAttempts < 1) {
      newErrors.maxAttempts = 'Debe permitir al menos 1 intento';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm() || !courseId || !moduleId) return;

    setSaving(true);
    try {
      // Prepare content based on lesson type / editor mode
      const contentToSave = lessonType === 'foro'
        ? JSON.stringify(forumContent)
        : lessonType === 'quiz'
          ? JSON.stringify(quizContent)
          : editorMode === 'wysiwyg'
            ? JSON.stringify({ editorMode: 'wysiwyg', html: wysiwygContent })
            : JSON.stringify(content);

      const lessonData: Partial<DBLesson> = {
        title: title.trim(),
        description: description.trim() || undefined,
        type: lessonType,
        content: contentToSave,
        settings,
        moduleId,
        courseId,
        updatedAt: Date.now()
      };

      if (lessonId) {
        // Update existing lesson
        await lessonService.update(lessonId, lessonData);
      } else {
        // Create new lesson
        const existingLessons = await lessonService.getByModule(moduleId);
        
        const newLesson: Omit<DBLesson, 'id'> = {
          ...lessonData,
          order: existingLessons.length,
          createdAt: Date.now()
        } as Omit<DBLesson, 'id'>;

        const createdLesson = await lessonService.create(newLesson);
        navigate(`/courses/${courseId}/modules/${moduleId}/lessons/${createdLesson.id}/edit`);
      }

      // Show success message or redirect
      console.log('Lesson saved successfully');
    } catch (error) {
      console.error('Error saving lesson:', error);
      setErrors({ submit: 'Error al guardar la lección. Intenta de nuevo.' });
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = () => {
    if (lessonId) {
      navigate(`/courses/${courseId}/lesson/${lessonId}`);
    }
  };

  const handleContentChange = (newContent: ContentBlock[]) => {
    setContent(newContent);
    if (errors.content) {
      setErrors(prev => ({ ...prev, content: '' }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate(`/courses/${courseId}`)}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al Curso
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {lessonId ? 'Editar Lección' : 'Nueva Lección'}
            </h1>
            <p className="text-gray-600">
              Módulo: {module?.title}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {lessonId && (
            <Button variant="outline" onClick={handlePreview}>
              <Eye className="w-4 h-4 mr-2" />
              Vista Previa
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </div>

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
              ? 'border-b-2 border-blue-500 text-blue-600'
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
              ? 'border-b-2 border-blue-500 text-blue-600'
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
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Icon className={`w-6 h-6 mb-2 ${
                          lessonType === type.value ? 'text-blue-600' : 'text-gray-600'
                        }`} />
                        <h4 className="font-medium mb-1">{type.label}</h4>
                        <p className="text-sm text-gray-600">{type.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Content Editor */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  {lessonType === 'foro' ? 'Configuración del Foro' : lessonType === 'quiz' ? 'Preguntas del Quiz' : 'Contenido de la Lección'}
                </CardTitle>
                {lessonType !== 'foro' && lessonType !== 'quiz' && (
                  <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => setEditorMode('blocks')}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        editorMode === 'blocks'
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <Layers className="w-4 h-4" />
                      Bloques
                    </button>
                    <button
                      onClick={() => setEditorMode('wysiwyg')}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        editorMode === 'wysiwyg'
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <Type className="w-4 h-4" />
                      WYSIWYG
                    </button>
                  </div>
                )}
              </div>
              {lessonType !== 'foro' && lessonType !== 'quiz' && (
                <p className="text-sm text-gray-600 mt-2">
                  {editorMode === 'blocks'
                    ? 'Editor de bloques: añade texto, imágenes, videos y más como bloques independientes'
                    : 'Editor WYSIWYG: escribe y formatea contenido como en un procesador de texto'
                  }
                </p>
              )}
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
              ) : editorMode === 'blocks' ? (
                <ContentEditor
                  initialContent={JSON.stringify(content)}
                  onSave={setContent}
                  onContentChange={handleContentChange}
                  lessonType={lessonType === 'quiz' ? 'text' : lessonType === 'texto' ? 'text' : lessonType === 'recurso' ? 'audio' : lessonType === 'tarea' ? 'text' : 'text'}
                  courseId={courseId}
                  lessonId={lessonId}
                />
              ) : (
                <div className="min-h-[400px]">
                  <RichTextEditor
                    content={wysiwygContent}
                    onChange={setWysiwygContent}
                    placeholder="Comienza a escribir el contenido de tu lección..."
                    className="min-h-[400px]"
                  />
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
                  className="h-4 w-4 text-blue-600 rounded"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">Permitir Comentarios</Label>
                  <p className="text-sm text-gray-600">
                    Los estudiantes pueden hacer preguntas y comentarios
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.allowComments}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    allowComments: e.target.checked 
                  }))}
                  className="h-4 w-4 text-blue-600 rounded"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">Mostrar Progreso</Label>
                  <p className="text-sm text-gray-600">
                    Mostrar barra de progreso durante la lección
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.showProgress}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    showProgress: e.target.checked 
                  }))}
                  className="h-4 w-4 text-blue-600 rounded"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">Permitir Descarga</Label>
                  <p className="text-sm text-gray-600">
                    Permitir a los estudiantes descargar el contenido
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.allowDownload}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    allowDownload: e.target.checked 
                  }))}
                  className="h-4 w-4 text-blue-600 rounded"
                />
              </div>
            </div>

            {/* Time Settings */}
            <div className="space-y-4">
              <h3 className="font-medium">Configuración de Tiempo</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="timeLimit">Límite de Tiempo (minutos)</Label>
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
                  <p className="text-sm text-gray-600 mt-1">
                    Dejar vacío para sin límite de tiempo
                  </p>
                </div>

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

            {/* Quiz-specific settings */}
            {lessonType === 'quiz' && (
              <div className="space-y-4">
                <h3 className="font-medium">Configuración de Quiz</h3>
                
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
              </div>
            )}

            {/* Availability Settings */}
            <div className="space-y-4">
              <h3 className="font-medium">Disponibilidad</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="availableFrom">Disponible desde</Label>
                  <Input
                    id="availableFrom"
                    type="datetime-local"
                    value={settings.availableFrom || ''}
                    onChange={(e) => setSettings(prev => ({ 
                      ...prev, 
                      availableFrom: e.target.value 
                    }))}
                  />
                </div>

                <div>
                  <Label htmlFor="availableUntil">Disponible hasta</Label>
                  <Input
                    id="availableUntil"
                    type="datetime-local"
                    value={settings.availableUntil || ''}
                    onChange={(e) => setSettings(prev => ({ 
                      ...prev, 
                      availableUntil: e.target.value 
                    }))}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}