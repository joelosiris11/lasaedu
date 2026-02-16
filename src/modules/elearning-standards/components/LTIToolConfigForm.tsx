/**
 * Formulario de configuración de herramienta LTI
 * Para crear o editar herramientas LTI
 */

import { useState } from 'react';
import { Save, X } from 'lucide-react';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { Label } from '@shared/components/ui/Label';
import type { LTIToolConfig } from '@shared/types/elearning-standards';

interface LTIToolConfigFormProps {
  tool?: LTIToolConfig;
  onSave: (data: Omit<LTIToolConfig, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

export default function LTIToolConfigForm({ tool, onSave, onCancel }: LTIToolConfigFormProps) {
  const [name, setName] = useState(tool?.name || '');
  const [description, setDescription] = useState(tool?.description || '');
  const [launchUrl, setLaunchUrl] = useState(tool?.launchUrl || '');
  const [consumerKey, setConsumerKey] = useState(tool?.consumerKey || '');
  const [consumerSecret, setConsumerSecret] = useState(tool?.consumerSecret || '');
  const [version, setVersion] = useState<'1.1' | '1.3'>(tool?.version || '1.1');
  const [privacyLevel, setPrivacyLevel] = useState<LTIToolConfig['privacyLevel']>(
    tool?.privacyLevel || 'public'
  );
  const [iconUrl, setIconUrl] = useState(tool?.iconUrl || '');
  const [supportsOutcomes, setSupportsOutcomes] = useState(tool?.supportsOutcomes || false);
  const [isActive, setIsActive] = useState(tool?.isActive ?? true);
  const [customParamsText, setCustomParamsText] = useState(
    tool?.customParameters
      ? Object.entries(tool.customParameters).map(([k, v]) => `${k}=${v}`).join('\n')
      : ''
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'El nombre es requerido';
    if (!launchUrl.trim()) newErrors.launchUrl = 'La URL de lanzamiento es requerida';
    if (!consumerKey.trim()) newErrors.consumerKey = 'La clave del consumidor es requerida';
    if (!consumerSecret.trim()) newErrors.consumerSecret = 'El secreto del consumidor es requerido';

    try {
      new URL(launchUrl);
    } catch {
      if (launchUrl.trim()) newErrors.launchUrl = 'URL no válida';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const customParameters: Record<string, string> = {};
    if (customParamsText.trim()) {
      customParamsText.split('\n').forEach(line => {
        const [key, ...rest] = line.split('=');
        if (key?.trim() && rest.length > 0) {
          customParameters[key.trim()] = rest.join('=').trim();
        }
      });
    }

    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      launchUrl: launchUrl.trim(),
      consumerKey: consumerKey.trim(),
      consumerSecret: consumerSecret.trim(),
      version,
      privacyLevel,
      iconUrl: iconUrl.trim() || undefined,
      supportsOutcomes,
      isActive,
      customParameters: Object.keys(customParameters).length > 0 ? customParameters : undefined,
      createdBy: tool?.createdBy || '',
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Nombre */}
        <div>
          <Label htmlFor="lti-name">Nombre *</Label>
          <Input
            id="lti-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Khan Academy"
            className={errors.name ? 'border-red-500' : ''}
          />
          {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
        </div>

        {/* URL de lanzamiento */}
        <div>
          <Label htmlFor="lti-url">URL de Lanzamiento *</Label>
          <Input
            id="lti-url"
            value={launchUrl}
            onChange={(e) => setLaunchUrl(e.target.value)}
            placeholder="https://tool.example.com/lti/launch"
            className={errors.launchUrl ? 'border-red-500' : ''}
          />
          {errors.launchUrl && <p className="text-red-500 text-sm mt-1">{errors.launchUrl}</p>}
        </div>

        {/* Consumer Key */}
        <div>
          <Label htmlFor="lti-key">Clave del Consumidor *</Label>
          <Input
            id="lti-key"
            value={consumerKey}
            onChange={(e) => setConsumerKey(e.target.value)}
            placeholder="consumer_key"
            className={errors.consumerKey ? 'border-red-500' : ''}
          />
          {errors.consumerKey && <p className="text-red-500 text-sm mt-1">{errors.consumerKey}</p>}
        </div>

        {/* Consumer Secret */}
        <div>
          <Label htmlFor="lti-secret">Secreto del Consumidor *</Label>
          <Input
            id="lti-secret"
            type="password"
            value={consumerSecret}
            onChange={(e) => setConsumerSecret(e.target.value)}
            placeholder="consumer_secret"
            className={errors.consumerSecret ? 'border-red-500' : ''}
          />
          {errors.consumerSecret && <p className="text-red-500 text-sm mt-1">{errors.consumerSecret}</p>}
        </div>

        {/* Versión */}
        <div>
          <Label htmlFor="lti-version">Versión LTI</Label>
          <select
            id="lti-version"
            value={version}
            onChange={(e) => setVersion(e.target.value as '1.1' | '1.3')}
            className="w-full h-10 px-3 border border-gray-300 rounded-md text-sm"
          >
            <option value="1.1">LTI 1.1</option>
            <option value="1.3">LTI 1.3</option>
          </select>
        </div>

        {/* Nivel de privacidad */}
        <div>
          <Label htmlFor="lti-privacy">Nivel de Privacidad</Label>
          <select
            id="lti-privacy"
            value={privacyLevel}
            onChange={(e) => setPrivacyLevel(e.target.value as LTIToolConfig['privacyLevel'])}
            className="w-full h-10 px-3 border border-gray-300 rounded-md text-sm"
          >
            <option value="public">Público (nombre + email)</option>
            <option value="name_only">Solo nombre</option>
            <option value="email_only">Solo email</option>
            <option value="anonymous">Anónimo</option>
          </select>
        </div>

        {/* URL del icono */}
        <div>
          <Label htmlFor="lti-icon">URL del Icono (opcional)</Label>
          <Input
            id="lti-icon"
            value={iconUrl}
            onChange={(e) => setIconUrl(e.target.value)}
            placeholder="https://example.com/icon.png"
          />
        </div>

        {/* Descripción */}
        <div>
          <Label htmlFor="lti-desc">Descripción</Label>
          <Input
            id="lti-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descripción de la herramienta"
          />
        </div>
      </div>

      {/* Parámetros personalizados */}
      <div>
        <Label htmlFor="lti-params">Parámetros Personalizados (uno por línea: clave=valor)</Label>
        <textarea
          id="lti-params"
          value={customParamsText}
          onChange={(e) => setCustomParamsText(e.target.value)}
          placeholder={"lang=es\ntheme=dark"}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-none"
        />
      </div>

      {/* Toggles */}
      <div className="flex gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={supportsOutcomes}
            onChange={(e) => setSupportsOutcomes(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span className="text-sm">Soporta calificaciones (Outcomes)</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span className="text-sm">Activa</span>
        </label>
      </div>

      {/* Acciones */}
      <div className="flex gap-3 pt-4 border-t">
        <Button type="submit">
          <Save className="h-4 w-4 mr-2" />
          {tool ? 'Actualizar' : 'Crear'} Herramienta
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          <X className="h-4 w-4 mr-2" />
          Cancelar
        </Button>
      </div>
    </form>
  );
}
