import { useState, useEffect, useCallback } from 'react';
import { dashboardService, courseSnapshotService, sectionService, lessonService, moduleService } from '@shared/services/dataService';
import { firebaseDB } from '@shared/services/firebaseDataService';
import type { DBActivity, DBSupportTicket, DBCourseSnapshot, DBEnrollment } from '@shared/services/dataService';
import { resolveDeadlines, parseTimestamp, getTimeRemaining } from '@shared/utils/deadlines';

// Tipos para las estadísticas del sistema
interface SystemStats {
  totalUsers: number;
  activeStudents: number;
  activeCourses: number;
  totalEnrollments: number;
  openTickets: number;
  totalTeachers: number;
  completedCourses: number;
}

// Tipos para métricas del sistema
interface SystemMetricsData {
  activeUsers: number;
  totalUsers: number;
  avgProgress: number;
  totalCourses: number;
  publishedCourses: number;
  totalEnrollments: number;
}

// Hook para estadísticas del sistema
export const useSystemStats = () => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const data = await dashboardService.getSystemStats();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar estadísticas');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    
    // Actualizar cada 30 segundos
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  return { stats, loading, error, refetch: () => setLoading(true) };
};

// Hook para actividad reciente
export const useRecentActivity = (limit = 10) => {
  const [activities, setActivities] = useState<DBActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        setLoading(true);
        const data = await dashboardService.getRecentActivity(limit);
        setActivities(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar actividad');
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
    
    // Actualizar cada minuto
    const interval = setInterval(fetchActivities, 60000);
    return () => clearInterval(interval);
  }, [limit]);

  return { activities, loading, error };
};

// Hook para métricas del sistema
export const useSystemMetrics = () => {
  const [metrics, setMetrics] = useState<SystemMetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        const data = await dashboardService.getSystemMetrics();
        setMetrics(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar métricas');
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    
    // Actualizar cada 10 segundos
    const interval = setInterval(fetchMetrics, 10000);
    return () => clearInterval(interval);
  }, []);

  return { metrics, loading, error };
};

// Hook para cursos del profesor
export const useTeacherCourses = (teacherId: string) => {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        setLoading(true);
        const data = await dashboardService.getTeacherCourses(teacherId);
        setCourses(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar cursos');
      } finally {
        setLoading(false);
      }
    };

    if (teacherId) {
      fetchCourses();
    }
  }, [teacherId]);

  return { courses, loading, error };
};

// Hook para cursos del estudiante (carga secciones inscritas como "cursos")
export const useStudentCourses = (studentId: string) => {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        setLoading(true);
        const enrollments = await firebaseDB.getEnrollmentsByUser(studentId);
        const results: any[] = [];

        for (const enrollment of enrollments) {
          if (!enrollment.sectionId) {
            // Legacy enrollment without section — load course directly
            const course = await firebaseDB.getCourseById(enrollment.courseId);
            if (course) {
              results.push({
                ...course,
                progress: enrollment.progress || 0,
                enrollmentStatus: enrollment.status,
                lastAccessedAt: enrollment.lastAccessedAt,
                sectionId: null,
              });
            }
            continue;
          }
          // Section-based enrollment
          const section = await sectionService.getById(enrollment.sectionId);
          if (section) {
            results.push({
              id: section.courseId,
              title: section.courseTitle,
              sectionTitle: section.title,
              sectionId: section.id,
              instructor: section.instructorName,
              category: section.courseCategory,
              level: section.courseLevel,
              image: section.courseImage,
              progress: enrollment.progress || 0,
              enrollmentStatus: enrollment.status,
              lastAccessedAt: enrollment.lastAccessedAt,
            });
          }
        }

        setCourses(results);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar cursos');
      } finally {
        setLoading(false);
      }
    };

    if (studentId) {
      fetchCourses();
    }
  }, [studentId]);

  return { courses, loading, error };
};

// Hook para tickets de soporte
export const useSupportTickets = (assigneeId?: string) => {
  const [tickets, setTickets] = useState<DBSupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        setLoading(true);
        const data = await dashboardService.getSupportTickets(assigneeId);
        setTickets(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar tickets');
      } finally {
        setLoading(false);
      }
    };

    fetchTickets();
    
    // Actualizar cada 2 minutos
    const interval = setInterval(fetchTickets, 120000);
    return () => clearInterval(interval);
  }, [assigneeId]);

  return { tickets, loading, error };
};

