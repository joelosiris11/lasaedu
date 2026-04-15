import { useRef, useState } from 'react';
import { useAuthStore } from '@app/store/authStore';
import { courseService, type DBCourse } from '@shared/services/dataService';
import { fileUploadService } from '@shared/services/fileUploadService';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  BookOpen,
  Target,
  Image as ImageIcon,
  Loader2,
  X as XIcon,
  Plus,
} from 'lucide-react';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { Label } from '@shared/components/ui/Label';
import { Modal } from '@shared/components/ui/Modal';

const STEPS = [
  { id: 1, title: 'Información Básica', icon: BookOpen },
  { id: 2, title: 'Contenido y Objetivos', icon: Target },
];

const CATEGORIES = [
  'Programación',
  'Diseño',
  'Marketing',
  'Negocios',
  'Idiomas',
  'Ciencia de Datos',
  'Desarrollo Personal',
  'Otro',
];

interface CourseFormData {
  title: string;
  description: string;
  image: string;
  category: string;
  level: 'principiante' | 'intermedio' | 'avanzado';
  duration: string;
  tags: string[];
  requirements: string[];
  objectives: string[];
}

interface CourseWizardModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (course: DBCourse) => void;
}

const EMPTY_FORM: CourseFormData = {
  title: '',
  description: '',
  image: '',
  category: '',
  level: 'principiante',
  duration: '',
  tags: [],
  requirements: [],
  objectives: [],
};

