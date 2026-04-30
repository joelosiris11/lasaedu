import { firebaseDB } from '@shared/services/firebaseDataService';
import type { ChatMessage } from '../types';

/**
 * Persisted chat session between an admin and Lasa. Sessions are keyed by
 * user so the sidebar can show "previous chats" and restore a full
 * conversation when the admin clicks one.
 *
 * `historyJson` holds the Ollama `OllamaMessage[]` array stringified —
 * we keep it as a string so this service stays decoupled from the AI client.
 */
export interface DBChatSession {
  id: string;
  userId: string;
  title: string;
  courseId: string | null;
  courseTitle: string | null;
  sectionId: string | null;
  sectionTitle: string | null;
  messages: ChatMessage[];
  historyJson: string;
  createdAt: number;
  updatedAt: number;
}

const COLLECTION = 'aiAssistantSessions';
const MAX_SESSIONS_PER_USER = 30;

/**
 * Returns the most recent sessions for this admin, newest first.
 * Trims to MAX_SESSIONS_PER_USER — older ones get deleted on the next save.
 */
export async function listSessions(userId: string): Promise<DBChatSession[]> {
  const all = await firebaseDB.getAll<DBChatSession>(COLLECTION);
  return all
    .filter((s) => s.userId === userId)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getSession(id: string): Promise<DBChatSession | null> {
  return firebaseDB.getById<DBChatSession>(COLLECTION, id);
}

function deriveTitle(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === 'user');
  if (!first) return 'Nuevo chat';
  const clean = first.text.replace(/\s+/g, ' ').trim();
  return clean.length > 80 ? `${clean.slice(0, 80)}…` : clean || 'Nuevo chat';
}

export interface CreateSessionArgs {
  userId: string;
  courseId: string | null;
  courseTitle: string | null;
  sectionId: string | null;
  sectionTitle: string | null;
  messages: ChatMessage[];
  historyJson: string;
}

export async function createSession(args: CreateSessionArgs): Promise<DBChatSession> {
  const now = Date.now();
  const created = await firebaseDB.create<DBChatSession>(COLLECTION, {
    userId: args.userId,
    title: deriveTitle(args.messages),
    courseId: args.courseId,
    courseTitle: args.courseTitle,
    sectionId: args.sectionId,
    sectionTitle: args.sectionTitle,
    messages: args.messages,
    historyJson: args.historyJson,
    createdAt: now,
    updatedAt: now,
  });
  // Trim oldest if we are over the cap.
  trimOldSessions(args.userId).catch((err) => console.error('[chatSessions] trim failed', err));
  return created;
}

export async function updateSession(
  id: string,
  patch: Partial<Pick<DBChatSession, 'messages' | 'historyJson' | 'courseId' | 'courseTitle' | 'sectionId' | 'sectionTitle' | 'title'>>,
): Promise<void> {
  const toWrite: Partial<DBChatSession> = { ...patch, updatedAt: Date.now() };
  // Refresh title from latest messages if not explicitly provided.
  if (!patch.title && patch.messages) {
    toWrite.title = deriveTitle(patch.messages);
  }
  await firebaseDB.update<DBChatSession>(COLLECTION, id, toWrite);
}

export async function deleteSession(id: string): Promise<void> {
  await firebaseDB.delete(COLLECTION, id);
}

async function trimOldSessions(userId: string): Promise<void> {
  const sessions = await listSessions(userId);
  if (sessions.length <= MAX_SESSIONS_PER_USER) return;
  const excess = sessions.slice(MAX_SESSIONS_PER_USER);
  await Promise.all(excess.map((s) => firebaseDB.delete(COLLECTION, s.id)));
}
