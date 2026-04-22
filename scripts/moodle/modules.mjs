// Moodle course_sections → lasaedu modules.
//
// Each section has a `sequence` column (CSV of cmids) that defines the
// display order of activities. We keep Moodle's section row as a lasaedu
// "module" — and feed its sequence (split & mapped to cmids) into the lesson
// loop so order lines up with what the instructor built.

import { query } from './db.mjs';

// Returns an array of { section, moduleDoc, cmids[] }.
export async function loadCourseModules(conn, prefix, moodleCourseId) {
  const sections = await query(
    conn,
    prefix,
    `SELECT id, course, section, name, summary, sequence, visible
       FROM {course_sections}
      WHERE course = ?
      ORDER BY section`,
    [moodleCourseId],
  );

  const out = [];
  for (const s of sections) {
    const cmids = (s.sequence || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
      .map(Number)
      .filter((n) => Number.isInteger(n) && n > 0);

    // Skip entirely empty sections — they add noise to the module list.
    if (cmids.length === 0) continue;

    const moduleDocId = `mdl_mod_${s.id}`;
    const title = s.name && s.name.trim()
      ? s.name.trim()
      : `Tema ${s.section}`;

    out.push({
      section: s,
      cmids,
      moduleDoc: {
        id: moduleDocId,
        title,
        description: s.summary || '',
        order: Number(s.section) || 0,
        status: Number(s.visible) === 0 ? 'borrador' : 'publicado',
      },
    });
  }
  return out;
}

// Fetches a single course_module row + activity type name.
export async function loadCourseModule(conn, prefix, cmid) {
  const [row] = await query(
    conn,
    prefix,
    `SELECT cm.id, cm.course, cm.module, cm.instance, cm.section, cm.visible,
            m.name AS module_name
       FROM {course_modules} cm
       JOIN {modules} m ON m.id = cm.module
      WHERE cm.id = ?
      LIMIT 1`,
    [cmid],
  );
  return row || null;
}
