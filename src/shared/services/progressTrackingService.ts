import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { db } from '@app/config/firebase';
import type {
  LearningProgress,
  UserLearningAnalytics,
  CourseProgress,
  ProgressActivity,
  ProgressMilestone,
  ProgressGoal,
  AssessmentProgressSummary
} from '@shared/types/progress';

class ProgressTrackingService {
  // Core progress tracking
  async getOrCreateProgress(
    userId: string, 
    courseId: string, 
    type: 'course' | 'module' | 'lesson' | 'assessment',
    itemId: string
  ): Promise<LearningProgress> {
    const progressId = `${userId}_${courseId}_${type}_${itemId}`;
    const docRef = doc(db, 'progress', progressId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id: progressId, ...docSnap.data() } as LearningProgress;
    } else {
      const newProgress: LearningProgress = {
        id: progressId,
        userId,
        courseId,
        type,
        status: 'not_started',
        progressPercentage: 0,
        timeSpent: 0,
        lastAccessedAt: Date.now(),
        activities: [],
        milestones: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await setDoc(docRef, newProgress);
      return newProgress;
    }
  }

  async updateProgress(
    progressId: string, 
    updates: Partial<LearningProgress>
  ): Promise<void> {
    const docRef = doc(db, 'progress', progressId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: Date.now()
    });
  }

  async recordActivity(
    progressId: string,
    activity: Omit<ProgressActivity, 'id'>
  ): Promise<void> {
    const progress = await this.getProgressById(progressId);
    if (!progress) return;

    const newActivity: ProgressActivity = {
      id: Date.now().toString(),
      ...activity
    };

    const updatedActivities = [...progress.activities, newActivity];
    
    await this.updateProgress(progressId, {
      activities: updatedActivities,
      lastAccessedAt: Date.now()
    });
  }

  async getProgressById(progressId: string): Promise<LearningProgress | null> {
    const docRef = doc(db, 'progress', progressId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: progressId, ...docSnap.data() } as LearningProgress;
    }
    return null;
  }

  // Lesson progress tracking
  async startLesson(userId: string, courseId: string, lessonId: string): Promise<void> {
    const progress = await this.getOrCreateProgress(userId, courseId, 'lesson', lessonId);
    
    if (progress.status === 'not_started') {
      await this.updateProgress(progress.id, {
        status: 'in_progress',
        startedAt: Date.now()
      });

      await this.recordActivity(progress.id, {
        type: 'started',
        timestamp: Date.now()
      });

      // Check if this is first lesson and record milestone
      const courseProgress = await this.getCourseProgress(userId, courseId);
      if (courseProgress.moduleProgress.every(m => 
        m.lessonProgress.every(l => l.status === 'not_started')
      )) {
        await this.recordMilestone(progress.id, {
          type: 'first_lesson',
          achievedAt: Date.now()
        });
      }
    }
  }

  async updateLessonProgress(
    userId: string, 
    courseId: string, 
    lessonId: string,
    progressPercentage: number,
    timeSpent?: number
  ): Promise<void> {
    const progress = await this.getOrCreateProgress(userId, courseId, 'lesson', lessonId);
    
    const updates: Partial<LearningProgress> = {
      progressPercentage: Math.max(progress.progressPercentage, progressPercentage),
      lastAccessedAt: Date.now()
    };

    if (timeSpent) {
      updates.timeSpent = progress.timeSpent + timeSpent;
    }

    if (progressPercentage >= 100 && progress.status !== 'completed') {
      updates.status = 'completed';
      updates.completedAt = Date.now();
      
      await this.recordActivity(progress.id, {
        type: 'completed',
        timestamp: Date.now()
      });
    }

    await this.updateProgress(progress.id, updates);
    
    // Update parent module and course progress
    await this.updateModuleProgress(userId, courseId, progress.moduleId!);
    await this.updateCourseProgress(userId, courseId);
  }

  async completeLesson(userId: string, courseId: string, lessonId: string): Promise<void> {
    const progress = await this.getOrCreateProgress(userId, courseId, 'lesson', lessonId);
    
    await this.updateProgress(progress.id, {
      status: 'completed',
      progressPercentage: 100,
      completedAt: Date.now()
    });

    await this.recordActivity(progress.id, {
      type: 'completed',
      timestamp: Date.now()
    });

    // Update parent progress
    await this.updateModuleProgress(userId, courseId, progress.moduleId!);
    await this.updateCourseProgress(userId, courseId);
  }

  // Module progress calculation
  async updateModuleProgress(userId: string, courseId: string, moduleId: string): Promise<void> {
    // Get all lessons in module
    const q = query(
      collection(db, 'progress'),
      where('userId', '==', userId),
      where('courseId', '==', courseId),
      where('moduleId', '==', moduleId),
      where('type', '==', 'lesson')
    );

    const snapshot = await getDocs(q);
    const lessonProgresses = snapshot.docs.map(doc => doc.data() as LearningProgress);

    if (lessonProgresses.length === 0) return;

    const totalProgress = lessonProgresses.reduce((sum, p) => sum + p.progressPercentage, 0);
    const averageProgress = totalProgress / lessonProgresses.length;
    const totalTimeSpent = lessonProgresses.reduce((sum, p) => sum + p.timeSpent, 0);

    const moduleProgress = await this.getOrCreateProgress(userId, courseId, 'module', moduleId);
    
    const status = averageProgress >= 100 ? 'completed' : 
                   averageProgress > 0 ? 'in_progress' : 'not_started';

    await this.updateProgress(moduleProgress.id, {
      status,
      progressPercentage: averageProgress,
      timeSpent: totalTimeSpent
    });
  }

  // Course progress calculation
  async updateCourseProgress(userId: string, courseId: string): Promise<void> {
    // Get all modules in course
    const q = query(
      collection(db, 'progress'),
      where('userId', '==', userId),
      where('courseId', '==', courseId),
      where('type', '==', 'module')
    );

    const snapshot = await getDocs(q);
    const moduleProgresses = snapshot.docs.map(doc => doc.data() as LearningProgress);

    if (moduleProgresses.length === 0) return;

    const totalProgress = moduleProgresses.reduce((sum, p) => sum + p.progressPercentage, 0);
    const averageProgress = totalProgress / moduleProgresses.length;
    const totalTimeSpent = moduleProgresses.reduce((sum, p) => sum + p.timeSpent, 0);

    const courseProgress = await this.getOrCreateProgress(userId, courseId, 'course', courseId);
    
    const status = averageProgress >= 100 ? 'completed' : 
                   averageProgress > 0 ? 'in_progress' : 'not_started';

    const updates: Partial<LearningProgress> = {
      status,
      progressPercentage: averageProgress,
      timeSpent: totalTimeSpent
    };

    if (status === 'completed' && courseProgress.status !== 'completed') {
      updates.completedAt = Date.now();
      await this.recordMilestone(courseProgress.id, {
        type: 'course_completed',
        achievedAt: Date.now()
      });
    }

    await this.updateProgress(courseProgress.id, updates);
  }

  // Assessment progress
  async recordAssessmentAttempt(
    userId: string, 
    courseId: string, 
    assessmentId: string,
    score: number,
    maxScore: number
  ): Promise<void> {
    const progress = await this.getOrCreateProgress(userId, courseId, 'assessment', assessmentId);
    
    const attempts = (progress.attempts || 0) + 1;
    const currentAverage = progress.averageScore || 0;
    const newAverage = ((currentAverage * (attempts - 1)) + score) / attempts;
    
    const status = score >= (maxScore * 0.6) ? 'completed' : 'failed'; // 60% passing
    
    await this.updateProgress(progress.id, {
      status,
      score: Math.max(progress.score || 0, score),
      maxScore,
      attempts,
      averageScore: newAverage,
      lastAccessedAt: Date.now()
    });

    await this.recordActivity(progress.id, {
      type: 'assessment_taken',
      timestamp: Date.now(),
      metadata: { score, maxScore, attempt: attempts }
    });

    if (status === 'completed' && (progress.score || 0) < score) {
      await this.recordMilestone(progress.id, {
        type: 'assessment_passed',
        achievedAt: Date.now(),
        value: score
      });
    }
  }

  // Milestone tracking
  async recordMilestone(
    progressId: string,
    milestone: Omit<ProgressMilestone, 'id'>
  ): Promise<void> {
    const progress = await this.getProgressById(progressId);
    if (!progress) return;

    const newMilestone: ProgressMilestone = {
      id: Date.now().toString(),
      ...milestone
    };

    const updatedMilestones = [...progress.milestones, newMilestone];
    
    await this.updateProgress(progressId, {
      milestones: updatedMilestones
    });
  }

  // Analytics and reporting
  async getCourseProgress(userId: string, courseId: string): Promise<CourseProgress> {
    // Get course progress
    const courseProgressDoc = await this.getOrCreateProgress(userId, courseId, 'course', courseId);
    
    // Get all module progresses
    const moduleQuery = query(
      collection(db, 'progress'),
      where('userId', '==', userId),
      where('courseId', '==', courseId),
      where('type', '==', 'module'),
      orderBy('updatedAt', 'desc')
    );

    const moduleSnapshot = await getDocs(moduleQuery);
    const moduleProgresses = moduleSnapshot.docs.map(doc => doc.data() as LearningProgress);

    // Build module progress details
    const moduleProgress = await Promise.all(moduleProgresses.map(async (mp) => {
      // Get lesson progresses for this module
      const lessonQuery = query(
        collection(db, 'progress'),
        where('userId', '==', userId),
        where('courseId', '==', courseId),
        where('moduleId', '==', mp.moduleId),
        where('type', '==', 'lesson')
      );

      const lessonSnapshot = await getDocs(lessonQuery);
      const lessonProgresses = lessonSnapshot.docs.map(doc => doc.data() as LearningProgress);

      return {
        moduleId: mp.moduleId!,
        moduleTitle: `Module ${mp.moduleId}`, // Would get from course data
        progressPercentage: mp.progressPercentage,
        timeSpent: mp.timeSpent,
        lessonProgress: lessonProgresses.map(lp => ({
          lessonId: lp.lessonId!,
          lessonTitle: `Lesson ${lp.lessonId}`, // Would get from lesson data
          status: lp.status,
          progressPercentage: lp.progressPercentage,
          timeSpent: lp.timeSpent,
          lastAccessedAt: lp.lastAccessedAt
        })),
        assessmentProgress: [] as AssessmentProgressSummary[] // TODO: Implement assessment progress
      };
    }));

    return {
      courseId,
      courseTitle: `Course ${courseId}`, // Would get from course data
      enrolledAt: courseProgressDoc.createdAt,
      progressPercentage: courseProgressDoc.progressPercentage,
      timeSpent: courseProgressDoc.timeSpent,
      lastAccessedAt: courseProgressDoc.lastAccessedAt,
      completedAt: courseProgressDoc.completedAt,
      moduleProgress,
      overallScore: courseProgressDoc.score
    };
  }

  async getUserAnalytics(userId: string): Promise<UserLearningAnalytics> {
    // Get all user progress
    const q = query(
      collection(db, 'progress'),
      where('userId', '==', userId),
      where('type', '==', 'course')
    );

    const snapshot = await getDocs(q);
    const courseProgresses = snapshot.docs.map(doc => doc.data() as LearningProgress);

    const totalCoursesEnrolled = courseProgresses.length;
    const completedCourses = courseProgresses.filter(p => p.status === 'completed');
    const totalCoursesCompleted = completedCourses.length;
    const totalTimeSpent = courseProgresses.reduce((sum, p) => sum + p.timeSpent, 0);
    const averageCompletionRate = totalCoursesEnrolled > 0 ? 
      (totalCoursesCompleted / totalCoursesEnrolled) * 100 : 0;

    // Build course analytics
    const courseAnalytics = await Promise.all(
      courseProgresses.map(cp => this.getCourseProgress(userId, cp.courseId))
    );

    return {
      userId,
      totalCoursesEnrolled,
      totalCoursesCompleted,
      totalTimeSpent,
      averageCompletionRate,
      strengths: [], // TODO: Analyze performance patterns
      improvementAreas: [], // TODO: Analyze weak areas
      learningStreak: 0, // TODO: Calculate learning streak
      lastActiveDate: Math.max(...courseProgresses.map(p => p.lastAccessedAt)),
      courseAnalytics,
      assessmentStats: {
        totalTaken: 0,
        totalPassed: 0,
        averageScore: 0,
        improvementTrend: 0
      },
      preferredLearningTimes: [],
      averageSessionDuration: 0,
      completionVelocity: 0
    };
  }

  // Time tracking
  async trackTimeSpent(
    userId: string,
    courseId: string,
    itemId: string,
    itemType: 'lesson' | 'assessment',
    timeSpent: number
  ): Promise<void> {
    const progress = await this.getOrCreateProgress(userId, courseId, itemType, itemId);
    
    await this.updateProgress(progress.id, {
      timeSpent: progress.timeSpent + timeSpent,
      lastAccessedAt: Date.now()
    });

    // Record activity for time tracking
    await this.recordActivity(progress.id, {
      type: 'resumed',
      timestamp: Date.now(),
      duration: timeSpent
    });
  }

  // Video-specific tracking
  async trackVideoProgress(
    userId: string,
    courseId: string,
    lessonId: string,
    watchedDuration: number,
    totalDuration: number
  ): Promise<void> {
    const progressPercentage = Math.min((watchedDuration / totalDuration) * 100, 100);
    
    await this.updateLessonProgress(userId, courseId, lessonId, progressPercentage);
    
    // Update metadata for video watching
    const progress = await this.getOrCreateProgress(userId, courseId, 'lesson', lessonId);
    const currentVideoTime = progress.metadata?.videoWatchTime || 0;
    
    await this.updateProgress(progress.id, {
      metadata: {
        ...progress.metadata,
        videoWatchTime: Math.max(currentVideoTime, watchedDuration)
      }
    });
  }

  // Goal setting and tracking
  async setProgressGoal(goal: Omit<ProgressGoal, 'id' | 'createdAt' | 'currentValue'>): Promise<ProgressGoal> {
    const newGoal: ProgressGoal = {
      ...goal,
      id: Date.now().toString(),
      createdAt: Date.now(),
      currentValue: 0
    };

    const docRef = doc(db, 'progressGoals', newGoal.id);
    await setDoc(docRef, newGoal);
    
    return newGoal;
  }

  async updateGoalProgress(goalId: string, currentValue: number): Promise<void> {
    const docRef = doc(db, 'progressGoals', goalId);
    const updates: any = { currentValue };
    
    const goalDoc = await getDoc(docRef);
    if (goalDoc.exists()) {
      const goal = goalDoc.data() as ProgressGoal;
      if (currentValue >= goal.targetValue && !goal.completedAt) {
        updates.completedAt = Date.now();
        updates.isActive = false;
      }
    }
    
    await updateDoc(docRef, updates);
  }

  async getUserGoals(userId: string): Promise<ProgressGoal[]> {
    const q = query(
      collection(db, 'progressGoals'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProgressGoal));
  }
}

export const progressTrackingService = new ProgressTrackingService();
export default progressTrackingService;