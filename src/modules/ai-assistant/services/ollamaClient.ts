import { TOOL_DECLARATIONS, executeTool } from './tools';
import { DEFAULT_SYSTEM_PROMPT } from './defaultPrompt';
import type { ToolCallRecord } from '../types';
import { auth } from '@app/config/firebase';

// ─── Message shape (Ollama /api/chat) ──────────────────────────────────
//
// We keep history in Ollama's native shape so we can replay it verbatim
// on the next turn. `tool_calls` and `role: "tool"` mirror what Ollama
// returns/accepts. We don't reuse OpenAI types because Ollama sends tool
// arguments as objects, not JSON strings.

export interface OllamaToolCall {
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

export type OllamaMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | {
      role: 'assistant';
      content: string;
      tool_calls?: OllamaToolCall[];
    }
  | { role: 'tool'; content: string; tool_name?: string };

export interface OllamaConfig {
  /** URL of the server-side proxy that forwards to Ollama Cloud (default: /ai/chat). */
  proxyUrl: string;
  model: string;
  systemInstruction: string;
}

export interface RunOptions {
  message: string;
  history: OllamaMessage[];
  onText: (chunk: string) => void;
  onToolCall: (call: ToolCallRecord) => void;
  onToolResult: (call: ToolCallRecord) => void;
}

export interface RunResult {
  finalText: string;
  newHistory: OllamaMessage[];
  toolCalls: ToolCallRecord[];
}

function getProxyUrl(override?: string): string {
  if (override) return override;
  const explicit = import.meta.env.VITE_AI_PROXY_URL as string | undefined;
  if (explicit) return explicit;
  // Reuse the file-server URL by default — the AI proxy lives in the same
  // backend. In dev VITE_FILE_SERVER_URL is empty, so we fall through to a
  // same-origin path that Vite proxies to the file-server.
  const base = (import.meta.env.VITE_FILE_SERVER_URL as string | undefined) ?? '';
  return `${base.replace(/\/+$/, '')}/ai/chat`;
}

function getModelName(override?: string): string {
  return (
    override ||
    import.meta.env.VITE_OLLAMA_MODEL ||
    'kimi-k2.6:cloud'
  );
}

function newId(): string {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getModel(config?: Partial<OllamaConfig>): OllamaConfig {
  return {
    proxyUrl: getProxyUrl(config?.proxyUrl),
    model: getModelName(config?.model),
    systemInstruction: config?.systemInstruction || DEFAULT_SYSTEM_PROMPT,
  };
}

interface OllamaStreamChunk {
  model?: string;
  message?: {
    role?: string;
    content?: string;
    tool_calls?: OllamaToolCall[];
  };
  done?: boolean;
  done_reason?: string;
  error?: string;
}

/**
 * Streams an Ollama /api/chat response (NDJSON). Yields each parsed JSON
 * chunk as it arrives. Buffers partial lines across read boundaries.
 */
async function* streamChat(
  config: OllamaConfig,
  messages: OllamaMessage[],
): AsyncGenerator<OllamaStreamChunk, void, void> {
  // Auth with the user's Firebase ID token — the server proxy verifies it and
  // checks the admin role before forwarding to Ollama Cloud. The Ollama API
  // key never reaches the browser.
  const idToken = await auth.currentUser?.getIdToken().catch(() => '');
  const res = await fetch(config.proxyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      tools: TOOL_DECLARATIONS,
    }),
  });

  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => '');
    throw new Error(`AI proxy error ${res.status}: ${body || res.statusText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let idx: number;
      while ((idx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line) continue;
        let parsed: OllamaStreamChunk;
        try {
          parsed = JSON.parse(line) as OllamaStreamChunk;
        } catch {
          continue;
        }
        if (parsed.error) throw new Error(parsed.error);
        yield parsed;
      }
    }
    const tail = buffer.trim();
    if (tail) {
      try {
        const parsed = JSON.parse(tail) as OllamaStreamChunk;
        if (parsed.error) throw new Error(parsed.error);
        yield parsed;
      } catch {
        /* ignore trailing partial */
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Runs one user-turn: streams the model response, intercepts tool calls,
 * executes the tools, feeds results back, and loops until the model returns
 * plain text. Emits text chunks and tool-call lifecycle events via callbacks.
 *
 * History uses Ollama's native message shape and is returned updated so the
 * caller can persist it for the next turn.
 */
export async function runTurn(
  config: OllamaConfig,
  { message, history, onText, onToolCall, onToolResult }: RunOptions,
): Promise<RunResult> {
  const toolCalls: ToolCallRecord[] = [];
  let finalText = '';

  // The conversation array we feed to the model. Always starts with the
  // system instruction, then prior history, then the new user turn. Tool
  // results get appended in-place across the inner loop.
  const conversation: OllamaMessage[] = [
    { role: 'system', content: config.systemInstruction },
    ...history,
    { role: 'user', content: message },
  ];

  // Safety: hard cap in case the model loops on tool calls.
  const MAX_ITERATIONS = 8;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    let turnText = '';
    const fnCalls: { name: string; args: Record<string, unknown> }[] = [];

    for await (const chunk of streamChat(config, conversation)) {
      const msg = chunk.message;
      if (msg?.content) {
        turnText += msg.content;
        onText(msg.content);
      }
      if (msg?.tool_calls && msg.tool_calls.length) {
        for (const c of msg.tool_calls) {
          fnCalls.push({
            name: c.function.name,
            args: (c.function.arguments ?? {}) as Record<string, unknown>,
          });
        }
      }
      if (chunk.done) break;
    }

    // Record this assistant turn into the conversation so the next call
    // (with tool results) carries the prior tool_calls context.
    const assistantMsg: OllamaMessage = {
      role: 'assistant',
      content: turnText,
      ...(fnCalls.length
        ? {
            tool_calls: fnCalls.map((c) => ({
              function: { name: c.name, arguments: c.args },
            })),
          }
        : {}),
    };
    conversation.push(assistantMsg);

    if (fnCalls.length === 0) {
      finalText += turnText;
      break;
    }

    // Execute each function call sequentially — courses/lessons are small and
    // parallel writes could race on ordering (e.g. two create_lesson calls).
    for (const call of fnCalls) {
      const record: ToolCallRecord = {
        id: newId(),
        name: call.name,
        args: call.args,
        startedAt: Date.now(),
        status: 'running',
      };
      toolCalls.push(record);
      onToolCall(record);
      try {
        const out = await executeTool(call.name, call.args);
        record.status = 'success';
        record.finishedAt = Date.now();
        record.result = out.data;
        record.summary = out.summary;
        record.undoId = out.undoId;
        onToolResult(record);
        conversation.push({
          role: 'tool',
          tool_name: call.name,
          content: JSON.stringify({ data: out.data, summary: out.summary }),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        record.status = 'error';
        record.finishedAt = Date.now();
        record.error = msg;
        onToolResult(record);
        conversation.push({
          role: 'tool',
          tool_name: call.name,
          content: JSON.stringify({ error: msg }),
        });
      }
    }
  }

  // Strip the leading system message before returning history — the caller
  // re-injects it on the next turn from the (potentially updated) prompt.
  const newHistory = conversation.filter((m) => m.role !== 'system');

  return {
    finalText,
    newHistory,
    toolCalls,
  };
}
