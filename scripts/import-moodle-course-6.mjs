#!/usr/bin/env node
/**
 * Import Moodle course id=6  →  "Electrónica Básica - Segundo Grupo"  →
 * lasaedu mdl_course_6
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=~/keys/lasaedurd-sa.json \
 *   FILE_SERVER_URL=https://files.lasaedu.cloudteco.com \
 *   node scripts/import-moodle-course-6.mjs [--dry-run]
 *
 * Does NOT create sections — manage those in the admin UI.
 */

import { importMoodle } from './moodle/run.mjs';

const dryRun = process.argv.includes('--dry-run');
importMoodle({ courseIds: [6], dryRun }).catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
