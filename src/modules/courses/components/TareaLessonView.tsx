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
} from 'lucide-react';
import { Button } from '@shared/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/Card';
import { Input } from '@shared/components/ui/Input';
import { Label } from '@shared/components/ui/Label';
import FileUploadZone, { type UploadedFile } from '@shared/components/upload/FileUploadZone';
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
  type TaskDeadlineStatus,
} from '@shared/utils/deadlines';
import type { TareaLessonContent } from './TareaLessonEditor';
import type { ResourceFile } from './ResourceLessonEditor';

interface TareaLessonViewProps {
  lesson: DBLesson;
  courseId: string;
  userId: string;
  userName: string;
  userRole: 'student' | 'teacher' | 'admin' | 'support';
  onComplete?: () => void;
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
  onComplete,
}: TareaLessonViewProps) {
  const [tareaContent, setTareaContent] = useState<TareaLessonContent | null>(null);
  const [submissions, setSubmissions] = useState<DBTaskSubmission[]>([]);
  const [mySubmission, setMySubmission] = useState<DBTaskSubmission | null>(null);
  const [submissionFiles, setSubmissionFiles] = useState<UploadedFile[]>([]);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
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

        // Calculate deadline status for this student
        const settings = lesson.settings || {};
        const status = getTaskDeadlineStatus(settings, allExtensions, userId);
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
    if (submissionFiles.length === 0 || !tareaContent) return;

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
        studentId: userId,
        studentName: userName,
        files,
        comment: comment.trim() || undefined,
        status: 'submitted',
        submissionType: finalType,
        submittedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      setMySubmission(submission);
      setSubmissionFiles([]);
      setComment('');
      onComplete?.();
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
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
          className="prose prose-blue max-w-none"
          dangerouslySetInnerHTML={{ __html: tareaContent.instructions }}
        />
      </div>

      {/* Points & Deadline Info */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-yellow-500" />
          <span className="font-medium">Puntos totales: {tareaContent.totalPoints}</span>
        </div>
        {dueDate && (
          <div className="flex items-center gap-2 text-gray-600">
            <Clock className="w-4 h-4" />
            <span>Cierre: {formatDeadlineDate(dueDate)}</span>
          </div>
        )}
        {lateDeadline && (
          <div className="flex items-center gap-2 text-gray-600">
            <AlertTriangle className="w-4 h-4" />
            <span>Entrega tardia hasta: {formatDeadlineDate(lateDeadline)}</span>
          </div>
        )}
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
              {/* Submission status */}
              <div className={`flex items-center gap-2 p-4 rounded-lg ${
                mySubmission.status === 'graded'
                  ? 'bg-green-50 border border-green-200'
                  : mySubmission.status === 'returned'
                  ? 'bg-yellow-50 border border-yellow-200'
                  : 'bg-blue-50 border border-blue-200'
              }`}>
                {mySubmission.status === 'graded' ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : mySubmission.status === 'returned' ? (
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                ) : (
                  <Clock className="w-5 h-5 text-blue-600" />
                )}
                <div>
                  <p className="font-medium">
                    {mySubmission.status === 'graded' ? 'Tarea Calificada' :
                     mySubmission.status === 'returned' ? 'Tarea Devuelta' :
                     'Tarea Enviada'}
                    {mySubmission.submissionType === 'late' && (
                      <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                        Entrega tardia
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-gray-600">
                    Enviada el {formatDate(mySubmission.submittedAt)}
                  </p>
                </div>
              </div>

              {/* Grade display */}
              {mySubmission.grade && (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">Calificacion</span>
                      <span className={`text-xl font-bold ${
                        mySubmission.grade.score >= tareaContent.totalPoints * 0.6
                          ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {mySubmission.grade.score}/{mySubmission.grade.maxScore}
                      </span>
                    </div>
                    {mySubmission.grade.feedback && (
                      <div className="mt-2 text-sm text-gray-600 bg-gray-50 rounded p-3">
                        <p className="font-medium mb-1">Retroalimentacion:</p>
                        {mySubmission.grade.feedback}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Submitted files */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Archivos enviados:</p>
                {mySubmission.files.map(file => (
                  <a
                    key={file.id}
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded"
                  >
                    <FileText className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-700">{file.name}</span>
                    <span className="text-xs text-gray-400">{formatFileSize(file.size)}</span>
                  </a>
                ))}
              </div>
            </div>
          ) : (deadlineStatus === 'open' || deadlineStatus === 'late_period') && (
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Enviar Tarea</h4>
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
                disabled={submitting || submissionFiles.length === 0}
              >
                <Send className="w-4 h-4 mr-2" />
                {submitting ? 'Enviando...' : deadlineStatus === 'late_period' ? 'Enviar Tarea (Tardia)' : 'Enviar Tarea'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Teacher grading section */}
      {isTeacherOrAdmin && (
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold mb-4">
            Envios de Estudiantes ({submissions.length})
          </h3>

          {submissions.length === 0 ? (
            <p className="text-gray-500 text-sm">Aun no hay envios.</p>
          ) : (
            <div className="space-y-4">
              {submissions.map(sub => {
                const studentExt = getStudentExtension(extensions, sub.studentId);
                return (
                  <Card key={sub.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <CardTitle className="text-base">{sub.studentName}</CardTitle>
                          {sub.submissionType === 'late' && (
                            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                              Tardia
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            sub.status === 'graded'
                              ? 'bg-green-100 text-green-700'
                              : sub.status === 'returned'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {sub.status === 'graded' ? 'Calificado' :
                             sub.status === 'returned' ? 'Devuelto' : 'Pendiente'}
                          </span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-xs text-gray-500">
                        Enviado: {formatDate(sub.submittedAt)}
                      </p>

                      {/* Files */}
                      <div className="space-y-1">
                        {sub.files.map(file => (
                          <a
                            key={file.id}
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            {file.name}
                            <span className="text-gray-400 text-xs">({formatFileSize(file.size)})</span>
                          </a>
                        ))}
                      </div>

                      {sub.comment && (
                        <p className="text-sm text-gray-600 bg-gray-50 rounded p-2">
                          {sub.comment}
                        </p>
                      )}

                      {/* Extension info */}
                      {studentExt && (
                        <div className="flex items-center justify-between bg-purple-50 rounded p-2 text-xs text-purple-700">
                          <span>
                            Prorroga: {formatDeadlineDate(studentExt.newDeadline)}
                            ({studentExt.type === 'on_time' ? 'A tiempo' : 'Tardia'})
                            {studentExt.reason && ` - ${studentExt.reason}`}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteExtension(studentExt.id)}
                            className="text-red-500 h-6 px-1"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}

                      {/* Extension button */}
                      {!studentExt && showExtensionForm !== sub.studentId && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setShowExtensionForm(sub.studentId);
                            setExtType('on_time');
                            setExtDeadline('');
                            setExtReason('');
                          }}
                          className="text-purple-600"
                        >
                          <CalendarClock className="w-3.5 h-3.5 mr-1" />
                          Dar Prorroga
                        </Button>
                      )}

                      {/* Extension form */}
                      {showExtensionForm === sub.studentId && (
                        <div className="bg-purple-50 rounded-lg p-4 space-y-3">
                          <p className="text-sm font-medium text-purple-800">Crear prorroga para {sub.studentName}</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">Tipo de prorroga</Label>
                              <select
                                value={extType}
                                onChange={(e) => setExtType(e.target.value as 'on_time' | 'late')}
                                className="w-full h-9 px-2 border border-gray-300 rounded-md text-sm"
                              >
                                <option value="on_time">Entrega a tiempo</option>
                                <option value="late">Entrega tardia</option>
                              </select>
                            </div>
                            <div>
                              <Label className="text-xs">Nueva fecha limite</Label>
                              <Input
                                type="datetime-local"
                                value={extDeadline}
                                onChange={(e) => setExtDeadline(e.target.value)}
                                className="h-9 text-sm"
                              />
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs">Razon (opcional)</Label>
                            <Input
                              value={extReason}
                              onChange={(e) => setExtReason(e.target.value)}
                              placeholder="Motivo de la prorroga..."
                              className="h-9 text-sm"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleCreateExtension(sub.studentId)}
                              disabled={savingExtension || !extDeadline}
                            >
                              {savingExtension ? 'Guardando...' : 'Crear Prorroga'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setShowExtensionForm(null)}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Grade display or form */}
                      {sub.grade ? (
                        <div className="flex items-center gap-4 text-sm bg-green-50 rounded p-3">
                          <span className="font-medium">
                            Calificacion: {sub.grade.score}/{sub.grade.maxScore}
                          </span>
                          {sub.grade.feedback && (
                            <span className="text-gray-600">- {sub.grade.feedback}</span>
                          )}
                        </div>
                      ) : gradingId === sub.id ? (
                        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label htmlFor={`score-${sub.id}`}>Puntaje (max {tareaContent.totalPoints})</Label>
                              <Input
                                id={`score-${sub.id}`}
                                type="number"
                                min={0}
                                max={tareaContent.totalPoints}
                                value={gradeScore}
                                onChange={(e) => setGradeScore(parseInt(e.target.value) || 0)}
                              />
                            </div>
                          </div>
                          <div>
                            <Label htmlFor={`feedback-${sub.id}`}>Retroalimentacion</Label>
                            <textarea
                              id={`feedback-${sub.id}`}
                              value={gradeFeedback}
                              onChange={(e) => setGradeFeedback(e.target.value)}
                              placeholder="Comentarios sobre el trabajo..."
                              className="w-full min-h-[60px] p-2 border border-gray-300 rounded-md text-sm resize-none"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleGrade(sub.id)}
                              disabled={grading}
                            >
                              {grading ? 'Guardando...' : 'Guardar Calificacion'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setGradingId(null)}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setGradingId(sub.id);
                            setGradeScore(0);
                            setGradeFeedback('');
                          }}
                        >
                          Calificar
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Extension management for students who haven't submitted */}
          {(() => {
            const submittedStudentIds = new Set(submissions.map(s => s.studentId));
            const nonSubmitted = enrolledStudents.filter(s => !submittedStudentIds.has(s.id));
            if (nonSubmitted.length === 0) return null;

            return (
              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-700 mb-3">
                  Estudiantes sin envio ({nonSubmitted.length})
                </h4>
                <div className="space-y-2">
                  {nonSubmitted.map(student => {
                    const studentExt = getStudentExtension(extensions, student.id);
                    return (
                      <div key={student.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-700">{student.name}</span>
                          {studentExt && (
                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                              Prorroga hasta {formatDeadlineDate(studentExt.newDeadline)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {studentExt ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteExtension(studentExt.id)}
                              className="text-red-500 h-7 px-2"
                            >
                              <Trash2 className="w-3 h-3 mr-1" />
                              Quitar
                            </Button>
                          ) : showExtensionForm === student.id ? (
                            <div className="flex items-center gap-2">
                              <select
                                value={extType}
                                onChange={(e) => setExtType(e.target.value as 'on_time' | 'late')}
                                className="h-7 px-1 border border-gray-300 rounded text-xs"
                              >
                                <option value="on_time">A tiempo</option>
                                <option value="late">Tardia</option>
                              </select>
                              <Input
                                type="datetime-local"
                                value={extDeadline}
                                onChange={(e) => setExtDeadline(e.target.value)}
                                className="h-7 text-xs w-44"
                              />
                              <Button
                                size="sm"
                                onClick={() => handleCreateExtension(student.id)}
                                disabled={savingExtension || !extDeadline}
                                className="h-7 text-xs"
                              >
                                OK
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setShowExtensionForm(null)}
                                className="h-7 text-xs"
                              >
                                X
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setShowExtensionForm(student.id);
                                setExtType('on_time');
                                setExtDeadline('');
                                setExtReason('');
                              }}
                              className="text-purple-600 h-7 text-xs"
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              Prorroga
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
