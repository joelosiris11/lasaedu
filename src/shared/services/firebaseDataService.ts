/**
 * Firebase Data Service - Capa de abstracción para Cloud Firestore
 *
 * Este servicio proporciona métodos CRUD para todas las colecciones del proyecto.
 * 
 * COLECCIONES DEL PROYECTO:
 * - users: Usuarios del sistema
 * - courses: Cursos disponibles
 * - modules: Módulos de cursos
 * - lessons: Lecciones de módulos
 * - enrollments: Inscripciones de estudiantes a cursos
 * - evaluations: Evaluaciones/Exámenes
 * - evaluationAttempts: Intentos de evaluaciones por estudiantes
 * - grades: Calificaciones
 * - certificates: Certificados generados
 * - messages: Mensajes del sistema de comunicación
 * - conversations: Conversaciones entre usuarios
 * - notifications: Notificaciones del sistema
 * - supportTickets: Tickets de soporte
 * - ticketMessages: Mensajes dentro de tickets
 * - activities: Log de actividades
 * - userSettings: Configuraciones de usuario
 * - systemMetrics: Métricas del sistema
 * - forumPosts: Publicaciones del foro
 * - forumReplies: Respuestas del foro
 */

import { db } from '@app/config/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy as firestoreOrderBy,
  limit as firestoreLimit,
  startAfter,
  QueryDocumentSnapshot,
  QueryConstraint,
  type WhereFilterOp,
} from 'firebase/firestore';

// ============================================
// INTERFACES DE DATOS - Todas las colecciones
// ============================================

// Scope that restricts which courses/sections a supervisor can see.
// Undefined = full access (default / backwards compat).
export interface DBSupervisorScope {
  courses: { mode: 'all' } | { mode: 'selected'; ids: string[] };
  sections: { mode: 'all' } | { mode: 'selected'; ids: string[] };
}

// Usuario
export interface DBUser {
  id: string;
  email: string;
  passwordHash?: string;
  firstName?: string;
  lastName?: string;
  name: string;
  role: 'student' | 'teacher' | 'admin' | 'support' | 'supervisor';
  supervisorScope?: DBSupervisorScope;
  emailVerified: boolean;
  emailVerificationToken?: string | null;
  passwordResetToken?: string | null;
  passwordResetExpires?: number | null;
  loginAttempts: number;
  lockUntil?: number | null;
  mustChangePassword?: boolean;
  profile: {
    avatar?: string;
    bio?: string;
    phone?: string;
    location?: string;
    birthDate?: string;
    address?: string;
  };
  preferences: {
    language: string;
    timezone: string;
    notifications: {
      email: boolean;
      push: boolean;
      sms: boolean;
      marketing: boolean;
    };
    privacy: {
      showProfile: boolean;
      showProgress: boolean;
      showBadges: boolean;
    };
  };
  createdAt: number;
  updatedAt: number;
  lastActive: number;
}

// Curso
export interface DBCourse {
  id: string;
  title: string;
  description: string;
  instructor: string;
  instructorId: string;
  category: string;
  level: 'principiante' | 'intermedio' | 'avanzado';
  duration: string;
  status: 'borrador' | 'publicado' | 'archivado';
  image?: string;
  rating?: number;
  studentsCount: number;
  sectionsCount: number;
  price?: number;
  tags?: string[];
  requirements?: string[];
  objectives?: string[];
  createdAt: number;
  updatedAt: number;
}

// Módulo de curso
export interface DBModule {
  id: string;
  courseId: string;
  title: string;
  description: string;
  order: number;
  duration: string;
  image?: string;
  objectives?: string[];
  availableFrom?: number; // timestamp - ocultar hasta esta fecha
  status: 'borrador' | 'publicado';
  createdAt: number;
  updatedAt: number;
}

// Lección
export interface DBLesson {
  id: string;
  moduleId: string;
  courseId: string;
  title: string;
  description: string;
  type: 'video' | 'texto' | 'quiz' | 'tarea' | 'recurso' | 'foro';
  content: string;
  videoUrl?: string;
  duration: string;
  order: number;
  settings?: any; // For lesson settings like isRequired, allowComments, etc.
  resources?: {
    id: string;
    name: string;
    url: string;
    type: string;
  }[];
  status: 'borrador' | 'publicado';
  createdAt: number;
  updatedAt: number;
}

// Inscripción
export interface DBEnrollment {
  id: string;
  courseId: string;
  sectionId?: string;
  userId: string;
  enrolledAt: string;
  progress: number;
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  completedLessons: string[];
  completedModules: string[];
  lastAccessedAt?: string;
  lastLessonId?: string;
  totalTimeSpent: number; // en minutos
  certificateId?: string;
  grade?: number;
  /** ISO timestamp set the first time progress reaches 100%. */
  completedAt?: string;
  createdAt: number;
  updatedAt: number;
}

