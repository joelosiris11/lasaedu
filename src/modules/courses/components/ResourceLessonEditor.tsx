import { Label } from '@shared/components/ui/Label';
import { RichTextEditor } from '@shared/components/editor';
import FileUploadZone, { type UploadedFile } from '@shared/components/upload/FileUploadZone';

export interface ResourceFile {
  id: string;
  name: string;
  url: string;
  size: number;
  contentType: string;
}

export interface ResourceLessonContent {
  textContent: string; // HTML
  files: ResourceFile[];
}

export const defaultResourceContent: ResourceLessonContent = {
  textContent: '',
  files: [],
};

interface ResourceLessonEditorProps {
  content: ResourceLessonContent;
  onChange: (content: ResourceLessonContent) => void;
  courseId?: string;
  lessonId?: string;
}

const RESOURCE_EXTENSIONS = [
  '.pdf', '.docx', '.pptx', '.xlsx',
  '.odt', '.ods', '.odp',
  '.zip', '.rar',
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.csv', '.txt',
];

export default function ResourceLessonEditor({
  content,
  onChange,
  courseId,
  lessonId,
}: ResourceLessonEditorProps) {
  const handleFilesChange = (files: UploadedFile[]) => {
    const resourceFiles: ResourceFile[] = files.map(f => ({
      id: f.id,
      name: f.name,
      url: f.url,
      size: f.size,
      contentType: f.contentType,
    }));
    onChange({ ...content, files: resourceFiles });
  };

  const uploadedFiles: UploadedFile[] = content.files.map(f => ({
    id: f.id,
    name: f.name,
    url: f.url,
    size: f.size,
    contentType: f.contentType,
  }));

  return (
    <div className="space-y-6">
      {/* Rich text content */}
      <div>
        <Label>Contenido del Recurso</Label>
        <p className="text-sm text-gray-500 mb-2">
          Descripcion, instrucciones o contexto del material
        </p>
        <RichTextEditor
          content={content.textContent}
          onChange={(html) => onChange({ ...content, textContent: html })}
          placeholder="Describe el recurso y como utilizarlo..."
          className="min-h-[250px]"
        />
      </div>

      {/* File attachments */}
      <div>
        <Label>Archivos Adjuntos</Label>
        <p className="text-sm text-gray-500 mb-2">
          Sube documentos, imagenes u otros archivos para los estudiantes
        </p>
        <FileUploadZone
          files={uploadedFiles}
          onFilesChange={handleFilesChange}
          maxFiles={10}
          allowedExtensions={RESOURCE_EXTENSIONS}
          maxFileSize={25 * 1024 * 1024}
          courseId={courseId}
          lessonId={lessonId}
          storagePath="attachment"
        />
      </div>
    </div>
  );
}
