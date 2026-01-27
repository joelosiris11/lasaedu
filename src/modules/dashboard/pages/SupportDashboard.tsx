import { useAuthStore } from '@app/store/authStore';
import { 
  Headphones, 
  Clock, 
  CheckCircle, 
  MessageSquare,
  Users,
  TrendingUp,
  FileText,
  Search,
  Filter,
  MoreHorizontal
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/Card';
import { useSupportStats, useSupportTickets, useRecentActivity } from '@shared/hooks/useDashboard';

const SupportDashboard = () => {
  const { user } = useAuthStore();
  const { stats, loading: statsLoading } = useSupportStats();
  const { tickets, loading: ticketsLoading } = useSupportTickets();
  const { activities, loading: activitiesLoading } = useRecentActivity(4);

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Cargando estadísticas...</div>
      </div>
    );
  }

  const statsCards = stats ? [
    { title: 'Tickets Abiertos', value: stats.open.toString(), icon: MessageSquare, color: 'text-blue-600' },
    { title: 'En Progreso', value: stats.inProgress.toString(), icon: Clock, color: 'text-green-600' },
    { title: 'Resueltos', value: stats.resolved.toString(), icon: CheckCircle, color: 'text-purple-600' },
    { title: 'Alta Prioridad', value: stats.highPriority.toString(), icon: TrendingUp, color: 'text-orange-600' },
  ] : [];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgente': return 'text-red-600 bg-red-100';
      case 'alta': return 'text-orange-600 bg-orange-100';
      case 'media': return 'text-yellow-600 bg-yellow-100';
      case 'baja': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'text-blue-600 bg-blue-100';
      case 'open': return 'text-blue-600 bg-blue-100';
      case 'in_progress': return 'text-purple-600 bg-purple-100';
      case 'waiting': return 'text-yellow-600 bg-yellow-100';
      case 'resolved': return 'text-green-600 bg-green-100';
      case 'closed': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const translateStatus = (status: string) => {
    const map: Record<string, string> = {
      new: 'Nuevo',
      open: 'Abierto',
      in_progress: 'En Progreso',
      waiting: 'Esperando',
      resolved: 'Resuelto',
      closed: 'Cerrado'
    };
    return map[status] || status;
  };

  const translatePriority = (priority: string) => {
    const map: Record<string, string> = {
      baja: 'Baja',
      media: 'Media',
      alta: 'Alta',
      urgente: 'Urgente'
    };
    return map[priority] || priority;
  };

  // Evitar warnings de funciones no usadas
  void translateStatus;
  void translatePriority;

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-teal-600 to-teal-800 rounded-xl p-6 text-white">
        <h1 className="text-2xl font-bold">¡Bienvenido, {user?.name}!</h1>
        <p className="text-teal-100 mt-2">
          Centro de Soporte - Ayuda a nuestros usuarios
        </p>
        <div className="mt-4 flex items-center space-x-4">
          <div className="flex items-center">
            <Headphones className="h-5 w-5 mr-2" />
            <span>Estado: Disponible</span>
          </div>
          <div className="bg-teal-700 px-3 py-1 rounded-full text-sm">
            Turno: 09:00 - 17:00
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsCards.map((stat, index) => (
          <Card key={index}>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className={`${stat.color} bg-opacity-10 p-3 rounded-lg`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tickets Queue */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <MessageSquare className="h-5 w-5 mr-2" />
                  Cola de Tickets
                </CardTitle>
                <div className="flex space-x-2">
                  <button className="p-2 text-gray-400 hover:text-gray-600">
                    <Search className="h-4 w-4" />
                  </button>
                  <button className="p-2 text-gray-400 hover:text-gray-600">
                    <Filter className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {ticketsLoading ? (
                <div className="text-gray-500 text-center">Cargando tickets...</div>
              ) : (
                <div className="space-y-3">
                  {tickets.map((ticket) => (
                    <div key={ticket.id} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <span className="font-medium text-gray-900">#{ticket.id.split('_')[1]}</span>
                            <span className={`px-2 py-1 text-xs rounded-full ${getPriorityColor(ticket.priority)}`}>
                              {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}
                            </span>
                            <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(ticket.status)}`}>
                              {ticket.status.replace('_', ' ').charAt(0).toUpperCase() + ticket.status.replace('_', ' ').slice(1)}
                            </span>
                          </div>
                          <h3 className="font-medium text-gray-900 mb-1">{ticket.subject}</h3>
                          <div className="flex items-center space-x-4 text-sm text-gray-600">
                            <span>👤 {ticket.userName}</span>
                            <span>📁 {ticket.category}</span>
                            <span>🕐 hace {new Date(Date.now() - (Date.now() - ticket.createdAt)).toLocaleString('es', { 
                              minute: 'numeric', 
                              hour: 'numeric' 
                            }).replace(/.*/, () => {
                              const diff = Math.floor((Date.now() - ticket.createdAt) / 1000 / 60);
                              return diff < 60 ? `${diff} min` : `${Math.floor(diff / 60)}h`;
                            })}</span>
                          </div>
                        </div>
                        <button className="p-2 text-gray-400 hover:text-gray-600">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {tickets.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No hay tickets pendientes
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="h-5 w-5 mr-2" />
              Actividad Reciente
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activitiesLoading ? (
              <div className="text-gray-500 text-center">Cargando...</div>
            ) : activities.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                No hay actividad reciente
              </div>
            ) : (
              <div className="space-y-4">
                {activities.slice(0, 4).map((activity) => (
                  <div key={activity.id} className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-teal-500 rounded-full" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                      <p className="text-xs text-gray-500">
                        {activity.userName} • hace {(() => {
                          const diff = Math.floor((Date.now() - activity.timestamp) / 1000 / 60);
                          return diff < 60 ? `${diff} min` : `${Math.floor(diff / 60)}h`;
                        })()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions & Knowledge Base */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Acciones Rápidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <MessageSquare className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                <span className="text-sm font-medium">Nuevo Ticket</span>
              </button>
              <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <Users className="h-6 w-6 text-green-600 mx-auto mb-2" />
                <span className="text-sm font-medium">Buscar Usuario</span>
              </button>
              <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <FileText className="h-6 w-6 text-purple-600 mx-auto mb-2" />
                <span className="text-sm font-medium">Base Conocimiento</span>
              </button>
              <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <TrendingUp className="h-6 w-6 text-orange-600 mx-auto mb-2" />
                <span className="text-sm font-medium">Reportes</span>
              </button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Artículos Populares
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { title: 'Cómo restablecer contraseña', views: '234 vistas' },
                { title: 'Problemas de acceso a cursos', views: '189 vistas' },
                { title: 'Error al subir archivos', views: '156 vistas' },
                { title: 'Configurar notificaciones', views: '98 vistas' },
              ].map((article, index) => (
                <div key={index} className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                  <p className="text-sm font-medium text-gray-900">{article.title}</p>
                  <p className="text-xs text-gray-500 mt-1">{article.views}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SupportDashboard;