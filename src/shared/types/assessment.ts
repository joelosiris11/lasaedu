export interface QuestionBank {
  id: string;
  title: string;
  description?: string;
  category: string;
  tags: string[];
  questions: Question[];
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface Question {
  id: string;
  type: QuestionType;
  question: string;
  options?: QuestionOption[];
  correctAnswer: any;
  points: number;
  explanation?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  category?: string;
  tags?: string[];
  metadata?: {
    timeLimit?: number;
    caseSensitive?: boolean;
    partialCredit?: boolean;
    randomizeOptions?: boolean;
    allowMultipleAttempts?: boolean;
    allowedTypes?: string;
    maxSize?: number;
  };
}

export type QuestionType = 
  | 'multiple_choice' 
  | 'single_choice'
  | 'true_false' 
  | 'short_answer' 
  | 'long_answer'
  | 'essay' 
  | 'matching' 
  | 'ordering'
  | 'fill_blank'
  | 'hotspot'
  | 'file_upload';

export interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
  explanation?: string;
  points?: number;
}

export interface MatchingPair {
  id: string;
  left: string;
  right: string;
}

export interface OrderingItem {
  id: string;
  text: string;
  correctOrder: number;
}

export interface Assessment {
  id: string;
  courseId: string;
  moduleId?: string;
  lessonId?: string;
  type: AssessmentType;
  title: string;
  description: string;
  instructions: string;
  settings: AssessmentSettings;
  questions: AssessmentQuestion[];
  questionData?: Record<string, Question>; // Full question data indexed by questionId
  grading: GradingSettings;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  status: 'draft' | 'published' | 'archived';
}

export type AssessmentType = 'quiz' | 'assignment' | 'exam' | 'survey' | 'practice';

export interface AssessmentSettings {
  timeLimit?: number; // in minutes
  attempts?: number;
  shuffleQuestions?: boolean;
  shuffleAnswers?: boolean;
  showResults: 'immediately' | 'after_due' | 'manual' | 'never';
  showCorrectAnswers: 'immediately' | 'after_submission' | 'after_due' | 'never';
  allowBacktrack?: boolean;
  requireProctor?: boolean;
  preventCheating?: boolean;
  showProgressBar?: boolean;
  autoSubmit?: boolean;
  dueDate?: number;
  availableFrom?: number;
  availableUntil?: number;
  password?: string;
}

export interface AssessmentQuestion {
  questionId: string;
  order: number;
  points: number;
  required?: boolean;
  questionBank?: string; // If from question bank
}

export interface GradingSettings {
  passingScore: number;
  gradingScale: 'points' | 'percentage' | 'letter';
  allowPartialCredit: boolean;
  penaltyForWrongAnswers?: number;
  extraCreditPoints?: number;
  manualGrading?: boolean;
  rubricId?: string;
}

export interface AttemptResult {
  id: string;
  assessmentId: string;
  userId: string;
  attemptNumber: number;
  startedAt: number;
  submittedAt?: number;
  timeSpent: number;
  status: 'in_progress' | 'submitted' | 'graded' | 'incomplete';
  answers: Record<string, any>;
  score?: number;
  maxScore: number;
  percentage?: number;
  grade?: string;
  feedback?: string;
  gradedBy?: string;
  gradedAt?: number;
}

export interface QuestionResponse {
  questionId: string;
  answer: any;
  timeSpent: number;
  attemptCount: number;
  isCorrect?: boolean;
  pointsEarned?: number;
  feedback?: string;
}

export interface Rubric {
  id: string;
  title: string;
  description?: string;
  criteria: RubricCriterion[];
  maxScore: number;
  createdBy: string;
  createdAt: number;
}

export interface RubricCriterion {
  id: string;
  name: string;
  description: string;
  levels: RubricLevel[];
  weight?: number;
}

export interface RubricLevel {
  id: string;
  name: string;
  description: string;
  points: number;
}

export interface AssessmentAnalytics {
  assessmentId: string;
  totalAttempts: number;
  averageScore: number;
  averageTimeSpent: number;
  passRate: number;
  questionAnalytics: QuestionAnalytics[];
  difficultyDistribution: Record<string, number>;
  submissionTrend: Array<{ date: string; count: number }>;
}

export interface QuestionAnalytics {
  questionId: string;
  answeredCount: number;
  correctCount: number;
  averageTimeSpent: number;
  difficultyLevel: number;
  discriminationIndex: number;
  commonWrongAnswers: Array<{ answer: string; count: number }>;
}