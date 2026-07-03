import express from 'express';
import crypto from 'crypto';
import path from 'path';
import { requireAuth, isAdmin } from '../lib/authz.js';
import { putObject, getObjectBuffer } from '../lib/storage.js';
import { getBrowser } from '../lib/browser.js';

export const aiRouter = express.Router();

// Todos los endpoints de IA son admin-only (igual que antes, ahora por JWT).
const adminOnly = [requireAuth, (req, res, next) => (isAdmin(req.user) ? next() : res.status(403).json({ error: 'Admin requerido' }))];

const assetName = (prefix, ext) => `${prefix}_${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`;

// ── /ai/chat — proxy NDJSON a Ollama Cloud (Kimi) ───────────────────────────
aiRouter.post('/chat', adminOnly, async (req, res) => {
  const apiKey = process.env.OLLAMA_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OLLAMA_API_KEY no configurada' });
  const baseUrl = process.env.OLLAMA_BASE_URL || 'https://ollama.com';
  const { model, messages, tools } = req.body || {};
  if (!model || !Array.isArray(messages)) return res.status(400).json({ error: 'model y messages[] requeridos' });

  let upstream;
  try {
    upstream = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, tools, stream: true }),
    });
  } catch {
    return res.status(502).json({ error: 'Ollama inalcanzable' });
  }
  if (!upstream.ok || !upstream.body) {
    return res.status(upstream.status || 502).json({ error: `Ollama error ${upstream.status}` });
  }
  res.status(200).setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  const reader = upstream.body.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) res.write(Buffer.from(value));
    }
    res.end();
  } catch {
    if (!res.writableEnded) res.end();
  }
});

// ── /ai/image — Gemini → MinIO (course=público / private=admin) ─────────────
aiRouter.post('/image', adminOnly, async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY no configurada' });
  const { prompt, aspectRatio, scope } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'prompt requerido' });
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
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig }) },
    );
  } catch {
    return res.status(502).json({ error: 'Gemini inalcanzable' });
  }
  if (!upstream.ok) return res.status(upstream.status || 502).json({ error: `Gemini error ${upstream.status}: ${await upstream.text().catch(() => '')}` });

  const json = await upstream.json();
  const parts = json?.candidates?.[0]?.content?.parts || [];
  const imgPart = parts.find((p) => p?.inlineData?.data);
  if (!imgPart) return res.status(502).json({ error: 'Gemini no devolvió imagen' });

  const mime = imgPart.inlineData.mimeType || 'image/png';
  const ext = mime.includes('jpeg') || mime.includes('jpg') ? '.jpg' : '.png';
  const buf = Buffer.from(imgPart.inlineData.data, 'base64');
  const filename = assetName('img', ext);

  if (isPublic) {
    const key = `ai-generated/images/${filename}`;
    await putObject(key, buf, mime);
    const baseUrl = process.env.BASE_URL || '';
    return res.json({ url: baseUrl ? `${baseUrl}/files/${key}` : `/files/${key}`, prompt, mimeType: mime, scope: 'course' });
  }
  const key = `ai-private/images/${filename}`;
  await putObject(key, buf, mime);
  res.json({ url: `/ai/files/images/${filename}`, prompt, mimeType: mime, scope: 'private' });
});

// ── /ai/pdf — Puppeteer → MinIO ─────────────────────────────────────────────
const ASSET_MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' };

// Reescribe <img src="/files|/ai/files/..."> a data URIs leyendo de MinIO.
async function inlineAssets(html) {
  const re = /(src\s*=\s*["'])(\/(?:ai\/files|files)\/[^"']+)(["'])/gi;
  const matches = [...String(html).matchAll(re)];
  let out = String(html);
  for (const m of matches) {
    const url = m[2];
    const key = url.startsWith('/ai/files/') ? `ai-private/${url.slice('/ai/files/'.length)}` : url.slice('/files/'.length);
    try {
      const buf = await getObjectBuffer(key);
      const mime = ASSET_MIME[path.extname(key).toLowerCase()] || 'application/octet-stream';
      out = out.replace(m[0], `${m[1]}data:${mime};base64,${buf.toString('base64')}${m[3]}`);
    } catch { /* deja la URL si no se encuentra */ }
  }
  return out;
}

aiRouter.post('/pdf', adminOnly, async (req, res) => {
  const { title, html } = req.body || {};
  if (!html) return res.status(400).json({ error: 'html requerido' });
  const safeTitle = (title && String(title)) || 'Reporte';
  let page;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    const doc = `<!doctype html><html><head><meta charset="utf-8"><title>${safeTitle}</title></head><body>${await inlineAssets(html)}</body></html>`;
    await page.setContent(doc, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' } });
    const key = `reports/${assetName('report', '.pdf')}`;
    await putObject(key, pdf, 'application/pdf');
    const baseUrl = process.env.BASE_URL || '';
    res.json({ url: baseUrl ? `${baseUrl}/files/${key}` : `/files/${key}`, title: safeTitle });
  } catch (err) {
    res.status(500).json({ error: `No se pudo generar el PDF: ${err.message}` });
  } finally {
    if (page) await page.close().catch(() => {});
  }
});
