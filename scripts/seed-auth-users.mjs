/**
 * Script to seed Firebase Auth emulator with test users
 * Run with: node scripts/seed-auth-users.mjs
 */

const AUTH_EMULATOR_URL = 'http://127.0.0.1:9099';
const DATABASE_EMULATOR_URL = 'http://127.0.0.1:9000';
const PROJECT_ID = 'demo-project';

const users = [
  {
    email: 'admin@lasaedu.com',
    password: 'password123',
    displayName: 'Administrador Principal',
    role: 'admin'
  },
  {
    email: 'teacher@lasaedu.com',
    password: 'password123',
    displayName: 'Prof. María García',
    role: 'teacher'
  },
  {
    email: 'student@lasaedu.com',
    password: 'password123',
    displayName: 'Ana López',
    role: 'student'
  },
  {
    email: 'support@lasaedu.com',
    password: 'password123',
    displayName: 'Soporte Técnico',
    role: 'support'
  }
];

async function createAuthUser(user) {
  try {
    // Create user in Firebase Auth emulator
    const response = await fetch(
      `${AUTH_EMULATOR_URL}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          password: user.password,
          displayName: user.displayName,
          returnSecureToken: true
        })
      }
    );

    if (!response.ok) {
      const error = await response.json();
      if (error.error?.message === 'EMAIL_EXISTS') {
        console.log(`  ⚠️  User ${user.email} already exists in Auth`);
        // Get existing user ID
        const signInResponse = await fetch(
          `${AUTH_EMULATOR_URL}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: user.email,
              password: user.password,
              returnSecureToken: true
            })
          }
        );
        const signInData = await signInResponse.json();
        return signInData.localId;
      }
      throw new Error(error.error?.message || 'Unknown error');
    }

    const data = await response.json();
    console.log(`  ✅ Created Auth user: ${user.email}`);
    return data.localId;
  } catch (error) {
    console.error(`  ❌ Error creating ${user.email}:`, error.message);
    return null;
  }
}

async function createDatabaseUser(userId, user) {
  try {
    const dbUser = {
      id: userId,
      email: user.email,
      name: user.displayName,
      role: user.role,
      emailVerified: true,
      profile: {
        avatar: null,
        bio: `Usuario ${user.role} del sistema`
      },
      preferences: {
        theme: 'light',
        notifications: { email: true, push: true, inApp: true }
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastActive: Date.now()
    };

    const response = await fetch(
      `${DATABASE_EMULATOR_URL}/users/${userId}.json?ns=${PROJECT_ID}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dbUser)
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    console.log(`  ✅ Created DB user: ${user.email}`);
  } catch (error) {
    console.error(`  ❌ Error creating DB user ${user.email}:`, error.message);
  }
}

async function seedBadges() {
  const badges = {
    'first_course': {
      id: 'first_course',
      name: 'Primer Paso',
      description: 'Completaste tu primer curso',
      icon: '🎯',
      category: 'courses',
      criteria: { coursesCompleted: 1 },
      rarity: 'common'
    },
    'five_courses': {
      id: 'five_courses',
      name: 'Estudiante Dedicado',
      description: 'Completaste 5 cursos',
      icon: '📚',
      category: 'courses',
      criteria: { coursesCompleted: 5 },
      rarity: 'rare'
    },
    'perfect_quiz': {
      id: 'perfect_quiz',
      name: 'Perfeccionista',
      description: 'Obtuviste 100% en un quiz',
      icon: '💯',
      category: 'evaluations',
      criteria: { perfectScore: true },
      rarity: 'rare'
    },
    'week_streak': {
      id: 'week_streak',
      name: 'Racha Semanal',
      description: 'Mantuviste una racha de 7 días',
      icon: '🔥',
      category: 'streak',
      criteria: { streakDays: 7 },
      rarity: 'common'
    },
    'month_streak': {
      id: 'month_streak',
      name: 'Racha Mensual',
      description: 'Mantuviste una racha de 30 días',
      icon: '⚡',
      category: 'streak',
      criteria: { streakDays: 30 },
      rarity: 'epic'
    },
    'early_bird': {
      id: 'early_bird',
      name: 'Madrugador',
      description: 'Completaste una lección antes de las 7am',
      icon: '🌅',
      category: 'special',
      criteria: { earlyMorning: true },
      rarity: 'uncommon'
    },
    'night_owl': {
      id: 'night_owl',
      name: 'Búho Nocturno',
      description: 'Completaste una lección después de medianoche',
      icon: '🦉',
      category: 'special',
      criteria: { lateNight: true },
      rarity: 'uncommon'
    },
    'helper': {
      id: 'helper',
      name: 'Buen Compañero',
      description: 'Ayudaste a 5 estudiantes en los foros',
      icon: '🤝',
      category: 'social',
      criteria: { forumHelps: 5 },
      rarity: 'rare'
    }
  };

  try {
    const response = await fetch(
      `${DATABASE_EMULATOR_URL}/badges.json?ns=${PROJECT_ID}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(badges)
      }
    );

    if (response.ok) {
      console.log('✅ Created badges collection');
    }
  } catch (error) {
    console.error('❌ Error creating badges:', error.message);
  }
}

async function seedSampleCourse() {
  const course = {
    id: 'course_intro_python',
    title: 'Introducción a Python',
    description: 'Aprende los fundamentos de programación con Python desde cero. Curso ideal para principiantes.',
    instructorId: null, // Will be set after teacher is created
    instructor: 'Prof. María García',
    category: 'programacion',
    level: 'principiante',
    duration: '8 semanas',
    status: 'publicado',
    rating: 4.8,
    studentsCount: 0,
    tags: ['python', 'programacion', 'principiante'],
    objectives: [
      'Entender los conceptos básicos de programación',
      'Escribir programas simples en Python',
      'Trabajar con estructuras de datos',
      'Resolver problemas usando código'
    ],
    requirements: ['Computadora con acceso a internet', 'Ganas de aprender'],
    thumbnail: null,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  try {
    const response = await fetch(
      `${DATABASE_EMULATOR_URL}/courses/course_intro_python.json?ns=${PROJECT_ID}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(course)
      }
    );

    if (response.ok) {
      console.log('✅ Created sample course: Introducción a Python');
    }
  } catch (error) {
    console.error('❌ Error creating course:', error.message);
  }
}

async function main() {
  console.log('🚀 Seeding Firebase Emulators...\n');

  console.log('📝 Creating users in Firebase Auth and Database...');
  for (const user of users) {
    const userId = await createAuthUser(user);
    if (userId) {
      await createDatabaseUser(userId, user);
    }
  }

  console.log('\n🏆 Creating badges...');
  await seedBadges();

  console.log('\n📚 Creating sample course...');
  await seedSampleCourse();

  console.log('\n✨ Seed completed!\n');
  console.log('Test credentials:');
  console.log('  Email: admin@lasaedu.com');
  console.log('  Password: password123');
}

main().catch(console.error);
