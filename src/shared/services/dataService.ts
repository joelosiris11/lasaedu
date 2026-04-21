/**
 * DataService - Capa de abstracción de datos unificada
 * 
 * Este módulo proporciona acceso a todos los datos del LMS
 * utilizando Firebase Realtime Database como backend.
 */

import { firebaseDB } from './firebaseDataService';
import { enrollmentService } from './enrollmentService';
import { logAudit, logStudent, diff } from './auditLogService';
import { useAuthStore } from '@app/store/authStore';
import type {
  DBUser,
  DBCourse,
  DBModule,
  DBLesson,
  DBEnrollment,
  DBEvaluation,
  DBGrade,
  DBCertificate,
  DBConversation,
  DBMessage,
  DBNotification,
  DBSupportTicket,
  DBActivity,
  DBSystemMetric,
  DBUserSettings,
  DBForumPost,
  DBForumReply,
  DBTaskSubmission,
  DBDeadlineExtension,
  DBSection,
  DBSectionLessonOverride,
  PaginatedResult,
  PaginationOptions,
} from './firebaseDataService';

// Re-exportar tipos para consumidores
export type {
  DBUser,
  DBCourse,
  DBModule,
  DBLesson,
  DBEnrollment,
  DBEvaluation,
  DBGrade,
  DBCertificate,
  DBConversation,
  DBMessage,
  DBNotification,
  DBSupportTicket,
  DBActivity,
  DBSystemMetric,
  DBUserSettings,
  DBForumPost,
  DBForumReply,
  DBTaskSubmission,
  DBDeadlineExtension,
  DBSection,
  DBSectionLessonOverride,
  PaginatedResult,
  PaginationOptions,
};

// ============================================
// DASHBOARD SERVICE
// ============================================

