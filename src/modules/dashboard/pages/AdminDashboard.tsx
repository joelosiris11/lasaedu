import { useAuthStore } from '@app/store/authStore';
import { 
  Users, 
  BookOpen, 
  TrendingUp, 
  MessageCircle,
  Settings,
  BarChart3,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/Card';
import { useSystemStats, useRecentActivity, useSystemMetrics } from '@shared/hooks/useDashboard';

const AdminDashboard = () => {
  const { user } = useAuthStore();
  const { stats, loading: statsLoading } = useSystemStats();
  const { activities, loading: activitiesLoading } = useRecentActivity(4);
  const { metrics, loading: metricsLoading } = useSystemMetrics();

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Cargando estadísticas...</div>
      </div>
    );
  }

  const statsCards = stats ? [
    { title: 'Total Usuarios', value: stats.totalUsers.toString(), icon: Users, color: 'text-blue-600' },
    { title: 'Cursos Activos', value: stats.activeCourses.toString(), icon: BookOpen, color: 'text-green-600' },
    { title: 'Inscripciones', value: stats.totalEnrollments.toString(), icon: TrendingUp, color: 'text-purple-600' },
    { title: 'Tickets Abiertos', value: stats.openTickets.toString(), icon: MessageCircle, color: 'text-orange-600' },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl p-6 text-white">
        <h1 className="text-2xl font-bold">¡Bienvenido, {user?.name}!</h1>
        <p className="text-blue-100 mt-2">
          Panel de administración - Gestiona tu plataforma educativa
        </p>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
              <div className="text-gray-500 text-center">No hay actividad reciente</div>
            ) : (
              <div className="space-y-4">
                {activities.map((activity) => (
                  <div key={activity.id} className="flex items-center space-x-3">
                    <div className={`w-2 h-2 rounded-full ${
                      activity.type === 'login' ? 'bg-green-500' :
                      activity.type === 'enrollment' ? 'bg-blue-500' :
                      activity.type === 'certificate' ? 'bg-purple-500' : 'bg-gray-500'
                    }`} />
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

        {/* System Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              Métricas del Sistema
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metricsLoading || !metrics ? (
              <div className="text-gray-500 text-center">Cargando...</div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Usuarios Activos</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold">{metrics.activeUsers}</span>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Progreso Promedio</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold">{metrics.avgProgress}%</span>
                    {metrics.avgProgress >= 50 ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Cursos Publicados</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold">{metrics.publishedCourses}</span>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Total Inscripciones</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold">{metrics.totalEnrollments}</span>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Acciones Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <Users className="h-6 w-6 text-blue-600 mx-auto mb-2" />
              <span className="text-sm font-medium">Gestionar Usuarios</span>
            </button>
            <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <BookOpen className="h-6 w-6 text-green-600 mx-auto mb-2" />
              <span className="text-sm font-medium">Revisar Cursos</span>
            </button>
            <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <BarChart3 className="h-6 w-6 text-purple-600 mx-auto mb-2" />
              <span className="text-sm font-medium">Ver Reportes</span>
            </button>
            <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <Settings className="h-6 w-6 text-gray-600 mx-auto mb-2" />
              <span className="text-sm font-medium">Configuración</span>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;