// Evaluación
export interface DBEvaluation {
  id: string;
  courseId: string;
  moduleId?: string;
  title: string;
  description: string;
  type: 'quiz' | 'examen' | 'tarea' | 'proyecto';
  questions: DBQuestion[];
  settings: {
    timeLimit?: number; // en minutos
    attempts: number;
    passingScore: number;
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
    showResults: boolean;
    showCorrectAnswers: boolean;
  };
  status: 'borrador' | 'publicado' | 'archivado';
  dueDate?: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface DBQuestion {
  id: string;
  type: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay' | 'matching';
  question: string;
  options?: string[];
  correctAnswer: string | string[];
  points: number;
  explanation?: string;
  media?: {
    type: 'image' | 'video' | 'audio';
    url: string;
  };
}

// Intento de evaluación
export interface DBEvaluationAttempt {
  id: string;
  evaluationId: string;
  userId: string;
  courseId: string;
  sectionId?: string;
  answers: {
    questionId: string;
    answer: string | string[];
    isCorrect?: boolean;
    pointsEarned?: number;
  }[];
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  timeSpent: number; // en segundos
  startedAt: string;
  completedAt: string;
  status: 'in_progress' | 'completed' | 'abandoned';
  feedback?: string;
  gradedBy?: string;
  gradedAt?: string;
  createdAt: number;
  updatedAt: number;
}

// Calificación
export interface DBGrade {
  id: string;
  courseId: string;
  sectionId?: string;
  lessonId?: string;
  evaluationId?: string;
  studentId: string;
  teacherId: string;
  type: 'evaluation' | 'assignment' | 'participation' | 'project';
  score: number;
  maxScore: number;
  percentage: number;
  weight: number; // peso en calificación final
  feedback?: string;
  rubric?: {
    criteria: string;
    score: number;
    maxScore: number;
    comment?: string;
  }[];
  submissionUrl?: string;
  status: 'pending' | 'graded' | 'returned';
  createdAt: number;
  updatedAt: number;
}

// Certificado
export interface DBCertificate {
  id: string;
  courseId: string;
  userId: string;
  courseName: string;
  studentName: string;
  instructorName: string;
  completionDate: string;
  grade?: number;
  credentialId: string;
  verificationUrl: string;
  templateId: string;
  pdfUrl?: string;
  status: 'generated' | 'downloaded' | 'shared';
  createdAt: number;
  updatedAt: number;
}

// Mensaje
export interface DBMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  type: 'text' | 'file' | 'image' | 'announcement';
  attachments?: {
    id: string;
    name: string;
    url: string;
    type: string;
    size: number;
  }[];
  readBy: string[];
  replyTo?: string;
  edited: boolean;
  editedAt?: string;
  createdAt: number;
  updatedAt: number;
}

