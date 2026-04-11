import { Clock, AlertTriangle, Lock, CheckCircle } from 'lucide-react';
import { getTaskDeadlineStatus, getTimeRemaining, parseTimestamp } from '@shared/utils/deadlines';

interface DeadlineBadgeProps {
  dueDate?: string;
  lateSubmissionDeadline?: string;
  availableFrom?: string;
  compact?: boolean;
}

export default function DeadlineBadge({
  dueDate,
  lateSubmissionDeadline,
  availableFrom,
  compact = false,
}: DeadlineBadgeProps) {
  const status = getTaskDeadlineStatus({
    availableFrom,
    dueDate,
    lateSubmissionDeadline,
  });

  if (status === 'not_open') {
    const fromTs = parseTimestamp(availableFrom);
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
        <Lock className="h-3 w-3" />
        {compact ? 'Cerrado' : `Abre ${fromTs ? formatShortDate(fromTs) : 'pronto'}`}
      </span>
    );
  }

  if (status === 'open') {
    const dueTs = parseTimestamp(dueDate);
    if (!dueTs) return null; // no deadline configured, nothing to show
    const remaining = getTimeRemaining(dueTs);
    const isUrgent = dueTs - Date.now() < 24 * 60 * 60 * 1000;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
        isUrgent ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
      }`}>
        <Clock className="h-3 w-3" />
        {compact ? remaining : `Entrega: ${remaining}`}
      </span>
    );
  }

  if (status === 'late_period') {
    const lateTs = parseTimestamp(lateSubmissionDeadline);
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
        <AlertTriangle className="h-3 w-3" />
        {compact ? 'Tardío' : `Entrega tardía: ${lateTs ? getTimeRemaining(lateTs) : ''}`}
      </span>
    );
  }

  if (status === 'closed') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
        <Lock className="h-3 w-3" />
        {compact ? 'Cerrado' : 'Cerrado'}
      </span>
    );
  }

  return null;
}

function formatShortDate(ts: number): string {
  return new Date(ts).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
