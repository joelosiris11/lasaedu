import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import puppeteer from 'puppeteer-core';

const app = express();
const PORT = process.env.PORT || 3001;
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/uploads';
// Admin-only generated assets (AI images) live here and are served ONLY through
// the gated GET /ai/files route — never through the public /files route.
const AI_PRIVATE_DIR = path.join(UPLOAD_DIR, 'ai-private');
// Generated PDF reports — served through the normal /files route for direct
// download by the admin.
const REPORTS_DIR = path.join(UPLOAD_DIR, 'reports');

// Ensure upload directory exists
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Initialize Firebase Admin (for token verification + admin user ops)
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || '';
let firebaseAuth = null;
let firebaseDb = null;

if (FIREBASE_PROJECT_ID && FIREBASE_PROJECT_ID !== 'demo-project') {
  if (getApps().length === 0) {
    // Use Application Default Credentials or service account
    const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      initializeApp({ credential: cert(serviceAccount), projectId: FIREBASE_PROJECT_ID });
    } else {
      initializeApp({ projectId: FIREBASE_PROJECT_ID });
    }
    firebaseAuth = getAuth();
    try {
      firebaseDb = getFirestore();
    } catch (err) {
      console.warn('Could not initialize Firestore admin:', err?.message || err);
    }
  }
}

