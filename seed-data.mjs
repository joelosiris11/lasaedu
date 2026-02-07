import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set } from 'firebase/database';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signOut } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "demo-api-key",
  authDomain: "demo-project.firebaseapp.com",
  databaseURL: "http://127.0.0.1:9000/?ns=demo-project-default-rtdb",
  projectId: "demo-project",
  storageBucket: "demo-project.appspot.com"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });

async function seedData() {
  console.log('Sembrando datos en Firebase Emulator...');
  const timestamp = Date.now();

  // Create users in Firebase Auth first
  const authUsers = [
    { email: 'admin@lasaedu.com', password: 'password123' },
    { email: 'profesor@lasaedu.com', password: 'password123' },
    { email: 'estudiante@lasaedu.com', password: 'password123' },
    { email: 'ana@lasaedu.com', password: 'password123' },
    { email: 'soporte@lasaedu.com', password: 'password123' }
  ];

  for (const u of authUsers) {
    try {
      await createUserWithEmailAndPassword(auth, u.email, u.password);
      await signOut(auth);
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') {
        console.log(`  Auth: ${u.email} ya existe, saltando...`);
      } else {
        console.error(`  Auth error for ${u.email}:`, e.message);
      }
    }
  }
  console.log('Usuarios Auth creados (5)');

  const users = {
    admin_1: { id: 'admin_1', email: 'admin@lasaedu.com', name: 'Administrador', role: 'admin', emailVerified: true, createdAt: timestamp, updatedAt: timestamp },
    teacher_1: { id: 'teacher_1', email: 'profesor@lasaedu.com', name: 'Prof. Maria Garcia', role: 'teacher', emailVerified: true, createdAt: timestamp, updatedAt: timestamp },
    student_1: { id: 'student_1', email: 'estudiante@lasaedu.com', name: 'Carlos Rodriguez', role: 'student', emailVerified: true, createdAt: timestamp, updatedAt: timestamp },
    student_2: { id: 'student_2', email: 'ana@lasaedu.com', name: 'Ana Lopez', role: 'student', emailVerified: true, createdAt: timestamp, updatedAt: timestamp },
    support_1: { id: 'support_1', email: 'soporte@lasaedu.com', name: 'Ana Soporte', role: 'support', emailVerified: true, createdAt: timestamp, updatedAt: timestamp }
  };
  await set(ref(db, 'users'), users);
  console.log('Usuarios DB creados (5)');

  const courses = {
    course_1: { id: 'course_1', title: 'Introduccion a Python', description: 'Aprende Python desde cero', instructor: 'Prof. Maria Garcia', instructorId: 'teacher_1', category: 'programacion', level: 'principiante', duration: '8 semanas', status: 'publicado', rating: 4.8, studentsCount: 156, createdAt: timestamp, updatedAt: timestamp },
    course_2: { id: 'course_2', title: 'Desarrollo Web con React', description: 'Crea apps web modernas', instructor: 'Prof. Maria Garcia', instructorId: 'teacher_1', category: 'programacion', level: 'intermedio', duration: '10 semanas', status: 'publicado', rating: 4.9, studentsCount: 234, createdAt: timestamp, updatedAt: timestamp },
    course_3: { id: 'course_3', title: 'Base de Datos con SQL', description: 'Domina SQL y bases de datos', instructor: 'Prof. Maria Garcia', instructorId: 'teacher_1', category: 'programacion', level: 'intermedio', duration: '6 semanas', status: 'publicado', rating: 4.7, studentsCount: 189, createdAt: timestamp, updatedAt: timestamp },
    course_4: { id: 'course_4', title: 'Machine Learning con Python', description: 'Introduccion al ML', instructor: 'Prof. Maria Garcia', instructorId: 'teacher_1', category: 'ciencia_datos', level: 'avanzado', duration: '12 semanas', status: 'borrador', rating: 0, studentsCount: 0, createdAt: timestamp, updatedAt: timestamp },
    course_5: { id: 'course_5', title: 'Ingles para Negocios', description: 'Mejora tu ingles profesional', instructor: 'Prof. Maria Garcia', instructorId: 'teacher_1', category: 'idiomas', level: 'intermedio', duration: '6 semanas', status: 'publicado', rating: 4.7, studentsCount: 312, createdAt: timestamp, updatedAt: timestamp }
  };
  await set(ref(db, 'courses'), courses);
  console.log('Cursos creados (5)');

  const modules = {
    module_1: { id: 'module_1', courseId: 'course_1', title: 'Fundamentos de Python', description: 'Introduccion y configuracion', order: 1, duration: '2 horas', status: 'publicado', createdAt: timestamp, updatedAt: timestamp },
    module_2: { id: 'module_2', courseId: 'course_1', title: 'Variables y Tipos de Datos', description: 'Strings numeros y booleanos', order: 2, duration: '3 horas', status: 'publicado', createdAt: timestamp, updatedAt: timestamp },
    module_3: { id: 'module_3', courseId: 'course_1', title: 'Estructuras de Control', description: 'Condicionales y bucles', order: 3, duration: '4 horas', status: 'publicado', createdAt: timestamp, updatedAt: timestamp },
    module_4: { id: 'module_4', courseId: 'course_2', title: 'Intro a React', description: 'Conceptos basicos', order: 1, duration: '2 horas', status: 'publicado', createdAt: timestamp, updatedAt: timestamp }
  };
  await set(ref(db, 'modules'), modules);
  console.log('Modulos creados (4)');

  const lessons = {
    lesson_1: { id: 'lesson_1', moduleId: 'module_1', courseId: 'course_1', title: 'Instalacion de Python', type: 'video', duration: '15 min', order: 1, status: 'publicado', createdAt: timestamp, updatedAt: timestamp },
    lesson_2: { id: 'lesson_2', moduleId: 'module_1', courseId: 'course_1', title: 'Tu primer programa', type: 'texto', duration: '20 min', order: 2, status: 'publicado', createdAt: timestamp, updatedAt: timestamp },
    lesson_3: { id: 'lesson_3', moduleId: 'module_2', courseId: 'course_1', title: 'Variables en Python', type: 'video', duration: '25 min', order: 1, status: 'publicado', createdAt: timestamp, updatedAt: timestamp },
    lesson_4: { id: 'lesson_4', moduleId: 'module_2', courseId: 'course_1', title: 'Tipos de datos', type: 'texto', duration: '30 min', order: 2, status: 'publicado', createdAt: timestamp, updatedAt: timestamp },
    lesson_5: { id: 'lesson_5', moduleId: 'module_3', courseId: 'course_1', title: 'Condicionales if else', type: 'video', duration: '30 min', order: 1, status: 'publicado', createdAt: timestamp, updatedAt: timestamp },
    lesson_6: { id: 'lesson_6', moduleId: 'module_4', courseId: 'course_2', title: 'Que es React', type: 'video', duration: '20 min', order: 1, status: 'publicado', createdAt: timestamp, updatedAt: timestamp }
  };
  await set(ref(db, 'lessons'), lessons);
  console.log('Lecciones creadas (6)');

  const enrollments = {
    enroll_1: { id: 'enroll_1', courseId: 'course_1', userId: 'student_1', progress: 65, status: 'active', completedLessons: ['lesson_1', 'lesson_2', 'lesson_3'], createdAt: timestamp, updatedAt: timestamp },
    enroll_2: { id: 'enroll_2', courseId: 'course_2', userId: 'student_1', progress: 25, status: 'active', completedLessons: ['lesson_6'], createdAt: timestamp, updatedAt: timestamp },
    enroll_3: { id: 'enroll_3', courseId: 'course_1', userId: 'student_2', progress: 100, status: 'completed', completedLessons: ['lesson_1', 'lesson_2', 'lesson_3', 'lesson_4', 'lesson_5'], grade: 92, createdAt: timestamp, updatedAt: timestamp },
    enroll_4: { id: 'enroll_4', courseId: 'course_3', userId: 'student_2', progress: 40, status: 'active', completedLessons: [], createdAt: timestamp, updatedAt: timestamp }
  };
  await set(ref(db, 'enrollments'), enrollments);
  console.log('Inscripciones creadas (4)');

  const evaluations = {
    eval_1: { id: 'eval_1', courseId: 'course_1', moduleId: 'module_1', title: 'Quiz Fundamentos de Python', type: 'quiz', questions: [{ id: 'q1', type: 'multiple_choice', question: 'Como declarar variable', options: ['var x = 5', 'x = 5', 'int x = 5'], correctAnswer: 'x = 5', points: 10 }], status: 'publicado', createdBy: 'teacher_1', createdAt: timestamp, updatedAt: timestamp },
    eval_2: { id: 'eval_2', courseId: 'course_1', title: 'Examen Final Python', type: 'examen', questions: [{ id: 'q1', type: 'multiple_choice', question: 'Estructura para iterar', options: ['if', 'for', 'def'], correctAnswer: 'for', points: 20 }], status: 'publicado', createdBy: 'teacher_1', createdAt: timestamp, updatedAt: timestamp }
  };
  await set(ref(db, 'evaluations'), evaluations);
  console.log('Evaluaciones creadas (2)');

  const grades = {
    grade_1: { id: 'grade_1', courseId: 'course_1', evaluationId: 'eval_1', studentId: 'student_1', teacherId: 'teacher_1', score: 30, maxScore: 30, percentage: 100, feedback: 'Excelente', status: 'graded', createdAt: timestamp, updatedAt: timestamp },
    grade_2: { id: 'grade_2', courseId: 'course_1', evaluationId: 'eval_1', studentId: 'student_2', teacherId: 'teacher_1', score: 20, maxScore: 30, percentage: 67, feedback: 'Buen intento', status: 'graded', createdAt: timestamp, updatedAt: timestamp }
  };
  await set(ref(db, 'grades'), grades);
  console.log('Calificaciones creadas (2)');

  const certificates = {
    cert_1: { id: 'cert_1', courseId: 'course_1', userId: 'student_2', courseName: 'Introduccion a Python', studentName: 'Ana Lopez', instructorName: 'Prof. Maria Garcia', grade: 92, credentialId: 'LASA-PY-2026-001', status: 'generated', createdAt: timestamp, updatedAt: timestamp }
  };
  await set(ref(db, 'certificates'), certificates);
  console.log('Certificados creados (1)');

  const conversations = {
    conv_1: { id: 'conv_1', type: 'direct', participants: ['student_1', 'teacher_1'], lastMessage: { content: 'Gracias profesora', senderId: 'student_1', timestamp: timestamp }, createdAt: timestamp, updatedAt: timestamp },
    conv_2: { id: 'conv_2', type: 'course', name: 'Foro Intro a Python', courseId: 'course_1', participants: ['teacher_1', 'student_1', 'student_2'], lastMessage: { content: 'Recuerden el proyecto', senderId: 'teacher_1', timestamp: timestamp }, createdAt: timestamp, updatedAt: timestamp }
  };
  await set(ref(db, 'conversations'), conversations);
  console.log('Conversaciones creadas (2)');

  const messages = {
    msg_1: { id: 'msg_1', conversationId: 'conv_1', senderId: 'student_1', senderName: 'Carlos Rodriguez', content: 'Hola profesora tengo una duda', type: 'text', createdAt: timestamp - 3600000, updatedAt: timestamp - 3600000 },
    msg_2: { id: 'msg_2', conversationId: 'conv_1', senderId: 'teacher_1', senderName: 'Prof. Maria Garcia', content: 'Hola Carlos cual es tu duda', type: 'text', createdAt: timestamp - 3000000, updatedAt: timestamp - 3000000 },
    msg_3: { id: 'msg_3', conversationId: 'conv_1', senderId: 'student_1', senderName: 'Carlos Rodriguez', content: 'Gracias profesora', type: 'text', createdAt: timestamp, updatedAt: timestamp }
  };
  await set(ref(db, 'messages'), messages);
  console.log('Mensajes creados (3)');

  const notifications = {
    notif_1: { id: 'notif_1', userId: 'student_1', type: 'grade', title: 'Nueva calificacion', message: 'Recibiste calificacion en Quiz Python', link: '/grades', read: false, createdAt: timestamp },
    notif_2: { id: 'notif_2', userId: 'student_2', type: 'course', title: 'Curso completado', message: 'Felicitaciones completaste Python', link: '/certificates', read: true, createdAt: timestamp - 86400000 },
    notif_3: { id: 'notif_3', userId: 'teacher_1', type: 'system', title: 'Nuevo estudiante', message: 'Carlos se inscribio en tu curso', link: '/courses/course_1', read: false, createdAt: timestamp - 3600000 }
  };
  await set(ref(db, 'notifications'), notifications);
  console.log('Notificaciones creadas (3)');

  const supportTickets = {
    ticket_1: { id: 'ticket_1', userId: 'student_1', userName: 'Carlos Rodriguez', userEmail: 'estudiante@lasaedu.com', category: 'tecnico', priority: 'media', subject: 'No puedo ver los videos', description: 'Los videos no cargan', status: 'open', assignedTo: 'support_1', assignedName: 'Ana Soporte', createdAt: timestamp - 7200000, updatedAt: timestamp - 3600000 },
    ticket_2: { id: 'ticket_2', userId: 'student_2', userName: 'Ana Lopez', userEmail: 'ana@lasaedu.com', category: 'academico', priority: 'baja', subject: 'Consulta certificado', description: 'Validez del certificado', status: 'resolved', assignedTo: 'support_1', satisfactionRating: 5, createdAt: timestamp - 172800000, updatedAt: timestamp - 86400000 }
  };
  await set(ref(db, 'supportTickets'), supportTickets);
  console.log('Tickets de soporte creados (2)');

  const activities = {
    act_1: { id: 'act_1', userId: 'student_1', userName: 'Carlos Rodriguez', type: 'login', action: 'login', description: 'Inicio de sesion', timestamp: timestamp, createdAt: timestamp },
    act_2: { id: 'act_2', userId: 'student_1', userName: 'Carlos Rodriguez', type: 'lesson_complete', action: 'complete_lesson', description: 'Completo Variables en Python', timestamp: timestamp - 3600000, createdAt: timestamp - 3600000 },
    act_3: { id: 'act_3', userId: 'student_2', userName: 'Ana Lopez', type: 'certificate', action: 'certificate_earned', description: 'Obtuvo certificado de Python', timestamp: timestamp - 86400000, createdAt: timestamp - 86400000 }
  };
  await set(ref(db, 'activities'), activities);
  console.log('Actividades creadas (3)');

  const userPoints = {
    student_1: { id: 'student_1', userId: 'student_1', totalPoints: 425, level: 3, levelName: 'Estudiante', nextLevelPoints: 600, rank: 2, history: [], createdAt: timestamp, updatedAt: timestamp },
    student_2: { id: 'student_2', userId: 'student_2', totalPoints: 750, level: 4, levelName: 'Aplicado', nextLevelPoints: 1000, rank: 1, history: [], createdAt: timestamp, updatedAt: timestamp }
  };
  await set(ref(db, 'userPoints'), userPoints);
  console.log('Puntos de usuario creados (2)');

  const badges = {
    badge_1: { id: 'badge_1', name: 'Primer Paso', description: 'Completa tu primera leccion', icon: 'target', category: 'achievement', points: 10, rarity: 'common', isActive: true, createdAt: timestamp },
    badge_2: { id: 'badge_2', name: 'Estudiante Dedicado', description: 'Completa 10 lecciones', icon: 'book', category: 'achievement', points: 50, rarity: 'uncommon', isActive: true, createdAt: timestamp },
    badge_3: { id: 'badge_3', name: 'Primera Graduacion', description: 'Completa tu primer curso', icon: 'graduation', category: 'course', points: 100, rarity: 'rare', isActive: true, createdAt: timestamp },
    badge_4: { id: 'badge_4', name: 'Racha de 7 dias', description: 'Estudia 7 dias seguidos', icon: 'flame', category: 'streak', points: 70, rarity: 'uncommon', isActive: true, createdAt: timestamp },
    badge_5: { id: 'badge_5', name: 'Maestro del Quiz', description: '100 por ciento en 5 evaluaciones', icon: 'trophy', category: 'achievement', points: 150, rarity: 'epic', isActive: true, createdAt: timestamp },
    badge_6: { id: 'badge_6', name: 'Leyenda', description: 'Alcanza nivel 10', icon: 'star', category: 'special', points: 500, rarity: 'legendary', isActive: true, createdAt: timestamp }
  };
  await set(ref(db, 'badges'), badges);
  console.log('Insignias creadas (6)');

  const userBadges = {
    ub_1: { id: 'ub_1', userId: 'student_1', badgeId: 'badge_1', earnedAt: new Date(timestamp - 604800000).toISOString(), notified: true, createdAt: timestamp - 604800000 },
    ub_2: { id: 'ub_2', userId: 'student_1', badgeId: 'badge_4', earnedAt: new Date().toISOString(), notified: false, createdAt: timestamp },
    ub_3: { id: 'ub_3', userId: 'student_2', badgeId: 'badge_1', earnedAt: new Date(timestamp - 2592000000).toISOString(), notified: true, createdAt: timestamp - 2592000000 },
    ub_4: { id: 'ub_4', userId: 'student_2', badgeId: 'badge_3', earnedAt: new Date(timestamp - 86400000).toISOString(), notified: true, createdAt: timestamp - 86400000 }
  };
  await set(ref(db, 'userBadges'), userBadges);
  console.log('Insignias de usuario creadas (4)');

  const learningStreaks = {
    student_1: { id: 'student_1', currentStreak: 7, longestStreak: 7, lastActiveDate: new Date().toISOString().split('T')[0], weeklyActivity: [3, 2, 4, 1, 2, 3, 2], createdAt: timestamp, updatedAt: timestamp },
    student_2: { id: 'student_2', currentStreak: 14, longestStreak: 21, lastActiveDate: new Date().toISOString().split('T')[0], weeklyActivity: [5, 4, 3, 4, 5, 2, 3], createdAt: timestamp, updatedAt: timestamp }
  };
  await set(ref(db, 'learningStreaks'), learningStreaks);
  console.log('Rachas de aprendizaje creadas (2)');

  const today = new Date().toISOString().split('T')[0];
  const systemMetrics = {};
  systemMetrics[today.replace(/-/g, '_')] = { id: today.replace(/-/g, '_'), date: today, metrics: { activeUsers: 4, newUsers: 1, courseEnrollments: 4, lessonsCompleted: 12, evaluationsSubmitted: 2, certificatesIssued: 1, supportTickets: 2 }, createdAt: timestamp };
  await set(ref(db, 'systemMetrics'), systemMetrics);
  console.log('Metricas del sistema creadas (1)');

  const forumPosts = {
    post_1: { id: 'post_1', courseId: 'course_1', courseName: 'Introduccion a Python', authorId: 'student_1', authorName: 'Carlos Rodriguez', authorRole: 'student', title: 'Duda sobre variables en Python', content: 'No entiendo bien la diferencia entre tipos mutables e inmutables. Alguien puede explicar?', isPinned: false, isResolved: true, likesCount: 3, likedBy: ['student_2', 'teacher_1'], repliesCount: 2, views: 15, tags: ['python', 'variables'], createdAt: timestamp - 172800000, updatedAt: timestamp - 86400000 },
    post_2: { id: 'post_2', courseId: 'course_2', courseName: 'Desarrollo Web con React', authorId: 'student_2', authorName: 'Ana Lopez', authorRole: 'student', title: 'Como usar useEffect correctamente?', content: 'Tengo problemas con las dependencias del useEffect. Mi componente se re-renderiza infinitamente.', isPinned: true, isResolved: false, likesCount: 5, likedBy: ['student_1', 'teacher_1'], repliesCount: 1, views: 28, tags: ['react', 'hooks', 'useEffect'], createdAt: timestamp - 86400000, updatedAt: timestamp - 3600000 }
  };
  await set(ref(db, 'forumPosts'), forumPosts);
  console.log('Forum posts creados (2)');

  const forumReplies = {
    reply_1: { id: 'reply_1', postId: 'post_1', authorId: 'teacher_1', authorName: 'Prof. Maria Garcia', authorRole: 'teacher', content: 'Los tipos inmutables como int, str y tuple no pueden cambiar despues de crearse. Los mutables como list y dict si pueden modificarse.', isAnswer: true, likesCount: 4, likedBy: ['student_1', 'student_2'], createdAt: timestamp - 86400000, updatedAt: timestamp - 86400000 },
    reply_2: { id: 'reply_2', postId: 'post_1', authorId: 'student_2', authorName: 'Ana Lopez', authorRole: 'student', content: 'Gracias profesora, ahora me queda mas claro!', isAnswer: false, likesCount: 1, likedBy: ['student_1'], createdAt: timestamp - 43200000, updatedAt: timestamp - 43200000 }
  };
  await set(ref(db, 'forumReplies'), forumReplies);
  console.log('Forum replies creados (2)');

  const progressActivities = {
    pa_1: { id: 'pa_1', userId: 'student_1', type: 'lesson_completed', courseId: 'course_1', lessonId: 'lesson_3', details: 'Completo leccion Variables en Python', points: 10, timestamp: new Date(timestamp - 3600000).toISOString(), createdAt: timestamp - 3600000 },
    pa_2: { id: 'pa_2', userId: 'student_2', type: 'course_completed', courseId: 'course_1', details: 'Completo curso Introduccion a Python', points: 100, timestamp: new Date(timestamp - 86400000).toISOString(), createdAt: timestamp - 86400000 }
  };
  await set(ref(db, 'progressActivities'), progressActivities);
  console.log('Progress activities creados (2)');

  const evaluationAttempts = {
    attempt_1: { id: 'attempt_1', evaluationId: 'eval_1', userId: 'student_1', courseId: 'course_1', answers: [{ questionId: 'q1', answer: 'x = 5', isCorrect: true, pointsEarned: 10 }], score: 10, maxScore: 10, percentage: 100, passed: true, timeSpent: 120, startedAt: new Date(timestamp - 7200000).toISOString(), completedAt: new Date(timestamp - 7080000).toISOString(), status: 'completed', createdAt: timestamp - 7200000, updatedAt: timestamp - 7080000 }
  };
  await set(ref(db, 'evaluationAttempts'), evaluationAttempts);
  console.log('Evaluation attempts creados (1)');

  const userSettingsData = {
    settings_1: { id: 'settings_1', userId: 'student_1', theme: 'light', language: 'es', timezone: 'America/Mexico_City', notifications: { email: { courseUpdates: true, grades: true, messages: true, announcements: true, marketing: false }, push: { enabled: true, courseUpdates: true, grades: true, messages: true }, sms: { enabled: false, urgentOnly: true } }, privacy: { showProfile: true, showProgress: true, showBadges: true, showActivity: true }, accessibility: { fontSize: 'medium', highContrast: false, reduceMotion: false }, createdAt: timestamp, updatedAt: timestamp }
  };
  await set(ref(db, 'userSettings'), userSettingsData);
  console.log('User settings creados (1)');

  console.log('');
  console.log('=== BASE DE DATOS SEMBRADA EXITOSAMENTE ===');
  console.log('Usuarios de prueba:');
  console.log('  admin@lasaedu.com (admin)');
  console.log('  profesor@lasaedu.com (teacher)');
  console.log('  estudiante@lasaedu.com (student)');
  console.log('  ana@lasaedu.com (student)');
  console.log('  soporte@lasaedu.com (support)');
  
  process.exit(0);
}

seedData().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
