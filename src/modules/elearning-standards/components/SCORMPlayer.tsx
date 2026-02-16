/**
 * Reproductor de paquetes SCORM
 * Carga contenido SCORM en un iframe e inicializa el Runtime Environment
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { Button } from '@shared/components/ui/Button';
import { scormPackageService } from '@shared/services/scorm/scormPackageService';
import { scormDataService } from '@shared/services/scorm/scormDataService';
import { createSCORMAPI, installSCORMAPI, uninstallSCORMAPI } from '@shared/services/scorm/scormRTE';
import type { SCORMRuntimeData, SCORMPackage } from '@shared/types/elearning-standards';

interface SCORMPlayerProps {
  packageId: string;
  lessonId: string;
  courseId: string;
  userId: string;
  onComplete?: (data: SCORMRuntimeData) => void;
  onProgress?: (data: SCORMRuntimeData) => void;
}

export default function SCORMPlayer({
  packageId,
  lessonId,
  courseId,
  userId,
  onComplete,
  onProgress,
}: SCORMPlayerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [launchUrl, setLaunchUrl] = useState<string | null>(null);
  const [pkg, setPkg] = useState<SCORMPackage | null>(null);
  const [completed, setCompleted] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const runtimeDataRef = useRef<SCORMRuntimeData | null>(null);

  const handleCommit = useCallback(async (data: SCORMRuntimeData) => {
    await scormDataService.saveRuntimeData(data);
    runtimeDataRef.current = data;
    onProgress?.(data);
  }, [onProgress]);

  const handleFinish = useCallback(async (data: SCORMRuntimeData) => {
    await scormDataService.saveRuntimeData(data);
    runtimeDataRef.current = data;

    if (data.completionStatus === 'completed' || data.successStatus === 'passed') {
      setCompleted(true);
      onComplete?.(data);
    }
  }, [onComplete]);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        setLoading(true);
        setError(null);

        const scormPkg = await scormPackageService.getPackage(packageId);
        if (!scormPkg || !mounted) return;
        setPkg(scormPkg);

        const runtimeData = await scormDataService.getOrCreateRuntimeData(
          userId, packageId, lessonId, courseId, scormPkg.version
        );
        runtimeDataRef.current = runtimeData;

        const api = createSCORMAPI(scormPkg.version, runtimeData, handleCommit, handleFinish);
        installSCORMAPI(scormPkg.version, api);

        const url = await scormPackageService.getLaunchUrl(packageId);
        if (mounted) {
          setLaunchUrl(url);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Error al cargar el paquete SCORM');
          setLoading(false);
        }
      }
    }

    init();

    return () => {
      mounted = false;
      if (pkg) {
        uninstallSCORMAPI(pkg.version);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packageId, userId, lessonId, courseId]);

  const handleReload = () => {
    if (iframeRef.current && launchUrl) {
      iframeRef.current.src = launchUrl;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <Loader2 className="h-10 w-10 text-blue-500 animate-spin mb-4" />
        <p className="text-gray-600">Cargando contenido SCORM...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <AlertTriangle className="h-10 w-10 text-red-500 mb-4" />
        <p className="text-red-600 font-medium mb-2">Error al cargar SCORM</p>
        <p className="text-gray-500 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Barra de estado */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">
            SCORM {pkg?.version} &mdash; {pkg?.title}
          </span>
          {completed && (
            <span className="flex items-center gap-1 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" />
              Completado
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={handleReload}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Recargar
        </Button>
      </div>

      {/* Contenido SCORM */}
      {launchUrl && (
        <iframe
          ref={iframeRef}
          src={launchUrl}
          title={pkg?.title || 'Contenido SCORM'}
          className="flex-1 w-full border-0"
          style={{ minHeight: '500px' }}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      )}
    </div>
  );
}
