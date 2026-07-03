import express from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import { putObject, statObject, getObjectStream, getPartialStream } from '../lib/storage.js';
import { requireAuth, isAdmin } from '../lib/authz.js';

export const filesRouter = express.Router();

const MAX_MB = Number(process.env.MAX_UPLOAD_MB || 500);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_MB * 1024 * 1024 } });

function safeName(original) {
  const ext = path.extname(original);
  const base = path.basename(original, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${base}_${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`;
}

// POST /upload/:path(*) — sube a MinIO. requiere sesión.
filesRouter.post('/upload/:path(*)', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });
  const subDir = (req.params.path || 'general').replace(/\.\./g, '');
  const key = `${subDir}/${safeName(req.file.originalname)}`;
  await putObject(key, req.file.buffer, req.file.mimetype);
  const baseUrl = process.env.BASE_URL || '';
  const url = baseUrl ? `${baseUrl}/files/${key}` : `/files/${key}`;
  res.json({ url, filename: key.split('/').pop(), key, size: req.file.size, contentType: req.file.mimetype });
});

// Sirve un objeto desde MinIO con soporte de HTTP Range (video seeking).
async function serveObject(key, req, res) {
  let stat;
  try {
    stat = await statObject(key);
  } catch {
    return res.status(404).json({ error: 'File not found' });
  }
  const total = stat.size;
  const contentType = stat.metaData?.['content-type'] || 'application/octet-stream';
  const range = req.headers.range;

  if (range) {
    const m = /bytes=(\d+)-(\d*)/.exec(range);
    const start = m ? parseInt(m[1], 10) : 0;
    const end = m && m[2] ? parseInt(m[2], 10) : total - 1;
    const length = end - start + 1;
    res.status(206);
    res.set({
      'Content-Range': `bytes ${start}-${end}/${total}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': length,
      'Content-Type': contentType,
    });
    const stream = await getPartialStream(key, start, length);
    stream.pipe(res);
  } else {
    res.set({ 'Content-Length': total, 'Content-Type': contentType, 'Accept-Ranges': 'bytes' });
    const stream = await getObjectStream(key);
    stream.pipe(res);
  }
}

// GET /files/:path(*) — público (contenido de cursos visible a estudiantes).
filesRouter.get('/files/:path(*)', (req, res) => serveObject(req.params.path, req, res));

// GET /ai/files/:path(*) — solo admin (imágenes IA privadas).
filesRouter.get('/ai/files/:path(*)', requireAuth, (req, res) => {
  if (!isAdmin(req.user)) return res.status(403).json({ error: 'Admin requerido' });
  return serveObject(`ai-private/${req.params.path}`, req, res);
});
