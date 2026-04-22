#!/usr/bin/env node
/**
 * Moodle → lasaedu importer — ALL courses in the dump (id > 1).
 *
 * Writes courses / modules / lessons to Firestore. Does NOT create sections —
 * those are managed manually in the admin UI.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=~/keys/lasaedurd-sa.json \
 *   MOODLE_DB_PORT=3307 \
 *   FILE_SERVER_URL=https://files.lasaedu.cloudteco.com \
 *   node scripts/import-moodle.mjs [--course=<id>] [--dry-run]
 *
 * For a single course prefer the per-course entrypoints:
 *   node scripts/import-moodle-course-2.mjs
 *   node scripts/import-moodle-course-3.mjs
 *   node scripts/import-moodle-course-5.mjs
 *   node scripts/import-moodle-course-6.mjs
 *   node scripts/import-moodle-course-10.mjs
 *   node scripts/import-moodle-course-11.mjs
 *
 * See scripts/moodle/README.md for the full list of env vars.
 */

import { importMoodle } from './moodle/run.mjs';

function parseArgs(argv) {
  const args = { courseIds: [], dryRun: false };
  for (const a of argv) {
    if (a === '--dry-run') args.dryRun = true;
    else if (a.startsWith('--course=')) args.courseIds.push(Number(a.slice('--course='.length)));
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
importMoodle({ courseIds: args.courseIds, dryRun: args.dryRun }).catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
