import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, History as HistoryIcon, Loader2, Star } from 'lucide-react';
import { Modal } from '@shared/components/ui/Modal';
import { Button } from '@shared/components/ui/Button';
import {
  activateVersion,
  listVersions,
  type DBPromptVersion,
} from '../services/promptVersions';

interface VersionManagerProps {
  open: boolean;
  onClose: () => void;
  /** Called after a version is activated; the parent reloads the model. */
  onActivated: (version: DBPromptVersion) => void;
}

export default function VersionManager({ open, onClose, onActivated }: VersionManagerProps) {
  const [versions, setVersions] = useState<DBPromptVersion[] | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activating, setActivating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const rows = await listVersions();
      setVersions(rows);
      const active = rows.find((v) => v.isActive);
      setExpandedId(active?.id ?? rows[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const handleActivate = async (id: string) => {
    setActivating(id);
    try {
      const activated = await activateVersion(id);
      onActivated(activated);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActivating(null);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="4xl"
      title="Versiones del asistente"
      subtitle="Historial del system prompt. Se guardan hasta 5; las más antiguas se eliminan al crear nuevas."
    >
      {error && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {!versions ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando versiones…
        </div>
      ) : versions.length === 0 ? (
        <div className="text-sm text-gray-500">
          Aún no hay versiones guardadas. Se creará la inicial la primera vez que abras el asistente.
        </div>
      ) : (
        <ul className="space-y-3">
          {versions.map((v) => {
            const isExpanded = expandedId === v.id;
            return (
              <li
                key={v.id}
                className={`rounded-lg border ${
                  v.isActive ? 'border-red-300 bg-red-50/40' : 'border-gray-200 bg-white'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : v.id)}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left"
                >
                  <div
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      v.isActive
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    v{v.versionNumber}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 truncate">{v.reason}</span>
                      {v.isActive && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                          <Star className="h-2.5 w-2.5" fill="currentColor" />
                          Activa
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[11px] text-gray-500">
                      {new Date(v.createdAt).toLocaleString('es-DO')} · por {v.createdByName}
                    </div>
                  </div>
                  <div className="shrink-0 text-xs text-gray-400">
                    {isExpanded ? 'Ocultar' : 'Ver contenido'}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-200 px-4 py-3">
                    <pre className="whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-[11px] leading-relaxed text-gray-700 max-h-80 overflow-y-auto font-mono">
                      {v.content}
                    </pre>
                    {!v.isActive && (
                      <div className="mt-3 flex justify-end">
                        <Button
                          onClick={() => handleActivate(v.id)}
                          disabled={activating === v.id}
                          className="bg-red-600 hover:bg-red-700 text-white"
                        >
                          {activating === v.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                          )}
                          Activar esta versión
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-6 flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-600">
        <HistoryIcon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <div>
          El asistente puede auto-modificar su prompt cuando le das feedback concreto.
          Cada cambio se guarda aquí como nueva versión y puedes volver a una anterior en cualquier momento.
        </div>
      </div>
    </Modal>
  );
}
