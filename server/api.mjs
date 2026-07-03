/**
 * api.mjs — Backend self-host de LasaEdu (Postgres + JWT).
 * Reemplaza el acceso directo del frontend a Firestore/Firebase Auth.
 * Rutas: /health, /auth/*, /api/* (datos). Files e IA se montan en fases siguientes.
 */
import 'dotenv/config';
import 'express-async-errors'; // rutas async que lanzan → van al error handler (no cuelgan)
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { authRouter } from './routes/auth.js';
import { dataRouter } from './routes/data.js';
import { filesRouter } from './routes/files.js';
import { aiRouter } from './routes/ai.js';
import { bridgeRouter } from './routes/bridge.js';
import { publicRouter } from './routes/public.js';
import { pool } from './db/pool.js';
import { ensureBucket } from './lib/storage.js';

const app = express();
const PORT = process.env.API_PORT || 3020;

app.use(cors({ origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : true }));
app.use(express.json({ limit: '5mb' }));

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'up', ts: Date.now() });
  } catch (e) {
    res.status(500).json({ status: 'error', db: 'down', error: e.message });
  }
});

app.use('/auth', authRouter);
app.use('/api', dataRouter);
app.use('/', filesRouter); // /upload, /files, /ai/files
app.use('/ai', aiRouter); // /ai/chat, /ai/image, /ai/pdf
app.use('/bridge', bridgeRouter); // consulta read-only para Zeus (token de servicio)
app.use('/public', publicRouter); // verificación pública de certificados (sin login)

// ── Frontend estático (SPA) + fallback ──────────────────────────────────────
// Sirve el build de Vite (dist/) copiado a ./public. Todo el resto de rutas GET
// que no sean de la API cae a index.html (routing del SPA en el cliente).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = process.env.FRONTEND_DIST || path.join(__dirname, 'public');
app.use(express.static(DIST));
app.get(/^(?!\/(?:api|auth|files|ai|upload|health|bridge|public)\b).*/, (_req, res) => {
  res.sendFile(path.join(DIST, 'index.html'));
});

// Crea el bucket si MinIO está disponible (no fatal si no).
ensureBucket()
  .then(() => console.log('🪣 MinIO bucket listo'))
  .catch((e) => console.warn('⚠️ MinIO no disponible:', e.message));

// manejo de errores async
app.use((err, _req, res, _next) => {
  console.error('API error:', err);
  res.status(500).json({ error: err.message || 'Error interno' });
});

// Guards a nivel de proceso: un error suelto (fuera de una ruta) NO debe tumbar
// todo el backend. Se registra y el servidor sigue vivo (pm2 queda de respaldo).
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection] (no fatal):', reason instanceof Error ? reason.stack : reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException] (no fatal):', err?.stack || err);
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 API Lasa Academy en :${PORT}`));
