// Shared Moodle → lasaedu importer logic.
//
// Exposes `importMoodle({ courseIds })` so thin CLI entrypoints can target a
// single course (scripts/import-moodle-course-<id>.mjs) or all of them
// (scripts/import-moodle.mjs). Section creation is intentionally NOT done
// here — sections are managed by the instructor/admin in the UI.

import admin from 'firebase-admin';
import { connectMoodle, resolveInstructor } from './db.mjs';
import { verifyEncodingSample } from './encoding.mjs';
import { loadAllCourses, loadCourse, buildCourseDoc } from './courses.mjs';
import { loadCourseModules, loadCourseModule } from './modules.mjs';
import { buildLessonFromCourseModule } from './lessons.mjs';
import { FileMigrator } from './files.mjs';

export function assertEnv() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Missing required env: GOOGLE_APPLICATION_CREDENTIALS');
    console.error('Example:');
    console.error('  GOOGLE_APPLICATION_CREDENTIALS=~/keys/lasaedurd-sa.json \\');
    console.error('  node scripts/import-moodle-course-2.mjs');
    process.exit(1);
  }
}

async function importOneCourse({
  conn, prefix, moodleCourse, instructor, fileMigrator, db, warnings, dryRun, stats,
}) {
  // buildCourseDoc also returns a sectionDoc, but we deliberately drop it —
  // sections are no longer created by the importer.
  const { courseDocId, courseDoc } = buildCourseDoc(moodleCourse, instructor);
  const now = Date.now();

  console.log(`\n=== ${courseDoc.title}  (mdl id=${moodleCourse.id})  →  ${courseDocId}`);

  if (!dryRun) {
    await db.collection('courses').doc(courseDocId).set(
      { ...courseDoc, createdAt: now, updatedAt: now },
      { merge: true },
    );
  }
  stats.courses += 1;

  const sectionsList = await loadCourseModules(conn, prefix, moodleCourse.id);

  let totalLessons = 0;
  const lessonsByType = {};

  for (const sec of sectionsList) {
    const moduleDoc = { ...sec.moduleDoc, courseId: courseDocId };
    console.log(`  modules/${moduleDoc.id} — "${moduleDoc.title}" (order=${moduleDoc.order}, ${sec.cmids.length} cmids)`);
    if (!dryRun) {
      await db.collection('modules').doc(moduleDoc.id).set(
        { ...moduleDoc, createdAt: now, updatedAt: now },
        { merge: true },
      );
    }
    stats.modules += 1;

    let order = 0;
    for (const cmid of sec.cmids) {
      const cm = await loadCourseModule(conn, prefix, cmid);
      if (!cm) {
        warnings.push(`course ${moodleCourse.id} section ${sec.section.id}: cmid ${cmid} missing`);
        continue;
      }
      const built = await buildLessonFromCourseModule({
        conn, prefix, cm,
        moduleName: cm.module_name,
        order, courseDocId, fileMigrator, warnings,
      });
      if (!built) continue;

      const lessonDoc = { ...built.lessonDoc, moduleId: moduleDoc.id, courseId: courseDocId };
      console.log(`    · lessons/${lessonDoc.id}  [${built.sourceType}→${lessonDoc.type}]  ${lessonDoc.title}`);
      if (!dryRun) {
        await db.collection('lessons').doc(lessonDoc.id).set(
          { ...lessonDoc, createdAt: now, updatedAt: now },
          { merge: true },
        );
      }
      totalLessons += 1;
      lessonsByType[lessonDoc.type] = (lessonsByType[lessonDoc.type] || 0) + 1;
      if (built.sourceType === 'quiz') stats.quizzes += 1;
      if (built.sourceType === 'assign') stats.assigns += 1;
      order += 1;
    }
  }

  stats.lessons += totalLessons;
  for (const [t, n] of Object.entries(lessonsByType)) {
    stats.lessonsByType[t] = (stats.lessonsByType[t] || 0) + n;
  }
  console.log(`  → ${totalLessons} lessons (${Object.entries(lessonsByType).map(([k, v]) => `${k}=${v}`).join(', ')})`);
}

