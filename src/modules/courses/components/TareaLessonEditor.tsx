import { Label } from '@shared/components/ui/Label';
import { Input } from '@shared/components/ui/Input';
import { RichTextEditor } from '@shared/components/editor';
import FileUploadZone, { type UploadedFile } from '@shared/components/upload/FileUploadZone';
import type { ResourceFile } from './ResourceLessonEditor';

export interface TareaLessonContent {
  instructions: string; // HTML
  totalPoints: number;
  referenceFiles: ResourceFile[];
  submissionSettings: {
    maxFiles: number;
    maxFileSize: number; // bytes
    allowedExtensions: string[];
  };
}

export const defaultTareaContent: TareaLessonContent = {
  instructions: '',
  totalPoints: 100,
  referenceFiles: [],
  submissionSettings: {
    maxFiles: 3,
    maxFileSize: 25 * 1024 * 1024,
    allowedExtensions: ['.pdf', '.docx', '.pptx', '.xlsx', '.zip', '.jpg', '.jpeg', '.png'],
  },
};

interface TareaLessonEditorProps {
  content: TareaLessonContent;
  onChange: (content: TareaLessonContent) => void;
  courseId?: string;
  lessonId?: string;
}

const EXTENSION_GROUPS = [
  { label: 'Documentos', extensions: ['.pdf', '.docx', '.pptx', '.xlsx', '.odt', '.ods', '.odp'] },
  { label: 'Imagenes', extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'] },
  { label: 'Archivos', extensions: ['.zip', '.rar'] },
  { label: 'Texto', extensions: ['.csv', '.txt'] },
];

const SIZE_OPTIONS = [
  { label: '5 MB', value: 5 * 1024 * 1024 },
  { label: '10 MB', value: 10 * 1024 * 1024 },
  { label: '25 MB', value: 25 * 1024 * 1024 },
  { label: '50 MB', value: 50 * 1024 * 1024 },
];

export default function TareaLessonEditor({
  content,
  onChange,
  courseId,
  lessonId,
}: TareaLessonEditorProps) {
  const { submissionSettings } = content;

  const handleFilesChange = (files: UploadedFile[]) => {
    const resourceFiles: ResourceFile[] = files.map(f => ({
      id: f.id,
      name: f.name,
      url: f.url,
      size: f.size,
      contentType: f.contentType,
    }));
    onChange({ ...content, referenceFiles: resourceFiles });
  };

  const toggleExtension = (ext: string) => {
    const current = submissionSettings.allowedExtensions;
    const updated = current.includes(ext)
      ? current.filter(e => e !== ext)
      : [...current, ext];
    onChange({
      ...content,
      submissionSettings: { ...submissionSettings, allowedExtensions: updated },
    });
  };

  const toggleGroup = (extensions: string[]) => {
    const allSelected = extensions.every(ext => submissionSettings.allowedExtensions.includes(ext));
    let updated: string[];
    if (allSelected) {
      updated = submissionSettings.allowedExtensions.filter(ext => !extensions.includes(ext));
    } else {
      updated = [...new Set([...submissionSettings.allowedExtensions, ...extensions])];
    }
    onChange({
      ...content,
      submissionSettings: { ...submissionSettings, allowedExtensions: updated },
    });
  };

  const uploadedFiles: UploadedFile[] = content.referenceFiles.map(f => ({
    id: f.id,
    name: f.name,
    url: f.url,
    size: f.size,
    contentType: f.contentType,
  }));

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div>
        <Label>Instrucciones de la Tarea *</Label>
        <p className="text-sm text-gray-500 mb-2">
          Describe claramente que deben hacer los estudiantes
        </p>
        <RichTextEditor
          content={content.instructions}
          onChange={(html) => onChange({ ...content, instructions: html })}
          placeholder="Escribe las instrucciones de la tarea..."
          className="min-h-[250px]"
        />
      </div>

      {/* Points */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="totalPoints">Puntos Totales</Label>
          <Input
            id="totalPoints"
            type="number"
            min={0}
            max={1000}
            value={content.totalPoints}
            onChange={(e) => onChange({ ...content, totalPoints: parseInt(e.target.value) || 0 })}
          />
          <p className="text-xs text-gray-500 mt-1">Puntaje maximo de la tarea</p>
        </div>
      </div>

      {/* Reference files */}
      <div>
        <Label>Archivos de Referencia (Profesor)</Label>
        <p className="text-sm text-gray-500 mb-2">
          Materiales de apoyo, plantillas o rubrica para los estudiantes
        </p>
        <FileUploadZone
          files={uploadedFiles}
          onFilesChange={handleFilesChange}
          maxFiles={10}
          maxFileSize={25 * 1024 * 1024}
          courseId={courseId}
          lessonId={lessonId}
          storagePath="attachment"
        />
      </div>

      {/* Submission settings */}
      <div className="border border-gray-200 rounded-lg p-4 space-y-4">
        <h3 className="font-medium text-gray-900">Configuracion de Envio del Estudiante</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="maxFiles">Max. Archivos por Envio</Label>
            <Input
              id="maxFiles"
              type="number"
              min={1}
              max={10}
              value={submissionSettings.maxFiles}
              onChange={(e) => onChange({
                ...content,
                submissionSettings: {
                  ...submissionSettings,
                  maxFiles: parseInt(e.target.value) || 1,
                },
              })}
            />
          </div>

          <div>
            <Label htmlFor="maxFileSize">Tamano Maximo por Archivo</Label>
            <select
              id="maxFileSize"
              value={submissionSettings.maxFileSize}
              onChange={(e) => onChange({
                ...content,
                submissionSettings: {
                  ...submissionSettings,
                  maxFileSize: parseInt(e.target.value),
                },
              })}
              className="w-full h-10 px-3 border border-gray-300 rounded-md text-sm"
            >
              {SIZE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Allowed extensions */}
        <div>
          <Label>Extensiones Permitidas</Label>
          <div className="space-y-3 mt-2">
            {EXTENSION_GROUPS.map(group => {
              const allSelected = group.extensions.every(ext =>
                submissionSettings.allowedExtensions.includes(ext)
              );
              const someSelected = group.extensions.some(ext =>
                submissionSettings.allowedExtensions.includes(ext)
              );

              return (
                <div key={group.label}>
                  <label className="flex items-center gap-2 mb-1">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected && !allSelected;
                      }}
                      onChange={() => toggleGroup(group.extensions)}
                      className="h-4 w-4 text-blue-600 rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">{group.label}</span>
                  </label>
                  <div className="ml-6 flex flex-wrap gap-2">
                    {group.extensions.map(ext => (
                      <label
                        key={ext}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs cursor-pointer transition-colors ${
                          submissionSettings.allowedExtensions.includes(ext)
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={submissionSettings.allowedExtensions.includes(ext)}
                          onChange={() => toggleExtension(ext)}
                          className="sr-only"
                        />
                        {ext}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