export const dashboardService = {
  /**
   * Obtener estadísticas del sistema para admin dashboard
   */
  async getSystemStats() {
    const [users, courses, enrollments, tickets] = await Promise.all([
      firebaseDB.getUsers(),
      firebaseDB.getCourses(),
      firebaseDB.getEnrollments(),
      firebaseDB.getSupportTickets(),
    ]);

    const activeStudents = users.filter((u: DBUser) => u.role === 'student').length;
    const activeCourses = courses.filter((c: DBCourse) => c.status === 'publicado').length;
    const totalEnrollments = enrollments.length;
    const openTickets = tickets.filter((t: DBSupportTicket) => t.status !== 'resolved' && t.status !== 'closed').length;

    return {
      totalUsers: users.length,
      activeStudents,
      activeCourses,
      totalEnrollments,
      openTickets,
      totalTeachers: users.filter((u: DBUser) => u.role === 'teacher').length,
      completedCourses: enrollments.filter((e: DBEnrollment) => e.status === 'completed').length,
    };
  },

  /**
   * Obtener actividad reciente del sistema
   */
  async getRecentActivity(limit = 10): Promise<DBActivity[]> {
    const activities = await firebaseDB.getRecentActivities(limit);
    return activities;
  },

  /**
   * Obtener métricas del sistema
   */
  async getSystemMetrics() {
    const [users, courses, enrollments] = await Promise.all([
      firebaseDB.getUsers(),
      firebaseDB.getCourses(),
      firebaseDB.getEnrollments(),
    ]);

    // Calcular métricas
    const activeUsers = users.filter((u: DBUser) => {
      const lastWeek = Date.now() - 7 * 24 * 60 * 60 * 1000;
      return u.lastActive > lastWeek;
    }).length;

    const avgProgress = enrollments.length > 0
      ? enrollments.reduce((sum: number, e: DBEnrollment) => sum + (e.progress || 0), 0) / enrollments.length
      : 0;

    const publishedCourses = courses.filter((c: DBCourse) => c.status === 'publicado').length;

    return {
      activeUsers,
      totalUsers: users.length,
      avgProgress: Math.round(avgProgress),
      totalCourses: courses.length,
      publishedCourses,
      totalEnrollments: enrollments.length,
    };
  },

  /**
   * Obtener cursos del profesor (teacher dashboard)
   */
  async getTeacherCourses(teacherId: string) {
    const courses = await firebaseDB.getCoursesByInstructor(teacherId);
    const coursesWithEnrollments = await Promise.all(
      courses.map(async (course: DBCourse) => {
        const enrollments = await firebaseDB.getEnrollmentsByCourse(course.id);
        return {
          ...course,
          studentsEnrolled: enrollments.length,
          avgProgress: enrollments.length > 0
            ? Math.round(enrollments.reduce((sum: number, e: DBEnrollment) => sum + (e.progress || 0), 0) / enrollments.length)
            : 0,
        };
      })
    );
    return coursesWithEnrollments;
  },

  /**
   * Obtener cursos del estudiante (student dashboard)
   */
  async getStudentCourses(studentId: string) {
    const enrollments = await firebaseDB.getEnrollmentsByUser(studentId);
    const courses = await Promise.all(
      enrollments.map(async (enrollment: DBEnrollment) => {
        const course = await firebaseDB.getCourseById(enrollment.courseId);
        return course ? {
          ...course,
          progress: enrollment.progress || 0,
          enrollmentStatus: enrollment.status,
          lastAccessedAt: enrollment.lastAccessedAt,
        } : null;
      })
    );
    return courses.filter(Boolean);
  },

  /**
   * Obtener tickets de soporte (support dashboard)
   */
  async getSupportTickets(assigneeId?: string) {
    if (assigneeId) {
      return firebaseDB.getTicketsByAssignee(assigneeId);
    }
    const tickets = await firebaseDB.getSupportTickets();
    return tickets.sort((a: DBSupportTicket, b: DBSupportTicket) => b.createdAt - a.createdAt);
  },

  /**
   * Obtener estadísticas de soporte
   */
  async getSupportStats() {
    const tickets = await firebaseDB.getSupportTickets();
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    return {
      total: tickets.length,
      open: tickets.filter((t: DBSupportTicket) => t.status === 'open' || t.status === 'new').length,
      inProgress: tickets.filter((t: DBSupportTicket) => t.status === 'in_progress' || t.status === 'waiting').length,
      resolved: tickets.filter((t: DBSupportTicket) => t.status === 'resolved' || t.status === 'closed').length,
      todayNew: tickets.filter((t: DBSupportTicket) => now - t.createdAt < dayMs).length,
      highPriority: tickets.filter((t: DBSupportTicket) => t.priority === 'alta' || t.priority === 'urgente').length,
    };
  },

  /**
   * Admin overview: user distribution, enrollment breakdown, top courses
   */
  async getAdminOverview() {
    const [users, courses, enrollments] = await Promise.all([
      firebaseDB.getUsers(),
      firebaseDB.getCourses(),
      firebaseDB.getEnrollments(),
    ]);

    const usersByRole = {
      admin: users.filter((u: DBUser) => u.role === 'admin').length,
      teacher: users.filter((u: DBUser) => u.role === 'teacher').length,
      student: users.filter((u: DBUser) => u.role === 'student').length,
      support: users.filter((u: DBUser) => u.role === 'support').length,
    };

    const enrollmentsByStatus = {
      active: enrollments.filter((e: DBEnrollment) => e.status === 'active').length,
      completed: enrollments.filter((e: DBEnrollment) => e.status === 'completed').length,
      paused: enrollments.filter((e: DBEnrollment) => e.status === 'paused').length,
      cancelled: enrollments.filter((e: DBEnrollment) => e.status === 'cancelled').length,
    };

    const topCourses = courses.map((c: DBCourse) => {
      const courseEnrollments = enrollments.filter((e: DBEnrollment) => e.courseId === c.id);
      const completed = courseEnrollments.filter((e: DBEnrollment) => e.status === 'completed').length;
      const avgProgress = courseEnrollments.length > 0
        ? Math.round(courseEnrollments.reduce((sum: number, e: DBEnrollment) => sum + (e.progress || 0), 0) / courseEnrollments.length)
        : 0;
      return {
        id: c.id,
        title: c.title,
        enrollments: courseEnrollments.length,
        avgProgress,
        completionRate: courseEnrollments.length > 0 ? Math.round((completed / courseEnrollments.length) * 100) : 0,
        status: c.status,
      };
    }).sort((a: any, b: any) => b.enrollments - a.enrollments).slice(0, 5);

    const completionRate = enrollments.length > 0
      ? Math.round((enrollments.filter((e: DBEnrollment) => e.status === 'completed').length / enrollments.length) * 100)
      : 0;

    return { usersByRole, enrollmentsByStatus, topCourses, completionRate };
  },

  /**
   * Teacher performance: per-course stats with grade data
   */
  async getTeacherPerformance(teacherId: string) {
    const courses = await firebaseDB.getCoursesByInstructor(teacherId);

    // Fetch enrollments and grades per course in parallel, keep enrollments for reuse
    const courseData = await Promise.all(
      courses.map(async (course: DBCourse) => {
        const [enrollments, courseGrades] = await Promise.all([
          firebaseDB.getEnrollmentsByCourse(course.id),
          firebaseDB.getGradesByCourse(course.id),
        ]);
        return { course, enrollments, courseGrades };
      })
    );

    const coursePerformance = courseData.map(({ course, enrollments, courseGrades }) => {
      const avgGrade = courseGrades.length > 0
        ? Math.round(courseGrades.reduce((sum: number, g: DBGrade) => sum + (g.score || 0), 0) / courseGrades.length)
        : null;
      const avgProgress = enrollments.length > 0
        ? Math.round(enrollments.reduce((sum: number, e: DBEnrollment) => sum + (e.progress || 0), 0) / enrollments.length)
        : 0;
      const completed = enrollments.filter((e: DBEnrollment) => e.status === 'completed').length;

      return {
        id: course.id,
        title: course.title,
        status: course.status,
        students: enrollments.length,
        avgProgress,
        avgGrade,
        completedStudents: completed,
        activeStudents: enrollments.filter((e: DBEnrollment) => e.status === 'active').length,
      };
    });

    // Reuse already-fetched enrollments (no duplicate queries)
    const allEnrollments = courseData.flatMap(d => d.enrollments);

    const progressDistribution = {
      low: allEnrollments.filter((e: DBEnrollment) => (e.progress || 0) < 25).length,
      medium: allEnrollments.filter((e: DBEnrollment) => (e.progress || 0) >= 25 && (e.progress || 0) < 50).length,
      high: allEnrollments.filter((e: DBEnrollment) => (e.progress || 0) >= 50 && (e.progress || 0) < 75).length,
      complete: allEnrollments.filter((e: DBEnrollment) => (e.progress || 0) >= 75).length,
    };

    return { coursePerformance, progressDistribution, totalStudents: new Set(allEnrollments.map(e => e.userId)).size };
  },

  /**
   * Student grades summary
   */
  async getStudentGradesSummary(studentId: string) {
    const grades = await firebaseDB.getGradesByStudent(studentId);
    const avgGrade = grades.length > 0
      ? Math.round(grades.reduce((sum: number, g: DBGrade) => sum + (g.score || 0), 0) / grades.length)
      : null;
    return { grades, avgGrade, totalGrades: grades.length };
  },
};

