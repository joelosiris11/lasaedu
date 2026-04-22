// Moodle quiz → lasaedu QuizLessonContent.
//
// Join path for slot → question (Moodle 4.x schema):
//   quiz_slots.id
//     → question_references.itemid  (component='mod_quiz', questionarea='slot')
//     → question_references.questionbankentryid
//     → question_versions.questionbankentryid (pick MAX(version))
//     → question_versions.questionid
//     → question
//
// Each Moodle question row has a qtype; we dispatch to a per-type builder
// that returns a lasaedu QuizQuestion shape (see QuizLessonEditor.tsx).

import { query } from './db.mjs';
import { targetForQtype, stripHtmlToText, normaliseAcceptedAnswer } from './qtype-mapping.mjs';

// Stable doc-id-style prefix — lets us use Moodle IDs inside question IDs so
// re-runs regenerate the same structure.
const qid = (moodleQuestionId, suffix) =>
  suffix ? `mdl_q_${moodleQuestionId}_${suffix}` : `mdl_q_${moodleQuestionId}`;

// Lightweight builders matching the QuizQuestion interface.
function buildContext(mq) {
  return {
    id: qid(mq.id),
    type: 'context',
    question: mq.questiontext || mq.name || '',
    points: 0,
  };
}

function buildTrueFalse(mq, answers) {
  // In Moodle truefalse, each row is one answer ('True'/'False') with fraction.
  const trueRow = answers.find((a) => /^true$/i.test(a.answer || ''));
  const correctBool = trueRow ? Number(trueRow.fraction) === 1 : false;
  return {
    id: qid(mq.id),
    type: 'true_false',
    question: mq.questiontext || mq.name || '',
    points: Math.max(1, Math.round(Number(mq.defaultmark) || 1)),
    correctBool,
    explanation: mq.generalfeedback || undefined,
  };
}

function buildChoice(mq, answers, isSingle) {
  const options = answers
    .filter((a) => a.answer && a.answer.trim() !== '')
    .map((a, idx) => ({
      id: qid(mq.id, `o${idx}`),
      text: stripHtmlToText(a.answer),
      isCorrect: Number(a.fraction) > 0,
    }));

  return {
    id: qid(mq.id),
    type: isSingle ? 'single_choice' : 'multiple_choice',
    question: mq.questiontext || mq.name || '',
    points: Math.max(1, Math.round(Number(mq.defaultmark) || 1)),
    options,
    explanation: mq.generalfeedback || undefined,
  };
}

function buildOpen(mq, answers) {
  const accepted = answers
    .filter((a) => Number(a.fraction) === 1)
    .map((a) => normaliseAcceptedAnswer(a.answer))
    .filter(Boolean);
  // If Moodle had no fully-correct row (unusual), fall back to all non-empty.
  const fallback = answers
    .map((a) => normaliseAcceptedAnswer(a.answer))
    .filter(Boolean);

  return {
    id: qid(mq.id),
    type: 'open_answer',
    question: mq.questiontext || mq.name || '',
    points: Math.max(1, Math.round(Number(mq.defaultmark) || 1)),
    acceptedAnswers: accepted.length > 0 ? accepted : fallback,
    explanation: mq.generalfeedback || undefined,
  };
}

function buildMatchFromSubs(mq, subs) {
  const pairs = subs
    .filter((s) => s.questiontext && s.answertext)
    .map((s, idx) => ({
      id: qid(mq.id, `p${idx}`),
      left: stripHtmlToText(s.questiontext),
      right: stripHtmlToText(s.answertext),
    }));
  return {
    id: qid(mq.id),
    type: 'match_dropdown',
    question: mq.questiontext || mq.name || '',
    points: Math.max(1, Math.round(Number(mq.defaultmark) || 1)),
    pairs: pairs.length >= 2 ? pairs : [
      { id: qid(mq.id, 'p0'), left: '', right: '' },
      { id: qid(mq.id, 'p1'), left: '', right: '' },
    ],
    explanation: mq.generalfeedback || undefined,
  };
}

