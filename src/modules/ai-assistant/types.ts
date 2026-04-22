export type ToolCallStatus = 'running' | 'success' | 'error' | 'undone';

export interface ToolCallRecord {
  id: string;
  name: string;
  args: Record<string, unknown>;
  startedAt: number;
  finishedAt?: number;
  status: ToolCallStatus;
  result?: unknown;
  error?: string;
  // When the tool mutated state, an undo token is returned here so the UI
  // can offer a per-action "Deshacer" button. Undo entries are created
  // lazily in the undo stack.
  undoId?: string;
  summary?: string; // Short human-readable summary shown in the UI
}

export type ChatRole = 'user' | 'model' | 'system';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  createdAt: number;
  toolCalls?: ToolCallRecord[];
  // When true, the bubble is still streaming text from the model.
  streaming?: boolean;
}

export interface UndoEntry {
  id: string;
  createdAt: number;
  description: string;
  // Returns true on success; false if undo is no longer possible.
  execute: () => Promise<boolean>;
  applied: boolean; // becomes true once the user invokes it
}

export interface StockImage {
  url: string; // full-res URL
  thumbUrl: string;
  author: string;
  authorUrl: string;
  sourceUrl: string;
  description?: string;
}
