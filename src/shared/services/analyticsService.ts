/**
 * Analytics Service - Cálculos de métricas y tendencias
 *
 * Este servicio proporciona análisis de datos para reportes y dashboards.
 */

import {
  userService,
  courseService,
  legacyEnrollmentService,
  certificateService,
  activityService,
  gradeService
} from './dataService';
import type { DBUser, DBCourse, DBEnrollment, DBActivity } from './dataService';

// Types
export interface MonthlyStats {
  month: string;
  monthKey: string;
  newUsers: number;
  newEnrollments: number;
  completions: number;
}

export interface CourseAnalytics {
  id: string;
  title: string;
  enrollments: number;
  completions: number;
  completionRate: number;
  avgProgress: number;
  avgGrade: number | null;
}

export interface UserActivityStats {
  date: string;
  activeUsers: number;
  lessonsCompleted: number;
  evaluationsSubmitted: number;
}

export interface EngagementMetrics {
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  avgSessionDuration: number; // in minutes
  retentionRate: number; // percentage
  avgLessonsPerSession: number;
}

export interface TrendComparison {
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
}

class AnalyticsService {
  /**
   * Calcular estadísticas mensuales de los últimos N meses
   */
  async getMonthlyStats(months = 6): Promise<MonthlyStats[]> {
    const [users, enrollments] = await Promise.all([
      userService.getAll(),
      legacyEnrollmentService.getAll()
    ]);

    const stats: MonthlyStats[] = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);

      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('es-ES', { month: 'short' });

      // Count new users in this month
      const newUsers = users.filter((u: DBUser) => {
        const created = new Date(u.createdAt);
        return created >= date && created < nextMonth;
      }).length;

      // Count new enrollments in this month
      const newEnrollments = enrollments.filter((e: DBEnrollment) => {
        const enrolled = new Date(e.enrolledAt);
        return enrolled >= date && enrolled < nextMonth;
      }).length;

      // Count completions in this month
      const completions = enrollments.filter((e: any) => {
        if (e.status !== 'completed' || !e.completedAt) return false;
        const completed = new Date(e.completedAt);
        return completed >= date && completed < nextMonth;
      }).length;

