/**
 * import-auth.mjs — Carga los hashes de contraseña de Firebase Auth a Postgres.
 *
 * Entrada: el JSON de `firebase auth:export` (hash scrypt + salt por usuario).
 * Hace UPDATE de users.fb_scrypt_hash / fb_scrypt_salt / email_verified,
 * casando por email (único). Reporta cuántos casaron y cuáles no.
 *
 * Los PARÁMETROS scrypt del proyecto (signerKey, saltSeparator, rounds,
 * memCost) son globales → NO van por usuario; van en el .env del backend:
 *   AUTH_SCRYPT_SIGNER_KEY, AUTH_SCRYPT_SALT_SEPARATOR,
 *   AUTH_SCRYPT_ROUNDS, AUTH_SCRYPT_MEM_COST
 * (se obtienen con la API getConfig de Identity Toolkit; ver README de migración).
 *
 * Uso:
 *   PGHOST=/tmp PGPORT=5433 PGUSER=postgres PGDATABASE=lasaacademy_test \
 *   node scripts/import-auth.mjs /ruta/fb-users.json
 */

import fs from 'fs';
import pg from 'pg';

const exportPath = process.argv[2];
if (!exportPath || !fs.existsSync(exportPath)) {
  console.error('❌ Pasa la ruta del export: node scripts/import-auth.mjs fb-users.json');
  process.exit(1);
}

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

async function main() {
  const { users = [] } = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
  console.log(`🔐 Importando ${users.length} cuentas de Firebase Auth…\n`);

  let matched = 0;
  const unmatched = [];
  for (const u of users) {
    const email = (u.email || '').toLowerCase();
    if (!email) continue;
    // intenta por id (doc == uid) y por email
    const res = await pool.query(
      `UPDATE users
         SET fb_scrypt_hash = $1,
             fb_scrypt_salt = $2,
             email_verified = COALESCE($3, email_verified)
       WHERE id = $4 OR lower(email) = $5`,
      [u.passwordHash || null, u.salt || null, u.emailVerified ?? null, u.localId, email],
    );
    if (res.rowCount > 0) matched += 1;
    else unmatched.push(email);
  }

  console.log(`✅ Casaron: ${matched}/${users.length}`);
  if (unmatched.length) console.log(`⚠️  Sin doc en users: ${unmatched.join(', ')}`);

  const { rows } = await pool.query(
    `SELECT count(*)::int AS con_hash FROM users WHERE fb_scrypt_hash IS NOT NULL`,
  );
  console.log(`Usuarios con hash de contraseña cargado: ${rows[0].con_hash}`);
  await pool.end();
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
