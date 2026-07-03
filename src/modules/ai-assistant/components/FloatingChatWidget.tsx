import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, Send, Loader2, X as XIcon, Maximize2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@app/store/authStore';
import { getModel, runTurn, type OllamaConfig, type OllamaMessage } from '../services/ollamaClient';
import { getActivePrompt } from '../services/promptVersions';
import ToolCallCard from './ToolCallCard';
import type { ChatMessage, ToolCallRecord } from '../types';

function newMsgId(): string {
  return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

const WELCOME: ChatMessage = {
  id: 'welcome',
  role: 'model',
  text:
    '¡Hola! Soy **Lasa**. Pídeme lo que necesites: editar cursos, generar una imagen, o armar un reporte en PDF. Estoy disponible en cualquier página.',
  createdAt: 0,
};

/**
 * Global, admin-only floating assistant. Reuses the Kimi/Ollama engine
 * (getModel + runTurn) and the same tools as the full /ai-assistant page, but
 * with its own lightweight chat state so it can live in every page.
 */
export function FloatingChatWidget() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  const [open, setOpen] = useState(false);
  const [model, setModel] = useState<OllamaConfig | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [history, setHistory] = useState<OllamaMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load the active (Firestore-versioned) system prompt the first time the
  // admin opens the widget; fall back to the default prompt on failure.
  useEffect(() => {
    if (!open || model || !isAdmin || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const active = await getActivePrompt(user.id, user.name);
        if (!cancelled) setModel(getModel({ systemInstruction: active.content }));
      } catch {
        if (!cancelled) setModel(getModel());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, model, isAdmin, user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const appendToolCall = useCallback((msgId: string, call: ToolCallRecord) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId ? { ...m, toolCalls: [...(m.toolCalls ?? []), call] } : m,
      ),
    );
  }, []);

  const updateToolCall = useCallback((msgId: string, call: ToolCallRecord) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId
          ? {
              ...m,
              toolCalls: (m.toolCalls ?? []).map((c) => (c.id === call.id ? call : c)),
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
              prev.map((m) => (m.id === modelMsg.id ? { ...m, text: m.text + chunk } : m)),
            );
          },
          onToolCall: (call) => appendToolCall(modelMsg.id, call),
          onToolResult: (call) => updateToolCall(modelMsg.id, call),
        });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === modelMsg.id ? { ...m, streaming: false, text: finalText || m.text } : m,
          ),
        );
        setHistory(newHistory);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === modelMsg.id ? { ...m, streaming: false, text: `⚠️ Error: ${msg}` } : m,
          ),
        );
      } finally {
        setIsSending(false);
        textareaRef.current?.focus();
      }
    },
    [isSending, model, history, appendToolCall, updateToolCall],
  );

  if (!isAdmin) return null;

  return createPortal(
    <>
      {/* Launcher */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-violet-600/30 transition hover:scale-105"
          title="Asistente Lasa"
          aria-label="Abrir asistente Lasa"
        >
          <Sparkles className="h-6 w-6" />
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-5 right-5 z-[60] flex h-[min(640px,calc(100dvh-2.5rem))] w-[min(420px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-gray-100 bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              <span className="font-semibold">Lasa</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => navigate('/ai-assistant')}
                className="rounded-md p-1.5 hover:bg-white/20"
                title="Abrir página completa"
                aria-label="Abrir página completa"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1.5 hover:bg-white/20"
                title="Cerrar"
                aria-label="Cerrar"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {messages.map((m) => (
              <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm ${
                    m.role === 'user'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words">
                    {m.text}
                    {m.streaming && !m.text && (
                      <Loader2 className="inline h-3.5 w-3.5 animate-spin text-gray-500" />
                    )}
                  </div>
                  {m.toolCalls?.map((c) => <ToolCallCard key={c.id} call={c} />)}
                </div>
              </div>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="border-t border-red-100 bg-red-50 px-3 py-1.5 text-xs text-red-700">
              {error}
            </div>
          )}

          {/* Input */}
          <div className="border-t border-gray-100 p-2">
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleSubmit(input);
                  }
                }}
                rows={1}
                placeholder={model ? 'Escribe un mensaje…' : 'Cargando…'}
                disabled={!model || isSending}
                className="max-h-32 flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none disabled:bg-gray-50"
              />
              <button
                type="button"
                onClick={() => void handleSubmit(input)}
                disabled={!model || isSending || !input.trim()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:opacity-40"
                aria-label="Enviar"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}

export default FloatingChatWidget;