      stats.push({
        month: monthName.charAt(0).toUpperCase() + monthName.slice(1),
        monthKey,
        newUsers,
        newEnrollments,
        completions
      });
    }

    return stats;
  }

  /**
   * Obtener analytics por curso
   */
  async getCourseAnalytics(courseId?: string): Promise<CourseAnalytics[]> {
    const [courses, enrollments, grades] = await Promise.all([
      courseId ? courseService.getById(courseId).then(c => c ? [c] : []) : courseService.getAll(),
      legacyEnrollmentService.getAll(),
      gradeService.getAll()
    ]);

    return courses.map((course: DBCourse) => {
      const courseEnrollments = enrollments.filter((e: DBEnrollment) => e.courseId === course.id);
      const completions = courseEnrollments.filter((e: DBEnrollment) => e.status === 'completed').length;
      const totalProgress = courseEnrollments.reduce((sum: number, e: DBEnrollment) => sum + (e.progress || 0), 0);
      const avgProgress = courseEnrollments.length > 0 ? Math.round(totalProgress / courseEnrollments.length) : 0;

      // Calculate average grade for this course
      const courseGrades = grades.filter((g: any) => g.courseId === course.id);
      const avgGrade = courseGrades.length > 0
        ? Math.round(courseGrades.reduce((sum: number, g: any) => sum + (g.grade || 0), 0) / courseGrades.length)
        : null;

      return {
        id: course.id,
        title: course.title,
        enrollments: courseEnrollments.length,
        completions,
        completionRate: courseEnrollments.length > 0 ? Math.round((completions / courseEnrollments.length) * 100) : 0,
        avgProgress,
        avgGrade
      };
    });
  }

  /**
   * Obtener estadísticas de actividad diaria
   */
  async getDailyActivityStats(days = 7): Promise<UserActivityStats[]> {
    const activities = await activityService.getRecent(1000);
    const stats: UserActivityStats[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const nextDay = new Date(date.getTime() + 24 * 60 * 60 * 1000);

      const dayActivities = activities.filter((a: DBActivity) => {
        const activityDate = new Date(a.timestamp);
        return activityDate >= date && activityDate < nextDay;
      });

      // Count unique active users
      const uniqueUsers = new Set(dayActivities.map((a: DBActivity) => a.userId));

      // Count lesson completions
      const lessonsCompleted = dayActivities.filter((a: DBActivity) =>
        a.type === 'lesson_complete' || a.action?.includes('lección') || a.action?.includes('lesson')
      ).length;

      // Count evaluation submissions
      const evaluationsSubmitted = dayActivities.filter((a: any) =>
        a.type === 'evaluation_submit' || a.type === 'quiz_submit' || a.action?.includes('evaluación')
      ).length;

      stats.push({
        date: date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }),
        activeUsers: uniqueUsers.size,
        lessonsCompleted,
        evaluationsSubmitted
      });
    }

    return stats;
  }

  /**
   * Calcular métricas de engagement
   */
  async getEngagementMetrics(): Promise<EngagementMetrics> {
    const [, activities] = await Promise.all([
      userService.getAll(),
      activityService.getRecent(5000)
    ]);

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const weekMs = 7 * dayMs;
    const monthMs = 30 * dayMs;

    // Calculate active users for different periods
    const dailyActiveUsers = new Set(
      activities
        .filter((a: DBActivity) => now - a.timestamp < dayMs)
        .map((a: DBActivity) => a.userId)
    ).size;

    const weeklyActiveUsers = new Set(
      activities
        .filter((a: DBActivity) => now - a.timestamp < weekMs)
        .map((a: DBActivity) => a.userId)
    ).size;

    const monthlyActiveUsers = new Set(
      activities
        .filter((a: DBActivity) => now - a.timestamp < monthMs)
        .map((a: DBActivity) => a.userId)
    ).size;

    // Calculate retention rate (WAU / MAU)
    const retentionRate = monthlyActiveUsers > 0
      ? Math.round((weeklyActiveUsers / monthlyActiveUsers) * 100)
      : 0;

    // Estimate average session duration and lessons per session
    // This is a simplified calculation based on activity patterns
    const avgSessionDuration = 25; // Placeholder - would need session tracking
    const avgLessonsPerSession = dailyActiveUsers > 0
      ? Math.round(activities.filter((a: DBActivity) =>
          now - a.timestamp < dayMs && a.type === 'lesson_complete'
        ).length / dailyActiveUsers * 10) / 10
      : 0;

    return {
      dailyActiveUsers,
      weeklyActiveUsers,
      monthlyActiveUsers,
      avgSessionDuration,
      retentionRate,
      avgLessonsPerSession
    };
  }

  /**
   * Comparar métricas entre dos períodos
   */
  async getTrendComparison(
    metric: 'users' | 'enrollments' | 'completions' | 'certificates',
    period: 'week' | 'month' | 'quarter' = 'month'
  ): Promise<TrendComparison> {
    const now = Date.now();
    const periodMs = {
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
      quarter: 90 * 24 * 60 * 60 * 1000
    }[period];

    let current = 0;
    let previous = 0;

    switch (metric) {
      case 'users': {
        const users = await userService.getAll();
        current = users.filter((u: DBUser) => now - u.createdAt < periodMs).length;
        previous = users.filter((u: DBUser) => {
          const age = now - u.createdAt;
          return age >= periodMs && age < periodMs * 2;
        }).length;
        break;
      }
      case 'enrollments': {
        const enrollments = await legacyEnrollmentService.getAll();
        current = enrollments.filter((e: any) => now - new Date(e.enrolledAt).getTime() < periodMs).length;
        previous = enrollments.filter((e: any) => {
          const age = now - new Date(e.enrolledAt).getTime();
          return age >= periodMs && age < periodMs * 2;
        }).length;
        break;
      }
      case 'completions': {
        const enrollments = await legacyEnrollmentService.getAll();
        const completed = enrollments.filter((e: any) => e.status === 'completed' && e.completedAt);
        current = completed.filter((e: any) => now - new Date(e.completedAt).getTime() < periodMs).length;
        previous = completed.filter((e: any) => {
          const age = now - new Date(e.completedAt).getTime();
          return age >= periodMs && age < periodMs * 2;
        }).length;
        break;
      }
      case 'certificates': {
        const certificates = await certificateService.getAll();
        current = certificates.filter((c: any) => now - c.issuedAt < periodMs).length;
        previous = certificates.filter((c: any) => {
          const age = now - c.issuedAt;
          return age >= periodMs && age < periodMs * 2;
        }).length;
        break;
      }
    }

    const change = current - previous;
    const changePercent = previous > 0 ? Math.round((change / previous) * 100) : (current > 0 ? 100 : 0);
    const trend = change > 0 ? 'up' : change < 0 ? 'down' : 'stable';

    return { current, previous, change, changePercent, trend };
  }

  /**
   * Obtener top cursos por métrica
   */
  async getTopCourses(
    metric: 'enrollments' | 'completions' | 'rating' | 'progress' = 'enrollments',
    limit = 5
  ): Promise<CourseAnalytics[]> {
    const analytics = await this.getCourseAnalytics();

    return analytics
      .sort((a, b) => {
        switch (metric) {
          case 'enrollments': return b.enrollments - a.enrollments;
          case 'completions': return b.completions - a.completions;
          case 'rating': return (b.avgGrade || 0) - (a.avgGrade || 0);
          case 'progress': return b.avgProgress - a.avgProgress;
          default: return 0;
        }
      })
      .slice(0, limit);
  }

  /**
   * Obtener resumen ejecutivo para reportes
   */
  async getExecutiveSummary() {
    const [
      monthlyStats,
      engagementMetrics,
      userTrend,
      enrollmentTrend,
      topCourses
    ] = await Promise.all([
      this.getMonthlyStats(6),
      this.getEngagementMetrics(),
      this.getTrendComparison('users', 'month'),
      this.getTrendComparison('enrollments', 'month'),
      this.getTopCourses('enrollments', 5)
    ]);

    return {
      monthlyStats,
      engagement: engagementMetrics,
      trends: {
        users: userTrend,
        enrollments: enrollmentTrend
      },
      topCourses,
      generatedAt: new Date().toISOString()
    };
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();
