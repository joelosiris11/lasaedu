/**
 * Audit Log Service — Centralized audit and student activity logging
 *
 * Two Firestore collections:
 *  - auditLogs: Admin/teacher actions on cursos, módulos, lecciones, secciones, usuarios
 *  - studentActivityLogs: Entregas, re-entregas, completaciones de estudiantes
 *
 * All log writes are silent: failures are logged to console but never re-thrown,
 * so business operations never break because of logging.
 */

import { firebaseDB } from './firebaseDataService';
import { useAuthStore } from '@app/store/authStore';

// ============================================
// TYPES
// ============================================

export type AuditAction = 'create' | 'update' | 'delete';
export type AuditResourceType =
  | 'course'
  | 'module'
  | 'lesson'
  | 'section'
  | 'user'
  | 'evaluation';

export interface DBAuditLog {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId: string;
  resourceName: string;
  courseId?: string;
  sectionId?: string;
  changes?: Record<string, { from: unknown; to: unknown }>;
  metadata?: Record<string, unknown>;
  timestamp: number;
  createdAt: number;
  updatedAt: number;
}

export type StudentActivityType =
  | 'submission_created'
  | 'submission_resubmitted'
  | 'submission_deleted'
  | 'lesson_completed'
  | 'course_completed'
  | 'evaluation_submitted';

export type StudentResourceType = 'lesson' | 'course' | 'evaluation' | 'submission';

export interface DBStudentActivityLog {
  id: string;
  studentId: string;
  studentName: string;
  activityType: StudentActivityType;
  resourceType: StudentResourceType;
  resourceId: string;
  resourceName?: string;
  courseId?: string;
  sectionId?: string;
  instructorId?: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
  createdAt: number;
  updatedAt: number;
}

// ============================================
// INPUT TYPES (omit id/timestamp/createdAt/updatedAt)
// ============================================

export type AuditLogInput = Omit<
  DBAuditLog,
  'id' | 'timestamp' | 'createdAt' | 'updatedAt' | 'actorId' | 'actorName' | 'actorRole'
> & {
  actorId?: string;
  actorName?: string;
  actorRole?: string;
};

export type StudentActivityInput = Omit<
  DBStudentActivityLog,
  'id' | 'timestamp' | 'createdAt' | 'updatedAt' | 'studentId' | 'studentName'
> & {
  studentId?: string;
  studentName?: string;
};

// ============================================
// FILTERS
// ============================================

export interface AuditLogFilters {
  actorId?: string;
  resourceType?: AuditResourceType;
  action?: AuditAction;
  from?: number;
  to?: number;
}

export interface StudentActivityFilters {
  studentId?: string;
  activityType?: StudentActivityType;
  sectionIds?: string[];
  courseId?: string;
  from?: number;
  to?: number;
}

// ============================================
// HELPERS
// ============================================

function resolveActor() {
  const user = useAuthStore.getState().user;
  return {
    actorId: user?.id ?? 'system',
    actorName: user?.name ?? 'System',
    actorRole: (user?.role as string) ?? 'system',
  };
}

/**
 * Compute a shallow field-by-field diff between two objects.
 * Only includes fields that actually changed.
 */
export function diff(
  oldObj: Record<string, unknown> | null | undefined,
  newObj: Record<string, unknown>,
  keys?: string[]
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  const fieldKeys = keys ?? Object.keys(newObj);

  for (const k of fieldKeys) {
    const from = oldObj ? (oldObj as Record<string, unknown>)[k] : undefined;
    const to = (newObj as Record<string, unknown>)[k];
    if (JSON.stringify(from) !== JSON.stringify(to)) {
      changes[k] = { from, to };
    }
  }
  return changes;
}

// ============================================
// WRITERS (silent — never throw)
// ============================================

export async function logAudit(entry: AuditLogInput): Promise<void> {
  try {
    const actor = resolveActor();
    const timestamp = Date.now();
    const record = {
      ...actor,
      ...entry,
      timestamp,
    };
    // Strip undefined — Firestore rejects undefined values
    const clean = Object.fromEntries(
      Object.entries(record).filter(([_, v]) => v !== undefined)
    ) as unknown as Omit<DBAuditLog, 'id'>;
    await firebaseDB.create<DBAuditLog>('auditLogs', clean);
  } catch (err) {
    console.error('[auditLog] failed to write audit log:', err);
  }
}

export async function logStudent(entry: StudentActivityInput): Promise<void> {
  try {
    const user = useAuthStore.getState().user;
    const studentId = entry.studentId ?? user?.id ?? 'unknown';
    const studentName = entry.studentName ?? user?.name ?? 'Estudiante';
    const timestamp = Date.now();
    const record = {
      ...entry,
      studentId,
      studentName,
      timestamp,
    };
    const clean = Object.fromEntries(
      Object.entries(record).filter(([_, v]) => v !== undefined)
    ) as unknown as Omit<DBStudentActivityLog, 'id'>;
    await firebaseDB.create<DBStudentActivityLog>('studentActivityLogs', clean);
  } catch (err) {
    console.error('[auditLog] failed to write student activity log:', err);
  }
}

// ============================================
// READERS
// ============================================

export async function listAuditLogs(
  filters: AuditLogFilters = {}
): Promise<DBAuditLog[]> {
  try {
    const all = await firebaseDB.getAll<DBAuditLog>('auditLogs');
    return all
      .filter((l) => (filters.actorId ? l.actorId === filters.actorId : true))
      .filter((l) => (filters.resourceType ? l.resourceType === filters.resourceType : true))
      .filter((l) => (filters.action ? l.action === filters.action : true))
      .filter((l) => (filters.from ? l.timestamp >= filters.from : true))
      .filter((l) => (filters.to ? l.timestamp <= filters.to : true))
      .sort((a, b) => b.timestamp - a.timestamp);
  } catch (err) {
    console.error('[auditLog] failed to list audit logs:', err);
    return [];
  }
}

export async function listStudentActivity(
  filters: StudentActivityFilters = {}
): Promise<DBStudentActivityLog[]> {
  try {
    const all = await firebaseDB.getAll<DBStudentActivityLog>('studentActivityLogs');
    const sectionSet =
      filters.sectionIds && filters.sectionIds.length > 0
        ? new Set(filters.sectionIds)
        : null;

    return all
      .filter((l) => (filters.studentId ? l.studentId === filters.studentId : true))
      .filter((l) => (filters.activityType ? l.activityType === filters.activityType : true))
      .filter((l) => (filters.courseId ? l.courseId === filters.courseId : true))
      .filter((l) => (sectionSet ? (l.sectionId ? sectionSet.has(l.sectionId) : false) : true))
      .filter((l) => (filters.from ? l.timestamp >= filters.from : true))
      .filter((l) => (filters.to ? l.timestamp <= filters.to : true))
      .sort((a, b) => b.timestamp - a.timestamp);
  } catch (err) {
    console.error('[auditLog] failed to list student activity:', err);
    return [];
  }
}

export const auditLogService = {
  logAudit,
  logStudent,
  listAuditLogs,
  listStudentActivity,
  diff,
};

export default auditLogService;
