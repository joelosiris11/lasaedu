import pg from 'pg';

// Pool de Postgres. Configura por DATABASE_URL o variables PG*.
export const pool = new pg.Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.PGHOST || '/tmp',
        port: Number(process.env.PGPORT || 5432),
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || undefined,
        database: process.env.PGDATABASE || 'lasaacademy',
      },
);

// CRÍTICO: node-postgres tumba el proceso si un cliente idle emite 'error'
// (ej. Postgres reinicia, o se cae la conexión) y no hay handler. Esto lo evita.
pool.on('error', (err) => {
  console.error('[pg pool] error en cliente idle (no fatal):', err.message);
});

export const q = (text, params) => pool.query(text, params);