// Conversación
export interface DBConversation {
  id: string;
  type: 'direct' | 'group' | 'course' | 'announcement';
  name?: string;
  participants: string[];
  courseId?: string;
  lastMessage?: {
    content: string;
    senderId: string;
    timestamp: number;
  };
  unreadCount: Record<string, number>;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

// Notificación
export interface DBNotification {
  id: string;
  userId: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'course' | 'grade' | 'message' | 'system';
  title: string;
  message: string;
  link?: string;
  data?: Record<string, unknown>;
  read: boolean;
  readAt?: string;
  createdAt: number;
}

// Ticket de soporte
export interface DBSupportTicket {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  category: 'tecnico' | 'academico' | 'pagos' | 'cuenta' | 'otro';
  priority: 'baja' | 'media' | 'alta' | 'urgente';
  subject: string;
  description: string;
  status: 'new' | 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
  assignedTo?: string;
  assignedName?: string;
  messages: DBTicketMessage[];
  attachments?: {
    id: string;
    name: string;
    url: string;
    type: string;
  }[];
  resolution?: string;
  satisfactionRating?: number;
  responseTime?: number; // en minutos
  resolutionTime?: number; // en minutos
  tags?: string[];
  createdAt: number;
  updatedAt: number;
  resolvedAt?: number;
}

export interface DBTicketMessage {
  id: string;
  ticketId: string;
  senderId: string;
  senderName: string;
  senderRole: 'user' | 'support' | 'system';
  content: string;
  attachments?: {
    id: string;
    name: string;
    url: string;
  }[];
  isInternal: boolean;
  createdAt: number;
}

// Actividad
export interface DBActivity {
  id: string;
  userId: string;
  userName: string;
  type: 'login' | 'logout' | 'course_view' | 'lesson_complete' | 'evaluation_submit' | 
        'message_send' | 'enrollment' | 'certificate' | 'profile_update' | 'system';
  action: string;
  description: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: number;
  createdAt: number;
}

// Configuraciones de usuario
export interface DBUserSettings {
  id: string;
  userId: string;
  theme: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
  notifications: {
    email: {
      courseUpdates: boolean;
      grades: boolean;
      messages: boolean;
      announcements: boolean;
      marketing: boolean;
    };
    push: {
      enabled: boolean;
      courseUpdates: boolean;
      grades: boolean;
      messages: boolean;
    };
    sms: {
      enabled: boolean;
      urgentOnly: boolean;
    };
  };
  privacy: {
    showProfile: boolean;
    showProgress: boolean;
    showBadges: boolean;
    showActivity: boolean;
  };
  accessibility: {
    fontSize: 'small' | 'medium' | 'large';
    highContrast: boolean;
    reduceMotion: boolean;
  };
  createdAt: number;
  updatedAt: number;
}

// Métricas del sistema
export interface DBSystemMetric {
  id: string;
  date: string;
  metrics: {
    activeUsers: number;
    newUsers: number;
    courseEnrollments: number;
    lessonsCompleted: number;
    evaluationsSubmitted: number;
    certificatesIssued: number;
    supportTickets: number;
    avgSessionDuration: number;
    avgCourseProgress: number;
  };
  createdAt: number;
}

// Publicación del foro
export interface DBForumPost {
  id: string;
  courseId: string;
  courseName: string;
  moduleId?: string;
  moduleName?: string;
  lessonId?: string;
  lessonName?: string;
  authorId: string;
  authorName: string;
  authorRole: 'student' | 'teacher' | 'admin';
  authorAvatar?: string;
  title: string;
  content: string;
  isPinned: boolean;
  isResolved: boolean;
  likesCount: number;
  likedBy: string[];
  repliesCount: number;
  views: number;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

// Respuesta del foro
export interface DBForumReply {
  id: string;
  postId: string;
  parentReplyId?: string;
  authorId: string;
  authorName: string;
  authorRole: 'student' | 'teacher' | 'admin';
  authorAvatar?: string;
  content: string;
  isAnswer: boolean;
  likesCount: number;
  likedBy: string[];
  createdAt: number;
  updatedAt: number;
}

// Sección de curso (instancia con fechas y estudiantes)
export interface DBSection {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  instructorId: string;
  instructorName: string;
  startDate: number;
  endDate: number;
  accessType: 'publico' | 'privado' | 'restringido';
  accessCode?: string;
  enrollmentLimit?: number;
  // Denormalizado del curso
  courseTitle: string;
  courseCategory: string;
  courseLevel: string;
  courseImage?: string;
  // Optional per-section banner override. If unset, falls back to courseImage.
  image?: string;
  studentsCount: number;
  status: 'activa' | 'finalizada' | 'archivada' | 'borrador';
  createdAt: number;
  updatedAt: number;
}

// Override de fechas por lección dentro de una sección
export interface DBSectionLessonOverride {
  id: string;
  sectionId: string;
  lessonId: string;
  courseId: string;
  availableFrom?: string;
  dueDate?: string;
  lateSubmissionDeadline?: string;
  availableUntil?: string;
  createdAt: number;
  updatedAt: number;
}

// Envio de tarea (Task Submission)
export interface DBTaskSubmission {
  id: string;
  lessonId: string;
  courseId: string;
  sectionId?: string;
  studentId: string;
  studentName: string;
  files: {
    id: string;
    name: string;
    url: string;
    size: number;
    contentType: string;
  }[];
  comment?: string;
  status: 'submitted' | 'graded' | 'returned';
  submissionType?: 'on_time' | 'late';
  submittedAt: number;
  grade?: {
    score: number;
    maxScore: number;
    feedback?: string;
    gradedBy?: string;
    gradedAt?: number;
  };
  createdAt: number;
  updatedAt: number;
}

// Prórroga de fecha límite (Deadline Extension)
export interface DBDeadlineExtension {
  id: string;
  courseId: string;
  sectionId?: string;
  targetId: string;          // lessonId (tarea) o evaluationId (examen)
  targetType: 'task' | 'exam';
  studentId: string;
  type: 'on_time' | 'late';  // la prórroga cuenta como entrega a tiempo o tardía
  newDeadline: number;        // timestamp
  grantedBy: string;
  grantedAt: number;
  reason?: string;
  createdAt: number;
  updatedAt: number;
}

// ============================================
// PAGINATED RESULT TYPE
// ============================================

export interface PaginatedResult<T> {
  data: T[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

export interface PaginationOptions {
  pageSize: number;
  orderByField: string;
  orderDirection?: 'asc' | 'desc';
  cursor?: QueryDocumentSnapshot | null;
  filters?: { field: string; op: WhereFilterOp; value: unknown }[];
}

// ============================================
// SERVICIO DE DATOS FIREBASE
// ============================================

// Recursively removes `undefined` values from objects and arrays so that the
// payload is acceptable to Firestore, which rejects `undefined` at any depth.
// Non-plain objects (Date, FieldValue sentinels, etc.) are passed through
// unchanged.
function stripUndefinedDeep(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) {
    return value
      .map(stripUndefinedDeep)
      .filter(v => v !== undefined);
  }
  if (typeof value === 'object' && (value as object).constructor === Object) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const cleaned = stripUndefinedDeep(v);
      if (cleaned !== undefined) out[k] = cleaned;
    }
    return out;
  }
  return value;
}

class FirebaseDataService {
  // ============================================
  // MÉTODOS GENÉRICOS CRUD
  // ============================================

  /**
   * Obtener todos los registros de una colección
   */
  async getAll<T>(collectionName: string): Promise<T[]> {
    try {
      const snapshot = await getDocs(collection(db, collectionName));
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as T[];
    } catch (error) {
      console.error(`Error getting ${collectionName}:`, error);
      return [];
    }
  }

