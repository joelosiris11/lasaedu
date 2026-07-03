// ════════════════════════════════════════════════════════════════════════════
// lasaAcademyTools.js — Módulo DROP-IN para Zeus (replicable en cualquier
// instancia). Agrega tools READ-ONLY para consultar TODO en Lasa Academy vía
// el puente /bridge. Es el mismo archivo para el Zeus personal y el de J. Joaquín.
//
// INSTALACIÓN (2 líneas en server/bot/agentic.js):
//   import { LASA_ACADEMY_TOOLS } from './lasaAcademyTools.js';   // arriba
//   TOOLS.push(...LASA_ACADEMY_TOOLS);                            // tras definir TOOLS
//
// CONFIG (env de Zeus):
//   LASA_BRIDGE_URL=https://lasaacademy.cloudteco.com   (o http://127.0.0.1:3020 si Zeus corre en tecoserver)
//   LASA_BRIDGE_TOKEN=<el token de servicio de Lasa Academy>
// ════════════════════════════════════════════════════════════════════════════

const BASE = (process.env.LASA_BRIDGE_URL || 'https://lasaacademy.cloudteco.com').replace(/\/+$/, '');
const TOKEN = process.env.LASA_BRIDGE_TOKEN || '';

async function bridge(path, { method = 'GET', body } = {}) {
  if (!TOKEN) return { error: 'Falta LASA_BRIDGE_TOKEN en el entorno de Zeus.' };
  try {
    const res = await fetch(`${BASE}/bridge${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      return { error: e.error || `puente respondió ${res.status}` };
    }
    return res.json();
  } catch (err) {
    return { error: `puente inalcanzable: ${err.message}` };
  }
}

const COLLECTIONS_HINT =
  'users, courses, sections, modules, lessons, enrollments, evaluationAttempts, ' +
  'departments, positions, auditLogs, studentActivityLogs, conversations, messages, ' +
  'aiAssistantSessions, aiAssistantPrompts, sectionLessonOverrides';

export const LASA_ACADEMY_TOOLS = [
  {
    name: 'lasaacademy_overview',
    description:
      'Resumen de Lasa Academy (la plataforma de cursos de La Aurora / T-Eco): conteos de usuarios por rol, cursos por estado, lecciones por tipo y matrículas. Úsalo para "¿cuántos estudiantes/cursos/lecciones hay en Lasa Academy?".',
    parameters: { type: 'object', properties: {}, required: [] },
    run: () => bridge('/overview'),
  },
  {
    name: 'lasaacademy_query',
    description:
      `Consulta READ-ONLY cualquier colección de Lasa Academy. Colecciones: ${COLLECTIONS_HINT}. ` +
      'where = lista de {field, value, op?} (op: ==,!=,>,>=,<,<=; por defecto ==). ' +
      'fields = campos a devolver (opcional, para respuestas cortas). ' +
      'Campos comunes: role, status, courseId, moduleId, userId, instructorId, email, sectionId. ' +
      'Ej: listar cursos publicados → collection:"courses", where:[{field:"status",value:"publicado"}].',
    parameters: {
      type: 'object',
      properties: {
        collection: { type: 'string', description: 'Nombre de la colección.' },
        where: { type: 'array', description: 'Filtros [{field,value,op?}].' },
        fields: { type: 'array', description: 'Campos a devolver (opcional).' },
        orderBy: { type: 'string', description: 'Campo para ordenar (opcional).' },
        orderDir: { type: 'string', description: 'asc|desc (opcional).' },
        limit: { type: 'integer', description: 'Máx 200, default 20.' },
      },
      required: ['collection'],
    },
    run: (args) => bridge('/query', { method: 'POST', body: args }),
  },
  {
    name: 'lasaacademy_count',
    description: 'Cuenta registros de una colección de Lasa Academy, con filtros opcionales (mismo where que lasaacademy_query).',
    parameters: {
      type: 'object',
      properties: { collection: { type: 'string' }, where: { type: 'array' } },
      required: ['collection'],
    },
    run: (args) => bridge('/count', { method: 'POST', body: args }),
  },
  {
    name: 'lasaacademy_course_tree',
    description: 'Estructura de un curso de Lasa Academy: sus módulos y las lecciones de cada uno (id, título, tipo). Pasa el courseId (lo obtienes con lasaacademy_query sobre courses).',
    parameters: { type: 'object', properties: { courseId: { type: 'string' } }, required: ['courseId'] },
    run: ({ courseId }) => bridge(`/course/${encodeURIComponent(courseId)}/tree`),
  },
  {
    name: 'lasaacademy_lesson',
    description: 'Contenido completo de una lección de Lasa Academy por su id.',
    parameters: { type: 'object', properties: { lessonId: { type: 'string' } }, required: ['lessonId'] },
    run: ({ lessonId }) => bridge(`/lesson/${encodeURIComponent(lessonId)}`),
  },
  {
    name: 'lasaacademy_user',
    description: 'Perfil + matrículas + progreso de un usuario de Lasa Academy. Pasa su id o su email.',
    parameters: { type: 'object', properties: { idOrEmail: { type: 'string' } }, required: ['idOrEmail'] },
    run: ({ idOrEmail }) => bridge(`/user/${encodeURIComponent(idOrEmail)}`),
  },
];
