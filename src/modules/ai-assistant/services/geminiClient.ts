import {
  GoogleGenerativeAI,
  FunctionCallingMode,
  type Content,
  type GenerativeModel,
  type Part,
} from '@google/generative-ai';
import { TOOL_DECLARATIONS, executeTool } from './tools';
import { DEFAULT_SYSTEM_PROMPT } from './defaultPrompt';
import type { ToolCallRecord } from '../types';

export interface GeminiConfig {
  apiKey: string;
  model?: string;
  systemInstruction?: string;
}

export interface RunOptions {
  message: string;
  history: Content[];
  onText: (chunk: string) => void;
  onToolCall: (call: ToolCallRecord) => void;
  onToolResult: (call: ToolCallRecord) => void;
}

export interface RunResult {
  finalText: string;
  newHistory: Content[];
  toolCalls: ToolCallRecord[];
}

function getApiKey(override?: string): string {
  const key = override || import.meta.env.VITE_GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      'Falta VITE_GEMINI_API_KEY en el entorno. Agrega la API key de Gemini al .env.',
    );
  }
  return key;
}

function newId(): string {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getModel(config?: Partial<GeminiConfig>): GenerativeModel {
  const key = getApiKey(config?.apiKey);
  const modelName =
    config?.model || import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash';
  const systemInstruction = config?.systemInstruction || DEFAULT_SYSTEM_PROMPT;
  const client = new GoogleGenerativeAI(key);
  return client.getGenerativeModel({
    model: modelName,
    systemInstruction,
    tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
    toolConfig: {
      functionCallingConfig: { mode: FunctionCallingMode.AUTO },
    },
  });
}

/**
 * Runs one user-turn: streams the model response, intercepts function calls,
 * executes the tools, feeds results back, and loops until the model returns
 * plain text. Emits text chunks and tool-call lifecycle events via callbacks.
 *
 * History uses Gemini's Content[] shape and is returned updated so the caller
 * can persist it for the next turn.
 */
export async function runTurn(
  model: GenerativeModel,
  { message, history, onText, onToolCall, onToolResult }: RunOptions,
): Promise<RunResult> {
  const chat = model.startChat({ history });
  const toolCalls: ToolCallRecord[] = [];
  let finalText = '';

  // Loop: send → stream text + collect function calls → execute → send results.
  // Stops when the model returns a turn with no function calls.
  let nextInput: string | Part[] = message;
  // Safety: hard cap in case the model loops on tool calls.
  const MAX_ITERATIONS = 8;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const stream = await chat.sendMessageStream(nextInput);
    let turnText = '';
    const fnCalls: { name: string; args: Record<string, unknown> }[] = [];

    for await (const chunk of stream.stream) {
      const t = chunk.text();
      if (t) {
        turnText += t;
        onText(t);
      }
      const calls = chunk.functionCalls?.();
      if (calls && calls.length) {
        for (const c of calls) {
          fnCalls.push({ name: c.name, args: (c.args ?? {}) as Record<string, unknown> });
        }
      }
    }

    if (fnCalls.length === 0) {
      finalText += turnText;
      break;
    }

    // Execute each function call sequentially — courses/lessons are small and
    // parallel writes could race on ordering (e.g. two create_lesson calls).
    const parts: Part[] = [];
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
        parts.push({
          functionResponse: {
            name: call.name,
            response: {
              data: out.data,
              summary: out.summary,
            },
          },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        record.status = 'error';
        record.finishedAt = Date.now();
        record.error = msg;
        onToolResult(record);
        parts.push({
          functionResponse: {
            name: call.name,
            response: { error: msg },
          },
        });
      }
    }

    nextInput = parts;
  }

  return {
    finalText,
    newHistory: await chat.getHistory(),
    toolCalls,
  };
}
