import { useState, useEffect } from 'react';
import { useAuthStore } from '@app/store/authStore';
import {
  courseService,
  lessonService,
  legacyEnrollmentService,
  certificateService,
  taskSubmissionService,
} from '@shared/services/dataService';
import { firebaseDB } from '@shared/services/firebaseDataService';
import { certificateGenerator } from '@shared/services/certificateGeneratorNew';
import type { CertificateData } from '@shared/services/certificateGeneratorNew';
import { Download, Award, Calendar, User, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@shared/components/ui/Button';

// ─── Types ────────────────────────────────────────────────────────────────────

const PASSING_THRESHOLD = 70;

type Eligibility =
  | { eligible: true }
  | { eligible: false; reason: 'pending_grading'; pending: number }
  | { eligible: false; reason: 'failing_grade'; failing: number }
  | { eligible: false; reason: 'missing_attempt'; missing: number };

interface CourseCompletion {
  courseId: string;
  courseTitle: string;
  instructorName: string;
  completedAt: number;
  issuedAt?: number; // timestamp when the DBCertificate record was created
  score: number;
  hours: number;
  certificate?: CertificateData;
  eligibility: Eligibility;
}

async function evaluateCourseEligibility(
  courseId: string,
  userId: string
): Promise<Eligibility> {
  try {
    const lessons = await lessonService.getByCourse(courseId);
    const tareaLessons = lessons.filter((l) => l.type === 'tarea');
    const quizLessons = lessons.filter((l) => l.type === 'quiz');

    // Tareas: deben estar calificadas y con nota >= 70%
    let pending = 0;
    let failing = 0;
    if (tareaLessons.length > 0) {
      const allSubs = await taskSubmissionService.getByStudent(userId);
      for (const lesson of tareaLessons) {
        const sub = allSubs.find(
          (s) =>
            s.lessonId === lesson.id &&
            (s.status as string) !== 'deleted'
        );
        if (!sub || sub.status !== 'graded' || !sub.grade || !sub.grade.maxScore) {
          pending++;
          continue;
        }
        const pct = (sub.grade.score / sub.grade.maxScore) * 100;
        if (pct < PASSING_THRESHOLD) failing++;
      }
    }

    // Quizzes: al menos un intento con percentage >= 70
    let missing = 0;
    for (const lesson of quizLessons) {
      const attempts = await firebaseDB.getAttemptsByEvaluation(lesson.id);
      const mine = attempts.filter((a) => a.userId === userId);
      if (mine.length === 0) {
        missing++;
        continue;
      }
      const best = Math.max(...mine.map((a) => a.percentage ?? 0));
      if (best < PASSING_THRESHOLD) failing++;
    }

    if (pending > 0) return { eligible: false, reason: 'pending_grading', pending };
    if (failing > 0) return { eligible: false, reason: 'failing_grade', failing };
    if (missing > 0) return { eligible: false, reason: 'missing_attempt', missing };
    return { eligible: true };
  } catch (err) {
    console.error('Error evaluating certificate eligibility:', err);
    // Conservador: si no pudimos evaluar, no emitir
    return { eligible: false, reason: 'pending_grading', pending: 0 };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
        <Award className="h-8 w-8 text-red-300" />
      </div>
      <p className="text-base font-semibold text-gray-700 mb-1">
        Aún no tienes certificados
      </p>
      <p className="text-sm text-gray-400 text-center max-w-xs">
        Cuando apruebes un curso, aparecerá aquí listo para generar y descargar.
      </p>
    </div>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      aria-busy="true"
      aria-label="Cargando certificados"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-xl border-l-4 border-l-red-100 border border-gray-100 bg-white shadow-sm overflow-hidden"
        >
          {/* Top row: seal placeholder + title lines */}
          <div className="p-5 flex items-start justify-between gap-3">
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-4 bg-red-50 rounded w-4/5" />
              <div className="h-3 bg-red-50 rounded w-3/5" />
            </div>
            <div className="w-10 h-10 rounded-full bg-red-50 shrink-0" />
          </div>
          {/* Meta row */}
          <div className="px-5 pb-4 space-y-2">
            <div className="h-3 bg-gray-100 rounded w-1/2" />
            <div className="h-3 bg-gray-100 rounded w-2/5" />
          </div>
          {/* Button placeholder */}
          <div className="px-5 pb-5">
            <div className="h-9 bg-red-50 rounded-lg w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Certificate Card ─────────────────────────────────────────────────────────

function eligibilityMessage(e: Eligibility): { title: string; detail: string } | null {
  if (e.eligible) return null;
  if (e.reason === 'pending_grading') {
    return {
      title: 'Pendiente de calificación',
      detail:
        e.pending > 0
          ? `${e.pending} tarea(s) aún sin calificar por el docente.`
          : 'Esperando calificación del docente.',
    };
  }
  if (e.reason === 'failing_grade') {
    return {
      title: 'Calificación insuficiente',
      detail: `${e.failing} evaluación(es) por debajo de la nota mínima (70).`,
    };
  }
  return {
    title: 'Evaluaciones incompletas',
    detail: `Faltan ${e.missing} quiz(zes) por completar.`,
  };
}

function CertificateCard({
  completion,
  generating,
  onGenerate,
  onDownload,
}: {
  completion: CourseCompletion;
  generating: string | null;
  onGenerate: (c: CourseCompletion) => void;
  onDownload: (c: CourseCompletion) => void;
}) {
  const hasCert = !!completion.certificate;
  const isGenerating = generating === completion.courseId;
  const blocked = !completion.eligibility.eligible && !hasCert;
  const blockMsg = eligibilityMessage(completion.eligibility);

  return (
    <div
      className={[
        'flex flex-col rounded-xl bg-white shadow-sm transition-shadow hover:shadow-md',
        hasCert
          ? 'border border-gray-100 border-l-4 border-l-red-600'
          : blocked
          ? 'border border-dashed border-gray-200'
          : 'border border-dashed border-red-200',
      ].join(' ')}
    >
      {/* Header */}
      <div className="p-5">
        <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-3">
          {completion.courseTitle}
        </p>
      </div>

      {/* Meta */}
      <div className="px-5 pb-4 space-y-1.5 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <User className="w-3 h-3 shrink-0 text-red-400" aria-hidden="true" />
          <span className="truncate">{completion.instructorName}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3 h-3 shrink-0 text-red-400" aria-hidden="true" />
          <span>
            {hasCert && completion.issuedAt
              ? `Emitido el ${fmtDate(completion.issuedAt)}`
              : `Completado el ${fmtDate(completion.completedAt)}`}
          </span>
        </div>
      </div>

      {/* Eligibility block */}
      {blocked && blockMsg && (
        <div className="mx-5 mb-4 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
          <div className="flex items-start gap-2">
            {!completion.eligibility.eligible &&
            completion.eligibility.reason === 'pending_grading' ? (
              <Clock className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            )}
            <div>
              <p className="font-semibold">{blockMsg.title}</p>
              <p className="opacity-90">{blockMsg.detail}</p>
            </div>
          </div>
        </div>
      )}

      {/* Action */}
      <div className="px-5 pb-5 mt-auto">
        {hasCert ? (
          <Button
            size="sm"
            className="w-full text-sm"
            onClick={() => onDownload(completion)}
          >
            <Download className="w-4 h-4 mr-2" aria-hidden="true" />
            Descargar
          </Button>
        ) : blocked ? (
          <Button
            size="sm"
            variant="outline"
            className="w-full text-sm border-gray-200 text-gray-400 cursor-not-allowed"
            disabled
            aria-disabled="true"
            title={blockMsg?.detail}
          >
            <Award className="w-4 h-4 mr-2" aria-hidden="true" />
            No disponible aún
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="w-full text-sm border-red-300 text-red-700 hover:bg-red-50 hover:border-red-400 transition-colors"
            onClick={() => onGenerate(completion)}
            disabled={isGenerating}
            aria-busy={isGenerating}
          >
            {isGenerating ? (
              <>
                <span
                  className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-red-300 border-t-red-700 shrink-0"
                  aria-hidden="true"
                />
                Generando…
              </>
            ) : (
              <>
                <Award className="w-4 h-4 mr-2" aria-hidden="true" />
                Generar certificado
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CertificatesPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [completedCourses, setCompletedCourses] = useState<CourseCompletion[]>([]);
  const [generating, setGenerating] = useState<string | null>(null);

  useEffect(() => {
    loadCompletedCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadCompletedCourses = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const enrollments = await legacyEnrollmentService.getAll();
      const userEnrollments = enrollments.filter((e) => e.userId === user.id);
      const completedEnrollments = userEnrollments.filter((e) => e.status === 'completed');

      const userCertificates = await certificateService.getByUser(user.id);
      const certMap = new Map(userCertificates.map((c) => [c.courseId, c]));

      const completions: CourseCompletion[] = await Promise.all(
        completedEnrollments.map(async (enrollment) => {
          const course = await courseService.getById(enrollment.courseId);
          let cert = certMap.get(enrollment.courseId);

          // Verificar elegibilidad antes de emitir.
          // Si ya existe un certificado (emitido previamente), se respeta.
          const eligibility: Eligibility = cert
            ? { eligible: true }
            : await evaluateCourseEligibility(enrollment.courseId, user.id);

          // Auto-emit sólo si el curso es elegible.
          if (!cert && course && eligibility.eligible) {
            try {
              cert = await certificateService.create({
                courseId: course.id,
                userId: user.id,
                courseName: course.title,
                studentName: user.name,
                instructorName: course.instructor,
                completionDate: new Date(enrollment.updatedAt || Date.now()).toISOString(),
                grade: enrollment.grade,
                credentialId: certificateGenerator.generateCertificateNumber(),
                verificationUrl: '',
                templateId: 'default',
                status: 'generated',
              } as any);
            } catch (err) {
              console.error('Auto-emit certificate failed:', err);
            }
          }

          return {
            courseId: enrollment.courseId,
            courseTitle: course?.title || 'Curso sin título',
            instructorName: course?.instructor || 'Instructor desconocido',
            completedAt: enrollment.updatedAt || Date.now(),
            issuedAt: cert?.createdAt,
            score: enrollment.grade || 0,
            hours: 40,
            eligibility,
            certificate: cert
              ? {
                  id: cert.id,
                  userId: cert.userId,
                  userName: cert.studentName,
                  courseId: cert.courseId,
                  courseTitle: cert.courseName,
                  instructorName: cert.instructorName,
                  completedAt: new Date(cert.completionDate).getTime(),
                  score: cert.grade ?? 0,
                  hours: 40,
                  certificateNumber: cert.credentialId,
                }
              : undefined,
          };
        })
      );

      setCompletedCourses(completions);
    } catch (error) {
      console.error('Error loading completed courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateCertificate = async (completion: CourseCompletion) => {
    if (!user) return;
    if (!completion.eligibility.eligible) {
      alert(
        'Este curso aún no cumple con los requisitos para emitir el certificado. ' +
        'Todas las tareas deben estar calificadas y los quizzes aprobados con nota mínima de 70.'
      );
      return;
    }
    setGenerating(completion.courseId);
    try {
      const certificateData: CertificateData = {
        id: `cert_${Date.now()}`,
        userId: user.id,
        userName: user.name,
        courseId: completion.courseId,
        courseTitle: completion.courseTitle,
        instructorName: completion.instructorName,
        completedAt: completion.completedAt,
        score: completion.score,
        hours: completion.hours,
        certificateNumber: certificateGenerator.generateCertificateNumber(),
      };

      await certificateGenerator.downloadCertificate(certificateData);

      const saved = await certificateService.create({
        ...certificateData,
      } as any);

      setCompletedCourses((prev) =>
        prev.map((c) =>
          c.courseId === completion.courseId
            ? { ...c, certificate: certificateData, issuedAt: saved?.createdAt ?? Date.now() }
            : c
        )
      );
    } catch (error) {
      console.error('Error generating certificate:', error);
      alert('Error al generar el certificado. Inténtalo de nuevo.');
    } finally {
      setGenerating(null);
    }
  };

  const downloadExistingCertificate = async (completion: CourseCompletion) => {
    if (!completion.certificate) return;
    try {
      await certificateGenerator.downloadCertificate(completion.certificate);
    } catch (error) {
      console.error('Error downloading certificate:', error);
      alert('Error al descargar el certificado. Inténtalo de nuevo.');
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Content */}
      {loading ? (
        <LoadingSkeleton />
      ) : completedCourses.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {completedCourses.map((completion) => (
            <CertificateCard
              key={completion.courseId}
              completion={completion}
              generating={generating}
              onGenerate={generateCertificate}
              onDownload={downloadExistingCertificate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
