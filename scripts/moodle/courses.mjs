// Moodle course → lasaedu course + section documents.
//
// We only read visible courses with id > 1 (id=1 is the Moodle site
// container "Lasa Academy", not a real course). The category name is turned
// into a slug for lasaedu's `category` string field.

import { query } from './db.mjs';

function slugify(input) {
  return String(input || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'general';
}

// Moodle `startdate/enddate` are seconds since epoch. lasaedu timestamps are
// milliseconds. Returns {startDate, endDate}.
function normaliseDates(course) {
  const now = Date.now();
  const start = Number(course.startdate) > 0 ? Number(course.startdate) * 1000 : now;
  const end = Number(course.enddate) > 0
    ? Number(course.enddate) * 1000
    : now + 1000 * 60 * 60 * 24 * 90; // +90d default
  return { startDate: start, endDate: end };
}

// Load a single course by Moodle id; joins category name.
export async function loadCourse(conn, prefix, moodleCourseId) {
  const [row] = await query(
    conn,
    prefix,
    `SELECT c.id, c.category, c.fullname, c.shortname, c.summary,
            c.startdate, c.enddate, c.visible, c.timecreated, c.timemodified,
            cat.name AS category_name
       FROM {course} c
       LEFT JOIN {course_categories} cat ON cat.id = c.category
      WHERE c.id = ?
      LIMIT 1`,
    [moodleCourseId],
  );
  return row || null;
}

// Load all courses we should migrate (id > 1).
export async function loadAllCourses(conn, prefix) {
  return query(
    conn,
    prefix,
    `SELECT c.id, c.category, c.fullname, c.shortname, c.summary,
            c.startdate, c.enddate, c.visible, c.timecreated, c.timemodified,
            cat.name AS category_name
       FROM {course} c
       LEFT JOIN {course_categories} cat ON cat.id = c.category
      WHERE c.id > 1
      ORDER BY c.id`,
  );
}

// Build Firestore-ready course + section documents. `instructor` is the
// resolved lookup from db.mjs::resolveInstructor.
export function buildCourseDoc(moodleCourse, instructor) {
  const courseDocId = `mdl_course_${moodleCourse.id}`;
  const category = slugify(moodleCourse.category_name || 'general');
  const { startDate, endDate } = normaliseDates(moodleCourse);

  const tags = [];
  if (moodleCourse.shortname) tags.push(slugify(moodleCourse.shortname));
  tags.push(category);

  return {
    courseDocId,
    courseDoc: {
      id: courseDocId,
      title: moodleCourse.fullname || `Curso ${moodleCourse.id}`,
      description: moodleCourse.summary || '',
      instructor: instructor.name,
      instructorId: instructor.id,
      category,
      level: 'intermedio',
      status: Number(moodleCourse.visible) === 0 ? 'borrador' : 'publicado',
      image: 'https://images.unsplash.com/photo-1531746790731-6c087fecd65a?auto=format&fit=crop&w=1200&q=80',
      rating: 0,
      studentsCount: 0,
      sectionsCount: 1,
      tags: Array.from(new Set(tags.filter(Boolean))),
      requirements: [],
      objectives: [],
    },
    sectionDocId: `mdl_sec_${moodleCourse.id}_default`,
    sectionDoc: {
      id: `mdl_sec_${moodleCourse.id}_default`,
      courseId: courseDocId,
      title: `${moodleCourse.fullname || 'Curso'} · Cohorte abierta`,
      description: 'Sección importada desde Moodle. Acceso público inmediato.',
      instructorId: instructor.id,
      instructorName: instructor.name,
      startDate,
      endDate,
      accessType: 'publico',
      enrollmentLimit: null,
      courseTitle: moodleCourse.fullname || `Curso ${moodleCourse.id}`,
      courseCategory: category,
      courseLevel: 'intermedio',
      courseImage: 'https://images.unsplash.com/photo-1531746790731-6c087fecd65a?auto=format&fit=crop&w=1200&q=80',
      studentsCount: 0,
      status: 'activa',
    },
  };
}
