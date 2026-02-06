import { useState, useRef } from 'react';
import {
  Plus,
  X,
  Save,
  Eye,
  CheckCircle,
  Square,
  List,
  ArrowUpDown,
  Target,
  Upload,
  Edit3,
  Trash2,
  FileText
} from 'lucide-react';
import { Button } from '@shared/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/Card';
import { Input } from '@shared/components/ui/Input';
import { Label } from '@shared/components/ui/Label';
import type { Question, QuestionType, QuestionOption } from '@shared/types/assessment';
// import { fileUploadService } from '@shared/services/fileUploadService';

interface QuestionBuilderProps {
  question?: Question;
  onSave: (question: Question) => void;
  onCancel: () => void;
  courseId?: string;
  assessmentId?: string;
}

const QUESTION_TYPES = [
  { 
    value: 'single_choice', 
    label: 'Selección Única', 
    icon: CheckCircle, 
    description: 'Una sola respuesta correcta'
  },
  { 
    value: 'multiple_choice', 
    label: 'Selección Múltiple', 
    icon: Square, 
    description: 'Múltiples respuestas correctas'
  },
  { 
    value: 'true_false', 
    label: 'Verdadero/Falso', 
    icon: Target, 
    description: 'Pregunta binaria'
  },
  { 
    value: 'short_answer', 
    label: 'Respuesta Corta', 
    icon: Edit3, 
    description: 'Texto de una línea'
  },
  { 
    value: 'long_answer', 
    label: 'Respuesta Larga', 
    icon: FileText, 
    description: 'Párrafo de texto'
  },
  { 
    value: 'fill_blank', 
    label: 'Completar Espacios', 
    icon: Square, 
    description: 'Llenar palabras faltantes'
  },
  { 
    value: 'matching', 
    label: 'Emparejar', 
    icon: ArrowUpDown, 
    description: 'Conectar elementos'
  },
  { 
    value: 'ordering', 
    label: 'Ordenar', 
    icon: List, 
    description: 'Secuencia correcta'
  },
  { 
    value: 'file_upload', 
    label: 'Subir Archivo', 
    icon: Upload, 
    description: 'Adjuntar documento'
  }
] as const;

const DIFFICULTY_LEVELS = [
  { value: 'easy', label: 'Fácil', color: 'text-green-600' },
  { value: 'medium', label: 'Medio', color: 'text-yellow-600' },
  { value: 'hard', label: 'Difícil', color: 'text-red-600' }
];

