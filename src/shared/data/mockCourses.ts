// Datos mock centralizados para cursos
export interface MockCourse {
  id: string;
  title: string;
  description: string;
  instructor: string;
  instructorId: string;
  category: string;
  level: 'principiante' | 'intermedio' | 'avanzado';
  duration: string;
  status: 'publicado' | 'borrador' | 'archivado';
  rating: number;
  studentsCount: number;
  createdAt?: number;
  updatedAt?: number;
  modules?: any[];
}

export const MOCK_COURSES: MockCourse[] = [
  {
    id: 'course_1',
    title: 'Introducción a Python',
    description: 'Aprende los fundamentos de programación con Python desde cero. Incluye proyectos prácticos.',
    instructor: 'Prof. García',
    instructorId: 'teacher_1',
    category: 'programacion',
    level: 'principiante',
    duration: '8 semanas',
    status: 'publicado',
    rating: 4.8,
    studentsCount: 156,
    createdAt: Date.now() - 86400000 * 30,
    updatedAt: Date.now(),
    modules: []
  },
  {
    id: 'course_2',
    title: 'Matemáticas Avanzadas',
    description: 'Cálculo diferencial e integral, álgebra lineal y estadística aplicada.',
    instructor: 'Prof. Martínez',
    instructorId: 'teacher_2',
    category: 'matematicas',
    level: 'avanzado',
    duration: '12 semanas',
    status: 'publicado',
    rating: 4.5,
    studentsCount: 89,
    createdAt: Date.now() - 86400000 * 25,
    updatedAt: Date.now(),
    modules: []
  },
  {
    id: 'course_3',
    title: 'Diseño Web con React',
    description: 'Crea aplicaciones web modernas con React, TypeScript y Tailwind CSS.',
    instructor: 'Prof. López',
    instructorId: 'teacher_3',
    category: 'programacion',
    level: 'intermedio',
    duration: '10 semanas',
    status: 'publicado',
    rating: 4.9,
    studentsCount: 234,
    createdAt: Date.now() - 86400000 * 20,
    updatedAt: Date.now(),
    modules: []
  },
  {
    id: 'course_4',
    title: 'Inglés para Negocios',
    description: 'Mejora tu inglés profesional para el mundo empresarial.',
    instructor: 'Prof. Smith',
    instructorId: 'teacher_4',
    category: 'idiomas',
    level: 'intermedio',
    duration: '6 semanas',
    status: 'publicado',
    rating: 4.7,
    studentsCount: 312,
    createdAt: Date.now() - 86400000 * 15,
    updatedAt: Date.now(),
    modules: []
  },
  {
    id: 'course_5',
    title: 'Física Mecánica',
    description: 'Fundamentos de la mecánica clásica: cinemática, dinámica y energía.',
    instructor: 'Prof. Rodríguez',
    instructorId: 'teacher_5',
    category: 'ciencias',
    level: 'principiante',
    duration: '8 semanas',
    status: 'publicado',
    rating: 4.4,
    studentsCount: 78,
    createdAt: Date.now() - 86400000 * 12,
    updatedAt: Date.now(),
    modules: []
  },
  {
    id: 'course_6',
    title: 'Marketing Digital',
    description: 'Estrategias de marketing en redes sociales, SEO y publicidad digital.',
    instructor: 'Prof. Sánchez',
    instructorId: 'teacher_6',
    category: 'negocios',
    level: 'principiante',
    duration: '4 semanas',
    status: 'publicado',
    rating: 4.6,
    studentsCount: 445,
    createdAt: Date.now() - 86400000 * 10,
    updatedAt: Date.now(),
    modules: []
  },
  {
    id: 'course_7',
    title: 'Análisis de Datos con Excel',
    description: 'Aprende a analizar datos empresariales usando funciones avanzadas de Excel.',
    instructor: 'Prof. García',
    instructorId: 'teacher_1',
    category: 'negocios',
    level: 'intermedio',
    duration: '6 semanas',
    status: 'borrador',
    rating: 0,
    studentsCount: 0,
    createdAt: Date.now() - 86400000 * 5,
    updatedAt: Date.now(),
    modules: []
  },
  {
    id: 'course_8',
    title: 'Diseño Gráfico Básico',
    description: 'Fundamentos del diseño gráfico usando herramientas profesionales.',
    instructor: 'Prof. López',
    instructorId: 'teacher_3',
    category: 'diseño',
    level: 'principiante',
    duration: '8 semanas',
    status: 'borrador',
    rating: 0,
    studentsCount: 0,
    createdAt: Date.now() - 86400000 * 3,
    updatedAt: Date.now(),
    modules: []
  }
];

// Funciones de utilidad
export const getPublishedCourses = () => MOCK_COURSES.filter(course => course.status === 'publicado');
export const getDraftCourses = () => MOCK_COURSES.filter(course => course.status === 'borrador');
export const getArchivedCourses = () => MOCK_COURSES.filter(course => course.status === 'archivado');
export const getCoursesByInstructor = (instructorId: string) => MOCK_COURSES.filter(course => course.instructorId === instructorId);