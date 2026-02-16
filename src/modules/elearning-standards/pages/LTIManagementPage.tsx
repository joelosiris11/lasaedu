/**
 * Página de gestión de herramientas LTI
 * CRUD completo de herramientas LTI
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, ArrowLeft, Plus } from 'lucide-react';
import { Button } from '@shared/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@shared/components/ui/Card';
import { useAuthStore } from '@app/store/authStore';
import { ltiService } from '@shared/services/lti/ltiService';
import LTIToolList from '../components/LTIToolList';
import LTIToolConfigForm from '../components/LTIToolConfigForm';
import type { LTIToolConfig } from '@shared/types/elearning-standards';

export default function LTIManagementPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [tools, setTools] = useState<LTIToolConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTool, setEditingTool] = useState<LTIToolConfig | undefined>();

  useEffect(() => {
    loadTools();
  }, []);

  const loadTools = async () => {
    try {
      setLoading(true);
      const allTools = await ltiService.getTools();
      setTools(allTools);
    } catch (err) {
      console.error('Error cargando herramientas LTI:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (data: Omit<LTIToolConfig, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      if (editingTool) {
        await ltiService.updateTool(editingTool.id, data);
        setTools(prev => prev.map(t =>
          t.id === editingTool.id ? { ...t, ...data, updatedAt: Date.now() } : t
        ));
      } else {
        const newTool = await ltiService.createTool({
          ...data,
          createdBy: user?.id || ''
        });
        setTools(prev => [newTool, ...prev]);
      }
      setShowForm(false);
      setEditingTool(undefined);
    } catch (err) {
      console.error('Error guardando herramienta LTI:', err);
    }
  };

  const handleEdit = (tool: LTIToolConfig) => {
    setEditingTool(tool);
    setShowForm(true);
  };

  const handleDelete = async (toolId: string) => {
    if (!confirm('¿Estás seguro de eliminar esta herramienta LTI?')) return;

    try {
      await ltiService.deleteTool(toolId);
      setTools(prev => prev.filter(t => t.id !== toolId));
    } catch (err) {
      console.error('Error eliminando herramienta:', err);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingTool(undefined);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Herramientas LTI</h1>
            <p className="text-gray-500">Configura herramientas externas LTI</p>
          </div>
        </div>
        {!showForm && (
          <Button onClick={() => { setEditingTool(undefined); setShowForm(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Herramienta
          </Button>
        )}
      </div>

      {/* Formulario */}
      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>
              {editingTool ? 'Editar Herramienta LTI' : 'Nueva Herramienta LTI'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LTIToolConfigForm
              tool={editingTool}
              onSave={handleSave}
              onCancel={handleCancel}
            />
          </CardContent>
        </Card>
      )}

      {/* Lista */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Cargando herramientas...</div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5" />
              Herramientas Configuradas ({tools.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LTIToolList
              tools={tools}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
