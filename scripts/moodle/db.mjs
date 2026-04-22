// MariaDB/MySQL connection for the Moodle import.
//
// Connection charset is forced to `latin1`. The dump declares utf8mb4 but the
// bytes on disk are Latin1 sequences — see scripts/moodle/encoding.mjs.
// Reading them as latin1 keeps each byte as one code unit so fixMojibake()
// can reassemble the correct UTF-8 string.

import mysql from 'mysql2/promise';
import { fixMojibakeDeep } from './encoding.mjs';

const DEFAULT_PREFIX = 'mdlsv_';

export function getMoodleConfig() {
  return {
    host: process.env.MOODLE_DB_HOST || '127.0.0.1',
    port: Number(process.env.MOODLE_DB_PORT || 3307),
    user: process.env.MOODLE_DB_USER || 'root',
    password: process.env.MOODLE_DB_PASS || 'moodle',
    database: process.env.MOODLE_DB_NAME || 'moodle',
    prefix: process.env.MOODLE_TABLE_PREFIX || DEFAULT_PREFIX,
  };
}

export async function connectMoodle() {
  const cfg = getMoodleConfig();
  const connection = await mysql.createConnection({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    charset: 'latin1',
    dateStrings: true,
    multipleStatements: false,
  });
  return { connection, prefix: cfg.prefix };
}

// Run a query against a Moodle table, auto-prefixing `{table}` tokens and
// fixing mojibake on every string in the result.
//
//   const rows = await query(conn, prefix, 'SELECT * FROM {course} WHERE id > 1');
export async function query(conn, prefix, sql, params = []) {
  const resolved = sql.replace(/\{([a-z_][a-z0-9_]*)\}/gi, (_, name) => `\`${prefix}${name}\``);
  const [rows] = await conn.execute(resolved, params);
  return fixMojibakeDeep(rows);
}

// Resolves an instructor from Firebase Auth; mirrors the helper in
// scripts/seed-python-course.mjs so imported courses list a real teacher.
export async function resolveInstructor(auth, email) {
  const target = email || 'a.rosario@t-ecogroup.net';
  try {
    const u = await auth.getUserByEmail(target);
    return {
      id: u.uid,
      name: u.displayName || target.split('@')[0],
      email: target,
    };
  } catch (err) {
    console.warn(`⚠ Could not look up instructor ${target}: ${err?.message ?? err}`);
    console.warn('  Falling back to placeholder instructor — update the course in the UI later.');
    return { id: 'instructor_unknown', name: 'Instructor LasaEdu', email: target };
  }
}
