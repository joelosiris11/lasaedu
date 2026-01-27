import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@app/store/authStore';
import { courseService, type DBCourse } from '@shared/services/dataService';
import { 
  ArrowLeft,
  ArrowRight,
  Check,
  BookOpen,
  Settings,
  Layout,
  Image as ImageIcon,
  Tag,
  Clock,
  Users,
  Lock,
  Globe,
  Calendar,
  FileText,
  Copy,
  Upload,
  Layers
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { Label } from '@shared/components/ui/Label';

// Types
interface CourseWizardData {
  // Step 1: Basic Info
  title: string;
  shortDescription: string;
  fullDescription: string;
  image: string;
  category: string;
  level: 'principiante' | 'intermedio' | 'avanzado';
  duration: string;
  tags: string[];
  requirements: string[];
  objectives: string[];
  
  // Step 2: Access Configuration
  accessType: 'publico' | 'privado' | 'restringido';
  accessCode: string;
  startDate: string;
  endDate: string;
  enrollmentLimit: number | null;
  autoEnrollment: boolean;
  requireProfile: boolean;
  welcomeEmail: boolean;
  showInCatalog: boolean;
  
  // Step 3: Initial Structure
  structureType: 'blank' | 'template' | 'duplicate' | 'import';
  templateId: string;
  duplicateCourseId: string;
  importFile: File | null;
}

const STEPS = [
  { id: 1, title: 'Información Básica', icon: BookOpen },
  { id: 2, title: 'Configuración de Acceso', icon: Settings },
  { id: 3, title: 'Estructura Inicial', icon: Layout }
];

const CATEGORIES = [
  'Programación',
  'Diseño',
  'Marketing',
  'Negocios',
  'Idiomas',
  'Ciencia de Datos',
  'Desarrollo Personal',
  'Otro'
];

export default function CourseWizardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState<CourseWizardData>({
    // Step 1
    title: '',
    shortDescription: '',
    fullDescription: '',
    image: '',
    category: '',
    level: 'principiante',
    duration: '',
    tags: [],
    requirements: [],
    objectives: [],
    
    // Step 2
    accessType: 'publico',
    accessCode: '',
    startDate: '',
    endDate: '',
    enrollmentLimit: null,
    autoEnrollment: true,
    requireProfile: false,
    welcomeEmail: true,
    showInCatalog: true,
    
    // Step 3
    structureType: 'blank',
    templateId: '',
    duplicateCourseId: '',
    importFile: null
  });

  const [tagInput, setTagInput] = useState('');
  const [requirementInput, setRequirementInput] = useState('');
  const [objectiveInput, setObjectiveInput] = useState('');

  // Validation
  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (step === 1) {
      if (!formData.title.trim()) newErrors.title = 'El título es obligatorio';
      if (formData.title.length > 100) newErrors.title = 'Máximo 100 caracteres';
      if (!formData.shortDescription.trim()) newErrors.shortDescription = 'La descripción corta es obligatoria';
      if (formData.shortDescription.length > 200) newErrors.shortDescription = 'Máximo 200 caracteres';
      if (!formData.fullDescription.trim()) newErrors.fullDescription = 'La descripción completa es obligatoria';
      if (!formData.category) newErrors.category = 'Selecciona una categoría';
      if (!formData.duration.trim()) newErrors.duration = 'La duración es obligatoria';
    }
    
    if (step === 2) {
      if (formData.accessType === 'privado' && !formData.accessCode.trim()) {
        newErrors.accessCode = 'El código de acceso es obligatorio para cursos privados';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 3));
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const generateAccessCode = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setFormData(prev => ({ ...prev, accessCode: code }));
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({ ...prev, tags: [...prev.tags, tagInput.trim()] }));
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setFormData(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
  };

  const addRequirement = () => {
    if (requirementInput.trim()) {
      setFormData(prev => ({ ...prev, requirements: [...prev.requirements, requirementInput.trim()] }));
      setRequirementInput('');
    }
  };

  const removeRequirement = (index: number) => {
    setFormData(prev => ({ ...prev, requirements: prev.requirements.filter((_, i) => i !== index) }));
  };

  const addObjective = () => {
    if (objectiveInput.trim()) {
      setFormData(prev => ({ ...prev, objectives: [...prev.objectives, objectiveInput.trim()] }));
      setObjectiveInput('');
    }
  };

  const removeObjective = (index: number) => {
    setFormData(prev => ({ ...prev, objectives: prev.objectives.filter((_, i) => i !== index) }));
  };

  const handleSubmit = async () => {
    if (!validateStep(3)) return;
    
    setSaving(true);
    try {
      const now = Date.now();
      const courseData: Omit<DBCourse, 'id'> = {
        title: formData.title,
        description: formData.fullDescription,
        instructor: user?.name || '',
        instructorId: user?.id || '',
        category: formData.category,
        level: formData.level,
        duration: formData.duration,
        status: 'borrador',
        image: formData.image || undefined,
        studentsCount: 0,
        tags: formData.tags,
        requirements: formData.requirements,
        objectives: formData.objectives,
        createdAt: now,
        updatedAt: now
      };
      
      const newCourse = await courseService.create(courseData);
      
      // Navigate to course detail/editor
      navigate(`/courses/${newCourse.id}`);
    } catch (error) {
      console.error('Error creating course:', error);
      setErrors({ submit: 'Error al crear el curso. Intenta de nuevo.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => navigate('/courses')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Crear Nuevo Curso</h1>
            <p className="text-gray-600">Completa los pasos para crear tu curso</p>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="relative">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;
            
            return (
              <div key={step.id} className="flex flex-col items-center flex-1">
                <div className="relative flex items-center justify-center">
                  {index > 0 && (
                    <div 
                      className={`absolute right-1/2 w-full h-1 -translate-y-1/2 top-1/2 ${
                        isCompleted ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                      style={{ width: 'calc(100% - 2.5rem)', right: '50%', marginRight: '1.25rem' }}
                    />
                  )}
                  <div 
                    className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                      isActive 
                        ? 'border-blue-600 bg-blue-600 text-white' 
                        : isCompleted 
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-gray-300 bg-white text-gray-500'
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>
                </div>
                <span className={`mt-2 text-sm font-medium ${
                  isActive ? 'text-blue-600' : isCompleted ? 'text-blue-600' : 'text-gray-500'
                }`}>
                  {step.title}
                </span>
                <span className="text-xs text-gray-400">Paso {step.id}/3</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            {currentStep === 1 && <BookOpen className="h-5 w-5 mr-2 text-blue-600" />}
            {currentStep === 2 && <Settings className="h-5 w-5 mr-2 text-blue-600" />}
            {currentStep === 3 && <Layout className="h-5 w-5 mr-2 text-blue-600" />}
            {STEPS[currentStep - 1].title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1: Basic Info */}
          {currentStep === 1 && (
            <>
              <div>
                <Label htmlFor="title">Título del curso *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="ej. Introducción a la Programación con Python"
                  maxLength={100}
                  className={errors.title ? 'border-red-500' : ''}
                />
                <div className="flex justify-between mt-1">
                  {errors.title && <span className="text-red-500 text-sm">{errors.title}</span>}
                  <span className="text-gray-400 text-sm ml-auto">{formData.title.length}/100</span>
                </div>
              </div>

              <div>
                <Label htmlFor="shortDescription">Descripción corta * (máx. 200 caracteres)</Label>
                <textarea
                  id="shortDescription"
                  value={formData.shortDescription}
                  onChange={(e) => setFormData(prev => ({ ...prev, shortDescription: e.target.value }))}
                  placeholder="Breve descripción que aparecerá en el catálogo..."
                  maxLength={200}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-20 ${
                    errors.shortDescription ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                <div className="flex justify-between mt-1">
                  {errors.shortDescription && <span className="text-red-500 text-sm">{errors.shortDescription}</span>}
                  <span className="text-gray-400 text-sm ml-auto">{formData.shortDescription.length}/200</span>
                </div>
              </div>

              <div>
                <Label htmlFor="fullDescription">Descripción completa *</Label>
                <textarea
                  id="fullDescription"
                  value={formData.fullDescription}
                  onChange={(e) => setFormData(prev => ({ ...prev, fullDescription: e.target.value }))}
                  placeholder="Descripción detallada del curso, contenido, metodología..."
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-32 ${
                    errors.fullDescription ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.fullDescription && <span className="text-red-500 text-sm">{errors.fullDescription}</span>}
              </div>

              <div>
                <Label htmlFor="image">URL de imagen de portada</Label>
                <div className="flex space-x-2">
                  <div className="flex-1">
                    <Input
                      id="image"
                      value={formData.image}
                      onChange={(e) => setFormData(prev => ({ ...prev, image: e.target.value }))}
                      placeholder="https://ejemplo.com/imagen.jpg"
                    />
                  </div>
                  <Button variant="outline" type="button">
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Subir
                  </Button>
                </div>
                <p className="text-gray-500 text-sm mt-1">Recomendado: 1280x720px (16:9)</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="category">Categoría *</Label>
                  <select
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.category ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Seleccionar...</option>
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat.toLowerCase().replace(' ', '_')}>{cat}</option>
                    ))}
                  </select>
                  {errors.category && <span className="text-red-500 text-sm">{errors.category}</span>}
                </div>

                <div>
                  <Label htmlFor="level">Nivel *</Label>
                  <select
                    id="level"
                    value={formData.level}
                    onChange={(e) => setFormData(prev => ({ ...prev, level: e.target.value as CourseWizardData['level'] }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="principiante">Principiante</option>
                    <option value="intermedio">Intermedio</option>
                    <option value="avanzado">Avanzado</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="duration">Duración estimada *</Label>
                  <Input
                    id="duration"
                    value={formData.duration}
                    onChange={(e) => setFormData(prev => ({ ...prev, duration: e.target.value }))}
                    placeholder="ej. 8 semanas"
                    className={errors.duration ? 'border-red-500' : ''}
                  />
                  {errors.duration && <span className="text-red-500 text-sm">{errors.duration}</span>}
                </div>
              </div>

              <div>
                <Label>Etiquetas/Tags</Label>
                <div className="flex space-x-2 mb-2">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    placeholder="Escribe una etiqueta y presiona Agregar"
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  />
                  <Button type="button" variant="outline" onClick={addTag}>
                    <Tag className="h-4 w-4 mr-1" />
                    Agregar
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map(tag => (
                    <span 
                      key={tag} 
                      className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                    >
                      {tag}
                      <button 
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="ml-2 text-blue-600 hover:text-blue-800"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <Label>Requisitos previos</Label>
                <div className="flex space-x-2 mb-2">
                  <Input
                    value={requirementInput}
                    onChange={(e) => setRequirementInput(e.target.value)}
                    placeholder="ej. Conocimientos básicos de matemáticas"
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addRequirement())}
                  />
                  <Button type="button" variant="outline" onClick={addRequirement}>
                    Agregar
                  </Button>
                </div>
                <ul className="space-y-1">
                  {formData.requirements.map((req, index) => (
                    <li key={index} className="flex items-center justify-between py-1 px-3 bg-gray-50 rounded">
                      <span className="text-sm">• {req}</span>
                      <button 
                        type="button"
                        onClick={() => removeRequirement(index)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        Eliminar
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <Label>Objetivos de aprendizaje</Label>
                <div className="flex space-x-2 mb-2">
                  <Input
                    value={objectiveInput}
                    onChange={(e) => setObjectiveInput(e.target.value)}
                    placeholder="ej. Comprender los fundamentos de programación"
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addObjective())}
                  />
                  <Button type="button" variant="outline" onClick={addObjective}>
                    Agregar
                  </Button>
                </div>
                <ul className="space-y-1">
                  {formData.objectives.map((obj, index) => (
                    <li key={index} className="flex items-center justify-between py-1 px-3 bg-green-50 rounded">
                      <span className="text-sm">✓ {obj}</span>
                      <button 
                        type="button"
                        onClick={() => removeObjective(index)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        Eliminar
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {/* Step 2: Access Configuration */}
          {currentStep === 2 && (
            <>
              <div>
                <Label className="text-base font-medium">Tipo de Acceso</Label>
                <div className="mt-3 space-y-3">
                  <label className={`flex items-start p-4 border rounded-lg cursor-pointer transition-colors ${
                    formData.accessType === 'publico' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                    <input
                      type="radio"
                      name="accessType"
                      value="publico"
                      checked={formData.accessType === 'publico'}
                      onChange={(e) => setFormData(prev => ({ ...prev, accessType: e.target.value as CourseWizardData['accessType'] }))}
                      className="mt-1"
                    />
                    <div className="ml-3">
                      <div className="flex items-center">
                        <Globe className="h-5 w-5 text-green-600 mr-2" />
                        <span className="font-medium">Público</span>
                      </div>
                      <p className="text-gray-500 text-sm mt-1">Cualquiera puede inscribirse libremente</p>
                    </div>
                  </label>

                  <label className={`flex items-start p-4 border rounded-lg cursor-pointer transition-colors ${
                    formData.accessType === 'privado' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                    <input
                      type="radio"
                      name="accessType"
                      value="privado"
                      checked={formData.accessType === 'privado'}
                      onChange={(e) => setFormData(prev => ({ ...prev, accessType: e.target.value as CourseWizardData['accessType'] }))}
                      className="mt-1"
                    />
                    <div className="ml-3">
                      <div className="flex items-center">
                        <Lock className="h-5 w-5 text-yellow-600 mr-2" />
                        <span className="font-medium">Privado</span>
                      </div>
                      <p className="text-gray-500 text-sm mt-1">Solo accesible con código de invitación</p>
                    </div>
                  </label>

                  <label className={`flex items-start p-4 border rounded-lg cursor-pointer transition-colors ${
                    formData.accessType === 'restringido' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                    <input
                      type="radio"
                      name="accessType"
                      value="restringido"
                      checked={formData.accessType === 'restringido'}
                      onChange={(e) => setFormData(prev => ({ ...prev, accessType: e.target.value as CourseWizardData['accessType'] }))}
                      className="mt-1"
                    />
                    <div className="ml-3">
                      <div className="flex items-center">
                        <Users className="h-5 w-5 text-orange-600 mr-2" />
                        <span className="font-medium">Restringido</span>
                      </div>
                      <p className="text-gray-500 text-sm mt-1">Requiere aprobación del profesor para inscribirse</p>
                    </div>
                  </label>
                </div>
              </div>

              {formData.accessType === 'privado' && (
                <div>
                  <Label htmlFor="accessCode">Código de Acceso *</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="accessCode"
                      value={formData.accessCode}
                      onChange={(e) => setFormData(prev => ({ ...prev, accessCode: e.target.value.toUpperCase() }))}
                      placeholder="Ej. PYTHON2024"
                      className={errors.accessCode ? 'border-red-500' : ''}
                    />
                    <Button type="button" variant="outline" onClick={generateAccessCode}>
                      🔄 Generar
                    </Button>
                  </div>
                  {errors.accessCode && <span className="text-red-500 text-sm">{errors.accessCode}</span>}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startDate">Fecha de inicio</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="endDate">Fecha de fin (opcional)</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="endDate"
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="enrollmentLimit">Límite de inscripciones</Label>
                <div className="flex items-center space-x-4">
                  <Input
                    id="enrollmentLimit"
                    type="number"
                    min="0"
                    value={formData.enrollmentLimit || ''}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      enrollmentLimit: e.target.value ? parseInt(e.target.value) : null 
                    }))}
                    placeholder="Sin límite"
                    className="w-40"
                    disabled={formData.enrollmentLimit === null}
                  />
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.enrollmentLimit === null}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        enrollmentLimit: e.target.checked ? null : 100 
                      }))}
                      className="mr-2"
                    />
                    Sin límite
                  </label>
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-base font-medium">Opciones adicionales</Label>
                
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.autoEnrollment}
                    onChange={(e) => setFormData(prev => ({ ...prev, autoEnrollment: e.target.checked }))}
                    className="mr-3 h-4 w-4 text-blue-600 rounded"
                  />
                  <span>Permitir auto-inscripción</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.requireProfile}
                    onChange={(e) => setFormData(prev => ({ ...prev, requireProfile: e.target.checked }))}
                    className="mr-3 h-4 w-4 text-blue-600 rounded"
                  />
                  <span>Requerir completar perfil para inscribirse</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.welcomeEmail}
                    onChange={(e) => setFormData(prev => ({ ...prev, welcomeEmail: e.target.checked }))}
                    className="mr-3 h-4 w-4 text-blue-600 rounded"
                  />
                  <span>Enviar email de bienvenida automático</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.showInCatalog}
                    onChange={(e) => setFormData(prev => ({ ...prev, showInCatalog: e.target.checked }))}
                    className="mr-3 h-4 w-4 text-blue-600 rounded"
                  />
                  <span>Mostrar en catálogo de cursos</span>
                </label>
              </div>
            </>
          )}

          {/* Step 3: Initial Structure */}
          {currentStep === 3 && (
            <>
              <div>
                <Label className="text-base font-medium">¿Cómo quieres empezar?</Label>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className={`flex flex-col items-center p-6 border-2 rounded-lg cursor-pointer transition-all ${
                    formData.structureType === 'blank' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <input
                      type="radio"
                      name="structureType"
                      value="blank"
                      checked={formData.structureType === 'blank'}
                      onChange={(e) => setFormData(prev => ({ ...prev, structureType: e.target.value as CourseWizardData['structureType'] }))}
                      className="sr-only"
                    />
                    <FileText className="h-12 w-12 text-gray-400 mb-3" />
                    <span className="font-medium">Empezar en blanco</span>
                    <span className="text-gray-500 text-sm text-center mt-1">
                      Crea la estructura desde cero
                    </span>
                  </label>

                  <label className={`flex flex-col items-center p-6 border-2 rounded-lg cursor-pointer transition-all ${
                    formData.structureType === 'template' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <input
                      type="radio"
                      name="structureType"
                      value="template"
                      checked={formData.structureType === 'template'}
                      onChange={(e) => setFormData(prev => ({ ...prev, structureType: e.target.value as CourseWizardData['structureType'] }))}
                      className="sr-only"
                    />
                    <Layers className="h-12 w-12 text-blue-400 mb-3" />
                    <span className="font-medium">Usar plantilla</span>
                    <span className="text-gray-500 text-sm text-center mt-1">
                      Usa una plantilla predefinida
                    </span>
                  </label>

                  <label className={`flex flex-col items-center p-6 border-2 rounded-lg cursor-pointer transition-all ${
                    formData.structureType === 'duplicate' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <input
                      type="radio"
                      name="structureType"
                      value="duplicate"
                      checked={formData.structureType === 'duplicate'}
                      onChange={(e) => setFormData(prev => ({ ...prev, structureType: e.target.value as CourseWizardData['structureType'] }))}
                      className="sr-only"
                    />
                    <Copy className="h-12 w-12 text-green-400 mb-3" />
                    <span className="font-medium">Duplicar curso</span>
                    <span className="text-gray-500 text-sm text-center mt-1">
                      Copia la estructura de otro curso
                    </span>
                  </label>

                  <label className={`flex flex-col items-center p-6 border-2 rounded-lg cursor-pointer transition-all ${
                    formData.structureType === 'import' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <input
                      type="radio"
                      name="structureType"
                      value="import"
                      checked={formData.structureType === 'import'}
                      onChange={(e) => setFormData(prev => ({ ...prev, structureType: e.target.value as CourseWizardData['structureType'] }))}
                      className="sr-only"
                    />
                    <Upload className="h-12 w-12 text-purple-400 mb-3" />
                    <span className="font-medium">Importar</span>
                    <span className="text-gray-500 text-sm text-center mt-1">
                      Importa desde SCORM o CSV
                    </span>
                  </label>
                </div>
              </div>

              {formData.structureType === 'template' && (
                <div>
                  <Label>Selecciona una plantilla</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                    {[
                      { id: 'basic', name: 'Curso Básico', modules: 3, lessons: 9 },
                      { id: 'complete', name: 'Curso Completo', modules: 5, lessons: 20 },
                      { id: 'workshop', name: 'Taller Práctico', modules: 2, lessons: 6 },
                      { id: 'bootcamp', name: 'Bootcamp Intensivo', modules: 8, lessons: 32 }
                    ].map(template => (
                      <label 
                        key={template.id}
                        className={`p-4 border rounded-lg cursor-pointer ${
                          formData.templateId === template.id 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="template"
                          value={template.id}
                          checked={formData.templateId === template.id}
                          onChange={(e) => setFormData(prev => ({ ...prev, templateId: e.target.value }))}
                          className="sr-only"
                        />
                        <div className="font-medium">{template.name}</div>
                        <div className="text-gray-500 text-sm">
                          {template.modules} módulos • {template.lessons} lecciones
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {formData.structureType === 'import' && (
                <div>
                  <Label>Subir archivo</Label>
                  <div className="mt-2 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">Arrastra un archivo aquí o haz clic para seleccionar</p>
                    <p className="text-gray-400 text-sm mt-2">Formatos soportados: SCORM (.zip), CSV</p>
                    <Button type="button" variant="outline" className="mt-4">
                      Seleccionar archivo
                    </Button>
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="mt-8 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium mb-3">📋 Resumen del curso</h3>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt className="text-gray-500">Título:</dt>
                  <dd className="font-medium">{formData.title || '-'}</dd>
                  
                  <dt className="text-gray-500">Categoría:</dt>
                  <dd>{formData.category || '-'}</dd>
                  
                  <dt className="text-gray-500">Nivel:</dt>
                  <dd className="capitalize">{formData.level}</dd>
                  
                  <dt className="text-gray-500">Duración:</dt>
                  <dd>{formData.duration || '-'}</dd>
                  
                  <dt className="text-gray-500">Acceso:</dt>
                  <dd className="capitalize">{formData.accessType}</dd>
                  
                  <dt className="text-gray-500">Estructura:</dt>
                  <dd className="capitalize">{formData.structureType === 'blank' ? 'En blanco' : formData.structureType}</dd>
                </dl>
              </div>

              {errors.submit && (
                <div className="p-4 bg-red-50 text-red-600 rounded-lg">
                  {errors.submit}
                </div>
              )}
            </>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-6 border-t">
            <Button 
              type="button" 
              variant="outline"
              onClick={currentStep === 1 ? () => navigate('/courses') : handlePrevious}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {currentStep === 1 ? 'Cancelar' : 'Anterior'}
            </Button>
            
            {currentStep < 3 ? (
              <Button type="button" onClick={handleNext}>
                Siguiente
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button 
                type="button" 
                onClick={handleSubmit}
                disabled={saving}
                className="bg-green-600 hover:bg-green-700"
              >
                {saving ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Creando...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Crear como Borrador
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
