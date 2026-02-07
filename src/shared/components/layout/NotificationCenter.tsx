import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, ExternalLink } from 'lucide-react';
import { useNotificationStore } from '@app/store/notificationStore';
import { useAuthStore } from '@app/store/authStore';
import { Button } from '../ui/Button';
import type { DBNotification } from '@shared/services/dataService';

const typeColors: Record<string, string> = {
  success: 'bg-green-100 text-green-600',
  error: 'bg-red-100 text-red-600',
  warning: 'bg-yellow-100 text-yellow-600',
  info: 'bg-blue-100 text-blue-600',
  course: 'bg-purple-100 text-purple-600',
  grade: 'bg-indigo-100 text-indigo-600',
  message: 'bg-cyan-100 text-cyan-600',
  system: 'bg-gray-100 text-gray-600',
};

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `${minutes} min`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;

  return new Date(timestamp).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short'
  });
}

function NotificationItem({
  notification,
  onMarkAsRead,
  onClick,
}: {
  notification: DBNotification;
  onMarkAsRead: (id: string) => void;
  onClick: (notification: DBNotification) => void;
}) {
  const typeColor = typeColors[notification.type] || typeColors.info;

  return (
    <div
      onClick={() => onClick(notification)}
      className={`
        p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer
        flex items-start gap-3 transition-colors
        ${!notification.read ? 'bg-blue-50/50' : ''}
      `}
    >
      <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${!notification.read ? 'bg-blue-500' : 'bg-transparent'}`} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeColor}`}>
            {notification.type}
          </span>
          {notification.link && (
            <ExternalLink className="h-3 w-3 text-gray-400" />
          )}
        </div>
        <div className="text-sm font-medium text-gray-800 mt-1">
          {notification.title}
        </div>
        <div className="text-xs text-gray-600 mt-0.5 line-clamp-2">
          {notification.message}
        </div>
        <div className="text-xs text-gray-400 mt-1">
          {formatTimeAgo(notification.createdAt)}
        </div>
      </div>

      {!notification.read && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMarkAsRead(notification.id);
          }}
          className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
          title="Marcar como leída"
        >
          <CheckCheck className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
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

  // Initialize notifications subscription when user is available
  useEffect(() => {
    if (user?.id && !initialized) {
      const unsubscribe = initializeNotifications(user.id);
      return () => unsubscribe();
    }
  }, [user?.id, initialized, initializeNotifications]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = (notification: DBNotification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    if (notification.link) {
      navigate(notification.link);
    }
    setIsOpen(false);
  };

  const handleMarkAllAsRead = () => {
    if (user?.id) {
      markAllAsRead(user.id);
    }
  };

  const handleViewAll = () => {
    setIsOpen(false);
    const rolePrefix = user?.role || 'student';
    navigate(`/${rolePrefix}/notifications`);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="relative"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full text-xs text-white flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white border border-gray-200 rounded-lg shadow-xl z-50">
          {/* Header */}
          <div className="p-3 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-800">Notificaciones</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-xs rounded-full">
                  {unreadCount} sin leer
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <CheckCheck className="h-3 w-3" />
                Marcar todo
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-80 overflow-y-auto">
            {isLoading && !initialized ? (
              <div className="p-8 text-center text-gray-500">
                <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2" />
                Cargando notificaciones...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No tienes notificaciones</p>
              </div>
            ) : (
              notifications.slice(0, 10).map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={markAsRead}
                  onClick={handleNotificationClick}
                />
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-gray-200">
            <button
              onClick={handleViewAll}
              className="w-full text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Ver todas las notificaciones
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationCenter;