export default function CourseWizardModal({ open, onClose, onCreated }: CourseWizardModalProps) {
  const { user } = useAuthStore();
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<CourseFormData>(EMPTY_FORM);
  const [tagInput, setTagInput] = useState('');
  const [requirementInput, setRequirementInput] = useState('');
  const [objectiveInput, setObjectiveInput] = useState('');

  const reset = () => {
    setCurrentStep(1);
    setSaving(false);
    setErrors({});
    setFormData(EMPTY_FORM);
    setTagInput('');
    setRequirementInput('');
    setObjectiveInput('');
  };

  const handleClose = () => {
    if (saving) return;
    reset();
    onClose();
  };

  const validateStep = (step: number): boolean => {
    const next: Record<string, string> = {};
    if (step === 1) {
      if (!formData.title.trim()) next.title = 'El título es obligatorio';
      else if (formData.title.length > 100) next.title = 'Máximo 100 caracteres';
      if (!formData.description.trim()) next.description = 'La descripción es obligatoria';
      if (!formData.category) next.category = 'Selecciona una categoría';
      if (!formData.duration.trim()) next.duration = 'La duración es obligatoria';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) setCurrentStep(2);
  };

  const addTag = () => {
    const v = tagInput.trim();
    if (v && !formData.tags.includes(v)) {
      setFormData(p => ({ ...p, tags: [...p.tags, v] }));
      setTagInput('');
    }
  };
  const removeTag = (t: string) =>
    setFormData(p => ({ ...p, tags: p.tags.filter(x => x !== t) }));

  const addRequirement = () => {
    const v = requirementInput.trim();
    if (v) {
      setFormData(p => ({ ...p, requirements: [...p.requirements, v] }));
      setRequirementInput('');
    }
  };
  const removeRequirement = (i: number) =>
    setFormData(p => ({ ...p, requirements: p.requirements.filter((_, idx) => idx !== i) }));

  const addObjective = () => {
    const v = objectiveInput.trim();
    if (v) {
      setFormData(p => ({ ...p, objectives: [...p.objectives, v] }));
      setObjectiveInput('');
    }
  };
  const removeObjective = (i: number) =>
    setFormData(p => ({ ...p, objectives: p.objectives.filter((_, idx) => idx !== i) }));

  const handleSubmit = async () => {
    if (!validateStep(1)) {
      setCurrentStep(1);
      return;
    }
    setSaving(true);
    try {
      const now = Date.now();
      const courseData: Omit<DBCourse, 'id'> = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        instructor: user?.name || '',
        instructorId: user?.id || '',
        category: formData.category,
        level: formData.level,
        duration: formData.duration.trim(),
        status: 'borrador',
        image: formData.image || undefined,
        studentsCount: 0,
        sectionsCount: 0,
        tags: formData.tags,
        requirements: formData.requirements,
        objectives: formData.objectives,
        createdAt: now,
        updatedAt: now,
      };
      const created = await courseService.create(courseData);
      onCreated?.(created);
      reset();
      onClose();
    } catch (err) {
      console.error('Error creating course:', err);
      setErrors({ submit: 'Error al crear el curso. Intenta de nuevo.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      disableBackdropClose={saving}
      size="3xl"
      title="Nuevo curso"
      subtitle="Los cursos son plantillas. Los estudiantes se inscriben en las secciones que crees a partir de este curso."
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
            <Button onClick={handleNext}>
              Siguiente
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Crear curso
                </>
              )}
            </Button>
          )}
        </div>
      }
    >
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
                {isCompleted ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
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
          <div>
            <Label htmlFor="course-title">Título del curso *</Label>
            <Input
              id="course-title"
              value={formData.title}
              onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
              placeholder="ej. Introducción a la Programación con Python"
              maxLength={100}
              className={errors.title ? 'border-red-500' : ''}
            />
            <div className="flex justify-between mt-1">
              {errors.title ? (
                <span className="text-red-500 text-xs">{errors.title}</span>
              ) : (
                <span />
              )}
              <span className="text-gray-400 text-xs">{formData.title.length}/100</span>
            </div>
          </div>

          <div>
            <Label htmlFor="course-description">Descripción *</Label>
            <textarea
              id="course-description"
              value={formData.description}
              onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
              rows={4}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 ${
                errors.description ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Descripción del curso, metodología, a quién va dirigido..."
            />
            {errors.description && (
              <p className="text-red-500 text-xs mt-1">{errors.description}</p>
            )}
          </div>

          <div>
            <Label>Imagen de portada</Label>
            <CourseImageUploader
              value={formData.image}
              onChange={url => setFormData(p => ({ ...p, image: url }))}
            />
            <p className="text-gray-500 text-xs mt-1">
              Banner por defecto de todas las secciones. Recomendado 1280×720px.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="course-category">Categoría *</Label>
              <select
                id="course-category"
                value={formData.category}
                onChange={e => setFormData(p => ({ ...p, category: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white ${
                  errors.category ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">Seleccionar...</option>
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat.toLowerCase().replace(' ', '_')}>
                    {cat}
                  </option>
                ))}
              </select>
              {errors.category && (
                <p className="text-red-500 text-xs mt-1">{errors.category}</p>
              )}
            </div>
            <div>
              <Label htmlFor="course-level">Nivel *</Label>
              <select
                id="course-level"
                value={formData.level}
                onChange={e =>
                  setFormData(p => ({ ...p, level: e.target.value as CourseFormData['level'] }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white"
              >
                <option value="principiante">Principiante</option>
                <option value="intermedio">Intermedio</option>
                <option value="avanzado">Avanzado</option>
              </select>
            </div>
            <div>
              <Label htmlFor="course-duration">Duración *</Label>
              <Input
                id="course-duration"
                value={formData.duration}
                onChange={e => setFormData(p => ({ ...p, duration: e.target.value }))}
                placeholder="ej. 8 semanas"
                className={errors.duration ? 'border-red-500' : ''}
              />
              {errors.duration && (
                <p className="text-red-500 text-xs mt-1">{errors.duration}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Content */}
      {currentStep === 2 && (
        <div className="space-y-6">
          <ChipList
            label="Etiquetas"
            placeholder="Escribe una etiqueta y presiona Enter"
            value={tagInput}
            onChange={setTagInput}
            onAdd={addTag}
            items={formData.tags}
            onRemove={t => removeTag(t as string)}
            renderItem={t => t}
          />

          <ListField
            label="Requisitos previos"
            placeholder="ej. Conocimientos básicos de matemáticas"
            value={requirementInput}
            onChange={setRequirementInput}
            onAdd={addRequirement}
            items={formData.requirements}
            onRemove={removeRequirement}
            bulletColor="gray"
          />

          <ListField
            label="Objetivos de aprendizaje"
            placeholder="ej. Comprender los fundamentos de programación"
            value={objectiveInput}
            onChange={setObjectiveInput}
            onAdd={addObjective}
            items={formData.objectives}
            onRemove={removeObjective}
            bulletColor="red"
          />

          {errors.submit && (
            <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{errors.submit}</p>
          )}

          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs text-gray-600">
            Se creará como <span className="font-semibold">borrador</span>. Después podrás
            agregar módulos y lecciones, y crear secciones para inscribir estudiantes.
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── Sub-components (module-level to preserve input focus across re-renders) ──

function ListField({
  label,
  placeholder,
  value,
  onChange,
  onAdd,
  items,
  onRemove,
  bulletColor,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onAdd: () => void;
  items: string[];
  onRemove: (i: number) => void;
  bulletColor: 'gray' | 'red';
}) {
  const bullet = bulletColor === 'red' ? 'text-red-500' : 'text-gray-400';
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex gap-2 mb-2">
        <Input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onAdd();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={onAdd}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {items.length > 0 && (
        <ul className="space-y-1">
          {items.map((item, i) => (
            <li
              key={i}
              className="group flex items-center justify-between py-1.5 px-3 bg-gray-50 rounded-lg"
            >
              <span className="text-sm text-gray-700">
                <span className={`mr-2 ${bullet}`}>•</span>
                {item}
              </span>
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-gray-400 hover:text-red-600"
                aria-label="Eliminar"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChipList({
  label,
  placeholder,
  value,
  onChange,
  onAdd,
  items,
  onRemove,
  renderItem,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onAdd: () => void;
  items: string[];
  onRemove: (item: string) => void;
  renderItem: (item: string) => string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex gap-2 mb-2">
        <Input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onAdd();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={onAdd}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {items.map(item => (
            <span
              key={item}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 border border-red-100 rounded-full text-xs font-medium"
            >
              {renderItem(item)}
              <button
                type="button"
                onClick={() => onRemove(item)}
                className="text-red-400 hover:text-red-700"
                aria-label="Quitar"
              >
                <XIcon className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Inline image uploader ────────────────────────────────────────────────────

function CourseImageUploader({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File | undefined | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('El archivo debe ser una imagen');
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const result = await fileUploadService.uploadImage(file);
      onChange(result.url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al subir la imagen';
      setError(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => handleFile(e.target.files?.[0])}
      />

      {value ? (
        <div className="relative rounded-lg overflow-hidden border border-gray-200">
          <div
            className="w-full aspect-[16/9] bg-gray-100 bg-cover bg-center"
            style={{ backgroundImage: `url(${value})` }}
          />
          <div className="absolute top-2 right-2 flex gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="bg-white/95 backdrop-blur"
            >
              <ImageIcon className="h-3.5 w-3.5 mr-1" />
              {uploading ? 'Subiendo...' : 'Cambiar'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange('')}
              className="bg-white/95 backdrop-blur text-red-600 hover:text-red-800"
            >
              Quitar
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full aspect-[16/6] border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center hover:border-red-400 hover:bg-red-50/40 transition-colors"
        >
          <ImageIcon className="h-8 w-8 text-gray-400 mb-1.5" />
          <p className="text-sm font-medium text-gray-700">
            {uploading ? 'Subiendo imagen...' : 'Haz clic para subir una imagen'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">PNG, JPG o WEBP — máximo 10MB</p>
        </button>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