export default function QuestionBuilder({ 
  question, 
  onSave, 
  onCancel,
  courseId,
  assessmentId 
}: QuestionBuilderProps) {
  const [questionData, setQuestionData] = useState<Partial<Question>>(question || {
    type: 'single_choice',
    question: '',
    options: [
      { id: '1', text: '', isCorrect: false },
      { id: '2', text: '', isCorrect: false }
    ],
    points: 1,
    difficulty: 'medium',
    tags: [],
    metadata: {}
  });

  const [showPreview, setShowPreview] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tagInput, setTagInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateQuestion = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!questionData.question?.trim()) {
      newErrors.question = 'La pregunta es obligatoria';
    }

    if (!questionData.points || questionData.points <= 0) {
      newErrors.points = 'Los puntos deben ser mayor a 0';
    }

    // Validate by question type
    switch (questionData.type) {
      case 'single_choice':
      case 'multiple_choice':
        if (!questionData.options || questionData.options.length < 2) {
          newErrors.options = 'Debe tener al menos 2 opciones';
        } else {
          const correctOptions = questionData.options.filter(opt => opt.isCorrect);
          if (questionData.type === 'single_choice' && correctOptions.length !== 1) {
            newErrors.options = 'Debe tener exactamente una respuesta correcta';
          } else if (questionData.type === 'multiple_choice' && correctOptions.length === 0) {
            newErrors.options = 'Debe tener al menos una respuesta correcta';
          }
        }
        break;
      
      case 'true_false':
        if (!questionData.correctAnswer) {
          newErrors.correctAnswer = 'Debe seleccionar la respuesta correcta';
        }
        break;
      
      case 'short_answer':
      case 'long_answer':
        if (!questionData.correctAnswer?.trim()) {
          newErrors.correctAnswer = 'Debe proporcionar la respuesta correcta';
        }
        break;
      
      case 'matching':
        if (!questionData.correctAnswer || questionData.correctAnswer.length < 2) {
          newErrors.correctAnswer = 'Debe tener al menos 2 pares';
        }
        break;
      
      case 'ordering':
        if (!questionData.correctAnswer || questionData.correctAnswer.length < 2) {
          newErrors.correctAnswer = 'Debe tener al menos 2 elementos';
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateQuestion()) return;

    const finalQuestion: Question = {
      id: questionData.id || Date.now().toString(),
      type: questionData.type as QuestionType,
      question: questionData.question!,
      options: questionData.options,
      correctAnswer: questionData.correctAnswer,
      points: questionData.points!,
      explanation: questionData.explanation,
      difficulty: questionData.difficulty!,
      category: questionData.category,
      tags: questionData.tags,
      metadata: questionData.metadata
    };

    onSave(finalQuestion);
  };

  const addOption = () => {
    const newOption: QuestionOption = {
      id: Date.now().toString(),
      text: '',
      isCorrect: false
    };
    setQuestionData(prev => ({
      ...prev,
      options: [...(prev.options || []), newOption]
    }));
  };

  const removeOption = (optionId: string) => {
    setQuestionData(prev => ({
      ...prev,
      options: prev.options?.filter(opt => opt.id !== optionId)
    }));
  };

  const updateOption = (optionId: string, updates: Partial<QuestionOption>) => {
    setQuestionData(prev => ({
      ...prev,
      options: prev.options?.map(opt => 
        opt.id === optionId ? { ...opt, ...updates } : opt
      )
    }));
  };

  const handleCorrectAnswerChange = (optionId: string) => {
    if (questionData.type === 'single_choice') {
      // Only one correct answer for single choice
      setQuestionData(prev => ({
        ...prev,
        options: prev.options?.map(opt => ({
          ...opt,
          isCorrect: opt.id === optionId
        }))
      }));
    } else if (questionData.type === 'multiple_choice') {
      // Toggle correct answer for multiple choice
      updateOption(optionId, { 
        isCorrect: !questionData.options?.find(opt => opt.id === optionId)?.isCorrect 
      });
    }
  };

  const addTag = () => {
    if (tagInput.trim() && !questionData.tags?.includes(tagInput.trim())) {
      setQuestionData(prev => ({
        ...prev,
        tags: [...(prev.tags || []), tagInput.trim()]
      }));
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setQuestionData(prev => ({
      ...prev,
      tags: prev.tags?.filter(t => t !== tag)
    }));
  };

  const renderQuestionTypeEditor = () => {
    switch (questionData.type) {
      case 'single_choice':
      case 'multiple_choice':
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label>Opciones de Respuesta</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addOption}
              >
                <Plus className="w-4 h-4 mr-2" />
                Agregar Opción
              </Button>
            </div>
            {questionData.options?.map((option, index) => (
              <div key={option.id} className="flex items-start gap-3 p-3 border rounded-lg">
                <div className="flex items-center mt-2">
                  {questionData.type === 'single_choice' ? (
                    <input
                      type="radio"
                      name="correct-answer"
                      checked={option.isCorrect}
                      onChange={() => handleCorrectAnswerChange(option.id)}
                      className="h-4 w-4 text-blue-600"
                    />
                  ) : (
                    <input
                      type="checkbox"
                      checked={option.isCorrect}
                      onChange={() => handleCorrectAnswerChange(option.id)}
                      className="h-4 w-4 text-blue-600 rounded"
                    />
                  )}
                </div>
                <div className="flex-1">
                  <Input
                    value={option.text}
                    onChange={(e) => updateOption(option.id, { text: e.target.value })}
                    placeholder={`Opción ${index + 1}`}
                  />
                  {option.isCorrect && (
                    <Input
                      value={option.explanation || ''}
                      onChange={(e) => updateOption(option.id, { explanation: e.target.value })}
                      placeholder="Explicación (opcional)"
                      className="mt-2"
                    />
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeOption(option.id)}
                  className="text-red-500"
                  disabled={questionData.options!.length <= 2}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            {errors.options && (
              <p className="text-red-500 text-sm">{errors.options}</p>
            )}
          </div>
        );

      case 'true_false':
        return (
          <div className="space-y-4">
            <Label>Respuesta Correcta</Label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setQuestionData(prev => ({ ...prev, correctAnswer: true }))}
                className={`p-4 border rounded-lg text-center ${
                  questionData.correctAnswer === true ? 'border-green-500 bg-green-50' : 'border-gray-300'
                }`}
              >
                <CheckCircle className="w-6 h-6 mx-auto mb-2 text-green-600" />
                Verdadero
              </button>
              <button
                type="button"
                onClick={() => setQuestionData(prev => ({ ...prev, correctAnswer: false }))}
                className={`p-4 border rounded-lg text-center ${
                  questionData.correctAnswer === false ? 'border-red-500 bg-red-50' : 'border-gray-300'
                }`}
              >
                <X className="w-6 h-6 mx-auto mb-2 text-red-600" />
                Falso
              </button>
            </div>
            {errors.correctAnswer && (
              <p className="text-red-500 text-sm">{errors.correctAnswer}</p>
            )}
          </div>
        );

      case 'short_answer':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="correct-answer">Respuesta Correcta</Label>
              <Input
                id="correct-answer"
                value={questionData.correctAnswer || ''}
                onChange={(e) => setQuestionData(prev => ({ 
                  ...prev, 
                  correctAnswer: e.target.value 
                }))}
                placeholder="Escriba la respuesta correcta"
                className={errors.correctAnswer ? 'border-red-500' : ''}
              />
              {errors.correctAnswer && (
                <p className="text-red-500 text-sm mt-1">{errors.correctAnswer}</p>
              )}
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={questionData.metadata?.caseSensitive || false}
                  onChange={(e) => setQuestionData(prev => ({
                    ...prev,
                    metadata: { ...prev.metadata, caseSensitive: e.target.checked }
                  }))}
                  className="h-4 w-4"
                />
                <span className="text-sm">Sensible a mayúsculas</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={questionData.metadata?.partialCredit || false}
                  onChange={(e) => setQuestionData(prev => ({
                    ...prev,
                    metadata: { ...prev.metadata, partialCredit: e.target.checked }
                  }))}
                  className="h-4 w-4"
                />
                <span className="text-sm">Puntaje parcial</span>
              </label>
            </div>
          </div>
        );

      case 'long_answer':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="sample-answer">Respuesta de Ejemplo/Rúbrica</Label>
              <textarea
                id="sample-answer"
                value={questionData.correctAnswer || ''}
                onChange={(e) => setQuestionData(prev => ({ 
                  ...prev, 
                  correctAnswer: e.target.value 
                }))}
                placeholder="Proporciona una respuesta de ejemplo o criterios de evaluación"
                className={`w-full min-h-[120px] p-3 border rounded-lg ${
                  errors.correctAnswer ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.correctAnswer && (
                <p className="text-red-500 text-sm mt-1">{errors.correctAnswer}</p>
              )}
            </div>
            <p className="text-sm text-gray-600">
              Esta pregunta requiere calificación manual. Proporciona criterios claros para la evaluación.
            </p>
          </div>
        );

      case 'file_upload':
        return (
          <div className="space-y-4">
            <div>
              <Label>Instrucciones para el Archivo</Label>
              <textarea
                value={questionData.correctAnswer || ''}
                onChange={(e) => setQuestionData(prev => ({ 
                  ...prev, 
                  correctAnswer: e.target.value 
                }))}
                placeholder="Especifica qué tipo de archivo esperás, formato, tamaño máximo, etc."
                className="w-full min-h-[100px] p-3 border rounded-lg border-gray-300"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipos de Archivo Permitidos</Label>
                <Input
                  value={questionData.metadata?.allowedTypes || ''}
                  onChange={(e) => setQuestionData(prev => ({
                    ...prev,
                    metadata: { ...prev.metadata, allowedTypes: e.target.value }
                  }))}
                  placeholder="ej: .pdf,.doc,.docx"
                />
              </div>
              <div>
                <Label>Tamaño Máximo (MB)</Label>
                <Input
                  type="number"
                  value={questionData.metadata?.maxSize || ''}
                  onChange={(e) => setQuestionData(prev => ({
                    ...prev,
                    metadata: { ...prev.metadata, maxSize: parseInt(e.target.value) }
                  }))}
                  placeholder="ej: 10"
                />
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="p-8 text-center text-gray-500">
            Selecciona un tipo de pregunta para comenzar
          </div>
        );
    }
  };

  if (showPreview) {
    return (
      <Card className="max-w-4xl mx-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Vista Previa de la Pregunta</CardTitle>
          <Button 
            variant="outline" 
            onClick={() => setShowPreview(false)}
          >
            <Edit3 className="w-4 h-4 mr-2" />
            Editar
          </Button>
        </CardHeader>
        <CardContent>
          {/* Preview content would go here */}
          <div className="space-y-4">
            <div className="flex justify-between items-start">
              <h3 className="text-lg font-medium">{questionData.question}</h3>
              <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                {questionData.points} pts
              </span>
            </div>
            {/* Render based on question type */}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            {question ? 'Editar Pregunta' : 'Nueva Pregunta'}
          </CardTitle>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowPreview(true)}
              disabled={!questionData.question?.trim()}
            >
              <Eye className="w-4 h-4 mr-2" />
              Vista Previa
            </Button>
            <Button variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              Guardar
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Question Type Selection */}
        <div>
          <Label>Tipo de Pregunta</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
            {QUESTION_TYPES.map((type) => {
              const Icon = type.icon;
              return (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setQuestionData(prev => ({ 
                    ...prev, 
                    type: type.value,
                    options: type.value.includes('choice') ? [
                      { id: '1', text: '', isCorrect: false },
                      { id: '2', text: '', isCorrect: false }
                    ] : undefined,
                    correctAnswer: type.value === 'true_false' ? true : ''
                  }))}
                  className={`p-3 border rounded-lg text-left transition-colors ${
                    questionData.type === type.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Icon className={`w-5 h-5 mb-1 ${
                    questionData.type === type.value ? 'text-blue-600' : 'text-gray-600'
                  }`} />
                  <h4 className="font-medium text-sm mb-1">{type.label}</h4>
                  <p className="text-xs text-gray-600">{type.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Question Text */}
        <div>
          <Label htmlFor="question-text">Pregunta *</Label>
          <textarea
            id="question-text"
            value={questionData.question}
            onChange={(e) => setQuestionData(prev => ({ 
              ...prev, 
              question: e.target.value 
            }))}
            placeholder="Escribe tu pregunta aquí..."
            className={`w-full min-h-[100px] p-3 border rounded-lg resize-none ${
              errors.question ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.question && (
            <p className="text-red-500 text-sm mt-1">{errors.question}</p>
          )}
        </div>

        {/* Question Type Specific Editor */}
        {renderQuestionTypeEditor()}

        {/* Question Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label htmlFor="points">Puntos *</Label>
            <Input
              id="points"
              type="number"
              min="0"
              step="0.5"
              value={questionData.points || ''}
              onChange={(e) => setQuestionData(prev => ({ 
                ...prev, 
                points: parseFloat(e.target.value) || 0
              }))}
              className={errors.points ? 'border-red-500' : ''}
            />
            {errors.points && (
              <p className="text-red-500 text-sm mt-1">{errors.points}</p>
            )}
          </div>

          <div>
            <Label htmlFor="difficulty">Dificultad</Label>
            <select
              id="difficulty"
              value={questionData.difficulty}
              onChange={(e) => setQuestionData(prev => ({ 
                ...prev, 
                difficulty: e.target.value as 'easy' | 'medium' | 'hard'
              }))}
              className="w-full p-2 border border-gray-300 rounded-lg"
            >
              {DIFFICULTY_LEVELS.map(level => (
                <option key={level.value} value={level.value}>
                  {level.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Explanation */}
        <div>
          <Label htmlFor="explanation">Explicación (opcional)</Label>
          <textarea
            id="explanation"
            value={questionData.explanation || ''}
            onChange={(e) => setQuestionData(prev => ({ 
              ...prev, 
              explanation: e.target.value 
            }))}
            placeholder="Explicación que se mostrará después de responder"
            className="w-full min-h-[80px] p-3 border border-gray-300 rounded-lg resize-none"
          />
        </div>

        {/* Tags */}
        <div>
          <Label>Etiquetas</Label>
          <div className="flex flex-wrap gap-2 mb-2">
            {questionData.tags?.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="hover:text-blue-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addTag()}
              placeholder="Agregar etiqueta..."
              className="flex-1"
            />
            <Button type="button" variant="outline" onClick={addTag}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}