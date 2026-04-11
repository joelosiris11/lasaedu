/**
 * Migration: Sections
 *
 * Crea secciones default para cursos existentes con enrollments activos.
 * Backfills sectionId en enrollments, grades, submissions, extensions, attempts.
 *
 * Uso desde consola del navegador o desde /data-init:
 *   migrateSections()
 */

import { firebaseDB } from './firebaseDataService';
import type {
  DBCourse,
  DBSection,
  DBEnrollment,
  DBGrade,
  DBTaskSubmission,
  DBDeadlineExtension,
  DBEvaluationAttempt,
} from './firebaseDataService';

export async function migrateSections(): Promise<{ created: number; updated: number }> {
  console.log('[migration] Starting sections migration...');
  let sectionsCreated = 0;
  let recordsUpdated = 0;

  // 1. Get all courses
  const courses = await firebaseDB.getCourses();
  console.log(`[migration] Found ${courses.length} courses`);

  // 2. Add sectionsCount to all courses that don't have it
  for (const course of courses) {
    if ((course as any).sectionsCount === undefined) {
      await firebaseDB.updateCourse(course.id, { sectionsCount: 0 } as any);
    }
  }

  // 3. Get all enrollments to determine which courses need sections
  const allEnrollments = await firebaseDB.getEnrollments();
  const coursesWithEnrollments = new Set(allEnrollments.map(e => e.courseId));

  // 4. For each course with enrollments, create a default section
  const courseToSection = new Map<string, string>();

  for (const course of courses) {
    if (!coursesWithEnrollments.has(course.id)) continue;

    // Check if section already exists for this course
    const existingSections = await firebaseDB.getSectionsByCourse(course.id);
    if (existingSections.length > 0) {
      courseToSection.set(course.id, existingSections[0].id);
      console.log(`[migration] Course "${course.title}" already has sections, skipping`);
      continue;
    }

    const now = Date.now();
    const section = await firebaseDB.createSection({
      courseId: course.id,
      title: `${course.title} - Sección Principal`,
      description: 'Sección creada automáticamente durante la migración',
      instructorId: course.instructorId,
      instructorName: course.instructor,
      startDate: course.createdAt,
      endDate: now + 180 * 24 * 60 * 60 * 1000, // 6 months from now
      accessType: 'publico',
      courseTitle: course.title,
      courseCategory: course.category,
      courseLevel: course.level,
      courseImage: course.image,
      studentsCount: allEnrollments.filter(e => e.courseId === course.id && e.status === 'active').length,
      status: 'activa',
      createdAt: now,
      updatedAt: now,
    });

    courseToSection.set(course.id, section.id);
    sectionsCreated++;

    // Update course sectionsCount
    await firebaseDB.updateCourse(course.id, { sectionsCount: 1 } as any);
    console.log(`[migration] Created section for "${course.title}"`);
  }

  // 5. Backfill sectionId in enrollments
  for (const enrollment of allEnrollments) {
    if (enrollment.sectionId) continue;
    const sectionId = courseToSection.get(enrollment.courseId);
    if (!sectionId) continue;
    await firebaseDB.updateEnrollment(enrollment.id, { sectionId });
    recordsUpdated++;
  }
  console.log(`[migration] Updated ${recordsUpdated} enrollments`);

  // 6. Backfill grades
  const allGrades = await firebaseDB.getAll<DBGrade>('grades');
  let gradesUpdated = 0;
  for (const grade of allGrades) {
    if (grade.sectionId) continue;
    const sectionId = courseToSection.get(grade.courseId);
    if (!sectionId) continue;
    await firebaseDB.update<DBGrade>('grades', grade.id, { sectionId });
    gradesUpdated++;
  }
  console.log(`[migration] Updated ${gradesUpdated} grades`);

  // 7. Backfill task submissions
  const allSubmissions = await firebaseDB.getTaskSubmissions();
  let submissionsUpdated = 0;
  for (const sub of allSubmissions) {
    if (sub.sectionId) continue;
    const sectionId = courseToSection.get(sub.courseId);
    if (!sectionId) continue;
    await firebaseDB.updateTaskSubmission(sub.id, { sectionId });
    submissionsUpdated++;
  }
  console.log(`[migration] Updated ${submissionsUpdated} submissions`);

  // 8. Backfill deadline extensions
  const allExtensions = await firebaseDB.getDeadlineExtensions();
  let extensionsUpdated = 0;
  for (const ext of allExtensions) {
    if (ext.sectionId) continue;
    const sectionId = courseToSection.get(ext.courseId);
    if (!sectionId) continue;
    await firebaseDB.update<DBDeadlineExtension>('deadlineExtensions', ext.id, { sectionId });
    extensionsUpdated++;
  }
  console.log(`[migration] Updated ${extensionsUpdated} extensions`);

  // 9. Backfill evaluation attempts
  const allAttempts = await firebaseDB.getAll<DBEvaluationAttempt>('evaluationAttempts');
  let attemptsUpdated = 0;
  for (const attempt of allAttempts) {
    if (attempt.sectionId) continue;
    const sectionId = courseToSection.get(attempt.courseId);
    if (!sectionId) continue;
    await firebaseDB.update<DBEvaluationAttempt>('evaluationAttempts', attempt.id, { sectionId });
    attemptsUpdated++;
  }
  console.log(`[migration] Updated ${attemptsUpdated} attempts`);

  recordsUpdated += gradesUpdated + submissionsUpdated + extensionsUpdated + attemptsUpdated;

  console.log(`[migration] Done! Created ${sectionsCreated} sections, updated ${recordsUpdated} records`);
  return { created: sectionsCreated, updated: recordsUpdated };
}

// Expose to browser console
if (typeof window !== 'undefined') {
  (window as any).migrateSections = migrateSections;
}
