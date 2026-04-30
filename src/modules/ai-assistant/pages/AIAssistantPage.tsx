import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@app/store/authStore';
import { useHeaderStore } from '@app/store/headerStore';
import {
  Sparkles,
  Send,
  Loader2,
  ArrowLeft,
  Undo2,
  Layers,
  BookOpen,
  X as XIcon,
  PlusCircle,
  MessageSquare,
  Trash2,
  ListTree,
  History,
} from 'lucide-react';
import { Button } from '@shared/components/ui/Button';
import {
  courseService,
  sectionService,
  type DBCourse,
  type DBSection,
} from '@shared/services/dataService';
import { getModel, runTurn, type OllamaMessage } from '../services/ollamaClient';
import { useUndoStack } from '../services/undoStack';
import { getActivePrompt, type DBPromptVersion } from '../services/promptVersions';
import {
  createSession,
  updateSession,
  deleteSession,
  listSessions,
  type DBChatSession,
} from '../services/chatSessions';
import ToolCallCard from '../components/ToolCallCard';
import VersionManager from '../components/VersionManager';
import type { ChatMessage, ToolCallRecord } from '../types';

const QUICK_ACTIONS_EXISTING = [
  'Resume qué contiene este curso y dime qué partes se ven flojas.',
  'Reescribe la primera lección para que sea más clara y estructurada.',
  'Busca una imagen de portada bonita y aplícala al curso.',
  'Sugiere 3 lecciones nuevas que encajen con el nivel del curso.',
];
const QUICK_ACTIONS_NEW = [
  'Crea un curso de Introducción a SQL con 3 módulos y 2 lecciones cada uno.',
  'Crea un curso de Oratoria para adolescentes, nivel principiante.',
  'Arma un curso de Excel básico con 4 módulos bien ordenados.',
];

