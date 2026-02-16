/**
 * Componente para lanzar herramientas LTI
 * Carga la configuración, construye parámetros y abre en iframe
 */

import { useState, useEffect, useRef } from 'react';
import { Loader2, AlertTriangle, ExternalLink } from 'lucide-react';
import { Button } from '@shared/components/ui/Button';
import { ltiService } from '@shared/services/lti/ltiService';
import type { LTIToolConfig } from '@shared/types/elearning-standards';

interface LTIToolLauncherProps {
  toolId: string;
  lessonId: string;
  courseId: string;
  courseTitle?: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  userRole: 'admin' | 'teacher' | 'student';
  onLaunch?: () => void;
  onError?: (error: string) => void;
}

export default function LTIToolLauncher({
  toolId,
  lessonId,
  courseId,
  courseTitle,
  userId,
  userName,
  userEmail,
  userRole,
  onLaunch,
  onError,
}: LTIToolLauncherProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tool, setTool] = useState<LTIToolConfig | null>(null);
  const [launched, setLaunched] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    async function loadTool() {
      try {
        setLoading(true);
        const toolConfig = await ltiService.getTool(toolId);
        if (!toolConfig) {
          throw new Error('Herramienta LTI no encontrada');
        }
        if (!toolConfig.isActive) {
          throw new Error('Esta herramienta LTI no está activa');
        }
        setTool(toolConfig);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error al cargar herramienta LTI';
        setError(msg);
        onError?.(msg);
      } finally {
        setLoading(false);
      }
    }
    loadTool();
  }, [toolId, onError]);

  const handleLaunch = async () => {
    if (!tool) return;

    try {
      const params = ltiService.buildLaunchParams({
        tool,
        userId,
        userName,
        userEmail,
        userRole,
        courseId,
        courseTitle,
        lessonId,
        resourceLinkId: `${courseId}_${lessonId}_${toolId}`,
      });

      const formHTML = ltiService.buildLaunchFormHTML(tool.launchUrl, params);

      await ltiService.recordLaunch({
        toolId: tool.id,
        userId,
        courseId,
        lessonId,
        launchedAt: Date.now(),
        status: 'launched',
      });

      // Escribir el formulario en el iframe
      if (iframeRef.current) {
        const doc = iframeRef.current.contentDocument;
        if (doc) {
          doc.open();
          doc.write(formHTML);
          doc.close();
        }
      }

      setLaunched(true);
      onLaunch?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al lanzar herramienta LTI';
      setError(msg);
      onError?.(msg);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <Loader2 className="h-10 w-10 text-blue-500 animate-spin mb-4" />
        <p className="text-gray-600">Cargando herramienta LTI...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <AlertTriangle className="h-10 w-10 text-red-500 mb-4" />
        <p className="text-red-600 font-medium mb-2">Error</p>
        <p className="text-gray-500 text-sm">{error}</p>
      </div>
    );
  }

  if (!launched) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <ExternalLink className="h-16 w-16 text-blue-500 mb-4" />
        <h3 className="text-lg font-semibold mb-2">{tool?.name}</h3>
        {tool?.description && (
          <p className="text-gray-600 mb-4 text-center max-w-md">{tool.description}</p>
        )}
        <Button onClick={handleLaunch}>
          <ExternalLink className="h-4 w-4 mr-2" />
          Lanzar Herramienta
        </Button>
        {/* iframe oculto hasta el lanzamiento */}
        <iframe ref={iframeRef} className="hidden" title="LTI Launch" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b">
        <span className="text-sm text-gray-600">
          LTI {tool?.version} &mdash; {tool?.name}
        </span>
        <Button variant="ghost" size="sm" onClick={handleLaunch}>
          <ExternalLink className="h-4 w-4 mr-1" />
          Relanzar
        </Button>
      </div>
      <iframe
        ref={iframeRef}
        title={tool?.name || 'Herramienta LTI'}
        className="flex-1 w-full border-0"
        style={{ minHeight: '500px' }}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    </div>
  );
}
