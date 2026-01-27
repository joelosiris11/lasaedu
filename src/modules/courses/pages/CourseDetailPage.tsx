import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@app/store/authStore';
import { courseService, moduleService, lessonService, type DBModule, type DBLesson, type DBCourse } from '@shared/services/dataService';
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
  Users
} from 'lucide-react';
import { Card, CardContent } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { Label } from '@shared/components/ui/Label';

// Tipos locales extendidos para la UI
interface CourseModuleWithLessons extends DBModule {
  lessons: DBLesson[];
}

type CourseData = DBCourse;

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
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [selectedModule, setSelectedModule] = useState<CourseModuleWithLessons | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<DBLesson | null>(null);
  const [currentModuleId, setCurrentModuleId] = useState<string | null>(null);
  
  // Form states
  const [moduleForm, setModuleForm] = useState({ title: '', description: '' });
  const [lessonForm, setLessonForm] = useState({
    title: '',
    type: 'texto' as DBLesson['type'],
    content: '',
    duration: '10'
  });

  const isInstructor = user?.role === 'teacher' || user?.role === 'admin';
  const canEdit = isInstructor && (course?.instructorId === user?.id || user?.role === 'admin');

  useEffect(() => {
    loadCourseData();
  }, [courseId]);

  const loadCourseData = async () => {
    if (!courseId) return;
    
    try {
      setLoading(true);
      
      // Load course
      const courseData = await courseService.getById(courseId);
      if (courseData) {
        setCourse(courseData as CourseData);
      }
      
      // Load modules for this course
      const courseModules = await moduleService.getByCourse(courseId);
      const sortedModules = courseModules.sort((a, b) => a.order - b.order);
      
      // Load lessons for each module
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
      
      // Expand first module by default
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

  const handleCreateModule = () => {
    setSelectedModule(null);
    setModuleForm({ title: '', description: '' });
    setShowModuleModal(true);
  };

  const handleEditModule = (module: CourseModuleWithLessons) => {
    setSelectedModule(module);
    setModuleForm({ title: module.title, description: module.description });
    setShowModuleModal(true);
  };

  const handleSaveModule = async () => {
    if (!courseId || !moduleForm.title.trim()) return;
    
    try {
      if (selectedModule) {
        // Update existing module
        await moduleService.update(selectedModule.id, {
          title: moduleForm.title,
          description: moduleForm.description,
        });
      } else {
        // Create new module
        const now = Date.now();
        await moduleService.create({
          courseId,
          title: moduleForm.title,
          description: moduleForm.description,
          order: modules.length + 1,
          status: 'borrador',
          duration: '0',
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
        // Delete all lessons in the module
        const moduleLessons = await lessonService.getByModule(moduleId);
        await Promise.all(moduleLessons.map(lesson => lessonService.delete(lesson.id)));
        
        // Delete the module
        await moduleService.delete(moduleId);
        loadCourseData();
      } catch (error) {
        console.error('Error deleting module:', error);
      }
    }
  };

  const handleCreateLesson = (moduleId: string) => {
    setCurrentModuleId(moduleId);
    setSelectedLesson(null);
    setLessonForm({
      title: '',
      type: 'texto',
      content: '',
      duration: '10'
    });
    setShowLessonModal(true);
  };

  const handleEditLesson = (lesson: DBLesson) => {
    setCurrentModuleId(lesson.moduleId);
    setSelectedLesson(lesson);
    setLessonForm({
      title: lesson.title,
      type: lesson.type,
      content: lesson.content || '',
      duration: lesson.duration
    });
    setShowLessonModal(true);
  };

  const handleSaveLesson = async () => {
    if (!currentModuleId || !lessonForm.title.trim() || !courseId) return;
    
    try {
      const module = modules.find(m => m.id === currentModuleId);
      
      if (selectedLesson) {
        // Update existing lesson
        await lessonService.update(selectedLesson.id, {
          title: lessonForm.title,
          type: lessonForm.type,
          content: lessonForm.content,
          duration: lessonForm.duration,
        });
      } else {
        // Create new lesson
        const lessonCount = module?.lessons.length || 0;
        const now = Date.now();
        await lessonService.create({
          moduleId: currentModuleId,
          courseId,
          title: lessonForm.title,
          description: '',
          type: lessonForm.type,
          content: lessonForm.content,
          duration: lessonForm.duration,
          order: lessonCount + 1,
          status: 'borrador',
          createdAt: now,
          updatedAt: now,
        });
      }
      
      setShowLessonModal(false);
      loadCourseData();
    } catch (error) {
      console.error('Error saving lesson:', error);
    }
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

      {/* Modules List */}
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
          modules.map((module, moduleIndex) => (
            <Card key={module.id} className="overflow-hidden">
              <div 
                className="flex items-center justify-between p-4 bg-gray-50 cursor-pointer hover:bg-gray-100"
                onClick={() => toggleModuleExpand(module.id)}
              >
                <div className="flex items-center space-x-3">
                  {canEdit && <GripVertical className="h-5 w-5 text-gray-400" />}
                  {expandedModules.has(module.id) ? (
                    <ChevronDown className="h-5 w-5 text-gray-600" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-gray-600" />
                  )}
                  <div>
                    <h3 className="font-medium">
                      Módulo {moduleIndex + 1}: {module.title}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {module.lessons.length} lecciones • 
                      {module.lessons.reduce((sum, l) => sum + parseInt(l.duration || '0'), 0)} min
                    </p>
                  </div>
                </div>
                
                {canEdit && (
                  <div className="flex items-center space-x-2" onClick={e => e.stopPropagation()}>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleCreateLesson(module.id)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleEditModule(module)}
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => handleDeleteModule(module.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              
              {expandedModules.has(module.id) && (
                <div className="border-t">
                  {module.lessons.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      No hay lecciones en este módulo
                      {canEdit && (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="ml-2"
                          onClick={() => handleCreateLesson(module.id)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Agregar
                        </Button>
                      )}
                    </div>
                  ) : (
                    module.lessons.map((lesson, lessonIndex) => (
                      <div 
                        key={lesson.id}
                        className="flex items-center justify-between p-4 border-b last:border-b-0 hover:bg-gray-50"
                      >
                        <div className="flex items-center space-x-3">
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
                            <Button size="sm" variant="outline">
                              <Play className="h-4 w-4 mr-1" />
                              Ver
                            </Button>
                          )}
                          {canEdit && (
                            <>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleEditLesson(lesson)}
                              >
                                <Edit3 className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="text-red-600 hover:bg-red-50"
                                onClick={() => handleDeleteLesson(lesson.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Module Modal */}
      {showModuleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">
              {selectedModule ? 'Editar Módulo' : 'Nuevo Módulo'}
            </h2>
            
            <div className="space-y-4">
              <div>
                <Label>Título del Módulo</Label>
                <Input
                  value={moduleForm.title}
                  onChange={e => setModuleForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Ej: Introducción al curso"
                />
              </div>
              
              <div>
                <Label>Descripción</Label>
                <textarea
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={3}
                  value={moduleForm.description}
                  onChange={e => setModuleForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Breve descripción del módulo..."
                />
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

      {/* Lesson Modal */}
      {showLessonModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4">
              {selectedLesson ? 'Editar Lección' : 'Nueva Lección'}
            </h2>
            
            <div className="space-y-4">
              <div>
                <Label>Título de la Lección</Label>
                <Input
                  value={lessonForm.title}
                  onChange={e => setLessonForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Ej: ¿Qué es programación?"
                />
              </div>
              
              <div>
                <Label>Tipo de Contenido</Label>
                <select
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={lessonForm.type}
                  onChange={e => setLessonForm(prev => ({ 
                    ...prev, 
                    type: e.target.value as DBLesson['type']
                  }))}
                >
                  <option value="texto">Texto/HTML</option>
                  <option value="video">Video</option>
                  <option value="recurso">PDF/Documento</option>
                  <option value="quiz">Quiz</option>
                  <option value="tarea">Tarea</option>
                </select>
              </div>
              
              <div>
                <Label>
                  {lessonForm.type === 'video' ? 'URL del Video' : 
                   lessonForm.type === 'recurso' ? 'URL del Documento' : 
                   'Contenido'}
                </Label>
                {lessonForm.type === 'texto' ? (
                  <textarea
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    rows={6}
                    value={lessonForm.content}
                    onChange={e => setLessonForm(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="Contenido de la lección..."
                  />
                ) : (
                  <Input
                    value={lessonForm.content}
                    onChange={e => setLessonForm(prev => ({ ...prev, content: e.target.value }))}
                    placeholder={
                      lessonForm.type === 'video' ? 'https://youtube.com/watch?v=...' :
                      lessonForm.type === 'recurso' ? 'https://example.com/document.pdf' :
                      'Referencia o ID'
                    }
                  />
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Duración (minutos)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={lessonForm.duration}
                    onChange={e => setLessonForm(prev => ({ 
                      ...prev, 
                      duration: e.target.value
                    }))}
                  />
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-2 mt-6">
              <Button variant="outline" onClick={() => setShowLessonModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveLesson}>
                {selectedLesson ? 'Guardar Cambios' : 'Crear Lección'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
