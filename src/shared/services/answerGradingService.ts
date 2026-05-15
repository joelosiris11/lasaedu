import { auth } from '@app/config/firebase';

/**
 * Auto-grades a free-text answer against a teacher-authored rubric + course
 * context. The caller MUST NOT surface any reference to "AI", "Gemini" or
 * similar to the student — UI should present the score and feedback exactly
 * as if a human had assigned them. The teacher dashboard can override the
 * suggested score.
 *
 * The server-side endpoint hardens its system prompt against prompt
 * injection coming through `studentAnswer`. See server/index.js
 * `/ai/grade-answer` for the full hardening rules.
 */

const PROXY_PATH = '/ai/grade-answer';

function getProxyUrl(): string {
  const explicit = import.meta.env.VITE_AI_GRADE_PROXY_URL as string | undefined;
  if (explicit) return explicit;
  const base = (import.meta.env.VITE_FILE_SERVER_URL as string | undefined) ?? '';
  return `${base.replace(/\/+$/, '')}${PROXY_PATH}`;
}

export interface GradeAnswerInput {
  question: string;
  studentAnswer: string;
  maxPoints: number;
  rubric?: string;
  keyConcepts?: string[];
  sampleAnswer?: string;
  /** Trimmed concatenation of relevant lesson text from the course. */
  courseContext?: string;
  /** 'es' (default) | 'en' */
  language?: 'es' | 'en';
}

export interface GradeAnswerResult {
  score: number;
  maxPoints: number;
  /** 0..1 */
  normalized: number;
  /** Student-facing message; safe to display verbatim. */
  feedback: string;
  /** Teacher-only justification. NEVER show to the student. */
  rationale: string;
  /** Underlying model id — for teacher audit only. */
  model: string;
}

export async function gradeOpenAnswer(input: GradeAnswerInput): Promise<GradeAnswerResult> {
  const trimmed = input.studentAnswer?.trim() ?? '';
  if (!trimmed) {
    return {
      score: 0,
      maxPoints: input.maxPoints,
      normalized: 0,
      feedback: 'No se recibió respuesta.',
      rationale: 'empty_answer',
      model: 'n/a',
    };
  }

  const idToken = await auth.currentUser?.getIdToken().catch(() => '');
  const res = await fetch(getProxyUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    // Fail closed: never throw at the student. Hand back a neutral
    // "pending review" result and let the teacher resolve manually.
    let detail = `status ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) detail = body.error;
    } catch {
      /* ignore */
    }
    return {
      score: 0,
      maxPoints: input.maxPoints,
      normalized: 0,
      feedback: 'Tu respuesta quedó registrada y será revisada por el profesor.',
      rationale: `grading_unavailable: ${detail}`,
      model: 'n/a',
    };
  }

  return (await res.json()) as GradeAnswerResult;
}

/**
 * Builds a compact course-context string from a list of lesson texts, capped
 * at ~12K chars to fit the server-side budget. Keep the input small — the
 * server clamps anyway, but trimming on the client saves bandwidth.
 */
export function buildCourseContext(
  parts: Array<{ title?: string; content?: string }>,
  maxChars = 10_000,
): string {
  const out: string[] = [];
  let used = 0;
  for (const p of parts) {
    if (!p?.content) continue;
    const block = `${p.title ? `## ${p.title}\n` : ''}${p.content}\n\n`;
    if (used + block.length > maxChars) {
      const remaining = maxChars - used;
      if (remaining > 200) out.push(block.slice(0, remaining));
      break;
    }
    out.push(block);
    used += block.length;
  }
  return out.join('').trim();
}
