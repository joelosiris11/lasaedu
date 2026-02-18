import { useState } from 'react';
import { Label } from '@shared/components/ui/Label';
import { Input } from '@shared/components/ui/Input';
import { Button } from '@shared/components/ui/Button';
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  ToggleLeft,
  ListChecks,
  ArrowLeftRight,
  ChevronDownSquare,
  PenLine,
} from 'lucide-react';

// --- Types ---

export type QuizQuestionType =
  | 'true_false'
  | 'single_choice'
  | 'multiple_choice'
  | 'match_drag'
  | 'match_dropdown'
  | 'open_answer';

export interface QuizQuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface QuizQuestionPair {
  id: string;
  left: string;
  right: string;
}

export interface QuizQuestion {
  id: string;
  type: QuizQuestionType;
  question: string;
  points: number;
  explanation?: string;
  options?: QuizQuestionOption[];
  correctBool?: boolean;
  pairs?: QuizQuestionPair[];
  acceptedAnswers?: string[];
}

export interface QuizLessonContent {
  questions: QuizQuestion[];
  settings: {
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
    showResults: boolean;
    showCorrectAnswers: boolean;
    passingScore: number;
  };
}

export const defaultQuizContent: QuizLessonContent = {
  questions: [],
  settings: {
    shuffleQuestions: false,
    shuffleOptions: false,
    showResults: true,
    showCorrectAnswers: true,
    passingScore: 70,
  },
};

// --- Helpers ---

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

const QUESTION_TYPES: { value: QuizQuestionType; label: string; icon: typeof ToggleLeft; description: string }[] = [
  { value: 'true_false', label: 'Verdadero/Falso', icon: ToggleLeft, description: 'Pregunta binaria' },
  { value: 'single_choice', label: 'Opcion Unica', icon: CheckCircle, description: 'Una sola respuesta correcta' },
  { value: 'multiple_choice', label: 'Opcion Multiple', icon: ListChecks, description: 'Varias respuestas correctas' },
  { value: 'match_drag', label: 'Emparejar (Drag)', icon: ArrowLeftRight, description: 'Arrastrar para emparejar' },
  { value: 'match_dropdown', label: 'Emparejar (Dropdown)', icon: ChevronDownSquare, description: 'Seleccionar par del dropdown' },
  { value: 'open_answer', label: 'Respuesta Abierta', icon: PenLine, description: 'Texto con normalizacion' },
];

function createEmptyQuestion(type: QuizQuestionType): QuizQuestion {
  const base: QuizQuestion = {
    id: generateId(),
    type,
    question: '',
    points: 1,
  };

  switch (type) {
    case 'true_false':
      return { ...base, correctBool: true };
    case 'single_choice':
    case 'multiple_choice':
      return {
        ...base,
        options: [
          { id: generateId(), text: '', isCorrect: false },
          { id: generateId(), text: '', isCorrect: false },
        ],
      };
    case 'match_drag':
    case 'match_dropdown':
      return {
        ...base,
        pairs: [
          { id: generateId(), left: '', right: '' },
          { id: generateId(), left: '', right: '' },
        ],
      };
    case 'open_answer':
      return { ...base, acceptedAnswers: [''] };
  }
}

// --- Props ---

interface QuizLessonEditorProps {
  content: QuizLessonContent;
  onChange: (content: QuizLessonContent) => void;
}

// --- Component ---

