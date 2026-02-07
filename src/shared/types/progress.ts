export interface LearningProgress {
  id: string;
  userId: string;
  courseId: string;
  moduleId?: string;
  lessonId?: string;
  type: 'course' | 'module' | 'lesson' | 'assessment';
  status: 'not_started' | 'in_progress' | 'completed' | 'failed';
  
  // Progress tracking
  progressPercentage: number;
  timeSpent: number; // in milliseconds
  lastAccessedAt: number;
  startedAt?: number;
  completedAt?: number;
  
  // Performance metrics
  score?: number;
  maxScore?: number;
  attempts?: number;
  averageScore?: number;
  
  // Activity tracking
  activities: ProgressActivity[];
  milestones: ProgressMilestone[];
  
  // Metadata
  metadata?: {
    videoWatchTime?: number;
    interactionsCount?: number;
    commentsCount?: number;
    downloadsCount?: number;
    helpRequestsCount?: number;
  };
  
  createdAt: number;
  updatedAt: number;
}

export interface ProgressActivity {
  id: string;
  type: 'started' | 'completed' | 'resumed' | 'paused' | 'assessment_taken' | 'video_watched' | 'file_downloaded' | 'comment_posted';
  timestamp: number;
  duration?: number;
  metadata?: any;
}

export interface ProgressMilestone {
  id: string;
  type: 'first_lesson' | 'half_complete' | 'all_lessons' | 'assessment_passed' | 'course_completed';
  achievedAt: number;
  value?: any;
}

export interface UserLearningAnalytics {
  userId: string;
  totalCoursesEnrolled: number;
  totalCoursesCompleted: number;
  totalTimeSpent: number;
  averageCompletionRate: number;
  strengths: string[];
  improvementAreas: string[];
  learningStreak: number;
  lastActiveDate: number;
  
  // Course-specific analytics
  courseAnalytics: CourseProgress[];
  
  // Assessment performance
  assessmentStats: {
    totalTaken: number;
    totalPassed: number;
    averageScore: number;
    improvementTrend: number;
  };
  
  // Learning patterns
  preferredLearningTimes: number[]; // Hours of day (0-23)
  averageSessionDuration: number;
  completionVelocity: number; // lessons per day
}

export interface CourseProgress {
  courseId: string;
  courseTitle: string;
  enrolledAt: number;
  progressPercentage: number;
  timeSpent: number;
  lastAccessedAt: number;
  completedAt?: number;
  moduleProgress: ModuleProgress[];
  overallScore?: number;
  predictedCompletionDate?: number;
}

export interface ModuleProgress {
  moduleId: string;
  moduleTitle: string;
  progressPercentage: number;
  timeSpent: number;
  lessonProgress: LessonProgressSummary[];
  assessmentProgress: AssessmentProgressSummary[];
}

export interface LessonProgressSummary {
  lessonId: string;
  lessonTitle: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'failed';
  progressPercentage: number;
  timeSpent: number;
  lastAccessedAt?: number;
}

export interface AssessmentProgressSummary {
  assessmentId: string;
  assessmentTitle: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'failed';
  score?: number;
  maxScore?: number;
  attempts: number;
  lastAttemptAt?: number;
}

export interface ProgressGoal {
  id: string;
  userId: string;
  type: 'course_completion' | 'time_spent' | 'assessment_score' | 'learning_streak';
  targetValue: number;
  currentValue: number;
  deadline?: number;
  createdAt: number;
  completedAt?: number;
  isActive: boolean;
}

export interface LearningPath {
  id: string;
  title: string;
  description: string;
  courses: string[]; // Course IDs in order
  estimatedDuration: number; // in hours
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  prerequisites: string[];
  tags: string[];
  createdBy: string;
  createdAt: number;
}

export interface UserLearningPath {
  id: string;
  userId: string;
  learningPathId: string;
  startedAt: number;
  completedAt?: number;
  currentCourseIndex: number;
  progressPercentage: number;
  isActive: boolean;
}