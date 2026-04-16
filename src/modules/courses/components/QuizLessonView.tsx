import { useState, useEffect, useCallback, useRef } from 'react';
import { useBlocker, useNavigate } from 'react-router-dom';
import type { DBLesson, DBSectionLessonOverride } from '@shared/services/dataService';
import { firebaseDB } from '@shared/services/firebaseDataService';
import type { DBEvaluationAttempt } from '@shared/services/firebaseDataService';
import type { QuizLessonContent, QuizQuestion } from './QuizLessonEditor';
import { resolveDeadlines, getTaskDeadlineStatus, formatDeadlineDate, getTimeRemaining, parseTimestamp } from '@shared/utils/deadlines';
import { Button } from '@shared/components/ui/Button';
import {
  CheckCircle,
  XCircle,
  Trophy,
  AlertCircle,
  RotateCcw,
  HelpCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Send,
  Eye,
  X,
} from 'lucide-react';

// --- Helpers ---

function normalizeText(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// --- Types ---

interface QuizLessonViewProps {
  lesson: DBLesson;
  onComplete: () => void;
  userId?: string;
  courseId?: string;
  readOnly?: boolean;
  sectionOverride?: DBSectionLessonOverride | null;
  /** When true, the quiz is rendered inside a popup window — runs inline. */
  popupMode?: boolean;
  /** sectionId needed to build the popup URL */
  sectionId?: string;
}

interface QuizAnswers { [questionId: string]: any; }

interface QuizResult {
  totalPoints: number;
  earnedPoints: number;
  percentage: number;
  passed: boolean;
  questionResults: { questionId: string; correct: boolean; earnedPoints: number }[];
}

type QuizPhase = 'start' | 'active' | 'results' | 'review';

// --- Component ---

export default function QuizLessonView({ lesson, onComplete, userId, courseId, readOnly, sectionOverride, popupMode, sectionId }: QuizLessonViewProps) {
  const [quizContent, setQuizContent] = useState<QuizLessonContent | null>(null);
  const [displayQuestions, setDisplayQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [phase, setPhase] = useState<QuizPhase>('start');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Attempt history
  const [pastAttempts, setPastAttempts] = useState<DBEvaluationAttempt[]>([]);
  const [loadingAttempts, setLoadingAttempts] = useState(true);
  const [reviewingAttempt, setReviewingAttempt] = useState<DBEvaluationAttempt | null>(null);

  // In-progress attempt persistence
  const [activeAttemptId, setActiveAttemptId] = useState<string | null>(null);
  const [quizStartedAt, setQuizStartedAt] = useState<number | null>(null);
  const [inProgressAttempt, setInProgressAttempt] = useState<DBEvaluationAttempt | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popupRef = useRef<Window | null>(null);
  const [popupOpen, setPopupOpen] = useState(false);

  // Open quiz in a popup window (used when not in popupMode)
  const openQuizPopup = () => {
    if (!sectionId) return;
    const w = window.screen.availWidth;
    const h = window.screen.availHeight;
    const features = `popup=yes,width=${w},height=${h},left=0,top=0,scrollbars=yes`;
    popupRef.current = window.open(`/quiz/${sectionId}/${lesson.id}`, 'quizPopup', features);
    if (popupRef.current) setPopupOpen(true);
  };

  // When the popup closes, refresh the page so the student sees the new attempt
  useEffect(() => {
    if (!popupOpen || !popupRef.current) return;
    const popup = popupRef.current;
    const interval = setInterval(() => {
      if (popup.closed) {
        clearInterval(interval);
        popupRef.current = null;
        setPopupOpen(false);
        window.location.reload();
      }
    }, 500);
    return () => clearInterval(interval);
  }, [popupOpen]);

  // Whether to use the popup flow: only for students (not readOnly, not already in popup)
  const shouldUsePopup = !popupMode && !readOnly && !!sectionId;

  // Load quiz content
  useEffect(() => {
    try {
      const parsed: QuizLessonContent =
        typeof lesson.content === 'string' ? JSON.parse(lesson.content) : lesson.content;
      setQuizContent(parsed);
    } catch {
      setQuizContent(null);
    }
  }, [lesson.id, lesson.content]);

  // Load past attempts + detect in-progress
  useEffect(() => {
    if (!userId) { setLoadingAttempts(false); return; }
    (async () => {
      try {
        const attempts = await firebaseDB.getEvaluationAttempts(userId);
        const lessonAttempts = attempts
          .filter((a) => a.evaluationId === lesson.id)
          .sort((a, b) => b.createdAt - a.createdAt);

        // Check for in-progress attempt
        const inProgress = lessonAttempts.find(a => a.status === 'in_progress');
        if (inProgress) {
          setInProgressAttempt(inProgress);
        }

        setPastAttempts(lessonAttempts.filter(a => a.status === 'completed'));
      } catch { /* ignore */ }
      setLoadingAttempts(false);
    })();
  }, [userId, lesson.id]);

  // In popup mode, auto-start the quiz once data is loaded
  const [autoStarted, setAutoStarted] = useState(false);
  useEffect(() => {
    if (!popupMode || autoStarted || !quizContent || loadingAttempts) return;
    setAutoStarted(true);
    // If there's an in-progress attempt, resume it; otherwise start fresh
    if (inProgressAttempt) {
      // Check if the in-progress attempt timer has expired
      const startMs = new Date(inProgressAttempt.startedAt).getTime();
      const timeLimitMin = lesson.settings?.timeLimit || quizContent.settings.timeLimit;
      const totalSec = timeLimitMin && timeLimitMin > 0 ? timeLimitMin * 60 : null;
      const elapsed = Math.floor((Date.now() - startMs) / 1000);
      if (totalSec === null || elapsed < totalSec) {
        resumeQuiz();
        return;
      }
    }
    initQuiz();
  }, [popupMode, autoStarted, quizContent, loadingAttempts, inProgressAttempt]);

  const navigate = useNavigate();
  const isAttemptActive = phase === 'active' && !readOnly;

  // beforeunload guard (browser tab close / refresh) while attempt is active
  useEffect(() => {
    if (!isAttemptActive) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isAttemptActive]);

  // In-app navigation guard via useBlocker (react-router v6.4+/v7)
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    isAttemptActive && currentLocation.pathname !== nextLocation.pathname
  );
  useEffect(() => {
    if (blocker.state === 'blocked') {
      const confirmLeave = window.confirm('¿Seguro que quieres salir? Perderás tu progreso del intento actual.');
      if (confirmLeave) blocker.proceed();
      else blocker.reset();
    }
  }, [blocker]);

  const handleExitClick = () => {
    const confirmLeave = window.confirm('¿Seguro que quieres salir? Perderás tu progreso del intento actual.');
    if (!confirmLeave) return;
    if (popupMode) window.close();
    else navigate(-1);
  };

  // Timer
  useEffect(() => {
    if (phase !== 'active' || timeLeft === null) return;
    if (timeLeft <= 0) { handleSubmit(); return; }
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => (t !== null && t > 0 ? t - 1 : 0));
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase, timeLeft]);

  const getEffectiveTimeLimit = (): number | null => {
    if (!quizContent) return null;
    const timeLimitMinutes = lesson.settings?.timeLimit || quizContent.settings.timeLimit;
    return timeLimitMinutes && timeLimitMinutes > 0 ? timeLimitMinutes * 60 : null;
  };

  const initQuiz = async () => {
    if (!quizContent) return;
    let questions = [...quizContent.questions];
    if (quizContent.settings.shuffleQuestions) questions = shuffleArray(questions);
    setDisplayQuestions(questions);

    const initialAnswers: QuizAnswers = {};
    for (const q of questions) {
      switch (q.type) {
        case 'true_false': case 'single_choice': initialAnswers[q.id] = null; break;
        case 'multiple_choice': initialAnswers[q.id] = []; break;
        case 'match_drag': case 'match_dropdown': initialAnswers[q.id] = {}; break;
        case 'open_answer': initialAnswers[q.id] = ''; break;
      }
    }
    setAnswers(initialAnswers);
    setCurrentIndex(0);
    setResult(null);
    setReviewingAttempt(null);

    const startTime = Date.now();
    setQuizStartedAt(startTime);
    setTimeLeft(getEffectiveTimeLimit());

    // Save in-progress attempt to Firebase
    if (userId) {
      try {
        const attempt = await firebaseDB.createAttempt({
          evaluationId: lesson.id,
          userId,
          courseId: courseId || '',
          answers: questions.map(q => ({ questionId: q.id, answer: null, isCorrect: false, pointsEarned: 0 })),
          score: 0,
          maxScore: 0,
          percentage: 0,
          passed: false,
          timeSpent: 0,
          startedAt: new Date(startTime).toISOString(),
          completedAt: '',
          status: 'in_progress' as any,
          createdAt: startTime,
          updatedAt: startTime,
        });
        setActiveAttemptId(attempt.id);
      } catch { /* ignore */ }
    }

    setPhase('active');
  };

  // Resume an in-progress attempt
  const resumeQuiz = () => {
    if (!quizContent || !inProgressAttempt) return;

    // Restore questions in original order (don't re-shuffle)
    const questions = quizContent.questions.filter(q =>
      inProgressAttempt.answers.some(a => a.questionId === q.id)
    );
    // Maintain the order from the saved attempt
    const orderedQuestions = inProgressAttempt.answers
      .map(a => questions.find(q => q.id === a.questionId))
      .filter(Boolean) as QuizQuestion[];
    setDisplayQuestions(orderedQuestions.length > 0 ? orderedQuestions : quizContent.questions);

    // Restore answers
    const restoredAnswers: QuizAnswers = {};
    for (const a of inProgressAttempt.answers) {
      restoredAnswers[a.questionId] = a.answer;
    }
    setAnswers(restoredAnswers);
    setCurrentIndex(0);
    setResult(null);
    setReviewingAttempt(null);

    // Timer: calculate remaining time from startedAt
    const startTime = new Date(inProgressAttempt.startedAt).getTime();
    setQuizStartedAt(startTime);
    const totalSeconds = getEffectiveTimeLimit();
    if (totalSeconds !== null) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, totalSeconds - elapsed);
      setTimeLeft(remaining);
    } else {
      setTimeLeft(null);
    }

    setActiveAttemptId(inProgressAttempt.id);
    setInProgressAttempt(null);
    setPhase('active');
  };

  const setAnswer = useCallback((questionId: string, value: any) => {
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: value };
      // Debounced save to Firebase
      if (activeAttemptId) {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
          const answersList = Object.entries(next).map(([qId, ans]) => ({
            questionId: qId,
            answer: ans,
            isCorrect: false,
            pointsEarned: 0,
          }));
          firebaseDB.updateAttempt(activeAttemptId, { answers: answersList, updatedAt: Date.now() }).catch(() => {});
        }, 1000);
      }
      return next;
    });
  }, [activeAttemptId]);

  const isAnswered = (qId: string): boolean => {
    const a = answers[qId];
    if (a === null || a === undefined) return false;
    if (typeof a === 'string' && a.trim() === '') return false;
    if (Array.isArray(a) && a.length === 0) return false;
    if (typeof a === 'object' && !Array.isArray(a) && Object.keys(a).length === 0) return false;
    return true;
  };

  const scoreQuiz = (): QuizResult => {
    if (!quizContent) return { totalPoints: 0, earnedPoints: 0, percentage: 0, passed: false, questionResults: [] };
    const questionResults: QuizResult['questionResults'] = [];
    let totalPoints = 0, earnedPoints = 0;

    for (const q of quizContent.questions) {
      totalPoints += q.points;
      const answer = answers[q.id];
      let correct = false;

      switch (q.type) {
        case 'true_false': correct = answer === q.correctBool; break;
        case 'single_choice': { const c = q.options?.find((o) => o.isCorrect); correct = answer === c?.id; break; }
        case 'multiple_choice': {
          const cIds = new Set(q.options?.filter((o) => o.isCorrect).map((o) => o.id) || []);
          const sIds = new Set(answer as string[]);
          correct = cIds.size === sIds.size && [...cIds].every((id) => sIds.has(id));
          break;
        }
        case 'match_drag': case 'match_dropdown': {
          const pairs = q.pairs || [];
          const um = answer as Record<string, string>;
          let cc = 0;
          for (const p of pairs) { if (um[p.id] === p.right) cc++; }
          if (pairs.length > 0) {
            const earned = (cc / pairs.length) * q.points;
            earnedPoints += earned;
            questionResults.push({ questionId: q.id, correct: cc === pairs.length, earnedPoints: earned });
            continue;
          }
          break;
        }
        case 'open_answer': {
          const un = normalizeText(answer as string);
          correct = (q.acceptedAnswers || []).map(normalizeText).includes(un);
          break;
        }
      }
      earnedPoints += correct ? q.points : 0;
      questionResults.push({ questionId: q.id, correct, earnedPoints: correct ? q.points : 0 });
    }

    const percentage = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
    return { totalPoints, earnedPoints, percentage, passed: percentage >= (quizContent.settings.passingScore || 70), questionResults };
  };

  const handleSubmit = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    const quizResult = scoreQuiz();
    setResult(quizResult);
    setPhase('results');
    if (quizResult.passed) onComplete();

    const timeSpent = quizStartedAt ? Math.floor((Date.now() - quizStartedAt) / 1000) : 0;
    const completedAnswers = quizContent!.questions.map((q) => {
      const qr = quizResult.questionResults.find((r) => r.questionId === q.id);
      return { questionId: q.id, answer: answers[q.id], isCorrect: qr?.correct, pointsEarned: qr?.earnedPoints || 0 };
    });

    if (userId && quizContent) {
      try {
        if (activeAttemptId) {
          // Update existing in-progress attempt to completed
          await firebaseDB.updateAttempt(activeAttemptId, {
            answers: completedAnswers,
            score: quizResult.earnedPoints,
            maxScore: quizResult.totalPoints,
            percentage: quizResult.percentage,
            passed: quizResult.passed,
            timeSpent,
            completedAt: new Date().toISOString(),
            status: 'completed',
            updatedAt: Date.now(),
          });
          const updated = await firebaseDB.getById<DBEvaluationAttempt>('evaluationAttempts', activeAttemptId);
          if (updated) setPastAttempts((prev) => [updated, ...prev]);
        } else {
          // Fallback: create new attempt
          const attempt = await firebaseDB.createAttempt({
            evaluationId: lesson.id,
            userId,
            courseId: courseId || '',
            answers: completedAnswers,
            score: quizResult.earnedPoints,
            maxScore: quizResult.totalPoints,
            percentage: quizResult.percentage,
            passed: quizResult.passed,
            timeSpent,
            startedAt: new Date(quizStartedAt || Date.now()).toISOString(),
            completedAt: new Date().toISOString(),
            status: 'completed',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
          setPastAttempts((prev) => [attempt, ...prev]);
        }
      } catch { /* ignore */ }
    }
    setActiveAttemptId(null);
    setQuizStartedAt(null);
  };

  const bestScore = pastAttempts.length > 0 ? Math.max(...pastAttempts.map((a) => a.percentage)) : null;
  const hasPerfectScore = bestScore === 100;

  // --- No content ---
  if (!quizContent || quizContent.questions.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500">
        <HelpCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
        <p>Este quiz no tiene preguntas configuradas.</p>
      </div>
    );
  }

  // =====================
  // PHASE: REVIEW (past attempt)
  // =====================
  if (phase === 'review' && reviewingAttempt && quizContent) {
    return (
      <div className="p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">
            Review — {reviewingAttempt.percentage}%
            {reviewingAttempt.passed
              ? <span className="ml-2 text-sm text-green-600 font-normal">Aprobado</span>
              : <span className="ml-2 text-sm text-red-600 font-normal">No aprobado</span>}
          </h3>
          <Button variant="outline" size="sm" onClick={() => { setPhase('start'); setReviewingAttempt(null); }}>
            Volver
          </Button>
        </div>
        <div className="space-y-3">
          {quizContent.questions.map((q, idx) => {
            const attemptAnswer = reviewingAttempt.answers.find((a) => a.questionId === q.id);
            const isCorrect = attemptAnswer?.isCorrect ?? false;
            return (
              <div key={q.id} className={`p-3 rounded-lg border ${isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                <div className="flex items-start gap-2">
                  {isCorrect
                    ? <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    : <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />}
                  <div>
                    <p className="text-sm font-medium text-gray-900">{idx + 1}. {q.question}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {isCorrect ? 'Correcto' : 'Incorrecto'} — {attemptAnswer?.pointsEarned || 0}/{q.points} pts
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // =====================
  // PHASE: START
  // =====================
  // Read-only mode for teachers: show quiz questions as preview
  if (readOnly) {
    return (
      <div className="p-4 md:p-6">
        <div className="flex items-center gap-2 mb-4 p-3 bg-gray-50 rounded-lg">
          <Eye className="h-4 w-4 text-gray-500" />
          <span className="text-sm text-gray-600">Vista de profesor — {quizContent.questions.length} preguntas, {quizContent.questions.reduce((s, q) => s + q.points, 0)} pts, aprobación: {quizContent.settings.passingScore || 70}%</span>
        </div>
        <div className="space-y-3">
          {quizContent.questions.map((q, idx) => (
            <div key={q.id} className="p-3 border border-gray-200 rounded-lg">
              <p className="text-sm font-medium text-gray-900 mb-2">
                <span className="text-red-600 mr-1">{idx + 1}.</span>
                {q.question}
                <span className="text-xs text-gray-400 ml-2">({q.points} pts)</span>
              </p>
              {q.type === 'true_false' && (
                <p className="text-xs text-green-700">Respuesta: {q.correctBool ? 'Verdadero' : 'Falso'}</p>
              )}
              {(q.type === 'single_choice' || q.type === 'multiple_choice') && q.options && (
                <div className="space-y-1 mt-1">
                  {q.options.map((opt) => (
                    <p key={opt.id} className={`text-xs px-2 py-1 rounded ${opt.isCorrect ? 'bg-green-50 text-green-700 font-medium' : 'text-gray-500'}`}>
                      {opt.isCorrect ? '✓' : '○'} {opt.text}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (phase === 'start') {
    const effectiveTimeLimit = lesson.settings?.timeLimit || quizContent.settings.timeLimit;
    const hasTimer = effectiveTimeLimit && effectiveTimeLimit > 0;
    const totalPoints = quizContent.questions.reduce((s, q) => s + q.points, 0);

    // Resolve deadlines from template + section override
    const resolved = resolveDeadlines(lesson.settings, sectionOverride);
    const deadlineStatus = getTaskDeadlineStatus({
      availableFrom: resolved.availableFrom,
      dueDate: resolved.dueDate,
      lateSubmissionDeadline: resolved.lateSubmissionDeadline,
    });
    const dueDateTs = parseTimestamp(resolved.dueDate);
    const availableFromTs = parseTimestamp(resolved.availableFrom);
    const isBlocked = !readOnly && (deadlineStatus === 'not_open' || deadlineStatus === 'closed');

    return (
      <div className="p-6 md:p-10">
        <div className="max-w-md mx-auto text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <HelpCircle className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Quiz</h2>
          <p className="text-gray-500 mb-6">Revisa la información antes de comenzar</p>

          <div className="mb-6 text-left border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2.5 text-gray-500 font-medium bg-gray-50 w-1/3">Preguntas</td>
                  <td className="px-4 py-2.5 text-gray-900 font-semibold">{quizContent.questions.length}</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2.5 text-gray-500 font-medium bg-gray-50">Puntos totales</td>
                  <td className="px-4 py-2.5 text-gray-900 font-semibold">{totalPoints}</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2.5 text-gray-500 font-medium bg-gray-50">Para aprobar</td>
                  <td className="px-4 py-2.5 text-gray-900 font-semibold">{quizContent.settings.passingScore || 70}%</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2.5 text-gray-500 font-medium bg-gray-50">Tiempo límite</td>
                  <td className="px-4 py-2.5 text-gray-900 font-semibold">{hasTimer ? `${effectiveTimeLimit} minutos` : 'Sin límite'}</td>
                </tr>
                {availableFromTs && (
                  <tr className="border-b border-gray-100">
                    <td className="px-4 py-2.5 text-gray-500 font-medium bg-gray-50">Abre</td>
                    <td className="px-4 py-2.5 text-gray-900">{formatDeadlineDate(availableFromTs)}</td>
                  </tr>
                )}
                {dueDateTs && (
                  <tr className="border-b border-gray-100">
                    <td className="px-4 py-2.5 text-gray-500 font-medium bg-gray-50">Cierra</td>
                    <td className={`px-4 py-2.5 font-semibold ${deadlineStatus === 'closed' ? 'text-red-600' : 'text-gray-900'}`}>
                      {formatDeadlineDate(dueDateTs)}
                      {deadlineStatus === 'open' && (
                        <span className="ml-2 text-xs font-normal text-green-600">({getTimeRemaining(dueDateTs)} restantes)</span>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Deadline status messages */}
          {!readOnly && deadlineStatus === 'not_open' && (
            <div className="flex items-center justify-center gap-2 text-sm text-blue-700 bg-blue-50 p-3 rounded-lg mb-4">
              <Clock className="h-4 w-4" />
              <span>
                Este quiz estará disponible el {availableFromTs ? formatDeadlineDate(availableFromTs) : 'pronto'}
              </span>
            </div>
          )}

          {!readOnly && deadlineStatus === 'closed' && (
            <div className="flex items-center justify-center gap-2 text-sm text-red-700 bg-red-50 p-3 rounded-lg mb-4">
              <AlertCircle className="h-4 w-4" />
              <span>
                Este quiz cerró el {dueDateTs ? formatDeadlineDate(dueDateTs) : ''}
              </span>
            </div>
          )}

          {!readOnly && deadlineStatus === 'open' && dueDateTs && (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-700 bg-gray-50 p-3 rounded-lg mb-4">
              <Clock className="h-4 w-4" />
              <span>Entrega: {getTimeRemaining(dueDateTs)} restantes</span>
            </div>
          )}

          {!readOnly && deadlineStatus === 'late_period' && (
            <div className="flex items-center justify-center gap-2 text-sm text-yellow-700 bg-yellow-50 p-3 rounded-lg mb-4">
              <AlertCircle className="h-4 w-4" />
              <span>Período de entrega tardía</span>
            </div>
          )}

          {hasTimer && (
            <div className="flex items-center justify-center gap-2 text-sm text-amber-700 bg-amber-50 p-3 rounded-lg mb-6">
              <Clock className="h-4 w-4" />
              <span>Se enviará automáticamente al acabar el tiempo</span>
            </div>
          )}

          {/* Past attempts */}
          {!loadingAttempts && pastAttempts.length > 0 && (
            <div className="mb-6 text-left">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Intentos anteriores</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {pastAttempts.map((attempt, i) => (
                  <div key={attempt.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      {attempt.passed
                        ? <CheckCircle className="h-4 w-4 text-green-500" />
                        : <XCircle className="h-4 w-4 text-red-400" />}
                      <div>
                        <span className="text-sm font-medium text-gray-900">{attempt.percentage}%</span>
                        <span className="text-xs text-gray-500 ml-2">
                          {new Date(attempt.createdAt).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => { setReviewingAttempt(attempt); setPhase('review'); }}
                      className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Review
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Continue in-progress attempt */}
          {!readOnly && inProgressAttempt && !isBlocked && (() => {
            const startedMs = new Date(inProgressAttempt.startedAt).getTime();
            const totalSec = getEffectiveTimeLimit();
            const elapsedSec = Math.floor((Date.now() - startedMs) / 1000);
            const expired = totalSec !== null && elapsedSec >= totalSec;
            const answeredSaved = inProgressAttempt.answers.filter(a => a.answer !== null).length;
            return expired ? (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-center mb-4">
                <Clock className="h-6 w-6 text-yellow-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-yellow-800">Tu intento anterior expiró</p>
                <p className="text-xs text-yellow-600">El tiempo se agotó mientras estabas fuera.</p>
              </div>
            ) : (
              <div className="mb-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
                  <Clock className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-blue-800">Tienes un intento en progreso</p>
                  <p className="text-xs text-blue-600 mb-3">
                    {answeredSaved} de {inProgressAttempt.answers.length} respondidas
                    {totalSec !== null && ` · ${formatTime(Math.max(0, totalSec - elapsedSec))} restantes`}
                  </p>
                  <Button onClick={shouldUsePopup ? openQuizPopup : resumeQuiz} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-sm">
                    <RotateCcw className="h-4 w-4 mr-2" />Continuar intento
                  </Button>
                </div>
              </div>
            );
          })()}

          {hasPerfectScore ? (
            <div className="p-4 bg-green-50 rounded-lg text-center">
              <Trophy className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-green-800">¡Puntaje perfecto!</p>
              <p className="text-xs text-green-600 mt-1">Ya obtuviste 100% en este quiz</p>
            </div>
          ) : isBlocked ? (
            <Button disabled className="w-full py-3 bg-gray-400 cursor-not-allowed text-base">
              {deadlineStatus === 'not_open' ? 'Quiz no disponible aún' : 'Quiz cerrado'}
            </Button>
          ) : (
            <Button onClick={shouldUsePopup ? openQuizPopup : initQuiz} className="w-full py-3 bg-red-600 hover:bg-red-700 text-base">
              {pastAttempts.length > 0 ? (
                <><RotateCcw className="h-4 w-4 mr-2" />Reintentar Quiz</>
              ) : inProgressAttempt ? (
                <><RotateCcw className="h-4 w-4 mr-2" />Nuevo intento</>
              ) : (
                'Comenzar Quiz'
              )}
            </Button>
          )}
        </div>
      </div>
    );
  }

  // =====================
  // PHASE: ACTIVE
  // =====================
  if (phase === 'active' && displayQuestions.length > 0) {
    const currentQ = displayQuestions[currentIndex];
    const answeredCount = displayQuestions.filter((q) => isAnswered(q.id)).length;
    const isTimerCritical = timeLeft !== null && timeLeft <= 60;
    const isLast = currentIndex === displayQuestions.length - 1;

    return (
      <div className="fixed inset-0 z-[100] bg-white overflow-auto w-screen h-screen">
        <div className="h-full overflow-y-auto">
          {/* Sticky header */}
          <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
            <div className="max-w-4xl mx-auto px-4 sm:px-8 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-sm sm:text-base font-semibold text-gray-900 truncate">{lesson.title || 'Quiz'}</h2>
                <p className="text-xs text-gray-500">{currentIndex + 1} / {displayQuestions.length} preguntas · {answeredCount} respondidas</p>
              </div>
              {timeLeft !== null && (
                <div className={`flex items-center gap-1.5 text-sm font-mono font-bold px-3 py-1 rounded-full flex-shrink-0 ${isTimerCritical ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-gray-100 text-gray-700'}`}>
                  <Clock className="h-3.5 w-3.5" />{formatTime(timeLeft)}
                </div>
              )}
              <Button variant="outline" size="sm" onClick={handleExitClick} className="flex-shrink-0">
                <X className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Salir</span>
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-4xl mx-auto">
            <div className="mb-6 overflow-x-auto">
              <div className="flex gap-1.5 min-w-0 flex-wrap">
                {displayQuestions.map((q, idx) => {
                  const answered = isAnswered(q.id);
                  const isCurrent = idx === currentIndex;
                  return (
                    <button key={q.id} onClick={() => setCurrentIndex(idx)}
                      className={`w-8 h-8 rounded text-xs font-medium flex-shrink-0 transition-all ${
                        isCurrent
                          ? 'bg-red-600 text-white ring-2 ring-red-300'
                          : answered
                            ? 'bg-green-100 text-green-700 border border-green-300'
                            : 'bg-white text-red-400 border-2 border-dashed border-red-300 hover:bg-red-50'
                      }`}>
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-400">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 border border-green-300 inline-block" /> Respondida</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-white border-2 border-dashed border-red-300 inline-block" /> Sin responder</span>
              </div>
            </div>

            <div className="mb-8">
              <div className="flex items-start justify-between mb-4">
                <h3 className="font-medium text-gray-900 text-base md:text-lg">
                  <span className="text-red-600 mr-2">{currentIndex + 1}.</span>{currentQ.question}
                </h3>
                <span className="text-xs text-gray-500 flex-shrink-0 ml-3 mt-1">{currentQ.points} pts</span>
              </div>
              <QuestionInput key={currentQ.id} question={currentQ} answer={answers[currentQ.id]} onChange={(val) => setAnswer(currentQ.id, val)} shuffleOptions={quizContent.settings.shuffleOptions} />
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <Button variant="outline" size="sm" onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))} disabled={currentIndex === 0}>
                <ChevronLeft className="h-4 w-4 mr-1" /><span className="hidden sm:inline">Anterior</span>
              </Button>
              {isLast ? (
                <Button size="sm" onClick={handleSubmit} className="bg-red-600 hover:bg-red-700">
                  <Send className="h-4 w-4 mr-1" />Entregar
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setCurrentIndex((i) => i + 1)}>
                  <span className="hidden sm:inline">Siguiente</span><ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =====================
  // PHASE: RESULTS
  // =====================
  if (phase === 'results' && result) {
    return (
      <div className="p-4 md:p-6">
        <div className={`text-center p-6 md:p-8 rounded-lg mb-6 ${result.passed ? 'bg-green-50' : 'bg-red-50'}`}>
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${result.passed ? 'bg-green-100' : 'bg-red-100'}`}>
            {result.passed ? <Trophy className="h-8 w-8 text-green-600" /> : <AlertCircle className="h-8 w-8 text-red-600" />}
          </div>
          <h2 className="text-xl font-bold mb-1">{result.passed ? '¡Quiz Aprobado!' : 'Quiz No Aprobado'}</h2>
          <p className="text-3xl md:text-4xl font-bold mb-1">{result.percentage}%</p>
          <p className="text-gray-600 text-sm">{result.earnedPoints} de {result.totalPoints} puntos</p>
          <p className="text-xs text-gray-500 mt-1">Mínimo para aprobar: {quizContent.settings.passingScore}%</p>
        </div>

        {/* Simple correct/incorrect list */}
        <div className="space-y-2 mb-6">
          {displayQuestions.map((q, idx) => {
            const qr = result.questionResults.find((r) => r.questionId === q.id);
            return (
              <div key={q.id} className={`flex items-center gap-2 p-3 rounded-lg border ${qr?.correct ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                {qr?.correct ? <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" /> : <XCircle className="h-4 w-4 text-red-600 flex-shrink-0" />}
                <span className="text-sm text-gray-900 flex-1">{idx + 1}. {q.question}</span>
                <span className="text-xs text-gray-500">{qr?.earnedPoints || 0}/{q.points}</span>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          {popupMode ? (
            <Button variant="outline" onClick={() => window.close()}>
              Cerrar ventana
            </Button>
          ) : (
            <Button variant="outline" onClick={() => { setPhase('start'); setResult(null); }}>
              Volver al inicio
            </Button>
          )}
          {!result.passed && !hasPerfectScore && (
            <Button onClick={initQuiz} className="bg-red-600 hover:bg-red-700">
              <RotateCcw className="h-4 w-4 mr-2" />Reintentar
            </Button>
          )}
        </div>
      </div>
    );
  }

  return null;
}

// --- Question Input Components ---

function QuestionInput({ question, answer, onChange, shuffleOptions }: { question: QuizQuestion; answer: any; onChange: (value: any) => void; shuffleOptions: boolean }) {
  switch (question.type) {
    case 'true_false': return <TrueFalseInput answer={answer} onChange={onChange} />;
    case 'single_choice': return <SingleChoiceInput question={question} answer={answer} onChange={onChange} shuffle={shuffleOptions} />;
    case 'multiple_choice': return <MultipleChoiceInput question={question} answer={answer} onChange={onChange} shuffle={shuffleOptions} />;
    case 'match_drag': return <MatchDragInput question={question} answer={answer} onChange={onChange} />;
    case 'match_dropdown': return <MatchDropdownInput question={question} answer={answer} onChange={onChange} />;
    case 'open_answer': return <OpenAnswerInput answer={answer} onChange={onChange} />;
    default: return null;
  }
}

function TrueFalseInput({ answer, onChange }: { answer: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div className="flex gap-3">
      {[true, false].map((val) => (
        <button key={String(val)} onClick={() => onChange(val)}
          className={`flex-1 py-3 px-4 rounded-lg border-2 font-medium transition-colors ${answer === val ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'}`}>
          {val ? 'Verdadero' : 'Falso'}
        </button>
      ))}
    </div>
  );
}

function SingleChoiceInput({ question, answer, onChange, shuffle }: { question: QuizQuestion; answer: string | null; onChange: (v: string) => void; shuffle: boolean }) {
  const [options] = useState(() => shuffle ? shuffleArray(question.options || []) : question.options || []);
  return (
    <div className="space-y-2">
      {options.map((opt) => (
        <label key={opt.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${answer === opt.id ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}>
          <input type="radio" name={`q-${question.id}`} checked={answer === opt.id} onChange={() => onChange(opt.id)} className="h-4 w-4 text-red-600" />
          <span className="text-gray-800">{opt.text}</span>
        </label>
      ))}
    </div>
  );
}

function MultipleChoiceInput({ question, answer, onChange, shuffle }: { question: QuizQuestion; answer: string[]; onChange: (v: string[]) => void; shuffle: boolean }) {
  const [options] = useState(() => shuffle ? shuffleArray(question.options || []) : question.options || []);
  const toggle = (optId: string) => {
    const sel = answer || [];
    onChange(sel.includes(optId) ? sel.filter((id) => id !== optId) : [...sel, optId]);
  };
  return (
    <div className="space-y-2">
      {options.map((opt) => {
        const checked = (answer || []).includes(opt.id);
        return (
          <label key={opt.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${checked ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}>
            <input type="checkbox" checked={checked} onChange={() => toggle(opt.id)} className="h-4 w-4 text-red-600 rounded" />
            <span className="text-gray-800">{opt.text}</span>
          </label>
        );
      })}
    </div>
  );
}

function MatchDragInput({ question, answer, onChange }: { question: QuizQuestion; answer: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  const pairs = question.pairs || [];
  const [shuffledRight] = useState(() => shuffleArray(pairs.map((p) => p.right)));
  const [dragItem, setDragItem] = useState<string | null>(null);
  const placedValues = new Set(Object.values(answer || {}));
  const availableItems = shuffledRight.filter((item) => !placedValues.has(item));

  const handleDrop = (pairId: string) => {
    if (dragItem) {
      const na = { ...(answer || {}) };
      for (const [k, v] of Object.entries(na)) { if (v === dragItem) delete na[k]; }
      na[pairId] = dragItem;
      onChange(na);
      setDragItem(null);
    }
  };
  const handleTapItem = (item: string) => {
    const ep = pairs.find((p) => !(answer || {})[p.id]);
    if (ep) onChange({ ...(answer || {}), [ep.id]: item });
  };
  const removePair = (pairId: string) => {
    const na = { ...(answer || {}) };
    delete na[pairId];
    onChange(na);
  };

  return (
    <div className="flex flex-col md:flex-row gap-4">
      <div className="flex-1 space-y-2">
        <p className="text-xs text-gray-500 font-medium mb-2">ELEMENTOS</p>
        {pairs.map((pair) => (
          <div key={pair.id} onDragOver={(e) => e.preventDefault()} onDrop={() => handleDrop(pair.id)}
            className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-colors min-h-[48px] ${(answer || {})[pair.id] ? 'border-green-300 bg-green-50' : 'border-dashed border-gray-300 bg-gray-50'}`}>
            <span className="font-medium text-gray-800 flex-1 text-sm">{pair.left}</span>
            <span className="text-gray-400 mx-1">&rarr;</span>
            {(answer || {})[pair.id] ? (
              <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-medium cursor-pointer hover:bg-red-200" onClick={() => removePair(pair.id)}>{(answer || {})[pair.id]} &times;</span>
            ) : (
              <span className="text-gray-400 text-xs italic">Arrastra aquí</span>
            )}
          </div>
        ))}
      </div>
      <div className="md:w-40 space-y-2">
        <p className="text-xs text-gray-500 font-medium mb-2">OPCIONES</p>
        <div className="flex flex-wrap md:flex-col gap-2">
          {availableItems.map((item, idx) => (
            <div key={`${item}-${idx}`} draggable onDragStart={() => setDragItem(item)} onDragEnd={() => setDragItem(null)} onClick={() => handleTapItem(item)}
              className="p-2 md:p-3 bg-red-100 text-red-800 rounded-lg cursor-grab font-medium text-xs md:text-sm hover:bg-red-200 transition-colors">{item}</div>
          ))}
          {availableItems.length === 0 && <p className="text-xs text-gray-400 text-center py-2">Todas asignadas</p>}
        </div>
      </div>
    </div>
  );
}

function MatchDropdownInput({ question, answer, onChange }: { question: QuizQuestion; answer: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  const pairs = question.pairs || [];
  const [shuffledRight] = useState(() => shuffleArray(pairs.map((p) => p.right)));
  return (
    <div className="space-y-3">
      {pairs.map((pair) => (
        <div key={pair.id} className="flex flex-col sm:flex-row sm:items-center gap-2">
          <span className="font-medium text-gray-800 sm:flex-1 text-sm">{pair.left}</span>
          <span className="text-gray-400 hidden sm:block">&rarr;</span>
          <select value={(answer || {})[pair.id] || ''} onChange={(e) => onChange({ ...(answer || {}), [pair.id]: e.target.value })}
            className="sm:flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 text-sm">
            <option value="">Seleccionar...</option>
            {shuffledRight.map((item, idx) => <option key={`${item}-${idx}`} value={item}>{item}</option>)}
          </select>
        </div>
      ))}
    </div>
  );
}

function OpenAnswerInput({ answer, onChange }: { answer: string; onChange: (v: string) => void }) {
  return <input type="text" value={answer || ''} onChange={(e) => onChange(e.target.value)} placeholder="Escribe tu respuesta..."
    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 text-sm" />;
}
