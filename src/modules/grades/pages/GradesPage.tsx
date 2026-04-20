import { useState, useEffect } from 'react';
import { useAuthStore } from '@app/store/authStore';
import {
  courseService,
  evaluationService,
  legacyEnrollmentService,
  sectionService,
  userService,
  taskSubmissionService,
} from '@shared/services/dataService';
import type { DBSection, DBUser } from '@shared/services/dataService';
import { useSections } from '@shared/hooks/useSections';
import { SectionPicker } from '@shared/components/ui/SectionPicker';
import {
  BookOpen,
  Search,
  Download,
  User,
  Award,
  BarChart3,
  FileText,
  ChevronDown,
  ClipboardList,
  Eye,
  AlertCircle,
  CheckCircle2,
  Clock,
  Users,
} from 'lucide-react';
import { Card, CardContent } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';
import { Modal } from '@shared/components/ui/Modal';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Course {
  id: string;
  title: string;
  instructorId: string;
}

interface Evaluation {
  id: string;
  title: string;
  courseId: string;
  type: 'quiz' | 'tarea' | 'examen' | 'proyecto';
  maxPoints: number;
  weight: number;
  source: 'evaluation' | 'task';
  lessonId?: string;
  dueDate?: string;
}

interface Submission {
  id: string;
  evaluationId: string;
  userId: string;
  userName: string;
  score: number;
  totalPoints: number;
  percentage: number;
  submittedAt: string;
  gradedAt?: string;
  feedback?: string;
}

interface StudentGrade {
  studentId: string;
  studentName: string;
  studentEmail?: string;
  sectionTitle?: string;
  evaluations: {
    evaluationId: string;
    score: number | null;
    maxPoints: number;
    percentage: number | null;
    status: 'pending' | 'submitted' | 'graded';
    submittedAt?: string;
    gradedAt?: string;
    feedback?: string;
  }[];
  totalScore: number;
  totalMaxPoints: number;
  overallPercentage: number;
  trend: 'up' | 'down' | 'stable';
}

type StatusFilter = 'all' | 'passing' | 'risk';

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Only red + gray palette — no green, no blue, no amber
const getGradeColor = (percentage: number | null) => {
  if (percentage === null) return 'text-gray-400';
  if (percentage >= 70) return 'text-gray-900';
  return 'text-red-600';
};

const getGradeBadge = (percentage: number) => {
  if (percentage >= 90) return { label: 'A', color: 'bg-red-600 text-white' };
  if (percentage >= 80) return { label: 'B', color: 'bg-red-500 text-white' };
  if (percentage >= 70) return { label: 'C', color: 'bg-red-200 text-red-800' };
  if (percentage >= 60) return { label: 'D', color: 'bg-red-100 text-red-700' };
  return { label: 'F', color: 'bg-gray-200 text-gray-700' };
};

const getStudentLetter = (percentage: number) => {
  if (percentage >= 90) return { label: 'A', ring: 'border-red-600', text: 'text-red-700' };
  if (percentage >= 80) return { label: 'B', ring: 'border-red-500', text: 'text-red-600' };
  if (percentage >= 70) return { label: 'C', ring: 'border-red-400', text: 'text-red-600' };
  if (percentage >= 60) return { label: 'D', ring: 'border-red-300', text: 'text-red-500' };
  return { label: 'F', ring: 'border-gray-300', text: 'text-gray-500' };
};

// Subtle type pill — all red shades, different tints per type
const TYPE_PILL: Record<string, string> = {
  quiz:     'bg-red-50  text-red-600  border-red-100',
  tarea:    'bg-red-100 text-red-700  border-red-200',
  examen:   'bg-red-200 text-red-800  border-red-300',
  proyecto: 'bg-red-700 text-red-50   border-red-800',
};

