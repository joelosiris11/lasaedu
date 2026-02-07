import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { notificationService, type DBNotification } from '@shared/services/dataService';

interface NotificationState {
  notifications: DBNotification[];
  unreadCount: number;
  isLoading: boolean;
  toastQueue: ToastNotification[];
  initialized: boolean;
}

export interface ToastNotification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  duration?: number;
  link?: string;
}

interface NotificationActions {
  initializeNotifications: (userId: string) => () => void;
  addToast: (toast: Omit<ToastNotification, 'id'>) => void;
  removeToast: (id: string) => void;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: (userId: string) => Promise<void>;
  clearNotifications: () => void;
}

export type NotificationStore = NotificationState & NotificationActions;

export const useNotificationStore = create<NotificationStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      notifications: [],
      unreadCount: 0,
      isLoading: false,
      toastQueue: [],
      initialized: false,

      // Actions
      initializeNotifications: (userId: string) => {
        set({ isLoading: true });

        // Store previous notification IDs to detect new ones
        let previousIds = new Set<string>();
        let isFirstLoad = true;

        // Subscribe to real-time notifications
        const unsubscribe = notificationService.subscribeToUser(userId, (notifications) => {
          const sorted = notifications.sort((a, b) => b.createdAt - a.createdAt);
          const unreadCount = sorted.filter(n => !n.read).length;

          // Check for new notifications (only after first load)
          if (!isFirstLoad) {
            const currentIds = new Set(sorted.map(n => n.id));
            const newNotifications = sorted.filter(n => !previousIds.has(n.id));

            // Show toast for each new notification
            newNotifications.forEach(notification => {
              get().addToast({
                type: notification.type as ToastNotification['type'],
                title: notification.title,
                message: notification.message,
                link: notification.link,
                duration: 5000
              });
            });

            previousIds = currentIds;
          } else {
            previousIds = new Set(sorted.map(n => n.id));
            isFirstLoad = false;
          }

          set({
            notifications: sorted,
            unreadCount,
            isLoading: false,
            initialized: true
          });
        });

        return unsubscribe;
      },

      addToast: (toast) => {
        const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newToast: ToastNotification = { ...toast, id };

        set(state => ({
          toastQueue: [...state.toastQueue, newToast]
        }));

        // Auto-remove after duration
        const duration = toast.duration ?? 5000;
        if (duration > 0) {
          setTimeout(() => {
            get().removeToast(id);
          }, duration);
        }
      },

      removeToast: (id) => {
        set(state => ({
          toastQueue: state.toastQueue.filter(t => t.id !== id)
        }));
      },

      markAsRead: async (notificationId) => {
        try {
          await notificationService.markAsRead(notificationId);
          // The subscription will update the state automatically
        } catch (error) {
          console.error('Error marking notification as read:', error);
        }
      },

      markAllAsRead: async (userId) => {
        try {
          await notificationService.markAllAsRead(userId);
          // The subscription will update the state automatically
        } catch (error) {
          console.error('Error marking all notifications as read:', error);
        }
      },

      clearNotifications: () => {
        set({ notifications: [], unreadCount: 0, toastQueue: [], initialized: false });
      }
    }),
    { name: 'notification-store' }
  )
);

// Selector hooks for common use cases
export const useUnreadCount = () => useNotificationStore(state => state.unreadCount);
export const useToastQueue = () => useNotificationStore(state => state.toastQueue);
