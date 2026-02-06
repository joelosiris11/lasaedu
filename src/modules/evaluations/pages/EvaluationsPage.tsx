import { useState, useEffect } from 'react';
import { useAuthStore } from '@app/store/authStore';
import { evaluationService } from '@shared/services/dataService';
import type { DBEvaluation } from '@shared/services/dataService';
import { 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Eye,
  Clock,
  Star,
  BookOpen,
  CheckCircle,
  AlertCircle,
  Play,
  FileText,
  BarChart3,
  MessageSquare
} from 'lucide-react';
import { Card, CardContent } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { Label } from '@shared/components/ui/Label';

const EvaluationsPage = () => {
  const { user } = useAuthStore();
  const [evaluations, setEvaluations] = useState<DBEvaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  // const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingEvaluation, setEditingEvaluation] = useState<DBEvaluation | null>(null);

  const loadEvaluations = async () => {
    setLoading(true);
    try {
      const data = await evaluationService.getAll();
      setEvaluations(data);
    } catch (error) {
      console.error('Error loading evaluations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvaluations();
  }, []);

  // Filtrar evaluaciones según rol y filtros
  const filteredDBEvaluations = evaluations.filter(evaluation => {
    const matchesSearch = evaluation.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         evaluation.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || evaluation.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || evaluation.status === statusFilter;

    // Si es profesor, solo ver sus evaluaciones
    if (user?.role === 'teacher') {
      return evaluation.createdBy === user.id && matchesSearch && matchesType && matchesStatus;
    }

    // Si es estudiante, solo ver evaluaciones publicadas
    if (user?.role === 'student') {
      return evaluation.status === 'publicado' && matchesSearch && matchesType && matchesStatus;
    }

    return matchesSearch && matchesType && matchesStatus;
  });

  // Estadísticas
  const stats = {
    total: user?.role === 'teacher'
      ? evaluations.filter(e => e.createdBy === user.id).length
      : evaluations.length,
    active: evaluations.filter(e => e.status === 'publicado' &&
      (user?.role !== 'teacher' || e.createdBy === user.id)).length,
    archived: evaluations.filter(e => e.status === 'archivado' &&
      (user?.role !== 'teacher' || e.createdBy === user.id)).length,
    draft: evaluations.filter(e => e.status === 'borrador' &&
      (user?.role !== 'teacher' || e.createdBy === user.id)).length
  };

  const handleCreateDBEvaluation = async (evaluationData: Partial<DBEvaluation>) => {
    try {
      const now = Date.now();
      const newDBEvaluation = await evaluationService.create({
        ...evaluationData,
        title: evaluationData.title || '',
        description: evaluationData.description || '',
        type: evaluationData.type || 'quiz',
        courseId: evaluationData.courseId || '',
        status: 'borrador',
        questions: evaluationData.questions || [],
        settings: evaluationData.settings || {
          shuffleQuestions: false,
          shuffleOptions: false,
          showResults: true,
          passingScore: 60
        },
        createdAt: now,
        updatedAt: now
      } as Omit<DBEvaluation, 'id'>);

      setEvaluations([...evaluations, newDBEvaluation]);
      setShowCreateModal(false);
    } catch (error) {
      console.error('Error creating evaluation:', error);
    }
  };

  const handleEditDBEvaluation = async (evaluationData: Partial<DBEvaluation>) => {
    if (!editingEvaluation) return;

    try {
      await evaluationService.update(editingEvaluation.id, {
        ...evaluationData,
        updatedAt: Date.now()
      });
      const updatedDBEvaluation = { ...editingEvaluation, ...evaluationData, updatedAt: Date.now() };
      setEvaluations(evaluations.map(e => e.id === editingEvaluation.id ? updatedDBEvaluation : e));
      setShowEditModal(false);
      setEditingEvaluation(null);
    } catch (error) {
      console.error('Error updating evaluation:', error);
    }
  };

  const handleDeleteDBEvaluation = async (evaluationId: string) => {
    if (confirm('¿Estás seguro de que quieres eliminar esta evaluación?')) {
      try {
        await evaluationService.delete(evaluationId);
        setEvaluations(evaluations.filter(e => e.id !== evaluationId));
      } catch (error) {
        console.error('Error deleting evaluation:', error);
      }
    }
  };

  const getTypeIcon = (type: DBEvaluation['type']) => {
    const icons = {
      quiz: CheckCircle,
      tarea: FileText,
      examen: AlertCircle,
      proyecto: BarChart3
    };
    return icons[type];
  };

  const getStatusBadge = (status: DBEvaluation['status']) => {
    const badges: Record<DBEvaluation['status'], { color: string; text: string }> = {
      borrador: { color: 'bg-gray-100 text-gray-800', text: 'Borrador' },
      publicado: { color: 'bg-green-100 text-green-800', text: 'Publicado' },
      archivado: { color: 'bg-blue-100 text-blue-800', text: 'Archivado' }
    };
    const badge = badges[status];
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
        {badge.text}
      </span>
    );
  };

  const getTypeBadge = (type: DBEvaluation['type']) => {
    const badges = {
      quiz: { color: 'bg-blue-100 text-blue-800', text: 'Quiz' },
      tarea: { color: 'bg-yellow-100 text-yellow-800', text: 'Tarea' },
      examen: { color: 'bg-red-100 text-red-800', text: 'Examen' },
      proyecto: { color: 'bg-purple-100 text-purple-800', text: 'Proyecto' }
    };
    const badge = badges[type];
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
        {badge.text}
      </span>
    );
  };

  const canManageEvaluations = user?.role === 'admin' || user?.role === 'teacher';
  const isStudent = user?.role === 'student';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isStudent ? 'Evaluaciones' : 
             user?.role === 'teacher' ? 'Mis Evaluaciones' : 'Gestión de Evaluaciones'}
          </h1>
          <p className="text-gray-600">
            {isStudent ? 'Revisa tus evaluaciones pendientes y completadas' :
             user?.role === 'teacher' ? 'Crea y gestiona evaluaciones para tus cursos' : 
             'Administra todas las evaluaciones de la plataforma'}
          </p>
        </div>
        {canManageEvaluations && (
          <Button onClick={() => setShowCreateModal(true)} className="flex items-center">
            <Plus className="h-4 w-4 mr-2" />
            Nueva Evaluación
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Evaluaciones</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <Play className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Activas</p>
                <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Archivadas</p>
                <p className="text-2xl font-bold text-gray-900">{stats.archived}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 bg-gray-100 rounded-lg">
                <Edit3 className="h-6 w-6 text-gray-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Borradores</p>
                <p className="text-2xl font-bold text-gray-900">{stats.draft}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar evaluaciones..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-full md:w-48">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Todos los tipos</option>
                <option value="quiz">Quiz</option>
                <option value="tarea">Tarea</option>
                <option value="examen">Examen</option>
                <option value="proyecto">Proyecto</option>
              </select>
            </div>
            <div className="w-full md:w-48">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Todos los estados</option>
                <option value="activa">Activas</option>
                <option value="completada">Completadas</option>
                <option value="borrador">Borradores</option>
                <option value="cerrada">Cerradas</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* DBEvaluations List */}
      <div className="space-y-4">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </CardContent>
            </Card>
          ))
        ) : filteredDBEvaluations.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No se encontraron evaluaciones</h3>
              <p className="text-gray-500 mb-6">
                {canManageEvaluations 
                  ? 'Aún no has creado ninguna evaluación. ¡Crea tu primera evaluación!'
                  : 'No hay evaluaciones disponibles en este momento'
                }
              </p>
              {canManageEvaluations && (
                <Button onClick={() => setShowCreateModal(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Primera Evaluación
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredDBEvaluations.map((evaluation) => {
            const TypeIcon = getTypeIcon(evaluation.type);
            return (
              <Card key={evaluation.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      <div className="p-3 bg-gray-100 rounded-lg">
                        <TypeIcon className="h-6 w-6 text-gray-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="font-semibold text-lg text-gray-900">{evaluation.title}</h3>
                          {getTypeBadge(evaluation.type)}
                          {getStatusBadge(evaluation.status)}
                        </div>
                        <p className="text-gray-600 mb-3">{evaluation.description}</p>
                        <div className="flex items-center space-x-6 text-sm text-gray-500">
                          <div className="flex items-center">
                            <BookOpen className="h-4 w-4 mr-1" />
                            <span>Curso: {evaluation.courseId}</span>
                          </div>
                          {evaluation.dueDate && (
                            <div className="flex items-center">
                              <Clock className="h-4 w-4 mr-1" />
                              <span>Vence: {new Date(evaluation.dueDate).toLocaleDateString()}</span>
                            </div>
                          )}
                          <div className="flex items-center">
                            <Star className="h-4 w-4 mr-1" />
                            <span>{evaluation.questions?.length || 0} preguntas</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex space-x-2 ml-4">
                      {isStudent ? (
                        <>
                          <Button size="sm" className="flex items-center">
                            <Play className="h-4 w-4 mr-1" />
                            Iniciar
                          </Button>
                          <Button size="sm" variant="outline">
                            <BarChart3 className="h-4 w-4 mr-1" />
                            Resultados
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="outline">
                            <Eye className="h-4 w-4 mr-1" />
                            Ver
                          </Button>
                          {canManageEvaluations && (evaluation.createdBy === user?.id || user?.role === 'admin') && (
                            <>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => {
                                  setEditingEvaluation(evaluation);
                                  setShowEditModal(true);
                                }}
                              >
                                <Edit3 className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="outline">
                                <MessageSquare className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleDeleteDBEvaluation(evaluation.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Create DBEvaluation Modal */}
      {showCreateModal && (
        <EvaluationModal
          title="Crear Evaluación"
          evaluation={null}
          onSave={handleCreateDBEvaluation}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {/* Edit DBEvaluation Modal */}
      {showEditModal && editingEvaluation && (
        <EvaluationModal
          title="Editar Evaluación"
          evaluation={editingEvaluation}
          onSave={handleEditDBEvaluation}
          onClose={() => {
            setShowEditModal(false);
            setEditingEvaluation(null);
          }}
        />
      )}
    </div>
  );
};

// Modal Component para crear/editar evaluaciones
const EvaluationModal = ({ 
  title, 
  evaluation, 
  onSave, 
  onClose 
}: { 
  title: string;
  evaluation: DBEvaluation | null;
  onSave: (data: Partial<DBEvaluation>) => void;
  onClose: () => void;
}) => {
  const [formData, setFormData] = useState({
    title: evaluation?.title || '',
    description: evaluation?.description || '',
    type: evaluation?.type || 'quiz' as DBEvaluation['type'],
    courseId: evaluation?.courseId || '',
    dueDate: evaluation?.dueDate || '',
    passingScore: evaluation?.settings?.passingScore || 60,
    timeLimit: evaluation?.settings?.timeLimit || 30,
    attempts: evaluation?.settings?.attempts || 1
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            ×
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="title">Título de la evaluación</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="ej. Quiz Capítulo 1"
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Descripción</Label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe el contenido de la evaluación..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-24"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="type">Tipo de evaluación</Label>
              <select
                id="type"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as DBEvaluation['type'] })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="quiz">Quiz</option>
                <option value="tarea">Tarea</option>
                <option value="examen">Examen</option>
                <option value="proyecto">Proyecto</option>
              </select>
            </div>

            <div>
              <Label htmlFor="courseId">ID del Curso</Label>
              <Input
                id="courseId"
                value={formData.courseId}
                onChange={(e) => setFormData({ ...formData, courseId: e.target.value })}
                placeholder="ej. course_123"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="dueDate">Fecha límite</Label>
              <Input
                id="dueDate"
                type="datetime-local"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="passingScore">Puntuación mínima para aprobar (%)</Label>
              <Input
                id="passingScore"
                type="number"
                value={formData.passingScore}
                onChange={(e) => setFormData({ ...formData, passingScore: parseInt(e.target.value) })}
                min="0"
                max="100"
                required
              />
            </div>

            <div>
              <Label htmlFor="timeLimit">Tiempo límite (min)</Label>
              <Input
                id="timeLimit"
                type="number"
                value={formData.timeLimit}
                onChange={(e) => setFormData({ ...formData, timeLimit: parseInt(e.target.value) })}
                min="1"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="attempts">Intentos permitidos</Label>
            <Input
              id="attempts"
              type="number"
              value={formData.attempts}
              onChange={(e) => setFormData({ ...formData, attempts: parseInt(e.target.value) })}
              min="1"
              max="10"
              required
            />
          </div>

          <div className="flex space-x-3 pt-6 border-t">
            <Button type="submit" className="flex-1">
              {evaluation ? 'Guardar cambios' : 'Crear evaluación'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EvaluationsPage;