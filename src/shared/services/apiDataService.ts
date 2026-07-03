// Implementación del seam `firebaseDB` contra el backend self-host (/api).
// Mismas firmas que la versión Firestore → los consumidores no cambian.
// Colecciones sin tabla (features sin datos) devuelven vacío en vez de romper.
import { apiFetch } from './apiClient';

type Where = { field: string; value: unknown };

async function listSafe<T>(collection: string, qs = ''): Promise<T[]> {
  try {
    return await apiFetch<T[]>(`/api/${collection}${qs}`);
  } catch (e) {
    if (String((e as Error).message).includes('desconocida')) return [];
    throw e;
  }
}
async function getOneSafe<T>(collection: string, id: string): Promise<T | null> {
  try {
    return await apiFetch<T>(`/api/${collection}/${id}`);
  } catch (e) {
    const m = String((e as Error).message);
    if (m.includes('404') || m.includes('desconocida') || m.includes('No encontrado')) return null;
    throw e;
  }
}
async function querySafe<T>(collection: string, where: Where[]): Promise<T[]> {
  try {
    return await apiFetch<T[]>(`/api/${collection}/query`, { method: 'POST', body: { where } });
  } catch (e) {
    if (String((e as Error).message).includes('desconocida')) return [];
    throw e;
  }
}
const create = <T>(collection: string, data: unknown) =>
  apiFetch<T>(`/api/${collection}`, { method: 'POST', body: data });
const update = <T>(collection: string, id: string, data: unknown) =>
  apiFetch<T>(`/api/${collection}/${id}`, { method: 'PATCH', body: data });
const remove = (collection: string, id: string) =>
  apiFetch(`/api/${collection}/${id}`, { method: 'DELETE' }).then(() => true).catch(() => false);

