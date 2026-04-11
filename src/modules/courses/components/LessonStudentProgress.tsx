import { useState, useEffect } from 'react';
import { legacyEnrollmentService, userService, taskSubmissionService, evaluationService } from '@shared/services/dataService';
import { firebaseDB } from '@shared/services/firebaseDataService';
import type { DBEnrollment, DBEvaluationAttempt, DBTaskSubmission, DBUser } from '@shared/services/firebaseDataService';
import {
  X,
  CheckCircle,
  Clock,
  Circle,
  ChevronDown,
  ChevronRight,
  Download,
  Check,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Button } from '@shared/components/ui/Button';

interface LessonStudentProgressProps {
  lessonId: string;
  lessonTitle: string;
  lessonType: string;
  courseId: string;
  onClose: () => void;
}

type StudentStatus = 'completed' | 'in_progress' | 'not_started';

interface StudentRow {
  userId: string;
  userName: string;
  status: StudentStatus;
  enrollment: DBEnrollment;
  // quiz
  attempts?: DBEvaluationAttempt[];
  bestScore?: number;
  // tarea
  submission?: DBTaskSubmission;
}

export default function LessonStudentProgress({
  lessonId,
  lessonTitle,
  lessonType,
  courseId,
  onClose,
}: LessonStudentProgressProps) {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [expandedAttempt, setExpandedAttempt] = useState<string | null>(null);
  const [savingGrade, setSavingGrade] = useState(false);
  const [savingOverride, setSavingOverride] = useState<string | null>(null);

  // Grade form state for tarea
  const [gradeForm, setGradeForm] = useState<Record<string, { score: string; feedback: string }>>({});

  useEffect(() => {
    loadData();
  }, [lessonId, courseId]);

  const loadData = async () => {
    try {
      setLoading(true);

      const [enrollments, allUsers] = await Promise.all([
        legacyEnrollmentService.getByCourse(courseId),
        userService.getAll(),
      ]);

      const userMap = new Map<string, DBUser>();
      for (const u of allUsers) {
        userMap.set(u.id, u);
      }

      // Fetch quiz attempts or tarea submissions in parallel
      let attemptsMap = new Map<string, DBEvaluationAttempt[]>();
      let submissionsMap = new Map<string, DBTaskSubmission>();

      if (lessonType === 'quiz') {
        const attempts = await firebaseDB.getAttemptsByEvaluation(lessonId);
        for (const a of attempts) {
          const existing = attemptsMap.get(a.userId) || [];
          existing.push(a);
          attemptsMap.set(a.userId, existing);
        }
      } else if (lessonType === 'tarea') {
        const submissions = await taskSubmissionService.getByLesson(lessonId);
        for (const s of submissions) {
          submissionsMap.set(s.studentId, s);
        }
      }

      const rows: StudentRow[] = enrollments.map((enrollment: DBEnrollment) => {
        const user = userMap.get(enrollment.userId);
        const completedLessons = enrollment.completedLessons || [];
        const isCompleted = completedLessons.includes(lessonId);

        let status: StudentStatus;
        if (isCompleted) {
          status = 'completed';
        } else if (enrollment.lastAccessedAt && (enrollment.progress || 0) > 0) {
          status = 'in_progress';
        } else {
          status = 'not_started';
        }

        const row: StudentRow = {
          userId: enrollment.userId,
          userName: user?.name || 'Usuario desconocido',
          status,
          enrollment,
        };

        if (lessonType === 'quiz') {
          const userAttempts = attemptsMap.get(enrollment.userId) || [];
          row.attempts = userAttempts.sort((a, b) => b.percentage - a.percentage);
          row.bestScore = userAttempts.length > 0
            ? Math.max(...userAttempts.map(a => a.percentage))
            : undefined;
        } else if (lessonType === 'tarea') {
          row.submission = submissionsMap.get(enrollment.userId);
        }

        return row;
      });

      // Sort: completed first, then in_progress, then not_started
      const order: Record<StudentStatus, number> = { completed: 0, in_progress: 1, not_started: 2 };
      rows.sort((a, b) => order[a.status] - order[b.status]);

      setStudents(rows);

      // Initialize grade forms for tarea
      if (lessonType === 'tarea') {
        const forms: Record<string, { score: string; feedback: string }> = {};
        for (const row of rows) {
          if (row.submission) {
            forms[row.userId] = {
              score: row.submission.grade?.score?.toString() || '',
              feedback: row.submission.grade?.feedback || '',
            };
          }
        }
        setGradeForm(forms);
      }
    } catch (error) {
      console.error('Error loading student progress:', error);
    } finally {
      setLoading(false);
    }
  };

  const completedCount = students.filter(s => s.status === 'completed').length;
  const inProgressCount = students.filter(s => s.status === 'in_progress').length;
  const notStartedCount = students.filter(s => s.status === 'not_started').length;

  const getStatusIcon = (status: StudentStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'in_progress':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'not_started':
        return <Circle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusLabel = (status: StudentStatus) => {
    switch (status) {
      case 'completed':
        return 'Completado';
      case 'in_progress':
        return 'En progreso';
      case 'not_started':
        return 'No iniciado';
    }
  };

  const handleOverrideAnswer = async (attempt: DBEvaluationAttempt, questionId: string) => {
    const overrideKey = `${attempt.id}-${questionId}`;
    setSavingOverride(overrideKey);
    try {
      const updatedAnswers = attempt.answers.map(a => {
        if (a.questionId === questionId) {
          return { ...a, isCorrect: true, pointsEarned: a.pointsEarned !== undefined ? a.pointsEarned : 1 };
        }
        return a;
      });

      // Recalculate score
      const newScore = updatedAnswers.reduce((sum, a) => sum + (a.pointsEarned || 0), 0);
      const maxScore = attempt.maxScore;
      const newPercentage = maxScore > 0 ? Math.round((newScore / maxScore) * 100) : 0;

      await evaluationService.updateAttempt(attempt.id, {
        answers: updatedAnswers,
        score: newScore,
        percentage: newPercentage,
        passed: newPercentage >= 60,
        updatedAt: Date.now(),
      });

      // Reload data to reflect changes
      await loadData();
    } catch (error) {
      console.error('Error overriding answer:', error);
    } finally {
      setSavingOverride(null);
    }
  };

  const handleSaveGrade = async (studentRow: StudentRow) => {
    if (!studentRow.submission) return;
    const form = gradeForm[studentRow.userId];
    if (!form) return;

    setSavingGrade(true);
    try {
      const score = parseFloat(form.score);
      if (isNaN(score)) return;

      await taskSubmissionService.update(studentRow.submission.id, {
        status: 'graded',
        grade: {
          score,
          maxScore: 100,
          feedback: form.feedback || undefined,
          gradedBy: 'teacher',
          gradedAt: Date.now(),
        },
        updatedAt: Date.now(),
      });

      await loadData();
    } catch (error) {
      console.error('Error saving grade:', error);
    } finally {
      setSavingGrade(false);
    }
  };

  const formatTime = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-3xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 truncate">
              Progreso: {lessonTitle}
            </h2>
            <p className="text-sm text-gray-500 capitalize">{lessonType}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg flex-shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-4 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 text-red-600 animate-spin" />
            </div>
          ) : (
            <>
              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-700">{completedCount}</p>
                  <p className="text-xs text-green-600">Completaron</p>
                </div>
                <div className="bg-yellow-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-yellow-700">{inProgressCount}</p>
                  <p className="text-xs text-yellow-600">En progreso</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-gray-700">{notStartedCount}</p>
                  <p className="text-xs text-gray-500">Sin ver</p>
                </div>
              </div>

              {/* Student list */}
              {students.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No hay estudiantes inscritos en este curso.
                </div>
              ) : (
                <div className="border rounded-lg divide-y">
                  {/* Table header */}
                  <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-4 py-2 bg-gray-50 text-xs font-medium text-gray-500 uppercase">
                    <span>Estudiante</span>
                    <span className="w-28 text-center">Estado</span>
                    <span className="w-24 text-center">Detalle</span>
                  </div>

                  {students.map((student) => (
                    <div key={student.userId}>
                      {/* Student row */}
                      <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-4 py-3 items-center hover:bg-gray-50">
                        <div className="flex items-center gap-2 min-w-0">
                          {getStatusIcon(student.status)}
                          <span className="font-medium text-sm truncate">{student.userName}</span>
                          {lessonType === 'quiz' && student.bestScore !== undefined && (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full flex-shrink-0">
                              {student.bestScore}%
                            </span>
                          )}
                          {lessonType === 'tarea' && student.submission && (
                            <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                              student.submission.status === 'graded'
                                ? 'bg-green-100 text-green-700'
                                : student.submission.status === 'submitted'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {student.submission.status === 'graded'
                                ? `${student.submission.grade?.score ?? '-'}/100`
                                : student.submission.status === 'submitted'
                                ? 'Enviado'
                                : 'Devuelto'}
                            </span>
                          )}
                        </div>
                        <span className={`w-28 text-center text-xs font-medium ${
                          student.status === 'completed' ? 'text-green-600' :
                          student.status === 'in_progress' ? 'text-yellow-600' :
                          'text-gray-400'
                        }`}>
                          {getStatusLabel(student.status)}
                        </span>
                        <div className="w-24 text-center">
                          {(student.status !== 'not_started' || (lessonType === 'tarea' && student.submission) || (lessonType === 'quiz' && student.attempts && student.attempts.length > 0)) && (
                            <button
                              onClick={() => setExpandedStudent(expandedStudent === student.userId ? null : student.userId)}
                              className="text-xs text-red-600 hover:text-red-800 hover:underline inline-flex items-center gap-1"
                            >
                              {expandedStudent === student.userId ? (
                                <>
                                  <ChevronDown className="h-3 w-3" />
                                  Ocultar
                                </>
                              ) : (
                                <>
                                  <ChevronRight className="h-3 w-3" />
                                  Ver detalle
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expanded detail */}
                      {expandedStudent === student.userId && (
                        <div className="px-4 pb-4 bg-gray-50 border-t">
                          <div className="mt-3 space-y-4">
                            {/* General progress */}
                            <div className="grid grid-cols-3 gap-3 text-sm">
                              <div className="bg-white rounded p-2.5 border">
                                <p className="text-gray-500 text-xs">Progreso general</p>
                                <p className="font-semibold text-red-600">{student.enrollment.progress || 0}%</p>
                              </div>
                              <div className="bg-white rounded p-2.5 border">
                                <p className="text-gray-500 text-xs">Tiempo en curso</p>
                                <p className="font-semibold">{formatTime(student.enrollment.totalTimeSpent || 0)}</p>
                              </div>
                              <div className="bg-white rounded p-2.5 border">
                                <p className="text-gray-500 text-xs">Lecciones completadas</p>
                                <p className="font-semibold">{(student.enrollment.completedLessons || []).length}</p>
                              </div>
                            </div>

                            {/* Quiz detail */}
                            {lessonType === 'quiz' && student.attempts && student.attempts.length > 0 && (
                              <div className="space-y-2">
                                <h4 className="text-sm font-semibold text-gray-700">Intentos de quiz</h4>
                                {student.attempts.map((attempt, idx) => (
                                  <div key={attempt.id} className="bg-white border rounded">
                                    <button
                                      className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50"
                                      onClick={() => setExpandedAttempt(expandedAttempt === attempt.id ? null : attempt.id)}
                                    >
                                      <span className="flex items-center gap-2">
                                        {expandedAttempt === attempt.id ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                        Intento {idx + 1}
                                      </span>
                                      <span className={`font-medium ${attempt.passed ? 'text-green-600' : 'text-red-600'}`}>
                                        {attempt.percentage}% ({attempt.score}/{attempt.maxScore})
                                      </span>
                                    </button>

                                    {expandedAttempt === attempt.id && (
                                      <div className="px-3 pb-3 border-t divide-y">
                                        {attempt.answers.map((answer, aIdx) => (
                                          <div key={answer.questionId} className="py-2 flex items-start justify-between gap-2">
                                            <div className="flex items-start gap-2 min-w-0">
                                              {answer.isCorrect ? (
                                                <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                                              ) : (
                                                <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                                              )}
                                              <div className="min-w-0">
                                                <p className="text-xs text-gray-500">Pregunta {aIdx + 1}</p>
                                                <p className="text-sm">
                                                  Respuesta: {Array.isArray(answer.answer) ? answer.answer.join(', ') : answer.answer}
                                                </p>
                                              </div>
                                            </div>
                                            {!answer.isCorrect && (
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                className="text-xs flex-shrink-0"
                                                disabled={savingOverride === `${attempt.id}-${answer.questionId}`}
                                                onClick={() => handleOverrideAnswer(attempt, answer.questionId)}
                                              >
                                                {savingOverride === `${attempt.id}-${answer.questionId}` ? (
                                                  <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                  'Marcar como correcto'
                                                )}
                                              </Button>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {lessonType === 'quiz' && (!student.attempts || student.attempts.length === 0) && (
                              <p className="text-sm text-gray-500 italic">No hay intentos de quiz registrados.</p>
                            )}

                            {/* Tarea detail */}
                            {lessonType === 'tarea' && student.submission && (
                              <div className="space-y-3">
                                <h4 className="text-sm font-semibold text-gray-700">Entrega de tarea</h4>

                                {/* Submitted files */}
                                {student.submission.files && student.submission.files.length > 0 && (
                                  <div className="space-y-1">
                                    <p className="text-xs text-gray-500 font-medium">Archivos entregados:</p>
                                    {student.submission.files.map((file) => (
                                      <a
                                        key={file.id}
                                        href={file.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 text-sm text-red-600 hover:text-red-800 hover:underline bg-white border rounded px-3 py-2"
                                      >
                                        <Download className="h-4 w-4 flex-shrink-0" />
                                        <span className="truncate">{file.name}</span>
                                        <span className="text-xs text-gray-400 flex-shrink-0">
                                          {(file.size / 1024).toFixed(0)} KB
                                        </span>
                                      </a>
                                    ))}
                                  </div>
                                )}

                                {/* Comment */}
                                {student.submission.comment && (
                                  <div>
                                    <p className="text-xs text-gray-500 font-medium mb-1">Comentario del estudiante:</p>
                                    <p className="text-sm bg-white border rounded px-3 py-2 text-gray-700">
                                      {student.submission.comment}
                                    </p>
                                  </div>
                                )}

                                {/* Grading form */}
                                <div className="bg-white border rounded p-3 space-y-3">
                                  <h5 className="text-sm font-medium text-gray-700">Calificación</h5>
                                  <div className="flex gap-3">
                                    <div className="flex-1">
                                      <label className="block text-xs text-gray-500 mb-1">Puntuación (0-100)</label>
                                      <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={gradeForm[student.userId]?.score || ''}
                                        onChange={(e) => setGradeForm(prev => ({
                                          ...prev,
                                          [student.userId]: {
                                            ...prev[student.userId],
                                            score: e.target.value,
                                          },
                                        }))}
                                        className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                        placeholder="0-100"
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-xs text-gray-500 mb-1">Retroalimentación</label>
                                    <textarea
                                      value={gradeForm[student.userId]?.feedback || ''}
                                      onChange={(e) => setGradeForm(prev => ({
                                        ...prev,
                                        [student.userId]: {
                                          ...prev[student.userId],
                                          feedback: e.target.value,
                                        },
                                      }))}
                                      className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                                      rows={3}
                                      placeholder="Escribe tu retroalimentación..."
                                    />
                                  </div>
                                  <div className="flex justify-end">
                                    <Button
                                      size="sm"
                                      onClick={() => handleSaveGrade(student)}
                                      disabled={savingGrade || !gradeForm[student.userId]?.score}
                                    >
                                      {savingGrade ? (
                                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                      ) : null}
                                      Guardar calificación
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )}

                            {lessonType === 'tarea' && !student.submission && (
                              <p className="text-sm text-gray-500 italic">No se ha entregado la tarea.</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