// Auth middleware - verify Firebase token
async function authMiddleware(req, res, next) {
  // Skip auth in dev/demo mode
  if (!firebaseAuth) {
    req.userId = 'anonymous';
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No authorization token provided' });
  }

  try {
    const token = authHeader.split('Bearer ')[1];
    const decoded = await firebaseAuth.verifyIdToken(token);
    req.userId = decoded.uid;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// CORS — permissive config to handle preflight + uploads from Vite dev server.
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : true,
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Requested-With', 'Accept'],
  credentials: false,
  maxAge: 86400,
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// JSON body parsing for admin endpoints. Uploads use multipart, which multer
// handles independently.
app.use(express.json({ limit: '1mb' }));

// Log every request to help debug network errors from the browser.
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} (origin: ${req.headers.origin || '-'})`);
  next();
});

// Admin-role middleware: runs after authMiddleware. Loads the user doc from
// Firestore and blocks anyone who is not an admin. Requires firebaseDb to be
// initialized (i.e. real project, not demo-project mode).
async function adminMiddleware(req, res, next) {
  if (!firebaseAuth) {
    // Dev/demo mode — mirror authMiddleware's permissive behavior. Do NOT use
    // this in production; admin endpoints must never be exposed without real
    // Firebase credentials.
    return next();
  }
  if (!firebaseDb) {
    return res.status(500).json({ error: 'Firestore admin not configured' });
  }
  try {
    const snap = await firebaseDb.collection('users').doc(req.userId).get();
    if (!snap.exists) {
      return res.status(403).json({ error: 'User not found' });
    }
    const data = snap.data();
    if (data?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin role required' });
    }
    next();
  } catch (err) {
    console.error('adminMiddleware failed', err);
    return res.status(500).json({ error: 'Failed to verify admin role' });
  }
}

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const subDir = req.params.path || 'general';
    const fullDir = path.join(UPLOAD_DIR, subDir);
    fs.mkdirSync(fullDir, { recursive: true });
    cb(null, fullDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const unique = crypto.randomBytes(6).toString('hex');
    cb(null, `${name}_${Date.now()}_${unique}${ext}`);
  },
});

const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_MB || '500', 10);
const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Upload file
app.post('/upload/:path(*)', authMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file provided' });
  }

  const relativePath = path.relative(UPLOAD_DIR, req.file.path);
  // If BASE_URL is set (prod), return absolute URL. Otherwise (dev), return a
  // relative URL so the Vite proxy resolves it against the current origin.
  const baseUrl = process.env.BASE_URL || '';
  const url = baseUrl ? `${baseUrl}/files/${relativePath}` : `/files/${relativePath}`;

  res.json({
    url,
    filename: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size,
    contentType: req.file.mimetype,
  });
});

// Serve files (with optional auth)
app.get('/files/:path(*)', (req, res) => {
  const filePath = path.join(UPLOAD_DIR, req.params.path);

  // Prevent directory traversal
  if (!filePath.startsWith(UPLOAD_DIR)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.sendFile(filePath);
});

// Delete file
app.delete('/files/:path(*)', authMiddleware, (req, res) => {
  const filePath = path.join(UPLOAD_DIR, req.params.path);

  if (!filePath.startsWith(UPLOAD_DIR)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  fs.unlinkSync(filePath);
  res.json({ success: true });
});

// ── Admin endpoints ──────────────────────────────────────────────────────
// These require the caller to be authenticated AND have role === 'admin' in
// the `users` Firestore collection.

/**
 * POST /admin/reset-password
 * Body: { uid?: string, email?: string, password: string }
 * Resets another user's password instantly via Firebase Admin. Used by the
 * "Resetear credenciales" admin UI so the new password works immediately
 * without sending a reset-email round-trip.
 *
 * Accepts either `uid` (Firebase Auth UID) or `email`. Legacy users have a
 * Firestore doc id that does not match their Auth UID, so the client now also
 * passes the email — we resolve the real Auth UID via `getUserByEmail` before
 * calling `updateUser`, avoiding an `auth/user-not-found` 404.
 */
app.post('/admin/reset-password', authMiddleware, adminMiddleware, async (req, res) => {
  const { uid, email, password } = req.body || {};
  const hasUid = typeof uid === 'string' && uid.trim().length > 0;
  const hasEmail = typeof email === 'string' && email.trim().length > 0;
  if (!hasUid && !hasEmail) {
    return res.status(400).json({ error: 'uid or email is required' });
  }
  if (typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'password must be at least 6 characters' });
  }
  if (!firebaseAuth) {
    return res.status(500).json({ error: 'Firebase Admin not configured' });
  }
  try {
    // Resolve the real Auth UID: try the provided uid first, then fall back
    // to email lookup if the uid doesn't exist in Auth (legacy users).
    let targetUid = hasUid ? uid : null;
    if (targetUid) {
      try {
        await firebaseAuth.getUser(targetUid);
      } catch (err) {
        if (err?.code === 'auth/user-not-found' && hasEmail) {
          targetUid = null;
        } else {
          throw err;
        }
      }
    }
    if (!targetUid && hasEmail) {
      const record = await firebaseAuth.getUserByEmail(email);
      targetUid = record.uid;
    }
    if (!targetUid) {
      return res.status(404).json({ error: 'Usuario no encontrado en Firebase Auth' });
    }
    await firebaseAuth.updateUser(targetUid, { password });
    res.json({ ok: true, method: 'direct', uid: targetUid });
  } catch (err) {
    console.error('reset-password failed', err);
    const code = err?.code || 'unknown';
    if (code === 'auth/user-not-found') {
      return res.status(404).json({ error: 'Usuario no encontrado en Firebase Auth' });
    }
    res.status(500).json({ error: err?.message || 'Error al resetear la contraseña' });
  }
});

/**
 * POST /user/clear-must-change-password
 * Body: (none)
 * Clears the `mustChangePassword` flag on the *caller's* own Firestore user
 * doc, bypassing client-side security rules. Needed because legacy users
 * have a Firestore doc id that does not match their Auth UID, so the rule
 * `request.auth.uid == uid` fails and the client-side update is silently
 * rejected — which is why the "change password" modal kept reappearing on
 * every login. The admin SDK bypasses rules so we can reliably clear the
 * flag right after `changeOwnCredential` updates the Auth password.
 */
app.post('/user/clear-must-change-password', authMiddleware, async (req, res) => {
  if (!firebaseAuth || !firebaseDb) {
    // Dev/demo mode: nothing to clear server-side.
    return res.json({ ok: true, cleared: false, reason: 'admin-not-configured' });
  }
  try {
    const authUser = await firebaseAuth.getUser(req.userId);
    // First try the doc at users/{auth.uid}
    const primaryRef = firebaseDb.collection('users').doc(req.userId);
    const primary = await primaryRef.get();
    if (primary.exists) {
      await primaryRef.update({ mustChangePassword: false, updatedAt: Date.now() });
      return res.json({ ok: true, cleared: true, id: req.userId });
    }
    // Legacy fallback: look up by email.
    if (authUser.email) {
      const snap = await firebaseDb
        .collection('users')
        .where('email', '==', authUser.email)
        .limit(1)
        .get();
      if (!snap.empty) {
        const docRef = snap.docs[0].ref;
        await docRef.update({ mustChangePassword: false, updatedAt: Date.now() });
        return res.json({ ok: true, cleared: true, id: docRef.id });
      }
    }
    res.json({ ok: true, cleared: false, reason: 'user-doc-not-found' });
  } catch (err) {
    console.error('clear-must-change-password failed', err);
    res.status(500).json({ error: err?.message || 'Error al actualizar el estado del usuario' });
  }
});

/**
 * POST /ai/chat
 * Body: { model: string, messages: [...], tools?: [...] }
 *
 * Server-side proxy for Ollama Cloud's /api/chat. The browser cannot call
 * https://ollama.com directly because it doesn't set CORS headers. This
 * endpoint forwards the request, adds the Bearer key from server env, and
 * streams the NDJSON response straight back to the client.
 *
 * Admin-only — the AI assistant is exposed in the UI to admins only and the
 * key burns real credits, so we gate at the auth layer too.
 */
app.post('/ai/chat', authMiddleware, adminMiddleware, async (req, res) => {
  const apiKey = process.env.OLLAMA_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OLLAMA_API_KEY not configured on the server' });
  }
  const baseUrl = process.env.OLLAMA_BASE_URL || 'https://ollama.com';
  const { model, messages, tools } = req.body || {};
  if (!model || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'model and messages[] are required' });
  }

  let upstream;
  try {
    upstream = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, tools, stream: true }),
    });
  } catch (err) {
    console.error('ollama upstream fetch failed', err);
    return res.status(502).json({ error: 'Ollama upstream unreachable' });
  }

  if (!upstream.ok || !upstream.body) {
    const body = await upstream.text().catch(() => '');
    return res
      .status(upstream.status || 502)
      .json({ error: `Ollama error ${upstream.status}: ${body || upstream.statusText}` });
  }

  res.status(200);
  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no'); // disable proxy buffering (nginx, etc.)
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  const reader = upstream.body.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) res.write(Buffer.from(value));
    }
    res.end();
  } catch (err) {
    console.error('ollama stream relay failed', err);
    if (!res.writableEnded) res.end();
  }
});

// ── AI assets: image generation (Gemini) + PDF reports (Puppeteer) ─────────
// The chat engine stays on Kimi/Ollama (/ai/chat above). Gemini is used ONLY
// to generate images; PDFs are rendered by Puppeteer from HTML composed by the
// chat model. All three endpoints are admin-only.

// Random, non-guessable filename (mirrors the multer storage naming).
function aiAssetName(prefix, ext) {
  const unique = crypto.randomBytes(6).toString('hex');
  return `${prefix}_${Date.now()}_${unique}${ext}`;
}

/**
 * POST /ai/image
 * Body: { prompt: string, aspectRatio?: string }
 *
 * Generates an image with Gemini (gemini-3-pro-image / "Nano Banana Pro"),
 * stores it in the admin-only ai-private dir, and returns a gated URL. The
 * Gemini API key never reaches the browser.
 */
app.post('/ai/image', authMiddleware, adminMiddleware, async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured on the server' });
  }
  const { prompt, aspectRatio, scope } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'prompt (string) is required' });
  }
  // scope 'course' → PUBLIC image (served by /files), embeddable in lessons
  // that students see. Anything else → PRIVATE (admin-only /ai/files).
  const isPublic = scope === 'course';
  const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image';
  const generationConfig = {
    responseModalities: ['TEXT', 'IMAGE'],
    ...(aspectRatio ? { imageConfig: { aspectRatio: String(aspectRatio), imageSize: '2K' } } : {}),
  };

  let upstream;
  try {
    upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig }),
      },
    );
  } catch (err) {
    console.error('gemini image upstream fetch failed', err);
    return res.status(502).json({ error: 'Gemini upstream unreachable' });
  }

  if (!upstream.ok) {
    const body = await upstream.text().catch(() => '');
    return res
      .status(upstream.status || 502)
      .json({ error: `Gemini error ${upstream.status}: ${body || upstream.statusText}` });
  }

  let json;
  try {
    json = await upstream.json();
  } catch {
    return res.status(502).json({ error: 'Gemini returned a non-JSON response' });
  }

  const parts = json?.candidates?.[0]?.content?.parts || [];
  const imgPart = parts.find((p) => p?.inlineData?.data);
  if (!imgPart) {
    const note = parts.find((p) => p?.text)?.text;
    return res
      .status(502)
      .json({ error: `Gemini no devolvió imagen${note ? `: ${note}` : ''}` });
  }

  const mime = imgPart.inlineData.mimeType || 'image/png';
  const ext = mime.includes('jpeg') || mime.includes('jpg') ? '.jpg' : '.png';
  const filename = aiAssetName('img', ext);

  if (isPublic) {
    // Public course image — served by /files so students can see it in lessons.
    const dir = path.join(UPLOAD_DIR, 'ai-generated', 'images');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, filename), Buffer.from(imgPart.inlineData.data, 'base64'));
    const baseUrl = process.env.BASE_URL || '';
    const rel = `/files/ai-generated/images/${filename}`;
    return res.json({ url: baseUrl ? `${baseUrl}${rel}` : rel, prompt, mimeType: mime, scope: 'course' });
  }

  // Private admin image — only the admin can read it (gated /ai/files).
  const dir = path.join(AI_PRIVATE_DIR, 'images');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), Buffer.from(imgPart.inlineData.data, 'base64'));
  res.json({ url: `/ai/files/images/${filename}`, prompt, mimeType: mime, scope: 'private' });
});

/**
 * GET /ai/files/:path(*)
 * Admin-only serving of generated assets (AI images). Mirrors the /files
 * traversal guard but is gated so students can never read these.
 */
app.get('/ai/files/:path(*)', authMiddleware, adminMiddleware, (req, res) => {
  const filePath = path.join(AI_PRIVATE_DIR, req.params.path);
  if (!filePath.startsWith(AI_PRIVATE_DIR)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  res.sendFile(filePath);
});

// Puppeteer browser singleton — launching Chromium per request is expensive.
let browserPromise = null;
async function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer
      .launch({
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      })
      .catch((err) => {
        browserPromise = null; // allow retry on next request
        throw err;
      });
  }
  return browserPromise;
}

const ASSET_MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

// Rewrites <img src="/files/..."> and "/ai/files/..." URLs to base64 data URIs
// so Puppeteer embeds admin-only images without an auth header. Data URIs are
// used (not file://) because page.setContent runs from an about:blank origin,
// which Chrome blocks from loading file:// resources.
function inlineLocalAssets(html) {
  return String(html).replace(
    /(src\s*=\s*["'])(\/(?:ai\/files|files)\/[^"']+)(["'])/gi,
    (match, pre, url, post) => {
      const rel = url.startsWith('/ai/files/')
        ? path.join(AI_PRIVATE_DIR, url.slice('/ai/files/'.length))
        : path.join(UPLOAD_DIR, url.slice('/files/'.length));
      const base = url.startsWith('/ai/files/') ? AI_PRIVATE_DIR : UPLOAD_DIR;
      if (!rel.startsWith(base) || !fs.existsSync(rel)) return match; // leave untouched
      const mime = ASSET_MIME[path.extname(rel).toLowerCase()] || 'application/octet-stream';
      const b64 = fs.readFileSync(rel).toString('base64');
      return `${pre}data:${mime};base64,${b64}${post}`;
    },
  );
}

/**
 * POST /ai/pdf
 * Body: { title: string, html: string }
 *
 * Renders an HTML report (composed by the chat model from db_* tool data) to a
 * PDF with Puppeteer, stores it, and returns a download URL.
 */
app.post('/ai/pdf', authMiddleware, adminMiddleware, async (req, res) => {
  const { title, html } = req.body || {};
  if (!html || typeof html !== 'string') {
    return res.status(400).json({ error: 'html (string) is required' });
  }
  const safeTitle = (title && String(title)) || 'Reporte';

  let page;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    const doc = `<!doctype html><html><head><meta charset="utf-8"><title>${safeTitle}</title></head><body>${inlineLocalAssets(html)}</body></html>`;
    await page.setContent(doc, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
    });
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
    const filename = aiAssetName('report', '.pdf');
    fs.writeFileSync(path.join(REPORTS_DIR, filename), pdf);
    const baseUrl = process.env.BASE_URL || '';
    const url = baseUrl ? `${baseUrl}/files/reports/${filename}` : `/files/reports/${filename}`;
    res.json({ url, title: safeTitle, filename });
  } catch (err) {
    console.error('pdf render failed', err);
    res.status(500).json({ error: `No se pudo generar el PDF: ${err?.message || err}` });
  } finally {
    if (page) await page.close().catch(() => {});
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`📁 File server running on port ${PORT}`);
  console.log(`   Upload dir: ${UPLOAD_DIR}`);
  console.log(`   Auth: ${firebaseAuth ? 'Firebase token verification' : 'disabled (dev mode)'}`);
  console.log(`   Firestore admin: ${firebaseDb ? 'ready' : 'not configured'}`);
});
