import { firebaseDB } from '@shared/services/firebaseDataService';
import { DEFAULT_SYSTEM_PROMPT } from './defaultPrompt';

export interface DBPromptVersion {
  id: string;
  content: string;
  reason: string;
  createdAt: number;
  createdBy: string; // user id, or 'system' for the seed
  createdByName: string;
  isActive: boolean;
  // Increments on each new version. Useful so the UI can show v1/v2/…
  // without dependent on createdAt sort.
  versionNumber: number;
}

const COLLECTION = 'aiAssistantPrompts';
const MAX_VERSIONS = 5;

async function getAllVersions(): Promise<DBPromptVersion[]> {
  const all = await firebaseDB.getAll<DBPromptVersion>(COLLECTION);
  return [...all].sort((a, b) => b.createdAt - a.createdAt);
}

async function seedDefaultIfEmpty(userId: string, userName: string): Promise<DBPromptVersion> {
  const seed: Omit<DBPromptVersion, 'id'> = {
    content: DEFAULT_SYSTEM_PROMPT,
    reason: 'Versión inicial del sistema',
    createdAt: Date.now(),
    createdBy: userId || 'system',
    createdByName: userName || 'Sistema',
    isActive: true,
    versionNumber: 1,
  };
  return firebaseDB.create<DBPromptVersion>(COLLECTION, seed);
}

/**
 * Returns the currently active prompt. If no versions exist, seeds the
 * default and returns it. If multiple are marked active (shouldn't happen
 * normally), returns the most recent to recover gracefully.
 */
export async function getActivePrompt(
  userId: string,
  userName: string,
): Promise<DBPromptVersion> {
  const all = await getAllVersions();
  if (all.length === 0) {
    return seedDefaultIfEmpty(userId, userName);
  }
  const active = all.filter((v) => v.isActive);
  if (active.length === 0) {
    const latest = all[0];
    await firebaseDB.update<DBPromptVersion>(COLLECTION, latest.id, { isActive: true });
    return { ...latest, isActive: true };
  }
  return active.sort((a, b) => b.createdAt - a.createdAt)[0];
}

export async function listVersions(): Promise<DBPromptVersion[]> {
  return getAllVersions();
}

async function deactivateAll(except?: string): Promise<void> {
  const all = await getAllVersions();
  await Promise.all(
    all
      .filter((v) => v.isActive && v.id !== except)
      .map((v) => firebaseDB.update<DBPromptVersion>(COLLECTION, v.id, { isActive: false })),
  );
}

/**
 * Creates a new version, marks it active, deactivates all others, and
 * trims the history to MAX_VERSIONS entries (deletes oldest). Returns the
 * new active version plus the previously active id (useful for undo).
 */
export async function createVersion({
  content,
  reason,
  userId,
  userName,
}: {
  content: string;
  reason: string;
  userId: string;
  userName: string;
}): Promise<{ created: DBPromptVersion; previousActiveId: string | null }> {
  const trimmed = content.trim();
  if (!trimmed) throw new Error('El prompt no puede estar vacío');
  if (!reason.trim()) throw new Error('Indica una razón breve para la nueva versión');

  const existing = await getAllVersions();
  const previousActiveId = existing.find((v) => v.isActive)?.id ?? null;
  const nextVersionNumber =
    existing.reduce((max, v) => Math.max(max, v.versionNumber || 0), 0) + 1;

  const created = await firebaseDB.create<DBPromptVersion>(COLLECTION, {
    content: trimmed,
    reason: reason.trim(),
    createdAt: Date.now(),
    createdBy: userId,
    createdByName: userName,
    isActive: true,
    versionNumber: nextVersionNumber,
  });

  await deactivateAll(created.id);

  // Trim history: keep the 5 most recent. Active ones are always kept (the
  // new one is active), and we only created one active, so this just drops
  // inactive excess.
  const afterInsert = await getAllVersions();
  if (afterInsert.length > MAX_VERSIONS) {
    const excess = afterInsert
      .filter((v) => !v.isActive)
      .slice(MAX_VERSIONS - 1); // keep (MAX-1) inactive + 1 active
    await Promise.all(excess.map((v) => firebaseDB.delete(COLLECTION, v.id)));
  }

  return { created, previousActiveId };
}

export async function activateVersion(id: string): Promise<DBPromptVersion> {
  const target = await firebaseDB.getById<DBPromptVersion>(COLLECTION, id);
  if (!target) throw new Error(`Versión ${id} no existe`);
  if (target.isActive) return target;
  await deactivateAll(id);
  await firebaseDB.update<DBPromptVersion>(COLLECTION, id, { isActive: true });
  return { ...target, isActive: true };
}
