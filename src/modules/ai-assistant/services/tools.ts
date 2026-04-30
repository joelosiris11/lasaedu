import {
  courseService,
  moduleService,
  lessonService,
  userService,
  sectionService,
  departmentService,
  positionService,
  legacyEnrollmentService,
  evaluationService,
  gradeService,
  certificateService,
  supportTicketService,
  type DBCourse,
  type DBModule,
  type DBLesson,
} from '@shared/services/dataService';

// Tool declarations follow Ollama's `/api/chat` `tools` array shape, which
// mirrors OpenAI's function-calling JSON Schema. Properties use plain
// JSON-Schema strings ('string', 'number', 'array', 'object') instead of
// Gemini's SchemaType enum.
export interface OllamaToolDeclaration {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}
import { useAuthStore } from '@app/store/authStore';
import { searchStockImages } from './unsplash';
import { useUndoStack, newUndoId } from './undoStack';
import {
  getActivePrompt,
  createVersion,
  activateVersion,
} from './promptVersions';

// ─── Helpers ────────────────────────────────────────────────────────────

const wrapWysiwyg = (html: string): string =>
  JSON.stringify({ editorMode: 'wysiwyg', html });

const unwrapWysiwyg = (raw: string): string => {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.editorMode === 'wysiwyg') {
      return String(parsed.html || '');
    }
    return raw;
  } catch {
    return raw;
  }
};

const truncate = (s: string, n: number): string =>
  s.length <= n ? s : `${s.slice(0, n)}…`;

const requireAdmin = (): { id: string; name: string } => {
  const u = useAuthStore.getState().user;
  if (!u || u.role !== 'admin') {
    throw new Error('Solo los administradores pueden ejecutar acciones del asistente.');
  }
  return { id: u.id, name: u.name };
};

// ─── Tool execution result shape ────────────────────────────────────────

export interface ToolExecResult {
  data: unknown;
  summary: string;
  undoId?: string;
}

// ─── Tool declarations (for Ollama Cloud / Kimi) ────────────────────────

export const TOOL_DECLARATIONS: OllamaToolDeclaration[] = [
  {
    type: 'function',
    function: {
      name: 'list_courses',
      description:
        'Devuelve todos los cursos con sus campos principales (id, título, categoría, nivel, estado, imagen, número de secciones y estudiantes).',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_course_tree',
      description:
        'Obtiene un curso completo con sus módulos y lecciones resumidas (sin el HTML completo). Úsalo antes de editar para entender la estructura.',
      parameters: {
        type: 'object',
        required: ['courseId'],
        properties: {
          courseId: { type: 'string', description: 'ID del curso' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_lesson',
      description:
        'Devuelve una lección con su contenido HTML completo (solo para lecciones tipo texto/wysiwyg). Úsalo antes de reescribirla.',
      parameters: {
        type: 'object',
        required: ['lessonId'],
        properties: {
          lessonId: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_course',
      description:
        'Crea un nuevo curso en estado borrador. Devuelve el ID nuevo.',
      parameters: {
        type: 'object',
        required: ['title', 'description', 'category', 'level'],
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          category: { type: 'string' },
          level: {
            type: 'string',
            enum: ['principiante', 'intermedio', 'avanzado'],
          },
          duration: { type: 'string', description: 'Ej. "8 horas"' },
          objectives: { type: 'array', items: { type: 'string' } },
          tags: { type: 'array', items: { type: 'string' } },
          image: { type: 'string', description: 'URL de imagen (opcional)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_course',
      description:
        'Actualiza campos de un curso existente (título, descripción, categoría, nivel, imagen, tags, objetivos, etc.). No borra el curso.',
      parameters: {
        type: 'object',
        required: ['courseId', 'patch'],
        properties: {
          courseId: { type: 'string' },
          patch: {
            type: 'object',
            description: 'Objeto con solo los campos a actualizar',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              category: { type: 'string' },
              level: {
                type: 'string',
                enum: ['principiante', 'intermedio', 'avanzado'],
              },
              duration: { type: 'string' },
              image: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' } },
              objectives: { type: 'array', items: { type: 'string' } },
              requirements: { type: 'array', items: { type: 'string' } },
              status: {
                type: 'string',
                enum: ['borrador', 'publicado', 'archivado'],
              },
            },
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_module',
      description:
        'Crea un módulo (grupo de lecciones) dentro de un curso. Si no se especifica order, se agrega al final.',
      parameters: {
        type: 'object',
        required: ['courseId', 'title'],
        properties: {
          courseId: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          duration: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_module',
      description: 'Actualiza campos de un módulo.',
      parameters: {
        type: 'object',
        required: ['moduleId', 'patch'],
        properties: {
          moduleId: { type: 'string' },
          patch: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              duration: { type: 'string' },
              image: { type: 'string' },
            },
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_lesson',
      description:
        'Crea una lección de tipo "texto" dentro de un módulo con HTML/markdown. Para otros tipos (video, quiz) solo usa el constructor manual.',
      parameters: {
        type: 'object',
        required: ['moduleId', 'title', 'contentHtml'],
        properties: {
          moduleId: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          contentHtml: {
            type: 'string',
            description:
              'Contenido de la lección en HTML (usa <h2>, <p>, <ul>, <strong>, <em>, <img>, etc.)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_lesson',
      description:
        'Actualiza metadatos de una lección (título, descripción, orden, estado). Para cambiar el contenido usa update_lesson_content.',
      parameters: {
        type: 'object',
        required: ['lessonId', 'patch'],
        properties: {
          lessonId: { type: 'string' },
          patch: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              duration: { type: 'string' },
              status: {
                type: 'string',
                enum: ['borrador', 'publicado'],
              },
            },
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_lesson_content',
      description:
        'Reemplaza el HTML del cuerpo de una lección de tipo texto (WYSIWYG). Pasa el HTML completo nuevo, no un diff.',
      parameters: {
        type: 'object',
        required: ['lessonId', 'contentHtml'],
        properties: {
          lessonId: { type: 'string' },
          contentHtml: {
            type: 'string',
            description:
              'HTML completo nuevo del cuerpo. Puede incluir <img src="..."> con URLs de Unsplash.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_current_system_prompt',
      description:
        'Devuelve tu propio system prompt actual (el texto que define tu rol y reglas). Úsalo antes de proponer una auto-mejora para conocer la versión vigente.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_system_prompt_update',
      description:
        'Crea una nueva versión de tu propio system prompt y la activa. Úsalo cuando el admin te dé feedback concreto sobre tu comportamiento. Debes enviar el prompt completo nuevo (no un diff) y mantener intactas las reglas estrictas de la sección "REGLAS ESTRICTAS". La versión anterior queda archivada.',
      parameters: {
        type: 'object',
        required: ['newPrompt', 'reason'],
        properties: {
          newPrompt: {
            type: 'string',
            description: 'El texto COMPLETO del nuevo system prompt.',
          },
          reason: {
            type: 'string',
            description:
              'Una frase que explique qué cambió y por qué (ej. "Menos verboso tras feedback del admin").',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_stock_images',
      description:
        'Busca imágenes libres en Unsplash para ilustrar cursos o lecciones. Devuelve una lista con URL directa, thumbnail y autor para atribución.',
      parameters: {
        type: 'object',
        required: ['query'],
        properties: {
          query: {
            type: 'string',
            description: 'Términos de búsqueda en inglés o español.',
          },
          orientation: {
            type: 'string',
            enum: ['landscape', 'portrait', 'squarish'],
          },
          perPage: { type: 'number', description: '1 a 10. Por defecto 6.' },
        },
      },
    },
  },
  // ─── Read-only DB tools ──────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'db_overview',
      description:
        'Devuelve un resumen con los conteos totales de la base de datos: usuarios (con desglose por rol — student, teacher, admin, support, supervisor), cursos (con desglose por estado), secciones, módulos, lecciones, matrículas, evaluaciones, calificaciones, certificados, departamentos, posiciones y tickets de soporte. Úsalo cuando el admin pregunte cuántos estudiantes/profesores/cursos hay.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'db_count',
      description:
        'Cuenta cuántos registros hay en una colección, opcionalmente filtrando por igualdad en uno o varios campos de nivel raíz. Ej: db_count("users", { role: "student" }) → cuántos estudiantes hay.',
      parameters: {
        type: 'object',
        required: ['collection'],
        properties: {
          collection: {
            type: 'string',
            enum: [
              'users',
              'courses',
              'sections',
              'modules',
              'lessons',
              'enrollments',
              'evaluations',
              'grades',
              'certificates',
              'departments',
              'positions',
              'supportTickets',
            ],
          },
          where: {
            type: 'object',
            description:
              'Filtro opcional de igualdad sobre campos de nivel raíz. Ej: { "role": "student", "status": "publicado" }.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'db_query',
      description:
        'Devuelve hasta `limit` registros de una colección, opcionalmente filtrando por igualdad y proyectando solo ciertos campos. Útil para responder preguntas como "dame los últimos 10 estudiantes registrados". Sanea automáticamente datos sensibles de usuarios (passwordHash, tokens).',
      parameters: {
        type: 'object',
        required: ['collection'],
        properties: {
          collection: {
            type: 'string',
            enum: [
              'users',
              'courses',
              'sections',
              'modules',
              'lessons',
              'enrollments',
              'evaluations',
              'grades',
              'certificates',
              'departments',
              'positions',
              'supportTickets',
            ],
          },
          where: {
            type: 'object',
            description:
              'Filtro opcional de igualdad sobre campos de nivel raíz.',
          },
          fields: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Lista de campos a devolver. Si se omite se devuelven todos los seguros.',
          },
          limit: {
            type: 'number',
            description: '1 a 50. Por defecto 25.',
          },
          orderBy: {
            type: 'string',
            description:
              'Campo numérico por el que ordenar de mayor a menor (ej. "createdAt", "updatedAt").',
          },
        },
      },
    },
  },
];

// ─── Executors ───────────────────────────────────────────────────────────

type ToolArgs = Record<string, unknown>;

async function execListCourses(): Promise<ToolExecResult> {
  const all = await courseService.getAll();
  const data = all.map((c) => ({
    id: c.id,
    title: c.title,
    category: c.category,
    level: c.level,
    status: c.status,
    image: c.image,
    sectionsCount: c.sectionsCount,
    studentsCount: c.studentsCount,
  }));
  return { data, summary: `Encontré ${data.length} cursos.` };
}

async function execGetCourseTree(args: ToolArgs): Promise<ToolExecResult> {
  const courseId = String(args.courseId);
  const course = await courseService.getById(courseId);
  if (!course) throw new Error(`Curso ${courseId} no existe`);
  const modules = await moduleService.getByCourse(courseId);
  const lessonsByModule = await Promise.all(
    modules
      .sort((a, b) => a.order - b.order)
      .map(async (m) => ({
        module: { id: m.id, title: m.title, description: m.description, order: m.order },
        lessons: (await lessonService.getByModule(m.id))
          .sort((a, b) => a.order - b.order)
          .map((l) => ({
            id: l.id,
            title: l.title,
            description: l.description,
            type: l.type,
            order: l.order,
            status: l.status,
            contentPreview:
              l.type === 'texto'
                ? truncate(unwrapWysiwyg(l.content).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), 180)
                : undefined,
          })),
      })),
  );
  return {
    data: {
      course: {
        id: course.id,
        title: course.title,
        description: course.description,
        category: course.category,
        level: course.level,
        status: course.status,
        image: course.image,
        tags: course.tags,
        objectives: course.objectives,
      },
      modules: lessonsByModule,
    },
    summary: `Árbol del curso "${course.title}" (${modules.length} módulos).`,
  };
}

async function execGetLesson(args: ToolArgs): Promise<ToolExecResult> {
  const lessonId = String(args.lessonId);
  const lesson = await lessonService.getById(lessonId);
  if (!lesson) throw new Error(`Lección ${lessonId} no existe`);
  return {
    data: {
      id: lesson.id,
      moduleId: lesson.moduleId,
      courseId: lesson.courseId,
      title: lesson.title,
      description: lesson.description,
      type: lesson.type,
      contentHtml: lesson.type === 'texto' ? unwrapWysiwyg(lesson.content) : undefined,
      rawContent: lesson.type !== 'texto' ? lesson.content : undefined,
      status: lesson.status,
    },
    summary: `Contenido de la lección "${lesson.title}".`,
  };
}

async function execCreateCourse(args: ToolArgs): Promise<ToolExecResult> {
  const admin = requireAdmin();
  const data: Omit<DBCourse, 'id'> = {
    title: String(args.title),
    description: String(args.description),
    category: String(args.category),
    level: args.level as DBCourse['level'],
    duration: (args.duration as string) || '',
    status: 'borrador',
    image: (args.image as string | undefined),
    tags: (args.tags as string[] | undefined),
    objectives: (args.objectives as string[] | undefined),
    instructor: admin.name,
    instructorId: admin.id,
    studentsCount: 0,
    sectionsCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const created = await courseService.create(data);

  const undoId = newUndoId();
  useUndoStack.getState().register({
    id: undoId,
    createdAt: Date.now(),
    description: `Eliminar curso recién creado "${created.title}"`,
    execute: async () => {
      try {
        await courseService.delete(created.id);
        return true;
      } catch {
        return false;
      }
    },
  });

  return {
    data: { id: created.id, title: created.title },
    summary: `Curso creado: "${created.title}" (borrador).`,
    undoId,
  };
}

async function execUpdateCourse(args: ToolArgs): Promise<ToolExecResult> {
  requireAdmin();
  const courseId = String(args.courseId);
  const patch = (args.patch || {}) as Partial<DBCourse>;
  const before = await courseService.getById(courseId);
  if (!before) throw new Error(`Curso ${courseId} no existe`);
  await courseService.update(courseId, { ...patch, updatedAt: Date.now() });

  const changedKeys = Object.keys(patch);
  const undoId = newUndoId();
  const beforePatch: Partial<DBCourse> = Object.fromEntries(
    changedKeys.map((k) => [k, (before as unknown as Record<string, unknown>)[k]]),
  ) as Partial<DBCourse>;
  useUndoStack.getState().register({
    id: undoId,
    createdAt: Date.now(),
    description: `Revertir cambios en curso "${before.title}"`,
    execute: async () => {
      try {
        await courseService.update(courseId, { ...beforePatch, updatedAt: Date.now() });
        return true;
      } catch {
        return false;
      }
    },
  });

  return {
    data: { id: courseId, changedFields: changedKeys },
    summary: `Curso "${before.title}" actualizado (${changedKeys.join(', ')}).`,
    undoId,
  };
}

async function execCreateModule(args: ToolArgs): Promise<ToolExecResult> {
  requireAdmin();
  const courseId = String(args.courseId);
  const existing = await moduleService.getByCourse(courseId);
  const data: Omit<DBModule, 'id'> = {
    courseId,
    title: String(args.title),
    description: (args.description as string) || '',
    order: existing.length,
    duration: (args.duration as string) || '',
    status: 'borrador',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const created = await moduleService.create(data);
  const undoId = newUndoId();
  useUndoStack.getState().register({
    id: undoId,
    createdAt: Date.now(),
    description: `Eliminar módulo "${created.title}"`,
    execute: async () => {
      try {
        await moduleService.delete(created.id);
        return true;
      } catch {
        return false;
      }
    },
  });
  return {
    data: { id: created.id },
    summary: `Módulo "${created.title}" creado.`,
    undoId,
  };
}

async function execUpdateModule(args: ToolArgs): Promise<ToolExecResult> {
  requireAdmin();
  const moduleId = String(args.moduleId);
  const patch = (args.patch || {}) as Partial<DBModule>;
  const before = await moduleService.getById(moduleId);
  if (!before) throw new Error(`Módulo ${moduleId} no existe`);
  await moduleService.update(moduleId, { ...patch, updatedAt: Date.now() });
  const changedKeys = Object.keys(patch);
  const beforePatch: Partial<DBModule> = Object.fromEntries(
    changedKeys.map((k) => [k, (before as unknown as Record<string, unknown>)[k]]),
  ) as Partial<DBModule>;
  const undoId = newUndoId();
  useUndoStack.getState().register({
    id: undoId,
    createdAt: Date.now(),
    description: `Revertir cambios en módulo "${before.title}"`,
    execute: async () => {
      try {
        await moduleService.update(moduleId, { ...beforePatch, updatedAt: Date.now() });
        return true;
      } catch {
        return false;
      }
    },
  });
  return {
    data: { id: moduleId, changedFields: changedKeys },
    summary: `Módulo "${before.title}" actualizado.`,
    undoId,
  };
}

async function execCreateLesson(args: ToolArgs): Promise<ToolExecResult> {
  requireAdmin();
  const moduleId = String(args.moduleId);
  const mod = await moduleService.getById(moduleId);
  if (!mod) throw new Error(`Módulo ${moduleId} no existe`);
  const existing = await lessonService.getByModule(moduleId);
  const data: Omit<DBLesson, 'id'> = {
    moduleId,
    courseId: mod.courseId,
    title: String(args.title),
    description: (args.description as string) || '',
    type: 'texto',
    content: wrapWysiwyg(String(args.contentHtml)),
    duration: '',
    order: existing.length,
    status: 'borrador',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const created = await lessonService.create(data);
  const undoId = newUndoId();
  useUndoStack.getState().register({
    id: undoId,
    createdAt: Date.now(),
    description: `Eliminar lección "${created.title}"`,
    execute: async () => {
      try {
        await lessonService.delete(created.id);
        return true;
      } catch {
        return false;
      }
    },
  });
  return {
    data: { id: created.id },
    summary: `Lección "${created.title}" creada en "${mod.title}".`,
    undoId,
  };
}

async function execUpdateLesson(args: ToolArgs): Promise<ToolExecResult> {
  requireAdmin();
  const lessonId = String(args.lessonId);
  const patch = (args.patch || {}) as Partial<DBLesson>;
  const before = await lessonService.getById(lessonId);
  if (!before) throw new Error(`Lección ${lessonId} no existe`);
  await lessonService.update(lessonId, { ...patch, updatedAt: Date.now() });
  const changedKeys = Object.keys(patch);
  const beforePatch: Partial<DBLesson> = Object.fromEntries(
    changedKeys.map((k) => [k, (before as unknown as Record<string, unknown>)[k]]),
  ) as Partial<DBLesson>;
  const undoId = newUndoId();
  useUndoStack.getState().register({
    id: undoId,
    createdAt: Date.now(),
    description: `Revertir cambios en lección "${before.title}"`,
    execute: async () => {
      try {
        await lessonService.update(lessonId, { ...beforePatch, updatedAt: Date.now() });
        return true;
      } catch {
        return false;
      }
    },
  });
  return {
    data: { id: lessonId, changedFields: changedKeys },
    summary: `Lección "${before.title}" actualizada.`,
    undoId,
  };
}

async function execUpdateLessonContent(args: ToolArgs): Promise<ToolExecResult> {
  requireAdmin();
  const lessonId = String(args.lessonId);
  const before = await lessonService.getById(lessonId);
  if (!before) throw new Error(`Lección ${lessonId} no existe`);
  if (before.type !== 'texto') {
    throw new Error(`La lección "${before.title}" es de tipo ${before.type}; este tool solo edita lecciones de texto.`);
  }
  const newHtml = String(args.contentHtml);
  const prevContent = before.content;
  await lessonService.update(lessonId, {
    content: wrapWysiwyg(newHtml),
    updatedAt: Date.now(),
  });
  const undoId = newUndoId();
  useUndoStack.getState().register({
    id: undoId,
    createdAt: Date.now(),
    description: `Restaurar contenido anterior de "${before.title}"`,
    execute: async () => {
      try {
        await lessonService.update(lessonId, { content: prevContent, updatedAt: Date.now() });
        return true;
      } catch {
        return false;
      }
    },
  });
  return {
    data: { id: lessonId, length: newHtml.length },
    summary: `Contenido de "${before.title}" reemplazado (${newHtml.length} caracteres).`,
    undoId,
  };
}

async function execGetCurrentSystemPrompt(): Promise<ToolExecResult> {
  const admin = requireAdmin();
  const active = await getActivePrompt(admin.id, admin.name);
  return {
    data: {
      versionId: active.id,
      versionNumber: active.versionNumber,
      content: active.content,
      reason: active.reason,
    },
    summary: `Prompt activo: v${active.versionNumber}.`,
  };
}

async function execProposeSystemPromptUpdate(args: ToolArgs): Promise<ToolExecResult> {
  const admin = requireAdmin();
  const newPrompt = String(args.newPrompt || '').trim();
  const reason = String(args.reason || '').trim();
  if (!newPrompt) throw new Error('newPrompt vacío');
  if (!reason) throw new Error('Falta la razón del cambio');

  const { created, previousActiveId } = await createVersion({
    content: newPrompt,
    reason,
    userId: admin.id,
    userName: admin.name,
  });

  const undoId = newUndoId();
  useUndoStack.getState().register({
    id: undoId,
    createdAt: Date.now(),
    description: `Revertir prompt del asistente a la versión anterior`,
    execute: async () => {
      try {
        if (previousActiveId) {
          await activateVersion(previousActiveId);
        }
        return true;
      } catch {
        return false;
      }
    },
  });

  return {
    data: {
      versionId: created.id,
      versionNumber: created.versionNumber,
    },
    summary: `Prompt actualizado a v${created.versionNumber}: ${reason}`,
    undoId,
  };
}

async function execSearchStockImages(args: ToolArgs): Promise<ToolExecResult> {
  const query = String(args.query || '').trim();
  if (!query) throw new Error('query vacío');
  const results = await searchStockImages({
    query,
    orientation: args.orientation as 'landscape' | 'portrait' | 'squarish' | undefined,
    perPage: typeof args.perPage === 'number' ? args.perPage : 6,
  });
  return {
    data: results,
    summary: `${results.length} imágenes encontradas para "${query}".`,
  };
}

// ─── Read-only DB executors ──────────────────────────────────────────────

type CollectionName =
  | 'users'
  | 'courses'
  | 'sections'
  | 'modules'
  | 'lessons'
  | 'enrollments'
  | 'evaluations'
  | 'grades'
  | 'certificates'
  | 'departments'
  | 'positions'
  | 'supportTickets';

const COLLECTION_LOADERS: Record<CollectionName, () => Promise<unknown[]>> = {
  users: () => userService.getAll(),
  courses: () => courseService.getAll(),
  sections: () => sectionService.getAll(),
  modules: () => moduleService.getAll(),
  lessons: () => lessonService.getAll(),
  enrollments: () => legacyEnrollmentService.getAll(),
  evaluations: () => evaluationService.getAll(),
  grades: () => gradeService.getAll(),
  certificates: () => certificateService.getAll(),
  departments: () => departmentService.getAll(),
  positions: () => positionService.getAll(),
  supportTickets: () => supportTicketService.getAll(),
};

// Strip credentials and reset tokens from user records before they go to the
// model. The AI doesn't need them and we don't want to risk leaking hashes.
const USER_SECRET_FIELDS = new Set([
  'passwordHash',
  'emailVerificationToken',
  'passwordResetToken',
  'passwordResetExpires',
  'loginAttempts',
  'lockUntil',
]);

function sanitizeRecord(collection: CollectionName, record: unknown): Record<string, unknown> {
  const obj = (record ?? {}) as Record<string, unknown>;
  if (collection !== 'users') return obj;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj)) {
    if (!USER_SECRET_FIELDS.has(k)) out[k] = obj[k];
  }
  return out;
}

function matchesWhere(record: Record<string, unknown>, where?: Record<string, unknown>): boolean {
  if (!where) return true;
  for (const [k, v] of Object.entries(where)) {
    if (record[k] !== v) return false;
  }
  return true;
}

function projectFields(
  record: Record<string, unknown>,
  fields?: string[],
): Record<string, unknown> {
  if (!fields || fields.length === 0) return record;
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (f in record) out[f] = record[f];
  }
  return out;
}

async function execDbOverview(): Promise<ToolExecResult> {
  requireAdmin();
  const [
    users,
    courses,
    sections,
    modules,
    lessons,
    enrollments,
    evaluations,
    grades,
    certificates,
    departments,
    positions,
    supportTickets,
  ] = await Promise.all([
    userService.getAll(),
    courseService.getAll(),
    sectionService.getAll(),
    moduleService.getAll(),
    lessonService.getAll(),
    legacyEnrollmentService.getAll(),
    evaluationService.getAll(),
    gradeService.getAll(),
    certificateService.getAll(),
    departmentService.getAll(),
    positionService.getAll(),
    supportTicketService.getAll(),
  ]);

  const usersByRole: Record<string, number> = {};
  for (const u of users) {
    const r = (u as { role?: string }).role || 'unknown';
    usersByRole[r] = (usersByRole[r] || 0) + 1;
  }
  const coursesByStatus: Record<string, number> = {};
  for (const c of courses) {
    const s = (c as { status?: string }).status || 'unknown';
    coursesByStatus[s] = (coursesByStatus[s] || 0) + 1;
  }
  const ticketsByStatus: Record<string, number> = {};
  for (const t of supportTickets) {
    const s = (t as { status?: string }).status || 'unknown';
    ticketsByStatus[s] = (ticketsByStatus[s] || 0) + 1;
  }

  const data = {
    users: { total: users.length, byRole: usersByRole },
    courses: { total: courses.length, byStatus: coursesByStatus },
    sections: { total: sections.length },
    modules: { total: modules.length },
    lessons: { total: lessons.length },
    enrollments: { total: enrollments.length },
    evaluations: { total: evaluations.length },
    grades: { total: grades.length },
    certificates: { total: certificates.length },
    departments: { total: departments.length },
    positions: { total: positions.length },
    supportTickets: { total: supportTickets.length, byStatus: ticketsByStatus },
  };
  return {
    data,
    summary: `Overview: ${users.length} usuarios (${usersByRole.student || 0} estudiantes, ${usersByRole.teacher || 0} profesores), ${courses.length} cursos, ${sections.length} secciones, ${enrollments.length} matrículas.`,
  };
}

async function execDbCount(args: ToolArgs): Promise<ToolExecResult> {
  requireAdmin();
  const collection = String(args.collection) as CollectionName;
  const loader = COLLECTION_LOADERS[collection];
  if (!loader) throw new Error(`Colección desconocida: ${collection}`);
  const where = (args.where as Record<string, unknown> | undefined) || undefined;
  const all = await loader();
  const count = all.filter((r) => matchesWhere(r as Record<string, unknown>, where)).length;
  const filterStr = where ? ` con filtro ${JSON.stringify(where)}` : '';
  return {
    data: { collection, where: where ?? null, count },
    summary: `${count} registros en "${collection}"${filterStr}.`,
  };
}

async function execDbQuery(args: ToolArgs): Promise<ToolExecResult> {
  requireAdmin();
  const collection = String(args.collection) as CollectionName;
  const loader = COLLECTION_LOADERS[collection];
  if (!loader) throw new Error(`Colección desconocida: ${collection}`);
  const where = (args.where as Record<string, unknown> | undefined) || undefined;
  const fields = Array.isArray(args.fields)
    ? (args.fields as unknown[]).map((f) => String(f))
    : undefined;
  const limit = Math.min(Math.max(typeof args.limit === 'number' ? args.limit : 25, 1), 50);
  const orderBy = typeof args.orderBy === 'string' ? args.orderBy : undefined;

  const all = await loader();
  let rows = all
    .map((r) => sanitizeRecord(collection, r))
    .filter((r) => matchesWhere(r, where));

  if (orderBy) {
    rows = rows.slice().sort((a, b) => {
      const av = typeof a[orderBy] === 'number' ? (a[orderBy] as number) : 0;
      const bv = typeof b[orderBy] === 'number' ? (b[orderBy] as number) : 0;
      return bv - av;
    });
  }

  const total = rows.length;
  const sliced = rows.slice(0, limit).map((r) => projectFields(r, fields));
  return {
    data: { collection, total, returned: sliced.length, rows: sliced },
    summary: `${sliced.length}/${total} registros de "${collection}" devueltos.`,
  };
}

// ─── Dispatcher ──────────────────────────────────────────────────────────

export type ToolName =
  | 'list_courses'
  | 'get_course_tree'
  | 'get_lesson'
  | 'create_course'
  | 'update_course'
  | 'create_module'
  | 'update_module'
  | 'create_lesson'
  | 'update_lesson'
  | 'update_lesson_content'
  | 'get_current_system_prompt'
  | 'propose_system_prompt_update'
  | 'search_stock_images'
  | 'db_overview'
  | 'db_count'
  | 'db_query';

const EXECUTORS: Record<ToolName, (args: ToolArgs) => Promise<ToolExecResult>> = {
  list_courses: execListCourses,
  get_course_tree: execGetCourseTree,
  get_lesson: execGetLesson,
  create_course: execCreateCourse,
  update_course: execUpdateCourse,
  create_module: execCreateModule,
  update_module: execUpdateModule,
  create_lesson: execCreateLesson,
  update_lesson: execUpdateLesson,
  update_lesson_content: execUpdateLessonContent,
  get_current_system_prompt: execGetCurrentSystemPrompt,
  propose_system_prompt_update: execProposeSystemPromptUpdate,
  search_stock_images: execSearchStockImages,
  db_overview: execDbOverview,
  db_count: execDbCount,
  db_query: execDbQuery,
};

export async function executeTool(name: string, args: ToolArgs): Promise<ToolExecResult> {
  const exec = EXECUTORS[name as ToolName];
  if (!exec) throw new Error(`Tool desconocido: ${name}`);
  return exec(args);
}
