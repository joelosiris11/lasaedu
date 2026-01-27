/**
 * Firebase Data Service - Capa de abstracción para Firebase Realtime Database
 * 
 * Este servicio proporciona métodos CRUD para todas las colecciones del proyecto.
 * Puede alternar entre Firebase y LocalDB mediante la variable USE_FIREBASE.
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
 * - userPoints: Puntos de gamificación
 * - badges: Insignias disponibles
 * - userBadges: Insignias obtenidas por usuarios
 * - learningStreaks: Rachas de aprendizaje
 * - progressActivities: Actividades de progreso
 * - userSettings: Configuraciones de usuario
 * - systemMetrics: Métricas del sistema
 */

import { database } from '@app/config/firebase';
import { 
  ref, 
  get, 
  set, 
  push, 
  update, 
  remove, 
  query, 
  orderByChild, 
  equalTo,
  onValue,
  off,
  DataSnapshot
} from 'firebase/database';
import { localDB } from '@shared/utils/localDB';
import { isUsingEmulator } from '@app/config/firebase';

// Usar Firebase siempre (base de datos real)
const USE_FIREBASE = true;

// ============================================
// INTERFACES DE DATOS - Todas las colecciones
// ============================================

// Usuario
export interface DBUser {
  id: string;
  email: string;
  passwordHash?: string;
  name: string;
  role: 'student' | 'teacher' | 'admin' | 'support';
  emailVerified: boolean;
  emailVerificationToken?: string | null;
  passwordResetToken?: string | null;
  passwordResetExpires?: number | null;
  loginAttempts: number;
  lockUntil?: number | null;
  profile: {
    avatar?: string;
    bio?: string;
    phone?: string;
    location?: string;
    birthDate?: string;
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
  type: 'video' | 'texto' | 'quiz' | 'tarea' | 'recurso';
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

// Puntos de gamificación
export interface DBUserPoints {
  id: string;
  userId: string;
  totalPoints: number;
  level: number;
  levelName: string;
  nextLevelPoints: number;
  rank?: number;
  history: {
    id: string;
    action: string;
    points: number;
    description: string;
    timestamp: string;
  }[];
  createdAt: number;
  updatedAt: number;
}

// Insignia
export interface DBBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'achievement' | 'course' | 'social' | 'streak' | 'special';
  criteria: {
    type: string;
    value: number;
    description: string;
  };
  points: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  isActive: boolean;
  createdAt: number;
}

// Insignia de usuario
export interface DBUserBadge {
  id: string;
  userId: string;
  badgeId: string;
  earnedAt: string;
  progress?: number;
  notified: boolean;
  createdAt: number;
}

// Racha de aprendizaje
export interface DBLearningStreak {
  id: string;
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string;
  weeklyActivity: number[];
  monthlyActivity: Record<string, number>;
  createdAt: number;
  updatedAt: number;
}

// Actividad de progreso
export interface DBProgressActivity {
  id: string;
  userId: string;
  type: 'lesson_completed' | 'course_started' | 'course_completed' | 
        'quiz_passed' | 'badge_earned' | 'level_up';
  courseId?: string;
  lessonId?: string;
  badgeId?: string;
  details?: string;
  points?: number;
  timestamp: string;
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

// ============================================
// SERVICIO DE DATOS FIREBASE
// ============================================

class FirebaseDataService {
  private useFirebase = USE_FIREBASE;

  // ============================================
  // MÉTODOS GENÉRICOS CRUD
  // ============================================

  /**
   * Obtener todos los registros de una colección
   */
  async getAll<T>(collection: string): Promise<T[]> {
    if (!this.useFirebase) {
      return localDB.getCollection<T>(collection);
    }

    try {
      const snapshot = await get(ref(database, collection));
      if (!snapshot.exists()) return [];
      
      const data = snapshot.val();
      return Object.keys(data).map(key => ({
        id: key,
        ...data[key]
      })) as T[];
    } catch (error) {
      console.error(`Error getting ${collection}:`, error);
      return [];
    }
  }

  /**
   * Obtener un registro por ID
   */
  async getById<T>(collection: string, id: string): Promise<T | null> {
    if (!this.useFirebase) {
      return localDB.getById<T & { id: string }>(collection, id) as T | null;
    }

    try {
      const snapshot = await get(ref(database, `${collection}/${id}`));
      if (!snapshot.exists()) return null;
      
      return { id, ...snapshot.val() } as T;
    } catch (error) {
      console.error(`Error getting ${collection}/${id}:`, error);
      return null;
    }
  }

