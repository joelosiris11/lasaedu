// Dispatcher: mdlsv_course_modules row → lasaedu lesson document.
//
// Each cmid has a `module` id that resolves to a name in mdlsv_modules
// ('quiz', 'assign', 'page', ...). We fetch the instance row from the
// appropriate per-type table and build a `content` payload in the shape the
// lasaedu editor components expect.

import { query } from './db.mjs';
import { buildQuizContent } from './quizzes.mjs';
import { buildTareaContent } from './assignments.mjs';
import { RELEVANT_COMPONENTS } from './files.mjs';
import { stripHtmlToText } from './qtype-mapping.mjs';

// --- Video URL detection (mirrors VideoLessonEditor.tsx:detectVideoSource) ---
// Returns '' when the URL is not a video.
function detectVideoSource(url) {
  if (!url) return '';
  if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube';
  if (/vimeo\.com/i.test(url)) return 'vimeo';
  if (/\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i.test(url)) return 'direct';
  return '';
}

// Pull an embedded video URL out of an HTML intro. Some Moodle courses put a
// YouTube/Vimeo iframe/<video><source src=...> inside the intro HTML instead
// of using the `externalurl` column.
function extractEmbeddedVideoUrl(html) {
  if (!html) return '';
  // iframe src
  let m = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  if (m && detectVideoSource(m[1])) return m[1];
  // <video><source src=...>
  m = html.match(/<source[^>]+src=["']([^"']+)["']/i);
  if (m && detectVideoSource(m[1])) return m[1];
  // raw youtube/vimeo href
  m = html.match(/href=["'](https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be|vimeo\.com)[^"']+)["']/i);
  if (m) return m[1];
  // bare URL
  m = html.match(/(https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be|vimeo\.com)[^\s"'<>]+)/i);
  if (m) return m[1];
  return '';
}

// When we promote a Moodle activity to a `video` lesson, the VideoPlayer
// already renders the videoUrl at the top. The intro HTML often duplicates
// that same video via <video><source>, <iframe>, or a bare URL — leaving
// a broken HTML5 video box rendered below. Strip those so only the prose
// accompanying text remains.
function stripRedundantVideoMarkup(html) {
  if (!html) return '';
  let out = String(html);
  // Drop full <video>...</video> blocks (any attrs, any inner markup).
  out = out.replace(/<video\b[\s\S]*?<\/video>/gi, '');
  // Drop self-closing or lone <source> tags.
  out = out.replace(/<source\b[^>]*\/?>(\s*<\/source>)?/gi, '');
  // Drop youtube/vimeo iframes.
  out = out.replace(/<iframe\b[^>]*\b(?:youtube\.com|youtu\.be|vimeo\.com)[^<]*?<\/iframe>/gi, '');
  out = out.replace(/<iframe\b[^>]*\b(?:youtube\.com|youtu\.be|vimeo\.com)[^>]*\/?>/gi, '');
  // Drop bare youtube/vimeo URLs that would render as literal text.
  out = out.replace(/https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be|vimeo\.com)[^\s"'<>]+/gi, '');
  // Collapse now-empty wrapper tags (<p></p>, <p> </p>, <div><br></div>, etc.).
  for (let i = 0; i < 3; i++) {
    out = out.replace(/<(p|div|span)\b[^>]*>\s*(?:&nbsp;|<br\s*\/?>|\s)*\s*<\/\1>/gi, '');
  }
  return out.trim();
}

const MODULE_CONTEXT_LEVEL = 70; // Moodle context level for course_modules

function jsonStringify(obj) {
  return JSON.stringify(obj);
}

function textContent(html) {
  return jsonStringify({ editorMode: 'wysiwyg', html: html || '' });
}

// Pull all file rows for a module's context. The caller uses this both to
// migrate the binaries and to resolve @@PLUGINFILE@@ placeholders.
async function loadModuleFiles(conn, prefix, cmContextId) {
  if (!cmContextId) return [];
  const rows = await query(
    conn,
    prefix,
    `SELECT id, contenthash, contextid, component, filearea, itemid,
            filepath, filename, filesize, mimetype
       FROM {files}
      WHERE contextid = ?
        AND filename <> '.'
        AND contenthash <> 'da39a3ee5e6b4b0d3255bfef95601890afd80709'`,
    [cmContextId],
  );
  return rows.filter((r) => RELEVANT_COMPONENTS.has(r.component));
}

// Moodle 4.x stores context rows with contextlevel=70, instanceid=cmid.
async function getCmContextId(conn, prefix, cmid) {
  const [row] = await query(
    conn,
    prefix,
    'SELECT id FROM {context} WHERE contextlevel = ? AND instanceid = ? LIMIT 1',
    [MODULE_CONTEXT_LEVEL, cmid],
  );
  return row ? row.id : null;
}

// Migrate every file in `files` that matches `filearea`, return as an array
// of ResourceFile-like objects AND a Map keyed by "/<filepath><filename>"
// for @@PLUGINFILE@@ placeholder resolution.
async function migrateFileArea(fileMigrator, files, filearea, { courseDocId, lessonDocId }) {
  const selected = files.filter((f) => f.filearea === filearea);
  const migrated = [];
  const lookup = new Map();
  for (const f of selected) {
    const out = await fileMigrator.migrateFile(f, { courseDocId, lessonDocId });
    if (out) {
      migrated.push(out);
      const key = `${f.filepath || '/'}${f.filename}`;
      lookup.set(key, out);
    }
  }
  return { migrated, lookup };
}

// --- per-type builders ---
// Each returns { type, content, duration?, extras } where `content` is a
// JSON string ready to go into Firestore.

async function dispatchQuiz({ conn, prefix, cm, instance, fileMigrator, courseDocId, lessonDocId, warnings }) {
  const [quizRow] = await query(
    conn,
    prefix,
    'SELECT id, course, name, intro, timelimit, shuffleanswers, grade, sumgrades FROM {quiz} WHERE id = ? LIMIT 1',
    [instance],
  );
  if (!quizRow) {
    warnings.push(`cmid=${cm.id}: quiz instance ${instance} not found`);
    return null;
  }
  const built = await buildQuizContent(conn, prefix, quizRow, warnings);
  return {
    title: quizRow.name,
    description: '',
    type: 'quiz',
    content: jsonStringify(built.content),
    settingsExtras: {
      passingScore: built.content.settings.passingScore,
      maxAttempts: 3,
      ...(built.content.settings.timeLimit ? { timeLimit: built.content.settings.timeLimit } : {}),
    },
  };
}

async function dispatchAssign({ conn, prefix, cm, instance, fileMigrator, courseDocId, lessonDocId, warnings, cmContextId, files }) {
  const [row] = await query(
    conn,
    prefix,
    'SELECT id, course, name, intro, grade, duedate, allowsubmissionsfromdate FROM {assign} WHERE id = ? LIMIT 1',
    [instance],
  );
  if (!row) {
    warnings.push(`cmid=${cm.id}: assign instance ${instance} not found`);
    return null;
  }
  const { migrated: refFiles, lookup } = await migrateFileArea(
    fileMigrator,
    files,
    'introattachment',
    { courseDocId, lessonDocId },
  );
  // Introfiles for HTML placeholder rewriting
  const introLookup = new Map(lookup);
  const { migrated: introImages } = await migrateFileArea(
    fileMigrator,
    files,
    'intro',
    { courseDocId, lessonDocId },
  );
  // also rewrite intro image references via their own lookup
  for (const f of files.filter((f) => f.filearea === 'intro')) {
    const out = introImages.find((m) => m.name === f.filename);
    if (out) introLookup.set(`${f.filepath || '/'}${f.filename}`, out);
  }
  row.intro = fileMigrator.rewritePluginfileHtml(row.intro, introLookup);

  const built = await buildTareaContent(conn, prefix, row, refFiles);
  return {
    title: row.name,
    description: '',
    type: 'tarea',
    content: jsonStringify(built),
    settingsExtras: {},
  };
}

async function dispatchPage({ conn, prefix, cm, instance, fileMigrator, courseDocId, lessonDocId, warnings, files }) {
  const [row] = await query(
    conn,
    prefix,
    'SELECT id, name, intro, content FROM {page} WHERE id = ? LIMIT 1',
    [instance],
  );
  if (!row) {
    warnings.push(`cmid=${cm.id}: page instance ${instance} not found`);
    return null;
  }
  const { lookup } = await migrateFileArea(fileMigrator, files, 'content', { courseDocId, lessonDocId });
  const html = fileMigrator.rewritePluginfileHtml(row.content, lookup);

  // If the page is *essentially* an embedded video (YouTube/Vimeo/direct
  // video URL in the first iframe/source/href), build a video lesson so the
  // VideoPlayer embed works natively instead of relying on <iframe> inside
  // sanitised rich text.
  const embedded = extractEmbeddedVideoUrl(html);
  const videoSource = detectVideoSource(embedded);
  if (videoSource) {
    return {
      title: row.name,
      description: '',
      type: 'video',
      content: jsonStringify({
        videoUrl: embedded,
        videoSource,
        textContent: stripRedundantVideoMarkup(html),
      }),
      settingsExtras: {},
    };
  }

  return {
    title: row.name,
    description: '',
    type: 'texto',
    content: textContent(html),
    settingsExtras: {},
  };
}

async function dispatchLabel({ conn, prefix, cm, instance, fileMigrator, courseDocId, lessonDocId, warnings, files }) {
  const [row] = await query(
    conn,
    prefix,
    'SELECT id, name, intro FROM {label} WHERE id = ? LIMIT 1',
    [instance],
  );
  if (!row) {
    warnings.push(`cmid=${cm.id}: label instance ${instance} not found`);
    return null;
  }
  const { lookup } = await migrateFileArea(fileMigrator, files, 'intro', { courseDocId, lessonDocId });
  const html = fileMigrator.rewritePluginfileHtml(row.intro, lookup);

  // Label with an embedded video → promote to video lesson (same reasoning
  // as dispatchPage).
  const embedded = extractEmbeddedVideoUrl(html);
  const videoSource = detectVideoSource(embedded);
  if (videoSource) {
    return {
      title: row.name || 'Video',
      description: '',
      type: 'video',
      content: jsonStringify({
        videoUrl: embedded,
        videoSource,
        textContent: stripRedundantVideoMarkup(html),
      }),
      settingsExtras: {},
    };
  }

  return {
    title: row.name || 'Etiqueta',
    description: '',
    type: 'texto',
    content: textContent(html),
    settingsExtras: {},
  };
}

async function dispatchBook({ conn, prefix, cm, instance, fileMigrator, courseDocId, lessonDocId, warnings, files }) {
  const [row] = await query(
    conn,
    prefix,
    'SELECT id, name, intro FROM {book} WHERE id = ? LIMIT 1',
    [instance],
  );
  if (!row) {
    warnings.push(`cmid=${cm.id}: book instance ${instance} not found`);
    return null;
  }
  const chapters = await query(
    conn,
    prefix,
    'SELECT id, title, content, pagenum FROM {book_chapters} WHERE bookid = ? AND hidden = 0 ORDER BY pagenum',
    [row.id],
  );
  const { lookup } = await migrateFileArea(fileMigrator, files, 'chapter', { courseDocId, lessonDocId });
  const combined = chapters
    .map((c) => `<h2>${c.title || ''}</h2>\n${fileMigrator.rewritePluginfileHtml(c.content || '', lookup)}`)
    .join('\n<hr />\n');
  return {
    title: row.name,
    description: row.intro || '',
    type: 'texto',
    content: textContent(combined),
    settingsExtras: {},
  };
}

async function dispatchLesson({ conn, prefix, cm, instance, fileMigrator, courseDocId, lessonDocId, warnings, files }) {
  const [row] = await query(
    conn,
    prefix,
    'SELECT id, name, intro FROM {lesson} WHERE id = ? LIMIT 1',
    [instance],
  );
  if (!row) {
    warnings.push(`cmid=${cm.id}: lesson instance ${instance} not found`);
    return null;
  }
  const pages = await query(
    conn,
    prefix,
    'SELECT id, title, contents FROM {lesson_pages} WHERE lessonid = ? ORDER BY id',
    [row.id],
  );
  const { lookup } = await migrateFileArea(fileMigrator, files, 'page_contents', { courseDocId, lessonDocId });
  const combined = pages
    .map((p) => `<h2>${p.title || ''}</h2>\n${fileMigrator.rewritePluginfileHtml(p.contents || '', lookup)}`)
    .join('\n<hr />\n');
  return {
    title: row.name,
    description: row.intro || '',
    type: 'texto',
    content: textContent(combined || row.intro || ''),
    settingsExtras: {},
  };
}

async function dispatchResource({ conn, prefix, cm, instance, fileMigrator, courseDocId, lessonDocId, warnings, files }) {
  const [row] = await query(
    conn,
    prefix,
    'SELECT id, name, intro FROM {resource} WHERE id = ? LIMIT 1',
    [instance],
  );
  if (!row) {
    warnings.push(`cmid=${cm.id}: resource instance ${instance} not found`);
    return null;
  }
  const { migrated: docs, lookup } = await migrateFileArea(
    fileMigrator,
    files,
    'content',
    { courseDocId, lessonDocId },
  );
  const { lookup: introLookup } = await migrateFileArea(
    fileMigrator,
    files,
    'intro',
    { courseDocId, lessonDocId },
  );
  const mergedLookup = new Map([...lookup, ...introLookup]);
  const html = fileMigrator.rewritePluginfileHtml(row.intro || '', mergedLookup);
  return {
    title: row.name,
    description: '',
    type: 'recurso',
    content: jsonStringify({ textContent: html, files: docs }),
    settingsExtras: {},
  };
}

async function dispatchFolder({ conn, prefix, cm, instance, fileMigrator, courseDocId, lessonDocId, warnings, files }) {
  const [row] = await query(
    conn,
    prefix,
    'SELECT id, name, intro FROM {folder} WHERE id = ? LIMIT 1',
    [instance],
  );
  if (!row) {
    warnings.push(`cmid=${cm.id}: folder instance ${instance} not found`);
    return null;
  }
  const { migrated: docs } = await migrateFileArea(
    fileMigrator,
    files,
    'content',
    { courseDocId, lessonDocId },
  );
  return {
    title: row.name,
    description: '',
    type: 'recurso',
    content: jsonStringify({ textContent: row.intro || '', files: docs }),
    settingsExtras: {},
  };
}

async function dispatchUrl({ conn, prefix, cm, instance, warnings }) {
  const [row] = await query(
    conn,
    prefix,
    'SELECT id, name, intro, externalurl FROM {url} WHERE id = ? LIMIT 1',
    [instance],
  );
  if (!row) {
    warnings.push(`cmid=${cm.id}: url instance ${instance} not found`);
    return null;
  }

  // If the externalurl is a YouTube/Vimeo/direct-video URL, build a video
  // lesson (what VideoLessonView expects: { videoUrl, videoSource, textContent }).
  const videoSource = detectVideoSource(row.externalurl || '');
  if (videoSource) {
    return {
      title: row.name,
      description: '',
      type: 'video',
      content: jsonStringify({
        videoUrl: row.externalurl,
        videoSource,
        textContent: stripRedundantVideoMarkup(row.intro || ''),
      }),
      settingsExtras: {},
    };
  }

  // Otherwise — external link. Render as a recurso with the link listed.
  const files = row.externalurl
    ? [{
        id: `mdl_url_${row.id}`,
        name: row.name,
        url: row.externalurl,
        size: 0,
        contentType: 'text/uri-list',
      }]
    : [];
  return {
    title: row.name,
    description: '',
    type: 'recurso',
    content: jsonStringify({ textContent: row.intro || '', files }),
    settingsExtras: {},
  };
}

async function dispatchForum({ conn, prefix, cm, instance, warnings }) {
  const [row] = await query(
    conn,
    prefix,
    'SELECT id, name, intro, type FROM {forum} WHERE id = ? LIMIT 1',
    [instance],
  );
  if (!row) {
    warnings.push(`cmid=${cm.id}: forum instance ${instance} not found`);
    return null;
  }

  // `prompt` is rendered as plain text in LessonForumView (no
  // dangerouslySetInnerHTML, and the editor is a plain textarea). Strip the
  // Moodle HTML + decode entities + respect the 2000-char editor cap.
  const promptText = stripHtmlToText(row.intro || row.name || '').slice(0, 2000);

  return {
    title: row.name,
    description: '',
    type: 'foro',
    content: jsonStringify({
      prompt: promptText,
      settings: {
        allowNewThreads: row.type !== 'single',
        requirePost: true,
        requireReply: false,
      },
    }),
    settingsExtras: {},
  };
}

const DISPATCH = {
  quiz: dispatchQuiz,
  assign: dispatchAssign,
  page: dispatchPage,
  label: dispatchLabel,
  book: dispatchBook,
  lesson: dispatchLesson,
  resource: dispatchResource,
  folder: dispatchFolder,
  url: dispatchUrl,
  forum: dispatchForum,
};

// Types we explicitly skip (no lasaedu v1 equivalent).
const SKIP_TYPES = new Set([
  'h5pactivity', 'scorm', 'lti', 'workshop', 'choice', 'feedback',
  'survey', 'chat', 'wiki', 'data', 'glossary', 'imscp', 'bigbluebuttonbn',
  'subsection',
]);

// Public API — returns a lesson shape ready for Firestore, or null + warning.
export async function buildLessonFromCourseModule({
  conn, prefix, cm, moduleName, order, courseDocId, fileMigrator, warnings,
}) {
  const lessonDocId = `mdl_lsn_${cm.id}`;

  if (SKIP_TYPES.has(moduleName)) {
    warnings.push(`cmid=${cm.id} type=${moduleName}: no lasaedu equivalent, skipped`);
    return null;
  }

  const builder = DISPATCH[moduleName];
  if (!builder) {
    warnings.push(`cmid=${cm.id} type=${moduleName}: no dispatcher, skipped`);
    return null;
  }

  const cmContextId = await getCmContextId(conn, prefix, cm.id);
  const files = await loadModuleFiles(conn, prefix, cmContextId);

  const built = await builder({
    conn,
    prefix,
    cm,
    instance: cm.instance,
    fileMigrator,
    courseDocId,
    lessonDocId,
    warnings,
    cmContextId,
    files,
  });
  if (!built) return null;

  return {
    lessonDocId,
    lessonDoc: {
      id: lessonDocId,
      title: built.title || `Lección ${order + 1}`,
      description: built.description || '',
      type: built.type,
      content: built.content,
      order,
      settings: {
        isRequired: true,
        allowComments: true,
        showProgress: true,
        ...built.settingsExtras,
      },
      status: Number(cm.visible) === 0 ? 'borrador' : 'publicado',
    },
    sourceType: moduleName,
  };
}
