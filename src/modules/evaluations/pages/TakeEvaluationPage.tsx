import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@app/store/authStore';
import { evaluationService } from '@shared/services/dataService';
import { assessmentService } from '@shared/services/assessmentService';
import type { Question as ModernQuestion, QuestionOption } from '@shared/types/assessment';
import { 
  ArrowLeft,
  ArrowRight,
  Clock,
  AlertCircle,
  CheckCircle,
  Send
} from 'lucide-react';
import { Card, CardContent } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';

interface Question {
  id: string;
  type: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay' | 'matching' | 'ordering';
  question: string;
  options?: string[];
  correctAnswer: string | string[] | boolean;
  points: number;
  explanation?: string;
}

interface EvaluationData {
  id: string;
  title: string;
  description: string;
  type: 'quiz' | 'tarea' | 'examen' | 'proyecto';
  courseId: string;
  courseName: string;
  questions: Question[];
  settings: {
    timeLimit?: number;
    attempts?: number;
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
    showResults: boolean;
    passingScore: number;
    dueDate?: string;
  };
  submissions?: number;
}

interface Answer {
  questionId: string;
  answer: string | boolean | null;
}

interface SubmissionResult {
  score: number;
  totalPoints: number;
  percentage: number;
  passed: boolean;
  correctAnswers: number;
  totalQuestions: number;
  answers: {
    questionId: string;
    userAnswer: string | boolean | null;
    correctAnswer: string | boolean | string[];
    isCorrect: boolean;
    points: number;
    earnedPoints: number;
    explanation?: string;
  }[];
}

