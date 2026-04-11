import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@app/store/authStore';
import {
  courseService,
  sectionService,
  moduleService,
  lessonService,
  type DBCourse,
  type DBSection,
  type DBModule,
  type DBLesson,
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
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { Label } from '@shared/components/ui/Label';

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
}

interface LessonDateRow {
  lessonId: string;
  lessonTitle: string;
  lessonType: string;
  moduleName: string;
  availableFrom: string;
  dueDate: string;
  lateSubmissionDeadline: string;
  timeLimit: string; // minutes, quiz only
  existingOverrideId?: string;
}

export default function SectionWizardPage() {
  const { courseId, sectionId } = useParams<{ courseId: string; sectionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isEditing = !!sectionId;

  const [course, setCourse] = useState<DBCourse | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<SectionFormData>({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    accessType: 'publico',
    accessCode: '',
    enrollmentLimit: '',
  });
  const [titleAutoSet, setTitleAutoSet] = useState(true);

  const generateTitle = (dateStr: string) => {
    if (!course || !dateStr) return '';
    const d = new Date(dateStr);
    return `${course.title} - ${d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`;
  };

  const handleStartDateChange = (value: string) => {
    setFormData(prev => {
      const next = { ...prev, startDate: value };
      if (titleAutoSet) {
        next.title = generateTitle(value);
      }
      return next;
    });
  };

  const handleTitleChange = (value: string) => {
    setTitleAutoSet(false);
    setFormData(prev => ({ ...prev, title: value }));
  };

  const [dateRows, setDateRows] = useState<LessonDateRow[]>([]);

  // Load course, modules, lessons + section data if editing
  useEffect(() => {
    if (!courseId && !sectionId) return;
    const load = async () => {
      setLoading(true);
      try {
        // Resolve courseId: from URL param or from the section being edited
        let resolvedCourseId = courseId;
        if (!resolvedCourseId && isEditing && sectionId) {
          const sec = await sectionService.getById(sectionId);
          if (sec) resolvedCourseId = sec.courseId;
        }
        if (!resolvedCourseId) { setLoading(false); return; }

        const [c, mods] = await Promise.all([
          courseService.getById(resolvedCourseId),
          moduleService.getByCourse(resolvedCourseId),
        ]);
        setCourse(c);

        // Load all lessons and build date rows for quiz/tarea types
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
          if (section) {
            setTitleAutoSet(false);
            setFormData({
              title: section.title,
              description: section.description || '',
              startDate: new Date(section.startDate).toISOString().slice(0, 16),
              endDate: new Date(section.endDate).toISOString().slice(0, 16),
              accessType: section.accessType,
              accessCode: section.accessCode || '',
              enrollmentLimit: section.enrollmentLimit?.toString() || '',
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
            lateSubmissionDeadline: override?.lateSubmissionDeadline || settings.lateSubmissionDeadline || '',
            timeLimit: settings.timeLimit?.toString() || '',
            existingOverrideId: override?.id,
          };
        });
        setDateRows(rows);
      } catch (err) {
        console.error('Error loading section data:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [courseId, sectionId, isEditing]);

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};
    if (step === 1) {
      if (!formData.startDate) newErrors.startDate = 'La fecha de inicio es obligatoria';
      if (!formData.endDate) newErrors.endDate = 'La fecha de fin es obligatoria';
      if (formData.startDate && formData.endDate && formData.startDate >= formData.endDate) {
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
    if (validateStep(currentStep)) {
      setCurrentStep(2);
    }
  };

  const generateAccessCode = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setFormData(prev => ({ ...prev, accessCode: code }));
  };

  const updateDateRow = (index: number, field: keyof LessonDateRow, value: string) => {
    setDateRows(prev => prev.map((row, i) => {
      if (i !== index) return row;
      const updated = { ...row, [field]: value };
      if (row.lessonType === 'tarea') {
        // Auto-set cut-off when dueDate changes
        if (field === 'dueDate' && value) {
          if (!row.lateSubmissionDeadline || new Date(row.lateSubmissionDeadline).getTime() <= new Date(row.dueDate).getTime()) {
            updated.lateSubmissionDeadline = value;
          }
        }
        // Never allow cut-off before dueDate
        if (field === 'lateSubmissionDeadline' && updated.dueDate && new Date(value).getTime() < new Date(updated.dueDate).getTime()) {
          updated.lateSubmissionDeadline = updated.dueDate;
        }
      }
      return updated;
    }));
  };

  const handleSubmit = async () => {
    if (!course || !user) return;
    const effectiveCourseId = courseId || course.id;
    setSaving(true);

    try {
      const now = Date.now();
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
      if (formData.accessType === 'privado' && formData.accessCode) sectionData.accessCode = formData.accessCode;
      if (formData.enrollmentLimit) sectionData.enrollmentLimit = parseInt(formData.enrollmentLimit);
      if (course.image) sectionData.courseImage = course.image;

      let savedSectionId: string;
      if (isEditing && sectionId) {
        await sectionService.update(sectionId, sectionData);
        savedSectionId = sectionId;
      } else {
        const newSection = await sectionService.create(sectionData);
        savedSectionId = newSection.id;
        // Increment course sectionsCount
        await courseService.update(effectiveCourseId, {
          sectionsCount: (course.sectionsCount || 0) + 1,
        } as any);
      }

      // Save date overrides
      const overrides = dateRows
        .filter(row => row.availableFrom || row.dueDate || row.lateSubmissionDeadline)
        .map(row => {
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
        await sectionService.saveLessonOverrides(savedSectionId, overrides as any);
      }

      navigate('/my-sections');
    } catch (err) {
      console.error('Error saving section:', err);
      setErrors({ submit: 'Error al guardar la sección' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Button variant="ghost" onClick={() => navigate('/my-sections')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {isEditing ? 'Editar Sección' : 'Nueva Sección'}
          </h1>
          {course && <p className="text-sm text-gray-500">{course.title}</p>}
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-8">
        {STEPS.map((step) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;
          const isCompleted = currentStep > step.id;
          return (
            <div key={step.id} className="flex items-center gap-2">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors ${
                  isActive
                    ? 'border-red-600 bg-red-600 text-white'
                    : isCompleted
                      ? 'border-red-600 bg-red-600 text-white'
                      : 'border-gray-300 bg-white text-gray-500'
                }`}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <span className={`text-sm font-medium ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                {step.title}
              </span>
            </div>
          );
        })}
      </div>

      {/* Step 1: Basic Info */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Información de la Sección</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startDate">Fecha de inicio *</Label>
                <Input
                  id="startDate"
                  type="datetime-local"
                  value={formData.startDate}
                  onChange={e => handleStartDateChange(e.target.value)}
                />
                {errors.startDate && <p className="text-sm text-red-600 mt-1">{errors.startDate}</p>}
              </div>
              <div>
                <Label htmlFor="endDate">Fecha de fin *</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate ? formData.endDate.slice(0, 10) : ''}
                  onChange={e => {
                    const date = e.target.value;
                    if (date) {
                      setFormData(prev => ({ ...prev, endDate: `${date}T23:59` }));
                    }
                  }}
                />
                {errors.endDate && <p className="text-sm text-red-600 mt-1">{errors.endDate}</p>}
              </div>
            </div>

            <div>
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={e => handleTitleChange(e.target.value)}
                placeholder={formData.startDate ? '' : 'Selecciona una fecha de inicio primero'}
                disabled={!formData.startDate}
              />
            </div>

            <div>
              <Label htmlFor="description">Descripción (opcional)</Label>
              <textarea
                id="description"
                value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                rows={3}
                placeholder="Descripción para los estudiantes de esta sección"
              />
            </div>

            <div>
              <Label>Tipo de acceso</Label>
              <div className="grid grid-cols-3 gap-3 mt-1">
                {(['publico', 'privado', 'restringido'] as const).map(type => {
                  const icons = { publico: Globe, privado: Lock, restringido: ShieldCheck };
                  const labels = { publico: 'Público', privado: 'Privado', restringido: 'Restringido' };
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
                      onClick={() => setFormData(prev => ({ ...prev, accessType: type }))}
                      className={`p-3 border-2 rounded-lg text-left transition-colors ${
                        isSelected ? 'border-red-600 bg-red-50' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Icon className={`h-5 w-5 mb-1 ${isSelected ? 'text-red-600' : 'text-gray-400'}`} />
                      <p className="text-sm font-medium">{labels[type]}</p>
                      <p className="text-xs text-gray-500">{descs[type]}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {formData.accessType === 'privado' && (
              <div>
                <Label htmlFor="accessCode">Código de acceso *</Label>
                <div className="flex gap-2">
                  <Input
                    id="accessCode"
                    value={formData.accessCode}
                    onChange={e => setFormData(prev => ({ ...prev, accessCode: e.target.value }))}
                    placeholder="ABCD12"
                  />
                  <Button type="button" variant="outline" onClick={generateAccessCode}>
                    <Copy className="h-4 w-4 mr-1" />
                    Generar
                  </Button>
                </div>
                {errors.accessCode && <p className="text-sm text-red-600 mt-1">{errors.accessCode}</p>}
              </div>
            )}

            <div>
              <Label htmlFor="enrollmentLimit">Límite de inscripciones (opcional)</Label>
              <Input
                id="enrollmentLimit"
                type="number"
                min="1"
                value={formData.enrollmentLimit}
                onChange={e => setFormData(prev => ({ ...prev, enrollmentLimit: e.target.value }))}
                placeholder="Sin límite"
              />
            </div>

            {errors.submit && (
              <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{errors.submit}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Bulk Dates Table */}
      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Fechas de Entregas por Lección</CardTitle>
            <p className="text-sm text-gray-500">
              Configura las fechas de apertura y cierre para cada tarea y quiz.
              Los campos vacíos heredarán las fechas del template.
            </p>
          </CardHeader>
          <CardContent className="space-y-8">
            {dateRows.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <Calendar className="h-10 w-10 text-gray-300 mx-auto" />
                <p className="text-gray-500">Este curso no tiene lecciones tipo quiz o tarea todavía.</p>
                <p className="text-sm text-gray-400">
                  Puedes crear la sección ahora y configurar las fechas después cuando agregues lecciones evaluables.
                </p>
              </div>
            ) : (
              <>
                {/* Quizzes Table */}
                {dateRows.some(r => r.lessonType === 'quiz') && (
                  <div>
                    <h3 className="text-sm font-semibold text-purple-700 mb-3 flex items-center gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-purple-100 text-purple-700 text-xs">Quiz</span>
                      Quizzes ({dateRows.filter(r => r.lessonType === 'quiz').length})
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left">
                            <th className="pb-3 pr-3 font-medium text-gray-700 min-w-[180px]">Lección</th>
                            <th className="pb-3 pr-3 font-medium text-gray-700 min-w-[120px]">Módulo</th>
                            <th className="pb-3 pr-3 font-medium text-gray-700 min-w-[180px]">Abre</th>
                            <th className="pb-3 pr-3 font-medium text-gray-700 min-w-[180px]">Due Date</th>
                            <th className="pb-3 font-medium text-gray-700 min-w-[100px]">Tiempo (min)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dateRows.map((row, idx) => {
                            if (row.lessonType !== 'quiz') return null;
                            return (
                              <tr key={row.lessonId} className="border-b last:border-b-0">
                                <td className="py-2 pr-3">
                                  <span className="font-medium text-gray-900">{row.lessonTitle}</span>
                                </td>
                                <td className="py-2 pr-3 text-gray-500 text-xs">{row.moduleName}</td>
                                <td className="py-2 pr-3">
                                  <input
                                    type="datetime-local"
                                    value={row.availableFrom}
                                    onChange={e => updateDateRow(idx, 'availableFrom', e.target.value)}
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                  />
                                </td>
                                <td className="py-2 pr-3">
                                  <input
                                    type="datetime-local"
                                    value={row.dueDate}
                                    onChange={e => updateDateRow(idx, 'dueDate', e.target.value)}
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                  />
                                </td>
                                <td className="py-2">
                                  <input
                                    type="number"
                                    min="1"
                                    value={row.timeLimit}
                                    onChange={e => updateDateRow(idx, 'timeLimit', e.target.value)}
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

                {/* Tareas Table */}
                {dateRows.some(r => r.lessonType === 'tarea') && (
                  <div>
                    <h3 className="text-sm font-semibold text-orange-700 mb-3 flex items-center gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-orange-100 text-orange-700 text-xs">Tarea</span>
                      Tareas ({dateRows.filter(r => r.lessonType === 'tarea').length})
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left">
                            <th className="pb-3 pr-3 font-medium text-gray-700 min-w-[180px]">Lección</th>
                            <th className="pb-3 pr-3 font-medium text-gray-700 min-w-[120px]">Módulo</th>
                            <th className="pb-3 pr-3 font-medium text-gray-700 min-w-[180px]">Abre</th>
                            <th className="pb-3 pr-3 font-medium text-gray-700 min-w-[180px]">Due Date</th>
                            <th className="pb-3 font-medium text-gray-700 min-w-[180px]">Cut-off</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dateRows.map((row, idx) => {
                            if (row.lessonType !== 'tarea') return null;
                            return (
                              <tr key={row.lessonId} className="border-b last:border-b-0">
                                <td className="py-2 pr-3">
                                  <span className="font-medium text-gray-900">{row.lessonTitle}</span>
                                </td>
                                <td className="py-2 pr-3 text-gray-500 text-xs">{row.moduleName}</td>
                                <td className="py-2 pr-3">
                                  <input
                                    type="datetime-local"
                                    value={row.availableFrom}
                                    onChange={e => updateDateRow(idx, 'availableFrom', e.target.value)}
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                  />
                                </td>
                                <td className="py-2 pr-3">
                                  <input
                                    type="datetime-local"
                                    value={row.dueDate}
                                    onChange={e => updateDateRow(idx, 'dueDate', e.target.value)}
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                  />
                                </td>
                                <td className="py-2">
                                  <input
                                    type="datetime-local"
                                    value={row.lateSubmissionDeadline}
                                    min={row.dueDate || undefined}
                                    onChange={e => updateDateRow(idx, 'lateSubmissionDeadline', e.target.value)}
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
          </CardContent>
        </Card>
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => (currentStep === 1 ? navigate('/my-sections') : setCurrentStep(1))}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {currentStep === 1 ? 'Cancelar' : 'Anterior'}
        </Button>
        {currentStep === 1 ? (
          <Button onClick={handleNext}>
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
                {isEditing ? 'Guardar Cambios' : 'Crear Sección'}
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
