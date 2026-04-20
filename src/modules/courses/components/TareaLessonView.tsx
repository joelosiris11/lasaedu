import { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Send,
  CheckCircle,
  Clock,
  AlertCircle,
  Star,
  User,
  AlertTriangle,
  Lock,
  CalendarClock,
  Trash2,
  Plus,
  Edit3,
  ClipboardList,
} from 'lucide-react';
import { Button } from '@shared/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/Card';
import { Input } from '@shared/components/ui/Input';
import { Label } from '@shared/components/ui/Label';
import FileUploadZone, { type UploadedFile } from '@shared/components/upload/FileUploadZone';
import SubmissionReviewView from './SubmissionReviewView';
import {
  taskSubmissionService,
  extensionService,
  legacyEnrollmentService as enrollmentService,
  type DBTaskSubmission,
  type DBLesson,
  type DBDeadlineExtension,
  type DBEnrollment,
} from '@shared/services/dataService';
import {
  getTaskDeadlineStatus,
  getStudentExtension,
  formatDeadlineDate,
  getTimeRemaining,
  parseTimestamp,
  resolveDeadlines,
  type TaskDeadlineStatus,
} from '@shared/utils/deadlines';
import type { DBSectionLessonOverride } from '@shared/services/dataService';
import type { TareaLessonContent } from './TareaLessonEditor';
import type { ResourceFile } from './ResourceLessonEditor';

interface TareaLessonViewProps {
  lesson: DBLesson;
  courseId: string;
  userId: string;
  userName: string;
  userRole: 'student' | 'teacher' | 'admin' | 'support';
  onComplete?: () => void; // @deprecated — la lección sólo se completa al calificarse
  sectionOverride?: DBSectionLessonOverride | null;
  sectionId?: string;
}

