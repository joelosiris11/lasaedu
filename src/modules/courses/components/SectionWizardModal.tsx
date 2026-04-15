import { useRef, useState, useEffect } from 'react';
import { useAuthStore } from '@app/store/authStore';
import {
  courseService,
  sectionService,
  moduleService,
  lessonService,
  type DBCourse,
  type DBLesson,
  type DBSection,
  type DBSectionLessonOverride,
} from '@shared/services/dataService';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Settings,
  Calendar,
  Globe,
  Lock,
  ShieldCheck,
  Copy,
  Loader2,
  Image as ImageIcon,
} from 'lucide-react';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { Label } from '@shared/components/ui/Label';
import { CoursePattern } from '@shared/components/ui/CoursePattern';
import { Modal } from '@shared/components/ui/Modal';
import { fileUploadService } from '@shared/services/fileUploadService';

const STEPS = [
  { id: 1, title: 'Información Básica', icon: Settings },
  { id: 2, title: 'Fechas de Entregas', icon: Calendar },
];

interface SectionFormData {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  accessType: 'publico' | 'privado' | 'restringido';
  accessCode: string;
  enrollmentLimit: string;
  bannerMode: 'course' | 'custom';
  bannerImage: string;
}

interface LessonDateRow {
  lessonId: string;
  lessonTitle: string;
  lessonType: string;
  moduleName: string;
  availableFrom: string;
  dueDate: string;
  lateSubmissionDeadline: string;
  timeLimit: string;
  existingOverrideId?: string;
}

interface SectionWizardModalProps {
  open: boolean;
  onClose: () => void;
  /** Called after a successful save/create. */
  onSaved?: () => void;
  /** Required for create mode. */
  courseId?: string;
  /** Required for edit mode. */
  sectionId?: string;
}

const EMPTY_FORM: SectionFormData = {
  title: '',
  description: '',
  startDate: '',
  endDate: '',
  accessType: 'publico',
  accessCode: '',
  enrollmentLimit: '',
  bannerMode: 'course',
  bannerImage: '',
};