// `opts.courseIds` — array of Moodle course ids to import. If empty/undefined,
// imports every course with id>1.
export async function importMoodle(opts = {}) {
  const courseIds = Array.isArray(opts.courseIds) ? opts.courseIds : [];
  const dryRun = opts.dryRun || process.env.DRY_RUN === '1';

  assertEnv();
  verifyEncodingSample();

  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  }
  const auth = admin.auth();
  const db = admin.firestore();

  const instructor = await resolveInstructor(auth, process.env.INSTRUCTOR_EMAIL);
  console.log(`Instructor: ${instructor.name} (${instructor.id})`);
  if (dryRun) console.log('DRY RUN — no writes to Firestore.');

  const { connection: conn, prefix } = await connectMoodle();
  console.log(`Connected to Moodle DB (prefix=${prefix}).`);

  const fileMigrator = new FileMigrator({
    moodledataDir: process.env.MOODLEDATA_DIR,
    moodleWwwroot: process.env.MOODLE_WWWROOT,
    moodleWsToken: process.env.MOODLE_WS_TOKEN,
    fileServerUrl: process.env.FILE_SERVER_URL,
    fileServerToken: process.env.FILE_SERVER_TOKEN,
    dryRun,
  });
  if (!fileMigrator.canMigrate()) {
    console.warn('⚠ File migration disabled — set MOODLEDATA_DIR or MOODLE_WWWROOT+MOODLE_WS_TOKEN, and FILE_SERVER_URL.');
  }

  const warnings = [];
  const stats = {
    courses: 0, modules: 0, lessons: 0, quizzes: 0, assigns: 0,
    lessonsByType: {},
  };

  try {
    let courses;
    if (courseIds.length > 0) {
      courses = [];
      for (const id of courseIds) {
        const c = await loadCourse(conn, prefix, id);
        if (c) courses.push(c);
        else warnings.push(`course id=${id} not found in Moodle dump`);
      }
    } else {
      courses = await loadAllCourses(conn, prefix);
    }

    if (courses.length === 0) {
      console.error('No courses to import.');
      process.exit(1);
    }
    console.log(`Importing ${courses.length} course(s).`);

    for (const c of courses) {
      await importOneCourse({
        conn, prefix,
        moodleCourse: c,
        instructor, fileMigrator, db, warnings, dryRun, stats,
      });
    }
  } finally {
    await conn.end().catch(() => {});
  }

  console.log('\n---------- Import summary ----------');
  console.log(`courses   : ${stats.courses}`);
  console.log(`modules   : ${stats.modules}`);
  console.log(`lessons   : ${stats.lessons}`);
  console.log(`  by type : ${Object.entries(stats.lessonsByType).map(([k, v]) => `${k}=${v}`).join(', ') || '-'}`);
  console.log(`quizzes   : ${stats.quizzes}`);
  console.log(`tareas    : ${stats.assigns}`);
  console.log(`files     : uploaded=${fileMigrator.stats.uploaded}, cached=${fileMigrator.stats.cached}, skipped=${fileMigrator.stats.skipped}, failed=${fileMigrator.stats.failed}`);
  console.log(`warnings  : ${warnings.length}`);

  if (warnings.length > 0) {
    const warningsFile = process.env.MOODLE_IMPORT_WARNINGS
      || `./moodle-import-warnings${courseIds.length === 1 ? `-course-${courseIds[0]}` : ''}.log`;
    const fs = await import('node:fs/promises');
    await fs.writeFile(warningsFile, warnings.join('\n') + '\n', 'utf8');
    console.log(`Wrote ${warnings.length} warnings to ${warningsFile}.`);
  }
  if (dryRun) console.log('(dry run — nothing was written to Firestore)');
}
