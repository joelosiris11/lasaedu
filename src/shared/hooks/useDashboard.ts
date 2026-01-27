import { useState, useEffect } from 'react';
import { dashboardService } from '@shared/services/dataService';
import type { DBActivity, DBSupportTicket } from '@shared/services/dataService';

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

// Hook para cursos del estudiante
export const useStudentCourses = (studentId: string) => {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        setLoading(true);
        const data = await dashboardService.getStudentCourses(studentId);
        setCourses(data);
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