export default function SectionWizardModal({
  open,
  onClose,
  onSaved,
  courseId,
  sectionId,
}: SectionWizardModalProps) {
  const { user } = useAuthStore();
  const isEditing = !!sectionId;

  const [course, setCourse] = useState<DBCourse | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<SectionFormData>(EMPTY_FORM);
  const [titleAutoSet, setTitleAutoSet] = useState(true);
  const [dateRows, setDateRows] = useState<LessonDateRow[]>([]);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setCurrentStep(1);
    setSaving(false);
    setLoading(true);
    setErrors({});
    setFormData(EMPTY_FORM);
    setTitleAutoSet(true);
    setDateRows([]);
    setBannerError(null);
    setCourse(null);
  };

  const handleClose = () => {
    if (saving) return;
    reset();
    onClose();
  };

  const generateTitle = (dateStr: string, c: DBCourse | null = course) => {
    if (!c || !dateStr) return '';
    const d = new Date(dateStr);
    return `${c.title} - ${d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`;
  };

  const handleStartDateChange = (value: string) => {
    setFormData(prev => {
      const next = { ...prev, startDate: value };
      if (titleAutoSet) next.title = generateTitle(value);
      return next;
    });
  };

  const handleTitleChange = (value: string) => {
    setTitleAutoSet(false);
    setFormData(prev => ({ ...prev, title: value }));
  };

  const handleBannerFile = async (file: File | undefined | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setBannerError('El archivo debe ser una imagen');
      return;
    }
    setBannerError(null);
    setBannerUploading(true);
    try {
      const result = await fileUploadService.uploadImage(file, courseId);
      setFormData(prev => ({ ...prev, bannerImage: result.url, bannerMode: 'custom' }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al subir la imagen';
      setBannerError(msg);
    } finally {
      setBannerUploading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    if (!courseId && !sectionId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        let resolvedCourseId = courseId;
        if (!resolvedCourseId && isEditing && sectionId) {
          const sec = await sectionService.getById(sectionId);
          if (sec) resolvedCourseId = sec.courseId;
        }
        if (!resolvedCourseId) {
          if (!cancelled) setLoading(false);
          return;
        }

        const [c, mods] = await Promise.all([
          courseService.getById(resolvedCourseId),
          moduleService.getByCourse(resolvedCourseId),
        ]);
        if (cancelled) return;
        setCourse(c);

        const allLessons: (DBLesson & { moduleName: string })[] = [];
        for (const mod of mods.sort((a, b) => a.order - b.order)) {
          const lessons = await lessonService.getByModule(mod.id);
          for (const lesson of lessons.sort((a, b) => a.order - b.order)) {
            if (lesson.type === 'quiz' || lesson.type === 'tarea') {
              allLessons.push({ ...lesson, moduleName: mod.title });
            }
          }
        }

        let existingOverrides: DBSectionLessonOverride[] = [];
        if (isEditing && sectionId) {
          const section = await sectionService.getById(sectionId);
          if (section && !cancelled) {
            setTitleAutoSet(false);
            setFormData({
              title: section.title,
              description: section.description || '',
              startDate: new Date(section.startDate).toISOString().slice(0, 16),
              endDate: new Date(section.endDate).toISOString().slice(0, 16),
              accessType: section.accessType,
              accessCode: section.accessCode || '',
              enrollmentLimit: section.enrollmentLimit?.toString() || '',
              bannerMode: section.image ? 'custom' : 'course',
              bannerImage: section.image || '',
            });
          }
          existingOverrides = await sectionService.getLessonOverrides(sectionId);
        }

        const rows: LessonDateRow[] = allLessons.map(lesson => {
          const override = existingOverrides.find(o => o.lessonId === lesson.id);
          const settings = lesson.settings || {};
          return {
            lessonId: lesson.id,
            lessonTitle: lesson.title,
            lessonType: lesson.type,
            moduleName: lesson.moduleName,
            availableFrom: override?.availableFrom || settings.availableFrom || '',
            dueDate: override?.dueDate || settings.dueDate || '',
            lateSubmissionDeadline:
              override?.lateSubmissionDeadline || settings.lateSubmissionDeadline || '',
            timeLimit: settings.timeLimit?.toString() || '',
            existingOverrideId: override?.id,
          };
        });
        if (!cancelled) setDateRows(rows);
      } catch (err) {
        console.error('Error loading section data:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [open, courseId, sectionId, isEditing]);

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};
    if (step === 1) {
      if (!formData.startDate) newErrors.startDate = 'La fecha de inicio es obligatoria';
      if (!formData.endDate) newErrors.endDate = 'La fecha de fin es obligatoria';
      if (
        formData.startDate &&
        formData.endDate &&
        formData.startDate >= formData.endDate
      ) {
        newErrors.endDate = 'La fecha de fin debe ser posterior al inicio';
      }
      if (formData.accessType === 'privado' && !formData.accessCode.trim()) {
        newErrors.accessCode = 'El código es obligatorio para secciones privadas';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) setCurrentStep(2);
  };

  const generateAccessCode = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setFormData(prev => ({ ...prev, accessCode: code }));
  };

  const updateDateRow = (index: number, field: keyof LessonDateRow, value: string) => {
    setDateRows(prev =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const updated = { ...row, [field]: value };
        if (row.lessonType === 'tarea') {
          if (field === 'dueDate' && value) {
            if (
              !row.lateSubmissionDeadline ||
              new Date(row.lateSubmissionDeadline).getTime() <= new Date(row.dueDate).getTime()
            ) {
              updated.lateSubmissionDeadline = value;
            }
          }
          if (
            field === 'lateSubmissionDeadline' &&
            updated.dueDate &&
            new Date(value).getTime() < new Date(updated.dueDate).getTime()
          ) {
            updated.lateSubmissionDeadline = updated.dueDate;
          }
        }
        return updated;
      })
    );
  };

  const handleSubmit = async () => {
    if (!course || !user) return;
    const effectiveCourseId = courseId || course.id;
    setSaving(true);

    try {
      const now = Date.now();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sectionData: Record<string, any> = {
        courseId: effectiveCourseId,
        title: formData.title.trim() || generateTitle(formData.startDate),
        instructorId: user.id,
        instructorName: user.name,
        startDate: new Date(formData.startDate).getTime(),
        endDate: new Date(formData.endDate).getTime(),
        accessType: formData.accessType,
        courseTitle: course.title,
        courseCategory: course.category,
        courseLevel: course.level,
        studentsCount: 0,
        status: 'activa',
        createdAt: now,
        updatedAt: now,
      };
      if (formData.description) sectionData.description = formData.description;
      if (formData.accessType === 'privado' && formData.accessCode)
        sectionData.accessCode = formData.accessCode;
      if (formData.enrollmentLimit)
        sectionData.enrollmentLimit = parseInt(formData.enrollmentLimit);
      if (course.image) sectionData.courseImage = course.image;

      if (formData.bannerMode === 'custom' && formData.bannerImage) {
        sectionData.image = formData.bannerImage;
      } else {
        sectionData.image = null;
      }

      let savedSectionId: string;
      if (isEditing && sectionId) {
        await sectionService.update(sectionId, sectionData as Partial<DBSection>);
        savedSectionId = sectionId;
      } else {
        const newSection = await sectionService.create(sectionData as unknown as Omit<DBSection, 'id'>);
        savedSectionId = newSection.id;
        await courseService.update(effectiveCourseId, {
          sectionsCount: (course.sectionsCount || 0) + 1,
        } as Partial<DBCourse>);
      }

      const overrides = dateRows
        .filter(row => row.availableFrom || row.dueDate || row.lateSubmissionDeadline)
        .map(row => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const o: Record<string, any> = {
            sectionId: savedSectionId,
            lessonId: row.lessonId,
            courseId: effectiveCourseId,
            createdAt: now,
            updatedAt: now,
          };
          if (row.existingOverrideId) o.id = row.existingOverrideId;
          if (row.availableFrom) o.availableFrom = row.availableFrom;
          if (row.dueDate) o.dueDate = row.dueDate;
          if (row.lateSubmissionDeadline) o.lateSubmissionDeadline = row.lateSubmissionDeadline;
          return o;
        });

      if (overrides.length > 0) {
        await sectionService.saveLessonOverrides(
          savedSectionId,
          overrides as unknown as (Omit<DBSectionLessonOverride, 'id'> & { id?: string })[]
        );
      }

      onSaved?.();
      reset();
      onClose();
    } catch (err) {
      console.error('Error saving section:', err);
      setErrors({ submit: 'Error al guardar la sección' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      disableBackdropClose={saving}
      size="5xl"
      title={isEditing ? 'Editar sección' : 'Nueva sección'}
      subtitle={course ? course.title : undefined}
      footer={
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            onClick={currentStep === 1 ? handleClose : () => setCurrentStep(1)}
            disabled={saving}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {currentStep === 1 ? 'Cancelar' : 'Anterior'}
          </Button>
          {currentStep === 1 ? (
            <Button onClick={handleNext} disabled={loading}>
              Siguiente
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  {isEditing ? 'Guardar cambios' : 'Crear sección'}
                </>
              )}
            </Button>
          )}
        </div>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-6 sm:gap-10 mb-6">
            {STEPS.map(step => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;
              return (
                <div key={step.id} className="flex items-center gap-2">
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors ${
                      isActive || isCompleted
                        ? 'border-red-600 bg-red-600 text-white'
                        : 'border-gray-300 bg-white text-gray-500'
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>
                  <span
                    className={`text-sm font-medium hidden sm:inline ${
                      isActive ? 'text-gray-900' : 'text-gray-500'
                    }`}
                  >
                    {step.title}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Step 1: Basic Info */}
          {currentStep === 1 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="sw-start">Fecha de inicio *</Label>
                  <Input
                    id="sw-start"
                    type="datetime-local"
                    value={formData.startDate}
                    onChange={e => handleStartDateChange(e.target.value)}
                  />
                  {errors.startDate && (
                    <p className="text-xs text-red-600 mt-1">{errors.startDate}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="sw-end">Fecha de fin *</Label>
                  <Input
                    id="sw-end"
                    type="date"
                    value={formData.endDate ? formData.endDate.slice(0, 10) : ''}
                    onChange={e => {
                      const date = e.target.value;
                      if (date) {
                        setFormData(prev => ({ ...prev, endDate: `${date}T23:59` }));
                      }
                    }}
                  />
                  {errors.endDate && (
                    <p className="text-xs text-red-600 mt-1">{errors.endDate}</p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="sw-title">Título</Label>
                <Input
                  id="sw-title"
                  value={formData.title}
                  onChange={e => handleTitleChange(e.target.value)}
                  placeholder={
                    formData.startDate ? '' : 'Selecciona una fecha de inicio primero'
                  }
                  disabled={!formData.startDate}
                />
              </div>

              <div>
                <Label htmlFor="sw-desc">Descripción (opcional)</Label>
                <textarea
                  id="sw-desc"
                  value={formData.description}
                  onChange={e =>
                    setFormData(prev => ({ ...prev, description: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  rows={3}
                  placeholder="Descripción para los estudiantes de esta sección"
                />
              </div>

              {/* Banner */}
              <div>
                <Label>Banner de la sección</Label>
                <div className="grid grid-cols-2 gap-3 mt-1">
                  <button
                    type="button"
                    onClick={() =>
                      setFormData(prev => ({ ...prev, bannerMode: 'course' }))
                    }
                    className={`relative rounded-lg border-2 overflow-hidden text-left transition-all ${
                      formData.bannerMode === 'course'
                        ? 'border-red-500 ring-2 ring-red-200'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="relative h-24 overflow-hidden">
                      {course?.image ? (
                        <img
                          src={course.image}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : course ? (
                        <CoursePattern
                          courseKey={course.id}
                          className="absolute inset-0 w-full h-full"
                        />
                      ) : null}
                    </div>
                    <div className="p-2 bg-white">
                      <p className="text-xs font-semibold text-gray-800">Usar el del curso</p>
                      <p className="text-[11px] text-gray-500">
                        Se actualiza si cambias el del curso.
                      </p>
                    </div>
                    {formData.bannerMode === 'course' && (
                      <span className="absolute top-1.5 right-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-600 text-white shadow">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, bannerMode: 'custom' }));
                      if (!formData.bannerImage) bannerInputRef.current?.click();
                    }}
                    className={`relative rounded-lg border-2 overflow-hidden text-left transition-all ${
                      formData.bannerMode === 'custom'
                        ? 'border-red-500 ring-2 ring-red-200'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="relative h-24 overflow-hidden bg-gray-50 flex items-center justify-center">
                      {formData.bannerImage ? (
                        <img
                          src={formData.bannerImage}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center text-gray-400">
                          <ImageIcon className="h-6 w-6 mb-1" />
                          <span className="text-[11px]">Subir imagen</span>
                        </div>
                      )}
                    </div>
                    <div className="p-2 bg-white">
                      <p className="text-xs font-semibold text-gray-800">Personalizar</p>
                      <p className="text-[11px] text-gray-500">
                        Banner exclusivo de esta sección.
                      </p>
                    </div>
                    {formData.bannerMode === 'custom' && (
                      <span className="absolute top-1.5 right-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-600 text-white shadow">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                    )}
                  </button>
                </div>

                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => handleBannerFile(e.target.files?.[0])}
                />

                {formData.bannerMode === 'custom' && (
                  <div className="flex items-center gap-2 mt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => bannerInputRef.current?.click()}
                      disabled={bannerUploading}
                    >
                      <ImageIcon className="h-3.5 w-3.5 mr-1.5" />
                      {bannerUploading
                        ? 'Subiendo...'
                        : formData.bannerImage
                          ? 'Cambiar imagen'
                          : 'Seleccionar imagen'}
                    </Button>
                    {formData.bannerImage && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setFormData(prev => ({ ...prev, bannerImage: '' }))
                        }
                        className="text-red-600 hover:text-red-800"
                      >
                        Quitar
                      </Button>
                    )}
                  </div>
                )}

                {bannerError && <p className="text-xs text-red-600 mt-1">{bannerError}</p>}
              </div>

              <div>
                <Label>Tipo de acceso</Label>
                <div className="grid grid-cols-3 gap-3 mt-1">
                  {(['publico', 'privado', 'restringido'] as const).map(type => {
                    const icons = { publico: Globe, privado: Lock, restringido: ShieldCheck };
                    const labels = {
                      publico: 'Público',
                      privado: 'Privado',
                      restringido: 'Restringido',
                    };
                    const descs = {
                      publico: 'Cualquiera puede inscribirse',
                      privado: 'Requiere código de acceso',
                      restringido: 'Requiere aprobación',
                    };
                    const Icon = icons[type];
                    const isSelected = formData.accessType === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() =>
                          setFormData(prev => ({ ...prev, accessType: type }))
                        }
                        className={`p-3 border-2 rounded-lg text-left transition-colors ${
                          isSelected
                            ? 'border-red-600 bg-red-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Icon
                          className={`h-5 w-5 mb-1 ${isSelected ? 'text-red-600' : 'text-gray-400'}`}
                        />
                        <p className="text-sm font-medium">{labels[type]}</p>
                        <p className="text-xs text-gray-500">{descs[type]}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {formData.accessType === 'privado' && (
                <div>
                  <Label htmlFor="sw-code">Código de acceso *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="sw-code"
                      value={formData.accessCode}
                      onChange={e =>
                        setFormData(prev => ({ ...prev, accessCode: e.target.value }))
                      }
                      placeholder="ABCD12"
                    />
                    <Button type="button" variant="outline" onClick={generateAccessCode}>
                      <Copy className="h-4 w-4 mr-1" />
                      Generar
                    </Button>
                  </div>
                  {errors.accessCode && (
                    <p className="text-xs text-red-600 mt-1">{errors.accessCode}</p>
                  )}
                </div>
              )}

              <div>
                <Label htmlFor="sw-limit">Límite de inscripciones (opcional)</Label>
                <Input
                  id="sw-limit"
                  type="number"
                  min="1"
                  value={formData.enrollmentLimit}
                  onChange={e =>
                    setFormData(prev => ({ ...prev, enrollmentLimit: e.target.value }))
                  }
                  placeholder="Sin límite"
                />
              </div>

              {errors.submit && (
                <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                  {errors.submit}
                </p>
              )}
            </div>
          )}

          {/* Step 2: Dates */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <p className="text-sm text-gray-500">
                Configura fechas de apertura y cierre para cada tarea y quiz. Los campos
                vacíos heredarán las fechas del template del curso.
              </p>

              {dateRows.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <Calendar className="h-10 w-10 text-gray-300 mx-auto" />
                  <p className="text-gray-500">
                    Este curso no tiene lecciones tipo quiz o tarea todavía.
                  </p>
                  <p className="text-sm text-gray-400">
                    Puedes crear la sección ahora y configurar las fechas después cuando
                    agregues lecciones evaluables.
                  </p>
                </div>
              ) : (
                <>
                  {dateRows.some(r => r.lessonType === 'quiz') && (
                    <div>
                      <h3 className="text-sm font-semibold text-purple-700 mb-3 flex items-center gap-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-purple-100 text-purple-700 text-xs">
                          Quiz
                        </span>
                        Quizzes ({dateRows.filter(r => r.lessonType === 'quiz').length})
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left">
                              <th className="pb-3 pr-3 font-medium text-gray-700 min-w-[180px]">
                                Lección
                              </th>
                              <th className="pb-3 pr-3 font-medium text-gray-700 min-w-[120px]">
                                Módulo
                              </th>
                              <th className="pb-3 pr-3 font-medium text-gray-700 min-w-[180px]">
                                Abre
                              </th>
                              <th className="pb-3 pr-3 font-medium text-gray-700 min-w-[180px]">
                                Due Date
                              </th>
                              <th className="pb-3 font-medium text-gray-700 min-w-[100px]">
                                Tiempo (min)
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {dateRows.map((row, idx) => {
                              if (row.lessonType !== 'quiz') return null;
                              return (
                                <tr key={row.lessonId} className="border-b last:border-b-0">
                                  <td className="py-2 pr-3">
                                    <span className="font-medium text-gray-900">
                                      {row.lessonTitle}
                                    </span>
                                  </td>
                                  <td className="py-2 pr-3 text-gray-500 text-xs">
                                    {row.moduleName}
                                  </td>
                                  <td className="py-2 pr-3">
                                    <input
                                      type="datetime-local"
                                      value={row.availableFrom}
                                      onChange={e =>
                                        updateDateRow(idx, 'availableFrom', e.target.value)
                                      }
                                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                    />
                                  </td>
                                  <td className="py-2 pr-3">
                                    <input
                                      type="datetime-local"
                                      value={row.dueDate}
                                      onChange={e =>
                                        updateDateRow(idx, 'dueDate', e.target.value)
                                      }
                                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                    />
                                  </td>
                                  <td className="py-2">
                                    <input
                                      type="number"
                                      min="1"
                                      value={row.timeLimit}
                                      onChange={e =>
                                        updateDateRow(idx, 'timeLimit', e.target.value)
                                      }
                                      placeholder="Sin límite"
                                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {dateRows.some(r => r.lessonType === 'tarea') && (
                    <div>
                      <h3 className="text-sm font-semibold text-orange-700 mb-3 flex items-center gap-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-orange-100 text-orange-700 text-xs">
                          Tarea
                        </span>
                        Tareas ({dateRows.filter(r => r.lessonType === 'tarea').length})
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left">
                              <th className="pb-3 pr-3 font-medium text-gray-700 min-w-[180px]">
                                Lección
                              </th>
                              <th className="pb-3 pr-3 font-medium text-gray-700 min-w-[120px]">
                                Módulo
                              </th>
                              <th className="pb-3 pr-3 font-medium text-gray-700 min-w-[180px]">
                                Abre
                              </th>
                              <th className="pb-3 pr-3 font-medium text-gray-700 min-w-[180px]">
                                Due Date
                              </th>
                              <th className="pb-3 font-medium text-gray-700 min-w-[180px]">
                                Cut-off
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {dateRows.map((row, idx) => {
                              if (row.lessonType !== 'tarea') return null;
                              return (
                                <tr key={row.lessonId} className="border-b last:border-b-0">
                                  <td className="py-2 pr-3">
                                    <span className="font-medium text-gray-900">
                                      {row.lessonTitle}
                                    </span>
                                  </td>
                                  <td className="py-2 pr-3 text-gray-500 text-xs">
                                    {row.moduleName}
                                  </td>
                                  <td className="py-2 pr-3">
                                    <input
                                      type="datetime-local"
                                      value={row.availableFrom}
                                      onChange={e =>
                                        updateDateRow(idx, 'availableFrom', e.target.value)
                                      }
                                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                    />
                                  </td>
                                  <td className="py-2 pr-3">
                                    <input
                                      type="datetime-local"
                                      value={row.dueDate}
                                      onChange={e =>
                                        updateDateRow(idx, 'dueDate', e.target.value)
                                      }
                                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                    />
                                  </td>
                                  <td className="py-2">
                                    <input
                                      type="datetime-local"
                                      value={row.lateSubmissionDeadline}
                                      min={row.dueDate || undefined}
                                      onChange={e =>
                                        updateDateRow(
                                          idx,
                                          'lateSubmissionDeadline',
                                          e.target.value
                                        )
                                      }
                                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
