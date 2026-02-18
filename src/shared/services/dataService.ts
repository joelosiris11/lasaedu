/**
 * DataService - Capa de abstracción de datos unificada
 * 
 * Este módulo proporciona acceso a todos los datos del LMS
 * utilizando Firebase Realtime Database como backend.
 */

import { firebaseDB } from './firebaseDataService';
import { enrollmentService } from './enrollmentService';
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
  DBUserPoints,
  DBBadge,
  DBUserBadge,
  DBLearningStreak,
  DBSystemMetric,
  DBProgressActivity,
  DBUserSettings,
  DBForumPost,
  DBForumReply,
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
  DBUserPoints,
  DBBadge,
  DBUserBadge,
  DBLearningStreak,
  DBSystemMetric,
  DBProgressActivity,
  DBUserSettings,
  DBForumPost,
  DBForumReply,
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
};

// ============================================
// USER SERVICE
// ============================================

export const userService = {
  getAll: () => firebaseDB.getUsers(),
  getById: (id: string) => firebaseDB.getUserById(id),
  getByEmail: (email: string) => firebaseDB.getUserByEmail(email),
  create: (data: Omit<DBUser, 'id'>) => firebaseDB.createUser(data),
  update: (id: string, data: Partial<DBUser>) => firebaseDB.updateUser(id, data),
  delete: (id: string) => firebaseDB.delete('users', id),
  
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
  create: (data: Omit<DBCourse, 'id'>) => firebaseDB.createCourse(data),
  update: (id: string, data: Partial<DBCourse>) => firebaseDB.updateCourse(id, data),
  delete: (id: string) => firebaseDB.delete('courses', id),
  
  subscribe: (callback: (courses: DBCourse[]) => void) => 
    firebaseDB.subscribe<DBCourse>('courses', callback),
};

// ============================================
// MODULE SERVICE
// ============================================

export const moduleService = {
  getAll: () => firebaseDB.getAll<DBModule>('modules'),
  getById: (id: string) => firebaseDB.getById<DBModule>('modules', id),
  getByCourse: (courseId: string) => firebaseDB.getModulesByCourse(courseId),
  create: (data: Omit<DBModule, 'id'>) => firebaseDB.createModule(data),
  update: (id: string, data: Partial<DBModule>) => firebaseDB.updateModule(id, data),
  delete: (id: string) => firebaseDB.delete('modules', id),
  
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
  create: (data: Omit<DBLesson, 'id'>) => firebaseDB.createLesson(data),
  update: (id: string, data: Partial<DBLesson>) => firebaseDB.updateLesson(id, data),
  delete: (id: string) => firebaseDB.delete('lessons', id),
  
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
  create: (data: Omit<DBEvaluation, 'id'>) => firebaseDB.createEvaluation(data),
  update: (id: string, data: Partial<DBEvaluation>) => firebaseDB.updateEvaluation(id, data),
  delete: (id: string) => firebaseDB.delete('evaluations', id),
  
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
// GAMIFICATION SERVICE
// ============================================

export const gamificationService = {
  // Puntos
  getUserPoints: (userId: string) => firebaseDB.getUserPoints(userId),
  createUserPoints: (userId: string) => firebaseDB.createUserPoints(userId),
  addPoints: (userId: string, points: number, action: string, description: string) =>
    firebaseDB.addPoints(userId, points, action, description),

  // Insignias
  getAllBadges: () => firebaseDB.getBadges(),
  getUserBadges: (userId: string) => firebaseDB.getUserBadges(userId),
  awardBadge: (userId: string, badgeId: string) => firebaseDB.awardBadge(userId, badgeId),

  // Racha de aprendizaje
  getUserStreak: (userId: string) => firebaseDB.getLearningStreak(userId),
  updateStreak: (userId: string) => firebaseDB.updateStreak(userId),

  // Leaderboard
  getLeaderboard: (limit?: number) => firebaseDB.getLeaderboard(limit),
};

// ============================================
// PROGRESS ACTIVITY SERVICE
// ============================================

export const progressActivityService = {
  getByUser: (userId: string) => firebaseDB.getProgressActivities(userId),
  log: (activity: Omit<DBProgressActivity, 'id'>) => firebaseDB.logProgressActivity(activity),
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
  gamification: gamificationService,
  progressActivities: progressActivityService,
  userSettings: userSettingsService,
  forums: forumService,
  metrics: metricsService,
  utils: dataUtils,
};