// ============================================
// USER SERVICE
// ============================================

export const userService = {
  getAll: () => firebaseDB.getUsers(),
  getById: (id: string) => firebaseDB.getUserById(id),
  getByEmail: (email: string) => firebaseDB.getUserByEmail(email),
  create: async (data: Omit<DBUser, 'id'>) => {
    const result = await firebaseDB.createUser(data);
    await logAudit({
      action: 'create',
      resourceType: 'user',
      resourceId: result.id,
      resourceName: result.name,
      metadata: { email: result.email, role: result.role },
    });
    return result;
  },
  update: async (id: string, data: Partial<DBUser>) => {
    const before = await firebaseDB.getUserById(id);
    const result = await firebaseDB.updateUser(id, data);
    const changes = diff(before as unknown as Record<string, unknown> | undefined, data as Record<string, unknown>);
    await logAudit({
      action: 'update',
      resourceType: 'user',
      resourceId: id,
      resourceName: result?.name ?? before?.name ?? id,
      changes,
    });
    return result;
  },
  delete: async (id: string) => {
    const before = await firebaseDB.getUserById(id);
    const result = await firebaseDB.delete('users', id);
    await logAudit({
      action: 'delete',
      resourceType: 'user',
      resourceId: id,
      resourceName: before?.name ?? id,
      metadata: before ? { email: before.email, role: before.role } : undefined,
    });
    return result;
  },

  subscribe: (callback: (users: DBUser[]) => void) =>
    firebaseDB.subscribe<DBUser>('users', callback),
};

// ============================================
// COURSE SERVICE
// ============================================

export const courseService = {
  getAll: () => firebaseDB.getCourses(),
  getById: (id: string) => firebaseDB.getCourseById(id),
  getByInstructor: (instructorId: string) => firebaseDB.getCoursesByInstructor(instructorId),
  getByStatus: (status: string) => firebaseDB.getCoursesByStatus(status),
  create: async (data: Omit<DBCourse, 'id'>) => {
    const result = await firebaseDB.createCourse(data);
    await logAudit({
      action: 'create',
      resourceType: 'course',
      resourceId: result.id,
      resourceName: result.title,
      courseId: result.id,
    });
    return result;
  },
  update: async (id: string, data: Partial<DBCourse>) => {
    const before = await firebaseDB.getCourseById(id);
    const result = await firebaseDB.updateCourse(id, data);
    const changes = diff(before as unknown as Record<string, unknown> | undefined, data as Record<string, unknown>);
    await logAudit({
      action: 'update',
      resourceType: 'course',
      resourceId: id,
      resourceName: result?.title ?? before?.title ?? id,
      courseId: id,
      changes,
    });
    return result;
  },
  delete: async (id: string) => {
    const before = await firebaseDB.getCourseById(id);
    const result = await firebaseDB.delete('courses', id);
    await logAudit({
      action: 'delete',
      resourceType: 'course',
      resourceId: id,
      resourceName: before?.title ?? id,
      courseId: id,
    });
    return result;
  },

  subscribe: (callback: (courses: DBCourse[]) => void) =>
    firebaseDB.subscribe<DBCourse>('courses', callback),
};

// ============================================
// SECTION SERVICE
// ============================================

export const sectionService = {
  getAll: () => firebaseDB.getSections(),
  getById: (id: string) => firebaseDB.getSectionById(id),
  getByCourse: (courseId: string) => firebaseDB.getSectionsByCourse(courseId),
  getByInstructor: (instructorId: string) => firebaseDB.getSectionsByInstructor(instructorId),
  create: async (data: Omit<DBSection, 'id'>) => {
    const result = await firebaseDB.createSection(data);
    await logAudit({
      action: 'create',
      resourceType: 'section',
      resourceId: result.id,
      resourceName: result.title,
      courseId: result.courseId,
      sectionId: result.id,
    });
    return result;
  },
  update: async (id: string, data: Partial<DBSection>) => {
    const before = await firebaseDB.getSectionById(id);
    const result = await firebaseDB.updateSection(id, data);
    const changes = diff(before as unknown as Record<string, unknown> | undefined, data as Record<string, unknown>);
    await logAudit({
      action: 'update',
      resourceType: 'section',
      resourceId: id,
      resourceName: result?.title ?? before?.title ?? id,
      courseId: (result?.courseId ?? before?.courseId),
      sectionId: id,
      changes,
    });
    return result;
  },
  delete: async (id: string) => {
    const before = await firebaseDB.getSectionById(id);
    const result = await firebaseDB.deleteSection(id);
    await logAudit({
      action: 'delete',
      resourceType: 'section',
      resourceId: id,
      resourceName: before?.title ?? id,
      courseId: before?.courseId,
      sectionId: id,
    });
    return result;
  },

  getLessonOverrides: (sectionId: string) => firebaseDB.getSectionLessonOverrides(sectionId),
  saveLessonOverrides: (sectionId: string, overrides: (Omit<DBSectionLessonOverride, 'id'> & { id?: string })[]) =>
    firebaseDB.bulkUpsertSectionLessonOverrides(sectionId, overrides),
  upsertLessonOverride: (data: Omit<DBSectionLessonOverride, 'id'> & { id?: string }) =>
    firebaseDB.upsertSectionLessonOverride(data),

  getEnrollments: (sectionId: string) => firebaseDB.getEnrollmentsBySection(sectionId),

  subscribe: (callback: (sections: DBSection[]) => void) =>
    firebaseDB.subscribe<DBSection>('sections', callback),
};

