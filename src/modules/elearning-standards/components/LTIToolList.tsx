/**
 * Lista de herramientas LTI configuradas
 */

import { ExternalLink, Edit, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@shared/components/ui/Button';
import type { LTIToolConfig } from '@shared/types/elearning-standards';

interface LTIToolListProps {
  tools: LTIToolConfig[];
  onEdit: (tool: LTIToolConfig) => void;
  onDelete: (toolId: string) => void;
  onLaunch?: (tool: LTIToolConfig) => void;
}

export default function LTIToolList({ tools, onEdit, onDelete, onLaunch }: LTIToolListProps) {
  if (tools.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <ExternalLink className="h-12 w-12 mx-auto mb-3 text-gray-300" />
        <p>No hay herramientas LTI configuradas</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tools.map((tool) => (
        <div
          key={tool.id}
          className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-4">
            {/* Icono */}
            {tool.iconUrl ? (
              <img
                src={tool.iconUrl}
                alt={tool.name}
                className="h-10 w-10 rounded object-cover"
              />
            ) : (
              <div className="h-10 w-10 rounded bg-blue-100 flex items-center justify-center">
                <ExternalLink className="h-5 w-5 text-blue-600" />
              </div>
            )}

            {/* Info */}
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-medium">{tool.name}</h4>
                {tool.isActive ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-gray-400" />
                )}
                <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-600">
                  LTI {tool.version}
                </span>
              </div>
              {tool.description && (
                <p className="text-sm text-gray-500 mt-0.5">{tool.description}</p>
              )}
              <p className="text-xs text-gray-400 mt-0.5 truncate max-w-md">{tool.launchUrl}</p>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-2">
            {onLaunch && tool.isActive && (
              <Button variant="outline" size="sm" onClick={() => onLaunch(tool)}>
                <ExternalLink className="h-4 w-4 mr-1" />
                Probar
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => onEdit(tool)}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onDelete(tool.id)}>
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
