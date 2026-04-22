import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Content } from '@google/generative-ai';
import { useAuthStore } from '@app/store/authStore';
import { useHeaderStore } from '@app/store/headerStore';
import { Sparkles, Send, Loader2, History, ArrowLeft, Undo2, Layers } from 'lucide-react';
import { Button } from '@shared/components/ui/Button';
import { getModel, runTurn } from '../services/geminiClient';
import { useUndoStack } from '../services/undoStack';
import { getActivePrompt, type DBPromptVersion } from '../services/promptVersions';
import ToolCallCard from '../components/ToolCallCard';
import VersionManager from '../components/VersionManager';
import type { ChatMessage, ToolCallRecord } from '../types';

const QUICK_ACTIONS = [
  'Muéstrame todos los cursos y dime cuáles se ven flojos de contenido.',
  'Reescribe la primera lección del curso de Python para que sea más clara y con mejor estructura.',
  'Busca una imagen de portada bonita para el curso de matemáticas y ponla.',
  'Crea un curso nuevo de Introducción a SQL con 3 módulos base.',
];

function newMsgId(): string {
  return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export default function AIAssistantPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const setOverride = useHeaderStore((s) => s.setOverride);
  const undoEntries = useUndoStack((s) => s.entries);
  const undo = useUndoStack((s) => s.undo);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text:
        '¡Hola! Soy **Lasa**, tu asistente para editar cursos. Puedo listar cursos, reescribir lecciones, buscar imágenes y crear contenido nuevo. Nunca borro nada existente, y cada cambio puedes deshacerlo desde el panel de la derecha.',
      createdAt: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [history, setHistory] = useState<Content[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activePrompt, setActivePrompt] = useState<DBPromptVersion | null>(null);
  const [showVersions, setShowVersions] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setOverride({
      title: 'Asistente IA',
      subtitle: 'Solo admins · Gemini + Unsplash',
    });
    return () => setOverride(null);
  }, [setOverride]);

  // Auto-scroll to the last message when new content arrives
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Guard: if a non-admin lands here, redirect.
  useEffect(() => {
    if (user && user.role !== 'admin') navigate('/unauthorized', { replace: true });
  }, [user, navigate]);

  // Load (or seed) the active prompt on mount. The model is rebuilt every
  // time activePrompt changes so the AI always runs the latest instructions.
  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    let cancelled = false;
    (async () => {
      try {
        const active = await getActivePrompt(user.id, user.name);
        if (!cancelled) setActivePrompt(active);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const model = useMemo(() => {
    if (!activePrompt) return null;
    try {
      return getModel({ systemInstruction: activePrompt.content });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    }
  }, [activePrompt]);

  // Refresh the active prompt after a tool call renames/updates it. The AI
  // self-edit tool mutates Firestore directly, so we poll the active doc
  // after each send to pick up any changes.
  const refreshActivePrompt = useCallback(async () => {
    if (!user) return;
    try {
      const active = await getActivePrompt(user.id, user.name);
      if (active.id !== activePrompt?.id) {
        setActivePrompt(active);
        setHistory([]); // reset chat history: previous turns ran under the old prompt
      }
    } catch {
      // non-fatal
    }
  }, [user, activePrompt?.id]);

  const updateMessage = useCallback((id: string, patch: Partial<ChatMessage>) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }, []);

  const appendToolCall = useCallback((id: string, call: ToolCallRecord) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id
          ? { ...m, toolCalls: [...(m.toolCalls || []), call] }
          : m,
      ),
    );
  }, []);

  const updateToolCall = useCallback((id: string, call: ToolCallRecord) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id
          ? {
              ...m,
              toolCalls: (m.toolCalls || []).map((c) => (c.id === call.id ? { ...call } : c)),
            }
          : m,
      ),
    );
  }, []);

  const handleSubmit = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isSending || !model) return;

      const userMsg: ChatMessage = {
        id: newMsgId(),
        role: 'user',
        text: trimmed,
        createdAt: Date.now(),
      };
      const modelMsg: ChatMessage = {
        id: newMsgId(),
        role: 'model',
        text: '',
        createdAt: Date.now(),
        streaming: true,
        toolCalls: [],
      };
      setMessages((prev) => [...prev, userMsg, modelMsg]);
      setInput('');
      setIsSending(true);
      setError(null);

      try {
        const { newHistory, finalText } = await runTurn(model, {
          message: trimmed,
          history,
          onText: (chunk) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === modelMsg.id ? { ...m, text: m.text + chunk } : m,
              ),
            );
          },
          onToolCall: (call) => appendToolCall(modelMsg.id, call),
          onToolResult: (call) => updateToolCall(modelMsg.id, call),
        });
        updateMessage(modelMsg.id, { streaming: false, text: finalText || undefined });
        setHistory(newHistory);
        // If the AI called propose_system_prompt_update during this turn, the
        // active version in Firestore changed. Pick it up so the next turn
        // uses the new instructions.
        await refreshActivePrompt();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        updateMessage(modelMsg.id, {
          streaming: false,
          text: `⚠️ Error: ${msg}`,
        });
      } finally {
        setIsSending(false);
        textareaRef.current?.focus();
      }
    },
    [model, history, isSending, appendToolCall, updateToolCall, updateMessage, refreshActivePrompt],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(input);
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      <div className="flex-1 flex flex-col rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
            aria-label="Volver"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-700 text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-gray-900">Lasa · Asistente de contenido</div>
            <div className="text-xs text-gray-500">
              {activePrompt ? (
                <>Prompt activo: <span className="font-mono">v{activePrompt.versionNumber}</span> · {activePrompt.reason}</>
              ) : model ? (
                'Conectado a Gemini. Los cambios son reversibles por acción.'
              ) : (
                'Sin API key configurada.'
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowVersions(true)}
            className="shrink-0 flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-red-300 hover:bg-red-50/40"
            title="Ver versiones del prompt"
          >
            <Layers className="h-3.5 w-3.5" />
            Versiones
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {messages.length <= 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-4">
              {QUICK_ACTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => handleSubmit(q)}
                  disabled={!model || isSending}
                  className="text-left text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 hover:border-red-300 hover:bg-red-50/40 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit(input);
          }}
          className="border-t border-gray-200 bg-gray-50 p-3"
        >
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              disabled={!model || isSending}
              placeholder={
                model
                  ? 'Dile a Lasa qué editar… (Enter para enviar, Shift+Enter para nueva línea)'
                  : 'Configura VITE_GEMINI_API_KEY para habilitar el asistente.'
              }
              className="flex-1 resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 disabled:bg-gray-100"
            />
            <Button
              type="submit"
              disabled={!input.trim() || !model || isSending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </form>
      </div>

      {/* Undo panel */}
      <aside className="hidden lg:flex w-80 flex-col rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
          <History className="h-4 w-4 text-gray-600" />
          <div className="font-semibold text-gray-900">Historial de cambios</div>
          <div className="ml-auto text-xs text-gray-500">{undoEntries.length}</div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {undoEntries.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">
              Aquí aparecerán los cambios aplicados. Puedes deshacer cada uno individualmente.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {undoEntries.map((e) => (
                <li key={e.id} className="px-4 py-3">
                  <div className="text-sm text-gray-800">{e.description}</div>
                  <div className="mt-0.5 text-[11px] text-gray-400">
                    {new Date(e.createdAt).toLocaleTimeString('es-DO', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                  {e.applied ? (
                    <div className="mt-1 text-[11px] text-gray-400 italic">Deshecho</div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => undo(e.id)}
                      className="mt-1 inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-medium"
                    >
                      <Undo2 className="h-3 w-3" />
                      Deshacer
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <VersionManager
        open={showVersions}
        onClose={() => setShowVersions(false)}
        onActivated={(v) => {
          setActivePrompt(v);
          setHistory([]);
        }}
      />
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
          isUser
            ? 'bg-red-600 text-white rounded-br-md'
            : 'bg-gray-100 text-gray-900 rounded-bl-md'
        }`}
      >
        {message.text && (
          <div className="whitespace-pre-wrap leading-relaxed">
            {renderLight(message.text)}
            {message.streaming && (
              <span className="ml-1 inline-block h-3 w-1.5 bg-current animate-pulse align-middle rounded-sm" />
            )}
          </div>
        )}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-1">
            {message.toolCalls.map((c) => (
              <ToolCallCard key={c.id} call={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Minimal inline markdown: **bold** and `code`, nothing else.
// The AI writes in Spanish prose — full markdown rendering would be overkill.
function renderLight(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      out.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**')) {
      out.push(
        <strong key={key++}>{token.slice(2, -2)}</strong>,
      );
    } else {
      out.push(
        <code
          key={key++}
          className="rounded bg-black/10 px-1 py-0.5 font-mono text-[0.85em]"
        >
          {token.slice(1, -1)}
        </code>,
      );
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) out.push(text.slice(lastIndex));
  return out;
}
