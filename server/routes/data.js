import express from 'express';
import crypto from 'crypto';
import { q } from '../db/pool.js';
import { COLLECTIONS, quoteCol } from '../db/collections.js';
import { requireAuth, canWrite } from '../lib/authz.js';

export const dataRouter = express.Router();
dataRouter.use(requireAuth); // toda /api requiere sesión (regla: read = isSignedIn)

const cfgOf = (req, res) => {
  const cfg = COLLECTIONS[req.params.collection];
  if (!cfg) {
    res.status(404).json({ error: `Colección desconocida: ${req.params.collection}` });
    return null;
  }
  return cfg;
};

// fila Postgres -> documento (forma que espera el frontend: data + id)
const rowToDoc = (row) => ({ id: row.id, ...row.data });

// construye las columnas tipadas desde un documento
function typedValues(cfg, doc) {
  const cols = Object.keys(cfg.cols);
  const vals = cols.map((c) => {
    const v = doc[cfg.cols[c]];
    return v === undefined ? null : v;
  });
  return { cols, vals };
}

// Mapea el operador de Firestore (WhereFilterOp) a SQL. Default: igualdad.
function opSql(op) {
  return { '==': '=', '!=': '!=', '>': '>', '>=': '>=', '<': '<', '<=': '<=' }[op] || '=';
}
const colFor = (cfg, field) => Object.keys(cfg.cols).find((c) => cfg.cols[c] === field);

// WHERE para un campo: usa columna tipada si existe, si no cae a data->>'campo'
// (exportado para reuso en el puente de Zeus)
export function whereClause(cfg, field, paramIdx, op) {
  const o = opSql(op);
  const col = colFor(cfg, field);
  if (col) return { sql: `${quoteCol(col)} ${o} $${paramIdx}` };
  return { sql: `data->>'${String(field).replace(/'/g, "''")}' ${o} $${paramIdx}` };
}

// ORDER BY seguro (columna tipada o data->>'campo')
export function orderClause(cfg, field, dir) {
  if (!field) return '';
  const d = String(dir).toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  const col = colFor(cfg, field);
  return col ? `ORDER BY ${quoteCol(col)} ${d}` : `ORDER BY data->>'${String(field).replace(/'/g, "''")}' ${d}`;
}

// GET /api/:collection  (opcional ?limit=&orderBy=&orderDir=)
dataRouter.get('/:collection', async (req, res) => {
  const cfg = cfgOf(req, res); if (!cfg) return;
  const limit = Math.min(Number(req.query.limit) || 1000, 5000);
  let order = '';
  if (req.query.orderBy) {
    const ob = String(req.query.orderBy);
    const col = Object.keys(cfg.cols).find((c) => cfg.cols[c] === ob);
    const dir = String(req.query.orderDir).toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    order = col ? `ORDER BY ${quoteCol(col)} ${dir}` : `ORDER BY data->>'${ob}' ${dir}`;
  }
  const { rows } = await q(`SELECT id, data FROM ${cfg.table} ${order} LIMIT ${limit}`);
  res.json(rows.map(rowToDoc));
});

// GET /api/:collection/:id
dataRouter.get('/:collection/:id', async (req, res) => {
  const cfg = cfgOf(req, res); if (!cfg) return;
  const { rows } = await q(`SELECT id, data FROM ${cfg.table} WHERE id = $1`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'No encontrado' });
  res.json(rowToDoc(rows[0]));
});

// POST /api/:collection/query  { where:[{field,op,value}], orderBy?, orderDir?, limit?, offset? }
dataRouter.post('/:collection/query', async (req, res) => {
  const cfg = cfgOf(req, res); if (!cfg) return;
  const where = Array.isArray(req.body?.where) ? req.body.where : [];
  const clauses = [], params = [];
  where.forEach((w, i) => {
    clauses.push(whereClause(cfg, w.field, i + 1, w.op).sql);
    params.push(w.value);
  });
  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const orderSql = orderClause(cfg, req.body?.orderBy, req.body?.orderDir);
  const limit = Math.min(Number(req.body?.limit) || 1000, 5000);
  const offset = Math.max(Number(req.body?.offset) || 0, 0);
  const { rows } = await q(
    `SELECT id, data FROM ${cfg.table} ${whereSql} ${orderSql} LIMIT ${limit} OFFSET ${offset}`,
    params,
  );
  res.json(rows.map(rowToDoc));
});

// POST /api/:collection  (crear)
dataRouter.post('/:collection', async (req, res) => {
  const cfg = cfgOf(req, res); if (!cfg) return;
  const deny = canWrite({ collection: req.params.collection, action: 'create', user: req.user });
  if (deny) return res.status(403).json({ error: deny });

  const id = req.body?.id || crypto.randomUUID();
  const doc = { ...req.body, id };
  const { cols, vals } = typedValues(cfg, doc);
  const allCols = ['id', ...cols, 'data'];
  const ph = allCols.map((_, i) => `$${i + 1}`).join(', ');
  await q(
    `INSERT INTO ${cfg.table} (${allCols.map(quoteCol).join(', ')}) VALUES (${ph})`,
    [id, ...vals, JSON.stringify(doc)],
  );
  res.status(201).json(rowToDoc({ id, data: doc }));
});

// PATCH /api/:collection/:id  (actualizar, merge)
dataRouter.patch('/:collection/:id', async (req, res) => {
  const cfg = cfgOf(req, res); if (!cfg) return;
  const cur = await q(`SELECT id, data FROM ${cfg.table} WHERE id = $1`, [req.params.id]);
  if (!cur.rows[0]) return res.status(404).json({ error: 'No encontrado' });

  const deny = canWrite({
    collection: req.params.collection, action: 'update', user: req.user, existing: cur.rows[0],
  });
  if (deny) return res.status(403).json({ error: deny });

  const merged = { ...cur.rows[0].data, ...req.body, id: req.params.id };
  const { cols, vals } = typedValues(cfg, merged);
  const setTyped = cols.map((c, i) => `${quoteCol(c)} = $${i + 2}`);
  await q(
    `UPDATE ${cfg.table} SET ${[...setTyped, `data = $${cols.length + 2}`].join(', ')} WHERE id = $1`,
    [req.params.id, ...vals, JSON.stringify(merged)],
  );
  res.json(rowToDoc({ id: req.params.id, data: merged }));
});

// DELETE /api/:collection/:id
dataRouter.delete('/:collection/:id', async (req, res) => {
  const cfg = cfgOf(req, res); if (!cfg) return;
  const cur = await q(`SELECT id, data, ${Object.keys(cfg.cols).map(quoteCol).join(', ')} FROM ${cfg.table} WHERE id = $1`, [req.params.id]);
  if (!cur.rows[0]) return res.status(404).json({ error: 'No encontrado' });
  const deny = canWrite({
    collection: req.params.collection, action: 'delete', user: req.user, existing: cur.rows[0],
  });
  if (deny) return res.status(403).json({ error: deny });
  await q(`DELETE FROM ${cfg.table} WHERE id = $1`, [req.params.id]);
  res.json({ ok: true, id: req.params.id });
});
