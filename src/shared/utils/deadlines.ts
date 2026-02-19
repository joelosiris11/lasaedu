import type { DBDeadlineExtension } from '@shared/services/firebaseDataService';

/**
 * Utilidades para fechas límite, disponibilidad y prórrogas
 */

/**
 * Determina si un contenido está disponible según su fecha de apertura.
 * Soporta timestamps numéricos y strings ISO/datetime-local.
 */
export function isAvailable(availableFrom?: number | string): boolean {
  if (!availableFrom) return true;
  const timestamp = typeof availableFrom === 'string'
    ? new Date(availableFrom).getTime()
    : availableFrom;
  if (isNaN(timestamp)) return true;
  return Date.now() >= timestamp;
}

/**
 * Parsea un valor de fecha (string o number) a timestamp numérico.
 * Retorna null si no es válido.
 */
export function parseTimestamp(value?: string | number): number | null {
  if (!value) return null;
  const ts = typeof value === 'string' ? new Date(value).getTime() : value;
  return isNaN(ts) ? null : ts;
}

export type TaskDeadlineStatus = 'not_open' | 'open' | 'late_period' | 'closed';

/**
 * Determina el estado actual de entrega de una tarea.
 * Toma en cuenta prórrogas del estudiante si se proporcionan.
 */
export function getTaskDeadlineStatus(
  settings: {
    availableFrom?: string;
    dueDate?: string;
    lateSubmissionDeadline?: string;
  },
  extensions?: DBDeadlineExtension[],
  studentId?: string
): TaskDeadlineStatus {
  const now = Date.now();
  const availableFrom = parseTimestamp(settings.availableFrom);
  let dueDate = parseTimestamp(settings.dueDate);
  let lateDeadline = parseTimestamp(settings.lateSubmissionDeadline);

  // Aplicar prórroga si existe para este estudiante
  const extension = getStudentExtension(extensions, studentId);
  if (extension) {
    if (extension.type === 'on_time') {
      dueDate = extension.newDeadline;
    } else {
      // 'late' extension: extend the late submission deadline
      lateDeadline = extension.newDeadline;
    }
  }

  // Si no hay fechas configuradas, siempre está abierta
  if (!availableFrom && !dueDate && !lateDeadline) return 'open';

  if (availableFrom && now < availableFrom) return 'not_open';
  if (dueDate && now <= dueDate) return 'open';
  if (lateDeadline && now <= lateDeadline) return 'late_period';
  if (dueDate || lateDeadline) return 'closed';

  return 'open';
}

/**
 * Calcula el tiempo real del examen al iniciar.
 * - Sin timeLimit (modo ventana): retorna segundos hasta el cierre
 * - Con timeLimit (modo cronometrado): retorna min(timeLimit * 60, segundos hasta el cierre)
 * - Sin availableUntil: retorna timeLimit * 60 o null
 */
export function getExamTimeLimit(
  timeLimit?: number, // en minutos
  availableUntil?: number // timestamp
): number | null {
  const now = Date.now();
  const secondsUntilClose = availableUntil
    ? Math.max(0, Math.floor((availableUntil - now) / 1000))
    : null;

  if (timeLimit && secondsUntilClose !== null) {
    return Math.min(timeLimit * 60, secondsUntilClose);
  }
  if (timeLimit) {
    return timeLimit * 60;
  }
  if (secondsUntilClose !== null) {
    return secondsUntilClose;
  }
  return null;
}

/**
 * Obtiene la prórroga vigente de un estudiante de una lista de extensiones.
 */
export function getStudentExtension(
  extensions?: DBDeadlineExtension[],
  studentId?: string
): DBDeadlineExtension | null {
  if (!extensions || !studentId) return null;
  return extensions.find(ext => ext.studentId === studentId) || null;
}

/**
 * Formatea un timestamp a string legible en español.
 */
export function formatDeadlineDate(timestamp: number | string): string {
  const date = new Date(typeof timestamp === 'string' ? timestamp : timestamp);
  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Calcula el tiempo restante en formato legible.
 */
export function getTimeRemaining(deadline: number): string {
  const diff = deadline - Date.now();
  if (diff <= 0) return 'Tiempo agotado';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes}min`;
}
