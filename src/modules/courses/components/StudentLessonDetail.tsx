import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Clock,
  BookOpen,
  TrendingUp,
  CheckCircle,
  XCircle,
  FileText,
  Download,
  Send,
  Star,
  Loader2,
  Eye,
} from 'lucide-react';
import { Button } from '@shared/components/ui/Button';
import { Card, CardContent } from '@shared/components/ui/Card';
import { Label } from '@shared/components/ui/Label';
import {
  legacyEnrollmentService,
  gradeService,
  taskSubmissionService,
} from '@shared/services/dataService';
import { firebaseDB } from '@shared/services/firebaseDataService';
import type {
  DBEnrollment,
  DBGrade,
  DBTaskSubmission,
  DBEvaluationAttempt,
} from '@shared/services/firebaseDataService';

interface StudentLessonDetailProps {
  studentId: string;
  studentName: string;
  courseId: string;
  lessonId: string;
  lessonTitle: string;
  lessonType: string;
  teacherId: string;
  onBack: () => void;
}

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function isPreviewable(file: { url: string; contentType?: string; name?: string }): 'pdf' | 'image' | null {
  const ct = file.contentType || '';
  const url = file.url || '';
  const name = file.name || '';
  if (ct.includes('pdf') || url.endsWith('.pdf') || name.endsWith('.pdf')) return 'pdf';
  if (ct.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(url || name)) return 'image';
  return null;
}