export const apiFirebaseDB = {
  // ── genéricos ──────────────────────────────────────────────────────────
  getAll: <T>(collection: string) => listSafe<T>(collection),
  getById: <T>(collection: string, id: string) => getOneSafe<T>(collection, id),
  create: <T>(collection: string, data: Omit<T, 'id'>) => create<T>(collection, data),
  update: <T>(collection: string, id: string, data: Partial<T>) => update<T>(collection, id, data),
  delete: (collection: string, id: string) => remove(collection, id),
  query: <T>(collection: string, field: string, value: unknown) =>
    querySafe<T>(collection, [{ field, value }]),
  // Mismo contrato que la versión Firestore: recibe {pageSize, orderByField,
  // orderDirection, cursor, filters} y devuelve {data, lastDoc, hasMore}.
  // cursor/lastDoc son un OFFSET numérico (paginación por offset).
  async getPaginated<T>(
    collection: string,
    opts: {
      pageSize?: number;
      orderByField?: string;
      orderDirection?: 'asc' | 'desc';
      cursor?: unknown;
      filters?: { field: string; op?: string; value: unknown }[];
    } = {},
  ) {
    const pageSize = opts.pageSize ?? 50;
    const offset = typeof opts.cursor === 'number' ? opts.cursor : 0;
    const body = {
      where: (opts.filters ?? []).map((f) => ({ field: f.field, op: f.op, value: f.value })),
      orderBy: opts.orderByField,
      orderDir: opts.orderDirection,
      limit: pageSize + 1,
      offset,
    };
    let rows: T[] = [];
    try {
      rows = await apiFetch<T[]>(`/api/${collection}/query`, { method: 'POST', body });
    } catch (e) {
      if (String((e as Error).message).includes('desconocida')) rows = [];
      else throw e;
    }
    const hasMore = rows.length > pageSize;
    const data = hasMore ? rows.slice(0, pageSize) : rows;
    const lastDoc = hasMore ? offset + pageSize : null;
    return { data, lastDoc, hasMore };
  },
  // sin realtime (la base original no tenía listeners). Un fetch inicial y unsub no-op.
  subscribe<T>(collection: string, cb: (items: T[]) => void) {
    listSafe<T>(collection).then(cb).catch(() => cb([]));
    return () => {};
  },

  // ── usuarios ────────────────────────────────────────────────────────────
  getUsers: () => listSafe('users'),
  getUserById: (id: string) => getOneSafe('users', id),
  async getUserByEmail(email: string) {
    const r = await querySafe('users', [{ field: 'email', value: email }]);
    return (r[0] as any) || null;
  },
  createUser: (u: any) => create('users', u),
  createUserWithId: (id: string, u: any) => create('users', { ...u, id }),
  updateUser: (id: string, d: any) => update('users', id, d),

  // ── cursos / módulos / lecciones ─────────────────────────────────────────
  getCourses: () => listSafe('courses'),
  getCourseById: (id: string) => getOneSafe('courses', id),
  getCoursesByInstructor: (id: string) => querySafe('courses', [{ field: 'instructorId', value: id }]),
  getCoursesByStatus: (s: string) => querySafe('courses', [{ field: 'status', value: s }]),
  createCourse: (c: any) => create('courses', c),
  updateCourse: (id: string, d: any) => update('courses', id, d),
  getModulesByCourse: (cid: string) => querySafe('modules', [{ field: 'courseId', value: cid }]),
  createModule: (m: any) => create('modules', m),
  updateModule: (id: string, d: any) => update('modules', id, d),
  getLessonsByModule: (mid: string) => querySafe('lessons', [{ field: 'moduleId', value: mid }]),
  getLessonsByCourse: (cid: string) => querySafe('lessons', [{ field: 'courseId', value: cid }]),
  createLesson: (l: any) => create('lessons', l),
  updateLesson: (id: string, d: any) => update('lessons', id, d),

  // ── secciones / organigrama ──────────────────────────────────────────────
  getSections: () => listSafe('sections'),
  getSectionById: (id: string) => getOneSafe('sections', id),
  getSectionsByCourse: (cid: string) => querySafe('sections', [{ field: 'courseId', value: cid }]),
  createSection: (s: any) => create('sections', s),
  updateSection: (id: string, d: any) => update('sections', id, d),
  getDepartments: () => listSafe('departments'),
  getPositions: () => listSafe('positions'),

  // ── matrículas / progreso ─────────────────────────────────────────────────
  getEnrollments: () => listSafe('enrollments'),
  getEnrollmentsByUser: (uid: string) => querySafe('enrollments', [{ field: 'userId', value: uid }]),
  getEnrollmentsByCourse: (cid: string) => querySafe('enrollments', [{ field: 'courseId', value: cid }]),
  async getEnrollment(uid: string, cid: string) {
    const r = await querySafe('enrollments', [{ field: 'userId', value: uid }, { field: 'courseId', value: cid }]);
    return (r[0] as any) || null;
  },
  createEnrollment: (e: any) => create('enrollments', e),
  updateEnrollment: (id: string, d: any) => update('enrollments', id, d),
  async updateProgress(enrollmentId: string, data: any) {
    return update('enrollments', enrollmentId, data);
  },

  // ── evaluaciones ──────────────────────────────────────────────────────────
  getEvaluations: () => listSafe('evaluations'),
  getEvaluationsByCourse: (cid: string) => querySafe('evaluations', [{ field: 'courseId', value: cid }]),
  createEvaluation: (e: any) => create('evaluations', e),
  updateEvaluation: (id: string, d: any) => update('evaluations', id, d),
  getEvaluationAttempts: (uid: string) => querySafe('evaluationAttempts', [{ field: 'userId', value: uid }]),
  getAttemptsByEvaluation: (eid: string) => querySafe('evaluationAttempts', [{ field: 'evaluationId', value: eid }]),
  createAttempt: (a: any) => create('evaluationAttempts', a),
  updateAttempt: (id: string, d: any) => update('evaluationAttempts', id, d),

  // ── calificaciones / certificados (sin datos hoy → vacío) ─────────────────
  getGradesByStudent: (sid: string) => querySafe('grades', [{ field: 'studentId', value: sid }]),
  getGradesByCourse: (cid: string) => querySafe('grades', [{ field: 'courseId', value: cid }]),
  createGrade: (g: any) => create('grades', g),
  updateGrade: (id: string, d: any) => update('grades', id, d),
  getCertificatesByUser: (uid: string) => querySafe('certificates', [{ field: 'userId', value: uid }]),
  async getCertificateByCredential(cid: string) {
    const r = await querySafe('certificates', [{ field: 'credentialId', value: cid }]);
    return (r[0] as any) || null;
  },
  createCertificate: (c: any) => create('certificates', c),

  // ── mensajería / notificaciones / soporte ─────────────────────────────────
  getConversationsByUser: (uid: string) => querySafe('conversations', [{ field: 'participants', value: uid }]),
  getMessagesByConversation: (cid: string) => querySafe('messages', [{ field: 'conversationId', value: cid }]),
  createConversation: (c: any) => create('conversations', c),
  createMessage: (m: any) => create('messages', m),
  getNotificationsByUser: (uid: string) => querySafe('notifications', [{ field: 'userId', value: uid }]),
  createNotification: (n: any) => create('notifications', n),
  markNotificationRead: (id: string) => update('notifications', id, { read: true }),
  getSupportTickets: () => listSafe('supportTickets'),
  getTicketsByUser: (uid: string) => querySafe('supportTickets', [{ field: 'userId', value: uid }]),
  getTicketsByAssignee: (aid: string) => querySafe('supportTickets', [{ field: 'assigneeId', value: aid }]),
  createTicket: (t: any) => create('supportTickets', t),
  updateTicket: (id: string, d: any) => update('supportTickets', id, d),
  addTicketMessage: (id: string, msg: any) => update('supportTickets', id, { _appendMessage: msg }),

  // ── secciones / overrides ──────────────────────────────────────────────
  getSectionsByInstructor: (id: string) => querySafe('sections', [{ field: 'instructorId', value: id }]),
  deleteSection: (id: string) => remove('sections', id),
  getSectionLessonOverrides: (sid: string) => querySafe('sectionLessonOverrides', [{ field: 'sectionId', value: sid }]),
  upsertSectionLessonOverride: (d: any) => create('sectionLessonOverrides', d),
  bulkUpsertSectionLessonOverrides: (_sid: string, overrides: any[]) =>
    Promise.all((overrides || []).map((o) => create('sectionLessonOverrides', o))),
  getEnrollmentsBySection: (sid: string) => querySafe('enrollments', [{ field: 'sectionId', value: sid }]),

  // ── departamentos / posiciones ─────────────────────────────────────────
  getDepartmentById: (id: string) => getOneSafe('departments', id),
  createDepartment: (d: any) => create('departments', d),
  updateDepartment: (id: string, d: any) => update('departments', id, d),
  deleteDepartment: (id: string) => remove('departments', id),
  getPositionById: (id: string) => getOneSafe('positions', id),
  getPositionsByDepartment: (did: string) => querySafe('positions', [{ field: 'departmentId', value: did }]),
  getPositionsByParent: (pid: string) => querySafe('positions', [{ field: 'parentPositionId', value: pid }]),
  getUsersByPosition: (pid: string) => querySafe('users', [{ field: 'positionId', value: pid }]),
  createPosition: (d: any) => create('positions', d),
  updatePosition: (id: string, d: any) => update('positions', id, d),
  deletePosition: (id: string) => remove('positions', id),

  // ── foro (colección sin datos → vacío) ─────────────────────────────────
  getForumPosts: () => listSafe('forumPosts'),
  getForumPostsByCourse: (cid: string) => querySafe('forumPosts', [{ field: 'courseId', value: cid }]),
  getForumPostsByLesson: (lid: string) => querySafe('forumPosts', [{ field: 'lessonId', value: lid }]),
  createForumPost: (d: any) => create('forumPosts', d),
  updateForumPost: (id: string, d: any) => update('forumPosts', id, d),
  deleteForumPost: (id: string) => remove('forumPosts', id),
  getForumReplies: (pid: string) => querySafe('forumReplies', [{ field: 'postId', value: pid }]),
  getAllForumReplies: () => listSafe('forumReplies'),
  createForumReply: (d: any) => create('forumReplies', d),
  updateForumReply: (id: string, d: any) => update('forumReplies', id, d),
  deleteForumReply: (id: string) => remove('forumReplies', id),

  // ── entregas de tareas / extensiones (sin datos → vacío) ───────────────
  getTaskSubmissions: () => listSafe('taskSubmissions'),
  getTaskSubmissionsByLesson: (lid: string) => querySafe('taskSubmissions', [{ field: 'lessonId', value: lid }]),
  getTaskSubmissionsByStudent: (sid: string) => querySafe('taskSubmissions', [{ field: 'studentId', value: sid }]),
  createTaskSubmission: (d: any) => create('taskSubmissions', d),
  updateTaskSubmission: (id: string, d: any) => update('taskSubmissions', id, d),
  getDeadlineExtensions: () => listSafe('deadlineExtensions'),
  getExtensionsByStudent: (sid: string) => querySafe('deadlineExtensions', [{ field: 'studentId', value: sid }]),
  getExtensionsByTarget: (tid: string) => querySafe('deadlineExtensions', [{ field: 'targetId', value: tid }]),
  createExtension: (d: any) => create('deadlineExtensions', d),
  deleteExtension: (id: string) => remove('deadlineExtensions', id),

  // ── actividades / métricas (colecciones sin datos → vacío/no-op) ───────
  getActivitiesByUser: (uid: string) => querySafe('activities', [{ field: 'userId', value: uid }]),
  getRecentActivities: () => listSafe('activities'),
  logActivity: async (d: any) => { try { return await create('activities', d); } catch { return null; } },
  getSystemMetrics: () => listSafe('systemMetrics'),
  updateSystemMetrics: async (id: string, d: any) => { try { return await update('systemMetrics', id, d); } catch { return null; } },

  // ── utilidades admin (no soportadas en self-host) ──────────────────────
  clearDatabase: async () => { throw new Error('No disponible en modo self-host'); },
  seedDatabase: async () => { throw new Error('No disponible en modo self-host'); },
  exportData: async () => { throw new Error('Usa un backup de Postgres (pg_dump)'); },
  importData: async () => { throw new Error('No disponible en modo self-host'); },
};

export type ApiFirebaseDB = typeof apiFirebaseDB;
