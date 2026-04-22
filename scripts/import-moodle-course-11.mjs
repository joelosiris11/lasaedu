#!/usr/bin/env node
/**
 * Import Moodle course id=11  →  "Programa Integral de Calidad para la
 * Industria de Manufactura de Cigarros"  →  lasaedu mdl_course_11
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=~/keys/lasaedurd-sa.json \
 *   FILE_SERVER_URL=https://files.lasaedu.cloudteco.com \
 *   node scripts/import-moodle-course-11.mjs [--dry-run]
 *
 * Does NOT create sections — manage those in the admin UI.
 */

import { importMoodle } from './moodle/run.mjs';

const dryRun = process.argv.includes('--dry-run');
importMoodle({ courseIds: [11], dryRun }).catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