export default function StudentLessonDetail({
  studentId,
  studentName,
  courseId,
  lessonId,
  lessonTitle,
  lessonType,
  teacherId,
  onBack,
}: StudentLessonDetailProps) {
  const [loading, setLoading] = useState(true);
  const [enrollment, setEnrollment] = useState<DBEnrollment | null>(null);
  const [grades, setGrades] = useState<DBGrade[]>([]);
  const [submission, setSubmission] = useState<DBTaskSubmission | null>(null);
  const [attempts, setAttempts] = useState<DBEvaluationAttempt[]>([]);

  // Grading state
  const [gradeScore, setGradeScore] = useState(0);
  const [gradeFeedback, setGradeFeedback] = useState('');
  const [saving, setSaving] = useState(false);

  // File preview
  const [previewFile, setPreviewFile] = useState<{ url: string; type: 'pdf' | 'image'; name: string } | null>(null);

  useEffect(() => {
    loadData();
  }, [studentId, lessonId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [enrollments, studentGrades] = await Promise.all([
        legacyEnrollmentService.getByUser(studentId),
        gradeService.getByStudent(studentId),
      ]);

      const courseEnrollment = enrollments.find((e: DBEnrollment) => e.courseId === courseId) || null;
      setEnrollment(courseEnrollment);
      setGrades(studentGrades.filter((g: DBGrade) => g.courseId === courseId));

      if (lessonType === 'tarea') {
        const submissions = await taskSubmissionService.getByLesson(lessonId);
        const studentSub = submissions.find((s) => s.studentId === studentId) || null;
        setSubmission(studentSub);
        if (studentSub?.grade) {
          setGradeScore(studentSub.grade.score);
          setGradeFeedback(studentSub.grade.feedback || '');
        }
      }

      if (lessonType === 'quiz') {
        const allAttempts = await firebaseDB.getAttemptsByEvaluation(lessonId);
        setAttempts(
          allAttempts
            .filter((a) => a.userId === studentId)
            .sort((a, b) => b.createdAt - a.createdAt)
        );
      }
    } catch (err) {
      console.error('Error loading student data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGrade = async () => {
    if (!submission) return;
    setSaving(true);
    try {
      await taskSubmissionService.update(submission.id, {
        status: 'graded',
        grade: {
          score: gradeScore,
          maxScore: 100,
          feedback: gradeFeedback || '',
          gradedBy: teacherId,
          gradedAt: Date.now(),
        },
        updatedAt: Date.now(),
      });
      await loadData();
    } catch (err) {
      console.error('Error saving grade:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-red-600 animate-spin" />
      </div>
    );
  }

  const completedLessons = enrollment?.completedLessons?.length || 0;
  const progress = enrollment?.progress || 0;
  const totalTime = enrollment?.totalTimeSpent || 0;
  const avgGrade =
    grades.length > 0
      ? Math.round(grades.reduce((s, g) => s + (g.percentage || 0), 0) / grades.length)
      : null;
  const lessonCompleted = enrollment?.completedLessons?.includes(lessonId) || false;

  // File preview overlay
  if (previewFile) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b flex-shrink-0">
          <Button variant="outline" size="sm" onClick={() => setPreviewFile(null)}>
            <ArrowLeft className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Volver</span>
          </Button>
          <span className="text-sm font-medium text-gray-700 truncate mx-4">{previewFile.name}</span>
          <a href={previewFile.url} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Descargar</span>
            </Button>
          </a>
        </div>
        <div className="flex-1 bg-gray-100 overflow-auto">
          {previewFile.type === 'pdf' ? (
            <iframe src={previewFile.url} className="w-full h-full border-0" title={previewFile.name} />
          ) : (
            <div className="flex items-center justify-center p-4 h-full">
              <img src={previewFile.url} alt={previewFile.name} className="max-w-full max-h-full object-contain rounded" />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-bold flex-shrink-0">
            {studentName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate">{studentName}</p>
            <p className="text-xs text-gray-500">{lessonTitle}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
            <TrendingUp className="h-3 w-3" /> Progreso
          </div>
          <p className="text-lg font-bold text-gray-900">{progress}%</p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
            <Clock className="h-3 w-3" /> Tiempo
          </div>
          <p className="text-lg font-bold text-gray-900">{formatTime(totalTime)}</p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
            <BookOpen className="h-3 w-3" /> Lecciones
          </div>
          <p className="text-lg font-bold text-gray-900">{completedLessons}</p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
            <Star className="h-3 w-3" /> Promedio
          </div>
          <p className="text-lg font-bold text-gray-900">{avgGrade !== null ? `${avgGrade}%` : '—'}</p>
        </div>
      </div>

      {/* Lesson status */}
      <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${lessonCompleted ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-600'}`}>
        {lessonCompleted ? <CheckCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
        <span className="font-medium">{lessonCompleted ? 'Lección completada' : 'Lección no completada'}</span>
      </div>

      {/* Tarea section */}
      {lessonType === 'tarea' && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h4 className="font-semibold text-gray-900 text-sm">Entrega de tarea</h4>

            {!submission ? (
              <p className="text-sm text-gray-500 py-4 text-center">Sin entrega</p>
            ) : (
              <>
                {/* Status */}
                <div className={`flex items-center gap-2 p-2.5 rounded-lg text-sm ${
                  submission.grade ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
                }`}>
                  {submission.grade ? <CheckCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                  <span className="font-medium">{submission.grade ? `Calificada: ${submission.grade.score}/100` : 'Pendiente de calificación'}</span>
                </div>

                {/* Files */}
                <div className="space-y-1.5">
                  {submission.files.map((file) => {
                    const preview = isPreviewable(file);
                    return (
                      <div key={file.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                        <FileText className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                        <span className="text-xs text-gray-700 truncate flex-1">{file.name}</span>
                        {preview && (
                          <button onClick={() => setPreviewFile({ url: file.url, type: preview, name: file.name })}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"><Eye className="h-3 w-3" /></button>
                        )}
                        <a href={file.url} target="_blank" rel="noopener noreferrer" className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                          <Download className="h-3 w-3" /></a>
                      </div>
                    );
                  })}
                </div>

                {submission.comment && (
                  <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded">{submission.comment}</p>
                )}

                {/* Grade form */}
                <div className="border-t border-gray-100 pt-3 space-y-2">
                  <div>
                    <Label className="text-xs">Calificación (0-100)</Label>
                    <input type="number" min={0} max={100} value={gradeScore}
                      onChange={(e) => setGradeScore(parseInt(e.target.value) || 0)}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500" />
                  </div>
                  <div>
                    <Label className="text-xs">Retroalimentación</Label>
                    <textarea value={gradeFeedback} onChange={(e) => setGradeFeedback(e.target.value)}
                      placeholder="Comentarios..."
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none min-h-[60px] focus:ring-2 focus:ring-red-500" />
                  </div>
                  <Button onClick={() => {
                    if (window.confirm(`¿Enviar calificación de ${gradeScore}/100 a ${studentName}?`)) handleSaveGrade();
                  }} disabled={saving} className="w-full bg-red-600 hover:bg-red-700" size="sm">
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                    {saving ? 'Enviando...' : 'Enviar calificación'}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quiz section */}
      {lessonType === 'quiz' && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h4 className="font-semibold text-gray-900 text-sm">Intentos de quiz</h4>

            {attempts.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">Sin intentos</p>
            ) : (
              <div className="space-y-2">
                {attempts.map((attempt, idx) => (
                  <div key={attempt.id} className={`p-3 rounded-lg border ${attempt.passed ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">Intento {attempts.length - idx}</span>
                      <span className={`text-sm font-bold ${attempt.passed ? 'text-green-700' : 'text-red-700'}`}>
                        {attempt.percentage}%
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {attempt.score}/{attempt.maxScore} pts — {new Date(attempt.createdAt).toLocaleDateString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {/* Question results */}
                    <div className="mt-2 space-y-1">
                      {attempt.answers.map((a, qi) => (
                        <div key={qi} className="flex items-center gap-2 text-xs">
                          {a.isCorrect ? <CheckCircle className="h-3 w-3 text-green-600" /> : <XCircle className="h-3 w-3 text-red-600" />}
                          <span className="text-gray-600">Pregunta {qi + 1}</span>
                          <span className="text-gray-400">{a.pointsEarned || 0} pts</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