// ============================================
// MODULE SERVICE
// ============================================

export const moduleService = {
  getAll: () => firebaseDB.getAll<DBModule>('modules'),
  getById: (id: string) => firebaseDB.getById<DBModule>('modules', id),
  getByCourse: (courseId: string) => firebaseDB.getModulesByCourse(courseId),
  create: async (data: Omit<DBModule, 'id'>) => {
    const result = await firebaseDB.createModule(data);
    await logAudit({
      action: 'create',
      resourceType: 'module',
      resourceId: result.id,
      resourceName: result.title,
      courseId: result.courseId,
    });
    return result;
  },
  update: async (id: string, data: Partial<DBModule>) => {
    const before = await firebaseDB.getById<DBModule>('modules', id);
    const result = await firebaseDB.updateModule(id, data);
    const changes = diff(before as unknown as Record<string, unknown> | undefined, data as Record<string, unknown>);
    await logAudit({
      action: 'update',
      resourceType: 'module',
      resourceId: id,
      resourceName: result?.title ?? before?.title ?? id,
      courseId: result?.courseId ?? before?.courseId,
      changes,
    });
    return result;
  },
  delete: async (id: string) => {
    const before = await firebaseDB.getById<DBModule>('modules', id);
    const result = await firebaseDB.delete('modules', id);
    await logAudit({
      action: 'delete',
      resourceType: 'module',
      resourceId: id,
      resourceName: before?.title ?? id,
      courseId: before?.courseId,
    });
    return result;
  },

  subscribe: (callback: (modules: DBModule[]) => void) =>
    firebaseDB.subscribe<DBModule>('modules', callback),
};

// ============================================
// LESSON SERVICE
// ============================================

export const lessonService = {
  getAll: () => firebaseDB.getAll<DBLesson>('lessons'),
  getById: (id: string) => firebaseDB.getById<DBLesson>('lessons', id),
  getByModule: (moduleId: string) => firebaseDB.getLessonsByModule(moduleId),
  getByCourse: (courseId: string) => firebaseDB.getLessonsByCourse(courseId),
  create: async (data: Omit<DBLesson, 'id'>) => {
    const result = await firebaseDB.createLesson(data);
    await logAudit({
      action: 'create',
      resourceType: 'lesson',
      resourceId: result.id,
      resourceName: result.title,
      courseId: result.courseId,
      metadata: { lessonType: result.type },
    });
    return result;
  },
  update: async (id: string, data: Partial<DBLesson>) => {
    const before = await firebaseDB.getById<DBLesson>('lessons', id);
    const result = await firebaseDB.updateLesson(id, data);
    const changes = diff(before as unknown as Record<string, unknown> | undefined, data as Record<string, unknown>);
    await logAudit({
      action: 'update',
      resourceType: 'lesson',
      resourceId: id,
      resourceName: result?.title ?? before?.title ?? id,
      courseId: result?.courseId ?? before?.courseId,
      changes,
      metadata: { lessonType: result?.type ?? before?.type },
    });
    return result;
  },
  delete: async (id: string) => {
    const before = await firebaseDB.getById<DBLesson>('lessons', id);
    const result = await firebaseDB.delete('lessons', id);
    await logAudit({
      action: 'delete',
      resourceType: 'lesson',
      resourceId: id,
      resourceName: before?.title ?? id,
      courseId: before?.courseId,
      metadata: { lessonType: before?.type },
    });
    return result;
  },

  subscribe: (callback: (lessons: DBLesson[]) => void) =>
    firebaseDB.subscribe<DBLesson>('lessons', callback),
};

// ============================================
// ENROLLMENT SERVICE
// ============================================

export { enrollmentService } from './enrollmentService';

// Legacy enrollment service for backward compatibility
export const legacyEnrollmentService = {
  getAll: () => firebaseDB.getEnrollments(),
  getById: (id: string) => firebaseDB.getById<DBEnrollment>('enrollments', id),
  getByUser: (userId: string) => firebaseDB.getEnrollmentsByUser(userId),
  getByCourse: (courseId: string) => firebaseDB.getEnrollmentsByCourse(courseId),
  getOne: (userId: string, courseId: string) => firebaseDB.getEnrollment(userId, courseId),
  
  create: (data: Omit<DBEnrollment, 'id'>) => firebaseDB.createEnrollment(data),
  update: (id: string, data: Partial<DBEnrollment>) => firebaseDB.updateEnrollment(id, data),
  delete: (id: string) => firebaseDB.delete('enrollments', id),
  
  /**
   * Inscribir estudiante en un curso
   */
  async enrollStudent(userId: string, courseId: string): Promise<DBEnrollment> {
    const existing = await firebaseDB.getEnrollment(userId, courseId);
    if (existing) {
      throw new Error('El estudiante ya está inscrito en este curso');
    }
    
    const now = Date.now();
    return firebaseDB.createEnrollment({
      userId,
      courseId,
      status: 'active',
      progress: 0,
      completedLessons: [],
      completedModules: [],
      totalTimeSpent: 0,
      enrolledAt: new Date().toISOString(),
      lastAccessedAt: new Date().toISOString(),
      createdAt: now,
      updatedAt: now,
    });
  },
  
  /**
   * Actualizar progreso de lección
   */
  updateProgress: (enrollmentId: string, lessonId: string, totalLessons: number) =>
    firebaseDB.updateProgress(enrollmentId, lessonId, totalLessons),
  
  subscribe: (callback: (enrollments: DBEnrollment[]) => void) => 
    firebaseDB.subscribe<DBEnrollment>('enrollments', callback),
};

