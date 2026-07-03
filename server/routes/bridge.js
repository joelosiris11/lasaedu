import express from 'express';
import { q } from '../db/pool.js';
import { COLLECTIONS, quoteCol } from '../db/collections.js';
import { whereClause, orderClause } from './data.js';

// Puente READ-ONLY para que Zeus (u otro cliente de servicio) consulte TODO en
// Lasa Academy — los mismos datos que ve la IA interna. Auth por token de
// servicio (LASA_BRIDGE_TOKEN), NO el JWT de usuarios. Sin escritura.
export const bridgeRouter = express.Router();

// ── auth por token de servicio ──────────────────────────────────────────────
bridgeRouter.use((req, res, next) => {
  const expected = process.env.LASA_BRIDGE_TOKEN;
  if (!expected) return res.status(503).json({ error: 'bridge no configurado (falta LASA_BRIDGE_TOKEN)' });
  const got = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || req.headers['x-bridge-token'] || '';
  if (got !== expected) return res.status(401).json({ error: 'token de puente inválido' });
  next();
});

const rowToDoc = (row) => ({ id: row.id, ...row.data });
// proyección opcional de campos (para respuestas chicas en WhatsApp)
function project(doc, fields) {
  if (!Array.isArray(fields) || !fields.length) return doc;
  const out = { id: doc.id };
  for (const f of fields) if (f in doc) out[f] = doc[f];
  return out;
}
function cfgOf(collection, res) {
  const cfg = COLLECTIONS[collection];
  if (!cfg) { res.status(404).json({ error: `colección desconocida: ${collection}. Usa /bridge/collections.` }); return null; }
  return cfg;
}

// ── health + catálogo ───────────────────────────────────────────────────────
bridgeRouter.get('/health', (_req, res) => res.json({ ok: true, project: 'lasaacademy', ts: Date.now() }));

bridgeRouter.get('/collections', (_req, res) => {
  res.json(Object.entries(COLLECTIONS).map(([name, cfg]) => ({
    name, table: cfg.table, queryableColumns: Object.values(cfg.cols),
  })));
});

// ── overview: conteos + desgloses (como db_overview de la IA interna) ────────
bridgeRouter.get('/overview', async (_req, res) => {
  const counts = {};
  for (const [name, cfg] of Object.entries(COLLECTIONS)) {
    const { rows } = await q(`SELECT count(*)::int AS n FROM ${cfg.table}`);
    counts[name] = rows[0].n;
  }
  const breakdown = async (sql) => Object.fromEntries((await q(sql)).rows.map((r) => [r.k ?? '(vacío)', r.n]));
  res.json({
    counts,
    usersByRole: await breakdown(`SELECT role AS k, count(*)::int AS n FROM users GROUP BY role ORDER BY n DESC`),
    coursesByStatus: await breakdown(`SELECT status AS k, count(*)::int AS n FROM courses GROUP BY status ORDER BY n DESC`),
    enrollmentsByStatus: await breakdown(`SELECT status AS k, count(*)::int AS n FROM enrollments GROUP BY status ORDER BY n DESC`),
    lessonsByType: await breakdown(`SELECT data->>'type' AS k, count(*)::int AS n FROM lessons GROUP BY data->>'type' ORDER BY n DESC`),
  });
});

// ── count: db_count(collection, where) ───────────────────────────────────────
bridgeRouter.post('/count', async (req, res) => {
  const cfg = cfgOf(req.body?.collection, res); if (!cfg) return;
  const where = Array.isArray(req.body?.where) ? req.body.where : [];
  const clauses = [], params = [];
  where.forEach((w, i) => { clauses.push(whereClause(cfg, w.field, i + 1, w.op).sql); params.push(w.value); });
  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await q(`SELECT count(*)::int AS n FROM ${cfg.table} ${whereSql}`, params);
  res.json({ collection: req.body.collection, count: rows[0].n });
});

// ── query: db_query(collection, where, fields, limit, orderBy) ───────────────
bridgeRouter.post('/query', async (req, res) => {
  const cfg = cfgOf(req.body?.collection, res); if (!cfg) return;
  const where = Array.isArray(req.body?.where) ? req.body.where : [];
  const clauses = [], params = [];
  where.forEach((w, i) => { clauses.push(whereClause(cfg, w.field, i + 1, w.op).sql); params.push(w.value); });
  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const orderSql = orderClause(cfg, req.body?.orderBy, req.body?.orderDir);
  const limit = Math.min(Math.max(Number(req.body?.limit) || 20, 1), 200); // tope bajo para el bot
  const { rows } = await q(`SELECT id, data FROM ${cfg.table} ${whereSql} ${orderSql} LIMIT ${limit}`, params);
  res.json(rows.map((r) => project(rowToDoc(r), req.body?.fields)));
});

// ── árbol de curso (como get_course_tree) ────────────────────────────────────
bridgeRouter.get('/course/:id/tree', async (req, res) => {
  const c = await q(`SELECT id, data FROM courses WHERE id = $1`, [req.params.id]);
  if (!c.rows[0]) return res.status(404).json({ error: 'curso no existe' });
  const mods = await q(`SELECT id, data FROM modules WHERE course_id = $1 ORDER BY "order"`, [req.params.id]);
  const modules = [];
  for (const m of mods.rows) {
    const ls = await q(`SELECT id, data FROM lessons WHERE module_id = $1 ORDER BY "order"`, [m.id]);
    modules.push({
      id: m.id, title: m.data.title, order: m.data.order,
      lessons: ls.rows.map((l) => ({ id: l.id, title: l.data.title, type: l.data.type, order: l.data.order })),
    });
  }
  const cd = c.rows[0].data;
  res.json({ course: { id: c.rows[0].id, title: cd.title, status: cd.status, category: cd.category, studentsCount: cd.studentsCount }, modules });
});

// ── lección completa (como get_lesson) ───────────────────────────────────────
bridgeRouter.get('/lesson/:id', async (req, res) => {
  const { rows } = await q(`SELECT id, data FROM lessons WHERE id = $1`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'lección no existe' });
  res.json(rowToDoc(rows[0]));
});

// ── usuario: perfil + matrículas + progreso ──────────────────────────────────
bridgeRouter.get('/user/:id', async (req, res) => {
  const u = await q(`SELECT id, email, name, role, status, data FROM users WHERE id = $1 OR lower(email) = lower($1)`, [req.params.id]);
  if (!u.rows[0]) return res.status(404).json({ error: 'usuario no existe' });
  const uid = u.rows[0].id;
  const enr = await q(`SELECT id, data FROM enrollments WHERE user_id = $1`, [uid]);
  res.json({
    user: rowToDoc(u.rows[0]),
    enrollments: enr.rows.map((e) => ({
      id: e.id, courseId: e.data.courseId, sectionId: e.data.sectionId,
      status: e.data.status, progress: e.data.progress,
    })),
  });
});
