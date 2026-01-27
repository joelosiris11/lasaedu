import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@app/store/authStore';
import { assessmentService } from '@shared/services/assessmentService';
import { courseService } from '@shared/services/dataService';
import type { Assessment, Question, AssessmentType } from '@shared/types/assessment';
// import QuestionBuilder from '../components/QuestionBuilder';
import { 
  ArrowLeft,
  Plus, 
  Trash2,
  Save,
  Eye,
  Settings,
  ListChecks,
  Clock,
  AlertCircle,
  Edit,
  Play,
  Calendar,
  Users,
  Target,
  BarChart3
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { Label } from '@shared/components/ui/Label';

const ASSESSMENT_TYPES: { value: AssessmentType; label: string; description: string; icon: any }[] = [
  { value: 'quiz', label: 'Quiz', description: 'Evaluación rápida con calificación automática', icon: ListChecks },
  { value: 'exam', label: 'Examen', description: 'Evaluación formal con tiempo limitado', icon: Clock },
  { value: 'assignment', label: 'Tarea', description: 'Trabajo con entrega de archivos', icon: Edit },
  { value: 'practice', label: 'Práctica', description: 'Ejercicio sin calificación', icon: Play },
  { value: 'survey', label: 'Encuesta', description: 'Recopilación de opiniones', icon: BarChart3 }
];

const SHOW_RESULTS_OPTIONS = [
  { value: 'immediately', label: 'Inmediatamente' },
  { value: 'after_submission', label: 'Después de enviar' },
  { value: 'after_due', label: 'Después de la fecha límite' },
  { value: 'manual', label: 'Manualmente' },
  { value: 'never', label: 'Nunca' }
];

const GRADING_SCALES = [
  { value: 'points', label: 'Puntos' },
  { value: 'percentage', label: 'Porcentaje' },
  { value: 'letter', label: 'Letras (A, B, C, D, F)' }
];

export default function EvaluationBuilderPage() {
  const { evaluationId } = useParams<{ evaluationId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  const isNew = evaluationId === 'new';
  const courseIdParam = searchParams.get('courseId');
  const moduleIdParam = searchParams.get('moduleId');
  
  const [assessment, setAssessment] = useState<Partial<Assessment>>({
    type: 'quiz',
    title: '',
    description: '',
    instructions: '',
    courseId: courseIdParam || '',
    moduleId: moduleIdParam || undefined,
    status: 'draft',
    questions: [],
    settings: {
      timeLimit: 30,
      attempts: 1,
      shuffleQuestions: false,
      shuffleAnswers: true,
      showResults: 'immediately',
      showCorrectAnswers: 'after_submission',
      allowBacktrack: true,
      preventCheating: false,
      showProgressBar: true,
      autoSubmit: true
    },
    grading: {
      passingScore: 60,
      gradingScale: 'percentage',
      allowPartialCredit: true,
      penaltyForWrongAnswers: 0,
      manualGrading: false
    }
  });
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const [activeTab, setActiveTab] = useState<'info' | 'questions' | 'settings'>('info');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
  const [showQuestionBuilder, setShowQuestionBuilder] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | undefined>();
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadData();
  }, [evaluationId, courseIdParam]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load courses for selection
      const allCourses = await courseService.getAll();
      setCourses(allCourses.map(c => ({ id: c.id, title: c.title })));

      // Load existing assessment if editing
      if (evaluationId && evaluationId !== 'new') {
        const existingAssessment = await assessmentService.getAssessment(evaluationId);
        if (existingAssessment) {
          setAssessment(existingAssessment);
          // TODO: Load actual questions from question bank
          const mockQuestions: Question[] = existingAssessment.questions.map((aq, index) => ({
            id: aq.questionId,
            type: 'single_choice',
            question: `Pregunta de ejemplo ${index + 1}`,
            options: [
              { id: '1', text: 'Opción A', isCorrect: true },
              { id: '2', text: 'Opción B', isCorrect: false }
            ],
            correctAnswer: '1',
            points: aq.points,
            difficulty: 'medium',
            tags: []
          }));
          setQuestions(mockQuestions);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const validateAssessment = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!assessment.title?.trim()) {
      newErrors.title = 'El título es obligatorio';
    }

    if (!assessment.courseId) {
      newErrors.courseId = 'Debe seleccionar un curso';
    }

    if (questions.length === 0) {
      newErrors.questions = 'Debe agregar al menos una pregunta';
    }

    if (assessment.grading?.passingScore && (assessment.grading.passingScore < 0 || assessment.grading.passingScore > 100)) {
      newErrors.passingScore = 'La puntuación mínima debe estar entre 0 y 100';
    }

    if (assessment.settings?.timeLimit && assessment.settings.timeLimit <= 0) {
      newErrors.timeLimit = 'El límite de tiempo debe ser mayor a 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateAssessment()) return;

    setSaving(true);
    try {
      const assessmentData: Omit<Assessment, 'id'> = {
        type: assessment.type!,
        title: assessment.title!,
        description: assessment.description || '',
        instructions: assessment.instructions || '',
        courseId: assessment.courseId!,
        moduleId: assessment.moduleId,
        status: assessment.status || 'draft',
        questions: questions.map((question, index) => ({
          questionId: question.id,
          order: index + 1,
          points: question.points,
          required: true
        })),
        settings: assessment.settings!,
        grading: assessment.grading!,
        createdBy: user!.id,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      if (isNew) {
        const created = await assessmentService.createAssessment(assessmentData);
        navigate(`/evaluations/${created.id}/edit`);
      } else {
        await assessmentService.updateAssessment(evaluationId!, assessmentData);
      }

      console.log('Assessment saved successfully');
    } catch (error) {
      console.error('Error saving assessment:', error);
      setErrors({ submit: 'Error al guardar la evaluación. Intenta de nuevo.' });
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!validateAssessment()) return;

    setAssessment(prev => ({ ...prev, status: 'published' }));
    await handleSave();
  };

  const handleQuestionSave = (question: Question) => {
    if (editingQuestion) {
      setQuestions(prev => prev.map(q => q.id === question.id ? question : q));
    } else {
      setQuestions(prev => [...prev, question]);
    }
    setShowQuestionBuilder(false);
    setEditingQuestion(undefined);
    
    // Clear questions error if questions now exist
    if (errors.questions) {
      setErrors(prev => ({ ...prev, questions: '' }));
    }
  };

  const handleEditQuestion = (question: Question) => {
    setEditingQuestion(question);
    setShowQuestionBuilder(true);
  };

  const handleDeleteQuestion = (questionId: string) => {
    if (confirm('¿Estás seguro de eliminar esta pregunta?')) {
      setQuestions(prev => prev.filter(q => q.id !== questionId));
    }
  };

  const getTotalPoints = () => {
    return questions.reduce((sum, q) => sum + q.points, 0);
  };

  const getQuestionTypeName = (type: Question['type']) => {
    const typeMap = {
      single_choice: 'Selección única',
      multiple_choice: 'Selección múltiple',
      true_false: 'Verdadero/Falso',
      short_answer: 'Respuesta corta',
      long_answer: 'Respuesta larga',
      essay: 'Ensayo',
      matching: 'Emparejar',
      ordering: 'Ordenar',
      fill_blank: 'Completar',
      hotspot: 'Punto caliente',
      file_upload: 'Subir archivo'
    };
    return typeMap[type] || type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (showQuestionBuilder) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-4">Constructor de Preguntas</h2>
          <p className="text-gray-600 mb-6">Esta funcionalidad estará disponible próximamente</p>
          <Button onClick={() => setShowQuestionBuilder(false)}>
            Volver
          </Button>
        </div>
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
            onClick={() => navigate('/evaluations')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Evaluaciones
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {isNew ? 'Nueva Evaluación' : 'Editar Evaluación'}
            </h1>
            <p className="text-gray-600">
              {assessment.status === 'draft' ? 'Borrador' : 'Publicada'} • {questions.length} preguntas • {getTotalPoints()} puntos
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {assessment.status === 'published' && (
            <Button variant="outline">
              <Eye className="w-4 h-4 mr-2" />
              Vista Previa
            </Button>
          )}
          {assessment.status === 'draft' && (
            <Button variant="outline" onClick={handlePublish}>
              <Play className="w-4 h-4 mr-2" />
              Publicar
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
        {[
          { id: 'info', label: 'Información', icon: Edit },
          { id: 'questions', label: 'Preguntas', icon: ListChecks },
          { id: 'settings', label: 'Configuración', icon: Settings }
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 font-medium flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.id === 'questions' && questions.length > 0 && (
                <span className="bg-blue-100 text-blue-600 text-xs px-2 py-1 rounded-full">
                  {questions.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'info' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Información Básica</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  value={assessment.title || ''}
                  onChange={(e) => setAssessment(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Ej: Quiz Módulo 1 - Introducción"
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
                  value={assessment.description || ''}
                  onChange={(e) => setAssessment(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descripción breve de la evaluación"
                  className="w-full min-h-[80px] p-3 border rounded-lg resize-none border-gray-300"
                />
              </div>

              <div>
                <Label htmlFor="instructions">Instrucciones para Estudiantes</Label>
                <textarea
                  id="instructions"
                  value={assessment.instructions || ''}
                  onChange={(e) => setAssessment(prev => ({ ...prev, instructions: e.target.value }))}
                  placeholder="Instrucciones específicas para completar esta evaluación"
                  className="w-full min-h-[100px] p-3 border rounded-lg resize-none border-gray-300"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="type">Tipo de Evaluación</Label>
                  <select
                    id="type"
                    value={assessment.type}
                    onChange={(e) => setAssessment(prev => ({ ...prev, type: e.target.value as AssessmentType }))}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  >
                    {ASSESSMENT_TYPES.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label} - {type.description}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="course">Curso *</Label>
                  <select
                    id="course"
                    value={assessment.courseId}
                    onChange={(e) => setAssessment(prev => ({ ...prev, courseId: e.target.value }))}
                    className={`w-full p-2 border rounded-lg ${errors.courseId ? 'border-red-500' : 'border-gray-300'}`}
                  >
                    <option value="">Seleccionar curso...</option>
                    {courses.map(course => (
                      <option key={course.id} value={course.id}>
                        {course.title}
                      </option>
                    ))}
                  </select>
                  {errors.courseId && (
                    <p className="text-red-500 text-sm mt-1">{errors.courseId}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'questions' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold">Preguntas</h2>
              <p className="text-gray-600">
                {questions.length} preguntas • Total: {getTotalPoints()} puntos
              </p>
            </div>
            <Button onClick={() => setShowQuestionBuilder(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Agregar Pregunta
            </Button>
          </div>

          {errors.questions && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">{errors.questions}</p>
            </div>
          )}

          {questions.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <ListChecks className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No hay preguntas aún
                  </h3>
                  <p className="text-gray-600 mb-6">
                    Agrega preguntas para comenzar a crear tu evaluación
                  </p>
                  <Button onClick={() => setShowQuestionBuilder(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Crear Primera Pregunta
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {questions.map((question, index) => (
                <Card key={question.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-sm font-medium text-gray-500">
                            Pregunta {index + 1}
                          </span>
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            {getQuestionTypeName(question.type)}
                          </span>
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                            {question.points} pts
                          </span>
                          <span className={`text-xs px-2 py-1 rounded ${
                            question.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
                            question.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {question.difficulty === 'easy' ? 'Fácil' : 
                             question.difficulty === 'medium' ? 'Medio' : 'Difícil'}
                          </span>
                        </div>
                        <p className="text-gray-900 font-medium mb-1">
                          {question.question || 'Sin contenido'}
                        </p>
                        {question.options && question.options.length > 0 && (
                          <div className="text-sm text-gray-600">
                            {question.options.length} opciones
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditQuestion(question)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteQuestion(question.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="space-y-6">
          {/* Time and Attempts */}
          <Card>
            <CardHeader>
              <CardTitle>Tiempo y Intentos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="timeLimit">Límite de Tiempo (minutos)</Label>
                  <Input
                    id="timeLimit"
                    type="number"
                    value={assessment.settings?.timeLimit || ''}
                    onChange={(e) => setAssessment(prev => ({
                      ...prev,
                      settings: { ...prev.settings!, timeLimit: parseInt(e.target.value) || undefined }
                    }))}
                    placeholder="Sin límite"
                    min="1"
                    className={errors.timeLimit ? 'border-red-500' : ''}
                  />
                  {errors.timeLimit && (
                    <p className="text-red-500 text-sm mt-1">{errors.timeLimit}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="attempts">Intentos Permitidos</Label>
                  <Input
                    id="attempts"
                    type="number"
                    value={assessment.settings?.attempts || ''}
                    onChange={(e) => setAssessment(prev => ({
                      ...prev,
                      settings: { ...prev.settings!, attempts: parseInt(e.target.value) || undefined }
                    }))}
                    placeholder="Sin límite"
                    min="1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dueDate">Fecha Límite</Label>
                  <Input
                    id="dueDate"
                    type="datetime-local"
                    value={assessment.settings?.dueDate ? new Date(assessment.settings.dueDate).toISOString().slice(0, 16) : ''}
                    onChange={(e) => setAssessment(prev => ({
                      ...prev,
                      settings: { ...prev.settings!, dueDate: e.target.value ? new Date(e.target.value).getTime() : undefined }
                    }))}
                  />
                </div>

                <div>
                  <Label htmlFor="availableFrom">Disponible desde</Label>
                  <Input
                    id="availableFrom"
                    type="datetime-local"
                    value={assessment.settings?.availableFrom ? new Date(assessment.settings.availableFrom).toISOString().slice(0, 16) : ''}
                    onChange={(e) => setAssessment(prev => ({
                      ...prev,
                      settings: { ...prev.settings!, availableFrom: e.target.value ? new Date(e.target.value).getTime() : undefined }
                    }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Display Options */}
          <Card>
            <CardHeader>
              <CardTitle>Opciones de Visualización</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="showResults">Mostrar Resultados</Label>
                  <select
                    id="showResults"
                    value={assessment.settings?.showResults}
                    onChange={(e) => setAssessment(prev => ({
                      ...prev,
                      settings: { ...prev.settings!, showResults: e.target.value as any }
                    }))}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  >
                    {SHOW_RESULTS_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="showCorrectAnswers">Mostrar Respuestas Correctas</Label>
                  <select
                    id="showCorrectAnswers"
                    value={assessment.settings?.showCorrectAnswers}
                    onChange={(e) => setAssessment(prev => ({
                      ...prev,
                      settings: { ...prev.settings!, showCorrectAnswers: e.target.value as any }
                    }))}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  >
                    {SHOW_RESULTS_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={assessment.settings?.shuffleQuestions}
                      onChange={(e) => setAssessment(prev => ({
                        ...prev,
                        settings: { ...prev.settings!, shuffleQuestions: e.target.checked }
                      }))}
                      className="h-4 w-4"
                    />
                    <span>Aleatorizar preguntas</span>
                  </label>

                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={assessment.settings?.shuffleAnswers}
                      onChange={(e) => setAssessment(prev => ({
                        ...prev,
                        settings: { ...prev.settings!, shuffleAnswers: e.target.checked }
                      }))}
                      className="h-4 w-4"
                    />
                    <span>Aleatorizar opciones</span>
                  </label>

                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={assessment.settings?.allowBacktrack}
                      onChange={(e) => setAssessment(prev => ({
                        ...prev,
                        settings: { ...prev.settings!, allowBacktrack: e.target.checked }
                      }))}
                      className="h-4 w-4"
                    />
                    <span>Permitir navegar hacia atrás</span>
                  </label>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={assessment.settings?.showProgressBar}
                      onChange={(e) => setAssessment(prev => ({
                        ...prev,
                        settings: { ...prev.settings!, showProgressBar: e.target.checked }
                      }))}
                      className="h-4 w-4"
                    />
                    <span>Mostrar barra de progreso</span>
                  </label>

                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={assessment.settings?.autoSubmit}
                      onChange={(e) => setAssessment(prev => ({
                        ...prev,
                        settings: { ...prev.settings!, autoSubmit: e.target.checked }
                      }))}
                      className="h-4 w-4"
                    />
                    <span>Envío automático al finalizar tiempo</span>
                  </label>

                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={assessment.settings?.preventCheating}
                      onChange={(e) => setAssessment(prev => ({
                        ...prev,
                        settings: { ...prev.settings!, preventCheating: e.target.checked }
                      }))}
                      className="h-4 w-4"
                    />
                    <span>Prevenir trucos (pantalla completa)</span>
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Grading */}
          <Card>
            <CardHeader>
              <CardTitle>Calificación</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="passingScore">Puntuación Mínima (%)</Label>
                  <Input
                    id="passingScore"
                    type="number"
                    value={assessment.grading?.passingScore || ''}
                    onChange={(e) => setAssessment(prev => ({
                      ...prev,
                      grading: { ...prev.grading!, passingScore: parseInt(e.target.value) || 0 }
                    }))}
                    min="0"
                    max="100"
                    className={errors.passingScore ? 'border-red-500' : ''}
                  />
                  {errors.passingScore && (
                    <p className="text-red-500 text-sm mt-1">{errors.passingScore}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="gradingScale">Escala de Calificación</Label>
                  <select
                    id="gradingScale"
                    value={assessment.grading?.gradingScale}
                    onChange={(e) => setAssessment(prev => ({
                      ...prev,
                      grading: { ...prev.grading!, gradingScale: e.target.value as any }
                    }))}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  >
                    {GRADING_SCALES.map(scale => (
                      <option key={scale.value} value={scale.value}>
                        {scale.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="penalty">Penalización por Error (%)</Label>
                  <Input
                    id="penalty"
                    type="number"
                    value={assessment.grading?.penaltyForWrongAnswers || ''}
                    onChange={(e) => setAssessment(prev => ({
                      ...prev,
                      grading: { ...prev.grading!, penaltyForWrongAnswers: parseInt(e.target.value) || 0 }
                    }))}
                    min="0"
                    max="100"
                  />
                </div>
              </div>

              <div className="flex gap-6">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={assessment.grading?.allowPartialCredit}
                    onChange={(e) => setAssessment(prev => ({
                      ...prev,
                      grading: { ...prev.grading!, allowPartialCredit: e.target.checked }
                    }))}
                    className="h-4 w-4"
                  />
                  <span>Permitir puntaje parcial</span>
                </label>

                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={assessment.grading?.manualGrading}
                    onChange={(e) => setAssessment(prev => ({
                      ...prev,
                      grading: { ...prev.grading!, manualGrading: e.target.checked }
                    }))}
                    className="h-4 w-4"
                  />
                  <span>Calificación manual requerida</span>
                </label>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}