// Hook for admin overview (user distribution, enrollment breakdown, top courses)
export const useAdminOverview = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await dashboardService.getAdminOverview();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar overview');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  return { data, loading, error };
};

// Hook for teacher performance data
export const useTeacherPerformance = (teacherId: string) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await dashboardService.getTeacherPerformance(teacherId);
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar rendimiento');
      } finally {
        setLoading(false);
      }
    };

    if (teacherId) {
      fetchData();
    }
  }, [teacherId]);

  return { data, loading, error };
};

// Hook for student grades summary
export const useStudentGrades = (studentId: string) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await dashboardService.getStudentGradesSummary(studentId);
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar calificaciones');
      } finally {
        setLoading(false);
      }
    };

    if (studentId) {
      fetchData();
    }
  }, [studentId]);

  return { data, loading, error };
};

// Hook para estadísticas de soporte
export const useSupportStats = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const data = await dashboardService.getSupportStats();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar estadísticas de soporte');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    
    // Actualizar cada minuto
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, []);

  return { stats, loading, error };
};

// Hook for course snapshots (admin rollback history)
export const useCourseSnapshots = () => {
  const [snapshots, setSnapshots] = useState<DBCourseSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSnapshots = useCallback(async () => {
    try {
      setLoading(true);
      const data = await courseSnapshotService.getAll();
      setSnapshots(data.sort((a, b) => b.savedAt - a.savedAt));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar snapshots');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSnapshots();
  }, [fetchSnapshots]);

  const saveSnapshot = async (courseId: string, savedBy: string) => {
    await courseSnapshotService.saveSnapshot(courseId, savedBy);
    await fetchSnapshots();
  };

  const rollback = async (courseId: string) => {
    await courseSnapshotService.rollback(courseId);
    await fetchSnapshots();
  };

  return { snapshots, loading, error, saveSnapshot, rollback, refetch: fetchSnapshots };
};

// Hook for student upcoming deadlines
export interface StudentDeadline {
  lessonId: string;
  lessonTitle: string;
  courseId: string;
  courseTitle: string;
  sectionId?: string;
  type: 'quiz' | 'tarea';
  dueTimestamp: number;
  timeRemaining: string;
}

export const useStudentDeadlines = (studentId: string) => {
  const [deadlines, setDeadlines] = useState<StudentDeadline[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) { setLoading(false); return; }

    const fetchDeadlines = async () => {
      try {
        setLoading(true);
        const enrollments = await firebaseDB.getEnrollmentsByUser(studentId);
        const activeEnrollments = enrollments.filter((e: DBEnrollment) => e.status === 'active');

        const allDeadlines: StudentDeadline[] = [];

        for (const enrollment of activeEnrollments) {
          const course = await firebaseDB.getCourseById(enrollment.courseId);
          if (!course) continue;

          // Load section overrides if enrollment has sectionId
          let overrideMap = new Map<string, any>();
          if (enrollment.sectionId) {
            const overrides = await sectionService.getLessonOverrides(enrollment.sectionId);
            overrideMap = new Map(overrides.map(o => [o.lessonId, o]));
          }

          // Load all quiz/tarea lessons for this course
          const modules = await moduleService.getByCourse(enrollment.courseId);
          for (const mod of modules) {
            const lessons = await lessonService.getByModule(mod.id);
            for (const lesson of lessons) {
              if (lesson.type !== 'quiz' && lesson.type !== 'tarea') continue;

              const resolved = resolveDeadlines(lesson.settings, overrideMap.get(lesson.id));
              const dueTs = parseTimestamp(resolved.dueDate);
              if (!dueTs || dueTs <= Date.now()) continue;

              allDeadlines.push({
                lessonId: lesson.id,
                lessonTitle: lesson.title,
                courseId: enrollment.courseId,
                courseTitle: course.title,
                sectionId: enrollment.sectionId,
                type: lesson.type as 'quiz' | 'tarea',
                dueTimestamp: dueTs,
                timeRemaining: getTimeRemaining(dueTs),
              });
            }
          }
        }

        // Sort by closest due date
        allDeadlines.sort((a, b) => a.dueTimestamp - b.dueTimestamp);
        setDeadlines(allDeadlines);
      } catch (err) {
        console.error('Error loading student deadlines:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDeadlines();
  }, [studentId]);

  return { deadlines, loading };
};