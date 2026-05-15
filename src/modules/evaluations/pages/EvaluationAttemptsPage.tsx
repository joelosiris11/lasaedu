import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Pencil,
  Save,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  User,
  Clock,
} from 'lucide-react';
import { useAuthStore } from '@app/store/authStore';
import { evaluationService } from '@shared/services/dataService';
import { firebaseDB, type DBEvaluation, type DBEvaluationAttempt, type DBUser } from '@shared/services/firebaseDataService';
import { assessmentService } from '@shared/services/assessmentService';
import type { Assessment, Question } from '@shared/types/assessment';
import { Card, CardContent } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { Label } from '@shared/components/ui/Label';

/**
 * Teacher review screen for an evaluation. Lists every attempt and lets the
 * teacher inspect each one in detail, including the per-question AI grading
 * record for any ai_open_answer questions. The teacher can override the
 * suggested score and feedback — the override is persisted with the
 * teacher's id and timestamp so a clear audit trail remains.
 *
 * NOTE: The auto-grader's existence must remain hidden from the student. On
 * this page the teacher is explicitly informed that grading was assisted; the
 * student-facing pages never surface that fact.
 */
export default function EvaluationAttemptsPage() {
  const { evaluationId } = useParams<{ evaluationId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [evaluation, setEvaluation] = useState<DBEvaluation | Assessment | null>(null);
  const [questionMap, setQuestionMap] = useState<Record<string, Question>>({});
  const [attempts, setAttempts] = useState<DBEvaluationAttempt[]>([]);
  const [students, setStudents] = useState<Record<string, DBUser>>({});
  const [loading, setLoading] = useState(true);
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);

  useEffect(() => {
    if (!evaluationId) return;
    load(evaluationId);
  }, [evaluationId]);

  async function load(id: string) {
    setLoading(true);
    try {
      // Modern Assessment first; fall back to legacy DBEvaluation.
      const modern = await assessmentService.getAssessment(id);
      if (modern) {
        setEvaluation(modern);
        if (modern.questionData) setQuestionMap(modern.questionData);
      } else {
        const legacy = await evaluationService.getById(id);
        setEvaluation(legacy);
        // Legacy questions live on the eval itself with a different shape.
        const map: Record<string, Question> = {};
        for (const q of (legacy as DBEvaluation | null)?.questions || []) {
          map[q.id] = {
            id: q.id,
            type: (q.type as Question['type']) || 'short_answer',
            question: q.question,
            options: undefined,
            correctAnswer: q.correctAnswer,
            points: q.points,
            explanation: q.explanation,
            difficulty: 'medium',
          };
        }
        setQuestionMap(map);
      }

      const list = await evaluationService.getAttemptsByEvaluation(id);
      setAttempts(list);

      // Hydrate student names
      const userIds = Array.from(new Set(list.map((a) => a.userId)));
      const userPairs = await Promise.all(
        userIds.map(async (uid) => [uid, await firebaseDB.getUserById(uid)] as const),
      );
      const map: Record<string, DBUser> = {};
      for (const [uid, u] of userPairs) {
        if (u) map[uid] = u;
      }
      setStudents(map);
    } finally {
      setLoading(false);
    }
  }

  const selected = useMemo(
    () => attempts.find((a) => a.id === selectedAttemptId) || null,
    [attempts, selectedAttemptId],
  );

  function onOverride(updated: DBEvaluationAttempt) {
    setAttempts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  }

  if (!evaluationId) return null;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Volver
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Entregas y revisión</h1>
          <p className="text-gray-600">
            {evaluation ? (evaluation as { title?: string }).title : '...'} ·{' '}
            {attempts.length} {attempts.length === 1 ? 'intento' : 'intentos'}
          </p>
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-16 text-center text-gray-500">Cargando intentos...</CardContent>
        </Card>
      ) : attempts.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-gray-500">
            Todavía no hay intentos para esta evaluación.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Attempts list */}
          <div className="lg:col-span-1 space-y-2">
            {attempts.map((a) => {
              const studentName = students[a.userId]?.name || a.userName || a.userId;
              const hasAi = a.aiGrades && Object.keys(a.aiGrades).length > 0;
              const needsReview = hasAi && Object.values(a.aiGrades!).some(g => g.source === 'ai' && !g.overriddenBy);
              const isSelected = a.id === selectedAttemptId;
              return (
                <button
                  key={a.id}
                  onClick={() => setSelectedAttemptId(a.id)}
                  className={`w-full text-left p-3 border rounded-lg transition-colors ${
                    isSelected ? 'border-violet-500 bg-violet-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-gray-400" />
                        {studentName}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        {formatDate(a.submittedAt || a.completedAt || a.createdAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">{a.percentage ?? 0}%</p>
                      <p className="text-xs text-gray-500">
                        {a.score ?? 0}/{a.maxScore ?? a.totalPoints ?? '?'}
                      </p>
                    </div>
                  </div>
                  {needsReview && (
                    <div className="mt-2 inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                      <Sparkles className="w-3 h-3" />
                      Sugerencia automática — revisar
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Detail */}
          <div className="lg:col-span-2">
            {selected ? (
              <AttemptDetail
                attempt={selected}
                questionMap={questionMap}
                studentName={students[selected.userId]?.name || selected.userName || selected.userId}
                teacherId={user?.id || ''}
                onUpdated={onOverride}
              />
            ) : (
              <Card>
                <CardContent className="py-16 text-center text-gray-500">
                  Selecciona un intento para ver la revisión detallada.
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatDate(d?: number | string): string {
  if (!d) return '—';
  const t = typeof d === 'number' ? d : Date.parse(d);
  if (!Number.isFinite(t)) return String(d);
  return new Date(t).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

interface AttemptDetailProps {
  attempt: DBEvaluationAttempt;
  questionMap: Record<string, Question>;
  studentName: string;
  teacherId: string;
  onUpdated: (a: DBEvaluationAttempt) => void;
}

function AttemptDetail({ attempt, questionMap, studentName, teacherId, onUpdated }: AttemptDetailProps) {
  const [savingId, setSavingId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { score: string; feedback: string; reason: string }>>({});

  // Normalize the answers structure: legacy attempts store {questionId, answer}
  // pairs as an array of objects.
  const answers: { questionId: string; answer: unknown }[] = Array.isArray(attempt.answers)
    ? (attempt.answers as Array<{ questionId: string; answer: unknown }>)
    : Object.entries(attempt.answers || {}).map(([questionId, answer]) => ({ questionId, answer }));

  async function saveOverride(questionId: string, prevTotal: number, maxPoints: number) {
    const editKey = questionId;
    const edit = edits[editKey];
    if (!edit) return;
    const newScore = Number(edit.score);
    if (!Number.isFinite(newScore) || newScore < 0 || newScore > maxPoints) {
      alert(`La nota debe estar entre 0 y ${maxPoints}.`);
      return;
    }
    setSavingId(questionId);
    try {
      const existing = attempt.aiGrades?.[questionId];
      const updatedGrade = {
        questionId,
        pointsEarned: newScore,
        maxPoints,
        source: 'teacher' as const,
        studentFeedback: edit.feedback || existing?.studentFeedback,
        rationale: existing?.rationale,
        aiSuggestedPoints: existing?.aiSuggestedPoints,
        aiSuggestedFeedback: existing?.aiSuggestedFeedback,
        aiModel: existing?.aiModel,
        aiGradedAt: existing?.aiGradedAt,
        overriddenBy: teacherId,
        overriddenAt: Date.now(),
        overrideReason: edit.reason || undefined,
      };

      // Recompute total
      const previousQuestionScore = existing?.pointsEarned ?? 0;
      const delta = newScore - previousQuestionScore;
      const newTotal = Math.max(0, prevTotal + delta);
      const denom = attempt.maxScore || attempt.totalPoints || 0;
      const newPct = denom > 0 ? Math.round((newTotal / denom) * 100) : attempt.percentage;

      const nextAiGrades = { ...(attempt.aiGrades || {}), [questionId]: updatedGrade };
      await evaluationService.updateAttempt(attempt.id, {
        aiGrades: nextAiGrades,
        score: newTotal,
        percentage: newPct,
        gradedBy: teacherId,
        gradedAt: new Date().toISOString(),
      });

      onUpdated({
        ...attempt,
        aiGrades: nextAiGrades,
        score: newTotal,
        percentage: newPct,
        gradedBy: teacherId,
        gradedAt: new Date().toISOString(),
      });
      setEdits((prev) => {
        const next = { ...prev };
        delete next[editKey];
        return next;
      });
    } catch (err) {
      console.error('override failed', err);
      alert('No pudimos guardar el cambio. Intenta de nuevo.');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <Card>
      <CardContent className="p-5 space-y-5">
        <div className="flex items-start justify-between border-b pb-4">
          <div>
            <h2 className="text-lg font-semibold">{studentName}</h2>
            <p className="text-sm text-gray-500">
              Entregado el {formatDate(attempt.submittedAt || attempt.completedAt)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{attempt.percentage ?? 0}%</p>
            <p className="text-sm text-gray-600">
              {attempt.score ?? 0}/{attempt.maxScore ?? attempt.totalPoints ?? '?'} pts
            </p>
            {attempt.gradedBy && (
              <p className="text-xs text-violet-600 mt-1 flex items-center gap-1 justify-end">
                <ShieldCheck className="w-3 h-3" />
                Revisado manualmente
              </p>
            )}
          </div>
        </div>

        {answers.map((a, idx) => {
          const question = questionMap[a.questionId];
          if (!question) return null;
          const aiGrade = attempt.aiGrades?.[a.questionId];
          const isAi = question.type === 'ai_open_answer';
          const edit = edits[a.questionId];
          const score = aiGrade?.pointsEarned ?? 0;
          const max = aiGrade?.maxPoints ?? question.points;
          const wasOverridden = !!aiGrade?.overriddenBy;

          return (
            <div
              key={a.questionId}
              className={`border rounded-lg p-4 ${
                isAi ? (wasOverridden ? 'border-violet-300 bg-violet-50/50' : 'border-amber-200 bg-amber-50/40') : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-500 mb-1">
                    Pregunta {idx + 1} · {question.points} pts
                    {isAi && (
                      <span className="ml-2 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded">
                        <Sparkles className="w-2.5 h-2.5" />
                        Auto-calificada
                      </span>
                    )}
                    {wasOverridden && (
                      <span className="ml-2 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded">
                        <ShieldCheck className="w-2.5 h-2.5" />
                        Override del profesor
                      </span>
                    )}
                  </p>
                  <p className="font-medium text-gray-900">{question.question}</p>
                </div>
                {isAi && (
                  <div className="text-right">
                    <p className="text-xl font-bold">
                      {score}<span className="text-base text-gray-500">/{max}</span>
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-3 bg-white border rounded p-3">
                <p className="text-xs font-medium text-gray-500 mb-1">Respuesta del estudiante</p>
                <p className="text-sm whitespace-pre-wrap">{String(a.answer ?? '') || <em className="text-gray-400">(sin respuesta)</em>}</p>
              </div>

              {isAi && aiGrade && (
                <div className="mt-3 space-y-2">
                  {aiGrade.studentFeedback && (
                    <div className="bg-white border rounded p-3">
                      <p className="text-xs font-medium text-gray-500 mb-1">Retroalimentación visible al estudiante</p>
                      <p className="text-sm">{aiGrade.studentFeedback}</p>
                    </div>
                  )}
                  {aiGrade.rationale && (
                    <details className="bg-gray-50 border rounded p-3">
                      <summary className="text-xs font-medium text-gray-500 cursor-pointer">
                        Justificación interna (solo profesores)
                      </summary>
                      <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{aiGrade.rationale}</p>
                      {aiGrade.rationale === 'prompt_injection_attempt' && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-red-700">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Se detectó un intento de manipulación del calificador. Revisa la respuesta antes de aprobar.
                        </div>
                      )}
                    </details>
                  )}
                  {aiGrade.aiSuggestedPoints !== undefined && wasOverridden && (
                    <p className="text-xs text-gray-500">
                      Sugerencia original: {aiGrade.aiSuggestedPoints}/{max} ·
                      {aiGrade.overrideReason ? ` Motivo del cambio: ${aiGrade.overrideReason}` : ''}
                    </p>
                  )}

                  {/* Override editor */}
                  {!edit ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setEdits((prev) => ({
                          ...prev,
                          [a.questionId]: {
                            score: String(aiGrade.pointsEarned),
                            feedback: aiGrade.studentFeedback || '',
                            reason: '',
                          },
                        }))
                      }
                    >
                      <Pencil className="w-3.5 h-3.5 mr-1.5" />
                      Ajustar nota
                    </Button>
                  ) : (
                    <div className="bg-white border-2 border-violet-300 rounded p-3 space-y-2">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Nueva nota (0 - {max})</Label>
                          <Input
                            type="number"
                            min={0}
                            max={max}
                            step={0.5}
                            value={edit.score}
                            onChange={(e) => setEdits((p) => ({ ...p, [a.questionId]: { ...edit, score: e.target.value } }))}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Motivo (opcional)</Label>
                          <Input
                            value={edit.reason}
                            placeholder="Ej: cubrió el concepto principal pero no dio ejemplos"
                            onChange={(e) => setEdits((p) => ({ ...p, [a.questionId]: { ...edit, reason: e.target.value } }))}
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Retroalimentación al estudiante</Label>
                        <textarea
                          value={edit.feedback}
                          onChange={(e) => setEdits((p) => ({ ...p, [a.questionId]: { ...edit, feedback: e.target.value } }))}
                          className="w-full min-h-[60px] p-2 border border-gray-300 rounded text-sm"
                          placeholder="Será visible para el estudiante exactamente así."
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => saveOverride(a.questionId, attempt.score ?? 0, max)}
                          disabled={savingId === a.questionId}
                        >
                          <Save className="w-3.5 h-3.5 mr-1.5" />
                          {savingId === a.questionId ? 'Guardando...' : 'Guardar nota'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEdits((p) => {
                            const n = { ...p };
                            delete n[a.questionId];
                            return n;
                          })}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!isAi && (
                <p className="mt-2 text-xs flex items-center gap-1.5">
                  {(a as { isCorrect?: boolean }).isCorrect ? (
                    <span className="text-green-700 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Correcta
                    </span>
                  ) : (
                    <span className="text-red-700 flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5" /> Incorrecta
                    </span>
                  )}
                </p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
