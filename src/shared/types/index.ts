// User Types
export interface User {
  id: string;
  email: string;
  passwordHash?: string;
  name: string;
  role: UserRole;
  emailVerified: boolean;
  emailVerificationToken?: string | null;
  passwordResetToken?: string | null;
  passwordResetExpires?: number | null;
  loginAttempts: number;
  lockUntil?: number | null;
  profile: UserProfile;
  preferences: UserPreferences;
  refreshTokens: Record<string, RefreshToken>;
  createdAt: number;
  lastActive: number;
}

export type UserRole = 'student' | 'teacher' | 'admin' | 'support';

export interface UserProfile {
  avatar?: string;
  bio?: string;
  phone?: string;
}

export interface UserPreferences {
  notifications: NotificationPreferences;
  theme: 'light' | 'dark';
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  inApp: boolean;
}

export interface RefreshToken {
  token: string;
  expiresAt: number;
  createdAt: number;
}

// Auth Session Types
export interface AuthSession {
  sessionId: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  createdAt: number;
  lastUsed: number;
  userAgent: string;
  ipAddress: string;
}

// Course Types
export interface Course {
  id: string;
  title: string;
  description: string;
  instructor: string;
  category: string;
  level: CourseLevel;
  status: CourseStatus;
  settings: CourseSettings;
  modules: Record<string, Module>;
  enrollments: Record<string, Enrollment>;
  createdAt: number;
  updatedAt: number;
  prerequisites?: string[];
  maxStudents?: number;
  duration?: string;
}

export type CourseLevel = 'beginner' | 'intermediate' | 'advanced';
export type CourseStatus = 'draft' | 'published' | 'archived';

export interface CourseSettings {
  access: 'public' | 'private' | 'restricted';
  accessCode?: string;
  startDate?: number;
  endDate?: number;
  maxStudents?: number;
}

export interface Module {
  id: string;
  title: string;
  order: number;
  lessons: Record<string, Lesson>;
}

export interface Lesson {
  id: string;
  title: string;
  type: LessonType;
  content: any; // Will be typed specifically per lesson type
  order: number;
  settings: LessonSettings;
}

export type LessonType = 'text' | 'video' | 'audio' | 'pdf' | 'quiz' | 'assignment';

export interface LessonSettings {
  isRequired?: boolean;
  timeLimit?: number;
  allowComments?: boolean;
}

export interface Enrollment {
  id: string;
  courseId: string;
  userId: string;
  enrolledAt: string;
  progress: number;
  status: EnrollmentStatus;
  completedLessons: string[];
  completedModules: string[];
  lastAccessedAt?: string;
  lastLessonId?: string;
  totalTimeSpent: number;
  certificateId?: string;
  grade?: number;
  createdAt: number;
  updatedAt: number;
  waitlistPosition?: number;
  withdrawnAt?: number;
  withdrawReason?: string;
  promotedFromWaitlistAt?: number;
}

export type EnrollmentStatus = 'active' | 'completed' | 'paused' | 'cancelled' | 'withdrawn' | 'waitlisted' | 'pending' | 'dropped';

export interface LessonProgress {
  completed: boolean;
  completedAt?: number;
  timeSpent?: number;
}

// Evaluation Types
export interface Evaluation {
  id: string;
  courseId: string;
  moduleId?: string;
  type: EvaluationType;
  title: string;
  instructions: string;
  settings: EvaluationSettings;
  questions: Question[];
}

export type EvaluationType = 'quiz' | 'assignment' | 'exam';

export interface EvaluationSettings {
  timeLimit?: number;
  attempts?: number;
  showResults: boolean;
  randomizeQuestions?: boolean;
  preventCheating?: boolean;
}

export interface Question {
  id: string;
  type: QuestionType;
  question: string;
  options?: string[];
  correctAnswer: any;
  points: number;
  explanation?: string;
}

export type QuestionType = 'multiple_choice' | 'true_false' | 'short_answer' | 'essay' | 'matching' | 'ordering';

export interface Submission {
  id: string;
  evaluationId: string;
  userId: string;
  answers: Record<string, any>;
  score?: number;
  submittedAt: number;
  gradedAt?: number;
  feedback?: string;
}

// Communication Types
export interface Conversation {
  id: string;
  participants: string[];
  messages: Record<string, Message>;
}

export interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: number;
  attachments?: string[];
  edited?: boolean;
  editedAt?: number;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  content: string;
  read: boolean;
  createdAt: number;
  relatedId?: string; // Course ID, Assignment ID, etc.
}

export type NotificationType = 'message' | 'assignment' | 'grade' | 'course_update' | 'system';

// Support Types
export interface Ticket {
  id: string;
  userId: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  assignedTo?: string;
  messages: TicketMessage[];
  createdAt: number;
  updatedAt: number;
}

export type TicketCategory = 'technical' | 'course' | 'payment' | 'other';
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';
export type TicketStatus = 'new' | 'assigned' | 'in_progress' | 'resolved' | 'closed';

export interface TicketMessage {
  sender: string;
  content: string;
  timestamp: number;
  attachments?: string[];
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

// Form Types
export interface LoginForm {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterForm {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
}

export interface CourseCreateForm {
  title: string;
  description: string;
  category: string;
  level: CourseLevel;
  settings: CourseSettings;
}