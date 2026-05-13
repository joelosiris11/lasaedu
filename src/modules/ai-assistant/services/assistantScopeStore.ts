import { create } from 'zustand';

// Lightweight shared scope between AIAssistantPage and the per-message
// ToolCallCard. Keeps the chat UI decoupled: the card can read which course
// (and optional section) is active when offering "apply as cover" actions on
// search/generate-image results, without having to thread props through every
// message bubble.
export interface AssistantScope {
  courseId: string | null;
  courseTitle: string | null;
  sectionId: string | null;
  sectionTitle: string | null;
  // True when the current chat is for creating a brand-new course — there is
  // no existing course id yet, so "apply as cover" actions should be hidden.
  isNewCourseScope: boolean;
}

interface AssistantScopeStore extends AssistantScope {
  setScope: (scope: Partial<AssistantScope>) => void;
  reset: () => void;
}

const EMPTY: AssistantScope = {
  courseId: null,
  courseTitle: null,
  sectionId: null,
  sectionTitle: null,
  isNewCourseScope: false,
};

export const useAssistantScope = create<AssistantScopeStore>((set) => ({
  ...EMPTY,
  setScope: (scope) => set((prev) => ({ ...prev, ...scope })),
  reset: () => set(EMPTY),
}));
