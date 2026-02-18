import { useState, useEffect, useCallback } from 'react';
import type { DBLesson } from '@shared/services/dataService';
import type { QuizLessonContent, QuizQuestion, QuizQuestionType } from './QuizLessonEditor';
import { Button } from '@shared/components/ui/Button';
import {
  CheckCircle,
  XCircle,
  Trophy,
  AlertCircle,
  RotateCcw,
  HelpCircle,
} from 'lucide-react';

// --- Helpers ---

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// --- Types ---

interface QuizLessonViewProps {
  lesson: DBLesson;
  onComplete: () => void;
}

interface QuizAnswers {
  [questionId: string]: any;
}

interface QuizResult {
  totalPoints: number;
  earnedPoints: number;
  percentage: number;
  passed: boolean;
  questionResults: {
    questionId: string;
    correct: boolean;
    earnedPoints: number;
  }[];
}

// --- Component ---

export default function QuizLessonView({ lesson, onComplete }: QuizLessonViewProps) {
  const [quizContent, setQuizContent] = useState<QuizLessonContent | null>(null);
  const [displayQuestions, setDisplayQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    try {
      const parsed: QuizLessonContent =
        typeof lesson.content === 'string' ? JSON.parse(lesson.content) : lesson.content;
      setQuizContent(parsed);

      let questions = [...parsed.questions];
      if (parsed.settings.shuffleQuestions) {
        questions = shuffleArray(questions);
      }
      setDisplayQuestions(questions);

      // Initialize answers
      const initialAnswers: QuizAnswers = {};
      for (const q of questions) {
        switch (q.type) {
          case 'true_false':
            initialAnswers[q.id] = null;
            break;
          case 'single_choice':
            initialAnswers[q.id] = null;
            break;
          case 'multiple_choice':
            initialAnswers[q.id] = [];
            break;
          case 'match_drag':
          case 'match_dropdown':
            initialAnswers[q.id] = {};
            break;
          case 'open_answer':
            initialAnswers[q.id] = '';
            break;
        }
      }
      setAnswers(initialAnswers);
    } catch {
      setQuizContent(null);
    }
  }, [lesson.id, lesson.content]);

  const setAnswer = useCallback((questionId: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }, []);

  const scoreQuiz = (): QuizResult => {
    if (!quizContent) return { totalPoints: 0, earnedPoints: 0, percentage: 0, passed: false, questionResults: [] };

    const questionResults: QuizResult['questionResults'] = [];
    let totalPoints = 0;
    let earnedPoints = 0;

    for (const q of quizContent.questions) {
      totalPoints += q.points;
      const answer = answers[q.id];
      let correct = false;

      switch (q.type) {
        case 'true_false':
          correct = answer === q.correctBool;
          break;

        case 'single_choice': {
          const correctOpt = q.options?.find((o) => o.isCorrect);
          correct = answer === correctOpt?.id;
          break;
        }

        case 'multiple_choice': {
          const correctIds = new Set(q.options?.filter((o) => o.isCorrect).map((o) => o.id) || []);
          const selectedIds = new Set(answer as string[]);
          correct =
            correctIds.size === selectedIds.size &&
            [...correctIds].every((id) => selectedIds.has(id));
          break;
        }

        case 'match_drag':
        case 'match_dropdown': {
          const pairs = q.pairs || [];
          const userMatches = answer as Record<string, string>;
          let correctCount = 0;
          for (const pair of pairs) {
            if (userMatches[pair.id] === pair.right) {
              correctCount++;
            }
          }
          // Partial credit: proportional to correct matches
          if (pairs.length > 0) {
            const earned = (correctCount / pairs.length) * q.points;
            earnedPoints += earned;
            questionResults.push({
              questionId: q.id,
              correct: correctCount === pairs.length,
              earnedPoints: earned,
            });
            continue; // Skip the default scoring below
          }
          break;
        }

        case 'open_answer': {
          const userNormalized = normalizeText(answer as string);
          const accepted = (q.acceptedAnswers || []).map(normalizeText);
          correct = accepted.includes(userNormalized);
          break;
        }
      }

      earnedPoints += correct ? q.points : 0;
      questionResults.push({
        questionId: q.id,
        correct,
        earnedPoints: correct ? q.points : 0,
      });
    }

    const percentage = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
    const passed = percentage >= (quizContent.settings.passingScore || 70);

    return { totalPoints, earnedPoints, percentage, passed, questionResults };
  };

  const handleSubmit = () => {
    const quizResult = scoreQuiz();
    setResult(quizResult);
    setSubmitted(true);

    if (quizResult.passed) {
      onComplete();
    }
  };

  const handleRetry = () => {
    setSubmitted(false);
    setResult(null);
    if (quizContent) {
      let questions = [...quizContent.questions];
      if (quizContent.settings.shuffleQuestions) {
        questions = shuffleArray(questions);
      }
      setDisplayQuestions(questions);

      const initialAnswers: QuizAnswers = {};
      for (const q of questions) {
        switch (q.type) {
          case 'true_false':
            initialAnswers[q.id] = null;
            break;
          case 'single_choice':
            initialAnswers[q.id] = null;
            break;
          case 'multiple_choice':
            initialAnswers[q.id] = [];
            break;
          case 'match_drag':
          case 'match_dropdown':
            initialAnswers[q.id] = {};
            break;
          case 'open_answer':
            initialAnswers[q.id] = '';
            break;
        }
      }
      setAnswers(initialAnswers);
    }
  };

  if (!quizContent || displayQuestions.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500">
        <HelpCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
        <p>Este quiz no tiene preguntas configuradas.</p>
      </div>
    );
  }

  // Results screen
  if (submitted && result && quizContent.settings.showResults) {
    return (
      <div className="p-6">
        {/* Score summary */}
        <div className={`text-center p-8 rounded-lg mb-6 ${result.passed ? 'bg-green-50' : 'bg-red-50'}`}>
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
              result.passed ? 'bg-green-100' : 'bg-red-100'
            }`}
          >
            {result.passed ? (
              <Trophy className="h-10 w-10 text-green-600" />
            ) : (
              <AlertCircle className="h-10 w-10 text-red-600" />
            )}
          </div>
          <h2 className="text-2xl font-bold mb-2">
            {result.passed ? 'Quiz Aprobado!' : 'Quiz No Aprobado'}
          </h2>
          <p className="text-4xl font-bold mb-2">{result.percentage}%</p>
          <p className="text-gray-600">
            {result.earnedPoints} de {result.totalPoints} puntos
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Minimo para aprobar: {quizContent.settings.passingScore}%
          </p>
        </div>

        {/* Detailed results */}
        {quizContent.settings.showCorrectAnswers && (
          <div className="space-y-4 mb-6">
            <h3 className="font-semibold text-gray-900">Detalle por pregunta</h3>
            {displayQuestions.map((q, idx) => {
              const qResult = result.questionResults.find((r) => r.questionId === q.id);
              return (
                <div
                  key={q.id}
                  className={`p-4 rounded-lg border ${
                    qResult?.correct ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {qResult?.correct ? (
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {idx + 1}. {q.question}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {qResult?.earnedPoints} / {q.points} pts
                      </p>
                      <CorrectAnswerDisplay question={q} userAnswer={answers[q.id]} />
                      {q.explanation && (
                        <p className="text-sm text-blue-700 mt-2 bg-blue-50 p-2 rounded">
                          {q.explanation}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Retry */}
        {!result.passed && (
          <div className="text-center">
            <Button onClick={handleRetry}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Intentar de nuevo
            </Button>
          </div>
        )}
      </div>
    );
  }

  // If submitted but showResults=false
  if (submitted && result) {
    return (
      <div className="p-6 text-center">
        <div className={`p-8 rounded-lg ${result.passed ? 'bg-green-50' : 'bg-amber-50'}`}>
          {result.passed ? (
            <>
              <Trophy className="h-16 w-16 text-green-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-green-800 mb-2">Quiz Completado!</h2>
              <p className="text-green-700">Has aprobado el quiz.</p>
            </>
          ) : (
            <>
              <AlertCircle className="h-16 w-16 text-amber-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-amber-800 mb-2">Quiz Enviado</h2>
              <p className="text-amber-700">No alcanzaste la puntuacion minima.</p>
              <Button onClick={handleRetry} className="mt-4">
                <RotateCcw className="h-4 w-4 mr-2" />
                Intentar de nuevo
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  // Quiz-taking view
  return (
    <div className="p-6">
      <div className="space-y-6">
        {displayQuestions.map((q, idx) => (
          <div key={q.id} className="border border-gray-200 rounded-lg p-5">
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-medium text-gray-900">
                <span className="text-blue-600 mr-2">{idx + 1}.</span>
                {q.question}
              </h3>
              <span className="text-xs text-gray-500 flex-shrink-0 ml-3">{q.points} pts</span>
            </div>

            <QuestionInput
              question={q}
              answer={answers[q.id]}
              onChange={(val) => setAnswer(q.id, val)}
              shuffleOptions={quizContent.settings.shuffleOptions}
            />
          </div>
        ))}
      </div>

      <div className="mt-8 text-center">
        <Button onClick={handleSubmit} className="px-8 py-3 text-lg">
          <CheckCircle className="h-5 w-5 mr-2" />
          Enviar Quiz
        </Button>
      </div>
    </div>
  );
}

// --- Question Input Components ---

function QuestionInput({
  question,
  answer,
  onChange,
  shuffleOptions,
}: {
  question: QuizQuestion;
  answer: any;
  onChange: (value: any) => void;
  shuffleOptions: boolean;
}) {
  switch (question.type) {
    case 'true_false':
      return <TrueFalseInput answer={answer} onChange={onChange} />;
    case 'single_choice':
      return (
        <SingleChoiceInput
          question={question}
          answer={answer}
          onChange={onChange}
          shuffle={shuffleOptions}
        />
      );
    case 'multiple_choice':
      return (
        <MultipleChoiceInput
          question={question}
          answer={answer}
          onChange={onChange}
          shuffle={shuffleOptions}
        />
      );
    case 'match_drag':
      return <MatchDragInput question={question} answer={answer} onChange={onChange} />;
    case 'match_dropdown':
      return <MatchDropdownInput question={question} answer={answer} onChange={onChange} />;
    case 'open_answer':
      return <OpenAnswerInput answer={answer} onChange={onChange} />;
    default:
      return null;
  }
}

// --- True/False Input ---

function TrueFalseInput({
  answer,
  onChange,
}: {
  answer: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex gap-3">
      <button
        onClick={() => onChange(true)}
        className={`flex-1 py-3 px-4 rounded-lg border-2 font-medium transition-colors ${
          answer === true
            ? 'border-blue-500 bg-blue-50 text-blue-700'
            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
        }`}
      >
        Verdadero
      </button>
      <button
        onClick={() => onChange(false)}
        className={`flex-1 py-3 px-4 rounded-lg border-2 font-medium transition-colors ${
          answer === false
            ? 'border-blue-500 bg-blue-50 text-blue-700'
            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
        }`}
      >
        Falso
      </button>
    </div>
  );
}

// --- Single Choice Input ---

function SingleChoiceInput({
  question,
  answer,
  onChange,
  shuffle,
}: {
  question: QuizQuestion;
  answer: string | null;
  onChange: (v: string) => void;
  shuffle: boolean;
}) {
  const [options] = useState(() =>
    shuffle ? shuffleArray(question.options || []) : question.options || []
  );

  return (
    <div className="space-y-2">
      {options.map((opt) => (
        <label
          key={opt.id}
          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
            answer === opt.id
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <input
            type="radio"
            name={`q-${question.id}`}
            checked={answer === opt.id}
            onChange={() => onChange(opt.id)}
            className="h-4 w-4 text-blue-600"
          />
          <span className="text-gray-800">{opt.text}</span>
        </label>
      ))}
    </div>
  );
}

// --- Multiple Choice Input ---

function MultipleChoiceInput({
  question,
  answer,
  onChange,
  shuffle,
}: {
  question: QuizQuestion;
  answer: string[];
  onChange: (v: string[]) => void;
  shuffle: boolean;
}) {
  const [options] = useState(() =>
    shuffle ? shuffleArray(question.options || []) : question.options || []
  );

  const toggle = (optId: string) => {
    const selected = answer || [];
    if (selected.includes(optId)) {
      onChange(selected.filter((id) => id !== optId));
    } else {
      onChange([...selected, optId]);
    }
  };

  return (
    <div className="space-y-2">
      {options.map((opt) => {
        const checked = (answer || []).includes(opt.id);
        return (
          <label
            key={opt.id}
            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              checked ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggle(opt.id)}
              className="h-4 w-4 text-blue-600 rounded"
            />
            <span className="text-gray-800">{opt.text}</span>
          </label>
        );
      })}
    </div>
  );
}

// --- Match Drag Input ---

function MatchDragInput({
  question,
  answer,
  onChange,
}: {
  question: QuizQuestion;
  answer: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
}) {
  const pairs = question.pairs || [];
  const [shuffledRight] = useState(() => shuffleArray(pairs.map((p) => p.right)));
  const [dragItem, setDragItem] = useState<string | null>(null);

  // Items that haven't been placed yet
  const placedValues = new Set(Object.values(answer || {}));
  const availableItems = shuffledRight.filter((item) => !placedValues.has(item));

  const handleDrop = (pairId: string) => {
    if (dragItem) {
      // Remove the dragItem from any existing assignment
      const newAnswer = { ...(answer || {}) };
      for (const [key, val] of Object.entries(newAnswer)) {
        if (val === dragItem) {
          delete newAnswer[key];
        }
      }
      newAnswer[pairId] = dragItem;
      onChange(newAnswer);
      setDragItem(null);
    }
  };

  const removePair = (pairId: string) => {
    const newAnswer = { ...(answer || {}) };
    delete newAnswer[pairId];
    onChange(newAnswer);
  };

  return (
    <div className="flex gap-6">
      {/* Left column - fixed items */}
      <div className="flex-1 space-y-2">
        <p className="text-xs text-gray-500 font-medium mb-2">ELEMENTOS</p>
        {pairs.map((pair) => (
          <div
            key={pair.id}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(pair.id)}
            className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-colors min-h-[48px] ${
              (answer || {})[pair.id]
                ? 'border-green-300 bg-green-50'
                : 'border-dashed border-gray-300 bg-gray-50'
            }`}
          >
            <span className="font-medium text-gray-800 flex-1">{pair.left}</span>
            <span className="text-gray-400 mx-1">&rarr;</span>
            {(answer || {})[pair.id] ? (
              <span
                className="bg-blue-100 text-blue-800 px-3 py-1 rounded-md text-sm font-medium cursor-pointer hover:bg-red-100 hover:text-red-800"
                onClick={() => removePair(pair.id)}
                title="Click para quitar"
              >
                {(answer || {})[pair.id]}
              </span>
            ) : (
              <span className="text-gray-400 text-sm italic">Arrastra aqui</span>
            )}
          </div>
        ))}
      </div>

      {/* Right column - draggable items */}
      <div className="w-48 space-y-2">
        <p className="text-xs text-gray-500 font-medium mb-2">OPCIONES</p>
        {availableItems.map((item, idx) => (
          <div
            key={`${item}-${idx}`}
            draggable
            onDragStart={() => setDragItem(item)}
            onDragEnd={() => setDragItem(null)}
            className="p-3 bg-blue-100 text-blue-800 rounded-lg cursor-grab font-medium text-sm hover:bg-blue-200 transition-colors"
          >
            {item}
          </div>
        ))}
        {availableItems.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">Todas asignadas</p>
        )}
      </div>
    </div>
  );
}

// --- Match Dropdown Input ---

function MatchDropdownInput({
  question,
  answer,
  onChange,
}: {
  question: QuizQuestion;
  answer: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
}) {
  const pairs = question.pairs || [];
  const [shuffledRight] = useState(() => shuffleArray(pairs.map((p) => p.right)));

  const handleSelect = (pairId: string, value: string) => {
    onChange({ ...(answer || {}), [pairId]: value });
  };

  return (
    <div className="space-y-3">
      {pairs.map((pair) => (
        <div key={pair.id} className="flex items-center gap-3">
          <span className="font-medium text-gray-800 flex-1">{pair.left}</span>
          <span className="text-gray-400">&rarr;</span>
          <select
            value={(answer || {})[pair.id] || ''}
            onChange={(e) => handleSelect(pair.id, e.target.value)}
            className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Seleccionar...</option>
            {shuffledRight.map((item, idx) => (
              <option key={`${item}-${idx}`} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

// --- Open Answer Input ---

function OpenAnswerInput({
  answer,
  onChange,
}: {
  answer: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="text"
      value={answer || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Escribe tu respuesta..."
      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
    />
  );
}

// --- Correct Answer Display (for results) ---

function CorrectAnswerDisplay({
  question,
  userAnswer,
}: {
  question: QuizQuestion;
  userAnswer: any;
}) {
  switch (question.type) {
    case 'true_false':
      return (
        <div className="text-sm mt-2 space-y-1">
          <p>
            <span className="text-gray-500">Tu respuesta:</span>{' '}
            <span className="font-medium">
              {userAnswer === true ? 'Verdadero' : userAnswer === false ? 'Falso' : 'Sin respuesta'}
            </span>
          </p>
          <p>
            <span className="text-gray-500">Correcta:</span>{' '}
            <span className="font-medium text-green-700">
              {question.correctBool ? 'Verdadero' : 'Falso'}
            </span>
          </p>
        </div>
      );

    case 'single_choice': {
      const selectedOpt = question.options?.find((o) => o.id === userAnswer);
      const correctOpt = question.options?.find((o) => o.isCorrect);
      return (
        <div className="text-sm mt-2 space-y-1">
          <p>
            <span className="text-gray-500">Tu respuesta:</span>{' '}
            <span className="font-medium">{selectedOpt?.text || 'Sin respuesta'}</span>
          </p>
          <p>
            <span className="text-gray-500">Correcta:</span>{' '}
            <span className="font-medium text-green-700">{correctOpt?.text}</span>
          </p>
        </div>
      );
    }

    case 'multiple_choice': {
      const selected = (userAnswer as string[]) || [];
      const selectedTexts = question.options
        ?.filter((o) => selected.includes(o.id))
        .map((o) => o.text) || [];
      const correctTexts = question.options?.filter((o) => o.isCorrect).map((o) => o.text) || [];
      return (
        <div className="text-sm mt-2 space-y-1">
          <p>
            <span className="text-gray-500">Tu respuesta:</span>{' '}
            <span className="font-medium">{selectedTexts.join(', ') || 'Sin respuesta'}</span>
          </p>
          <p>
            <span className="text-gray-500">Correctas:</span>{' '}
            <span className="font-medium text-green-700">{correctTexts.join(', ')}</span>
          </p>
        </div>
      );
    }

    case 'match_drag':
    case 'match_dropdown': {
      const userMatches = (userAnswer as Record<string, string>) || {};
      return (
        <div className="text-sm mt-2 space-y-1">
          {(question.pairs || []).map((pair) => {
            const userVal = userMatches[pair.id];
            const isCorrect = userVal === pair.right;
            return (
              <p key={pair.id}>
                <span className="font-medium">{pair.left}</span>
                <span className="text-gray-400"> &rarr; </span>
                <span className={isCorrect ? 'text-green-700' : 'text-red-700'}>
                  {userVal || '(vacio)'}
                </span>
                {!isCorrect && (
                  <span className="text-green-700 ml-2">(Correcto: {pair.right})</span>
                )}
              </p>
            );
          })}
        </div>
      );
    }

    case 'open_answer': {
      const accepted = question.acceptedAnswers || [];
      return (
        <div className="text-sm mt-2 space-y-1">
          <p>
            <span className="text-gray-500">Tu respuesta:</span>{' '}
            <span className="font-medium">{(userAnswer as string) || 'Sin respuesta'}</span>
          </p>
          <p>
            <span className="text-gray-500">Respuestas aceptadas:</span>{' '}
            <span className="font-medium text-green-700">{accepted.join(', ')}</span>
          </p>
        </div>
      );
    }

    default:
      return null;
  }
}
