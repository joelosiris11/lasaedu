import { Label } from '@shared/components/ui/Label';
import { Input } from '@shared/components/ui/Input';

export interface ForumLessonContent {
  prompt: string;
  settings: {
    allowNewThreads: boolean;
    requirePost: boolean;
    requireReply: boolean;
    minPostLength?: number;
  };
}

export const defaultForumContent: ForumLessonContent = {
  prompt: '',
  settings: {
    allowNewThreads: true,
    requirePost: true,
    requireReply: false,
  },
};

interface ForumLessonEditorProps {
  content: ForumLessonContent;
  onChange: (content: ForumLessonContent) => void;
}

export default function ForumLessonEditor({ content, onChange }: ForumLessonEditorProps) {
  const updateSettings = (key: keyof ForumLessonContent['settings'], value: boolean | number | undefined) => {
    onChange({
      ...content,
      settings: { ...content.settings, [key]: value },
    });
  };

  return (
    <div className="space-y-6">
      {/* Prompt / Tema de discusion */}
      <div>
        <Label htmlFor="forum-prompt">Tema de discusion / Pregunta *</Label>
        <p className="text-sm text-gray-500 mb-2">
          Este es el tema que los estudiantes veran y sobre el cual deberan discutir.
        </p>
        <textarea
          id="forum-prompt"
          value={content.prompt}
          onChange={(e) => onChange({ ...content, prompt: e.target.value })}
          placeholder="Ej: Analiza las ventajas y desventajas de los frameworks modernos de JavaScript. Justifica tu posicion con ejemplos concretos."
          className="w-full min-h-[120px] p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          maxLength={2000}
        />
        <span className="text-xs text-gray-400">{content.prompt.length}/2000</span>
      </div>

      {/* Settings */}
      <div className="space-y-4">
        <h3 className="font-medium text-gray-900">Configuracion del Foro</h3>

        <div className="flex items-center justify-between">
          <div>
            <Label className="font-medium">Permitir nuevos hilos</Label>
            <p className="text-sm text-gray-600">
              Los estudiantes pueden crear nuevos temas ademas de responder al principal
            </p>
          </div>
          <input
            type="checkbox"
            checked={content.settings.allowNewThreads}
            onChange={(e) => updateSettings('allowNewThreads', e.target.checked)}
            className="h-4 w-4 text-blue-600 rounded"
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label className="font-medium">Requiere participacion para completar</Label>
            <p className="text-sm text-gray-600">
              El estudiante debe publicar al menos una vez para completar la leccion
            </p>
          </div>
          <input
            type="checkbox"
            checked={content.settings.requirePost}
            onChange={(e) => updateSettings('requirePost', e.target.checked)}
            className="h-4 w-4 text-blue-600 rounded"
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label className="font-medium">Requiere responder a otro estudiante</Label>
            <p className="text-sm text-gray-600">
              Ademas de publicar, el estudiante debe responder a al menos un companero
            </p>
          </div>
          <input
            type="checkbox"
            checked={content.settings.requireReply}
            onChange={(e) => updateSettings('requireReply', e.target.checked)}
            className="h-4 w-4 text-blue-600 rounded"
          />
        </div>

        <div>
          <Label htmlFor="minPostLength">Longitud minima de publicacion (caracteres)</Label>
          <p className="text-sm text-gray-500 mb-1">
            Dejar vacio para no establecer un minimo
          </p>
          <Input
            id="minPostLength"
            type="number"
            value={content.settings.minPostLength || ''}
            onChange={(e) =>
              updateSettings('minPostLength', e.target.value ? parseInt(e.target.value) : undefined)
            }
            placeholder="Sin minimo"
            min={1}
            max={5000}
            className="max-w-xs"
          />
        </div>
      </div>
    </div>
  );
}
