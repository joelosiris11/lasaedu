import {
  Video,
  FileText,
  Paperclip,
  HelpCircle,
  ClipboardList,
  MessageSquare,
  BookOpen,
  Layers,
  GraduationCap,
  Users,
  Building2,
  Briefcase,
} from 'lucide-react';
import type { AuditResourceType } from '@shared/services/auditLogService';

// Lesson subtypes carried in audit metadata
type LessonType = 'video' | 'texto' | 'recurso' | 'quiz' | 'tarea' | 'foro';

function getLessonType(metadata?: Record<string, unknown>): LessonType | undefined {
  const lt = metadata?.lessonType;
  if (
    lt === 'video' ||
    lt === 'texto' ||
    lt === 'recurso' ||
    lt === 'quiz' ||
    lt === 'tarea' ||
    lt === 'foro'
  ) {
    return lt;
  }
  return undefined;
}

export function getResourceIcon(
  resourceType: AuditResourceType,
  metadata?: Record<string, unknown>
): React.ElementType {
  if (resourceType === 'lesson') {
    const lt = getLessonType(metadata);
    switch (lt) {
      case 'video':
        return Video;
      case 'texto':
        return FileText;
      case 'recurso':
        return Paperclip;
      case 'quiz':
        return HelpCircle;
      case 'tarea':
        return ClipboardList;
      case 'foro':
        return MessageSquare;
    }
  }
  switch (resourceType) {
    case 'course':
      return BookOpen;
    case 'module':
      return Layers;
    case 'lesson':
      return FileText;
    case 'section':
      return GraduationCap;
    case 'user':
      return Users;
    case 'evaluation':
      return ClipboardList;
    case 'department':
      return Building2;
    case 'position':
      return Briefcase;
    default:
      return FileText;
  }
}

// "un curso", "un video", "una tarea"… — used in the popup summary line
export function getResourceLabel(
  resourceType: AuditResourceType,
  metadata?: Record<string, unknown>
): string {
  if (resourceType === 'lesson') {
    const lt = getLessonType(metadata);
    switch (lt) {
      case 'video':
        return 'un video';
      case 'texto':
        return 'un texto';
      case 'recurso':
        return 'un recurso';
      case 'quiz':
        return 'un quiz';
      case 'tarea':
        return 'una tarea';
      case 'foro':
        return 'un foro';
    }
  }
  switch (resourceType) {
    case 'course':
      return 'un curso';
    case 'module':
      return 'un módulo';
    case 'lesson':
      return 'una lección';
    case 'section':
      return 'una sección';
    case 'user':
      return 'un usuario';
    case 'evaluation':
      return 'una evaluación';
    case 'department':
      return 'un departamento';
    case 'position':
      return 'un puesto';
    default:
      return 'un recurso';
  }
}

// Short noun used in the table column ("Curso", "Video", "Tarea")
export function getResourceShortLabel(
  resourceType: AuditResourceType,
  metadata?: Record<string, unknown>
): string {
  if (resourceType === 'lesson') {
    const lt = getLessonType(metadata);
    switch (lt) {
      case 'video':
        return 'Video';
      case 'texto':
        return 'Texto';
      case 'recurso':
        return 'Recurso';
      case 'quiz':
        return 'Quiz';
      case 'tarea':
        return 'Tarea';
      case 'foro':
        return 'Foro';
    }
  }
  switch (resourceType) {
    case 'course':
      return 'Curso';
    case 'module':
      return 'Módulo';
    case 'lesson':
      return 'Lección';
    case 'section':
      return 'Sección';
    case 'user':
      return 'Usuario';
    case 'evaluation':
      return 'Evaluación';
    case 'department':
      return 'Departamento';
    case 'position':
      return 'Puesto';
    default:
      return 'Recurso';
  }
}
