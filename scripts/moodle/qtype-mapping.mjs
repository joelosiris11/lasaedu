// Moodle `qtype` → lasaedu `QuizQuestionType` mapping rules.
//
// See the mapping table in the implementation plan and
// src/modules/courses/components/QuizLessonEditor.tsx:22-29 for the target
// types. The `buildQuestions` helper in quizzes.mjs does the heavy lifting;
// this module owns the lookup + small helpers that stay pure.

export const LASAEDU_QUESTION_TYPES = [
  'context',
  'true_false',
  'single_choice',
  'multiple_choice',
  'match_drag',
  'match_dropdown',
  'open_answer',
];

// How the source Moodle qtype maps to a lasaedu type (or `null` if we skip
// it). `needsWarning: true` means we converted but lost fidelity — the user
// should review the question manually.
export const QTYPE_RULES = {
  multichoice:      { target: 'multiple_choice', needsWarning: false },
  truefalse:        { target: 'true_false',      needsWarning: false },
  shortanswer:      { target: 'open_answer',     needsWarning: false },
  numerical:        { target: 'open_answer',     needsWarning: false },
  match:            { target: 'match_dropdown',  needsWarning: false },
  ddwtos:           { target: 'match_dropdown',  needsWarning: true },
  gapselect:        { target: 'match_dropdown',  needsWarning: true },
  ddmarker:         { target: 'match_dropdown',  needsWarning: true },
  ddimageortext:    { target: 'match_drag',      needsWarning: true },
  description:      { target: 'context',         needsWarning: false },
  essay:            { target: 'open_answer',     needsWarning: true },
  calculated:       { target: 'open_answer',     needsWarning: true },
  calculatedsimple: { target: 'open_answer',     needsWarning: true },
  calculatedmulti:  { target: 'open_answer',     needsWarning: true },
  multianswer:      { target: 'context',         needsWarning: true },
  random:           { target: null,              needsWarning: true },
  randomsamatch:    { target: null,              needsWarning: true },
};

export function targetForQtype(qtype) {
  return QTYPE_RULES[qtype] || { target: null, needsWarning: true };
}

// Moodle stores short-answer text with trailing newlines and HTML entities.
// The quiz editor normalises student input to NFD-stripped lowercase; we
// store accepted answers as-typed but trim/strip so the comparator has a
// clean target.
export function normaliseAcceptedAnswer(text) {
  if (text === null || text === undefined) return '';
  const stripped = String(text).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
  return stripped;
}

// Strip HTML, collapse whitespace, trim — used for Moodle multichoice answer
// text so a plain-ish option string lands in Firestore.
export function stripHtmlToText(html) {
  if (!html) return '';
  return String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