  /**
   * Crear un nuevo registro
   */
  async create<T extends { id?: string }>(collection: string, data: Omit<T, 'id'>): Promise<T> {
    const timestamp = Date.now();
    const record = {
      ...data,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    if (!this.useFirebase) {
      return localDB.add(collection, record as any) as unknown as T;
    }

    try {
      const newRef = push(ref(database, collection));
      const newRecord = { ...record, id: newRef.key! };
      await set(newRef, newRecord);
      return newRecord as unknown as T;
    } catch (error) {
      console.error(`Error creating in ${collection}:`, error);
      throw error;
    }
  }

  /**
   * Actualizar un registro existente
   */
  async update<T>(collection: string, id: string, data: Partial<T>): Promise<T | null> {
    const updateData = {
      ...data,
      updatedAt: Date.now()
    };

    if (!this.useFirebase) {
      return localDB.update(collection, id, updateData as any) as unknown as T | null;
    }

    try {
      await update(ref(database, `${collection}/${id}`), updateData);
      return this.getById<T>(collection, id);
    } catch (error) {
      console.error(`Error updating ${collection}/${id}:`, error);
      return null;
    }
  }

  /**
   * Eliminar un registro
   */
  async delete(collection: string, id: string): Promise<boolean> {
    if (!this.useFirebase) {
      return localDB.delete(collection, id);
    }

    try {
      await remove(ref(database, `${collection}/${id}`));
      return true;
    } catch (error) {
      console.error(`Error deleting ${collection}/${id}:`, error);
      return false;
    }
  }

  /**
   * Buscar registros con filtro
   */
  async query<T>(
    collection: string, 
    field: string, 
    value: string | number | boolean
  ): Promise<T[]> {
    if (!this.useFirebase) {
      return localDB.where<T>(collection, (item: any) => item[field] === value);
    }

    try {
      const q = query(ref(database, collection), orderByChild(field), equalTo(value as any));
      const snapshot = await get(q);
      if (!snapshot.exists()) return [];
      
      const data = snapshot.val();
      return Object.keys(data).map(key => ({
        id: key,
        ...data[key]
      })) as T[];
    } catch (error) {
      console.error(`Error querying ${collection}:`, error);
      return [];
    }
  }

  /**
   * Suscribirse a cambios en tiempo real
   */
  subscribe<T>(
    collection: string, 
    callback: (data: T[]) => void,
    id?: string
  ): () => void {
    const path = id ? `${collection}/${id}` : collection;
    
    if (!this.useFirebase) {
      // Para localDB, devolvemos los datos una vez
      const data = id 
        ? [localDB.getById<T & { id: string }>(collection, id)].filter(Boolean)
        : localDB.getCollection<T>(collection);
      callback(data as T[]);
      return () => {};
    }

    const dbRef = ref(database, path);
    
    const handleSnapshot = (snapshot: DataSnapshot) => {
      if (!snapshot.exists()) {
        callback([]);
        return;
      }
      
      const data = snapshot.val();
      if (id) {
        callback([{ id, ...data }] as T[]);
      } else {
        const items = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        })) as T[];
        callback(items);
      }
    };

    onValue(dbRef, handleSnapshot);
    
    // Retornar función para cancelar suscripción
    return () => off(dbRef);
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