export default function QuizLessonEditor({ content, onChange }: QuizLessonEditorProps) {
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const updateQuestions = (questions: QuizQuestion[]) => {
    onChange({ ...content, questions });
  };

  const updateQuestion = (id: string, updates: Partial<QuizQuestion>) => {
    updateQuestions(content.questions.map(q => (q.id === id ? { ...q, ...updates } : q)));
  };

  const addQuestion = (type: QuizQuestionType) => {
    const newQ = createEmptyQuestion(type);
    updateQuestions([...content.questions, newQ]);
    setExpandedQuestion(newQ.id);
    setShowTypeSelector(false);
  };

  const removeQuestion = (id: string) => {
    updateQuestions(content.questions.filter(q => q.id !== id));
    if (expandedQuestion === id) setExpandedQuestion(null);
  };

  const moveQuestion = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= content.questions.length) return;
    const copy = [...content.questions];
    const [moved] = copy.splice(fromIdx, 1);
    copy.splice(toIdx, 0, moved);
    updateQuestions(copy);
  };

  const handleDragStart = (idx: number) => {
    setDragIndex(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== idx) {
      moveQuestion(dragIndex, idx);
      setDragIndex(idx);
    }
  };

  const handleDragEnd = () => {
    setDragIndex(null);
  };

  const updateSettings = (key: keyof QuizLessonContent['settings'], value: boolean | number) => {
    onChange({
      ...content,
      settings: { ...content.settings, [key]: value },
    });
  };

  const getTypeLabel = (type: QuizQuestionType) =>
    QUESTION_TYPES.find(t => t.value === type)?.label || type;

  return (
    <div className="space-y-6">
      {/* Question list */}
      {content.questions.length === 0 ? (
        <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
          <p className="font-medium mb-1">No hay preguntas aun</p>
          <p className="text-sm">Agrega tu primera pregunta para empezar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {content.questions.map((q, idx) => {
            const isExpanded = expandedQuestion === q.id;
            return (
              <div
                key={q.id}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                className={`border rounded-lg transition-colors ${
                  dragIndex === idx ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white'
                }`}
              >
                {/* Question header */}
                <div
                  className="flex items-center gap-3 p-3 cursor-pointer"
                  onClick={() => setExpandedQuestion(isExpanded ? null : q.id)}
                >
                  <GripVertical className="h-4 w-4 text-gray-400 cursor-grab flex-shrink-0" />
                  <span className="text-sm font-medium text-gray-500 w-6">{idx + 1}.</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 flex-shrink-0">
                    {getTypeLabel(q.type)}
                  </span>
                  <span className="flex-1 text-sm text-gray-800 truncate">
                    {q.question || '(Sin pregunta)'}
                  </span>
                  <span className="text-xs text-gray-500 flex-shrink-0">{q.points} pts</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeQuestion(q.id);
                    }}
                    className="text-red-500 hover:text-red-700 flex-shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  )}
                </div>

                {/* Expanded editor */}
                {isExpanded && (
                  <div className="border-t p-4 space-y-4">
                    {/* Question text */}
                    <div>
                      <Label>Pregunta *</Label>
                      <textarea
                        value={q.question}
                        onChange={(e) => updateQuestion(q.id, { question: e.target.value })}
                        placeholder="Escribe la pregunta..."
                        className="w-full min-h-[80px] p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    {/* Type-specific editor */}
                    <QuestionTypeEditor
                      question={q}
                      onUpdate={(updates) => updateQuestion(q.id, updates)}
                    />

                    {/* Points and explanation */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Puntos</Label>
                        <Input
                          type="number"
                          value={q.points}
                          onChange={(e) =>
                            updateQuestion(q.id, { points: Math.max(1, parseInt(e.target.value) || 1) })
                          }
                          min={1}
                          className="max-w-[120px]"
                        />
                      </div>
                      <div>
                        <Label>Explicacion (opcional)</Label>
                        <Input
                          value={q.explanation || ''}
                          onChange={(e) => updateQuestion(q.id, { explanation: e.target.value })}
                          placeholder="Se muestra al revisar resultados"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add question */}
      {showTypeSelector ? (
        <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-blue-900">Selecciona el tipo de pregunta</h4>
            <Button variant="ghost" size="sm" onClick={() => setShowTypeSelector(false)}>
              Cancelar
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {QUESTION_TYPES.map((type) => {
              const Icon = type.icon;
              return (
                <button
                  key={type.value}
                  onClick={() => addQuestion(type.value)}
                  className="p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors text-left"
                >
                  <Icon className="h-5 w-5 text-blue-600 mb-1" />
                  <p className="text-sm font-medium">{type.label}</p>
                  <p className="text-xs text-gray-500">{type.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setShowTypeSelector(true)} className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Agregar Pregunta
        </Button>
      )}

      {/* Quiz settings */}
      <div className="border-t pt-6 space-y-4">
        <h3 className="font-medium text-gray-900">Configuracion del Quiz</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="font-medium">Mezclar preguntas</Label>
              <p className="text-sm text-gray-600">Orden aleatorio cada intento</p>
            </div>
            <input
              type="checkbox"
              checked={content.settings.shuffleQuestions}
              onChange={(e) => updateSettings('shuffleQuestions', e.target.checked)}
              className="h-4 w-4 text-blue-600 rounded"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="font-medium">Mezclar opciones</Label>
              <p className="text-sm text-gray-600">Opciones en orden aleatorio</p>
            </div>
            <input
              type="checkbox"
              checked={content.settings.shuffleOptions}
              onChange={(e) => updateSettings('shuffleOptions', e.target.checked)}
              className="h-4 w-4 text-blue-600 rounded"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="font-medium">Mostrar resultados</Label>
              <p className="text-sm text-gray-600">Puntaje al finalizar</p>
            </div>
            <input
              type="checkbox"
              checked={content.settings.showResults}
              onChange={(e) => updateSettings('showResults', e.target.checked)}
              className="h-4 w-4 text-blue-600 rounded"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="font-medium">Mostrar respuestas correctas</Label>
              <p className="text-sm text-gray-600">Revelar las respuestas al terminar</p>
            </div>
            <input
              type="checkbox"
              checked={content.settings.showCorrectAnswers}
              onChange={(e) => updateSettings('showCorrectAnswers', e.target.checked)}
              className="h-4 w-4 text-blue-600 rounded"
            />
          </div>
        </div>

        <div>
          <Label>Puntuacion minima para aprobar (%)</Label>
          <Input
            type="number"
            value={content.settings.passingScore}
            onChange={(e) =>
              updateSettings('passingScore', Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))
            }
            min={0}
            max={100}
            className="max-w-[120px]"
          />
        </div>
      </div>
    </div>
  );
}

// --- Question Type Editor ---

function QuestionTypeEditor({
  question,
  onUpdate,
}: {
  question: QuizQuestion;
  onUpdate: (updates: Partial<QuizQuestion>) => void;
}) {
  switch (question.type) {
    case 'true_false':
      return <TrueFalseEditor question={question} onUpdate={onUpdate} />;
    case 'single_choice':
      return <ChoiceEditor question={question} onUpdate={onUpdate} multi={false} />;
    case 'multiple_choice':
      return <ChoiceEditor question={question} onUpdate={onUpdate} multi={true} />;
    case 'match_drag':
    case 'match_dropdown':
      return <MatchEditor question={question} onUpdate={onUpdate} />;
    case 'open_answer':
      return <OpenAnswerEditor question={question} onUpdate={onUpdate} />;
    default:
      return null;
  }
}

// --- True/False ---

function TrueFalseEditor({
  question,
  onUpdate,
}: {
  question: QuizQuestion;
  onUpdate: (u: Partial<QuizQuestion>) => void;
}) {
  return (
    <div>
      <Label>Respuesta correcta</Label>
      <div className="flex gap-3 mt-2">
        <button
          onClick={() => onUpdate({ correctBool: true })}
          className={`flex-1 py-3 px-4 rounded-lg border-2 font-medium transition-colors ${
            question.correctBool === true
              ? 'border-green-500 bg-green-50 text-green-700'
              : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
          }`}
        >
          Verdadero
        </button>
        <button
          onClick={() => onUpdate({ correctBool: false })}
          className={`flex-1 py-3 px-4 rounded-lg border-2 font-medium transition-colors ${
            question.correctBool === false
              ? 'border-red-500 bg-red-50 text-red-700'
              : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
          }`}
        >
          Falso
        </button>
      </div>
    </div>
  );
}

// --- Choice (single / multiple) ---

function ChoiceEditor({
  question,
  onUpdate,
  multi,
}: {
  question: QuizQuestion;
  onUpdate: (u: Partial<QuizQuestion>) => void;
  multi: boolean;
}) {
  const options = question.options || [];

  const updateOption = (optId: string, updates: Partial<QuizQuestionOption>) => {
    const newOptions = options.map(o => {
      if (o.id === optId) return { ...o, ...updates };
      // For single choice, uncheck others
      if (!multi && updates.isCorrect) return { ...o, isCorrect: false };
      return o;
    });
    onUpdate({ options: newOptions });
  };

  const addOption = () => {
    onUpdate({ options: [...options, { id: generateId(), text: '', isCorrect: false }] });
  };

  const removeOption = (optId: string) => {
    if (options.length <= 2) return;
    onUpdate({ options: options.filter(o => o.id !== optId) });
  };

  return (
    <div>
      <Label>{multi ? 'Opciones (marca las correctas)' : 'Opciones (marca la correcta)'}</Label>
      <div className="space-y-2 mt-2">
        {options.map((opt) => (
          <div key={opt.id} className="flex items-center gap-2">
            <input
              type={multi ? 'checkbox' : 'radio'}
              name={`q-${question.id}`}
              checked={opt.isCorrect}
              onChange={() => updateOption(opt.id, { isCorrect: multi ? !opt.isCorrect : true })}
              className="h-4 w-4 text-blue-600"
            />
            <Input
              value={opt.text}
              onChange={(e) => updateOption(opt.id, { text: e.target.value })}
              placeholder="Texto de la opcion"
              className="flex-1"
            />
            {options.length > 2 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeOption(opt.id)}
                className="text-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
      <Button variant="ghost" size="sm" onClick={addOption} className="mt-2">
        <Plus className="h-4 w-4 mr-1" />
        Agregar opcion
      </Button>
    </div>
  );
}

// --- Match Editor ---

function MatchEditor({
  question,
  onUpdate,
}: {
  question: QuizQuestion;
  onUpdate: (u: Partial<QuizQuestion>) => void;
}) {
  const pairs = question.pairs || [];

  const updatePair = (pairId: string, updates: Partial<QuizQuestionPair>) => {
    onUpdate({ pairs: pairs.map(p => (p.id === pairId ? { ...p, ...updates } : p)) });
  };

  const addPair = () => {
    onUpdate({ pairs: [...pairs, { id: generateId(), left: '', right: '' }] });
  };

  const removePair = (pairId: string) => {
    if (pairs.length <= 2) return;
    onUpdate({ pairs: pairs.filter(p => p.id !== pairId) });
  };

  return (
    <div>
      <Label>Pares (izquierda - derecha)</Label>
      <div className="space-y-2 mt-2">
        {pairs.map((pair) => (
          <div key={pair.id} className="flex items-center gap-2">
            <Input
              value={pair.left}
              onChange={(e) => updatePair(pair.id, { left: e.target.value })}
              placeholder="Elemento izquierdo"
              className="flex-1"
            />
            <ArrowLeftRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <Input
              value={pair.right}
              onChange={(e) => updatePair(pair.id, { right: e.target.value })}
              placeholder="Elemento derecho"
              className="flex-1"
            />
            {pairs.length > 2 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removePair(pair.id)}
                className="text-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
      <Button variant="ghost" size="sm" onClick={addPair} className="mt-2">
        <Plus className="h-4 w-4 mr-1" />
        Agregar par
      </Button>
    </div>
  );
}

// --- Open Answer ---

function OpenAnswerEditor({
  question,
  onUpdate,
}: {
  question: QuizQuestion;
  onUpdate: (u: Partial<QuizQuestion>) => void;
}) {
  const answers = question.acceptedAnswers || [''];

  const updateAnswer = (idx: number, value: string) => {
    const copy = [...answers];
    copy[idx] = value;
    onUpdate({ acceptedAnswers: copy });
  };

  const addAnswer = () => {
    onUpdate({ acceptedAnswers: [...answers, ''] });
  };

  const removeAnswer = (idx: number) => {
    if (answers.length <= 1) return;
    onUpdate({ acceptedAnswers: answers.filter((_, i) => i !== idx) });
  };

  return (
    <div>
      <Label>Respuestas aceptadas</Label>
      <p className="text-xs text-gray-500 mb-2">
        Se normalizan automaticamente (minusculas, sin acentos). El estudiante aprueba si su respuesta coincide con alguna.
      </p>
      <div className="space-y-2">
        {answers.map((ans, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <Input
              value={ans}
              onChange={(e) => updateAnswer(idx, e.target.value)}
              placeholder="Respuesta aceptada"
              className="flex-1"
            />
            <span className="text-xs text-gray-400 w-32 truncate">
              = "{normalizeText(ans)}"
            </span>
            {answers.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeAnswer(idx)}
                className="text-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
      <Button variant="ghost" size="sm" onClick={addAnswer} className="mt-2">
        <Plus className="h-4 w-4 mr-1" />
        Agregar respuesta alternativa
      </Button>
    </div>
  );
}
