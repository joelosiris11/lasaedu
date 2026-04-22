// Moodle mod_assign → lasaedu TareaLessonContent.
//
// Moodle pieces we care about:
//   - mdlsv_assign.intro (HTML)           → instructions
//   - mdlsv_assign.grade                  → totalPoints (clamped, see below)
//   - files in filearea 'introattachment' → referenceFiles
//   - mdlsv_assign_plugin_config          → submissionSettings (max files/size, extensions)
//
// Defaults mirror TareaLessonEditor.defaultTareaContent when Moodle is silent.

import { query } from './db.mjs';

const DEFAULT_MAX_FILES = 3;
const DEFAULT_MAX_SIZE = 25 * 1024 * 1024;
const DEFAULT_EXTS = ['.pdf', '.docx', '.pptx', '.xlsx', '.zip', '.jpg', '.jpeg', '.png'];

// Moodle stores grade as "100" for percentages, negative ids for scales, 0
// for "not graded". Map to a sane lasaedu totalPoints.
function normaliseGrade(grade) {
  const n = Number(grade);
  if (!Number.isFinite(n) || n <= 0) return 100;
  // Any positive value is a max score (usually 100). Cap at 1000.
  return Math.min(1000, Math.round(n));
}

// Parse assignsubmission_file plugin config rows. Returns partial settings.
async function readFilePluginConfig(conn, prefix, assignid) {
  const rows = await query(
    conn,
    prefix,
    `SELECT name, value
       FROM {assign_plugin_config}
      WHERE assignment = ?
        AND plugin = 'file'
        AND subtype = 'assignsubmission'`,
    [assignid],
  );
  const cfg = {};
  for (const r of rows) cfg[r.name] = r.value;

  const out = {};
  if (cfg.maxfilesubmissions) {
    const n = Number(cfg.maxfilesubmissions);
    if (Number.isFinite(n) && n > 0) out.maxFiles = Math.min(10, n);
  }
  if (cfg.maxsubmissionsizebytes) {
    const n = Number(cfg.maxsubmissionsizebytes);
    if (Number.isFinite(n) && n > 0) out.maxFileSize = n;
  }
  if (cfg.filetypeslist) {
    const list = String(cfg.filetypeslist)
      .split(/[\s,;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
      .map((s) => (s.startsWith('.') ? s : `.${s}`));
    if (list.length) out.allowedExtensions = list;
  }
  return out;
}

// Build a TareaLessonContent from a Moodle assign row. `introFiles` is an
// array of ResourceFile-like objects the caller has already migrated (from
// filearea='introattachment' and 'intro').
export async function buildTareaContent(conn, prefix, assignRow, introFiles) {
  const overrides = await readFilePluginConfig(conn, prefix, assignRow.id);

  return {
    instructions: assignRow.intro || '',
    totalPoints: normaliseGrade(assignRow.grade),
    referenceFiles: introFiles || [],
    submissionSettings: {
      maxFiles: overrides.maxFiles ?? DEFAULT_MAX_FILES,
      maxFileSize: overrides.maxFileSize ?? DEFAULT_MAX_SIZE,
      allowedExtensions: overrides.allowedExtensions ?? DEFAULT_EXTS,
    },
  };
}
