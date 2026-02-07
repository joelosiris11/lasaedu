import { useState, useEffect } from 'react';
import { useAuthStore } from '@app/store/authStore';
import {
  userService,
  courseService,
  legacyEnrollmentService,
  notificationService,
  type DBNotification
} from '@shared/services/dataService';
import type { DBUser, DBCourse } from '@shared/services/dataService';
import {
  Bell,
  Send,
  Mail,
  MessageSquare,
  AlertCircle,
  CheckCircle,
  Calendar,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { useToast } from '@shared/components/ui/Toast';

// Extended notification interface for the notification system
interface NotificationTemplate {
  id: string;
  name: string;
  type: 'email' | 'browser' | 'inapp' | 'sms';
  subject?: string;
  content: string;
  variables: string[];
  category: 'course' | 'system' | 'marketing' | 'reminder';
}

interface NotificationCampaign {
  id: string;
  name: string;
  templateId: string;
  targetType: 'all' | 'role' | 'course' | 'custom';
  targetCriteria?: Record<string, unknown>;
  scheduledAt?: number;
  status: 'draft' | 'scheduled' | 'sent' | 'failed';
  sentAt?: number;
  sentCount: number;
  openCount: number;
  clickCount: number;
}

export default function NotificationSystemPage() {
  const { } = useAuthStore(); // Auth store available if needed
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'send' | 'history' | 'templates' | 'settings'>('dashboard');
  const [loading, setLoading] = useState(false);

  // Data states
  const [allNotifications, setAllNotifications] = useState<DBNotification[]>([]);
  const [templates] = useState<NotificationTemplate[]>([
    {
      id: 'welcome',
      name: 'Bienvenida a estudiante',
      type: 'inapp',
      subject: 'Bienvenido a LasaEdu!',
      content: 'Bienvenido a nuestra plataforma. Estamos emocionados de tenerte con nosotros.',
      variables: ['userName'],
      category: 'course'
    },
    {
      id: 'course_completion',
      name: 'Curso completado',
      type: 'inapp',
      content: '¡Felicitaciones! Has completado exitosamente el curso.',
      variables: ['userName', 'courseTitle'],
      category: 'course'
    },
    {
      id: 'assignment_due',
      name: 'Recordatorio de tarea',
      type: 'inapp',
      content: 'Tienes una tarea pendiente que vence pronto.',
      variables: ['userName', 'courseTitle', 'dueDate'],
      category: 'reminder'
    }
  ]);
  const [campaigns, setCampaigns] = useState<NotificationCampaign[]>([]);
  const [users, setUsers] = useState<DBUser[]>([]);
  const [courses, setCourses] = useState<DBCourse[]>([]);

  // Form states
  const [newNotification, setNewNotification] = useState({
    type: 'info' as DBNotification['type'],
    title: '',
    content: '',
    recipients: 'all' as 'all' | 'role' | 'course' | 'custom',
    recipientIds: [] as string[],
    courseId: '',
    role: '',
    link: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [notificationsData, usersData, coursesData] = await Promise.all([
        notificationService.getAll(),
        userService.getAll(),
        courseService.getAll()
      ]);

      setAllNotifications(notificationsData.sort((a, b) => b.createdAt - a.createdAt));
      setUsers(usersData);
      setCourses(coursesData);
      loadCampaigns();
    } catch (error) {
      console.error('Error loading notification data:', error);
      toast.error('Error', 'No se pudieron cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const loadCampaigns = () => {
    const mockCampaigns: NotificationCampaign[] = [
      {
        id: 'campaign_1',
        name: 'Bienvenida nuevos estudiantes',
        templateId: 'welcome',
        targetType: 'role',
        targetCriteria: { role: 'student' },
        status: 'sent',
        sentAt: Date.now() - 86400000,
        sentCount: 125,
        openCount: 98,
        clickCount: 34
      },
      {
        id: 'campaign_2',
        name: 'Recordatorio tareas pendientes',
        templateId: 'assignment_due',
        targetType: 'custom',
        status: 'scheduled',
        scheduledAt: Date.now() + 3600000,
        sentCount: 0,
        openCount: 0,
        clickCount: 0
      }
    ];
    setCampaigns(mockCampaigns);
  };

  const sendNotification = async () => {
    if (!newNotification.title || !newNotification.content) {
      toast.warning('Campos requeridos', 'Por favor completa título y contenido');
      return;
    }

    setLoading(true);
    try {
      let recipientIds: string[] = [];

      if (newNotification.recipients === 'all') {
        recipientIds = users.map(u => u.id);
      } else if (newNotification.recipients === 'role' && newNotification.role) {
        recipientIds = users.filter(u => u.role === newNotification.role).map(u => u.id);
      } else if (newNotification.recipients === 'course' && newNotification.courseId) {
        const enrollments = await legacyEnrollmentService.getAll() || [];
        recipientIds = enrollments
          .filter((e: { courseId: string; status: string }) =>
            e.courseId === newNotification.courseId && e.status === 'active'
          )
          .map((e: { userId: string }) => e.userId);
      } else if (newNotification.recipients === 'custom') {
        recipientIds = newNotification.recipientIds;
      }

      if (recipientIds.length === 0) {
        toast.warning('Sin destinatarios', 'No se encontraron usuarios para esta selección');
        setLoading(false);
        return;
      }

      // Create notification for each recipient
      let successCount = 0;
      for (const userId of recipientIds) {
        try {
          await notificationService.create({
            userId,
            type: newNotification.type,
            title: newNotification.title,
            message: newNotification.content,
            link: newNotification.link || undefined,
            read: false,
            createdAt: Date.now()
          });
          successCount++;
        } catch (err) {
          console.error(`Error creating notification for user ${userId}:`, err);
        }
      }

      // Reset form
      setNewNotification({
        type: 'info',
        title: '',
        content: '',
        recipients: 'all',
        recipientIds: [],
        courseId: '',
        role: '',
        link: ''
      });

      toast.success(
        'Notificaciones enviadas',
        `Se enviaron ${successCount} de ${recipientIds.length} notificaciones`
      );

      await loadData();
    } catch (error) {
      console.error('Error sending notification:', error);
      toast.error('Error', 'Error al enviar las notificaciones');
    } finally {
      setLoading(false);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await notificationService.delete(id);
      setAllNotifications(prev => prev.filter(n => n.id !== id));
      toast.success('Eliminada', 'Notificación eliminada correctamente');
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('Error', 'No se pudo eliminar la notificación');
    }
  };

  const getStats = () => {
    const total = allNotifications.length;
    const unread = allNotifications.filter(n => !n.read).length;
    const today = allNotifications.filter(n =>
      new Date(n.createdAt).toDateString() === new Date().toDateString()
    ).length;

    return { total, unread, today };
  };

  const stats = getStats();

  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Ahora';
    if (minutes < 60) return `${minutes} min`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;

    return new Date(timestamp).toLocaleDateString('es-ES');
  };

  const getUserName = (userId: string) => {
    const foundUser = users.find(u => u.id === userId);
    return foundUser?.name || 'Usuario desconocido';
  };

  const renderDashboard = () => (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Bell className="w-8 h-8 text-blue-500 mr-3" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-gray-600">Total Notificaciones</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <AlertCircle className="w-8 h-8 text-orange-500 mr-3" />
              <div>
                <p className="text-2xl font-bold">{stats.unread}</p>
                <p className="text-sm text-gray-600">No Leídas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Calendar className="w-8 h-8 text-green-500 mr-3" />
              <div>
                <p className="text-2xl font-bold">{stats.today}</p>
                <p className="text-sm text-gray-600">Hoy</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <CheckCircle className="w-8 h-8 text-purple-500 mr-3" />
              <div>
                <p className="text-2xl font-bold">{campaigns.filter(c => c.status === 'sent').length}</p>
                <p className="text-sm text-gray-600">Campañas Enviadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Acciones Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setActiveTab('send')}>
              <Send className="w-4 h-4 mr-2" />
              Nueva Notificación
            </Button>
            <Button variant="outline" onClick={loadData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualizar Datos
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Notificaciones Recientes</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setActiveTab('history')}>
              Ver todas
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {allNotifications.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No hay notificaciones</p>
            </div>
          ) : (
            <div className="space-y-3">
              {allNotifications.slice(0, 5).map(notification => (
                <div key={notification.id} className="flex items-start justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        notification.type === 'success' ? 'bg-green-100 text-green-800' :
                        notification.type === 'error' ? 'bg-red-100 text-red-800' :
                        notification.type === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {notification.type}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatTimeAgo(notification.createdAt)}
                      </span>
                    </div>
                    <h4 className="font-medium mt-1">{notification.title}</h4>
                    <p className="text-sm text-gray-600 line-clamp-1">{notification.message}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Para: {getUserName(notification.userId)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!notification.read && (
                      <span className="w-2 h-2 bg-blue-500 rounded-full" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderSendForm = () => (
    <Card>
      <CardHeader>
        <CardTitle>Enviar Nueva Notificación</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Tipo de Notificación</label>
            <select
              value={newNotification.type}
              onChange={(e) => setNewNotification(prev => ({ ...prev, type: e.target.value as DBNotification['type'] }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="info">Información</option>
              <option value="success">Éxito</option>
              <option value="warning">Advertencia</option>
              <option value="error">Error</option>
              <option value="course">Curso</option>
              <option value="grade">Calificación</option>
              <option value="message">Mensaje</option>
              <option value="system">Sistema</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Destinatarios</label>
            <select
              value={newNotification.recipients}
              onChange={(e) => setNewNotification(prev => ({ ...prev, recipients: e.target.value as 'all' | 'role' | 'course' | 'custom' }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="all">Todos los usuarios ({users.length})</option>
              <option value="role">Por rol</option>
              <option value="course">Por curso</option>
            </select>
          </div>
        </div>

        {newNotification.recipients === 'role' && (
          <div>
            <label className="block text-sm font-medium mb-2">Rol</label>
            <select
              value={newNotification.role}
              onChange={(e) => setNewNotification(prev => ({ ...prev, role: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Seleccionar rol</option>
              <option value="student">Estudiantes ({users.filter(u => u.role === 'student').length})</option>
              <option value="teacher">Profesores ({users.filter(u => u.role === 'teacher').length})</option>
              <option value="admin">Administradores ({users.filter(u => u.role === 'admin').length})</option>
              <option value="support">Soporte ({users.filter(u => u.role === 'support').length})</option>
            </select>
          </div>
        )}

        {newNotification.recipients === 'course' && (
          <div>
            <label className="block text-sm font-medium mb-2">Curso</label>
            <select
              value={newNotification.courseId}
              onChange={(e) => setNewNotification(prev => ({ ...prev, courseId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Seleccionar curso</option>
              {courses.map(course => (
                <option key={course.id} value={course.id}>{course.title}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-2">Título *</label>
          <Input
            value={newNotification.title}
            onChange={(e) => setNewNotification(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Título de la notificación"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Mensaje *</label>
          <textarea
            value={newNotification.content}
            onChange={(e) => setNewNotification(prev => ({ ...prev, content: e.target.value }))}
            placeholder="Contenido del mensaje"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg h-32 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Enlace (opcional)</label>
          <Input
            value={newNotification.link}
            onChange={(e) => setNewNotification(prev => ({ ...prev, link: e.target.value }))}
            placeholder="/student/courses o URL externa"
          />
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => setActiveTab('dashboard')}
          >
            Cancelar
          </Button>
          <Button
            onClick={sendNotification}
            disabled={loading || !newNotification.title || !newNotification.content}
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Enviar Notificación
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderHistory = () => (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Historial de Notificaciones</CardTitle>
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {allNotifications.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Bell className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No hay notificaciones</p>
            <p className="text-sm mt-1">Las notificaciones enviadas aparecerán aquí</p>
          </div>
        ) : (
          <div className="space-y-3">
            {allNotifications.map(notification => (
              <div
                key={notification.id}
                className={`flex items-start justify-between p-4 border rounded-lg ${
                  !notification.read ? 'bg-blue-50/50 border-blue-200' : ''
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                      notification.type === 'success' ? 'bg-green-100 text-green-800' :
                      notification.type === 'error' ? 'bg-red-100 text-red-800' :
                      notification.type === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                      notification.type === 'course' ? 'bg-purple-100 text-purple-800' :
                      notification.type === 'grade' ? 'bg-indigo-100 text-indigo-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {notification.type}
                    </span>
                    {!notification.read && (
                      <span className="text-xs text-blue-600 font-medium">Sin leer</span>
                    )}
                    <span className="text-xs text-gray-500">
                      {formatTimeAgo(notification.createdAt)}
                    </span>
                  </div>
                  <h4 className="font-semibold text-gray-900">{notification.title}</h4>
                  <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span>Para: {getUserName(notification.userId)}</span>
                    {notification.link && (
                      <span>Enlace: {notification.link}</span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteNotification(notification.id)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderTemplates = () => (
    <Card>
      <CardHeader>
        <CardTitle>Plantillas de Notificación</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {templates.map(template => (
            <div key={template.id} className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">{template.name}</h4>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  template.category === 'course' ? 'bg-purple-100 text-purple-800' :
                  template.category === 'reminder' ? 'bg-yellow-100 text-yellow-800' :
                  template.category === 'marketing' ? 'bg-pink-100 text-pink-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {template.category}
                </span>
              </div>
              <p className="text-sm text-gray-600">{template.content}</p>
              {template.variables.length > 0 && (
                <div className="mt-2">
                  <span className="text-xs text-gray-500">Variables: </span>
                  {template.variables.map(v => (
                    <span key={v} className="inline-block px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded mr-1">
                      {`{{${v}}}`}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => {
                  setNewNotification(prev => ({
                    ...prev,
                    title: template.subject || template.name,
                    content: template.content
                  }));
                  setActiveTab('send');
                }}>
                  Usar plantilla
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  if (loading && activeTab === 'dashboard' && allNotifications.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Sistema de Notificaciones</h1>
        <p className="text-gray-600">
          Gestiona y envía notificaciones a los usuarios de la plataforma
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'dashboard', label: 'Panel Principal', icon: Bell },
            { id: 'send', label: 'Enviar', icon: Send },
            { id: 'history', label: 'Historial', icon: MessageSquare },
            { id: 'templates', label: 'Plantillas', icon: Mail },
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-4 h-4 mr-2" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'dashboard' && renderDashboard()}
      {activeTab === 'send' && renderSendForm()}
      {activeTab === 'history' && renderHistory()}
      {activeTab === 'templates' && renderTemplates()}
    </div>
  );
}
