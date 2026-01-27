import { useState, useEffect } from 'react';
import { useAuthStore } from '@app/store/authStore';
import { userService, courseService, legacyEnrollmentService } from '@shared/services/dataService';
import type { User, Course, Notification } from '@shared/types';
import type { DBUser, DBCourse } from '@shared/services/dataService';
import { 
  Bell, 
  Send, 
  Mail,
  MessageSquare,
  AlertCircle,
  CheckCircle,
  Calendar
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';

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
  targetCriteria?: any;
  scheduledAt?: number;
  status: 'draft' | 'scheduled' | 'sent' | 'failed';
  sentAt?: number;
  sentCount: number;
  openCount: number;
  clickCount: number;
}

export default function NotificationSystemPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'send' | 'templates' | 'campaigns' | 'settings'>('dashboard');
  const [loading, setLoading] = useState(false);
  
  // Data states
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [campaigns, setCampaigns] = useState<NotificationCampaign[]>([]);
  const [users, setUsers] = useState<DBUser[]>([]);
  const [courses, setCourses] = useState<DBCourse[]>([]);

  // Form states
  const [newNotification, setNewNotification] = useState({
    type: 'inapp' as const,
    title: '',
    content: '',
    recipients: 'all' as 'all' | 'role' | 'course' | 'custom',
    recipientIds: [] as string[],
    courseId: '',
    role: '',
    scheduleAt: '',
    priority: 'normal' as 'low' | 'normal' | 'high'
  });

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load all necessary data
      const [notificationsData, usersData, coursesData] = await Promise.all([
        [] as Notification[], // Placeholder until notification service is implemented
        userService.getAll(),
        courseService.getAll()
      ]);

      setNotifications(notificationsData);
      setUsers(usersData);
      setCourses(coursesData);

      // Load templates and campaigns (mock data for now)
      loadTemplates();
      loadCampaigns();
    } catch (error) {
      console.error('Error loading notification data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = () => {
    // Mock templates - in real app, load from database
    const defaultTemplates: NotificationTemplate[] = [
      {
        id: 'welcome',
        name: 'Bienvenida a estudiante',
        type: 'email',
        subject: 'Bienvenido a LasaEdu, {{userName}}!',
        content: 'Hola {{userName}}, bienvenido a nuestra plataforma. Estamos emocionados de tenerte con nosotros.',
        variables: ['userName'],
        category: 'course'
      },
      {
        id: 'course_completion',
        name: 'Curso completado',
        type: 'inapp',
        content: '¡Felicitaciones {{userName}}! Has completado exitosamente el curso {{courseTitle}}.',
        variables: ['userName', 'courseTitle'],
        category: 'course'
      },
      {
        id: 'assignment_due',
        name: 'Recordatorio de tarea',
        type: 'email',
        subject: 'Recordatorio: Tarea pendiente en {{courseTitle}}',
        content: 'Hola {{userName}}, tienes una tarea pendiente en el curso {{courseTitle}} que vence el {{dueDate}}.',
        variables: ['userName', 'courseTitle', 'dueDate'],
        category: 'reminder'
      },
      {
        id: 'new_course',
        name: 'Nuevo curso disponible',
        type: 'browser',
        content: '¡Nuevo curso disponible! {{courseTitle}} - {{courseDescription}}',
        variables: ['courseTitle', 'courseDescription'],
        category: 'marketing'
      }
    ];
    setTemplates(defaultTemplates);
  };

  const loadCampaigns = () => {
    // Mock campaigns - in real app, load from database
    const mockCampaigns: NotificationCampaign[] = [
      {
        id: 'campaign_1',
        name: 'Bienvenida nuevos estudiantes',
        templateId: 'welcome',
        targetType: 'role',
        targetCriteria: { role: 'student' },
        status: 'sent',
        sentAt: Date.now() - 86400000, // 1 day ago
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
        scheduledAt: Date.now() + 3600000, // 1 hour from now
        sentCount: 0,
        openCount: 0,
        clickCount: 0
      }
    ];
    setCampaigns(mockCampaigns);
  };

  const sendNotification = async () => {
    if (!newNotification.title || !newNotification.content) {
      alert('Por favor completa todos los campos obligatorios');
      return;
    }

    setLoading(true);
    try {
      let recipientIds: string[] = [];

      // Determine recipients based on selection
      if (newNotification.recipients === 'all') {
        recipientIds = users.map(u => u.id);
      } else if (newNotification.recipients === 'role' && newNotification.role) {
        recipientIds = users.filter(u => u.role === newNotification.role).map(u => u.id);
      } else if (newNotification.recipients === 'course' && newNotification.courseId) {
        // Get enrolled users for specific course
        const enrollments = await legacyEnrollmentService.getAll() || [];
        recipientIds = enrollments
          .filter((e: any) => e.courseId === newNotification.courseId && e.status === 'active')
          .map((e: any) => e.userId);
      } else if (newNotification.recipients === 'custom') {
        recipientIds = newNotification.recipientIds;
      }

      // Create notification for each recipient
      const notifications = recipientIds.map(userId => ({
        id: `notif_${Date.now()}_${userId}`,
        userId,
        type: newNotification.type,
        title: newNotification.title,
        message: newNotification.content,
        priority: newNotification.priority,
        read: false,
        createdAt: Date.now(),
        scheduledAt: newNotification.scheduleAt ? new Date(newNotification.scheduleAt).getTime() : undefined
      }));

      // Save notifications
      for (const notification of notifications) {
        // TODO: Implement notification service
        console.log('Creating notification:', notification);
        // await notificationService.create(notification);
      }

      // Send immediate notifications (non-scheduled)
      if (!newNotification.scheduleAt) {
        await sendImmediateNotifications(notifications);
      }

      // Reset form
      setNewNotification({
        type: 'inapp',
        title: '',
        content: '',
        recipients: 'all',
        recipientIds: [],
        courseId: '',
        role: '',
        scheduleAt: '',
        priority: 'normal'
      });

      alert(`Notificación enviada a ${recipientIds.length} usuarios`);
      await loadData();
      
    } catch (error) {
      console.error('Error sending notification:', error);
      alert('Error al enviar la notificación');
    } finally {
      setLoading(false);
    }
  };

  const sendImmediateNotifications = async (notifications: any[]) => {
    // Simulate different notification types
    for (const notification of notifications) {
      switch (notification.type) {
        case 'email':
          await sendEmailNotification(notification);
          break;
        case 'browser':
          await sendBrowserNotification(notification);
          break;
        case 'inapp':
          // In-app notifications are already saved
          console.log('In-app notification saved:', notification.id);
          break;
        case 'sms':
          await sendSMSNotification(notification);
          break;
      }
    }
  };

  const sendEmailNotification = async (notification: any) => {
    // Simulate email sending
    console.log('Sending email notification:', notification);
    // In real app, integrate with email service (SendGrid, AWS SES, etc.)
  };

  const sendBrowserNotification = async (notification: any) => {
    // Request permission and send browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico'
      });
    }
  };

  const sendSMSNotification = async (notification: any) => {
    // Simulate SMS sending
    console.log('Sending SMS notification:', notification);
    // In real app, integrate with SMS service (Twilio, AWS SNS, etc.)
  };

  const createTemplate = async (template: Omit<NotificationTemplate, 'id'>) => {
    const newTemplate: NotificationTemplate = {
      ...template,
      id: `template_${Date.now()}`
    };
    
    setTemplates(prev => [...prev, newTemplate]);
    // In real app, save to database
  };

  const updateCampaignStatus = async (campaignId: string, status: NotificationCampaign['status']) => {
    setCampaigns(prev =>
      prev.map(c => c.id === campaignId ? { ...c, status } : c)
    );
    // In real app, update database
  };

  const getNotificationStats = () => {
    const total = notifications.length;
    const unread = notifications.filter(n => !n.read).length;
    const today = notifications.filter(n => 
      new Date(n.createdAt).toDateString() === new Date().toDateString()
    ).length;
    
    return { total, unread, today };
  };

  const stats = getNotificationStats();

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

      {/* Recent Campaigns */}
      <Card>
        <CardHeader>
          <CardTitle>Campañas Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {campaigns.slice(0, 5).map(campaign => (
              <div key={campaign.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <h4 className="font-medium">{campaign.name}</h4>
                  <p className="text-sm text-gray-600">
                    {campaign.status === 'sent' ? 
                      `Enviado a ${campaign.sentCount} usuarios` : 
                      `Estado: ${campaign.status}`
                    }
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  {campaign.status === 'sent' && (
                    <div className="text-right text-sm text-gray-600">
                      <div>Abiertos: {campaign.openCount}</div>
                      <div>Clicks: {campaign.clickCount}</div>
                    </div>
                  )}
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    campaign.status === 'sent' ? 'bg-green-100 text-green-800' :
                    campaign.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                    campaign.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {campaign.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
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
              onChange={(e) => setNewNotification(prev => ({ ...prev, type: e.target.value as any }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="inapp">En la aplicación</option>
              <option value="email">Email</option>
              <option value="browser">Navegador (Push)</option>
              <option value="sms">SMS</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Prioridad</label>
            <select
              value={newNotification.priority}
              onChange={(e) => setNewNotification(prev => ({ ...prev, priority: e.target.value as any }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="low">Baja</option>
              <option value="normal">Normal</option>
              <option value="high">Alta</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Título</label>
          <Input
            value={newNotification.title}
            onChange={(e) => setNewNotification(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Título de la notificación"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Contenido</label>
          <textarea
            value={newNotification.content}
            onChange={(e) => setNewNotification(prev => ({ ...prev, content: e.target.value }))}
            placeholder="Contenido del mensaje"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg h-32"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Destinatarios</label>
            <select
              value={newNotification.recipients}
              onChange={(e) => setNewNotification(prev => ({ ...prev, recipients: e.target.value as any }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="all">Todos los usuarios</option>
              <option value="role">Por rol</option>
              <option value="course">Por curso</option>
              <option value="custom">Selección personalizada</option>
            </select>
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
                <option value="student">Estudiantes</option>
                <option value="teacher">Profesores</option>
                <option value="admin">Administradores</option>
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
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Programar Envío (Opcional)</label>
          <input
            type="datetime-local"
            value={newNotification.scheduleAt}
            onChange={(e) => setNewNotification(prev => ({ ...prev, scheduleAt: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        <div className="flex justify-end space-x-2">
          <Button 
            variant="outline" 
            onClick={() => setActiveTab('dashboard')}
          >
            Cancelar
          </Button>
          <Button 
            onClick={sendNotification}
            disabled={loading}
          >
            {loading ? 'Enviando...' : 'Enviar Notificación'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  if (loading && activeTab === 'dashboard') {
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
            { id: 'send', label: 'Enviar Notificación', icon: Send },
            { id: 'templates', label: 'Plantillas', icon: MessageSquare },
            { id: 'campaigns', label: 'Campañas', icon: Mail },
            { id: 'settings', label: 'Configuración', icon: AlertCircle },
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
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
      {activeTab === 'templates' && (
        <div className="text-center py-12">
          <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Gestión de Plantillas</h3>
          <p className="text-gray-600 mb-6">Funcionalidad de plantillas en desarrollo</p>
        </div>
      )}
      {activeTab === 'campaigns' && (
        <div className="text-center py-12">
          <Mail className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Gestión de Campañas</h3>
          <p className="text-gray-600 mb-6">Funcionalidad de campañas en desarrollo</p>
        </div>
      )}
      {activeTab === 'settings' && (
        <div className="text-center py-12">
          <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Configuración</h3>
          <p className="text-gray-600 mb-6">Configuración del sistema en desarrollo</p>
        </div>
      )}
    </div>
  );
}