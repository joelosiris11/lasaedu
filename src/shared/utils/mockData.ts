import type { UserRole } from '@shared/types';
import { localDB } from '@shared/utils/localDB';

// Interfaces para los datos locales
export interface Course {
  id: string;
  title: string;
  description: string;
  instructor: string;
  instructorId: string;
  category: string;
  level: 'principiante' | 'intermedio' | 'avanzado';
  duration: string;
  studentsCount: number;
  status: 'borrador' | 'publicado' | 'archivado';
  createdAt: number;
  updatedAt: number;
}

export interface Evaluation {
  id: string;
  title: string;
  description: string;
  type: 'quiz' | 'tarea' | 'examen' | 'proyecto';
  courseName: string;
  courseId: string;
  instructorId: string;
  instructor: string;
  dueDate: string;
  maxScore: number;
  timeLimit: number;
  attempts: number;
  submissions: number;
  status: 'borrador' | 'activa' | 'completada' | 'cerrada';
  createdAt: string;
  updatedAt: string;
}

export interface Enrollment {
  id: string;
  studentId: string;
  courseId: string;
  progress: number;
  status: 'activo' | 'completado' | 'abandonado';
  enrolledAt: number;
  lastActivity: number;
  grade?: number;
}

export interface SystemMetric {
  id: string;
  metric: string;
  value: string;
  status: 'good' | 'warning' | 'error';
  timestamp: number;
}

export interface Activity {
  id: string;
  action: string;
  userId: string;
  userRole: UserRole;
  details: string;
  timestamp: number;
  status: 'success' | 'warning' | 'error';
}

export interface SupportTicket {
  id: string;
  subject: string;
  description: string;
  userId: string;
  userName: string;
  category: 'tecnico' | 'curso' | 'pagos' | 'general';
  priority: 'baja' | 'media' | 'alta' | 'critica';
  status: 'nuevo' | 'asignado' | 'en_progreso' | 'resuelto' | 'cerrado';
  assignedTo?: string;
  createdAt: number;
  updatedAt: number;
}

