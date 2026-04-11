import { useState, useMemo } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  File,
  Image,
  Loader2,
  MessageSquare,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { Button } from '@shared/components/ui/Button';
import {
  taskSubmissionService,
  type DBTaskSubmission,
} from '@shared/services/dataService';

// ---- Types ----

export interface SubmissionReviewViewProps {
  submission: DBTaskSubmission;
  lessonTitle: string;
  totalPoints: number;
  teacherId: string;
  allSubmissions: DBTaskSubmission[]; // for prev/next navigation
  onClose: () => void;
  onGraded: () => void; // refresh data after grading
}

// ---- Helpers ----

function isPdf(file: { contentType: string; url: string; name: string }): boolean {
  return (
    file.contentType.includes('pdf') ||
    file.url.toLowerCase().endsWith('.pdf') ||
    file.name.toLowerCase().endsWith('.pdf')
  );
}

function isImage(file: { contentType: string; url: string; name: string }): boolean {
  return (
    file.contentType.startsWith('image/') ||
    /\.(jpe?g|png|gif|webp|svg|bmp)$/i.test(file.url) ||
    /\.(jpe?g|png|gif|webp|svg|bmp)$/i.test(file.name)
  );
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

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ---- Component ----

export default function SubmissionReviewView({
  submission: initialSubmission,
  lessonTitle,
  totalPoints,
  teacherId,
  allSubmissions,
  onClose,
  onGraded,
}: SubmissionReviewViewProps) {
  const [currentSubmission, setCurrentSubmission] = useState(initialSubmission);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [score, setScore] = useState<string>(
    currentSubmission.grade?.score?.toString() ?? ''
  );
  const [feedback, setFeedback] = useState<string>(
    currentSubmission.grade?.feedback ?? ''
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Current position in allSubmissions
  const currentIndex = useMemo(
    () => allSubmissions.findIndex((s) => s.id === currentSubmission.id),
    [allSubmissions, currentSubmission.id]
  );
  const prevSubmission = currentIndex > 0 ? allSubmissions[currentIndex - 1] : null;
  const nextSubmission =
    currentIndex < allSubmissions.length - 1
      ? allSubmissions[currentIndex + 1]
      : null;

  const navigateTo = (sub: DBTaskSubmission) => {
    setCurrentSubmission(sub);
    setActiveFileIndex(0);
    setScore(sub.grade?.score?.toString() ?? '');
    setFeedback(sub.grade?.feedback ?? '');
    setSaved(false);
  };

  // Save grade
  const handleSaveGrade = async () => {
    const numScore = parseFloat(score);
    if (isNaN(numScore) || numScore < 0 || numScore > totalPoints) return;

    if (!window.confirm(`¿Enviar calificación de ${numScore}/${totalPoints} a ${currentSubmission.studentName}?`)) return;

    setSaving(true);
    setSaved(false);
    try {
      await taskSubmissionService.update(currentSubmission.id, {
        status: 'graded',
        grade: {
          score: numScore,
          maxScore: totalPoints,
          feedback: feedback.trim() || '',
          gradedBy: teacherId,
          gradedAt: Date.now(),
        },
        updatedAt: Date.now(),
      });
      // Update local state
      setCurrentSubmission((prev) => ({
        ...prev,
        status: 'graded',
        grade: {
          score: numScore,
          maxScore: totalPoints,
          feedback: feedback.trim() || undefined,
          gradedBy: teacherId,
          gradedAt: Date.now(),
        },
      }));
      setSaved(true);
      onGraded();
    } catch (err) {
      console.error('Error grading submission:', err);
    } finally {
      setSaving(false);
    }
  };

  const files = currentSubmission.files || [];
  const activeFile = files[activeFileIndex] ?? null;

  // ---- Render preview ----
  const renderFilePreview = () => {
    if (!activeFile) {
      return (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <File className="h-12 w-12 mx-auto mb-2" />
            <p className="text-sm">Sin archivos adjuntos</p>
          </div>
        </div>
      );
    }

    if (isPdf(activeFile)) {
      return (
        <iframe
          src={activeFile.url}
          className="w-full h-full border-0"
          title={activeFile.name}
        />
      );
    }

    if (isImage(activeFile)) {
      return (
        <div className="flex-1 flex items-center justify-center p-4 overflow-auto bg-gray-100">
          <img
            src={activeFile.url}
            alt={activeFile.name}
            className="max-w-full max-h-full object-contain rounded shadow-md"
          />
        </div>
      );
    }

    // Not previewable
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <File className="h-16 w-16 mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-medium mb-1">
            Este archivo no se puede previsualizar
          </p>
          <p className="text-xs text-gray-400 mb-4">{activeFile.name}</p>
          <a
            href={activeFile.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
          >
            <Download className="h-4 w-4" />
            Descargar archivo
          </a>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Volver</span>
        </button>
        <div className="h-5 w-px bg-gray-200" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 truncate">
            {currentSubmission.studentName}
          </p>
          <p className="text-xs text-gray-500 truncate">
            {activeFile ? activeFile.name : lessonTitle}
            {' · '}
            {formatDate(currentSubmission.submittedAt)}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {currentSubmission.submissionType === 'late' && (
            <span className="hidden sm:inline-flex items-center gap-1 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
              Entrega tardía
            </span>
          )}
          {currentSubmission.submissionType !== 'late' && (
            <span className="hidden sm:inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
              A tiempo
            </span>
          )}
          {currentSubmission.status === 'graded' && (
            <span className="hidden sm:inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
              <CheckCircle className="h-3 w-3" />
              {currentSubmission.grade?.score}/{currentSubmission.grade?.maxScore}
            </span>
          )}
        </div>
      </div>

      {/* Body - split layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Preview area */}
        <div className="flex-1 flex flex-col min-h-0 h-[50vh] lg:h-auto">
          {/* File tabs (if multiple files) */}
          {files.length > 1 && (
            <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-100 bg-gray-50 overflow-x-auto flex-shrink-0">
              {files.map((file, idx) => (
                <button
                  key={file.id}
                  onClick={() => setActiveFileIndex(idx)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-colors ${
                    idx === activeFileIndex
                      ? 'bg-red-100 text-red-700'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {isPdf(file) ? (
                    <FileText className="h-3.5 w-3.5" />
                  ) : isImage(file) ? (
                    <Image className="h-3.5 w-3.5" />
                  ) : (
                    <File className="h-3.5 w-3.5" />
                  )}
                  {file.name}
                </button>
              ))}
            </div>
          )}

          {/* Preview content */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {renderFilePreview()}
          </div>

          {/* Student navigation */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 bg-gray-50 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              disabled={!prevSubmission}
              onClick={() => prevSubmission && navigateTo(prevSubmission)}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Anterior estudiante</span>
              <span className="sm:hidden">Anterior</span>
            </Button>
            <span className="text-xs text-gray-500">
              {currentIndex + 1} / {allSubmissions.length}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!nextSubmission}
              onClick={() => nextSubmission && navigateTo(nextSubmission)}
            >
              <span className="hidden sm:inline">Siguiente estudiante</span>
              <span className="sm:hidden">Siguiente</span>
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>

        {/* Grading panel */}
        <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-gray-200 bg-white overflow-y-auto flex-shrink-0">
          <div className="p-4 space-y-5">
            {/* Score */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Puntuacion
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={totalPoints}
                  value={score}
                  onChange={(e) => {
                    setScore(e.target.value);
                    setSaved(false);
                  }}
                  className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="0"
                />
                <span className="text-sm text-gray-500">/ {totalPoints}</span>
              </div>
            </div>

            {/* Feedback */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Retroalimentacion
              </label>
              <textarea
                value={feedback}
                onChange={(e) => {
                  setFeedback(e.target.value);
                  setSaved(false);
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                rows={4}
                placeholder="Escribe tu retroalimentacion..."
              />
            </div>

            {/* Save button */}
            <Button
              onClick={handleSaveGrade}
              disabled={saving || !score || parseFloat(score) < 0 || parseFloat(score) > totalPoints}
              className="w-full bg-red-600 hover:bg-red-700"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : saved ? (
                <CheckCircle className="h-4 w-4 mr-2" />
              ) : null}
              {saved ? 'Guardada' : 'Guardar calificacion'}
            </Button>

            {/* Divider */}
            <div className="border-t border-gray-100" />

            {/* Student comment */}
            {currentSubmission.comment && (
              <div>
                <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Comentario del estudiante
                </div>
                <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                  {currentSubmission.comment}
                </p>
              </div>
            )}

            {/* Files list */}
            {files.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Archivos ({files.length})
                </p>
                <div className="space-y-1.5">
                  {files.map((file) => (
                    <a
                      key={file.id}
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-sm"
                    >
                      <FileText className="h-4 w-4 text-red-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-700 truncate text-xs">
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-400">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                      <Download className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Submission metadata */}
            <div className="text-xs text-gray-400 space-y-1 pt-2 border-t border-gray-100">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                Enviado: {formatDate(currentSubmission.submittedAt)}
              </div>
              {currentSubmission.submissionType === 'late' && (
                <span className="inline-block bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-xs">
                  Entrega tardia
                </span>
              )}
              {currentSubmission.grade?.gradedAt && (
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="h-3 w-3" />
                  Calificada: {formatDate(currentSubmission.grade.gradedAt)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