function newMsgId(): string {
  return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function buildWelcome(
  course: DBCourse | null,
  section: DBSection | null,
  isNewCourse: boolean,
): ChatMessage {
  let text: string;
  if (isNewCourse) {
    text =
      '¡Hola! Soy **Lasa**. Vamos a crear un curso nuevo. Cuéntame tema, nivel y cuántas lecciones quieres y yo lo armo. Puedes deshacer cada cambio desde el panel derecho.';
  } else if (course) {
    const sectionPart = section ? ` · Sección: **${section.title}**` : '';
    text = `¡Hola! Soy **Lasa**. Me enfocaré en el curso **${course.title}**${sectionPart}. ¿Qué quieres editar, crear o mejorar? Cada cambio puedes deshacerlo desde el panel derecho.`;
  } else {
    text = '¡Hola! Soy **Lasa**, tu asistente para editar cursos.';
  }
  return {
    id: 'welcome',
    role: 'model',
    text,
    createdAt: Date.now(),
  };
}

export default function AIAssistantPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const setOverride = useHeaderStore((s) => s.setOverride);
  const undoEntries = useUndoStack((s) => s.entries);
  const undo = useUndoStack((s) => s.undo);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [history, setHistory] = useState<OllamaMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activePrompt, setActivePrompt] = useState<DBPromptVersion | null>(null);
  const [showVersions, setShowVersions] = useState(false);

  // Scope state (course is REQUIRED; section is optional)
  const [courses, setCourses] = useState<DBCourse[]>([]);
  const [sections, setSections] = useState<DBSection[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [isNewCourseScope, setIsNewCourseScope] = useState(false);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [scopeReady, setScopeReady] = useState(false);

  // Sessions state
  const [sessions, setSessions] = useState<DBChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<'chats' | 'changes'>('chats');

  const selectedCourse = useMemo(
    () => courses.find((c) => c.id === selectedCourseId) ?? null,
    [courses, selectedCourseId],
  );
  const selectedSection = useMemo(
    () => sections.find((s) => s.id === selectedSectionId) ?? null,
    [sections, selectedSectionId],
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setOverride({
      title: 'Asistente IA',
      subtitle: 'Solo admins · Kimi (Ollama Cloud) + Unsplash',
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

  // Load (or seed) the active prompt on mount.
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

  // Load courses once on mount (for the scope picker).
  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    let cancelled = false;
    (async () => {
      try {
        const list = await courseService.getAll();
        if (!cancelled) setCourses(list);
      } catch (err) {
        console.error('[ai-assistant] load courses failed', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Load sections whenever the selected course changes. Sections are only
  // meaningful when there's an existing course; skip the fetch for new-course
  // scope or when no course is selected.
  useEffect(() => {
    if (!selectedCourseId) {
      setSections([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const list = await sectionService.getByCourse(selectedCourseId);
        if (!cancelled) setSections(list);
      } catch (err) {
        console.error('[ai-assistant] load sections failed', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCourseId]);

  const refreshSessions = useCallback(async () => {
    if (!user) return;
    try {
      const list = await listSessions(user.id);
      setSessions(list);
    } catch (err) {
      console.error('[ai-assistant] load sessions failed', err);
    }
  }, [user]);

  // Initial sessions load
  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  const model = useMemo(() => {
    if (!activePrompt) return null;
    try {
      return getModel({ systemInstruction: activePrompt.content });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    }
  }, [activePrompt]);

  // After a tool call renames/updates the active prompt, re-fetch it so the
  // next turn uses the new system instruction. We DO NOT reset `history` here
  // — losing conversation context is worse than a slight prompt mismatch.
  const refreshActivePrompt = useCallback(async () => {
    if (!user) return;
    try {
      const active = await getActivePrompt(user.id, user.name);
      if (active.id !== activePrompt?.id) {
        setActivePrompt(active);
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

  const startChatWithScope = useCallback(
    (course: DBCourse | null, section: DBSection | null, newCourse: boolean) => {
      setMessages([buildWelcome(course, section, newCourse)]);
      setHistory([]);
      setCurrentSessionId(null);
      setError(null);
      setScopeReady(true);
    },
    [],
  );

  const handleNewChat = useCallback(() => {
    setMessages([]);
    setHistory([]);
    setCurrentSessionId(null);
    setSelectedCourseId(null);
    setSelectedSectionId(null);
    setIsNewCourseScope(false);
    setSections([]);
    setScopeReady(false);
    setError(null);
  }, []);

  const handleLoadSession = useCallback(
    async (sessionId: string) => {
      const sess = sessions.find((s) => s.id === sessionId);
      if (!sess) return;
      let parsedHistory: OllamaMessage[] = [];
      try {
        parsedHistory = sess.historyJson
          ? (JSON.parse(sess.historyJson) as OllamaMessage[])
          : [];
      } catch (err) {
        console.warn('[ai-assistant] failed to parse session history', err);
      }
      // Sessions saved with the prior Gemini client used a different message
      // shape (`parts`, `functionCall`, `functionResponse`). Drop those so we
      // don't crash the new Ollama client; the user can keep chatting fresh.
      if (
        parsedHistory.length &&
        !parsedHistory.every((m) => typeof (m as OllamaMessage).content === 'string')
      ) {
        console.warn('[ai-assistant] dropping incompatible legacy history');
        parsedHistory = [];
      }
      setMessages(sess.messages);
      setHistory(parsedHistory);
      setCurrentSessionId(sess.id);
      setSelectedCourseId(sess.courseId);
      setSelectedSectionId(sess.sectionId);
      setIsNewCourseScope(!sess.courseId && sess.courseTitle === 'Nuevo curso');
      setScopeReady(true);
      setError(null);
    },
    [sessions],
  );

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      try {
        await deleteSession(sessionId);
        if (currentSessionId === sessionId) {
          handleNewChat();
        }
        await refreshSessions();
      } catch (err) {
        console.error('[ai-assistant] delete session failed', err);
      }
    },
    [currentSessionId, handleNewChat, refreshSessions],
  );

  // Persist the session after each completed turn. We wait for isSending to
  // flip back to false so we only save fully-settled turns (not streaming
  // partials). Streaming UI updates are still local to state.
  useEffect(() => {
    if (!user || !scopeReady || isSending) return;
    if (messages.length === 0) return;
    const hasUser = messages.some((m) => m.role === 'user');
    if (!hasUser) return;

    const courseTitle = isNewCourseScope
      ? 'Nuevo curso'
      : selectedCourse?.title ?? null;
    const sectionTitle = selectedSection?.title ?? null;
    const historyJson = JSON.stringify(history);

    if (currentSessionId) {
      updateSession(currentSessionId, {
        messages,
        historyJson,
        courseId: selectedCourseId,
        courseTitle,
        sectionId: selectedSectionId,
        sectionTitle,
      })
        .then(() => refreshSessions())
        .catch((err) => console.error('[ai-assistant] save session failed', err));
    } else {
      createSession({
        userId: user.id,
        courseId: selectedCourseId,
        courseTitle,
        sectionId: selectedSectionId,
        sectionTitle,
        messages,
        historyJson,
      })
        .then((s) => {
          setCurrentSessionId(s.id);
          refreshSessions();
        })
        .catch((err) => console.error('[ai-assistant] create session failed', err));
    }
    // We only want to fire this when a turn finishes (isSending flips false)
    // or when messages/history change after a load. Intentionally exclude
    // scope-selection setters from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, history, isSending]);

  const buildContextPrefix = useCallback((): string => {
    if (isNewCourseScope) {
      return `[Contexto del admin: esta conversación es para CREAR un curso NUEVO desde cero. Recopila el tema, la descripción, la categoría y el nivel. Cuando tengas lo básico, usa create_course y después create_module/create_lesson para armarlo. No toques otros cursos existentes.]\n\n`;
    }
    if (selectedCourse) {
      const sectionLine = selectedSection
        ? ` · Sección activa: "${selectedSection.title}" (id: ${selectedSection.id}).`
        : '';
      return `[Contexto del admin: enfócate en el curso "${selectedCourse.title}" (id: ${selectedCourse.id}, categoría: ${selectedCourse.category}, nivel: ${selectedCourse.level}).${sectionLine} Salvo que el admin te diga lo contrario, todas las acciones van dirigidas a este curso.]\n\n`;
    }
    return '';
  }, [isNewCourseScope, selectedCourse, selectedSection]);

  const handleSubmit = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isSending || !model || !scopeReady) return;

      const messageToModel = buildContextPrefix() + trimmed;

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
          message: messageToModel,
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
    [
      model,
      history,
      isSending,
      scopeReady,
      buildContextPrefix,
      appendToolCall,
      updateToolCall,
      updateMessage,
      refreshActivePrompt,
    ],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(input);
    }
  };

  const quickActions = isNewCourseScope ? QUICK_ACTIONS_NEW : QUICK_ACTIONS_EXISTING;

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      <div className="flex-1 flex flex-col rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3 relative flex-wrap">
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
            <div className="text-xs text-gray-500 truncate">
              {activePrompt ? (
                <>Prompt activo: <span className="font-mono">v{activePrompt.versionNumber}</span> · {activePrompt.reason}</>
              ) : model ? (
                'Conectado a Kimi (Ollama Cloud). Los cambios son reversibles por acción.'
              ) : (
                'No hay un prompt activo configurado.'
              )}
            </div>
          </div>

          {scopeReady && (
            <>
              <ScopeChip
                icon={<BookOpen className="h-3.5 w-3.5" />}
                active
                label={
                  isNewCourseScope
                    ? 'Curso: nuevo'
                    : selectedCourse
                    ? selectedCourse.title
                    : 'Curso: —'
                }
              />
              {selectedSection && (
                <ScopeChip
                  icon={<ListTree className="h-3.5 w-3.5" />}
                  active
                  label={`Sección: ${selectedSection.title}`}
                  onClear={() => setSelectedSectionId(null)}
                />
              )}
            </>
          )}

          <button
            type="button"
            onClick={handleNewChat}
            className="shrink-0 flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-red-300 hover:bg-red-50/40"
            title="Iniciar un chat nuevo"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            Nuevo chat
          </button>

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

        {!scopeReady ? (
          <ScopeSetup
            courses={courses}
            sections={sections}
            selectedCourseId={selectedCourseId}
            isNewCourseScope={isNewCourseScope}
            selectedSectionId={selectedSectionId}
            onPickExisting={(id) => {
              setSelectedCourseId(id);
              setIsNewCourseScope(false);
              setSelectedSectionId(null);
            }}
            onPickNew={() => {
              setIsNewCourseScope(true);
              setSelectedCourseId(null);
              setSelectedSectionId(null);
            }}
            onPickSection={(id) => setSelectedSectionId(id)}
            onStart={() => {
              startChatWithScope(selectedCourse, selectedSection, isNewCourseScope);
            }}
          />
        ) : (
          <>
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
                  {quickActions.map((q) => (
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
                      : 'Configura un prompt activo para habilitar el asistente.'
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
          </>
        )}
      </div>

      {/* Right sidebar: tabs for Chats and Cambios */}
      <aside className="hidden lg:flex w-80 flex-col rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="flex border-b border-gray-200">
          <SidebarTab
            active={sidebarTab === 'chats'}
            onClick={() => setSidebarTab('chats')}
            icon={<MessageSquare className="h-4 w-4" />}
            label="Chats"
            count={sessions.length}
          />
          <SidebarTab
            active={sidebarTab === 'changes'}
            onClick={() => setSidebarTab('changes')}
            icon={<History className="h-4 w-4" />}
            label="Cambios"
            count={undoEntries.length}
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {sidebarTab === 'chats' ? (
            <SessionsList
              sessions={sessions}
              currentId={currentSessionId}
              onOpen={handleLoadSession}
              onDelete={handleDeleteSession}
            />
          ) : (
            <ChangesList entries={undoEntries} onUndo={undo} />
          )}
        </div>
      </aside>

      <VersionManager
        open={showVersions}
        onClose={() => setShowVersions(false)}
        onActivated={(v) => {
          setActivePrompt(v);
          // Keep chat history so the admin doesn't lose course context after
          // a prompt change.
        }}
      />
    </div>
  );
}

interface ScopeChipProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClear?: () => void;
}

function ScopeChip({ icon, label, active, onClear }: ScopeChipProps) {
  return (
    <span
      className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium ${
        active
          ? 'border-red-300 bg-red-50 text-red-700'
          : 'border-gray-200 bg-white text-gray-700'
      }`}
    >
      {icon}
      <span className="max-w-[150px] truncate">{label}</span>
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          className="ml-0.5 text-red-500 hover:text-red-700"
          aria-label="Quitar"
        >
          <XIcon className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

interface ScopeSetupProps {
  courses: DBCourse[];
  sections: DBSection[];
  selectedCourseId: string | null;
  isNewCourseScope: boolean;
  selectedSectionId: string | null;
  onPickExisting: (id: string) => void;
  onPickNew: () => void;
  onPickSection: (id: string | null) => void;
  onStart: () => void;
}

function ScopeSetup({
  courses,
  sections,
  selectedCourseId,
  isNewCourseScope,
  selectedSectionId,
  onPickExisting,
  onPickNew,
  onPickSection,
  onStart,
}: ScopeSetupProps) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.category?.toLowerCase().includes(q),
    );
  }, [courses, search]);

  const canStart = isNewCourseScope || !!selectedCourseId;

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            ¿Sobre qué curso quieres trabajar?
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Lasa siempre necesita un curso activo. Elige uno existente o crea uno nuevo desde cero.
          </p>
        </div>

        <button
          type="button"
          onClick={onPickNew}
          className={`w-full text-left rounded-xl border-2 px-4 py-3 transition-colors ${
            isNewCourseScope
              ? 'border-red-500 bg-red-50/60'
              : 'border-dashed border-gray-300 bg-white hover:border-red-300 hover:bg-red-50/30'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-red-700">
              <PlusCircle className="h-5 w-5" />
            </div>
            <div>
              <div className="font-medium text-gray-900">Crear un curso nuevo</div>
              <div className="text-xs text-gray-500">
                Lasa te guía paso a paso para armar el curso desde cero.
              </div>
            </div>
          </div>
        </button>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            O elige un curso existente
          </label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar curso por nombre o categoría…"
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
          />
          <div className="mt-2 max-h-64 overflow-y-auto rounded-md border border-gray-200 bg-white divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-gray-400 text-center">
                Sin resultados
              </div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onPickExisting(c.id)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                    c.id === selectedCourseId && !isNewCourseScope
                      ? 'bg-red-50/60 text-red-700 font-medium'
                      : 'text-gray-700'
                  }`}
                >
                  <div className="truncate">{c.title}</div>
                  <div className="text-[10px] text-gray-400">
                    {c.category} · {c.level} · {c.status}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {selectedCourseId && !isNewCourseScope && sections.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sección <span className="text-xs text-gray-400 font-normal">(opcional)</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onPickSection(null)}
                className={`text-left px-3 py-2 rounded-md border text-sm ${
                  !selectedSectionId
                    ? 'border-red-300 bg-red-50/60 text-red-700 font-medium'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-red-300 hover:bg-red-50/30'
                }`}
              >
                Ninguna (curso global)
              </button>
              {sections.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onPickSection(s.id)}
                  className={`text-left px-3 py-2 rounded-md border text-sm ${
                    selectedSectionId === s.id
                      ? 'border-red-300 bg-red-50/60 text-red-700 font-medium'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-red-300 hover:bg-red-50/30'
                  }`}
                >
                  <div className="truncate">{s.title}</div>
                  <div className="text-[10px] text-gray-400">{s.instructorName}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="pt-2">
          <Button
            onClick={onStart}
            disabled={!canStart}
            className="w-full bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Empezar chat
          </Button>
          {!canStart && (
            <p className="mt-2 text-xs text-gray-500 text-center">
              Elige un curso existente o la opción de crear uno nuevo para continuar.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

interface SidebarTabProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
}

function SidebarTab({ active, onClick, icon, label, count }: SidebarTabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-red-600 text-red-700 bg-red-50/40'
          : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
      }`}
    >
      {icon}
      {label}
      <span
        className={`text-[10px] font-semibold rounded-full px-1.5 py-0.5 ${
          active ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-600'
        }`}
      >
        {count}
      </span>
    </button>
  );
}

interface SessionsListProps {
  sessions: DBChatSession[];
  currentId: string | null;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

function SessionsList({ sessions, currentId, onOpen, onDelete }: SessionsListProps) {
  if (sessions.length === 0) {
    return (
      <div className="p-4 text-sm text-gray-500">
        Tus chats aparecerán aquí. Inicia uno nuevo desde el botón de arriba.
      </div>
    );
  }
  return (
    <ul className="divide-y divide-gray-100">
      {sessions.map((s) => {
        const isCurrent = s.id === currentId;
        const msgCount = s.messages.length;
        return (
          <li
            key={s.id}
            className={`group relative ${isCurrent ? 'bg-red-50/40' : ''}`}
          >
            <button
              type="button"
              onClick={() => onOpen(s.id)}
              className="w-full text-left px-4 py-3 hover:bg-gray-50"
            >
              <div className="flex items-start gap-2">
                <MessageSquare
                  className={`h-4 w-4 mt-0.5 shrink-0 ${
                    isCurrent ? 'text-red-600' : 'text-gray-400'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div
                    className={`text-sm truncate ${
                      isCurrent ? 'text-red-800 font-semibold' : 'text-gray-800 font-medium'
                    }`}
                  >
                    {s.title}
                  </div>
                  <div className="mt-0.5 text-[11px] text-gray-500 truncate">
                    {s.courseTitle || 'Sin curso'}
                    {s.sectionTitle ? ` · ${s.sectionTitle}` : ''}
                  </div>
                  <div className="mt-0.5 text-[10px] text-gray-400">
                    {msgCount} mensajes ·{' '}
                    {new Date(s.updatedAt).toLocaleString('es-DO', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm('¿Eliminar este chat? No se puede deshacer.')) {
                  onDelete(s.id);
                }
              }}
              className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 text-gray-400 hover:text-red-600 transition-opacity"
              aria-label="Eliminar chat"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

interface ChangesListProps {
  entries: ReturnType<typeof useUndoStack.getState>['entries'];
  onUndo: (id: string) => Promise<boolean>;
}

function ChangesList({ entries, onUndo }: ChangesListProps) {
  if (entries.length === 0) {
    return (
      <div className="p-4 text-sm text-gray-500">
        Aquí aparecerán los cambios aplicados. Puedes deshacer cada uno individualmente.
      </div>
    );
  }
  return (
    <ul className="divide-y divide-gray-100">
      {entries.map((e) => (
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
              onClick={() => onUndo(e.id)}
              className="mt-1 inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-medium"
            >
              <Undo2 className="h-3 w-3" />
              Deshacer
            </button>
          )}
        </li>
      ))}
    </ul>
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
      out.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
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
