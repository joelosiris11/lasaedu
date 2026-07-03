import express from 'express';
import { q } from '../db/pool.js';
import { renderCertificatePdf } from '../lib/certificatePdf.js';

// Rutas PÚBLICAS (sin login) — para verificación de certificados por QR/URL.
// NO expone la colección completa: sólo devuelve el certificado consultado.
export const publicRouter = express.Router();

// GET /public/verify/:credentialId — verifica un certificado contra la DB.
publicRouter.get('/verify/:credentialId', async (req, res) => {
  const id = String(req.params.credentialId || '').trim();
  if (!id) return res.json({ found: false, valid: false });
  const { rows } = await q(
    `SELECT id, data FROM certificates WHERE credential_id = $1 OR id = $1 LIMIT 1`,
    [id],
  );
  if (!rows[0]) return res.json({ found: false, valid: false });
  const c = rows[0].data || {};
  const revoked = !!c.isRevoked;
  res.json({
    found: true,
    valid: !revoked,
    revoked,
    certificate: {
      credentialId: c.credentialId || id,
      studentName: c.studentName || '',
      courseName: c.courseName || '',
      instructorName: c.instructorName || '',
      completionDate: c.completionDate || null,
      grade: c.grade ?? null,
      hours: c.hours ?? null,
      issuedAt: c.createdAt ?? null,
    },
  });
});

// GET /public/certificate/:credentialId/pdf — descarga el PDF oficial (diseño + QR).
publicRouter.get('/certificate/:credentialId/pdf', async (req, res) => {
  const id = String(req.params.credentialId || '').trim();
  const { rows } = await q(
    `SELECT data FROM certificates WHERE credential_id = $1 OR id = $1 LIMIT 1`,
    [id],
  );
  if (!rows[0]) return res.status(404).json({ error: 'Certificado no encontrado' });
  const c = rows[0].data || {};
  const pdf = await renderCertificatePdf({
    credentialId: c.credentialId || id,
    studentName: c.studentName || '',
    courseName: c.courseName || '',
    completionDate: c.completionDate || null,
    hours: c.hours ?? null,
  });
  const safe = (c.studentName || 'certificado').replace(/[^a-zA-Z0-9]+/g, '_');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="Certificado_${safe}.pdf"`);
  res.send(pdf);
});