// ============================================
// EVALUATION SERVICE
// ============================================

export const evaluationService = {
  getAll: () => firebaseDB.getEvaluations(),
  getById: (id: string) => firebaseDB.getById<DBEvaluation>('evaluations', id),
  getByCourse: (courseId: string) => firebaseDB.getEvaluationsByCourse(courseId),
  create: async (data: Omit<DBEvaluation, 'id'>) => {
    const result = await firebaseDB.createEvaluation(data);
    await logAudit({
      action: 'create',
      resourceType: 'evaluation',
      resourceId: result.id,
      resourceName: result.title,
      courseId: result.courseId,
    });
    return result;
  },
  update: async (id: string, data: Partial<DBEvaluation>) => {
    const before = await firebaseDB.getById<DBEvaluation>('evaluations', id);
    const result = await firebaseDB.updateEvaluation(id, data);
    const changes = diff(before as unknown as Record<string, unknown> | undefined, data as Record<string, unknown>);
    await logAudit({
      action: 'update',
      resourceType: 'evaluation',
      resourceId: id,
      resourceName: result?.title ?? before?.title ?? id,
      courseId: result?.courseId ?? before?.courseId,
      changes,
    });
    return result;
  },
  delete: async (id: string) => {
    const before = await firebaseDB.getById<DBEvaluation>('evaluations', id);
    const result = await firebaseDB.delete('evaluations', id);
    await logAudit({
      action: 'delete',
      resourceType: 'evaluation',
      resourceId: id,
      resourceName: before?.title ?? id,
      courseId: before?.courseId,
    });
    return result;
  },

  // Intentos de evaluación
  getAttemptsByUser: (userId: string) => firebaseDB.getEvaluationAttempts(userId),
  getAttemptsByEvaluation: (evalId: string) => firebaseDB.getAttemptsByEvaluation(evalId),
  createAttempt: (data: any) => firebaseDB.createAttempt(data),
  updateAttempt: (id: string, data: any) => firebaseDB.updateAttempt(id, data),

  subscribe: (callback: (evaluations: DBEvaluation[]) => void) =>
    firebaseDB.subscribe<DBEvaluation>('evaluations', callback),
};

// ============================================
// GRADE SERVICE
// ============================================

export const gradeService = {
  getAll: () => firebaseDB.getAll<DBGrade>('grades'),
  getById: (id: string) => firebaseDB.getById<DBGrade>('grades', id),
  getByStudent: (studentId: string) => firebaseDB.getGradesByStudent(studentId),
  getByCourse: (courseId: string) => firebaseDB.getGradesByCourse(courseId),
  create: (data: Omit<DBGrade, 'id'>) => firebaseDB.createGrade(data),
  update: (id: string, data: Partial<DBGrade>) => firebaseDB.updateGrade(id, data),
  delete: (id: string) => firebaseDB.delete('grades', id),
  
  subscribe: (callback: (grades: DBGrade[]) => void) => 
    firebaseDB.subscribe<DBGrade>('grades', callback),
};

// ============================================
// CERTIFICATE SERVICE
// ============================================

export const certificateService = {
  getAll: () => firebaseDB.getAll<DBCertificate>('certificates'),
  getById: (id: string) => firebaseDB.getById<DBCertificate>('certificates', id),
  getByUser: (userId: string) => firebaseDB.getCertificatesByUser(userId),
  getByCredential: (credentialId: string) => firebaseDB.getCertificateByCredential(credentialId),
  create: (data: Omit<DBCertificate, 'id'>) => firebaseDB.createCertificate(data),
  delete: (id: string) => firebaseDB.delete('certificates', id),
  
  subscribe: (callback: (certificates: DBCertificate[]) => void) => 
    firebaseDB.subscribe<DBCertificate>('certificates', callback),
};

// ============================================
// CONVERSATION SERVICE
// ============================================

export const conversationService = {
  getAll: () => firebaseDB.getAll<DBConversation>('conversations'),
  getById: (id: string) => firebaseDB.getById<DBConversation>('conversations', id),
  getByParticipant: (userId: string) => firebaseDB.getConversationsByUser(userId),
  create: (data: Omit<DBConversation, 'id'>) => firebaseDB.createConversation(data),
  update: (id: string, data: Partial<DBConversation>) => firebaseDB.update<DBConversation>('conversations', id, data),
  delete: (id: string) => firebaseDB.delete('conversations', id),
  
  subscribe: (callback: (conversations: DBConversation[]) => void) => 
    firebaseDB.subscribe<DBConversation>('conversations', callback),
};