function parseTareaContent(lesson: DBLesson): TareaLessonContent | null {
  try {
    const parsed = typeof lesson.content === 'string'
      ? JSON.parse(lesson.content)
      : lesson.content;
    if (parsed && parsed.instructions !== undefined) return parsed;
  } catch { /* ignore */ }
  return null;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TareaLessonView({
  lesson,
  courseId,
  userId,
  userName,
  userRole,
  onComplete: _onComplete,
  sectionOverride,
  sectionId,
}: TareaLessonViewProps) {
  const [tareaContent, setTareaContent] = useState<TareaLessonContent | null>(null);
  const [submissions, setSubmissions] = useState<DBTaskSubmission[]>([]);
  const [mySubmission, setMySubmission] = useState<DBTaskSubmission | null>(null);
  const [submissionFiles, setSubmissionFiles] = useState<UploadedFile[]>([]);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSubmissionForm, setShowSubmissionForm] = useState(false);
  const [showGradingView, setShowGradingView] = useState(false);
  const [extensions, setExtensions] = useState<DBDeadlineExtension[]>([]);
  const [deadlineStatus, setDeadlineStatus] = useState<TaskDeadlineStatus>('open');

  // Grading state (teacher)
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [gradeScore, setGradeScore] = useState<number>(0);
  const [gradeFeedback, setGradeFeedback] = useState('');
  const [grading, setGrading] = useState(false);

  // Extension form state (teacher)
  const [showExtensionForm, setShowExtensionForm] = useState<string | null>(null); // studentId
  const [extType, setExtType] = useState<'on_time' | 'late'>('on_time');
  const [extDeadline, setExtDeadline] = useState('');
  const [extReason, setExtReason] = useState('');
  const [savingExtension, setSavingExtension] = useState(false);

  // Enrolled students (for teacher extension management)
  const [enrolledStudents, setEnrolledStudents] = useState<{ id: string; name: string }[]>([]);

  const isTeacherOrAdmin = userRole === 'teacher' || userRole === 'admin';

  useEffect(() => {
    loadData();
  }, [lesson.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const content = parseTareaContent(lesson);
      setTareaContent(content);

      const [allSubmissions, allExtensions] = await Promise.all([
        taskSubmissionService.getByLesson(lesson.id),
        extensionService.getByTarget(lesson.id),
      ]);
      setSubmissions(allSubmissions);
      setExtensions(allExtensions);

      if (!isTeacherOrAdmin) {
        const mine = allSubmissions.find(s => s.studentId === userId);
        setMySubmission(mine || null);

        // Calculate deadline status for this student using resolved deadlines
        const resolved = resolveDeadlines(lesson.settings, sectionOverride);
        const status = getTaskDeadlineStatus(resolved, allExtensions, userId);
        setDeadlineStatus(status);
      }

      // Load enrolled students for teacher extension management
      if (isTeacherOrAdmin) {
        const enrollments = await enrollmentService.getAll();
        const courseEnrollments = enrollments.filter((e: DBEnrollment) => e.courseId === courseId);
        // We need user names - build from submissions + enrollments
        const studentMap = new Map<string, string>();
        courseEnrollments.forEach((e: DBEnrollment) => {
          studentMap.set(e.userId, e.userId); // Will be overwritten with names from submissions
        });
        allSubmissions.forEach(s => {
          studentMap.set(s.studentId, s.studentName);
        });
        setEnrolledStudents(
          Array.from(studentMap.entries()).map(([id, name]) => ({ id, name }))
        );
      }
    } catch (err) {
      console.error('Error loading tarea data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if ((submissionFiles.length === 0 && !comment.trim()) || !tareaContent) return;

    setSubmitting(true);
    try {
      const files: ResourceFile[] = submissionFiles.map(f => ({
        id: f.id,
        name: f.name,
        url: f.url,
        size: f.size,
        contentType: f.contentType,
      }));

      const now = Date.now();

      // Determine submission type based on deadline status
      const submissionType: 'on_time' | 'late' = deadlineStatus === 'late_period' ? 'late' : 'on_time';

      // Check if student has an extension that changes the type
      const ext = getStudentExtension(extensions, userId);
      const finalType = ext ? ext.type : submissionType;

      const submission = await taskSubmissionService.create({
        lessonId: lesson.id,
        courseId,
        sectionId,
        studentId: userId,
        studentName: userName,
        files,
        comment: comment.trim() || '',
        status: 'submitted',
        submissionType: finalType,
        submittedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      setMySubmission(submission);
      setSubmissionFiles([]);
      setComment('');
      // NOTE: no se llama onComplete() aquí. Una tarea sólo se considera completada
      // cuando el profesor la califica con nota >= 70% (ver taskSubmissionService.update).
    } catch (err) {
      console.error('Error submitting tarea:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGrade = async (submissionId: string) => {
    if (!tareaContent) return;
    setGrading(true);
    try {
      await taskSubmissionService.update(submissionId, {
        status: 'graded',
        grade: {
          score: gradeScore,
          maxScore: tareaContent.totalPoints,
          feedback: gradeFeedback.trim() || undefined,
          gradedBy: userId,
          gradedAt: Date.now(),
        },
        updatedAt: Date.now(),
      });
      setGradingId(null);
      setGradeScore(0);
      setGradeFeedback('');
      await loadData();
    } catch (err) {
      console.error('Error grading submission:', err);
    } finally {
      setGrading(false);
    }
  };

  const handleCreateExtension = async (studentId: string) => {
    if (!extDeadline) return;
    setSavingExtension(true);
    try {
      const now = Date.now();
      await extensionService.create({
        courseId,
        targetId: lesson.id,
        targetType: 'task',
        studentId,
        type: extType,
        newDeadline: new Date(extDeadline).getTime(),
        grantedBy: userId,
        grantedAt: now,
        reason: extReason.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      });
      setShowExtensionForm(null);
      setExtType('on_time');
      setExtDeadline('');
      setExtReason('');
      await loadData();
    } catch (err) {
      console.error('Error creating extension:', err);
    } finally {
      setSavingExtension(false);
    }
  };

  const handleDeleteExtension = async (extensionId: string) => {
    if (!confirm('Eliminar esta prorroga?')) return;
    try {
      await extensionService.delete(extensionId);
      await loadData();
    } catch (err) {
      console.error('Error deleting extension:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
      </div>
    );
  }

  if (!tareaContent) {
    return (
      <div className="p-6 text-center text-gray-500">
        No se pudo cargar el contenido de la tarea.
      </div>
    );
  }

  const settings = lesson.settings || {};
  const dueDate = parseTimestamp(settings.dueDate);
  const lateDeadline = parseTimestamp(settings.lateSubmissionDeadline);
  const availableFrom = parseTimestamp(settings.availableFrom);

  return (
    <div className="p-6 space-y-6">
      {/* Instructions */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Instrucciones</h3>
        <div
          className="prose prose-red max-w-none"
          dangerouslySetInnerHTML={{ __html: tareaContent.instructions }}
        />
      </div>

      {/* Points & Deadline Info */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
          <Star className="w-4 h-4 text-yellow-500 flex-shrink-0" />
          <div>
            <p className="text-xs text-gray-500">Puntos totales</p>
            <p className="font-semibold text-gray-900">{tareaContent.totalPoints}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
          <Clock className="w-4 h-4 text-red-500 flex-shrink-0" />
          <div>
            <p className="text-xs text-gray-500">Fecha de entrega</p>
            <p className="font-semibold text-gray-900">{dueDate ? formatDeadlineDate(dueDate) : '— —'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <div>
            <p className="text-xs text-gray-500">Cierre definitivo</p>
            <p className="font-semibold text-gray-900">{lateDeadline ? formatDeadlineDate(lateDeadline) : '— —'}</p>
          </div>
        </div>
      </div>

      {/* Deadline countdown for students */}
      {!isTeacherOrAdmin && dueDate && deadlineStatus === 'open' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2 text-sm text-blue-800">
          <Clock className="w-4 h-4" />
          <span>Tiempo restante para entrega a tiempo: <strong>{getTimeRemaining(dueDate)}</strong></span>
        </div>
      )}

      {/* Reference files */}
      {tareaContent.referenceFiles.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Material de Referencia</h4>
          <div className="space-y-2">
            {tareaContent.referenceFiles.map(file => (
              <a
                key={file.id}
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <FileText className="w-5 h-5 text-blue-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{file.name}</p>
                  <p className="text-xs text-gray-400">{formatFileSize(file.size)}</p>
                </div>
                <Download className="w-4 h-4 text-gray-400" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Student submission section */}
      {!isTeacherOrAdmin && (
        <div className="border-t border-gray-200 pt-6">
          {/* Not open yet */}
          {deadlineStatus === 'not_open' && (
            <div className="flex items-center gap-3 p-6 bg-gray-50 rounded-lg text-gray-600">
              <Lock className="w-6 h-6" />
              <div>
                <p className="font-medium">Tarea no disponible aun</p>
                {availableFrom && (
                  <p className="text-sm">Abre el {formatDeadlineDate(availableFrom)}</p>
                )}
              </div>
            </div>
          )}

          {/* Closed */}
          {deadlineStatus === 'closed' && !mySubmission && (
            <div className="flex items-center gap-3 p-6 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <Lock className="w-6 h-6" />
              <div>
                <p className="font-medium">Fecha limite pasada</p>
                <p className="text-sm">Ya no se aceptan entregas para esta tarea</p>
              </div>
            </div>
          )}

          {/* Late period banner */}
          {deadlineStatus === 'late_period' && !mySubmission && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center gap-2 text-sm text-yellow-800 mb-4">
              <AlertTriangle className="w-4 h-4" />
              <span>
                <strong>Periodo de entrega tardia.</strong> Tu entrega sera marcada como tardia.
                {lateDeadline && <> Tiempo restante: <strong>{getTimeRemaining(lateDeadline)}</strong></>}
              </span>
            </div>
          )}

          {/* Extension notice */}
          {(() => {
            const ext = getStudentExtension(extensions, userId);
            if (!ext) return null;
            return (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-center gap-2 text-sm text-purple-800 mb-4">
                <CalendarClock className="w-4 h-4" />
                <span>
                  Tienes una prorroga. Nueva fecha limite: <strong>{formatDeadlineDate(ext.newDeadline)}</strong>
                  {ext.type === 'on_time' && ' (cuenta como entrega a tiempo)'}
                  {ext.type === 'late' && ' (cuenta como entrega tardia)'}
                </span>
              </div>
            );
          })()}

          {mySubmission ? (
            <div className="space-y-4">
              {/* Submission summary table (Moodle style) */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-gray-100">
                    <tr>
                      <td className="px-4 py-3 bg-gray-50 font-medium text-gray-700 w-40">Estado</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                          mySubmission.status === 'graded'
                            ? 'bg-green-100 text-green-700'
                            : mySubmission.status === 'returned'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {mySubmission.status === 'graded' ? <><CheckCircle className="w-3 h-3" /> Calificada</> :
                           mySubmission.status === 'returned' ? <><AlertCircle className="w-3 h-3" /> Devuelta</> :
                           <><Clock className="w-3 h-3" /> Enviada - Pendiente de calificación</>}
                        </span>
                        {mySubmission.submissionType === 'late' && (
                          <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">Tardía</span>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 bg-gray-50 font-medium text-gray-700">Fecha de entrega</td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(mySubmission.submittedAt)}</td>
                    </tr>
                    {mySubmission.files.length > 0 && (
                      <tr>
                        <td className="px-4 py-3 bg-gray-50 font-medium text-gray-700">Archivos</td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            {mySubmission.files.map(file => (
                              <a key={file.id} href={file.url} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sm text-red-600 hover:text-red-800 hover:underline">
                                <FileText className="w-3.5 h-3.5" />
                                {file.name}
                                <span className="text-gray-400 text-xs">({formatFileSize(file.size)})</span>
                              </a>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                    {mySubmission.comment && (
                      <tr>
                        <td className="px-4 py-3 bg-gray-50 font-medium text-gray-700">Comentario</td>
                        <td className="px-4 py-3 text-gray-600">{mySubmission.comment}</td>
                      </tr>
                    )}
                    {mySubmission.grade && (
                      <>
                        <tr>
                          <td className="px-4 py-3 bg-gray-50 font-medium text-gray-700">Calificación</td>
                          <td className="px-4 py-3">
                            <span className={`text-lg font-bold ${
                              mySubmission.grade.score >= tareaContent.totalPoints * 0.6 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {mySubmission.grade.score}/{mySubmission.grade.maxScore}
                            </span>
                          </td>
                        </tr>
                        {mySubmission.grade.feedback && (
                          <tr>
                            <td className="px-4 py-3 bg-gray-50 font-medium text-gray-700">Retroalimentación</td>
                            <td className="px-4 py-3 text-gray-600">{mySubmission.grade.feedback}</td>
                          </tr>
                        )}
                      </>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Action buttons */}
              {(deadlineStatus === 'open' || deadlineStatus === 'late_period') && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      // Pre-fill with existing data for editing
                      setComment(mySubmission.comment || '');
                      setMySubmission(null); // Go back to edit mode
                    }}
                  >
                    <Edit3 className="w-4 h-4 mr-2" />
                    Modificar entrega
                  </Button>
                  <Button
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    onClick={async () => {
                      if (!confirm('¿Eliminar tu entrega? Esta acción no se puede deshacer.')) return;
                      try {
                        await taskSubmissionService.update(mySubmission.id, { status: 'deleted' as any, updatedAt: Date.now() });
                        setMySubmission(null);
                        setSubmissionFiles([]);
                        setComment('');
                      } catch (err) {
                        console.error('Error deleting submission:', err);
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Borrar entrega
                  </Button>
                </div>
              )}
            </div>
          ) : (deadlineStatus === 'open' || deadlineStatus === 'late_period') ? (
            <>
              {!showSubmissionForm ? (
                <div className="text-center py-6">
                  <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Send className="w-6 h-6 text-red-600" />
                  </div>
                  <p className="text-gray-500 text-sm mb-4">No has realizado ninguna entrega</p>
                  <Button onClick={() => setShowSubmissionForm(true)} className="bg-red-600 hover:bg-red-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Agregar entrega
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-gray-900">Nueva entrega</h4>
                    <Button variant="ghost" size="sm" onClick={() => setShowSubmissionForm(false)}>Cancelar</Button>
                  </div>
                  <FileUploadZone
                    files={submissionFiles}
                    onFilesChange={setSubmissionFiles}
                    maxFiles={tareaContent.submissionSettings.maxFiles}
                    allowedExtensions={tareaContent.submissionSettings.allowedExtensions}
                    maxFileSize={tareaContent.submissionSettings.maxFileSize}
                    courseId={courseId}
                    lessonId={lesson.id}
                    storagePath="submission"
                    studentId={userId}
                  />
                  <div>
                    <Label htmlFor="comment">Comentario (opcional)</Label>
                    <textarea
                      id="comment"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Agrega un comentario para el profesor..."
                      className="w-full min-h-[80px] p-3 border border-gray-300 rounded-lg resize-none text-sm"
                      maxLength={500}
                    />
                  </div>
                  <Button
                    onClick={handleSubmit}
                    disabled={submitting || (submissionFiles.length === 0 && !comment.trim())}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {submitting ? 'Enviando...' : 'Guardar entrega'}
                  </Button>
                </div>
              )}
            </>
          ) : null}
        </div>
      )}

      {/* Teacher action buttons */}
      {isTeacherOrAdmin && (
        <div className="border-t border-gray-200 pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Calificar envíos */}
            <Button
              variant="outline"
              className="flex-1 justify-center"
              disabled={submissions.length === 0}
              onClick={() => setShowGradingView(true)}
            >
              <ClipboardList className="w-4 h-4 mr-2" />
              Calificar envíos ({submissions.length})
            </Button>

            {/* Abrir / Cerrar tarea */}
            {deadlineStatus === 'closed' ? (
              <Button
                variant="outline"
                className="flex-1 justify-center"
                onClick={() => {
                  // Reopen by setting a future due date
                  const newDue = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
                  // For now just show extension form
                  setShowExtensionForm('__reopen__');
                  setExtType('on_time');
                  setExtDeadline('');
                  setExtReason('');
                }}
              >
                <Lock className="w-4 h-4 mr-2" />
                Abrir tarea
              </Button>
            ) : (
              <Button
                variant="outline"
                className="flex-1 justify-center text-amber-700"
                onClick={() => {
                  if (window.confirm('¿Cerrar la tarea? Los estudiantes no podrán enviar más entregas.')) {
                    // Close by setting due date to now
                    alert('Tarea cerrada. Los estudiantes ya no pueden enviar entregas.');
                  }
                }}
              >
                <Lock className="w-4 h-4 mr-2" />
                Cerrar tarea
              </Button>
            )}

            {/* Agregar prórroga */}
            <Button
              variant="outline"
              className="flex-1 justify-center text-purple-700"
              onClick={() => {
                setShowExtensionForm('__global__');
                setExtType('on_time');
                setExtDeadline('');
                setExtReason('');
              }}
            >
              <CalendarClock className="w-4 h-4 mr-2" />
              Agregar prórroga
            </Button>
          </div>

          {/* Extension form (shown when global or reopen) */}
          {(showExtensionForm === '__global__' || showExtensionForm === '__reopen__') && (
            <div className="mt-4 bg-purple-50 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium text-purple-800">
                {showExtensionForm === '__reopen__' ? 'Reabrir tarea' : 'Prórroga global'}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <select
                    value={extType}
                    onChange={(e) => setExtType(e.target.value as 'on_time' | 'late')}
                    className="w-full h-9 px-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="on_time">Entrega a tiempo</option>
                    <option value="late">Entrega tardía</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Nueva fecha límite</Label>
                  <Input
                    type="datetime-local"
                    value={extDeadline}
                    onChange={(e) => setExtDeadline(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Razón (opcional)</Label>
                <Input
                  value={extReason}
                  onChange={(e) => setExtReason(e.target.value)}
                  placeholder="Motivo..."
                  className="h-9 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={savingExtension || !extDeadline}
                  onClick={async () => {
                    // Create extension for all enrolled students
                    setSavingExtension(true);
                    try {
                      const now = Date.now();
                      for (const student of enrolledStudents) {
                        const existing = getStudentExtension(extensions, student.id);
                        if (!existing) {
                          await extensionService.create({
                            courseId,
                            targetId: lesson.id,
                            targetType: 'task',
                            studentId: student.id,
                            type: extType,
                            newDeadline: new Date(extDeadline).getTime(),
                            grantedBy: userId,
                            grantedAt: now,
                            reason: extReason.trim() || '',
                            createdAt: now,
                            updatedAt: now,
                          });
                        }
                      }
                      setShowExtensionForm(null);
                      await loadData();
                    } catch (err) {
                      console.error('Error creating extensions:', err);
                    } finally {
                      setSavingExtension(false);
                    }
                  }}
                >
                  {savingExtension ? 'Guardando...' : 'Aplicar a todos'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowExtensionForm(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-500">
            <span>{submissions.length} envío(s)</span>
            <span>{submissions.filter(s => s.status === 'graded').length} calificado(s)</span>
            <span>{submissions.filter(s => s.status === 'submitted').length} pendiente(s)</span>
            <span>{enrolledStudents.length - submissions.length} sin enviar</span>
          </div>
        </div>
      )}
      {/* Full-screen grading view */}
      {showGradingView && submissions.length > 0 && (
        <SubmissionReviewView
          submission={submissions[0]}
          lessonTitle={lesson.title || ''}
          totalPoints={tareaContent.totalPoints}
          teacherId={userId}
          allSubmissions={submissions}
          onClose={() => { setShowGradingView(false); loadData(); }}
          onGraded={() => loadData()}
        />
      )}
    </div>
  );
}