// Datos iniciales de ejemplo
const initialData = {
  courses: [
    {
      id: 'course_1',
      title: 'React Fundamentals',
      description: 'Aprende los fundamentos de React desde cero',
      instructor: 'Prof. García',
      instructorId: '2',
      category: 'Programación',
      level: 'principiante' as const,
      duration: '8 semanas',
      studentsCount: 45,
      status: 'publicado' as const,
      createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 días atrás
      updatedAt: Date.now() - 2 * 24 * 60 * 60 * 1000
    },
    {
      id: 'course_2',
      title: 'TypeScript Avanzado',
      description: 'Domina TypeScript y sus características avanzadas',
      instructor: 'Prof. Rodríguez',
      instructorId: '2',
      category: 'Programación',
      level: 'avanzado' as const,
      duration: '6 semanas',
      studentsCount: 32,
      status: 'publicado' as const,
      createdAt: Date.now() - 20 * 24 * 60 * 60 * 1000,
      updatedAt: Date.now() - 1 * 24 * 60 * 60 * 1000
    },
    {
      id: 'course_3',
      title: 'Node.js Backend',
      description: 'Desarrollo de APIs REST con Node.js',
      instructor: 'Prof. López',
      instructorId: '2',
      category: 'Backend',
      level: 'intermedio' as const,
      duration: '10 semanas',
      studentsCount: 28,
      status: 'publicado' as const,
      createdAt: Date.now() - 15 * 24 * 60 * 60 * 1000,
      updatedAt: Date.now() - 3 * 24 * 60 * 60 * 1000
    }
  ],
  enrollments: [
    {
      id: 'enroll_1',
      studentId: '3',
      courseId: 'course_1',
      progress: 85,
      status: 'activo' as const,
      enrolledAt: Date.now() - 25 * 24 * 60 * 60 * 1000,
      lastActivity: Date.now() - 2 * 60 * 60 * 1000 // 2 horas atrás
    },
    {
      id: 'enroll_2',
      studentId: '3',
      courseId: 'course_2',
      progress: 45,
      status: 'activo' as const,
      enrolledAt: Date.now() - 18 * 24 * 60 * 60 * 1000,
      lastActivity: Date.now() - 1 * 24 * 60 * 60 * 1000
    }
  ],
  systemMetrics: [
    {
      id: 'metric_1',
      metric: 'Uptime',
      value: '99.9%',
      status: 'good' as const,
      timestamp: Date.now()
    },
    {
      id: 'metric_2',
      metric: 'Response Time',
      value: '145ms',
      status: 'good' as const,
      timestamp: Date.now()
    },
    {
      id: 'metric_3',
      metric: 'Error Rate',
      value: '0.02%',
      status: 'good' as const,
      timestamp: Date.now()
    },
    {
      id: 'metric_4',
      metric: 'Active Sessions',
      value: '1,247',
      status: 'warning' as const,
      timestamp: Date.now()
    }
  ],
  activities: [
    {
      id: 'activity_1',
      action: 'Nuevo usuario registrado',
      userId: '4',
      userRole: 'student' as UserRole,
      details: 'María García se registró en la plataforma',
      timestamp: Date.now() - 2 * 60 * 1000, // 2 min atrás
      status: 'success' as const
    },
    {
      id: 'activity_2',
      action: 'Curso publicado',
      userId: '2',
      userRole: 'teacher' as UserRole,
      details: 'Prof. Rodríguez publicó TypeScript Avanzado',
      timestamp: Date.now() - 15 * 60 * 1000,
      status: 'success' as const
    },
    {
      id: 'activity_3',
      action: 'Ticket crítico abierto',
      userId: '5',
      userRole: 'student' as UserRole,
      details: 'Ana López reportó error en plataforma',
      timestamp: Date.now() - 60 * 60 * 1000, // 1h atrás
      status: 'warning' as const
    }
  ],
  supportTickets: [
    {
      id: 'ticket_1234',
      subject: 'No puedo acceder a mi curso de React',
      description: 'Cuando intento entrar al curso me aparece error 404',
      userId: '4',
      userName: 'María García',
      category: 'tecnico' as const,
      priority: 'alta' as const,
      status: 'nuevo' as const,
      createdAt: Date.now() - 5 * 60 * 1000,
      updatedAt: Date.now() - 5 * 60 * 1000
    },
    {
      id: 'ticket_1235',
      subject: 'Error al subir mi tarea final',
      description: 'La plataforma no me deja subir archivos PDF',
      userId: '6',
      userName: 'Carlos López',
      category: 'tecnico' as const,
      priority: 'critica' as const,
      status: 'en_progreso' as const,
      assignedTo: '1',
      createdAt: Date.now() - 15 * 60 * 1000,
      updatedAt: Date.now() - 5 * 60 * 1000
    }
  ],
  evaluations: [
    {
      id: 'eval_1',
      title: 'Quiz: Introducción a React',
      description: 'Evaluación de conceptos básicos de React y JSX',
      type: 'quiz' as const,
      courseName: 'React Fundamentals',
      courseId: 'course_1',
      instructorId: '2',
      instructor: 'Prof. García',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      maxScore: 20,
      timeLimit: 30,
      attempts: 2,
      submissions: 15,
      status: 'activa' as const,
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'eval_2',
      title: 'Proyecto Final: Todo App',
      description: 'Desarrollar una aplicación completa de lista de tareas usando React',
      type: 'proyecto' as const,
      courseName: 'React Fundamentals',
      courseId: 'course_1',
      instructorId: '2',
      instructor: 'Prof. García',
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      maxScore: 100,
      timeLimit: 0,
      attempts: 1,
      submissions: 8,
      status: 'activa' as const,
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'eval_3',
      title: 'Examen: TypeScript Types',
      description: 'Evaluación de tipos avanzados en TypeScript',
      type: 'examen' as const,
      courseName: 'TypeScript Avanzado',
      courseId: 'course_2',
      instructorId: '2',
      instructor: 'Prof. Rodríguez',
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      maxScore: 50,
      timeLimit: 60,
      attempts: 1,
      submissions: 12,
      status: 'activa' as const,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
    }
  ],
  channels: [
    {
      id: 'channel_1',
      name: 'general',
      description: 'Canal general para discusiones de la plataforma',
      type: 'general' as const,
      members: ['1', '2', '3', '4', '5'],
      isPrivate: false,
      createdBy: '1',
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      unreadCount: 0
    },
    {
      id: 'channel_2',
      name: 'react-fundamentals',
      description: 'Discusiones sobre el curso de React',
      type: 'course' as const,
      courseId: 'course_1',
      courseName: 'React Fundamentals',
      members: ['2', '3', '4'],
      isPrivate: false,
      createdBy: '2',
      createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
      unreadCount: 2
    },
    {
      id: 'channel_3',
      name: 'typescript-help',
      description: 'Canal de ayuda para TypeScript',
      type: 'course' as const,
      courseId: 'course_2',
      courseName: 'TypeScript Avanzado',
      members: ['2', '5'],
      isPrivate: false,
      createdBy: '2',
      createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      unreadCount: 1
    }
  ],
  messages: [
    {
      id: 'msg_1',
      channelId: 'channel_1',
      senderId: '1',
      senderName: 'Admin Usuario',
      content: '¡Bienvenidos a la plataforma LasaEdu! 🎉',
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      type: 'text' as const
    },
    {
      id: 'msg_2',
      channelId: 'channel_2',
      senderId: '2',
      senderName: 'Prof. García',
      content: 'Recuerden que mañana tenemos el quiz de React basics',
      timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      type: 'text' as const
    },
    {
      id: 'msg_3',
      channelId: 'channel_2',
      senderId: '3',
      senderName: 'Juan Pérez',
      content: 'Gracias profesor, ¿podrías enviar los recursos de repaso?',
      timestamp: new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString(),
      type: 'text' as const
    }
  ]
};

// Función para inicializar la base de datos si está vacía
export const initializeLocalDB = () => {
  // Solo inicializar si no hay datos
  if (localDB.count('courses') === 0) {
    console.log('🚀 Inicializando base de datos local con datos de ejemplo...');
    
    Object.entries(initialData).forEach(([table, data]) => {
      localDB.set(table, data);
    });
    
    console.log('✅ Base de datos local inicializada');
  }
};