const TYPE_LABEL: Record<string, string> = {
  quiz: 'Quiz',
  tarea: 'Tarea',
  examen: 'Examen',
  proyecto: 'Proyecto',
};

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('es-DO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ─── KPI Card (MySectionsPage pattern) ────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-gray-500 truncate">{label}</p>
            <p className="text-xl font-bold text-gray-900 leading-tight">{value}</p>
          </div>
          <div className="p-1.5 rounded-md bg-red-50 shrink-0">
            <Icon className="h-4 w-4 text-red-600" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({
  icon: Icon,
  message,
  sub,
}: {
  icon: React.ElementType;
  message: string;
  sub?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
        <Icon className="h-7 w-7 text-red-300" aria-hidden="true" />
      </div>
      <p className="text-sm font-semibold text-gray-700 mb-1 text-center">{message}</p>
      {sub && (
        <p className="text-xs text-gray-400 text-center max-w-xs">{sub}</p>
      )}
    </div>
  );
}

// ─── Student Hero Card (student view) ─────────────────────────────────────────

function StudentHeroCard({
  courseTitle,
  overallPercentage,
  gradedCount,
  totalCount,
}: {
  courseTitle: string;
  overallPercentage: number;
  gradedCount: number;
  totalCount: number;
}) {
  const letter = getStudentLetter(overallPercentage);

  return (
    <div className="rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden">
      <div className="h-1 bg-red-600" />
      <div className="p-6 sm:p-8">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
          Mis calificaciones
        </p>
        <h2 className="text-base font-semibold text-gray-900 leading-snug mb-6 line-clamp-2">
          {courseTitle}
        </h2>

        <div className="flex items-center gap-5 sm:gap-6">
          <div className="flex-1 min-w-0">
            <p className="text-5xl font-bold text-red-600 leading-none tabular-nums">
              {overallPercentage}
              <span className="text-2xl">%</span>
            </p>
            <p className="text-xs text-gray-400 mt-1">promedio general</p>
          </div>

          <div className="flex flex-col items-center shrink-0">
            <span
              className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-white border-4 ${letter.ring} ${letter.text} flex items-center justify-center font-bold leading-none`}
              style={{ fontSize: '3.75rem' }}
              aria-label={`Letra ${letter.label}`}
            >
              {letter.label}
            </span>
          </div>
        </div>

        <p className="text-xs text-gray-400 mt-5">
          {gradedCount} de {totalCount} evaluaciones calificadas
        </p>
      </div>
    </div>
  );
}

// ─── Student Evaluation Row (student view) ────────────────────────────────────

function StudentEvalRow({
  evaluation,
  grade,
}: {
  evaluation: Evaluation;
  grade: { score: number | null; maxPoints: number; percentage: number | null; status: string };
}) {
  const isPending = grade.score === null;
  const pillClass = TYPE_PILL[evaluation.type] ?? 'bg-red-50 text-red-600 border-red-100';
  const pct = grade.percentage ?? 0;

  return (
    <div
      className={`flex items-center gap-4 py-3 px-4 rounded-lg transition-colors ${
        isPending ? 'bg-gray-50' : 'bg-white hover:bg-red-50/30 border border-gray-100'
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-800 truncate">
            {evaluation.title}
          </span>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize ${pillClass}`}
          >
            {evaluation.type}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {isPending ? (
          <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
            Pendiente
          </span>
        ) : (
          <>
            <div className="hidden sm:flex flex-col items-end gap-1 w-24">
              <div
                className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full bg-red-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
            </div>

            <div className="text-right">
              <p className={`text-sm font-bold tabular-nums ${getGradeColor(grade.percentage)}`}>
                {grade.score}/{grade.maxPoints}
              </p>
              <p className="text-[10px] text-gray-400">{pct}%</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Student Detail Modal ─────────────────────────────────────────────────────

function StudentDetailModal({
  open,
  onClose,
  studentGrade,
  evaluations,
  courseTitle,
}: {
  open: boolean;
  onClose: () => void;
  studentGrade: StudentGrade | null;
  evaluations: Evaluation[];
  courseTitle: string;
}) {
  if (!studentGrade) return null;

  const letter = getStudentLetter(studentGrade.overallPercentage);
  const gradedCount = studentGrade.evaluations.filter(e => e.score !== null).length;
  const pendingCount = studentGrade.evaluations.filter(e => e.score === null).length;
  const isAtRisk = studentGrade.totalMaxPoints > 0 && studentGrade.overallPercentage < 70;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="2xl"
      title={
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div
            className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center shrink-0"
            aria-hidden="true"
          >
            <span className="text-red-600 font-bold text-sm">
              {initials(studentGrade.studentName)}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold text-gray-900 truncate">
              {studentGrade.studentName}
            </p>
            {studentGrade.studentEmail && (
              <p className="text-xs text-gray-400 truncate">{studentGrade.studentEmail}</p>
            )}
          </div>
        </div>
      }
      subtitle={
        <span className="text-xs text-gray-500 mt-1 block">
          {courseTitle}
          {studentGrade.sectionTitle ? ` · ${studentGrade.sectionTitle}` : ''}
        </span>
      }
    >
      {/* Summary row */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        {/* Big percentage + letter */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div>
            <p
              className={`text-4xl font-bold tabular-nums leading-none ${
                studentGrade.totalMaxPoints === 0
                  ? 'text-gray-400'
                  : isAtRisk
                  ? 'text-red-600'
                  : 'text-gray-900'
              }`}
            >
              {studentGrade.totalMaxPoints === 0 ? '—' : `${studentGrade.overallPercentage}%`}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Promedio general</p>
          </div>

          {studentGrade.totalMaxPoints > 0 && (
            <span
              className={`w-14 h-14 rounded-full border-4 ${letter.ring} ${letter.text} flex items-center justify-center font-bold text-2xl shrink-0`}
              aria-label={`Letra ${letter.label}`}
            >
              {letter.label}
            </span>
          )}
        </div>

        {/* Mini stats */}
        <div className="flex gap-4 shrink-0 flex-wrap">
          <div className="text-center">
            <p className="text-base font-bold text-gray-900 tabular-nums">{gradedCount}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Calificadas</p>
          </div>
          <div className="text-center">
            <p className="text-base font-bold text-gray-900 tabular-nums">{pendingCount}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Pendientes</p>
          </div>
          <div className="text-center">
            <p className="text-base font-bold text-gray-900 tabular-nums">
              {evaluations.length > 0
                ? `${Math.round((gradedCount / evaluations.length) * 100)}%`
                : '—'}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">Del curso</p>
          </div>
        </div>

        {/* At-risk badge */}
        {isAtRisk && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 text-red-600 text-xs font-semibold border border-red-100 shrink-0">
            <AlertCircle className="h-3 w-3" />
            En riesgo
          </span>
        )}
      </div>

      {/* Progress bar */}
      {studentGrade.totalMaxPoints > 0 && (
        <div className="mb-6">
          <div
            className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={studentGrade.overallPercentage}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full bg-red-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(studentGrade.overallPercentage, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Evaluation list */}
      <div className="space-y-1">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Evaluaciones ({evaluations.length})
        </p>

        {evaluations.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No hay evaluaciones en este curso.</p>
        ) : (
          <div className="space-y-2">
            {evaluations.map(evaluation => {
              const gradeItem = studentGrade.evaluations.find(
                e => e.evaluationId === evaluation.id
              );
              const isGraded = gradeItem && gradeItem.score !== null;
              const isSubmitted = gradeItem && gradeItem.status === 'submitted';
              const notSubmitted = !gradeItem || gradeItem.score === null;
              const pct = gradeItem?.percentage ?? null;
              const pillClass = TYPE_PILL[evaluation.type] ?? 'bg-red-50 text-red-600 border-red-100';

              return (
                <div
                  key={evaluation.id}
                  className={`rounded-lg border px-4 py-3 ${
                    notSubmitted ? 'bg-gray-50 border-gray-100' : 'bg-white border-gray-100'
                  }`}
                >
                  {/* Top row: title + type badge + status */}
                  <div className="flex items-start gap-2 flex-wrap justify-between">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="text-sm font-medium text-gray-800 truncate">
                        {evaluation.title}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize shrink-0 ${pillClass}`}
                      >
                        {TYPE_LABEL[evaluation.type] ?? evaluation.type}
                      </span>
                    </div>

                    {/* Status chip */}
                    {isGraded ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-semibold shrink-0">
                        <CheckCircle2 className="h-3 w-3 text-gray-500" />
                        Calificada
                      </span>
                    ) : isSubmitted ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-[10px] font-semibold border border-red-100 shrink-0">
                        <Clock className="h-3 w-3" />
                        Por calificar
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 text-[10px] font-semibold shrink-0">
                        No entregada
                      </span>
                    )}
                  </div>

                  {/* Metadata row */}
                  <div className="flex items-center gap-4 mt-2 flex-wrap">
                    {/* Due date */}
                    {evaluation.dueDate && (
                      <p className="text-[11px] text-gray-400">
                        Entrega: {formatDate(evaluation.dueDate)}
                      </p>
                    )}
                    {/* Submitted at */}
                    {gradeItem?.submittedAt && (
                      <p className="text-[11px] text-gray-400">
                        Enviada: {formatDate(gradeItem.submittedAt)}
                      </p>
                    )}
                  </div>

                  {/* Score + bar */}
                  {isGraded && gradeItem && pct !== null && (
                    <div className="mt-3 flex items-center gap-3">
                      {/* Progress bar */}
                      <div className="flex-1">
                        <div
                          className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden"
                          role="progressbar"
                          aria-valuenow={pct}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <div
                            className="h-full bg-red-500 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      </div>
                      {/* Score text */}
                      <div className="shrink-0 text-right">
                        <span className={`text-sm font-bold tabular-nums ${getGradeColor(pct)}`}>
                          {gradeItem.score}/{gradeItem.maxPoints}
                        </span>
                        <span className="text-[10px] text-gray-400 ml-1.5">{pct}%</span>
                      </div>
                    </div>
                  )}

                  {/* Feedback */}
                  {gradeItem?.feedback && (
                    <div className="mt-2.5 px-3 py-2 bg-gray-50 rounded-md border border-gray-100">
                      <p className="text-[11px] font-semibold text-gray-500 mb-0.5">
                        Retroalimentación
                      </p>
                      <p className="text-xs text-gray-600 leading-relaxed">
                        {gradeItem.feedback}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Teacher Student Row (desktop) ────────────────────────────────────────────

function StudentRow({
  grade,
  courseTitle,
  onViewDetails,
}: {
  grade: StudentGrade;
  courseTitle: string;
  onViewDetails: () => void;
}) {
  const noGrades = grade.totalMaxPoints === 0;
  const isAtRisk = !noGrades && grade.overallPercentage < 70;
  const gradedCount = grade.evaluations.filter(e => e.score !== null).length;
  const totalCount = grade.evaluations.length;

  return (
    <tr
      className="transition-colors hover:bg-gray-50 cursor-pointer"
      onClick={onViewDetails}
      tabIndex={0}
      role="button"
      aria-label={`Ver detalles de ${grade.studentName}`}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onViewDetails();
        }
      }}
    >
      {/* Avatar + name + email */}
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center gap-3">
          <div
            className="h-9 w-9 rounded-full bg-red-50 flex items-center justify-center shrink-0"
            aria-hidden="true"
          >
            <span className="text-red-600 font-semibold text-sm">
              {initials(grade.studentName)}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{grade.studentName}</p>
            {grade.studentEmail && (
              <p className="text-xs text-gray-400 truncate">{grade.studentEmail}</p>
            )}
          </div>
        </div>
      </td>

      {/* Sección */}
      <td className="px-4 py-3 whitespace-nowrap hidden md:table-cell">
        <span className="text-xs text-gray-500">{grade.sectionTitle ?? '—'}</span>
      </td>

      {/* Progreso + barra */}
      <td className="px-4 py-3 hidden sm:table-cell">
        <div className="flex items-center gap-2 w-36">
          <div
            className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={grade.overallPercentage}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full bg-red-500 rounded-full transition-all duration-300"
              style={{ width: noGrades ? '0%' : `${Math.min(grade.overallPercentage, 100)}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 tabular-nums w-8 text-right shrink-0">
            {noGrades ? '—' : `${grade.overallPercentage}%`}
          </span>
        </div>
      </td>

      {/* Promedio */}
      <td className="px-4 py-3 whitespace-nowrap text-center">
        <div className="flex flex-col items-center gap-1">
          <span
            className={`text-lg font-bold tabular-nums leading-none ${
              noGrades ? 'text-gray-400' : getGradeColor(grade.overallPercentage)
            }`}
          >
            {noGrades ? '—' : grade.overallPercentage}
          </span>
          {!noGrades && isAtRisk && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 text-[9px] font-semibold border border-red-100">
              En riesgo
            </span>
          )}
        </div>
      </td>

      {/* Evaluaciones */}
      <td className="px-4 py-3 whitespace-nowrap text-center hidden lg:table-cell">
        <span className="text-sm tabular-nums text-gray-600">
          {gradedCount}<span className="text-gray-400">/{totalCount}</span>
        </span>
      </td>

      {/* Botón */}
      <td className="px-4 py-3 whitespace-nowrap text-right">
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onViewDetails(); }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          aria-label={`Ver detalles de ${grade.studentName}`}
        >
          <Eye className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Ver detalles</span>
        </button>
      </td>
    </tr>
  );
}

// ─── Mobile Student Card ───────────────────────────────────────────────────────

function StudentCard({
  grade,
  onViewDetails,
}: {
  grade: StudentGrade;
  onViewDetails: () => void;
}) {
  const noGrades = grade.totalMaxPoints === 0;
  const isAtRisk = !noGrades && grade.overallPercentage < 70;
  const gradedCount = grade.evaluations.filter(e => e.score !== null).length;
  const totalCount = grade.evaluations.length;

  return (
    <div
      className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors cursor-pointer"
      onClick={onViewDetails}
      role="button"
      tabIndex={0}
      aria-label={`Ver detalles de ${grade.studentName}`}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onViewDetails();
        }
      }}
    >
      {/* Avatar */}
      <div
        className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center shrink-0"
        aria-hidden="true"
      >
        <span className="text-red-600 font-semibold text-sm">{initials(grade.studentName)}</span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-gray-900 truncate">{grade.studentName}</p>
          {!noGrades && isAtRisk && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 text-[9px] font-semibold border border-red-100 shrink-0">
              En riesgo
            </span>
          )}
        </div>
        {grade.studentEmail && (
          <p className="text-xs text-gray-400 truncate">{grade.studentEmail}</p>
        )}
        {/* Progress bar */}
        <div className="flex items-center gap-2 mt-1.5">
          <div
            className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-[120px]"
            role="progressbar"
            aria-valuenow={grade.overallPercentage}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full bg-red-500 rounded-full"
              style={{ width: noGrades ? '0%' : `${Math.min(grade.overallPercentage, 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-gray-400 tabular-nums">
            {gradedCount}/{totalCount} eval.
          </span>
        </div>
      </div>

      {/* Score */}
      <div className="shrink-0 text-right">
        <p
          className={`text-lg font-bold tabular-nums leading-none ${
            noGrades ? 'text-gray-400' : getGradeColor(grade.overallPercentage)
          }`}
        >
          {noGrades ? '—' : grade.overallPercentage}
        </p>
        {!noGrades && (
          <p className="text-[10px] text-gray-400 mt-0.5">promedio</p>
        )}
      </div>

      {/* Chevron */}
      <Eye className="h-4 w-4 text-gray-300 shrink-0" aria-hidden="true" />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GradesPage() {
  const { user } = useAuthStore();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('all');
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [studentGrades, setStudentGrades] = useState<StudentGrade[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [gradesLoading, setGradesLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentGrade | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const isTeacher = user?.role === 'teacher';
  const isAdmin = user?.role === 'admin';
  const isSupervisor = user?.role === 'supervisor';
  const isStudent = user?.role === 'student';

  // SectionPicker: load sections based on role
  const { sections: allSections, loading: sectionsLoading } = useSections(
    isTeacher ? { instructorId: user?.id } : {}
  );

  // For students, filter sections to only enrolled ones
  const [studentSectionIds, setStudentSectionIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (isStudent && user?.id) {
      legacyEnrollmentService.getByUser(user.id).then(enrollments => {
        setStudentSectionIds(new Set(enrollments.map(e => e.sectionId).filter(Boolean) as string[]));
      });
    }
  }, [isStudent, user?.id]);

  const sections = isStudent
    ? allSections.filter(s => studentSectionIds.has(s.id))
    : allSections;

  // When a section is selected, derive courseId
  const handleSectionChange = (sectionId: string) => {
    setSelectedSectionId(sectionId);
    if (sectionId === 'all') {
      // Keep current courseId or clear
      return;
    }
    const section = sections.find(s => s.id === sectionId);
    if (section) {
      setSelectedCourseId(section.courseId);
    }
  };

  // Load courses for student tab switcher and for grade data
  useEffect(() => {
    loadCourses();
  }, []);

  useEffect(() => {
    if (selectedCourseId) {
      loadCourseGrades(selectedCourseId);
    }
  }, [selectedCourseId, selectedSectionId]);

  const loadCourses = async () => {
    try {
      const allCourses = await courseService.getAll();

      let filteredCourses: Course[];
      if (isAdmin || isSupervisor) {
        filteredCourses = allCourses.map(c => ({ id: c.id, title: c.title, instructorId: c.instructorId || '' }));
      } else if (isTeacher) {
        filteredCourses = allCourses
          .filter(c => c.instructorId === user?.id)
          .map(c => ({ id: c.id, title: c.title, instructorId: c.instructorId || '' }));
      } else {
        const enrollments = await legacyEnrollmentService.getByUser(user?.id || '');
        const enrolledCourseIds = Array.from(new Set(enrollments.map(e => e.courseId)));
        filteredCourses = allCourses
          .filter(c => enrolledCourseIds.includes(c.id))
          .map(c => ({ id: c.id, title: c.title, instructorId: c.instructorId || '' }));
      }

      setCourses(filteredCourses);
      if (filteredCourses.length > 0) {
        setSelectedCourseId(filteredCourses[0].id);
      }
    } catch (error) {
      console.error('Error loading courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCourseGrades = async (courseId: string) => {
    setGradesLoading(true);
    try {
      // ── Evaluations ──────────────────────────────────────────────────────────
      const allEvaluations = await evaluationService.getAll();
      const filteredEvals = allEvaluations.filter(e => e.courseId === courseId);
      const evalItems: Evaluation[] = filteredEvals.map(e => {
        const maxPoints = Array.isArray(e.questions) && e.questions.length > 0
          ? e.questions.reduce((sum: number, q: any) => sum + (q.points || 0), 0) || 100
          : 100;
        return {
          id: e.id,
          title: e.title,
          courseId: e.courseId,
          type: e.type as 'quiz' | 'tarea' | 'examen' | 'proyecto',
          maxPoints,
          weight: 0,
          source: 'evaluation' as const,
          dueDate: e.dueDate,
        };
      });

      // ── Task submissions ──────────────────────────────────────────────────────
      const allTaskSubmissions = await taskSubmissionService.getAll();
      const courseTaskSubs = allTaskSubmissions.filter(s => s.courseId === courseId);
      const taskByLesson = new Map<string, typeof courseTaskSubs>();
      for (const sub of courseTaskSubs) {
        const list = taskByLesson.get(sub.lessonId) ?? [];
        list.push(sub);
        taskByLesson.set(sub.lessonId, list);
      }
      const taskItems: Evaluation[] = [];
      for (const [lessonId, subs] of taskByLesson) {
        const firstGrade = subs.find(s => s.grade?.maxScore);
        const maxPoints = firstGrade?.grade?.maxScore ?? 100;
        const firstSub = subs[0];
        taskItems.push({
          id: `task:${lessonId}`,
          lessonId,
          title: firstSub?.files?.[0]?.name?.replace(/\.[^.]+$/, '') || 'Tarea',
          courseId,
          type: 'tarea',
          maxPoints,
          weight: 0,
          source: 'task',
        });
      }

      const courseEvaluations = [...evalItems, ...taskItems];
      const totalItems = courseEvaluations.length || 1;
      courseEvaluations.forEach(e => (e.weight = 100 / totalItems));
      setEvaluations(courseEvaluations);

      // ── Students ──────────────────────────────────────────────────────────────
      let students: { id: string; name: string; email?: string; sectionTitle?: string }[];
      if (isStudent) {
        students = [{ id: user?.id || '', name: user?.name || '', email: user?.email }];
      } else {
        // Load enrollments scoped to section when possible
        let enrollments = selectedSectionId !== 'all'
          ? await sectionService.getEnrollments(selectedSectionId)
          : await legacyEnrollmentService.getByCourse(courseId);
        const sectionMap = new Map<string, string>(
          sections.map(s => [s.id, s.title])
        );
        const uniqueUserIds = Array.from(new Set(enrollments.map(e => e.userId)));
        const usersResolved = await Promise.all(
          uniqueUserIds.map(async (uid) => {
            const u: DBUser | null = await userService.getById(uid);
            const enrollment = enrollments.find(e => e.userId === uid);
            const sectionTitle = enrollment?.sectionId
              ? (sectionMap.get(enrollment.sectionId) ?? undefined)
              : undefined;
            return {
              id: uid,
              name: u?.name ?? 'Sin nombre',
              email: u?.email,
              sectionTitle,
            };
          })
        );
        students = usersResolved;
      }

      // ── Submissions ───────────────────────────────────────────────────────────
      const allAttempts = await Promise.all(
        evalItems.map(e => evaluationService.getAttemptsByEvaluation(e.id))
      );
      const attemptSubmissions: Submission[] = allAttempts.flat()
        .filter((a: any) => a?.status === 'completed' || typeof a?.score === 'number')
        .map((a: any) => ({
          id: a.id,
          evaluationId: a.evaluationId,
          userId: a.userId,
          userName: '',
          score: a.score ?? 0,
          totalPoints: a.maxScore ?? 100,
          percentage: typeof a.percentage === 'number'
            ? a.percentage
            : (a.maxScore ? Math.round(((a.score ?? 0) / a.maxScore) * 100) : 0),
          submittedAt: a.completedAt ?? new Date(a.updatedAt ?? Date.now()).toISOString(),
          gradedAt: a.gradedAt,
          feedback: a.feedback,
        }));

      const taskSubmissions: Submission[] = courseTaskSubs
        .filter(s => s.grade && typeof s.grade.score === 'number')
        .map(s => ({
          id: s.id,
          evaluationId: `task:${s.lessonId}`,
          userId: s.studentId,
          userName: s.studentName,
          score: s.grade!.score,
          totalPoints: s.grade!.maxScore ?? 100,
          percentage: s.grade!.maxScore
            ? Math.round((s.grade!.score / s.grade!.maxScore) * 100)
            : 0,
          submittedAt: new Date(s.submittedAt).toISOString(),
          gradedAt: s.grade!.gradedAt ? new Date(s.grade!.gradedAt).toISOString() : undefined,
          feedback: s.grade!.feedback,
        }));

      const allSubmissions = [...attemptSubmissions, ...taskSubmissions];

      // ── Grade aggregation ─────────────────────────────────────────────────────
      const grades: StudentGrade[] = students.map(student => {
        const studentEvaluations = courseEvaluations.map(evaluation => {
          const submission = allSubmissions.find(
            s => s.evaluationId === evaluation.id && s.userId === student.id
          );

          return {
            evaluationId: evaluation.id,
            score: submission?.score ?? null,
            maxPoints: evaluation.maxPoints,
            percentage: submission?.percentage ?? null,
            status: submission
              ? (submission.gradedAt ? 'graded' as const : 'submitted' as const)
              : 'pending' as const,
            submittedAt: submission?.submittedAt,
            gradedAt: submission?.gradedAt,
            feedback: submission?.feedback,
          };
        });

        const gradedEvaluations = studentEvaluations.filter(e => e.score !== null);
        const totalScore = gradedEvaluations.reduce((sum, e) => sum + (e.score || 0), 0);
        const totalMaxPoints = gradedEvaluations.reduce((sum, e) => sum + e.maxPoints, 0);
        const overallPercentage = totalMaxPoints > 0
          ? Math.round((totalScore / totalMaxPoints) * 100)
          : 0;

        const scores = gradedEvaluations.map(e => e.percentage || 0);
        let trend: 'up' | 'down' | 'stable' = 'stable';
        if (scores.length >= 2) {
          const lastTwo = scores.slice(-2);
          if (lastTwo[1] > lastTwo[0] + 5) trend = 'up';
          else if (lastTwo[1] < lastTwo[0] - 5) trend = 'down';
        }

        return {
          studentId: student.id,
          studentName: student.name,
          studentEmail: student.email,
          sectionTitle: student.sectionTitle,
          evaluations: studentEvaluations,
          totalScore,
          totalMaxPoints,
          overallPercentage,
          trend,
        };
      });

      setStudentGrades(grades);
    } catch (error) {
      console.error('Error loading grades:', error);
    } finally {
      setGradesLoading(false);
    }
  };

  // ── Filtering ──────────────────────────────────────────────────────────────

  const filteredGrades = studentGrades.filter(grade => {
    const matchesSearch =
      grade.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (grade.studentEmail ?? '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'passing' && grade.totalMaxPoints > 0 && grade.overallPercentage >= 70) ||
      (statusFilter === 'risk' && (grade.totalMaxPoints === 0 || grade.overallPercentage < 70));

    return matchesSearch && matchesStatus;
  });

  // ── Export ─────────────────────────────────────────────────────────────────

  const exportGrades = () => {
    const course = courses.find(c => c.id === selectedCourseId);
    const headers = ['Estudiante', 'Email', 'Sección', ...evaluations.map(e => e.title), 'Total', 'Promedio'];

    const rows = studentGrades.map(grade => [
      grade.studentName,
      grade.studentEmail ?? '',
      grade.sectionTitle ?? '',
      ...grade.evaluations.map(e => e.score !== null ? `${e.score}/${e.maxPoints}` : '-'),
      `${grade.totalScore}/${grade.totalMaxPoints}`,
      `${grade.overallPercentage}%`
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `calificaciones_${course?.title || 'curso'}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // ── KPI Stats ──────────────────────────────────────────────────────────────

  const stats = {
    students: studentGrades.length,
    avgScore: studentGrades.length > 0
      ? Math.round(studentGrades.reduce((sum, g) => sum + g.overallPercentage, 0) / studentGrades.length)
      : 0,
    passing: studentGrades.filter(g => g.totalMaxPoints > 0 && g.overallPercentage >= 70).length,
    pendingGrade: studentGrades.reduce(
      (sum, g) => sum + g.evaluations.filter(e => e.status === 'submitted').length,
      0
    ),
  };

  const selectedCourse = courses.find(c => c.id === selectedCourseId);

  // ── Open detail ────────────────────────────────────────────────────────────

  const openDetail = (grade: StudentGrade) => {
    setSelectedStudent(grade);
    setModalOpen(true);
  };

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (loading) {
    return <GradesSkeleton isStudent={isStudent} />;
  }

  // ── No courses ──────────────────────────────────────────────────────────────

  if (courses.length === 0) {
    return (
      <div className="px-4 sm:px-6 pt-2 pb-6">
        <EmptyState
          icon={BookOpen}
          message={isStudent ? 'No estás inscrito en ningún curso' : 'No tienes cursos asignados'}
          sub={isStudent ? 'Inscríbete en un curso para ver tus calificaciones.' : undefined}
        />
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STUDENT VIEW
  // ══════════════════════════════════════════════════════════════════════════

  if (isStudent) {
    const myGrade = studentGrades[0];
    const gradedCount = myGrade
      ? myGrade.evaluations.filter(e => e.score !== null).length
      : 0;

    return (
      <div className="px-4 sm:px-6 pt-2 pb-6 space-y-4">

        {/* Course switcher — underline tabs */}
        {courses.length > 1 && (
          <div className="border-b border-gray-200 -mx-4 sm:-mx-6 px-4 sm:px-6 overflow-x-auto">
            <div className="flex items-stretch gap-1 min-w-max">
              {courses.map(course => {
                const active = course.id === selectedCourseId;
                return (
                  <button
                    key={course.id}
                    onClick={() => setSelectedCourseId(course.id)}
                    className={`relative px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none ${
                      active
                        ? 'text-red-700'
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {course.title}
                    <span
                      className={`absolute left-3 right-3 -bottom-px h-0.5 rounded-full transition-colors ${
                        active ? 'bg-red-600' : 'bg-transparent'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Hero card or loading */}
        {gradesLoading ? (
          <GradesTableSkeleton isStudent />
        ) : !myGrade ? (
          <EmptyState
            icon={ClipboardList}
            message="Aún no hay calificaciones registradas"
            sub="Completa evaluaciones para ver tus notas aquí."
          />
        ) : (
          <>
            <StudentHeroCard
              courseTitle={selectedCourse?.title ?? ''}
              overallPercentage={myGrade.overallPercentage}
              gradedCount={gradedCount}
              totalCount={evaluations.length}
            />

            {evaluations.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">
                  Evaluaciones
                </p>
                <div className="space-y-1.5">
                  {evaluations.map(evaluation => {
                    const grade = myGrade.evaluations.find(
                      e => e.evaluationId === evaluation.id
                    ) ?? { score: null, maxPoints: evaluation.maxPoints, percentage: null, status: 'pending' as const };

                    return (
                      <StudentEvalRow
                        key={evaluation.id}
                        evaluation={evaluation}
                        grade={grade}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TEACHER / ADMIN VIEW
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div className="px-4 sm:px-6 pt-2 pb-6 space-y-3 sm:space-y-4">

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard label="Estudiantes"        value={stats.students}             icon={Users}      />
        <KpiCard label="Promedio general"   value={`${stats.avgScore}%`}       icon={BarChart3}  />
        <KpiCard label="Aprobados (≥70%)"   value={stats.passing}              icon={Award}      />
        <KpiCard label="Por calificar"      value={stats.pendingGrade}         icon={FileText}   />
      </div>

      {/* ── Toolbar — single white card ── */}
      <Card>
        <CardContent className="px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">

            {/* Search */}
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar estudiante..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors"
                aria-label="Buscar estudiante por nombre o email"
              />
            </div>

            {/* Section picker */}
            {sections.length > 0 && (
              <SectionPicker
                sections={sections}
                value={selectedSectionId}
                onChange={handleSectionChange}
                includeAllOption
                allOptionLabel="Todas las secciones"
                placeholder="Filtrar por seccion..."
                className="min-w-[240px] max-w-sm"
              />
            )}

            {/* Status filter chips */}
            <div className="flex items-center gap-1.5">
              {(
                [
                  { key: 'all', label: 'Todos' },
                  { key: 'passing', label: 'Aprobados' },
                  { key: 'risk', label: 'En riesgo' },
                ] as { key: StatusFilter; label: string }[]
              ).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatusFilter(key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
                    statusFilter === key
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Export — pushed right */}
            {studentGrades.length > 0 && (
              <div className="ml-auto shrink-0">
                <Button variant="outline" size="sm" onClick={exportGrades} className="text-xs">
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Exportar CSV
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Student list ── */}
      {gradesLoading ? (
        <GradesTableSkeleton isStudent={false} />
      ) : filteredGrades.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={searchTerm ? Search : Users}
              message={searchTerm || statusFilter !== 'all' ? 'Sin resultados' : 'No hay estudiantes inscritos'}
              sub={
                searchTerm
                  ? `No se encontraron estudiantes con "${searchTerm}".`
                  : statusFilter !== 'all'
                  ? 'Prueba con otro filtro de estado.'
                  : 'Inscribe estudiantes al curso para ver sus calificaciones.'
              }
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          {/* Desktop table — hidden on mobile */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Estudiante
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">
                    Sección
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Progreso
                  </th>
                  <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Promedio
                  </th>
                  <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                    Eval.
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredGrades.map(grade => (
                  <StudentRow
                    key={grade.studentId}
                    grade={grade}
                    courseTitle={selectedCourse?.title ?? ''}
                    onViewDetails={() => openDetail(grade)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card stack — shown only on mobile */}
          <div className="sm:hidden divide-y divide-gray-100">
            {filteredGrades.map(grade => (
              <StudentCard
                key={grade.studentId}
                grade={grade}
                onViewDetails={() => openDetail(grade)}
              />
            ))}
          </div>

          {/* Count footer */}
          <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/50 rounded-b-xl">
            <p className="text-xs text-gray-400">
              {filteredGrades.length}{' '}
              {filteredGrades.length === 1 ? 'estudiante' : 'estudiantes'}
              {filteredGrades.length !== studentGrades.length && ` de ${studentGrades.length}`}
            </p>
          </div>
        </Card>
      )}

      {/* ── Student detail modal ── */}
      <StudentDetailModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setSelectedStudent(null); }}
        studentGrade={selectedStudent}
        evaluations={evaluations}
        courseTitle={selectedCourse?.title ?? ''}
      />
    </div>
  );
}

// ─── Skeletons ─────────────────────────────────────────────────────────────────

function GradesSkeleton({ isStudent }: { isStudent: boolean }) {
  return (
    <div className="px-4 sm:px-6 pt-2 pb-6 space-y-4 animate-pulse" aria-busy="true" aria-label="Cargando calificaciones">
      {!isStudent ? (
        <>
          {/* KPI skeleton */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-lg border bg-white shadow-sm">
                <div className="px-4 py-3 flex items-center justify-between gap-2">
                  <div className="space-y-1.5">
                    <div className="h-2.5 w-14 bg-gray-100 rounded" />
                    <div className="h-5 w-8 bg-gray-200 rounded" />
                  </div>
                  <div className="w-7 h-7 rounded-md bg-red-50" />
                </div>
              </div>
            ))}
          </div>
          {/* Toolbar skeleton */}
          <div className="rounded-xl border bg-white shadow-sm">
            <div className="px-4 py-3 flex items-center gap-2">
              <div className="h-9 flex-1 max-w-xs bg-gray-100 rounded-lg" />
              <div className="h-9 w-36 bg-gray-100 rounded-lg" />
              <div className="h-9 w-28 bg-gray-100 rounded-lg ml-auto" />
            </div>
          </div>
        </>
      ) : (
        <div className="flex items-center gap-2">
          <div className="h-4 w-10 bg-gray-100 rounded" />
          <div className="h-7 w-28 bg-red-50 rounded-full" />
          <div className="h-7 w-24 bg-gray-100 rounded-full" />
        </div>
      )}

      {isStudent && (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="h-1 bg-red-100" />
          <div className="p-6 sm:p-8 space-y-4">
            <div className="h-3 w-24 bg-gray-100 rounded" />
            <div className="h-5 w-3/5 bg-gray-100 rounded" />
            <div className="flex items-end gap-4 mt-4">
              <div className="h-12 w-24 bg-red-50 rounded" />
              <div className="w-14 h-14 rounded-full bg-red-50" />
            </div>
            <div className="h-3 w-40 bg-gray-100 rounded mt-2" />
          </div>
        </div>
      )}

      <GradesTableSkeleton isStudent={isStudent} />
    </div>
  );
}

function GradesTableSkeleton({ isStudent }: { isStudent: boolean }) {
  const rows = isStudent ? 4 : 6;
  return (
    <div
      className="rounded-xl border bg-white shadow-sm overflow-hidden animate-pulse"
      aria-busy="true"
    >
      {!isStudent && (
        <div className="flex items-center gap-4 px-4 py-3 bg-gray-50 border-b border-gray-100">
          <div className="h-3 w-24 bg-gray-100 rounded" />
          <div className="h-3 w-16 bg-gray-100 rounded" />
          <div className="h-3 w-16 bg-gray-100 rounded" />
          <div className="h-3 w-12 bg-gray-100 rounded ml-auto" />
          <div className="h-3 w-10 bg-gray-100 rounded" />
        </div>
      )}

      <div className="divide-y divide-gray-100">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="h-9 w-9 rounded-full bg-red-50 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 bg-gray-100 rounded w-2/5" />
              <div className="h-2.5 bg-gray-50 rounded w-1/4" />
              {isStudent && (
                <div className="mt-2 space-y-1">
                  <div className="h-1.5 bg-red-50 rounded-full w-full" />
                </div>
              )}
            </div>
            {!isStudent && (
              <>
                <div className="h-1.5 w-28 bg-gray-100 rounded-full hidden sm:block" />
                <div className="h-6 w-10 bg-gray-100 rounded" />
                <div className="h-7 w-16 bg-red-50 rounded-lg" />
              </>
            )}
            {isStudent && (
              <div className="flex items-center gap-2 shrink-0">
                <div className="h-1.5 w-20 bg-gray-100 rounded-full hidden sm:block" />
                <div className="h-5 w-14 bg-red-50 rounded-full" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