// Returns an array of QuizQuestion, including warnings in the second slot.
async function buildOneQuestion(conn, prefix, mq, warnings) {
  const rule = targetForQtype(mq.qtype);
  if (!rule.target) {
    warnings.push(`qtype "${mq.qtype}" skipped (no lasaedu equivalent) — question id=${mq.id}`);
    return null;
  }

  const answers = await query(
    conn,
    prefix,
    'SELECT id, answer, fraction, feedback FROM {question_answers} WHERE question = ? ORDER BY id',
    [mq.id],
  );

  if (rule.target === 'context') {
    if (rule.needsWarning) {
      warnings.push(`qtype "${mq.qtype}" converted to context (lossy) — question id=${mq.id}`);
    }
    return buildContext(mq);
  }

  if (rule.target === 'true_false') return buildTrueFalse(mq, answers);

  if (rule.target === 'single_choice' || rule.target === 'multiple_choice') {
    let isSingle = rule.target === 'single_choice';
    if (mq.qtype === 'multichoice') {
      const [opt] = await query(
        conn,
        prefix,
        'SELECT single FROM {qtype_multichoice_options} WHERE questionid = ? LIMIT 1',
        [mq.id],
      );
      if (opt) isSingle = Number(opt.single) === 1;
    }
    return buildChoice(mq, answers, isSingle);
  }

  if (rule.target === 'open_answer') {
    if (rule.needsWarning) {
      warnings.push(`qtype "${mq.qtype}" mapped to open_answer — review question id=${mq.id}`);
    }
    return buildOpen(mq, answers);
  }

  if (rule.target === 'match_dropdown') {
    const subs = await query(
      conn,
      prefix,
      'SELECT id, questiontext, answertext FROM {qtype_match_subquestions} WHERE questionid = ? ORDER BY id',
      [mq.id],
    );
    if (rule.needsWarning) {
      warnings.push(`qtype "${mq.qtype}" approximated as match_dropdown — review question id=${mq.id}`);
    }
    return buildMatchFromSubs(mq, subs);
  }

  warnings.push(`qtype "${mq.qtype}" → ${rule.target} has no builder — question id=${mq.id}`);
  return null;
}

// Pull all slot/question rows for a quiz, resolve to the latest question
// version, and build the lasaedu QuizLessonContent payload.
export async function buildQuizContent(conn, prefix, quizRow, warnings) {
  const slots = await query(
    conn,
    prefix,
    'SELECT id, slot, maxmark FROM {quiz_slots} WHERE quizid = ? ORDER BY slot',
    [quizRow.id],
  );

  const questions = [];
  let totalPoints = 0;

  for (const slot of slots) {
    // slot.id → question_references.itemid (component='mod_quiz', questionarea='slot')
    const [ref] = await query(
      conn,
      prefix,
      `SELECT questionbankentryid
         FROM {question_references}
        WHERE component = 'mod_quiz'
          AND questionarea = 'slot'
          AND itemid = ?
        LIMIT 1`,
      [slot.id],
    );
    if (!ref) {
      warnings.push(`quiz ${quizRow.id} slot ${slot.slot}: no question_reference row`);
      continue;
    }

    // Pick the most recent "ready" version.
    const [ver] = await query(
      conn,
      prefix,
      `SELECT questionid
         FROM {question_versions}
        WHERE questionbankentryid = ?
        ORDER BY version DESC
        LIMIT 1`,
      [ref.questionbankentryid],
    );
    if (!ver) {
      warnings.push(`quiz ${quizRow.id} slot ${slot.slot}: no question_version row`);
      continue;
    }

    const [mq] = await query(
      conn,
      prefix,
      `SELECT id, name, questiontext, generalfeedback, defaultmark, qtype
         FROM {question}
        WHERE id = ?
        LIMIT 1`,
      [ver.questionid],
    );
    if (!mq) {
      warnings.push(`quiz ${quizRow.id} slot ${slot.slot}: question ${ver.questionid} missing`);
      continue;
    }

    // Per-slot maxmark overrides question defaultmark for scoring.
    const slotMark = Number(slot.maxmark) || Number(mq.defaultmark) || 1;
    mq.defaultmark = slotMark;

    const built = await buildOneQuestion(conn, prefix, mq, warnings);
    if (!built) continue;
    totalPoints += Number(built.points) || 0;
    questions.push(built);
  }

  const passingScore = 70; // Moodle quiz.gradepass column doesn't exist in this dump

  return {
    content: {
      questions,
      settings: {
        shuffleQuestions: false,
        shuffleOptions: Number(quizRow.shuffleanswers) === 1,
        showResults: true,
        showCorrectAnswers: true,
        passingScore,
        ...(Number(quizRow.timelimit) > 0 ? { timeLimit: Number(quizRow.timelimit) } : {}),
      },
    },
    totalPoints,
    questionCount: questions.length,
  };
}
