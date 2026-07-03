/**
 * migrate-firestore-to-pg.mjs — Migración de datos Firestore → PostgreSQL.
 *
 * Lee TODAS las colecciones (read-only en Firestore) y hace UPSERT idempotente
 * en Postgres: columnas tipadas para consultar + `data JSONB` con el documento
 * COMPLETO (lossless). Al final imprime conteos y los compara con el manifiesto.
 *
 * Credenciales Firestore: GOOGLE_APPLICATION_CREDENTIALS (SA) o gcloud ADC.
 * Postgres: PG_* (PGHOST/PGPORT/PGUSER/PGDATABASE) o DATABASE_URL.
 *
 * Uso (prueba local contra el cluster desechable):
 *   FIREBASE_PROJECT_ID=lasaedurd \
 *   PGHOST=/tmp PGPORT=5433 PGUSER=postgres PGDATABASE=lasaacademy_test \
 *   node scripts/migrate-firestore-to-pg.mjs
 */

import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import pg from 'pg';
import fs from 'fs';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'lasaedurd';
const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const hasSA = saPath && fs.existsSync(saPath);
initializeApp({
  credential: hasSA ? cert(JSON.parse(fs.readFileSync(saPath, 'utf8'))) : applicationDefault(),
  projectId: PROJECT_ID,
});
const fdb = getFirestore();

// ── mapeo colección → tabla + columnas tipadas (campo del doc) ──────────────
// El resto del documento SIEMPRE va completo en `data` (lossless).
const MAP = [
  { col: 'aiAssistantPrompts', table: 'ai_assistant_prompts',
    cols: { is_active: 'isActive', version_number: 'versionNumber', created_at: 'createdAt', updated_at: 'updatedAt' } },
  { col: 'aiAssistantSessions', table: 'ai_assistant_sessions',
    cols: { user_id: 'userId', course_id: 'courseId', created_at: 'createdAt', updated_at: 'updatedAt' } },
  { col: 'auditLogs', table: 'audit_logs',
    cols: { actor_id: 'actorId', resource_type: 'resourceType', resource_id: 'resourceId', course_id: 'courseId', created_at: 'createdAt' } },
  { col: 'conversations', table: 'conversations',
    cols: { type: 'type', created_at: 'createdAt', updated_at: 'updatedAt' } },
  { col: 'courses', table: 'courses',
    cols: { instructor_id: 'instructorId', status: 'status', category: 'category', level: 'level', created_at: 'createdAt', updated_at: 'updatedAt' } },
  { col: 'departments', table: 'departments',
    cols: { created_at: 'createdAt', updated_at: 'updatedAt' } },
  { col: 'enrollments', table: 'enrollments',
    cols: { user_id: 'userId', course_id: 'courseId', section_id: 'sectionId', status: 'status', progress: 'progress', created_at: 'createdAt', updated_at: 'updatedAt' } },
  { col: 'evaluationAttempts', table: 'evaluation_attempts',
    cols: { user_id: 'userId', course_id: 'courseId', evaluation_id: 'evaluationId', passed: 'passed', created_at: 'createdAt', updated_at: 'updatedAt' } },
  { col: 'lessons', table: 'lessons',
    cols: { course_id: 'courseId', module_id: 'moduleId', type: 'type', status: 'status', order: 'order', created_at: 'createdAt', updated_at: 'updatedAt' } },
  { col: 'messages', table: 'messages',
    cols: { conversation_id: 'conversationId', sender_id: 'senderId', created_at: 'createdAt', updated_at: 'updatedAt' } },
  { col: 'modules', table: 'modules',
    cols: { course_id: 'courseId', status: 'status', order: 'order', created_at: 'createdAt', updated_at: 'updatedAt' } },
  { col: 'positions', table: 'positions',
    cols: { department_id: 'departmentId', parent_position_id: 'parentPositionId', platform_role: 'platformRole', created_at: 'createdAt', updated_at: 'updatedAt' } },
  { col: 'sectionLessonOverrides', table: 'section_lesson_overrides',
    cols: { section_id: 'sectionId', lesson_id: 'lessonId', course_id: 'courseId', created_at: 'createdAt', updated_at: 'updatedAt' } },
  { col: 'sections', table: 'sections',
    cols: { course_id: 'courseId', instructor_id: 'instructorId', status: 'status', created_at: 'createdAt', updated_at: 'updatedAt' } },
  { col: 'studentActivityLogs', table: 'student_activity_logs',
    cols: { student_id: 'studentId', course_id: 'courseId', section_id: 'sectionId', activity_type: 'activityType', created_at: 'createdAt' } },
  { col: 'users', table: 'users',
    cols: { email: 'email', name: 'name', role: 'role', status: 'status', email_verified: 'emailVerified', created_at: 'createdAt', updated_at: 'updatedAt' } },
];

const pool = new pg.Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.PGHOST || '/tmp',
        port: Number(process.env.PGPORT || 5432),
        user: process.env.PGUSER || 'postgres',
        database: process.env.PGDATABASE || 'lasaacademy',
      },
);

const quoteCol = (c) => (c === 'order' ? '"order"' : c);

async function migrateCollection({ col, table, cols }) {
  const snap = await fdb.collection(col).get();
  const colNames = Object.keys(cols);
  const allCols = ['id', ...colNames, 'data'];
  const placeholders = allCols.map((_, i) => `$${i + 1}`).join(', ');
  const updateSet = [...colNames, 'data'].map((c) => `${quoteCol(c)} = EXCLUDED.${quoteCol(c)}`).join(', ');
  const sql = `INSERT INTO ${table} (${allCols.map(quoteCol).join(', ')}) VALUES (${placeholders})
               ON CONFLICT (id) DO UPDATE SET ${updateSet}`;

  const client = await pool.connect();
  let n = 0;
  try {
    await client.query('BEGIN');
    for (const doc of snap.docs) {
      const data = doc.data();
      const values = [doc.id];
      for (const c of colNames) {
        const v = data[cols[c]];
        values.push(v === undefined ? null : v);
      }
      values.push(JSON.stringify(data));
      await client.query(sql, values);
      n += 1;
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  return { table, firestore: snap.size, inserted: n };
}

async function main() {
  console.log(`📦 Migrando ${PROJECT_ID} → Postgres (${process.env.PGDATABASE || 'lasaacademy'})\n`);
  const results = [];
  for (const m of MAP) {
    process.stdout.write(`  · ${m.col} → ${m.table} … `);
    const r = await migrateCollection(m);
    // verificación: filas en PG == docs en Firestore
    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM ${m.table}`);
    r.pgRows = rows[0].n;
    r.ok = r.pgRows === r.firestore;
    results.push(r);
    console.log(`${r.firestore} docs → ${r.pgRows} filas  ${r.ok ? '✅' : '❌ MISMATCH'}`);
  }

  const totalDocs = results.reduce((a, r) => a + r.firestore, 0);
  const totalRows = results.reduce((a, r) => a + r.pgRows, 0);
  const allOk = results.every((r) => r.ok);
  console.log(`\n── Total: ${totalDocs} docs → ${totalRows} filas — ${allOk ? '✅ 1:1 EXACTO' : '❌ HAY DIFERENCIAS'}`);
  await pool.end();
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error('\n❌ Error:', err);
  process.exit(1);
});