  /**
   * Obtener un registro por ID
   */
  async getById<T>(collectionName: string, id: string): Promise<T | null> {
    try {
      const snap = await getDoc(doc(db, collectionName, id));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as T;
    } catch (error) {
      console.error(`Error getting ${collectionName}/${id}:`, error);
      return null;
    }
  }

  /**
   * Crear un nuevo registro
   */
  async create<T extends { id?: string }>(collectionName: string, data: Omit<T, 'id'>): Promise<T> {
    const timestamp = Date.now();
    const raw = {
      ...data,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    // Strip undefined values deeply — Firestore rejects them at any nesting level
    const record = stripUndefinedDeep(raw) as Record<string, unknown>;

    try {
      const docRef = await addDoc(collection(db, collectionName), record);
      return { ...record, id: docRef.id } as unknown as T;
    } catch (error) {
      console.error(`Error creating in ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Actualizar un registro existente
   */
  async update<T>(collectionName: string, id: string, data: Partial<T>): Promise<T | null> {
    const raw = {
      ...data,
      updatedAt: Date.now()
    };
    const updateData = stripUndefinedDeep(raw) as Record<string, unknown>;

    try {
      await updateDoc(doc(db, collectionName, id), updateData as any);
      return this.getById<T>(collectionName, id);
    } catch (error) {
      console.error(`Error updating ${collectionName}/${id}:`, error);
      return null;
    }
  }

  /**
   * Eliminar un registro
   */
  async delete(collectionName: string, id: string): Promise<boolean> {
    try {
      await deleteDoc(doc(db, collectionName, id));
      return true;
    } catch (error) {
      console.error(`Error deleting ${collectionName}/${id}:`, error);
      return false;
    }
  }

  /**
   * Buscar registros con filtro
   */
  async query<T>(
    collectionName: string,
    field: string,
    value: string | number | boolean
  ): Promise<T[]> {
    try {
      const q = query(collection(db, collectionName), where(field, '==', value));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as T[];
    } catch (error) {
      console.error(`Error querying ${collectionName}:`, error);
      return [];
    }
  }

  /**
   * Obtener registros paginados con orderBy, limit, startAfter, y where clauses
   */
  async getPaginated<T>(
    collectionName: string,
    options: PaginationOptions
  ): Promise<PaginatedResult<T>> {
    const {
      pageSize,
      orderByField,
      orderDirection = 'asc',
      cursor,
      filters = [],
    } = options;

    try {
      const constraints: QueryConstraint[] = [];

      for (const f of filters) {
        constraints.push(where(f.field, f.op, f.value));
      }

      constraints.push(firestoreOrderBy(orderByField, orderDirection));

      if (cursor) {
        constraints.push(startAfter(cursor));
      }

      // Fetch one extra to detect if there's a next page
      constraints.push(firestoreLimit(pageSize + 1));

      const q = query(collection(db, collectionName), ...constraints);
      const snapshot = await getDocs(q);

      const hasMore = snapshot.docs.length > pageSize;
      const docs = hasMore ? snapshot.docs.slice(0, pageSize) : snapshot.docs;
      const data = docs.map(d => ({ id: d.id, ...d.data() })) as T[];
      const lastDoc = docs.length > 0 ? docs[docs.length - 1] : null;

      return { data, lastDoc, hasMore };
    } catch (error) {
      console.error(`Error getting paginated ${collectionName}:`, error);
      return { data: [], lastDoc: null, hasMore: false };
    }
  }

  /**
   * Suscribirse a cambios (one-time read, no real-time listener)
   */
  subscribe<T>(
    collectionName: string,
    callback: (data: T[]) => void,
    id?: string
  ): () => void {
    // One-time read, no real-time listener
    if (id) {
      this.getById<T>(collectionName, id).then(item => callback(item ? [item] : []));
    } else {
      this.getAll<T>(collectionName).then(callback);
    }
    return () => {}; // no-op unsubscribe
  }

  // ============================================
  // MÉTODOS ESPECÍFICOS POR COLECCIÓN
  // ============================================

  // --- USUARIOS ---
  async getUsers(): Promise<DBUser[]> {
    return this.getAll<DBUser>('users');
  }

  async getUserById(id: string): Promise<DBUser | null> {
    return this.getById<DBUser>('users', id);
  }

  async getUserByEmail(email: string): Promise<DBUser | null> {
    const users = await this.query<DBUser>('users', 'email', email);
    return users[0] || null;
  }

  async createUser(user: Omit<DBUser, 'id'>): Promise<DBUser> {
    return this.create<DBUser>('users', user);
  }

  /**
   * Create a user document with a specific Firestore id (e.g. the Firebase
   * Auth UID). Needed so that `request.auth.uid == uid` checks in the
   * Firestore security rules line up for admin-created users.
   */
  async createUserWithId(id: string, user: Omit<DBUser, 'id'>): Promise<DBUser> {
    const timestamp = Date.now();
    const raw = {
      ...user,
      createdAt: (user as any).createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    const record = stripUndefinedDeep(raw) as Record<string, unknown>;
    try {
      await setDoc(doc(db, 'users', id), record);
      return { ...record, id } as unknown as DBUser;
    } catch (error) {
      console.error(`Error creating users/${id}:`, error);
      throw error;
    }
  }

  async updateUser(id: string, data: Partial<DBUser>): Promise<DBUser | null> {
    return this.update<DBUser>('users', id, data);
  }

  // --- CURSOS ---
  async getCourses(): Promise<DBCourse[]> {
    return this.getAll<DBCourse>('courses');
  }

  async getCourseById(id: string): Promise<DBCourse | null> {
    return this.getById<DBCourse>('courses', id);
  }

  async getCoursesByInstructor(instructorId: string): Promise<DBCourse[]> {
    return this.query<DBCourse>('courses', 'instructorId', instructorId);
  }

  async getCoursesByStatus(status: string): Promise<DBCourse[]> {
    return this.query<DBCourse>('courses', 'status', status);
  }

  async createCourse(course: Omit<DBCourse, 'id'>): Promise<DBCourse> {
    return this.create<DBCourse>('courses', course);
  }

  async updateCourse(id: string, data: Partial<DBCourse>): Promise<DBCourse | null> {
    return this.update<DBCourse>('courses', id, data);
  }

  // --- MÓDULOS ---
  async getModulesByCourse(courseId: string): Promise<DBModule[]> {
    return this.query<DBModule>('modules', 'courseId', courseId);
  }

  async createModule(module: Omit<DBModule, 'id'>): Promise<DBModule> {
    return this.create<DBModule>('modules', module);
  }

  async updateModule(id: string, data: Partial<DBModule>): Promise<DBModule | null> {
    return this.update<DBModule>('modules', id, data);
  }

  // --- LECCIONES ---
  async getLessonsByModule(moduleId: string): Promise<DBLesson[]> {
    return this.query<DBLesson>('lessons', 'moduleId', moduleId);
  }

  async getLessonsByCourse(courseId: string): Promise<DBLesson[]> {
    return this.query<DBLesson>('lessons', 'courseId', courseId);
  }

  async createLesson(lesson: Omit<DBLesson, 'id'>): Promise<DBLesson> {
    return this.create<DBLesson>('lessons', lesson);
  }

  async updateLesson(id: string, data: Partial<DBLesson>): Promise<DBLesson | null> {
    return this.update<DBLesson>('lessons', id, data);
  }

  // --- INSCRIPCIONES ---
  async getEnrollments(): Promise<DBEnrollment[]> {
    return this.getAll<DBEnrollment>('enrollments');
  }

  async getEnrollmentsByUser(userId: string): Promise<DBEnrollment[]> {
    return this.query<DBEnrollment>('enrollments', 'userId', userId);
  }

  async getEnrollmentsByCourse(courseId: string): Promise<DBEnrollment[]> {
    return this.query<DBEnrollment>('enrollments', 'courseId', courseId);
  }

  async getEnrollment(userId: string, courseId: string): Promise<DBEnrollment | null> {
    const enrollments = await this.getEnrollmentsByUser(userId);
    return enrollments.find(e => e.courseId === courseId) || null;
  }

  async createEnrollment(enrollment: Omit<DBEnrollment, 'id'>): Promise<DBEnrollment> {
    return this.create<DBEnrollment>('enrollments', enrollment);
  }

  async updateEnrollment(id: string, data: Partial<DBEnrollment>): Promise<DBEnrollment | null> {
    return this.update<DBEnrollment>('enrollments', id, data);
  }

  async updateProgress(
    enrollmentId: string, 
    lessonId: string, 
    totalLessons: number
  ): Promise<DBEnrollment | null> {
    const enrollment = await this.getById<DBEnrollment>('enrollments', enrollmentId);
    if (!enrollment) return null;

    const completedLessons = [...new Set([...enrollment.completedLessons, lessonId])];
    const progress = Math.round((completedLessons.length / totalLessons) * 100);
    const status = progress >= 100 ? 'completed' : 'active';
    const justCompleted = status === 'completed' && !enrollment.completedAt;

    return this.update<DBEnrollment>('enrollments', enrollmentId, {
      completedLessons,
      progress,
      status,
      lastLessonId: lessonId,
      lastAccessedAt: new Date().toISOString(),
      ...(justCompleted ? { completedAt: new Date().toISOString() } : {}),
    });
  }

  // --- EVALUACIONES ---
  async getEvaluations(): Promise<DBEvaluation[]> {
    return this.getAll<DBEvaluation>('evaluations');
  }

  async getEvaluationsByCourse(courseId: string): Promise<DBEvaluation[]> {
    return this.query<DBEvaluation>('evaluations', 'courseId', courseId);
  }

  async createEvaluation(evaluation: Omit<DBEvaluation, 'id'>): Promise<DBEvaluation> {
    return this.create<DBEvaluation>('evaluations', evaluation);
  }

  async updateEvaluation(id: string, data: Partial<DBEvaluation>): Promise<DBEvaluation | null> {
    return this.update<DBEvaluation>('evaluations', id, data);
  }

  // --- INTENTOS DE EVALUACIÓN ---
  async getEvaluationAttempts(userId: string): Promise<DBEvaluationAttempt[]> {
    return this.query<DBEvaluationAttempt>('evaluationAttempts', 'userId', userId);
  }

  async getAttemptsByEvaluation(evaluationId: string): Promise<DBEvaluationAttempt[]> {
    return this.query<DBEvaluationAttempt>('evaluationAttempts', 'evaluationId', evaluationId);
  }

  async createAttempt(attempt: Omit<DBEvaluationAttempt, 'id'>): Promise<DBEvaluationAttempt> {
    return this.create<DBEvaluationAttempt>('evaluationAttempts', attempt);
  }

  async updateAttempt(id: string, data: Partial<DBEvaluationAttempt>): Promise<DBEvaluationAttempt | null> {
    return this.update<DBEvaluationAttempt>('evaluationAttempts', id, data);
  }

  // --- CALIFICACIONES ---
  async getGradesByStudent(studentId: string): Promise<DBGrade[]> {
    return this.query<DBGrade>('grades', 'studentId', studentId);
  }

  async getGradesByCourse(courseId: string): Promise<DBGrade[]> {
    return this.query<DBGrade>('grades', 'courseId', courseId);
  }

  async createGrade(grade: Omit<DBGrade, 'id'>): Promise<DBGrade> {
    return this.create<DBGrade>('grades', grade);
  }

  async updateGrade(id: string, data: Partial<DBGrade>): Promise<DBGrade | null> {
    return this.update<DBGrade>('grades', id, data);
  }

  // --- CERTIFICADOS ---
  async getCertificatesByUser(userId: string): Promise<DBCertificate[]> {
    return this.query<DBCertificate>('certificates', 'userId', userId);
  }

  async getCertificateByCredential(credentialId: string): Promise<DBCertificate | null> {
    const certs = await this.query<DBCertificate>('certificates', 'credentialId', credentialId);
    return certs[0] || null;
  }

  async createCertificate(certificate: Omit<DBCertificate, 'id'>): Promise<DBCertificate> {
    return this.create<DBCertificate>('certificates', certificate);
  }

  // --- MENSAJES Y CONVERSACIONES ---
  async getConversationsByUser(userId: string): Promise<DBConversation[]> {
    const all = await this.getAll<DBConversation>('conversations');
    return all.filter(c => c.participants.includes(userId));
  }

  async getMessagesByConversation(conversationId: string): Promise<DBMessage[]> {
    return this.query<DBMessage>('messages', 'conversationId', conversationId);
  }

  async createConversation(conversation: Omit<DBConversation, 'id'>): Promise<DBConversation> {
    return this.create<DBConversation>('conversations', conversation);
  }

  async createMessage(message: Omit<DBMessage, 'id'>): Promise<DBMessage> {
    const newMessage = await this.create<DBMessage>('messages', message);
    
    // Actualizar última mensaje en conversación
    await this.update<DBConversation>('conversations', message.conversationId, {
      lastMessage: {
        content: message.content,
        senderId: message.senderId,
        timestamp: newMessage.createdAt
      }
    });
    
    return newMessage;
  }

  // --- NOTIFICACIONES ---
  async getNotificationsByUser(userId: string): Promise<DBNotification[]> {
    return this.query<DBNotification>('notifications', 'userId', userId);
  }

  async createNotification(notification: Omit<DBNotification, 'id'>): Promise<DBNotification> {
    return this.create<DBNotification>('notifications', notification);
  }

  async markNotificationRead(id: string): Promise<DBNotification | null> {
    return this.update<DBNotification>('notifications', id, {
      read: true,
      readAt: new Date().toISOString()
    });
  }

  // --- TICKETS DE SOPORTE ---
  async getSupportTickets(): Promise<DBSupportTicket[]> {
    return this.getAll<DBSupportTicket>('supportTickets');
  }

  async getTicketsByUser(userId: string): Promise<DBSupportTicket[]> {
    return this.query<DBSupportTicket>('supportTickets', 'userId', userId);
  }

  async getTicketsByAssignee(assigneeId: string): Promise<DBSupportTicket[]> {
    return this.query<DBSupportTicket>('supportTickets', 'assignedTo', assigneeId);
  }

  async createTicket(ticket: Omit<DBSupportTicket, 'id'>): Promise<DBSupportTicket> {
    return this.create<DBSupportTicket>('supportTickets', ticket);
  }

  async updateTicket(id: string, data: Partial<DBSupportTicket>): Promise<DBSupportTicket | null> {
    return this.update<DBSupportTicket>('supportTickets', id, data);
  }

  async addTicketMessage(ticketId: string, message: Omit<DBTicketMessage, 'id'>): Promise<DBSupportTicket | null> {
    const ticket = await this.getById<DBSupportTicket>('supportTickets', ticketId);
    if (!ticket) return null;

    const newMessage: DBTicketMessage = {
      ...message,
      id: `msg_${Date.now()}`,
      ticketId,
      createdAt: Date.now()
    };

    return this.update<DBSupportTicket>('supportTickets', ticketId, {
      messages: [...(ticket.messages || []), newMessage]
    });
  }

  // --- ACTIVIDADES DEL SISTEMA ---
  async logActivity(activity: Omit<DBActivity, 'id'>): Promise<DBActivity> {
    return this.create<DBActivity>('activities', activity);
  }

  async getActivitiesByUser(userId: string, limit = 50): Promise<DBActivity[]> {
    const activities = await this.query<DBActivity>('activities', 'userId', userId);
    return activities.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  }

  async getRecentActivities(limit = 50): Promise<DBActivity[]> {
    const activities = await this.getAll<DBActivity>('activities');
    return activities.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  }

  // --- FORO ---
  async getForumPosts(): Promise<DBForumPost[]> {
    return this.getAll<DBForumPost>('forumPosts');
  }

  async getForumPostsByCourse(courseId: string): Promise<DBForumPost[]> {
    return this.query<DBForumPost>('forumPosts', 'courseId', courseId);
  }

  async getForumPostsByLesson(lessonId: string): Promise<DBForumPost[]> {
    return this.query<DBForumPost>('forumPosts', 'lessonId', lessonId);
  }

  async getForumReplies(postId: string): Promise<DBForumReply[]> {
    return this.query<DBForumReply>('forumReplies', 'postId', postId);
  }

  async getAllForumReplies(): Promise<DBForumReply[]> {
    return this.getAll<DBForumReply>('forumReplies');
  }

  async createForumPost(post: Omit<DBForumPost, 'id'>): Promise<DBForumPost> {
    return this.create<DBForumPost>('forumPosts', post);
  }

  async updateForumPost(id: string, data: Partial<DBForumPost>): Promise<DBForumPost | null> {
    return this.update<DBForumPost>('forumPosts', id, data);
  }

  async deleteForumPost(id: string): Promise<boolean> {
    // Delete all replies for this post first
    const replies = await this.getForumReplies(id);
    await Promise.all(replies.map(r => this.delete('forumReplies', r.id)));
    return this.delete('forumPosts', id);
  }

  async createForumReply(reply: Omit<DBForumReply, 'id'>): Promise<DBForumReply> {
    return this.create<DBForumReply>('forumReplies', reply);
  }

  async updateForumReply(id: string, data: Partial<DBForumReply>): Promise<DBForumReply | null> {
    return this.update<DBForumReply>('forumReplies', id, data);
  }

  async deleteForumReply(id: string): Promise<boolean> {
    return this.delete('forumReplies', id);
  }

  // --- SECCIONES ---
  async getSections(): Promise<DBSection[]> {
    return this.getAll<DBSection>('sections');
  }

  async getSectionById(id: string): Promise<DBSection | null> {
    return this.getById<DBSection>('sections', id);
  }

  async getSectionsByCourse(courseId: string): Promise<DBSection[]> {
    return this.query<DBSection>('sections', 'courseId', courseId);
  }

  async getSectionsByInstructor(instructorId: string): Promise<DBSection[]> {
    return this.query<DBSection>('sections', 'instructorId', instructorId);
  }

  async createSection(section: Omit<DBSection, 'id'>): Promise<DBSection> {
    return this.create<DBSection>('sections', section);
  }

  async updateSection(id: string, data: Partial<DBSection>): Promise<DBSection | null> {
    return this.update<DBSection>('sections', id, data);
  }

  async deleteSection(id: string): Promise<boolean> {
    return this.delete('sections', id);
  }

  // --- SECTION LESSON OVERRIDES ---
  async getSectionLessonOverrides(sectionId: string): Promise<DBSectionLessonOverride[]> {
    return this.query<DBSectionLessonOverride>('sectionLessonOverrides', 'sectionId', sectionId);
  }

  async upsertSectionLessonOverride(data: Omit<DBSectionLessonOverride, 'id'> & { id?: string }): Promise<DBSectionLessonOverride> {
    if (data.id) {
      const updated = await this.update<DBSectionLessonOverride>('sectionLessonOverrides', data.id, data);
      return updated!;
    }
    return this.create<DBSectionLessonOverride>('sectionLessonOverrides', data as Omit<DBSectionLessonOverride, 'id'>);
  }

  async bulkUpsertSectionLessonOverrides(sectionId: string, overrides: (Omit<DBSectionLessonOverride, 'id'> & { id?: string })[]): Promise<DBSectionLessonOverride[]> {
    const results: DBSectionLessonOverride[] = [];
    for (const override of overrides) {
      const result = await this.upsertSectionLessonOverride({ ...override, sectionId });
      results.push(result);
    }
    return results;
  }

  async getEnrollmentsBySection(sectionId: string): Promise<DBEnrollment[]> {
    return this.query<DBEnrollment>('enrollments', 'sectionId', sectionId);
  }

  // --- DEADLINE EXTENSIONS ---
  async getDeadlineExtensions(): Promise<DBDeadlineExtension[]> {
    return this.getAll<DBDeadlineExtension>('deadlineExtensions');
  }

  async getExtensionsByTarget(targetId: string): Promise<DBDeadlineExtension[]> {
    return this.query<DBDeadlineExtension>('deadlineExtensions', 'targetId', targetId);
  }

  async getExtensionsByStudent(studentId: string): Promise<DBDeadlineExtension[]> {
    return this.query<DBDeadlineExtension>('deadlineExtensions', 'studentId', studentId);
  }

  async createExtension(extension: Omit<DBDeadlineExtension, 'id'>): Promise<DBDeadlineExtension> {
    return this.create<DBDeadlineExtension>('deadlineExtensions', extension);
  }

  async deleteExtension(id: string): Promise<boolean> {
    return this.delete('deadlineExtensions', id);
  }

  // --- TASK SUBMISSIONS ---
  async getTaskSubmissions(): Promise<DBTaskSubmission[]> {
    return this.getAll<DBTaskSubmission>('taskSubmissions');
  }

  async getTaskSubmissionsByLesson(lessonId: string): Promise<DBTaskSubmission[]> {
    return this.query<DBTaskSubmission>('taskSubmissions', 'lessonId', lessonId);
  }

  async getTaskSubmissionsByStudent(studentId: string): Promise<DBTaskSubmission[]> {
    return this.query<DBTaskSubmission>('taskSubmissions', 'studentId', studentId);
  }

  async createTaskSubmission(submission: Omit<DBTaskSubmission, 'id'>): Promise<DBTaskSubmission> {
    return this.create<DBTaskSubmission>('taskSubmissions', submission);
  }

  async updateTaskSubmission(id: string, data: Partial<DBTaskSubmission>): Promise<DBTaskSubmission | null> {
    return this.update<DBTaskSubmission>('taskSubmissions', id, data);
  }

  // --- MÉTRICAS DEL SISTEMA ---
  async getSystemMetrics(date?: string): Promise<DBSystemMetric | null> {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const metrics = await this.query<DBSystemMetric>('systemMetrics', 'date', targetDate);
    return metrics[0] || null;
  }

  async updateSystemMetrics(metrics: Partial<DBSystemMetric['metrics']>): Promise<DBSystemMetric | null> {
    const today = new Date().toISOString().split('T')[0];
    let existing = await this.getSystemMetrics(today);

    if (!existing) {
      return this.create<DBSystemMetric>('systemMetrics', {
        date: today,
        metrics: {
          activeUsers: 0,
          newUsers: 0,
          courseEnrollments: 0,
          lessonsCompleted: 0,
          evaluationsSubmitted: 0,
          certificatesIssued: 0,
          supportTickets: 0,
          avgSessionDuration: 0,
          avgCourseProgress: 0,
          ...metrics
        }
      } as any);
    }

    return this.update<DBSystemMetric>('systemMetrics', existing.id, {
      metrics: { ...existing.metrics, ...metrics }
    });
  }

  // ============================================
  // UTILIDADES
  // ============================================

  /**
   * Inicializar datos de ejemplo
   */
  async seedDatabase(): Promise<void> {
    console.log('Seeding database...');
    // Aquí se pueden agregar datos iniciales
  }

  /**
   * Limpiar base de datos (solo para desarrollo)
   */
  async clearDatabase(): Promise<void> {
    console.warn('clearDatabase no disponible para Firebase');
  }

  /**
   * Exportar todos los datos
   */
  async exportData(): Promise<Record<string, unknown[]>> {
    const collections = [
      'users', 'courses', 'modules', 'lessons', 'enrollments',
      'evaluations', 'evaluationAttempts', 'grades', 'certificates',
      'messages', 'conversations', 'notifications', 'supportTickets',
      'activities', 'userSettings', 'systemMetrics',
      'taskSubmissions', 'deadlineExtensions',
      'sections', 'sectionLessonOverrides'
    ];

    const data: Record<string, unknown[]> = {};
    
    for (const col of collections) {
      data[col] = await this.getAll(col);
    }

    return data;
  }

  /**
   * Importar datos
   */
  async importData(data: Record<string, unknown[]>): Promise<void> {
    for (const [col, records] of Object.entries(data)) {
      for (const record of records) {
        await this.create(col, record as any);
      }
    }
  }
}

// Exportar instancia única
export const firebaseDB = new FirebaseDataService();

// Exportar tipos para uso en componentes
export type {
  DBUser as User,
  DBCourse as Course,
  DBModule as Module,
  DBLesson as Lesson,
  DBEnrollment as Enrollment,
  DBEvaluation as Evaluation,
  DBQuestion as Question,
  DBEvaluationAttempt as EvaluationAttempt,
  DBGrade as Grade,
  DBCertificate as Certificate,
  DBMessage as Message,
  DBConversation as Conversation,
  DBNotification as Notification,
  DBSupportTicket as SupportTicket,
  DBTicketMessage as TicketMessage,
  DBActivity as Activity,
  DBUserSettings as UserSettings,
  DBSystemMetric as SystemMetric,
  DBForumPost as ForumPost,
  DBForumReply as ForumReply,
  DBTaskSubmission as TaskSubmission,
  DBDeadlineExtension as DeadlineExtension,
  DBSection as Section,
  DBSectionLessonOverride as SectionLessonOverride
};

export type { WhereFilterOp, QueryDocumentSnapshot };
export default firebaseDB;
