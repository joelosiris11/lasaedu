#!/usr/bin/env node
/**
 * Import Moodle course id=3  →  "Maquina PMB"  →  lasaedu mdl_course_3
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=~/keys/lasaedurd-sa.json \
 *   FILE_SERVER_URL=https://files.lasaedu.cloudteco.com \
 *   node scripts/import-moodle-course-3.mjs [--dry-run]
 *
 * Does NOT create sections — manage those in the admin UI.
 */

import { importMoodle } from './moodle/run.mjs';

const dryRun = process.argv.includes('--dry-run');
importMoodle({ courseIds: [3], dryRun }).catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
