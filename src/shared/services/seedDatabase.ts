/**
 * Script para sembrar datos iniciales en Firebase Emulator
 * Ejecutar desde la consola del navegador o importar en la app
 */

import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@app/config/firebase';
import { firebaseDB } from './firebaseDataService';
import type {
  DBUser,
  DBCourse,
  DBModule,
  DBLesson,
  DBEvaluation,
  DBBadge
} from './firebaseDataService';

// Helper para crear usuario en Firebase Auth
async function createAuthUser(email: string, password: string): Promise<void> {
  try {
    await createUserWithEmailAndPassword(auth, email, password);
    console.log(`   🔐 Auth creado: ${email}`);
  } catch (error: any) {
    if (error.code === 'auth/email-already-in-use') {
      console.log(`   ⏭️ Auth ya existe: ${email}`);
    } else {
      throw error;
    }
  }
}

export async function seedDatabase() {
  console.log('🌱 Iniciando siembra de datos...');

  const DEFAULT_PASSWORD = 'password123';

  try {
    // =============================================
    // USUARIOS
    // =============================================
    const users: Omit<DBUser, 'id'>[] = [
      {
        email: 'admin@lasaedu.com',
        passwordHash: '$2a$10$hash',
        name: 'Administrador',
        role: 'admin',
        emailVerified: true,
        loginAttempts: 0,
        profile: {
          avatar: '',
          bio: 'Administrador del sistema LasaEdu',
          phone: '+18091234567',
          location: 'Santo Domingo',
        },
        preferences: {
          language: 'es',
          timezone: 'America/Santo_Domingo',
          notifications: {
            email: true,
            push: true,
            sms: false,
            marketing: false
          },
          privacy: {
            showProfile: true,
            showProgress: true,
            showBadges: true
          }
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastActive: Date.now()
      },
      {
        email: 'teacher@lasaedu.com',
        passwordHash: '$2a$10$hash',
        name: 'Prof. María García',
        role: 'teacher',
        emailVerified: true,
        loginAttempts: 0,
        profile: {
          avatar: '',
          bio: 'Profesora de programación con 10 años de experiencia',
          phone: '+18091234568',
          location: 'Santiago',
        },
        preferences: {
          language: 'es',
          timezone: 'America/Santo_Domingo',
          notifications: { email: true, push: true, sms: false, marketing: true },
          privacy: { showProfile: true, showProgress: true, showBadges: true }
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastActive: Date.now()
      },
      {
        email: 'student@lasaedu.com',
        passwordHash: '$2a$10$hash',
        name: 'Carlos Rodríguez',
        role: 'student',
        emailVerified: true,
        loginAttempts: 0,
        profile: {
          avatar: '',
          bio: 'Estudiante de ingeniería apasionado por la tecnología',
          phone: '+18091234569',
          location: 'Santo Domingo',
        },
        preferences: {
          language: 'es',
          timezone: 'America/Santo_Domingo',
          notifications: { email: true, push: true, sms: false, marketing: false },
          privacy: { showProfile: true, showProgress: true, showBadges: true }
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastActive: Date.now()
      },
      {
        email: 'support@lasaedu.com',
        passwordHash: '$2a$10$hash',
        name: 'Ana Soporte',
        role: 'support',
        emailVerified: true,
        loginAttempts: 0,
        profile: {
          avatar: '',
          bio: 'Agente de soporte técnico',
          phone: '+18091234570',
          location: 'Santo Domingo',
        },
        preferences: {
          language: 'es',
          timezone: 'America/Santo_Domingo',
          notifications: { email: true, push: true, sms: true, marketing: false },
          privacy: { showProfile: false, showProgress: false, showBadges: false }
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastActive: Date.now()
      },
      {
        email: 'laura@lasaedu.com',
        passwordHash: '$2a$10$hash',
        name: 'Laura Mendoza',
        role: 'student',
        emailVerified: true,
        loginAttempts: 0,
        profile: {
          avatar: '',
          bio: 'Diseñadora gráfica aprendiendo programación',
          phone: '+18091234571',
          location: 'Santiago',
        },
        preferences: {
          language: 'es',
          timezone: 'America/Santo_Domingo',
          notifications: { email: true, push: false, sms: false, marketing: true },
          privacy: { showProfile: true, showProgress: true, showBadges: true }
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastActive: Date.now()
      },
      {
        email: 'pedro@lasaedu.com',
        passwordHash: '$2a$10$hash',
        name: 'Pedro Sánchez',
        role: 'student',
        emailVerified: true,
        loginAttempts: 0,
        profile: {
          avatar: '',
          bio: 'Contador aprendiendo análisis de datos',
          phone: '+18091234572',
          location: 'Santo Domingo',
        },
        preferences: {
          language: 'es',
          timezone: 'America/Santo_Domingo',
          notifications: { email: true, push: true, sms: false, marketing: false },
          privacy: { showProfile: true, showProgress: true, showBadges: true }
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastActive: Date.now()
      }
    ];

    const createdUsers: DBUser[] = [];
    for (const user of users) {
      // Crear usuario en Firebase Auth primero
      await createAuthUser(user.email, DEFAULT_PASSWORD);

      const created = await firebaseDB.createUser(user);
      createdUsers.push(created);
      console.log(`✅ Usuario creado: ${created.name}`);
    }

    const teacherId = createdUsers.find(u => u.role === 'teacher')?.id || '';
    const students = createdUsers.filter(u => u.role === 'student');
    const studentId = students[0]?.id || '';
    const student2Id = students[1]?.id || '';
    const student3Id = students[2]?.id || '';

    // =============================================
    // CURSOS
    // =============================================
    const courses: Omit<DBCourse, 'id'>[] = [
      {
        title: 'Introducción a Python',
        description: 'Aprende los fundamentos de programación con Python desde cero. Este curso te guiará a través de variables, estructuras de control, funciones y más.',
        instructor: 'Prof. María García',
        instructorId: teacherId,
        category: 'programacion',
        level: 'principiante',
        duration: '8 semanas',
        status: 'publicado',
        rating: 4.8,
        studentsCount: 156,
        tags: ['python', 'programación', 'principiante'],
        requirements: ['Computadora con internet', 'Ganas de aprender'],
        objectives: ['Entender los fundamentos de Python', 'Crear programas simples', 'Manejar estructuras de datos'],
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        title: 'Desarrollo Web con React',
        description: 'Crea aplicaciones web modernas con React, TypeScript y las mejores prácticas de la industria.',
        instructor: 'Prof. María García',
        instructorId: teacherId,
        category: 'programacion',
        level: 'intermedio',
        duration: '10 semanas',
        status: 'publicado',
        rating: 4.9,
        studentsCount: 234,
        tags: ['react', 'javascript', 'web'],
        requirements: ['Conocimientos básicos de JavaScript', 'HTML y CSS'],
        objectives: ['Dominar React Hooks', 'Crear componentes reutilizables', 'Manejar estado global'],
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        title: 'Base de Datos con SQL',
        description: 'Domina SQL y aprende a diseñar, consultar y optimizar bases de datos relacionales.',
        instructor: 'Prof. María García',
        instructorId: teacherId,
        category: 'programacion',
        level: 'intermedio',
        duration: '6 semanas',
        status: 'publicado',
        rating: 4.7,
        studentsCount: 189,
        tags: ['sql', 'bases de datos', 'backend'],
        requirements: ['Conocimientos básicos de programación'],
        objectives: ['Escribir consultas SQL complejas', 'Diseñar esquemas de BD', 'Optimizar rendimiento'],
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        title: 'Machine Learning Básico',
        description: 'Introducción al aprendizaje automático con Python, scikit-learn y TensorFlow.',
        instructor: 'Prof. María García',
        instructorId: teacherId,
        category: 'ciencia_datos',
        level: 'avanzado',
        duration: '12 semanas',
        status: 'borrador',
        rating: 0,
        studentsCount: 0,
        tags: ['machine learning', 'python', 'IA'],
        requirements: ['Python intermedio', 'Matemáticas básicas', 'Estadística'],
        objectives: ['Entender algoritmos de ML', 'Implementar modelos', 'Evaluar rendimiento'],
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    ];

    const createdCourses: DBCourse[] = [];
    for (const course of courses) {
      const created = await firebaseDB.createCourse(course);
      createdCourses.push(created);
      console.log(`✅ Curso creado: ${created.title}`);
    }

    // =============================================
    // MÓDULOS Y LECCIONES para el primer curso
    // =============================================
    const pythonCourse = createdCourses[0];
    
    const modules: { module: Omit<DBModule, 'id'>, lessons: Omit<DBLesson, 'id'>[] }[] = [
      {
        module: {
          courseId: pythonCourse.id,
          title: 'Fundamentos de Python',
          description: 'Introducción al lenguaje y configuración del entorno',
          order: 1,
          duration: '2 horas',
          status: 'publicado',
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        lessons: [
          {
            moduleId: '', // Se asignará después
            courseId: pythonCourse.id,
            title: 'Instalación de Python',
            description: 'Cómo instalar Python en tu computadora',
            type: 'video',
            content: 'En esta lección aprenderás a instalar Python...',
            videoUrl: 'https://example.com/video1',
            duration: '15 min',
            order: 1,
            status: 'publicado',
            createdAt: Date.now(),
            updatedAt: Date.now()
          },
          {
            moduleId: '',
            courseId: pythonCourse.id,
            title: 'Tu primer programa',
            description: 'Escribe tu primer "Hola Mundo" en Python',
            type: 'texto',
            content: '# Tu primer programa\n\nPara crear tu primer programa en Python...',
            duration: '20 min',
            order: 2,
            status: 'publicado',
            createdAt: Date.now(),
            updatedAt: Date.now()
          },
          {
            moduleId: '',
            courseId: pythonCourse.id,
            title: 'Quiz: Fundamentos',
            description: 'Evalúa tu conocimiento de los fundamentos',
            type: 'quiz',
            content: '',
            duration: '10 min',
            order: 3,
            status: 'publicado',
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        ]
      },
      {
        module: {
          courseId: pythonCourse.id,
          title: 'Variables y Tipos de Datos',
          description: 'Aprende sobre variables, strings, números y booleanos',
          order: 2,
          duration: '3 horas',
          status: 'publicado',
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        lessons: [
          {
            moduleId: '',
            courseId: pythonCourse.id,
            title: 'Variables en Python',
            description: 'Cómo declarar y usar variables',
            type: 'video',
            content: 'Las variables son contenedores de información...',
            videoUrl: 'https://example.com/video2',
            duration: '25 min',
            order: 1,
            status: 'publicado',
            createdAt: Date.now(),
            updatedAt: Date.now()
          },
          {
            moduleId: '',
            courseId: pythonCourse.id,
            title: 'Tipos de datos',
            description: 'Strings, integers, floats y booleans',
            type: 'texto',
            content: '# Tipos de datos en Python\n\nPython tiene varios tipos de datos...',
            duration: '30 min',
            order: 2,
            status: 'publicado',
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        ]
      },
      {
        module: {
          courseId: pythonCourse.id,
          title: 'Estructuras de Control',
          description: 'Condicionales y bucles',
          order: 3,
          duration: '4 horas',
          status: 'publicado',
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        lessons: [
          {
            moduleId: '',
            courseId: pythonCourse.id,
            title: 'Condicionales if/else',
            description: 'Toma decisiones en tu código',
            type: 'video',
            content: 'Los condicionales permiten ejecutar código basado en condiciones...',
            videoUrl: 'https://example.com/video3',
            duration: '30 min',
            order: 1,
            status: 'publicado',
            createdAt: Date.now(),
            updatedAt: Date.now()
          },
          {
            moduleId: '',
            courseId: pythonCourse.id,
            title: 'Bucles for y while',
            description: 'Repite acciones con bucles',
            type: 'video',
            content: 'Los bucles permiten repetir código...',
            videoUrl: 'https://example.com/video4',
            duration: '35 min',
            order: 2,
            status: 'publicado',
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        ]
      }
    ];

    for (const { module, lessons } of modules) {
      const createdModule = await firebaseDB.createModule(module);
      console.log(`✅ Módulo creado: ${createdModule.title}`);
      
      for (const lesson of lessons) {
        lesson.moduleId = createdModule.id;
        const createdLesson = await firebaseDB.createLesson(lesson);
        console.log(`   📚 Lección: ${createdLesson.title}`);
      }
    }

    // =============================================
    // INSCRIPCIÓN del estudiante
    // =============================================
    await firebaseDB.createEnrollment({
      courseId: pythonCourse.id,
      userId: studentId,
      enrolledAt: new Date().toISOString(),
      progress: 35,
      status: 'active',
      completedLessons: ['lesson1', 'lesson2'],
      completedModules: [],
      totalTimeSpent: 120,
      lastAccessedAt: new Date().toISOString(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    console.log('✅ Inscripción creada');

    // =============================================
    // EVALUACIONES
    // =============================================
    const evaluation: Omit<DBEvaluation, 'id'> = {
      courseId: pythonCourse.id,
      title: 'Examen: Fundamentos de Python',
      description: 'Evalúa tu conocimiento de los fundamentos de Python',
      type: 'quiz',
      questions: [
        {
          id: 'q1',
          type: 'multiple_choice',
          question: '¿Cuál es la forma correcta de declarar una variable en Python?',
          options: ['var x = 5', 'int x = 5', 'x = 5', 'let x = 5'],
          correctAnswer: 'x = 5',
          points: 10,
          explanation: 'En Python, las variables se declaran simplemente asignando un valor.'
        },
        {
          id: 'q2',
          type: 'true_false',
          question: 'Python es un lenguaje de programación interpretado.',
          options: ['Verdadero', 'Falso'],
          correctAnswer: 'Verdadero',
          points: 10,
          explanation: 'Python es un lenguaje interpretado, no compilado.'
        },
        {
          id: 'q3',
          type: 'multiple_choice',
          question: '¿Qué función se usa para imprimir en consola?',
          options: ['console.log()', 'print()', 'echo()', 'write()'],
          correctAnswer: 'print()',
          points: 10,
          explanation: 'La función print() se usa para mostrar output en Python.'
        }
      ],
      settings: {
        timeLimit: 30,
        attempts: 3,
        passingScore: 70,
        shuffleQuestions: true,
        shuffleOptions: true,
        showResults: true,
        showCorrectAnswers: true
      },
      status: 'publicado',
      createdBy: teacherId,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await firebaseDB.createEvaluation(evaluation);
    console.log('✅ Evaluación creada');

    // =============================================
    // INSIGNIAS (coinciden con BADGES en GamificationPage)
    // =============================================
    const badges: Omit<DBBadge, 'id'>[] = [
      {
        name: 'Primer Paso',
        description: 'Completar tu primer curso',
        icon: '🎯',
        category: 'course',
        criteria: { type: 'courses_completed', value: 1, description: 'Completar 1 curso' },
        points: 50,
        rarity: 'common',
        isActive: true,
        createdAt: Date.now()
      },
      {
        name: 'Estudiante Dedicado',
        description: 'Completar 5 cursos',
        icon: '📚',
        category: 'course',
        criteria: { type: 'courses_completed', value: 5, description: 'Completar 5 cursos' },
        points: 150,
        rarity: 'rare',
        isActive: true,
        createdAt: Date.now()
      },
      {
        name: 'Perfeccionista',
        description: 'Obtener 100% en una evaluación',
        icon: '💯',
        category: 'achievement',
        criteria: { type: 'perfect_score', value: 1, description: '100% en evaluación' },
        points: 100,
        rarity: 'epic',
        isActive: true,
        createdAt: Date.now()
      },
      {
        name: 'Constante',
        description: 'Mantener una racha de 7 días',
        icon: '🔥',
        category: 'streak',
        criteria: { type: 'streak_days', value: 7, description: 'Racha de 7 días' },
        points: 70,
        rarity: 'rare',
        isActive: true,
        createdAt: Date.now()
      },
      {
        name: 'Imparable',
        description: 'Mantener una racha de 30 días',
        icon: '⚡',
        category: 'streak',
        criteria: { type: 'streak_days', value: 30, description: 'Racha de 30 días' },
        points: 300,
        rarity: 'legendary',
        isActive: true,
        createdAt: Date.now()
      },
      {
        name: 'Madrugador',
        description: 'Completar una lección antes de las 7am',
        icon: '🌅',
        category: 'special',
        criteria: { type: 'early_lesson', value: 7, description: 'Lección antes de 7am' },
        points: 30,
        rarity: 'common',
        isActive: true,
        createdAt: Date.now()
      },
      {
        name: 'Búho Nocturno',
        description: 'Completar una lección después de las 11pm',
        icon: '🦉',
        category: 'special',
        criteria: { type: 'night_lesson', value: 23, description: 'Lección después de 11pm' },
        points: 30,
        rarity: 'common',
        isActive: true,
        createdAt: Date.now()
      },
      {
        name: 'Ayudante',
        description: 'Responder 10 preguntas en foros',
        icon: '🤝',
        category: 'social',
        criteria: { type: 'forum_replies', value: 10, description: '10 respuestas en foros' },
        points: 80,
        rarity: 'rare',
        isActive: true,
        createdAt: Date.now()
      },
      {
        name: 'Maestro del Quiz',
        description: 'Completar 20 quizzes',
        icon: '🧠',
        category: 'achievement',
        criteria: { type: 'quizzes_completed', value: 20, description: 'Completar 20 quizzes' },
        points: 200,
        rarity: 'epic',
        isActive: true,
        createdAt: Date.now()
      },
      {
        name: 'Campeón',
        description: 'Alcanzar el top 3 del leaderboard',
        icon: '👑',
        category: 'special',
        criteria: { type: 'leaderboard_top', value: 3, description: 'Top 3 leaderboard' },
        points: 500,
        rarity: 'legendary',
        isActive: true,
        createdAt: Date.now()
      }
    ];

    for (const badge of badges) {
      await firebaseDB.create('badges', badge);
    }
    console.log('✅ Insignias creadas');

    // =============================================
    // PUNTOS INICIALES para los estudiantes (leaderboard)
    // =============================================
    await firebaseDB.create('userPoints', {
      userId: studentId,
      totalPoints: 175,
      level: 2,
      levelName: 'Aprendiz',
      nextLevelPoints: 300,
      history: [
        { id: 'h1', action: 'enrollment', points: 50, description: 'Inscripción en curso', timestamp: new Date().toISOString() },
        { id: 'h2', action: 'lesson_complete', points: 25, description: 'Lección completada', timestamp: new Date().toISOString() },
        { id: 'h3', action: 'lesson_complete', points: 25, description: 'Lección completada', timestamp: new Date().toISOString() },
        { id: 'h4', action: 'streak_bonus', points: 75, description: 'Bonus racha 3 días', timestamp: new Date().toISOString() }
      ]
    });

    // Puntos para Laura (segundo lugar en leaderboard)
    await firebaseDB.create('userPoints', {
      userId: student2Id,
      totalPoints: 320,
      level: 3,
      levelName: 'Estudiante',
      nextLevelPoints: 600,
      history: [
        { id: 'h1', action: 'enrollment', points: 50, description: 'Inscripción en curso', timestamp: new Date().toISOString() },
        { id: 'h2', action: 'course_complete', points: 150, description: 'Curso completado', timestamp: new Date().toISOString() },
        { id: 'h3', action: 'streak_bonus', points: 120, description: 'Bonus racha 7 días', timestamp: new Date().toISOString() }
      ]
    });

    // Puntos para Pedro (tercer lugar en leaderboard)
    await firebaseDB.create('userPoints', {
      userId: student3Id,
      totalPoints: 85,
      level: 1,
      levelName: 'Novato',
      nextLevelPoints: 100,
      history: [
        { id: 'h1', action: 'enrollment', points: 50, description: 'Inscripción en curso', timestamp: new Date().toISOString() },
        { id: 'h2', action: 'lesson_complete', points: 35, description: 'Lecciones completadas', timestamp: new Date().toISOString() }
      ]
    });
    console.log('✅ Puntos de usuarios inicializados');

    // =============================================
    // INSCRIPCIONES adicionales
    // =============================================
    const reactCourse = createdCourses[1];

    // Laura inscrita en Python (completado) y React
    await firebaseDB.createEnrollment({
      courseId: pythonCourse.id,
      userId: student2Id,
      enrolledAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      progress: 100,
      status: 'completed',
      completedLessons: ['lesson1', 'lesson2', 'lesson3', 'lesson4', 'lesson5'],
      completedModules: ['module1', 'module2', 'module3'],
      totalTimeSpent: 480,
      lastAccessedAt: new Date().toISOString(),
      createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
      updatedAt: Date.now()
    });

    await firebaseDB.createEnrollment({
      courseId: reactCourse.id,
      userId: student2Id,
      enrolledAt: new Date().toISOString(),
      progress: 15,
      status: 'active',
      completedLessons: [],
      completedModules: [],
      totalTimeSpent: 30,
      lastAccessedAt: new Date().toISOString(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    // Pedro inscrito en Python
    await firebaseDB.createEnrollment({
      courseId: pythonCourse.id,
      userId: student3Id,
      enrolledAt: new Date().toISOString(),
      progress: 10,
      status: 'active',
      completedLessons: ['lesson1'],
      completedModules: [],
      totalTimeSpent: 45,
      lastAccessedAt: new Date().toISOString(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    console.log('✅ Inscripciones adicionales creadas');

    // =============================================
    // ACTIVIDADES de estudiantes
    // =============================================
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    const activities = [
      { userId: studentId, type: 'lesson_view', details: { lessonId: 'l1', title: 'Instalación de Python' }, timestamp: new Date(now - 2 * dayMs).toISOString() },
      { userId: studentId, type: 'lesson_complete', details: { lessonId: 'l1', title: 'Instalación de Python' }, timestamp: new Date(now - 2 * dayMs).toISOString() },
      { userId: studentId, type: 'lesson_view', details: { lessonId: 'l2', title: 'Tu primer programa' }, timestamp: new Date(now - 1 * dayMs).toISOString() },
      { userId: studentId, type: 'lesson_complete', details: { lessonId: 'l2', title: 'Tu primer programa' }, timestamp: new Date(now - 1 * dayMs).toISOString() },
      { userId: studentId, type: 'login', details: {}, timestamp: new Date(now).toISOString() },
      { userId: student2Id, type: 'course_complete', details: { courseId: pythonCourse.id, title: 'Introducción a Python' }, timestamp: new Date(now - 5 * dayMs).toISOString() },
      { userId: student2Id, type: 'enrollment', details: { courseId: reactCourse.id, title: 'Desarrollo Web con React' }, timestamp: new Date(now).toISOString() },
      { userId: student3Id, type: 'enrollment', details: { courseId: pythonCourse.id, title: 'Introducción a Python' }, timestamp: new Date(now - 1 * dayMs).toISOString() },
      { userId: student3Id, type: 'lesson_complete', details: { lessonId: 'l1', title: 'Instalación de Python' }, timestamp: new Date(now).toISOString() }
    ];

    for (const activity of activities) {
      await firebaseDB.create('activities', activity);
    }
    console.log('✅ Actividades de estudiantes creadas');

    // =============================================
    // CONVERSACIÓN de ejemplo
    // =============================================
    const conversation = await firebaseDB.create('conversations', {
      type: 'direct',
      participants: [studentId, teacherId],
      createdAt: Date.now() - 3 * dayMs,
      updatedAt: Date.now()
    });

    await firebaseDB.create('messages', {
      conversationId: conversation.id,
      senderId: studentId,
      content: 'Hola profesora, tengo una duda sobre el ejercicio de variables.',
      type: 'text',
      readBy: [studentId, teacherId],
      createdAt: Date.now() - 3 * dayMs
    });

    await firebaseDB.create('messages', {
      conversationId: conversation.id,
      senderId: teacherId,
      content: 'Claro Carlos, dime cuál es tu duda específica.',
      type: 'text',
      readBy: [teacherId],
      createdAt: Date.now() - 3 * dayMs + 60000
    });

    await firebaseDB.create('messages', {
      conversationId: conversation.id,
      senderId: studentId,
      content: 'No entiendo por qué Python no requiere declarar el tipo de variable.',
      type: 'text',
      readBy: [studentId],
      createdAt: Date.now() - 2 * dayMs
    });

    await firebaseDB.create('messages', {
      conversationId: conversation.id,
      senderId: teacherId,
      content: 'Python es un lenguaje de tipado dinámico, esto significa que el tipo se infiere automáticamente del valor asignado. Por ejemplo, x = 5 crea un entero, y x = "hola" crea un string.',
      type: 'text',
      readBy: [teacherId],
      createdAt: Date.now() - 2 * dayMs + 120000
    });
    console.log('✅ Conversación de ejemplo creada');

    // =============================================
    // POST DE FORO
    // =============================================
    const forumPost = await firebaseDB.create('forumPosts', {
      courseId: pythonCourse.id,
      authorId: studentId,
      authorName: 'Carlos Rodríguez',
      title: 'Ayuda con bucles while',
      content: 'Estoy intentando hacer un bucle while que cuente del 1 al 10 pero no sé cómo evitar un bucle infinito. ¿Alguien puede ayudarme?',
      tags: ['python', 'bucles', 'principiante'],
      likes: 3,
      views: 15,
      isPinned: false,
      isLocked: false,
      createdAt: Date.now() - 1 * dayMs,
      updatedAt: Date.now() - 1 * dayMs
    });

    await firebaseDB.create('forumReplies', {
      postId: forumPost.id,
      authorId: student2Id,
      authorName: 'Laura Mendoza',
      content: 'Necesitas una variable contador y asegurarte de incrementarla dentro del bucle. Por ejemplo:\n\ni = 1\nwhile i <= 10:\n    print(i)\n    i += 1',
      likes: 5,
      isAccepted: true,
      createdAt: Date.now() - 1 * dayMs + 3600000,
      updatedAt: Date.now() - 1 * dayMs + 3600000
    });

    await firebaseDB.create('forumReplies', {
      postId: forumPost.id,
      authorId: teacherId,
      authorName: 'Prof. María García',
      content: 'Excelente respuesta Laura! Carlos, recuerda que siempre debes tener una condición de salida clara y modificar la variable de control dentro del bucle.',
      likes: 2,
      isAccepted: false,
      createdAt: Date.now() - 1 * dayMs + 7200000,
      updatedAt: Date.now() - 1 * dayMs + 7200000
    });
    console.log('✅ Post de foro creado');

    // =============================================
    // INSIGNIA DESBLOQUEADA para estudiante
    // =============================================
    await firebaseDB.create('userBadges', {
      userId: student2Id,
      badgeId: 'first_course',
      earnedAt: new Date(now - 5 * dayMs).toISOString(),
      notified: true
    });
    console.log('✅ Insignia desbloqueada creada');

    console.log('\n🎉 ¡Base de datos sembrada exitosamente!');
    console.log('\n📋 Usuarios de prueba:');
    console.log('   Admin: admin@lasaedu.com');
    console.log('   Teacher: teacher@lasaedu.com');
    console.log('   Student: student@lasaedu.com');
    console.log('   Support: support@lasaedu.com');
    console.log(`\n   🔑 Contraseña para todos: ${DEFAULT_PASSWORD}`);

  } catch (error) {
    console.error('❌ Error sembrando base de datos:', error);
    throw error;
  }
}

// Exportar para uso desde consola
if (typeof window !== 'undefined') {
  (window as any).seedDatabase = seedDatabase;
}

export default seedDatabase;
