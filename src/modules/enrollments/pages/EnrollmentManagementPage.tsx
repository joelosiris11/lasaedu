import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '@app/store/authStore';
import {
  dataService,
  sectionService,
  certificateService,
} from '@shared/services/dataService';
import type {
  DBUser,
  DBCourse,
  DBEnrollment,
  DBSection,
  DBCertificate,
} from '@shared/services/dataService';
import {
  Users,
  UserPlus,
  Search,
  Award,
  CheckCircle,
  Download,
  X,
  Loader2,
  BookOpen,
  Eye,
  Lock,
  ExternalLink,
  Phone,
  MapPin,
  Calendar,
  Mail,
  Plus,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';
import { Modal } from '@shared/components/ui/Modal';

// ─── Types ────────────────────────────────────────────────────────────────────

type EnrollmentStatus = DBEnrollment['status'];

type StudentFilter =
  | 'active'
  | 'completed'
  | 'with_cert'
  | 'no_enrollment'
  | 'all';

interface StudentWithStats {
  user: DBUser;
  enrollments: (DBEnrollment & { course?: DBCourse; section?: DBSection })[];
  certificates: DBCertificate[];
  activeCount: number;
  completedCount: number;
  avgGrade: number | null;
  lastAccess: number | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<EnrollmentStatus, string> = {
  active:    'bg-red-50 text-red-700 border-red-100',
  completed: 'bg-gray-100 text-gray-700 border-gray-200',
  paused:    'bg-gray-50 text-gray-600 border-gray-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
};

const STATUS_LABELS: Record<EnrollmentStatus, string> = {
  active:    'Activa',
  completed: 'Completada',
  paused:    'Pausada',
  cancelled: 'Cancelada',
};

const FILTER_CHIPS: { key: StudentFilter; label: string }[] = [
  { key: 'active',        label: 'Con inscripciones activas' },
  { key: 'completed',     label: 'Completados'               },
  { key: 'with_cert',     label: 'Con certificado'           },
  { key: 'no_enrollment', label: 'Sin inscripciones'         },
  { key: 'all',           label: 'Todos'                     },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeDate(ts: number | null): string {
  if (!ts) return '—';
  const diffMs = Date.now() - ts;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return 'Ahora mismo';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 30) return `Hace ${diffDays} días`;
  return new Date(ts).toLocaleDateString('es-ES');
}

function avatar(name: string) {
  return name.charAt(0).toUpperCase();
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
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

// ─── Student Detail Modal ─────────────────────────────────────────────────────

interface StudentDetailModalProps {
  student: StudentWithStats | null;
  open: boolean;
  onClose: () => void;
  allSections: DBSection[];
  allCourses: DBCourse[];
  currentUserId: string;
  isTeacher: boolean;
  readOnly?: boolean;
  onEnrollmentCancelled: (enrollmentId: string) => void;
  onEnrollmentCreated: (enrollment: DBEnrollment) => void;
  onCertificateIssued: (cert: DBCertificate, enrollmentId: string) => void;
}

function StudentDetailModal({
  student,
  open,
  onClose,
  allSections,
  allCourses,
  currentUserId,
  isTeacher,
  readOnly,
  onEnrollmentCancelled,
  onEnrollmentCreated,
  onCertificateIssued,
}: StudentDetailModalProps) {
  const [tab, setTab] = useState<'info' | 'enrollments' | 'certificates'>('enrollments');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [issuingCertFor, setIssuingCertFor] = useState<string | null>(null);

  // Sub-flow: enroll in another section
  const [showAddEnrollment, setShowAddEnrollment] = useState(false);
  const [addSectionId, setAddSectionId] = useState('');
  const [addEnrolling, setAddEnrolling] = useState(false);

  useEffect(() => {
    if (open) {
      setTab('enrollments');
      setShowAddEnrollment(false);
      setAddSectionId('');
      setCancellingId(null);
      setIssuingCertFor(null);
    }
  }, [open, student?.user.id]);

  if (!student) return null;

  const { user, enrollments, certificates } = student;

  // Sections already enrolled (exclude cancelled)
  const enrolledSectionIds = new Set(
    enrollments
      .filter(e => e.status !== 'cancelled')
      .map(e => e.sectionId)
      .filter(Boolean)
  );

  // Available sections to add (exclude already enrolled, visible to this teacher)
  const availableSections = allSections.filter(
    s => !enrolledSectionIds.has(s.id) && s.status === 'activa'
  );

  const handleCancelEnrollment = async (enrollmentId: string) => {
    if (!window.confirm('¿Desinscribir a este estudiante? Esta acción no se puede deshacer.')) return;
    setCancellingId(enrollmentId);
    try {
      await dataService.enrollments.update(enrollmentId, {
        status: 'cancelled',
        updatedAt: Date.now(),
      });
      onEnrollmentCancelled(enrollmentId);
    } catch {
      alert('Error al desinscribir al estudiante. Intenta de nuevo.');
    } finally {
      setCancellingId(null);
    }
  };

  const handleAddEnrollment = async () => {
    if (!addSectionId) return;
    const section = allSections.find(s => s.id === addSectionId);
    if (!section) return;
    setAddEnrolling(true);
    try {
      const now = Date.now();
      const newEnrollment = await dataService.enrollments.create({
        userId: user.id,
        courseId: section.courseId,
        sectionId: section.id,
        status: 'active' as const,
        enrolledAt: new Date().toISOString(),
        progress: 0,
        completedLessons: [],
        completedModules: [],
        totalTimeSpent: 0,
        createdAt: now,
        updatedAt: now,
      });
      onEnrollmentCreated({
        ...newEnrollment,
        userId: user.id,
        courseId: section.courseId,
        sectionId: section.id,
        status: 'active',
        enrolledAt: new Date().toISOString(),
        progress: 0,
        completedLessons: [],
        completedModules: [],
        totalTimeSpent: 0,
        createdAt: now,
        updatedAt: now,
      });
      setShowAddEnrollment(false);
      setAddSectionId('');
    } catch {
      alert('Error al inscribir al estudiante. Intenta de nuevo.');
    } finally {
      setAddEnrolling(false);
    }
  };

  const handleIssueCertificate = async (enrollment: DBEnrollment & { course?: DBCourse; section?: DBSection }) => {
    if (!enrollment.course) return;
    const instructor = allSections.find(s => s.id === enrollment.sectionId);
    const credentialId = `cert-${Date.now()}-${user.id.slice(0, 6)}`;
    const verificationUrl = `/certificates/verify/${credentialId}`;
    setIssuingCertFor(enrollment.id);
    try {
      const now = Date.now();
      const cert = await certificateService.create({
        courseId: enrollment.course.id,
        userId: user.id,
        courseName: enrollment.course.title,
        studentName: user.name,
        instructorName: instructor?.instructorName ?? 'Instructor',
        completionDate: new Date().toISOString(),
        grade: enrollment.grade ?? undefined,
        credentialId,
        verificationUrl,
        templateId: 'default',
        pdfUrl: undefined,
        status: 'generated',
        createdAt: now,
        updatedAt: now,
      });
      await dataService.enrollments.update(enrollment.id, {
        certificateId: cert.id,
        updatedAt: now,
      });
      onCertificateIssued(cert, enrollment.id);
    } catch {
      alert('Error al emitir el certificado. Intenta de nuevo.');
    } finally {
      setIssuingCertFor(null);
    }
  };

  // Completed enrollments without a certificate
  const completedWithoutCert = enrollments.filter(
    e => e.status === 'completed' && !e.certificateId
  );

  const tabBase =
    'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500';
  const tabActive = 'bg-red-600 text-white';
  const tabInactive = 'text-gray-600 hover:bg-gray-100';

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="3xl"
      title={
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center shrink-0"
            aria-hidden="true"
          >
            <span className="text-base font-bold text-red-600">{avatar(user.name)}</span>
          </div>
          <div className="min-w-0">
            <span className="block text-base font-semibold text-gray-900 truncate">{user.name}</span>
            <span className="block text-xs text-gray-500 truncate">{user.email}</span>
          </div>
        </div>
      }
    >
      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
        {[
          { label: 'Activas',      value: student.activeCount    },
          { label: 'Completadas',  value: student.completedCount },
          { label: 'Promedio',     value: student.avgGrade !== null ? `${student.avgGrade}%` : '—' },
          { label: 'Certificados', value: certificates.length    },
        ].map(stat => (
          <div
            key={stat.label}
            className="bg-gray-50 rounded-lg px-3 py-2 text-center"
          >
            <p className="text-lg font-bold text-gray-900">{stat.value}</p>
            <p className="text-[11px] text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 mb-5 bg-gray-50 p-1 rounded-lg">
        {(
          [
            { key: 'enrollments',  label: 'Inscripciones'      },
            { key: 'certificates', label: 'Certificados'        },
            { key: 'info',         label: 'Información personal'},
          ] as { key: typeof tab; label: string }[]
        ).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`${tabBase} ${tab === t.key ? tabActive : tabInactive}`}
          >
            {t.label}
            {t.key === 'enrollments' && enrollments.length > 0 && (
              <span className={`ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${tab === t.key ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
                {enrollments.length}
              </span>
            )}
            {t.key === 'certificates' && certificates.length > 0 && (
              <span className={`ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${tab === t.key ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
                {certificates.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab: Inscripciones */}
      {tab === 'enrollments' && (
        <div className="space-y-3">
          {/* Add enrollment sub-flow */}
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-medium text-gray-700">
              {enrollments.length === 0
                ? 'Este estudiante no tiene inscripciones.'
                : `${enrollments.length} inscripción${enrollments.length !== 1 ? 'es' : ''}`}
            </p>
            {!readOnly && (
              <button
                onClick={() => setShowAddEnrollment(v => !v)}
                className="flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded"
              >
                <Plus className="h-3.5 w-3.5" />
                Inscribir en otra sección
              </button>
            )}
          </div>

          {showAddEnrollment && (
            <div className="border border-red-100 bg-red-50 rounded-lg p-3 flex items-end gap-2">
              <div className="flex-1 min-w-0">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Sección disponible
                </label>
                <select
                  value={addSectionId}
                  onChange={e => setAddSectionId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  <option value="">Selecciona una sección…</option>
                  {availableSections.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.courseTitle} — {s.title}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                size="sm"
                disabled={!addSectionId || addEnrolling}
                onClick={handleAddEnrollment}
                className="bg-red-600 hover:bg-red-700 text-white border-0 text-xs shrink-0"
              >
                {addEnrolling ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  'Inscribir'
                )}
              </Button>
              <button
                onClick={() => { setShowAddEnrollment(false); setAddSectionId(''); }}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                aria-label="Cancelar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {enrollments.length === 0 ? (
            <div className="text-center py-10">
              <BookOpen className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Sin inscripciones registradas.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {enrollments.map(e => {
                const progress = e.progress ?? 0;
                const isCompleted = e.status === 'completed';
                const isCancelling = cancellingId === e.id;
                return (
                  <div
                    key={e.id}
                    className="border border-gray-200 rounded-lg px-4 py-3 bg-white"
                  >
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {e.course?.title ?? 'Curso eliminado'}
                        </p>
                        {e.section && (
                          <p className="text-xs text-gray-500 truncate">
                            {e.section.title}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_STYLES[e.status]}`}
                        >
                          {STATUS_LABELS[e.status]}
                        </span>
                        {!readOnly && (isCompleted ? (
                          <span
                            title="No se puede desinscribir: curso completado"
                            className="p-1.5 text-gray-300 cursor-not-allowed"
                            aria-label="No se puede desinscribir: curso completado"
                          >
                            <Lock className="h-3.5 w-3.5" />
                          </span>
                        ) : (
                          <button
                            onClick={() => handleCancelEnrollment(e.id)}
                            disabled={isCancelling}
                            title="Desinscribir"
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50"
                            aria-label="Desinscribir"
                          >
                            {isCancelling ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <X className="h-3.5 w-3.5" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-2.5 flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                        <div
                          className="bg-red-500 h-1.5 rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-gray-500 tabular-nums w-8 text-right">
                        {progress}%
                      </span>
                      {e.grade != null && (
                        <span className="text-[11px] text-gray-600 font-medium">
                          Nota: {e.grade}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-gray-400">
                      Inscrito el {new Date(e.enrolledAt).toLocaleDateString('es-ES')}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: Certificados */}
      {tab === 'certificates' && (
        <div className="space-y-3">
          {/* Emit certificate prompts */}
          {completedWithoutCert.length > 0 && !readOnly && (
            <div className="border border-red-100 bg-red-50 rounded-lg px-4 py-3 space-y-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                <p className="text-sm font-medium text-red-800">
                  {completedWithoutCert.length} inscripción{completedWithoutCert.length !== 1 ? 'es completadas' : ' completada'} sin certificado
                </p>
              </div>
              {completedWithoutCert.map(e => (
                <div key={e.id} className="flex items-center justify-between gap-2 pl-6">
                  <p className="text-xs text-gray-700 truncate">
                    {e.course?.title ?? 'Curso eliminado'}
                    {e.section ? ` — ${e.section.title}` : ''}
                  </p>
                  <button
                    onClick={() => handleIssueCertificate(e)}
                    disabled={issuingCertFor === e.id}
                    className="flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-800 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded disabled:opacity-50"
                  >
                    {issuingCertFor === e.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Award className="h-3.5 w-3.5" />
                    )}
                    Emitir certificado
                  </button>
                </div>
              ))}
            </div>
          )}

          {certificates.length === 0 && completedWithoutCert.length === 0 ? (
            <div className="text-center py-10">
              <Award className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Sin certificados emitidos.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {certificates.map(cert => (
                <div
                  key={cert.id}
                  className="border border-gray-200 rounded-lg px-4 py-3 bg-white flex items-start justify-between gap-3"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-1.5 bg-red-50 rounded-md shrink-0 mt-0.5">
                      <Award className="h-4 w-4 text-red-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {cert.courseName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(cert.completionDate).toLocaleDateString('es-ES')}
                        {cert.grade != null && ` · Nota: ${cert.grade}`}
                      </p>
                      <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                        {cert.credentialId}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {(cert.verificationUrl || cert.pdfUrl) && (
                      <a
                        href={cert.pdfUrl ?? cert.verificationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Ver certificado"
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        aria-label="Ver certificado"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                    {cert.pdfUrl && (
                      <a
                        href={cert.pdfUrl}
                        download
                        title="Descargar PDF"
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        aria-label="Descargar certificado"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Información personal */}
      {tab === 'info' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { icon: Mail,     label: 'Correo',          value: user.email                    },
              { icon: Phone,    label: 'Teléfono',         value: user.profile?.phone           },
              { icon: MapPin,   label: 'Ubicación',        value: user.profile?.location        },
              { icon: Calendar, label: 'Fecha de nacimiento', value: user.profile?.birthDate   },
              {
                icon: Calendar,
                label: 'Miembro desde',
                value: user.createdAt
                  ? new Date(user.createdAt).toLocaleDateString('es-ES')
                  : undefined,
              },
            ]
              .filter(f => f.value)
              .map(f => (
                <div key={f.label} className="flex items-start gap-3 bg-gray-50 rounded-lg px-3 py-2.5">
                  <f.icon className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-[11px] text-gray-500">{f.label}</p>
                    <p className="text-sm text-gray-900 truncate">{f.value}</p>
                  </div>
                </div>
              ))}
          </div>
          {user.profile?.bio && (
            <div className="bg-gray-50 rounded-lg px-3 py-2.5">
              <p className="text-[11px] text-gray-500 mb-1">Bio</p>
              <p className="text-sm text-gray-700 leading-relaxed">{user.profile.bio}</p>
            </div>
          )}
          {!user.profile?.phone && !user.profile?.location && !user.profile?.bio && (
            <p className="text-sm text-gray-400 text-center py-6">
              No hay información adicional registrada.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}

// ─── Bulk Enroll Modal ───────────────────────────────────────────────────────

function BulkEnrollModal({
  open,
  onClose,
  selectedStudents,
  allSections,
  allEnrollments,
  onEnrolled,
}: {
  open: boolean;
  onClose: () => void;
  selectedStudents: DBUser[];
  allSections: DBSection[];
  allEnrollments: DBEnrollment[];
  onEnrolled: (enrollments: DBEnrollment[]) => void;
}) {
  const [sectionId, setSectionId] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [progress, setProgress] = useState({ done: 0, skipped: 0, total: 0 });

  useEffect(() => {
    if (open) { setSectionId(''); setProgress({ done: 0, skipped: 0, total: 0 }); }
  }, [open]);

  const activeSections = allSections.filter(s => s.status === 'activa');

  // Students already enrolled (non-cancelled) in the chosen section
  const alreadyEnrolled = useMemo(() => {
    if (!sectionId) return new Set<string>();
    return new Set(
      allEnrollments
        .filter(e => e.sectionId === sectionId && e.status !== 'cancelled')
        .map(e => e.userId)
    );
  }, [sectionId, allEnrollments]);

  const toEnroll = selectedStudents.filter(s => !alreadyEnrolled.has(s.id));
  const skipCount = selectedStudents.length - toEnroll.length;

  const handleBulkEnroll = async () => {
    if (!sectionId || toEnroll.length === 0) return;
    const section = allSections.find(s => s.id === sectionId);
    if (!section) return;

    setEnrolling(true);
    setProgress({ done: 0, skipped: skipCount, total: toEnroll.length });
    const created: DBEnrollment[] = [];

    for (const student of toEnroll) {
      try {
        const now = Date.now();
        const enrollment = await dataService.enrollments.create({
          userId: student.id,
          courseId: section.courseId,
          sectionId: section.id,
          status: 'active' as const,
          enrolledAt: new Date().toISOString(),
          progress: 0,
          completedLessons: [],
          completedModules: [],
          totalTimeSpent: 0,
          createdAt: now,
          updatedAt: now,
        });
        created.push({
          ...enrollment,
          userId: student.id,
          courseId: section.courseId,
          sectionId: section.id,
          status: 'active',
          enrolledAt: new Date().toISOString(),
          progress: 0,
          completedLessons: [],
          completedModules: [],
          totalTimeSpent: 0,
          createdAt: now,
          updatedAt: now,
        });
      } catch {
        // skip failed
      }
      setProgress(prev => ({ ...prev, done: prev.done + 1 }));
    }

    onEnrolled(created);
    onClose();
    setEnrolling(false);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Inscripción masiva"
      subtitle={`${selectedStudents.length} estudiante${selectedStudents.length !== 1 ? 's' : ''} seleccionado${selectedStudents.length !== 1 ? 's' : ''}`}
      disableBackdropClose={enrolling}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={enrolling} className="text-xs">
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleBulkEnroll}
            disabled={!sectionId || toEnroll.length === 0 || enrolling}
            className="bg-red-600 hover:bg-red-700 text-white border-0 text-xs"
          >
            {enrolling ? (
              <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Inscribiendo {progress.done}/{progress.total}…</>
            ) : (
              <><UserPlus className="h-3.5 w-3.5 mr-1.5" />Inscribir {toEnroll.length} estudiante{toEnroll.length !== 1 ? 's' : ''}</>
            )}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="bulk-section">
            Sección destino
          </label>
          <select
            id="bulk-section"
            value={sectionId}
            onChange={e => setSectionId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
          >
            <option value="">Selecciona una sección…</option>
            {activeSections.map(s => (
              <option key={s.id} value={s.id}>{s.courseTitle} — {s.title}</option>
            ))}
          </select>
        </div>

        {sectionId && skipCount > 0 && (
          <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {skipCount} estudiante{skipCount !== 1 ? 's' : ''} ya está{skipCount !== 1 ? 'n' : ''} inscrito{skipCount !== 1 ? 's' : ''} en esta sección y se omitirá{skipCount !== 1 ? 'n' : ''}.
          </div>
        )}

        {sectionId && toEnroll.length === 0 && (
          <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <CheckCircle className="h-4 w-4 shrink-0 text-green-600" />
            Todos los seleccionados ya están inscritos en esta sección.
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EnrollmentManagementPage() {
  const { user } = useAuthStore();
  const isTeacher = user?.role === 'teacher';
  const isSupervisor = user?.role === 'supervisor';

  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<DBUser[]>([]);
  const [allEnrollments, setAllEnrollments] = useState<DBEnrollment[]>([]);
  const [allCourses, setAllCourses] = useState<DBCourse[]>([]);
  const [allSections, setAllSections] = useState<DBSection[]>([]);
  const [allCertificates, setAllCertificates] = useState<DBCertificate[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [studentFilter, setStudentFilter] = useState<StudentFilter>('all');

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailStudent, setDetailStudent] = useState<StudentWithStats | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);

  // ─── Load ──────────────────────────────────────────────────────────────────

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [usersData, enrollmentsData, coursesData, certificatesData] =
        await Promise.all([
          dataService.users.getAll(),
          dataService.enrollments.getAll(),
          dataService.courses.getAll(),
          certificateService.getAll(),
        ]);

      const allSectionsData = await sectionService.getAll();
      const sectionsData = isTeacher
        ? allSectionsData.filter(s => s.instructorId === user.id)
        : allSectionsData;

      const visibleSectionIds = new Set(sectionsData.map(s => s.id));
      const visibleEnrollments = isTeacher
        ? enrollmentsData.filter(e => e.sectionId && visibleSectionIds.has(e.sectionId))
        : enrollmentsData;

      const students = usersData.filter(u => u.role === 'student');

      setAllUsers(students);
      setAllEnrollments(visibleEnrollments);
      setAllCourses(coursesData);
      setAllSections(sectionsData);
      setAllCertificates(certificatesData);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Build student stats ───────────────────────────────────────────────────

  const coursesMap = useMemo(() => new Map(allCourses.map(c => [c.id, c])), [allCourses]);
  const sectionsMap = useMemo(() => new Map(allSections.map(s => [s.id, s])), [allSections]);
  const certsMap = useMemo(() => {
    const m = new Map<string, DBCertificate[]>();
    for (const cert of allCertificates) {
      if (!m.has(cert.userId)) m.set(cert.userId, []);
      m.get(cert.userId)!.push(cert);
    }
    return m;
  }, [allCertificates]);

  const studentsWithStats = useMemo((): StudentWithStats[] => {
    return allUsers.map(u => {
      const userEnrollments = allEnrollments
        .filter(e => e.userId === u.id)
        .map(e => ({ ...e, course: e.courseId ? coursesMap.get(e.courseId) : undefined, section: e.sectionId ? sectionsMap.get(e.sectionId) : undefined }));
      const certs = certsMap.get(u.id) ?? [];
      const activeCount = userEnrollments.filter(e => e.status === 'active').length;
      const completedCount = userEnrollments.filter(e => e.status === 'completed').length;
      const grades = userEnrollments.filter(e => e.grade != null).map(e => e.grade as number);
      const avgGrade = grades.length > 0 ? Math.round(grades.reduce((s, g) => s + g, 0) / grades.length) : null;
      const accesses = userEnrollments.filter(e => e.lastAccessedAt != null).map(e => e.lastAccessedAt as number);
      const lastAccess = accesses.length > 0 ? Math.max(...accesses) : null;
      return { user: u, enrollments: userEnrollments, certificates: certs, activeCount, completedCount, avgGrade, lastAccess };
    });
  }, [allUsers, allEnrollments, coursesMap, sectionsMap, certsMap]);

  // ─── Filtered list ─────────────────────────────────────────────────────────

  const filteredStudents = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return studentsWithStats.filter(s => {
      const matchesSearch = !q || s.user.name.toLowerCase().includes(q) || s.user.email.toLowerCase().includes(q);
      const matchesCourse = courseFilter === 'all' || s.enrollments.some(e => e.courseId === courseFilter);
      const matchesFilter = (() => {
        switch (studentFilter) {
          case 'active': return s.activeCount > 0;
          case 'completed': return s.completedCount > 0;
          case 'with_cert': return s.certificates.length > 0;
          case 'no_enrollment': return s.enrollments.length === 0;
          default: return true;
        }
      })();
      return matchesSearch && matchesCourse && matchesFilter;
    });
  }, [studentsWithStats, searchTerm, courseFilter, studentFilter]);

  // ─── Selection ─────────────────────────────────────────────────────────────

  const filteredIds = useMemo(() => new Set(filteredStudents.map(s => s.user.id)), [filteredStudents]);
  const visibleSelected = useMemo(() => new Set([...selectedIds].filter(id => filteredIds.has(id))), [selectedIds, filteredIds]);
  const allVisibleSelected = filteredStudents.length > 0 && visibleSelected.size === filteredStudents.length;

  const toggleOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allVisibleSelected) {
      // Deselect all visible
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredStudents.forEach(s => next.delete(s.user.id));
        return next;
      });
    } else {
      // Select all visible
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredStudents.forEach(s => next.add(s.user.id));
        return next;
      });
    }
  };

  // ─── KPIs ──────────────────────────────────────────────────────────────────

  const kpis = useMemo(() => ({
    totalStudents: allUsers.length,
    activeEnrollments: allEnrollments.filter(e => e.status === 'active').length,
    completed: allEnrollments.filter(e => e.status === 'completed').length,
    certificates: allCertificates.length,
  }), [allUsers, allEnrollments, allCertificates]);

  // ─── Mutation callbacks ────────────────────────────────────────────────────

  const handleEnrollmentCancelled = (enrollmentId: string) => {
    setAllEnrollments(prev => prev.map(e => e.id === enrollmentId ? { ...e, status: 'cancelled', updatedAt: Date.now() } : e));
    if (detailStudent) {
      setDetailStudent(prev => {
        if (!prev) return null;
        return { ...prev, enrollments: prev.enrollments.map(e => e.id === enrollmentId ? { ...e, status: 'cancelled', updatedAt: Date.now() } : e), activeCount: prev.enrollments.filter(e => e.id !== enrollmentId && e.status === 'active').length };
      });
    }
  };

  const handleEnrollmentCreated = (enrollment: DBEnrollment) => {
    setAllEnrollments(prev => [...prev, enrollment]);
    if (detailStudent && enrollment.userId === detailStudent.user.id) {
      const course = coursesMap.get(enrollment.courseId);
      const section = enrollment.sectionId ? sectionsMap.get(enrollment.sectionId) : undefined;
      setDetailStudent(prev => {
        if (!prev) return null;
        const updated = [...prev.enrollments, { ...enrollment, course, section }];
        return { ...prev, enrollments: updated, activeCount: updated.filter(e => e.status === 'active').length };
      });
    }
  };

  const handleBulkEnrolled = (enrollments: DBEnrollment[]) => {
    setAllEnrollments(prev => [...prev, ...enrollments]);
    setSelectedIds(new Set());
  };

  const handleCertificateIssued = (cert: DBCertificate, enrollmentId: string) => {
    setAllCertificates(prev => [...prev, cert]);
    setAllEnrollments(prev => prev.map(e => e.id === enrollmentId ? { ...e, certificateId: cert.id } : e));
    if (detailStudent && cert.userId === detailStudent.user.id) {
      setDetailStudent(prev => {
        if (!prev) return null;
        return { ...prev, certificates: [...prev.certificates, cert], enrollments: prev.enrollments.map(e => e.id === enrollmentId ? { ...e, certificateId: cert.id } : e) };
      });
    }
  };

  // Courses for course filter dropdown
  const coursesWithEnrollments = useMemo(() => {
    const ids = new Set(allEnrollments.map(e => e.courseId));
    return allCourses.filter(c => ids.has(c.id));
  }, [allCourses, allEnrollments]);

  const selectedStudentObjects = useMemo(
    () => allUsers.filter(u => selectedIds.has(u.id)),
    [allUsers, selectedIds]
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total estudiantes" value={kpis.totalStudents} icon={Users} />
        <KpiCard label="Inscripciones activas" value={kpis.activeEnrollments} icon={BookOpen} />
        <KpiCard label="Completados" value={kpis.completed} icon={CheckCircle} />
        <KpiCard label="Certificados emitidos" value={kpis.certificates} icon={Award} />
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-gray-200 rounded-xl px-3 py-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative min-w-[200px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre o email…"
              className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-8 pr-7 py-1.5 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Course filter */}
          {coursesWithEnrollments.length > 1 && (
            <select
              value={courseFilter}
              onChange={e => setCourseFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
            >
              <option value="all">Todos los cursos</option>
              {coursesWithEnrollments.map(c => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          )}

          {/* Filter chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {FILTER_CHIPS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setStudentFilter(key)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  studentFilter === key
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-red-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Bulk action */}
          {!isSupervisor && (
            <div className="ml-auto">
              <Button
                size="sm"
                onClick={() => setShowBulkModal(true)}
                disabled={selectedIds.size === 0}
                className="bg-red-600 hover:bg-red-700 text-white text-xs border-0 disabled:opacity-40"
              >
                <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                Inscribir{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Student list with checkboxes */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {filteredStudents.length === 0 ? (
          <div className="text-center py-16 px-4">
            <Users className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-gray-900 mb-1">
              {searchTerm || studentFilter !== 'all' ? 'Sin resultados' : 'Sin estudiantes'}
            </h3>
            <p className="text-sm text-gray-500">
              {searchTerm || studentFilter !== 'all'
                ? 'Prueba con otro término o cambia los filtros.'
                : 'Los estudiantes aparecerán aquí cuando se creen en el sistema.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {!isSupervisor && (
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleAll}
                        className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                      />
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Estudiante</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Inscripciones</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Promedio</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Último acceso</th>
                  <th className="px-4 py-3 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredStudents.map(s => {
                  const checked = selectedIds.has(s.user.id);
                  return (
                    <tr key={s.user.id} className={`transition-colors ${checked ? 'bg-red-50/40' : 'hover:bg-gray-50'}`}>
                      {!isSupervisor && (
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleOne(s.user.id)}
                            className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                          />
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-red-50 rounded-full flex items-center justify-center shrink-0">
                            <span className="text-sm font-semibold text-red-600">{avatar(s.user.name)}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate">{s.user.name}</p>
                            <p className="text-xs text-gray-500 truncate">{s.user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {s.activeCount > 0 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-red-50 text-red-700 border-red-100">
                              {s.activeCount} activa{s.activeCount !== 1 ? 's' : ''}
                            </span>
                          )}
                          {s.completedCount > 0 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-gray-100 text-gray-700 border-gray-200">
                              {s.completedCount} completa{s.completedCount !== 1 ? 's' : ''}
                            </span>
                          )}
                          {s.enrollments.length === 0 && (
                            <span className="text-xs text-gray-400">Sin inscripciones</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-gray-700">
                        {s.avgGrade != null ? `${s.avgGrade}%` : '\u2014'}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-500 whitespace-nowrap">
                        {relativeDate(s.lastAccess)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setDetailStudent(s)}
                          className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-red-600 border border-gray-200 hover:border-red-300 rounded-lg px-2 py-1 transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Ver</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Student detail modal */}
      <StudentDetailModal
        open={detailStudent !== null}
        student={detailStudent}
        onClose={() => setDetailStudent(null)}
        allSections={allSections}
        allCourses={allCourses}
        currentUserId={user?.id ?? ''}
        isTeacher={isTeacher}
        onEnrollmentCancelled={handleEnrollmentCancelled}
        onEnrollmentCreated={handleEnrollmentCreated}
        onCertificateIssued={handleCertificateIssued}
      />

      {/* Bulk enroll modal */}
      <BulkEnrollModal
        open={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        selectedStudents={selectedStudentObjects}
        allSections={allSections}
        allEnrollments={allEnrollments}
        onEnrolled={handleBulkEnrolled}
      />
    </div>
  );
}