export default function TakeEvaluationPage() {
  const { evaluationId } = useParams<{ evaluationId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  const [evaluation, setEvaluation] = useState<EvaluationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (evaluationId) {
      loadEvaluation(evaluationId);
    }
  }, [evaluationId]);

  // Timer effect
  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0 || submitted) return;
    
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          handleSubmit(true); // Auto-submit when time runs out
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [timeRemaining, submitted]);

  // Transform modern QuestionOption[] to simple string[] for legacy UI compatibility
  const transformModernQuestion = (q: ModernQuestion): Question => {
    let options: string[] | undefined;
    let correctAnswer: string | string[] | boolean = q.correctAnswer;

    // Handle different question types
    if (q.type === 'single_choice' || q.type === 'multiple_choice') {
      if (q.options) {
        options = q.options.map((opt: QuestionOption) => opt.text);
        // For single/multiple choice, find the correct option index(es)
        const correctIndices = q.options
          .map((opt: QuestionOption, idx: number) => opt.isCorrect ? idx.toString() : null)
          .filter((v: string | null): v is string => v !== null);
        correctAnswer = q.type === 'single_choice' ? correctIndices[0] || '0' : correctIndices;
      }
    } else if (q.type === 'true_false') {
      correctAnswer = q.correctAnswer === true || q.correctAnswer === 'true';
    }

    // Map modern types to legacy types
    const typeMap: Record<string, Question['type']> = {
      'single_choice': 'multiple_choice',
      'multiple_choice': 'multiple_choice',
      'true_false': 'true_false',
      'short_answer': 'short_answer',
      'long_answer': 'essay',
      'essay': 'essay',
      'matching': 'matching',
      'ordering': 'ordering'
    };

    return {
      id: q.id,
      type: typeMap[q.type] || 'short_answer',
      question: q.question,
      options,
      correctAnswer,
      points: q.points,
      explanation: q.explanation
    };
  };

  const loadEvaluation = async (id: string) => {
    try {
      // First try to load from modern assessmentService
      const modernAssessment = await assessmentService.getAssessment(id);

      if (modernAssessment && modernAssessment.questionData) {
        // Load questions from questionData in order
        const modernQuestions = modernAssessment.questions
          .sort((a, b) => a.order - b.order)
          .map(aq => modernAssessment.questionData![aq.questionId])
          .filter((q): q is ModernQuestion => q !== undefined);

        // Transform to legacy format
        let questions = modernQuestions.map(transformModernQuestion);

        // Apply shuffle settings
        if (modernAssessment.settings.shuffleQuestions) {
          questions = shuffleArray(questions);
        }
        if (modernAssessment.settings.shuffleAnswers) {
          questions = questions.map(q => {
            if (q.type === 'multiple_choice' && q.options) {
              return { ...q, options: shuffleArray([...q.options]) };
            }
            return q;
          });
        }

        const evaluationData: EvaluationData = {
          id: modernAssessment.id,
          title: modernAssessment.title,
          description: modernAssessment.description,
          type: modernAssessment.type === 'exam' ? 'examen' : modernAssessment.type === 'assignment' ? 'tarea' : 'quiz',
          courseId: modernAssessment.courseId,
          courseName: '', // Will be loaded if needed
          questions,
          settings: {
            timeLimit: modernAssessment.settings.timeLimit,
            attempts: modernAssessment.settings.attempts,
            shuffleQuestions: modernAssessment.settings.shuffleQuestions || false,
            shuffleOptions: modernAssessment.settings.shuffleAnswers || false,
            showResults: modernAssessment.settings.showResults === 'immediately',
            passingScore: modernAssessment.grading.passingScore,
            dueDate: modernAssessment.settings.dueDate ? new Date(modernAssessment.settings.dueDate).toISOString() : undefined
          }
        };

        setEvaluation(evaluationData);
        setAnswers(questions.map(q => ({ questionId: q.id, answer: null })));

        if (evaluationData.settings.timeLimit) {
          setTimeRemaining(evaluationData.settings.timeLimit * 60);
        }
        setLoading(false);
        return;
      }

      // Fallback to legacy evaluation service
      const data = await evaluationService.getById(id) as EvaluationData | null;
      if (data) {
        let questions = [...data.questions];
        if (data.settings.shuffleQuestions) {
          questions = shuffleArray(questions);
        }
        if (data.settings.shuffleOptions) {
          questions = questions.map(q => {
            if (q.type === 'multiple_choice' && q.options) {
              return { ...q, options: shuffleArray([...q.options]) };
            }
            return q;
          });
        }

        setEvaluation({ ...data, questions });
        setAnswers(questions.map(q => ({ questionId: q.id, answer: null })));

        if (data.settings.timeLimit) {
          setTimeRemaining(data.settings.timeLimit * 60);
        }
      }
    } catch (error) {
      console.error('Error loading evaluation:', error);
    } finally {
      setLoading(false);
    }
  };

  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswerChange = (questionId: string, answer: string | boolean) => {
    setAnswers(prev => prev.map(a => 
      a.questionId === questionId ? { ...a, answer } : a
    ));
  };

  const getCurrentAnswer = () => {
    const question = evaluation?.questions[currentQuestionIndex];
    if (!question) return null;
    return answers.find(a => a.questionId === question.id)?.answer;
  };

  const handleSubmit = useCallback(async (forced = false) => {
    if (!evaluation || !user) return;
    
    if (!forced && !confirming) {
      const unanswered = answers.filter(a => a.answer === null).length;
      if (unanswered > 0) {
        setConfirming(true);
        return;
      }
    }
    
    // Calculate results
    let totalPoints = 0;
    let earnedPoints = 0;
    let correctCount = 0;
    
    const resultAnswers = evaluation.questions.map(question => {
      const userAnswer = answers.find(a => a.questionId === question.id)?.answer;
      let isCorrect = false;
      
      // Compare answers based on question type
      if (question.type === 'multiple_choice') {
        // For multiple choice, correctAnswer is the index as string
        const correctIndex = parseInt(question.correctAnswer as string);
        const userIndex = userAnswer !== null ? parseInt(userAnswer as string) : -1;
        isCorrect = correctIndex === userIndex;
      } else if (question.type === 'true_false') {
        isCorrect = question.correctAnswer === userAnswer;
      } else if (question.type === 'short_answer') {
        const correct = (question.correctAnswer as string).toLowerCase().trim();
        const user = (userAnswer as string || '').toLowerCase().trim();
        isCorrect = correct === user;
      }
      // Essay questions are always marked for manual review
      
      totalPoints += question.points;
      if (isCorrect) {
        earnedPoints += question.points;
        correctCount++;
      }
      
      return {
        questionId: question.id,
        userAnswer: userAnswer ?? null,
        correctAnswer: question.correctAnswer,
        isCorrect,
        points: question.points,
        earnedPoints: isCorrect ? question.points : 0,
        explanation: question.explanation
      };
    });
    
    const percentage = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
    
    const submissionResult: SubmissionResult = {
      score: earnedPoints,
      totalPoints,
      percentage,
      passed: percentage >= (evaluation.settings.passingScore || 60),
      correctAnswers: correctCount,
      totalQuestions: evaluation.questions.length,
      answers: resultAnswers
    };
    
    // Save submission
    const submission = {
      id: `sub_${Date.now()}`,
      evaluationId: evaluation.id,
      userId: user.id,
      userName: user.name,
      answers,
      score: earnedPoints,
      totalPoints,
      percentage,
      passed: submissionResult.passed,
      submittedAt: new Date().toISOString(),
      timeSpent: evaluation.settings.timeLimit 
        ? (evaluation.settings.timeLimit * 60) - (timeRemaining || 0) 
        : 0
    };
    
    // Save submission to Firebase
    await evaluationService.createAttempt(submission);
    
    setResult(submissionResult);
    setSubmitted(true);
    setConfirming(false);
  }, [evaluation, user, answers, timeRemaining, confirming]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!evaluation) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900">Evaluación no encontrada</h3>
        <Button onClick={() => navigate('/evaluations')} className="mt-4">
          Volver a evaluaciones
        </Button>
      </div>
    );
  }

  // Show results after submission
  if (submitted && result && evaluation.settings.showResults) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Card>
          <CardContent className="p-8 text-center">
            {result.passed ? (
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            ) : (
              <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            )}
            
            <h2 className="text-2xl font-bold mb-2">
              {result.passed ? '¡Felicidades!' : 'Evaluación Completada'}
            </h2>
            
            <p className="text-gray-600 mb-6">
              {result.passed 
                ? 'Has aprobado esta evaluación' 
                : 'No alcanzaste el puntaje mínimo para aprobar'}
            </p>
            
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-3xl font-bold text-indigo-600">{result.percentage}%</p>
                <p className="text-sm text-gray-600">Puntaje</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-3xl font-bold text-green-600">{result.correctAnswers}</p>
                <p className="text-sm text-gray-600">Correctas</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-3xl font-bold text-gray-600">{result.totalQuestions}</p>
                <p className="text-sm text-gray-600">Total</p>
              </div>
            </div>
            
            <Button onClick={() => navigate('/evaluations')}>
              Volver a Evaluaciones
            </Button>
          </CardContent>
        </Card>
        
        {/* Show detailed results */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">Detalle de Respuestas</h3>
            <div className="space-y-4">
              {result.answers.map((answer, index) => {
                const question = evaluation.questions.find(q => q.id === answer.questionId);
                if (!question) return null;
                
                return (
                  <div 
                    key={answer.questionId}
                    className={`p-4 rounded-lg border ${
                      answer.isCorrect 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium">
                          {index + 1}. {question.question}
                        </p>
                        <p className="text-sm mt-1">
                          Tu respuesta: {' '}
                          <span className={answer.isCorrect ? 'text-green-700' : 'text-red-700'}>
                            {question.type === 'multiple_choice' && question.options
                              ? question.options[parseInt(answer.userAnswer as string)] || 'Sin respuesta'
                              : question.type === 'true_false'
                                ? answer.userAnswer === true ? 'Verdadero' : answer.userAnswer === false ? 'Falso' : 'Sin respuesta'
                                : answer.userAnswer || 'Sin respuesta'
                            }
                          </span>
                        </p>
                        {!answer.isCorrect && (
                          <p className="text-sm text-green-700 mt-1">
                            Respuesta correcta: {' '}
                            {question.type === 'multiple_choice' && question.options
                              ? question.options[parseInt(answer.correctAnswer as string)]
                              : question.type === 'true_false'
                                ? answer.correctAnswer === true ? 'Verdadero' : 'Falso'
                                : answer.correctAnswer as string
                            }
                          </p>
                        )}
                        {answer.explanation && (
                          <p className="text-sm text-gray-600 mt-2 italic">
                            {answer.explanation}
                          </p>
                        )}
                      </div>
                      <span className={`font-medium ${answer.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                        {answer.earnedPoints}/{answer.points} pts
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If submitted but results not shown
  if (submitted) {
    return (
      <div className="max-w-lg mx-auto">
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Evaluación Enviada</h2>
            <p className="text-gray-600 mb-6">
              Tu evaluación ha sido enviada correctamente. El instructor revisará tus respuestas.
            </p>
            <Button onClick={() => navigate('/evaluations')}>
              Volver a Evaluaciones
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentQuestion = evaluation.questions[currentQuestionIndex];
  const currentAnswer = getCurrentAnswer();
  const answeredCount = answers.filter(a => a.answer !== null).length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{evaluation.title}</h1>
          <p className="text-gray-600">{evaluation.courseName}</p>
        </div>
        {timeRemaining !== null && (
          <div className={`flex items-center px-4 py-2 rounded-lg ${
            timeRemaining < 60 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
          }`}>
            <Clock className="h-5 w-5 mr-2" />
            <span className="font-mono font-bold">{formatTime(timeRemaining)}</span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">
              Pregunta {currentQuestionIndex + 1} de {evaluation.questions.length}
            </span>
            <span className="text-sm text-gray-600">
              {answeredCount} respondidas
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-indigo-600 h-2 rounded-full transition-all"
              style={{ width: `${((currentQuestionIndex + 1) / evaluation.questions.length) * 100}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Question */}
      <Card>
        <CardContent className="p-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-indigo-600">
                {currentQuestion.type === 'multiple_choice' ? 'Opción Múltiple' :
                 currentQuestion.type === 'true_false' ? 'Verdadero/Falso' :
                 currentQuestion.type === 'short_answer' ? 'Respuesta Corta' :
                 currentQuestion.type === 'essay' ? 'Ensayo' : 'Pregunta'}
              </span>
              <span className="text-sm text-gray-600">{currentQuestion.points} puntos</span>
            </div>
            <h2 className="text-lg font-medium">{currentQuestion.question}</h2>
          </div>

          {/* Multiple Choice */}
          {currentQuestion.type === 'multiple_choice' && currentQuestion.options && (
            <div className="space-y-3">
              {currentQuestion.options.map((option, index) => (
                <label 
                  key={index}
                  className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${
                    currentAnswer === index.toString()
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="answer"
                    checked={currentAnswer === index.toString()}
                    onChange={() => handleAnswerChange(currentQuestion.id, index.toString())}
                    className="h-4 w-4 text-indigo-600"
                  />
                  <span className="ml-3">{option}</span>
                </label>
              ))}
            </div>
          )}

          {/* True/False */}
          {currentQuestion.type === 'true_false' && (
            <div className="space-y-3">
              <label 
                className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${
                  currentAnswer === true
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="answer"
                  checked={currentAnswer === true}
                  onChange={() => handleAnswerChange(currentQuestion.id, true)}
                  className="h-4 w-4 text-indigo-600"
                />
                <span className="ml-3">Verdadero</span>
              </label>
              <label 
                className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${
                  currentAnswer === false
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="answer"
                  checked={currentAnswer === false}
                  onChange={() => handleAnswerChange(currentQuestion.id, false)}
                  className="h-4 w-4 text-indigo-600"
                />
                <span className="ml-3">Falso</span>
              </label>
            </div>
          )}

          {/* Short Answer */}
          {currentQuestion.type === 'short_answer' && (
            <input
              type="text"
              value={(currentAnswer as string) || ''}
              onChange={e => handleAnswerChange(currentQuestion.id, e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Escribe tu respuesta..."
            />
          )}

          {/* Essay */}
          {currentQuestion.type === 'essay' && (
            <textarea
              value={(currentAnswer as string) || ''}
              onChange={e => handleAnswerChange(currentQuestion.id, e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              rows={6}
              placeholder="Desarrolla tu respuesta..."
            />
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
          disabled={currentQuestionIndex === 0}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Anterior
        </Button>
        
        <div className="flex space-x-1">
          {evaluation.questions.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentQuestionIndex(index)}
              className={`w-8 h-8 rounded-full text-sm font-medium ${
                index === currentQuestionIndex
                  ? 'bg-indigo-600 text-white'
                  : answers[index]?.answer !== null
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-600'
              }`}
            >
              {index + 1}
            </button>
          ))}
        </div>
        
        {currentQuestionIndex < evaluation.questions.length - 1 ? (
          <Button
            onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
          >
            Siguiente
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={() => handleSubmit()}>
            <Send className="h-4 w-4 mr-2" />
            Enviar
          </Button>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirming && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardContent className="p-6">
              <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-center mb-2">
                ¿Enviar evaluación?
              </h3>
              <p className="text-gray-600 text-center mb-4">
                Tienes {answers.filter(a => a.answer === null).length} preguntas sin responder.
                ¿Deseas enviar de todas formas?
              </p>
              <div className="flex space-x-3">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setConfirming(false)}
                >
                  Revisar
                </Button>
                <Button 
                  className="flex-1"
                  onClick={() => handleSubmit(true)}
                >
                  Enviar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