// ============================================
// MESSAGE SERVICE
// ============================================

export const messageService = {
  getAll: () => firebaseDB.getAll<DBMessage>('messages'),
  getById: (id: string) => firebaseDB.getById<DBMessage>('messages', id),
  getByConversation: (conversationId: string) => firebaseDB.getMessagesByConversation(conversationId),
  create: (data: Omit<DBMessage, 'id'>) => firebaseDB.createMessage(data),
  update: (id: string, data: Partial<DBMessage>) => firebaseDB.update<DBMessage>('messages', id, data),
  delete: (id: string) => firebaseDB.delete('messages', id),
  
  subscribeToConversation: (conversationId: string, callback: (messages: DBMessage[]) => void) => {
    // Suscribirse a mensajes de una conversación específica
    return firebaseDB.subscribe<DBMessage>('messages', (allMessages) => {
      const filtered = allMessages.filter(m => m.conversationId === conversationId);
      callback(filtered);
    });
  },
};

// ============================================
// NOTIFICATION SERVICE
// ============================================

export const notificationService = {
  getAll: () => firebaseDB.getAll<DBNotification>('notifications'),
  getById: (id: string) => firebaseDB.getById<DBNotification>('notifications', id),
  getByUser: (userId: string) => firebaseDB.getNotificationsByUser(userId),
  create: (data: Omit<DBNotification, 'id'>) => firebaseDB.createNotification(data),
  delete: (id: string) => firebaseDB.delete('notifications', id),
  
  markAsRead: (id: string) => firebaseDB.markNotificationRead(id),
  
  async markAllAsRead(userId: string): Promise<void> {
    const notifications = await firebaseDB.getNotificationsByUser(userId);
    const unread = notifications.filter(n => !n.read);
    await Promise.all(unread.map(n => firebaseDB.markNotificationRead(n.id)));
  },
  
  subscribeToUser: (userId: string, callback: (notifications: DBNotification[]) => void) => {
    return firebaseDB.subscribe<DBNotification>('notifications', (allNotifications) => {
      const filtered = allNotifications.filter(n => n.userId === userId);
      callback(filtered);
    });
  },
};

// ============================================
// SUPPORT TICKET SERVICE
// ============================================

export const supportTicketService = {
  getAll: () => firebaseDB.getSupportTickets(),
  getById: (id: string) => firebaseDB.getById<DBSupportTicket>('supportTickets', id),
  getByUser: (userId: string) => firebaseDB.getTicketsByUser(userId),
  getByStatus: (status: string) => firebaseDB.query<DBSupportTicket>('supportTickets', 'status', status),
  getByAssignee: (assigneeId: string) => firebaseDB.getTicketsByAssignee(assigneeId),
  
  create: (data: Omit<DBSupportTicket, 'id'>) => firebaseDB.createTicket(data),
  update: (id: string, data: Partial<DBSupportTicket>) => firebaseDB.updateTicket(id, data),
  delete: (id: string) => firebaseDB.delete('supportTickets', id),
  
  addMessage: (ticketId: string, message: any) => firebaseDB.addTicketMessage(ticketId, message),
  
  subscribe: (callback: (tickets: DBSupportTicket[]) => void) => 
    firebaseDB.subscribe<DBSupportTicket>('supportTickets', callback),
};

// ============================================
// ACTIVITY SERVICE
// ============================================

export const activityService = {
  getAll: () => firebaseDB.getAll<DBActivity>('activities'),
  getRecent: (limit = 50) => firebaseDB.getRecentActivities(limit),
  getByUser: (userId: string, limit = 50) => firebaseDB.getActivitiesByUser(userId, limit),
  
  /**
   * Registrar una nueva actividad
   */
  log: (activity: Omit<DBActivity, 'id' | 'timestamp'>) => 
    firebaseDB.logActivity({
      ...activity,
      timestamp: Date.now(),
    } as Omit<DBActivity, 'id'>),
  
  subscribe: (callback: (activities: DBActivity[]) => void) => 
    firebaseDB.subscribe<DBActivity>('activities', callback),
};

// ============================================
// USER SETTINGS SERVICE
// ============================================

export const userSettingsService = {
  getByUser: async (userId: string): Promise<DBUserSettings | null> => {
    const settings = await firebaseDB.query<DBUserSettings>('userSettings', 'userId', userId);
    return settings[0] || null;
  },
  update: (id: string, data: Partial<DBUserSettings>) => firebaseDB.update<DBUserSettings>('userSettings', id, data),
  create: (data: Omit<DBUserSettings, 'id'>) => firebaseDB.create<DBUserSettings>('userSettings', data),
};

// ============================================
// FORUM SERVICE
// ============================================

export const forumService = {
  getPosts: () => firebaseDB.getForumPosts(),
  getPostsByCourse: (courseId: string) => firebaseDB.getForumPostsByCourse(courseId),
  getPostsByLesson: (lessonId: string) => firebaseDB.getForumPostsByLesson(lessonId),
  getReplies: (postId: string) => firebaseDB.getForumReplies(postId),
  getAllReplies: () => firebaseDB.getAllForumReplies(),
  createPost: (data: Omit<DBForumPost, 'id'>) => firebaseDB.createForumPost(data),
  updatePost: (id: string, data: Partial<DBForumPost>) => firebaseDB.updateForumPost(id, data),
  deletePost: (id: string) => firebaseDB.deleteForumPost(id),
  createReply: (data: Omit<DBForumReply, 'id'>) => firebaseDB.createForumReply(data),
  updateReply: (id: string, data: Partial<DBForumReply>) => firebaseDB.updateForumReply(id, data),
  deleteReply: (id: string) => firebaseDB.deleteForumReply(id),
};

