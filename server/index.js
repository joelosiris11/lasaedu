import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const app = express();
const PORT = process.env.PORT || 3001;
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/uploads';

// Ensure upload directory exists
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Initialize Firebase Admin (for token verification)
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || '';
let firebaseAuth = null;

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

// Log every request to help debug network errors from the browser.
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} (origin: ${req.headers.origin || '-'})`);
  next();
});

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

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`📁 File server running on port ${PORT}`);
  console.log(`   Upload dir: ${UPLOAD_DIR}`);
  console.log(`   Auth: ${firebaseAuth ? 'Firebase token verification' : 'disabled (dev mode)'}`);
});
