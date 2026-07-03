/**
 * collections.js — Mapa único colección Firestore → tabla Postgres + columnas
 * tipadas consultables. Fuente de verdad compartida por el migrador y la API
 * (no duplicar). El resto del documento vive siempre en `data JSONB` (lossless).
 *
 * `cols`: columna_pg -> campo_del_documento. Son los campos por los que se
 * filtra/ordena/une (índices). Cualquier otro filtro cae a `data->>'campo'`.
 */
export const COLLECTIONS = {
  users: {
    table: 'users',
    cols: { email: 'email', name: 'name', role: 'role', status: 'status', email_verified: 'emailVerified', created_at: 'createdAt', updated_at: 'updatedAt' },
  },
  courses: {
    table: 'courses',
    cols: { instructor_id: 'instructorId', status: 'status', category: 'category', level: 'level', created_at: 'createdAt', updated_at: 'updatedAt' },
  },
  sections: {
    table: 'sections',
    cols: { course_id: 'courseId', instructor_id: 'instructorId', status: 'status', created_at: 'createdAt', updated_at: 'updatedAt' },
  },
  modules: {
    table: 'modules',
    cols: { course_id: 'courseId', status: 'status', order: 'order', created_at: 'createdAt', updated_at: 'updatedAt' },
  },
  lessons: {
    table: 'lessons',
    cols: { course_id: 'courseId', module_id: 'moduleId', type: 'type', status: 'status', order: 'order', created_at: 'createdAt', updated_at: 'updatedAt' },
  },
  enrollments: {
    table: 'enrollments',
    cols: { user_id: 'userId', course_id: 'courseId', section_id: 'sectionId', status: 'status', progress: 'progress', created_at: 'createdAt', updated_at: 'updatedAt' },
  },
  evaluationAttempts: {
    table: 'evaluation_attempts',
    cols: { user_id: 'userId', course_id: 'courseId', evaluation_id: 'evaluationId', passed: 'passed', created_at: 'createdAt', updated_at: 'updatedAt' },
  },
  certificates: {
    table: 'certificates',
    cols: { user_id: 'userId', course_id: 'courseId', credential_id: 'credentialId', status: 'status', created_at: 'createdAt', updated_at: 'updatedAt' },
  },
  departments: {
    table: 'departments',
    cols: { created_at: 'createdAt', updated_at: 'updatedAt' },
  },
  positions: {
    table: 'positions',
    cols: { department_id: 'departmentId', parent_position_id: 'parentPositionId', platform_role: 'platformRole', created_at: 'createdAt', updated_at: 'updatedAt' },
  },
  sectionLessonOverrides: {
    table: 'section_lesson_overrides',
    cols: { section_id: 'sectionId', lesson_id: 'lessonId', course_id: 'courseId', created_at: 'createdAt', updated_at: 'updatedAt' },
  },
  conversations: {
    table: 'conversations',
    cols: { type: 'type', created_at: 'createdAt', updated_at: 'updatedAt' },
  },
  messages: {
    table: 'messages',
    cols: { conversation_id: 'conversationId', sender_id: 'senderId', created_at: 'createdAt', updated_at: 'updatedAt' },
  },
  auditLogs: {
    table: 'audit_logs',
    cols: { actor_id: 'actorId', resource_type: 'resourceType', resource_id: 'resourceId', course_id: 'courseId', created_at: 'createdAt' },
  },
  studentActivityLogs: {
    table: 'student_activity_logs',
    cols: { student_id: 'studentId', course_id: 'courseId', section_id: 'sectionId', activity_type: 'activityType', created_at: 'createdAt' },
  },
  aiAssistantPrompts: {
    table: 'ai_assistant_prompts',
    cols: { is_active: 'isActive', version_number: 'versionNumber', created_at: 'createdAt', updated_at: 'updatedAt' },
  },
  aiAssistantSessions: {
    table: 'ai_assistant_sessions',
    cols: { user_id: 'userId', course_id: 'courseId', created_at: 'createdAt', updated_at: 'updatedAt' },
  },
};

// nombre de colección -> nombre de tabla (rápido)
export const tableFor = (collection) => COLLECTIONS[collection]?.table || null;

// columnas reservadas de SQL que hay que citar
export const quoteCol = (c) => (c === 'order' ? '"order"' : c);