// ============================================
// TASK SUBMISSION SERVICE
// ============================================

async function resolveInstructorForSubmission(sub: Pick<DBTaskSubmission, 'sectionId' | 'courseId'>): Promise<string | undefined> {
  try {
    if (sub.sectionId) {
      const section = await firebaseDB.getSectionById(sub.sectionId);
      if (section?.instructorId) return section.instructorId;
    }
    if (sub.courseId) {
      const course = await firebaseDB.getCourseById(sub.courseId);
      return course?.instructorId;
    }
  } catch (err) {
    console.error('[auditLog] failed to resolve instructor for submission:', err);
  }
  return undefined;
}

export const taskSubmissionService = {
  getAll: () => firebaseDB.getTaskSubmissions(),
  getById: (id: string) => firebaseDB.getById<DBTaskSubmission>('taskSubmissions', id),
  getByLesson: (lessonId: string) => firebaseDB.getTaskSubmissionsByLesson(lessonId),
  getByStudent: (studentId: string) => firebaseDB.getTaskSubmissionsByStudent(studentId),
  create: async (data: Omit<DBTaskSubmission, 'id'>) => {
    const result = await firebaseDB.createTaskSubmission(data);
    const instructorId = await resolveInstructorForSubmission(result);
    let lessonName: string | undefined;
    try {
      const lesson = await firebaseDB.getById<DBLesson>('lessons', result.lessonId);
      lessonName = lesson?.title;
    } catch (_err) {
      // ignore
    }
    await logStudent({
      activityType: 'submission_created',
      resourceType: 'submission',
      resourceId: result.id,
      resourceName: lessonName,
      courseId: result.courseId,
      sectionId: result.sectionId,
      instructorId,
      studentId: result.studentId,
      studentName: result.studentName,
      metadata: {
        lessonId: result.lessonId,
        filesCount: result.files?.length ?? 0,
        submissionType: result.submissionType,
      },
    });
    return result;
  },
  update: async (id: string, data: Partial<DBTaskSubmission>) => {
    const before = await firebaseDB.getById<DBTaskSubmission>('taskSubmissions', id);
    const result = await firebaseDB.updateTaskSubmission(id, data);
    try {
      const actor = useAuthStore.getState().user;
      if (actor?.role === 'student' && before) {
        const instructorId = await resolveInstructorForSubmission(before);
        let activity: 'submission_resubmitted' | 'submission_deleted' | null = null;
        const patch = data as any;
        if (patch.status === 'deleted') {
          activity = 'submission_deleted';
        } else {
          const filesChanged = 'files' in patch &&
            JSON.stringify((before as any).files) !== JSON.stringify(patch.files);
          const commentChanged = 'comment' in patch && (before as any).comment !== patch.comment;
          if (filesChanged || commentChanged) {
            activity = 'submission_resubmitted';
          }
        }
        if (activity) {
          await logStudent({
            activityType: activity,
            resourceType: 'submission',
            resourceId: id,
            courseId: before.courseId,
            sectionId: before.sectionId,
            instructorId,
            studentId: before.studentId,
            studentName: before.studentName,
            metadata: { lessonId: before.lessonId },
          });
        }
      }
    } catch (err) {
      console.error('[auditLog] submission update log failed:', err);
    }

    // Cuando una entrega transiciona a 'graded' con nota >= 70% del máximo,
    // se cuenta la lección como completada en el enrollment del estudiante.
    try {
      const patch = data as Partial<DBTaskSubmission>;
      const transitionedToGraded =
        patch.status === 'graded' && before?.status !== 'graded';
      const grade = patch.grade ?? before?.grade;
      if (transitionedToGraded && before && grade && grade.maxScore > 0) {
        const percentage = (grade.score / grade.maxScore) * 100;
        if (percentage >= 70) {
          const enrollment = await firebaseDB.getEnrollment(
            before.studentId,
            before.courseId
          );
          if (enrollment) {
            const prevCompleted = enrollment.completedLessons || [];
            if (!prevCompleted.includes(before.lessonId)) {
              const newCompleted = [...prevCompleted, before.lessonId];
              const allLessons = await firebaseDB.getLessonsByCourse(before.courseId);
              const totalLessons = allLessons.length || 1;
              const progress = Math.min(
                100,
                Math.round((newCompleted.length / totalLessons) * 100)
              );
              await firebaseDB.updateEnrollment(enrollment.id, {
                completedLessons: newCompleted,
                progress,
                status: progress >= 100 ? 'completed' : enrollment.status,
                updatedAt: Date.now(),
              });
            }
          }
        }
      }
    } catch (err) {
      console.error('[grading] failed to update enrollment completion:', err);
    }

    return result;
  },
};

// ============================================
// DEADLINE EXTENSION SERVICE
// ============================================

