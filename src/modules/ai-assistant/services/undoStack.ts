import { create } from 'zustand';
import type { UndoEntry } from '../types';

interface UndoStackState {
  entries: UndoEntry[];
  register: (entry: Omit<UndoEntry, 'applied'>) => string;
  markApplied: (id: string) => void;
  undo: (id: string) => Promise<boolean>;
  clear: () => void;
  get: (id: string) => UndoEntry | undefined;
}

export const useUndoStack = create<UndoStackState>((set, get) => ({
  entries: [],

  register: (entry) => {
    const full: UndoEntry = { ...entry, applied: false };
    set((s) => ({ entries: [full, ...s.entries].slice(0, 30) }));
    return entry.id;
  },

  markApplied: (id) => {
    set((s) => ({
      entries: s.entries.map((e) => (e.id === id ? { ...e, applied: true } : e)),
    }));
  },

  undo: async (id) => {
    const entry = get().entries.find((e) => e.id === id);
    if (!entry || entry.applied) return false;
    try {
      const ok = await entry.execute();
      if (ok) {
        set((s) => ({
          entries: s.entries.map((e) => (e.id === id ? { ...e, applied: true } : e)),
        }));
      }
      return ok;
    } catch (err) {
      console.error('[undoStack] failed to undo', id, err);
      return false;
    }
  },

  clear: () => set({ entries: [] }),

  get: (id) => get().entries.find((e) => e.id === id),
}));

// Helper: generate a short id for undo entries.
export const newUndoId = (): string =>
  `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
