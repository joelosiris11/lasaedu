import { useState } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { useNotificationStore, useToastQueue, type ToastNotification } from '@app/store/notificationStore';
import { useNavigate } from 'react-router-dom';

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const colorMap = {
  success: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    icon: 'text-green-500',
    title: 'text-green-800',
    message: 'text-green-700',
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: 'text-red-500',
    title: 'text-red-800',
    message: 'text-red-700',
  },
  warning: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    icon: 'text-yellow-500',
    title: 'text-yellow-800',
    message: 'text-yellow-700',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: 'text-blue-500',
    title: 'text-blue-800',
    message: 'text-blue-700',
  },
};

interface ToastItemProps {
  toast: ToastNotification;
  onRemove: (id: string) => void;
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const [isExiting, setIsExiting] = useState(false);
  const navigate = useNavigate();

  const Icon = iconMap[toast.type] || Info;
  const colors = colorMap[toast.type] || colorMap.info;

  const handleRemove = () => {
    setIsExiting(true);
    setTimeout(() => onRemove(toast.id), 300);
  };

  const handleClick = () => {
    if (toast.link) {
      navigate(toast.link);
      handleRemove();
    }
  };

  return (
    <div
      className={`
        ${colors.bg} ${colors.border} border rounded-lg shadow-lg p-4
        flex items-start gap-3 min-w-[320px] max-w-[420px]
        transform transition-all duration-300 ease-out
        ${isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'}
        ${toast.link ? 'cursor-pointer hover:shadow-xl' : ''}
      `}
      onClick={toast.link ? handleClick : undefined}
    >
      <Icon className={`h-5 w-5 ${colors.icon} flex-shrink-0 mt-0.5`} />

      <div className="flex-1 min-w-0">
        <h4 className={`font-medium text-sm ${colors.title}`}>
          {toast.title}
        </h4>
        <p className={`text-sm ${colors.message} mt-0.5 line-clamp-2`}>
          {toast.message}
        </p>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          handleRemove();
        }}
        className={`${colors.icon} hover:opacity-70 flex-shrink-0`}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const toastQueue = useToastQueue();
  const removeToast = useNotificationStore(state => state.removeToast);

  if (toastQueue.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3">
      {toastQueue.map(toast => (
        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  );
}

// Hook for programmatic toast creation
export function useToast() {
  const addToast = useNotificationStore(state => state.addToast);

  return {
    success: (title: string, message: string, link?: string) =>
      addToast({ type: 'success', title, message, link }),
    error: (title: string, message: string, link?: string) =>
      addToast({ type: 'error', title, message, link }),
    warning: (title: string, message: string, link?: string) =>
      addToast({ type: 'warning', title, message, link }),
    info: (title: string, message: string, link?: string) =>
      addToast({ type: 'info', title, message, link }),
    custom: (toast: Omit<ToastNotification, 'id'>) => addToast(toast),
  };
}

export default ToastContainer;