export const extensionService = {
  getAll: () => firebaseDB.getDeadlineExtensions(),
  getByTarget: (targetId: string) => firebaseDB.getExtensionsByTarget(targetId),
  getByStudent: (studentId: string) => firebaseDB.getExtensionsByStudent(studentId),
  create: (data: Omit<DBDeadlineExtension, 'id'>) => firebaseDB.createExtension(data),
  delete: (id: string) => firebaseDB.deleteExtension(id),
};

// ============================================
// METRICS SERVICE
// ============================================

export const metricsService = {
  getAll: () => firebaseDB.getAll<DBSystemMetric>('systemMetrics'),
  getByDate: (date: string) => firebaseDB.getSystemMetrics(date),
  getCurrent: () => firebaseDB.getSystemMetrics(),
  update: (metrics: any) => firebaseDB.updateSystemMetrics(metrics),
  
  subscribe: (callback: (metrics: DBSystemMetric[]) => void) => 
    firebaseDB.subscribe<DBSystemMetric>('systemMetrics', callback),
};

// ============================================
// COURSE SNAPSHOT SERVICE (for admin rollback)
// ============================================

export interface DBCourseSnapshot {
  id: string;
  courseId: string;
  courseTitle: string;
  snapshotData: {
    course: DBCourse;
    modules: DBModule[];
    lessons: DBLesson[];
  };
  savedAt: number;
  savedBy: string;
}

export const courseSnapshotService = {
  /** Get all snapshots */
  getAll: () => firebaseDB.getAll<DBCourseSnapshot>('courseSnapshots'),

  /** Get snapshot for a specific course (only one per course) */
  async getByCourse(courseId: string): Promise<DBCourseSnapshot | null> {
    const results = await firebaseDB.query<DBCourseSnapshot>('courseSnapshots', 'courseId', courseId);
    return results[0] || null;
  },

  /** Save a snapshot for a course (replaces existing) */
  async saveSnapshot(courseId: string, savedBy: string): Promise<DBCourseSnapshot> {
    const course = await firebaseDB.getCourseById(courseId);
    if (!course) throw new Error('Curso no encontrado');

    const modules = await firebaseDB.getModulesByCourse(courseId);
    const lessons = await firebaseDB.getLessonsByCourse(courseId);

    // Check if snapshot already exists for this course
    const existing = await this.getByCourse(courseId);

    const snapshotData = {
      courseId,
      courseTitle: course.title,
      snapshotData: { course, modules, lessons },
      savedAt: Date.now(),
      savedBy,
    };

    if (existing) {
      await firebaseDB.update<DBCourseSnapshot>('courseSnapshots', existing.id, snapshotData);
      return { ...existing, ...snapshotData };
    } else {
      return firebaseDB.create<DBCourseSnapshot>('courseSnapshots', snapshotData as any);
    }
  },

  /** Rollback a course to its snapshot */
  async rollback(courseId: string): Promise<boolean> {
    const snapshot = await this.getByCourse(courseId);
    if (!snapshot) throw new Error('No hay snapshot para este curso');

    const { course, modules, lessons } = snapshot.snapshotData;

    // Restore course data
    await firebaseDB.updateCourse(courseId, {
      title: course.title,
      description: course.description,
      category: course.category,
      level: course.level,
      duration: course.duration,
      status: course.status,
      image: course.image,
      tags: course.tags,
      requirements: course.requirements,
      updatedAt: Date.now(),
    });

    // Restore modules - delete current and recreate from snapshot
    const currentModules = await firebaseDB.getModulesByCourse(courseId);
    for (const mod of currentModules) {
      await firebaseDB.delete('modules', mod.id);
    }
    for (const mod of modules) {
      await firebaseDB.create<DBModule>('modules', { ...mod, id: mod.id } as any);
    }

    // Restore lessons - delete current and recreate from snapshot
    const currentLessons = await firebaseDB.getLessonsByCourse(courseId);
    for (const lesson of currentLessons) {
      await firebaseDB.delete('lessons', lesson.id);
    }
    for (const lesson of lessons) {
      await firebaseDB.create<DBLesson>('lessons', { ...lesson, id: lesson.id } as any);
    }

    return true;
  },

  /** Delete a snapshot */
  async delete(courseId: string): Promise<boolean> {
    const snapshot = await this.getByCourse(courseId);
    if (!snapshot) return false;
    return firebaseDB.delete('courseSnapshots', snapshot.id);
  },
};

// ============================================
// UTILIDADES
// ============================================

// Main dataService export for backward compatibility
export const dataService = {
  users: userService,
  courses: courseService,
  enrollments: legacyEnrollmentService,
  notifications: notificationService
};
// ============================================

export const dataUtils = {
  seedDatabase: () => firebaseDB.seedDatabase(),
  clearDatabase: () => firebaseDB.clearDatabase(),
  exportData: () => firebaseDB.exportData(),
  importData: (data: Record<string, unknown[]>) => firebaseDB.importData(data),
};

// Export por defecto
export default {
  dashboard: dashboardService,
  users: userService,
  courses: courseService,
  sections: sectionService,
  modules: moduleService,
  lessons: lessonService,
  enrollments: enrollmentService,
  evaluations: evaluationService,
  grades: gradeService,
  certificates: certificateService,
  conversations: conversationService,
  messages: messageService,
  notifications: notificationService,
  supportTickets: supportTicketService,
  activities: activityService,
  userSettings: userSettingsService,
  forums: forumService,
  taskSubmissions: taskSubmissionService,
  extensions: extensionService,
  metrics: metricsService,
  utils: dataUtils,
};
