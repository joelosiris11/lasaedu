import { create } from 'zustand';
import type { ReactNode } from 'react';

export interface HeaderOverride {
  title: string;
  subtitle?: string;
  /** When set, the header shows a back button that calls this handler. */
  onBack?: () => void;
  /** Extra action buttons (e.g. Save / Preview) rendered on the right side. */
  actions?: ReactNode;
}

interface HeaderStore {
  override: HeaderOverride | null;
  setOverride: (v: HeaderOverride | null) => void;
}

export const useHeaderStore = create<HeaderStore>((set) => ({
  override: null,
  setOverride: (v) => set({ override: v }),
}));
