import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@app/store/authStore';
import { useNotificationStore } from '@app/store/notificationStore';
import {
  Bell,
  CheckCheck,
  ExternalLink,
  Trash2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';
import { notificationService } from '@shared/services/dataService';

const typeColors: Record<string, { bg: string; text: string }> = {
  success: { bg: 'bg-green-100', text: 'text-green-800' },
  error: { bg: 'bg-red-100', text: 'text-red-800' },
  warning: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  info: { bg: 'bg-blue-100', text: 'text-blue-800' },
  course: { bg: 'bg-purple-100', text: 'text-purple-800' },
  grade: { bg: 'bg-indigo-100', text: 'text-indigo-800' },
  message: { bg: 'bg-cyan-100', text: 'text-cyan-800' },
  system: { bg: 'bg-gray-100', text: 'text-gray-800' },
};

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return 'Ahora mismo';
  if (minutes < 60) return `Hace ${minutes} minuto${minutes > 1 ? 's' : ''}`;
  if (hours < 24) return `Hace ${hours} hora${hours > 1 ? 's' : ''}`;
  if (days < 7) return `Hace ${days} día${days > 1 ? 's' : ''}`;

  return new Date(timestamp).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

export default function MyNotificationsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    notifications,
    unreadCount,
    isLoading,
    initialized,
    initializeNotifications,
    markAsRead,
    markAllAsRead
  } = useNotificationStore();

  useEffect(() => {
    if (user?.id && !initialized) {
      const unsubscribe = initializeNotifications(user.id);
      return () => unsubscribe();
    }
  }, [user?.id, initialized, initializeNotifications]);

  const handleNotificationClick = (notification: typeof notifications[0]) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    if (notification.link) {
      navigate(notification.link);
    }
  };

  const handleDelete = async (notificationId: string) => {
    try {
      await notificationService.delete(notificationId);
      // The store will update through the subscription
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleMarkAllRead = () => {
    if (user?.id) {
      markAllAsRead(user.id);
    }
  };

  if (isLoading && !initialized) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Mis Notificaciones</h1>
          <p className="text-gray-600">
            {unreadCount > 0
              ? `Tienes ${unreadCount} notificación${unreadCount > 1 ? 'es' : ''} sin leer`
              : 'Todas las notificaciones han sido leídas'
            }
          </p>
        </div>
        <div className="flex gap-3">
          {unreadCount > 0 && (
            <Button variant="outline" onClick={handleMarkAllRead}>
              <CheckCheck className="w-4 h-4 mr-2" />
              Marcar todo como leído
            </Button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notificaciones
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-xs rounded-full font-medium">
                  {unreadCount} nuevas
                </span>
              )}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <div className="text-center py-16">
              <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No tienes notificaciones
              </h3>
              <p className="text-gray-600">
                Cuando recibas notificaciones, aparecerán aquí
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {notifications.map((notification) => {
                const colors = typeColors[notification.type] || typeColors.info;
                return (
                  <div
                    key={notification.id}
                    className={`
                      py-4 px-3 -mx-3 transition-colors
                      ${!notification.read ? 'bg-blue-50/50' : 'hover:bg-gray-50'}
                      ${notification.link ? 'cursor-pointer' : ''}
                    `}
                    onClick={() => notification.link && handleNotificationClick(notification)}
                  >
                    <div className="flex items-start gap-4">
                      {/* Unread indicator */}
                      <div className="pt-1">
                        {!notification.read ? (
                          <div className="w-2 h-2 bg-blue-500 rounded-full" />
                        ) : (
                          <div className="w-2 h-2" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${colors.bg} ${colors.text}`}>
                            {notification.type}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatTimeAgo(notification.createdAt)}
                          </span>
                          {notification.link && (
                            <ExternalLink className="h-3 w-3 text-gray-400" />
                          )}
                        </div>
                        <h4 className="font-semibold text-gray-900">
                          {notification.title}
                        </h4>
                        <p className="text-sm text-gray-600 mt-1">
                          {notification.message}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        {!notification.read && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(notification.id);
                            }}
                            title="Marcar como leída"
                          >
                            <CheckCheck className="w-4 h-4 text-blue-500" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(notification.id);
                          }}
                          title="Eliminar"
                          className="text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
