/**
 * Script para sembrar datos iniciales en Firebase Emulator
 * Ejecutar desde la consola del navegador o importar en la app
 */

import { firebaseDB } from './firebaseDataService';
import type { 
  DBUser, 
  DBCourse, 
  DBModule, 
  DBLesson, 
  DBEvaluation,
  DBBadge 
} from './firebaseDataService';

export async function seedDatabase() {
  console.log('🌱 Iniciando siembra de datos...');

  try {
    // =============================================
    // USUARIOS
    // =============================================
    const users: Omit<DBUser, 'id'>[] = [
      {
        email: 'admin@lasaedu.com',
        passwordHash: '$2a$10$hash', // En producción usar bcrypt
        name: 'Administrador',
        role: 'admin',
        emailVerified: true,
        loginAttempts: 0,
        profile: {
          avatar: '',
          bio: 'Administrador del sistema LasaEdu',
          phone: '+1234567890',
          location: 'Ciudad de México',
        },
        preferences: {
          language: 'es',
          timezone: 'America/Mexico_City',
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
        email: 'profesor@lasaedu.com',
        passwordHash: '$2a$10$hash',
        name: 'Prof. María García',
        role: 'teacher',
        emailVerified: true,
        loginAttempts: 0,
        profile: {
          avatar: '',
          bio: 'Profesora de programación con 10 años de experiencia',
          phone: '+1234567891',
          location: 'Guadalajara',
        },
        preferences: {
          language: 'es',
          timezone: 'America/Mexico_City',
          notifications: { email: true, push: true, sms: false, marketing: true },
          privacy: { showProfile: true, showProgress: true, showBadges: true }
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastActive: Date.now()
      },
      {
        email: 'estudiante@lasaedu.com',
        passwordHash: '$2a$10$hash',
        name: 'Carlos Rodríguez',
        role: 'student',
        emailVerified: true,
        loginAttempts: 0,
        profile: {
          avatar: '',
          bio: 'Estudiante de ingeniería apasionado por la tecnología',
          phone: '+1234567892',
          location: 'Monterrey',
        },
        preferences: {
          language: 'es',
          timezone: 'America/Mexico_City',
          notifications: { email: true, push: true, sms: false, marketing: false },
          privacy: { showProfile: true, showProgress: true, showBadges: true }
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastActive: Date.now()
      },
      {
        email: 'soporte@lasaedu.com',
        passwordHash: '$2a$10$hash',
        name: 'Ana Soporte',
        role: 'support',
        emailVerified: true,
        loginAttempts: 0,
        profile: {
          avatar: '',
          bio: 'Agente de soporte técnico',
          phone: '+1234567893',
          location: 'Ciudad de México',
        },
        preferences: {
          language: 'es',
          timezone: 'America/Mexico_City',
          notifications: { email: true, push: true, sms: true, marketing: false },
          privacy: { showProfile: false, showProgress: false, showBadges: false }
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastActive: Date.now()
      }
    ];

    const createdUsers: DBUser[] = [];
    for (const user of users) {
      const created = await firebaseDB.createUser(user);
      createdUsers.push(created);
      console.log(`✅ Usuario creado: ${created.name}`);
    }

    const teacherId = createdUsers.find(u => u.role === 'teacher')?.id || '';
    const studentId = createdUsers.find(u => u.role === 'student')?.id || '';

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
    // INSIGNIAS
    // =============================================
    const badges: Omit<DBBadge, 'id'>[] = [
      {
        name: 'Primer Paso',
        description: 'Completa tu primera lección',
        icon: '🎯',
        category: 'achievement',
        criteria: { type: 'lessons_completed', value: 1, description: 'Completar 1 lección' },
        points: 10,
        rarity: 'common',
        isActive: true,
        createdAt: Date.now()
      },
      {
        name: 'Estudiante Dedicado',
        description: 'Completa 10 lecciones',
        icon: '📚',
        category: 'achievement',
        criteria: { type: 'lessons_completed', value: 10, description: 'Completar 10 lecciones' },
        points: 50,
        rarity: 'uncommon',
        isActive: true,
        createdAt: Date.now()
      },
      {
        name: 'Primera Graduación',
        description: 'Completa tu primer curso',
        icon: '🎓',
        category: 'course',
        criteria: { type: 'courses_completed', value: 1, description: 'Completar 1 curso' },
        points: 100,
        rarity: 'rare',
        isActive: true,
        createdAt: Date.now()
      },
      {
        name: 'Racha de 7 días',
        description: 'Estudia 7 días consecutivos',
        icon: '🔥',
        category: 'streak',
        criteria: { type: 'streak_days', value: 7, description: 'Mantener racha de 7 días' },
        points: 70,
        rarity: 'uncommon',
        isActive: true,
        createdAt: Date.now()
      },
      {
        name: 'Maestro del Quiz',
        description: 'Obtén 100% en 5 evaluaciones',
        icon: '🏆',
        category: 'achievement',
        criteria: { type: 'perfect_quizzes', value: 5, description: 'Obtener 100% en 5 quizzes' },
        points: 150,
        rarity: 'epic',
        isActive: true,
        createdAt: Date.now()
      },
      {
        name: 'Leyenda',
        description: 'Alcanza el nivel 10',
        icon: '⭐',
        category: 'special',
        criteria: { type: 'level_reached', value: 10, description: 'Alcanzar nivel 10' },
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
    // PUNTOS INICIALES para el estudiante
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
    console.log('✅ Puntos de usuario inicializados');

    console.log('\n🎉 ¡Base de datos sembrada exitosamente!');
    console.log('\n📋 Usuarios de prueba:');
    console.log('   Admin: admin@lasaedu.com');
    console.log('   Profesor: profesor@lasaedu.com');
    console.log('   Estudiante: estudiante@lasaedu.com');
    console.log('   Soporte: soporte@lasaedu.com');
    console.log('\n   (Contraseña: cualquiera, el auth es local)');

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
