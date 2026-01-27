#!/usr/bin/env node
/**
 * Script para poblar Firebase Emulators con datos iniciales
 * Ejecutar: node populate-emulators.js
 */

import fetch from 'node-fetch';

const FIREBASE_API_URL = 'http://127.0.0.1:9000';
const PROJECT_ID = 'demo-project';

async function seedData() {
  console.log('🌱 Poblando Firebase Emulators con datos iniciales...');

  const timestamp = Date.now();
  
  // Datos base
  const data = {
    users: {
      'admin_1': {
        id: 'admin_1',
        name: 'Administrador Principal',
        email: 'admin@lasaedu.com',
        role: 'admin',
        emailVerified: true,
        createdAt: timestamp,
        updatedAt: timestamp,
        avatar: null,
        phone: null,
        bio: 'Administrador del sistema LasaEdu'
      },
      'teacher_1': {
        id: 'teacher_1',
        name: 'Prof. María García',
        email: 'garcia@lasaedu.com',
        role: 'teacher',
        emailVerified: true,
        createdAt: timestamp - 86400000,
        updatedAt: timestamp,
        avatar: null,
        phone: '+34 666 123 456',
        bio: 'Profesora de Programación con 10 años de experiencia'
      },
      'teacher_2': {
        id: 'teacher_2',
        name: 'Prof. Carlos Martínez',
        email: 'martinez@lasaedu.com',
        role: 'teacher',
        emailVerified: true,
        createdAt: timestamp - 86400000 * 2,
        updatedAt: timestamp,
        avatar: null,
        phone: '+34 666 123 457',
        bio: 'Profesor de Matemáticas Avanzadas'
      },
      'student_1': {
        id: 'student_1',
        name: 'Ana López',
        email: 'ana@lasaedu.com',
        role: 'student',
        emailVerified: true,
        createdAt: timestamp - 86400000 * 3,
        updatedAt: timestamp,
        avatar: null,
        phone: '+34 666 789 123',
        bio: 'Estudiante de programación'
      },
      'student_2': {
        id: 'student_2',
        name: 'David Rodríguez',
        email: 'david@lasaedu.com',
        role: 'student',
        emailVerified: true,
        createdAt: timestamp - 86400000 * 4,
        updatedAt: timestamp,
        avatar: null,
        phone: '+34 666 789 124',
        bio: 'Estudiante de matemáticas'
      }
    },
    
    courses: {
      'course_1': {
        id: 'course_1',
        title: 'Introducción a Python',
        description: 'Aprende los fundamentos de programación con Python desde cero. Incluye proyectos prácticos.',
        instructorId: 'teacher_1',
        instructor: 'Prof. María García',
        category: 'programacion',
        level: 'principiante',
        duration: '8 semanas',
        status: 'publicado',
        rating: 4.8,
        studentsCount: 156,
        createdAt: timestamp - 86400000 * 30,
        updatedAt: timestamp,
        modules: []
      },
      'course_2': {
        id: 'course_2',
        title: 'Matemáticas Avanzadas',
        description: 'Cálculo diferencial e integral, álgebra lineal y estadística aplicada.',
        instructorId: 'teacher_2',
        instructor: 'Prof. Carlos Martínez',
        category: 'matematicas',
        level: 'avanzado',
        duration: '12 semanas',
        status: 'publicado',
        rating: 4.5,
        studentsCount: 89,
        createdAt: timestamp - 86400000 * 25,
        updatedAt: timestamp,
        modules: []
      },
      'course_3': {
        id: 'course_3',
        title: 'JavaScript Moderno',
        description: 'ES6+, async/await, módulos y frameworks modernos.',
        instructorId: 'teacher_1',
        instructor: 'Prof. María García',
        category: 'programacion',
        level: 'intermedio',
        duration: '10 semanas',
        status: 'borrador',
        rating: 0,
        studentsCount: 0,
        createdAt: timestamp - 86400000 * 5,
        updatedAt: timestamp,
        modules: []
      }
    },

    enrollments: {
      'enroll_1': {
        id: 'enroll_1',
        userId: 'student_1',
        courseId: 'course_1',
        status: 'active',
        progress: 65.5,
        enrolledAt: timestamp - 86400000 * 15,
        createdAt: timestamp - 86400000 * 15,
        updatedAt: timestamp,
        completedLessons: [],
        completedModules: [],
        totalTimeSpent: 1200,
        lastAccessedAt: timestamp - 3600000,
        grade: null,
        source: 'manual'
      },
      'enroll_2': {
        id: 'enroll_2',
        userId: 'student_2',
        courseId: 'course_2',
        status: 'active',
        progress: 25.0,
        enrolledAt: timestamp - 86400000 * 10,
        createdAt: timestamp - 86400000 * 10,
        updatedAt: timestamp,
        completedLessons: [],
        completedModules: [],
        totalTimeSpent: 600,
        lastAccessedAt: timestamp - 7200000,
        grade: null,
        source: 'manual'
      }
    },

    activities: {
      'activity_1': {
        id: 'activity_1',
        userId: 'student_1',
        userName: 'Ana López',
        action: 'Se inscribió en Introducción a Python',
        timestamp: timestamp - 86400000 * 15,
        details: 'Nueva inscripción registrada'
      },
      'activity_2': {
        id: 'activity_2', 
        userId: 'teacher_1',
        userName: 'Prof. María García',
        action: 'Creó nuevo curso "JavaScript Moderno"',
        timestamp: timestamp - 86400000 * 5,
        details: 'Curso en estado borrador'
      },
      'activity_3': {
        id: 'activity_3',
        userId: 'student_2',
        userName: 'David Rodríguez',
        action: 'Se inscribió en Matemáticas Avanzadas',
        timestamp: timestamp - 86400000 * 10,
        details: 'Nueva inscripción registrada'
      }
    }
  };

  // Subir datos a Firebase Emulator
  try {
    const response = await fetch(`${FIREBASE_API_URL}/.settings/rules.json?ns=${PROJECT_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        "rules": {
          ".read": true,
          ".write": true
        }
      })
    });

    // Subir cada colección
    for (const [collection, items] of Object.entries(data)) {
      const url = `${FIREBASE_API_URL}/${collection}.json?ns=${PROJECT_ID}`;
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(items)
      });
      
      if (response.ok) {
        console.log(`✅ ${collection}: ${Object.keys(items).length} registros`);
      } else {
        console.error(`❌ Error en ${collection}:`, await response.text());
      }
    }

    console.log('🎉 Base de datos poblada exitosamente!');
    console.log('👤 Usuario admin: admin@lasaedu.com');
    console.log('🏫 Cursos disponibles: 3');
    console.log('👥 Usuarios totales: 5');

  } catch (error) {
    console.error('❌ Error poblando base de datos:', error);
  }
}

// Ejecutar si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  seedData();
}

export { seedData };