    return this.update<DBEnrollment>('enrollments', enrollmentId, {
      completedLessons,
      progress,
      status,
      lastLessonId: lessonId,
      lastAccessedAt: new Date().toISOString()
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

  // --- GAMIFICACIÓN ---
  async getUserPoints(userId: string): Promise<DBUserPoints | null> {
    return this.getById<DBUserPoints>('userPoints', userId);
  }

  async addPoints(userId: string, points: number, action: string, description: string): Promise<DBUserPoints | null> {
    let userPoints = await this.getUserPoints(userId);
    
    if (!userPoints) {
      userPoints = await this.create<DBUserPoints>('userPoints', {
        userId,
        totalPoints: 0,
        level: 1,
        levelName: 'Principiante',
        nextLevelPoints: 100,
        history: []
      } as any);
    }

    const newTotal = userPoints.totalPoints + points;
    const { level, levelName, nextLevelPoints } = this.calculateLevel(newTotal);

    return this.update<DBUserPoints>('userPoints', userPoints.id, {
      totalPoints: newTotal,
      level,
      levelName,
      nextLevelPoints,
      history: [...userPoints.history, {
        id: `hist_${Date.now()}`,
        action,
        points,
        description,
        timestamp: new Date().toISOString()
      }]
    });
  }

  private calculateLevel(points: number): { level: number; levelName: string; nextLevelPoints: number } {
    const levels = [
      { min: 0, level: 1, name: 'Principiante', next: 100 },
      { min: 100, level: 2, name: 'Aprendiz', next: 300 },
      { min: 300, level: 3, name: 'Estudiante', next: 600 },
      { min: 600, level: 4, name: 'Aplicado', next: 1000 },
      { min: 1000, level: 5, name: 'Avanzado', next: 1500 },
      { min: 1500, level: 6, name: 'Experto', next: 2500 },
      { min: 2500, level: 7, name: 'Maestro', next: 4000 },
      { min: 4000, level: 8, name: 'Sabio', next: 6000 },
      { min: 6000, level: 9, name: 'Gurú', next: 10000 },
      { min: 10000, level: 10, name: 'Leyenda', next: 999999 }
    ];

    const currentLevel = levels.reverse().find(l => points >= l.min) || levels[0];
    return {
      level: currentLevel.level,
      levelName: currentLevel.name,
      nextLevelPoints: currentLevel.next
    };
  }

  async getBadges(): Promise<DBBadge[]> {
    return this.getAll<DBBadge>('badges');
  }

  async getUserBadges(userId: string): Promise<DBUserBadge[]> {
    return this.query<DBUserBadge>('userBadges', 'userId', userId);
  }

  async awardBadge(userId: string, badgeId: string): Promise<DBUserBadge> {
    return this.create<DBUserBadge>('userBadges', {
      userId,
      badgeId,
      earnedAt: new Date().toISOString(),
      notified: false
    } as any);
  }

  // --- RACHA DE APRENDIZAJE ---
  async getLearningStreak(userId: string): Promise<DBLearningStreak | null> {
    return this.getById<DBLearningStreak>('learningStreaks', userId);
  }

  async updateStreak(userId: string): Promise<DBLearningStreak | null> {
    let streak = await this.getLearningStreak(userId);
    const today = new Date().toISOString().split('T')[0];

    if (!streak) {
      return this.create<DBLearningStreak>('learningStreaks', {
        id: userId,
        userId,
        currentStreak: 1,
        longestStreak: 1,
        lastActiveDate: today,
        weeklyActivity: [1, 0, 0, 0, 0, 0, 0],
        monthlyActivity: { [today]: 1 }
      } as any);
    }

    const lastDate = new Date(streak.lastActiveDate);
    const todayDate = new Date(today);
    const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

    let newStreak = streak.currentStreak;
    if (diffDays === 0) {
      // Ya registró actividad hoy
      return streak;
    } else if (diffDays === 1) {
      // Día consecutivo
      newStreak++;
    } else {
      // Se rompió la racha
      newStreak = 1;
    }

    const longestStreak = Math.max(streak.longestStreak, newStreak);

    return this.update<DBLearningStreak>('learningStreaks', userId, {
      currentStreak: newStreak,
      longestStreak,
      lastActiveDate: today,
      monthlyActivity: {
        ...streak.monthlyActivity,
        [today]: (streak.monthlyActivity[today] || 0) + 1
      }
    });
  }

  // --- ACTIVIDADES DE PROGRESO ---
  async getProgressActivities(userId: string): Promise<DBProgressActivity[]> {
    return this.query<DBProgressActivity>('progressActivities', 'userId', userId);
  }

  async logProgressActivity(activity: Omit<DBProgressActivity, 'id'>): Promise<DBProgressActivity> {
    return this.create<DBProgressActivity>('progressActivities', activity);
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
    if (this.useFirebase) {
      console.warn('clearDatabase no disponible para Firebase');
      return;
    }

    const collections = [
      'users', 'courses', 'modules', 'lessons', 'enrollments',
      'evaluations', 'evaluationAttempts', 'grades', 'certificates',
      'messages', 'conversations', 'notifications', 'supportTickets',
      'activities', 'userPoints', 'badges', 'userBadges',
      'learningStreaks', 'progressActivities', 'userSettings', 'systemMetrics'
    ];

    collections.forEach(collection => localDB.clear(collection));
    console.log('Database cleared');
  }

  /**
   * Exportar todos los datos
   */
  async exportData(): Promise<Record<string, unknown[]>> {
    const collections = [
      'users', 'courses', 'modules', 'lessons', 'enrollments',
      'evaluations', 'evaluationAttempts', 'grades', 'certificates',
      'messages', 'conversations', 'notifications', 'supportTickets',
      'activities', 'userPoints', 'badges', 'userBadges',
      'learningStreaks', 'progressActivities', 'userSettings', 'systemMetrics'
    ];

    const data: Record<string, unknown[]> = {};
    
    for (const collection of collections) {
      data[collection] = await this.getAll(collection);
    }

    return data;
  }

  /**
   * Importar datos
   */
  async importData(data: Record<string, unknown[]>): Promise<void> {
    for (const [collection, records] of Object.entries(data)) {
      for (const record of records) {
        await this.create(collection, record as any);
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
  DBUserPoints as UserPoints,
  DBBadge as Badge,
  DBUserBadge as UserBadge,
  DBLearningStreak as LearningStreak,
  DBProgressActivity as ProgressActivity,
  DBUserSettings as UserSettings,
  DBSystemMetric as SystemMetric
};

export default firebaseDB;
