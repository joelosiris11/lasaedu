import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { q } from '../db/pool.js';
import { firebaseScryptVerify } from '../lib/scrypt.js';
import { signAccess, newRefreshToken, parseRefreshToken } from '../lib/jwt.js';
import { requireAuth, isAdmin } from '../lib/authz.js';
import { sendMail, smtpConfigured } from '../lib/mailer.js';
import crypto2 from 'crypto';

export const authRouter = express.Router();

const publicUser = (row) => ({
  id: row.id,
  email: row.email,
  name: row.name,
  role: row.role,
  status: row.status,
  emailVerified: row.email_verified,
  ...row.data, // perfil/preferencias completos (sin secretos: la fila no incluye hashes)
});

async function issueRefresh(userId) {
  const t = newRefreshToken();
  await q(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
     VALUES ($1,$2,$3,$4,$5)`,
    [t.jti, userId, t.hash, t.expiresAt, Date.now()],
  );
  return t.raw;
}

// POST /auth/login { email, password }
authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email y password requeridos' });

  const { rows } = await q(
    `SELECT id, email, name, role, status, email_verified, data,
            password_hash, fb_scrypt_hash, fb_scrypt_salt
       FROM users WHERE lower(email) = lower($1) LIMIT 1`,
    [email],
  );
  const u = rows[0];
  if (!u) return res.status(401).json({ error: 'Credenciales inválidas' });

  let ok = false;
  if (u.password_hash) {
    ok = await bcrypt.compare(password, u.password_hash);
  } else if (u.fb_scrypt_hash) {
    ok = firebaseScryptVerify(password, u.fb_scrypt_salt, u.fb_scrypt_hash);
    // migración perezosa: al validar con scrypt, re-hashea a bcrypt
    if (ok) {
      const bh = await bcrypt.hash(password, 10);
      await q(`UPDATE users SET password_hash = $1 WHERE id = $2`, [bh, u.id]);
    }
  }
  if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });

  await q(`UPDATE users SET data = jsonb_set(data, '{lastActive}', to_jsonb($1::bigint)) WHERE id = $2`, [Date.now(), u.id]);

  const accessToken = signAccess(u);
  const refreshToken = await issueRefresh(u.id);
  res.json({ user: publicUser(u), accessToken, refreshToken });
});

// POST /auth/refresh { refreshToken }
authRouter.post('/refresh', async (req, res) => {
  const parsed = parseRefreshToken(req.body?.refreshToken);
  if (!parsed) return res.status(400).json({ error: 'refreshToken inválido' });
  const { rows } = await q(
    `SELECT rt.user_id, rt.expires_at, rt.revoked_at, u.id, u.email, u.name, u.role
       FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id
      WHERE rt.id = $1 AND rt.token_hash = $2 LIMIT 1`,
    [parsed.jti, parsed.hash],
  );
  const r = rows[0];
  if (!r || r.revoked_at || r.expires_at < Date.now()) {
    return res.status(401).json({ error: 'refresh inválido o expirado' });
  }
  res.json({ accessToken: signAccess(r) });
});

// POST /auth/logout { refreshToken }
authRouter.post('/logout', async (req, res) => {
  const parsed = parseRefreshToken(req.body?.refreshToken);
  if (parsed) await q(`UPDATE refresh_tokens SET revoked_at = $1 WHERE id = $2`, [Date.now(), parsed.jti]);
  res.json({ ok: true });
});

// POST /auth/admin/create-user { email, name, role, password } — solo admin
authRouter.post('/admin/create-user', requireAuth, async (req, res) => {
  if (!isAdmin(req.user)) return res.status(403).json({ error: 'Admin requerido' });
  const { email, name, role = 'student', password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email y password requeridos' });
  const exists = await q(`SELECT 1 FROM users WHERE lower(email) = lower($1)`, [email]);
  if (exists.rows[0]) return res.status(409).json({ error: 'El email ya existe' });

  const id = crypto2.randomUUID();
  const now = Date.now();
  const password_hash = await bcrypt.hash(password, 10);
  const data = {
    id, email, name: name || email.split('@')[0], role, emailVerified: false,
    loginAttempts: 0, mustChangePassword: false, profile: {}, preferences: {},
    createdAt: now, updatedAt: now, lastActive: now,
  };
  await q(
    `INSERT INTO users (id, email, name, role, email_verified, password_hash, created_at, updated_at, data)
     VALUES ($1,$2,$3,$4,false,$5,$6,$6,$7)`,
    [id, email, data.name, role, password_hash, now, JSON.stringify(data)],
  );
  res.status(201).json({ user: publicUser({ ...data, email_verified: false }) });
});

// POST /auth/admin/reset-password { userId?, email?, newPassword } — solo admin
// Cambia la clave de OTRO usuario al instante y lo marca para cambiarla al entrar.
authRouter.post('/admin/reset-password', requireAuth, async (req, res) => {
  if (!isAdmin(req.user)) return res.status(403).json({ error: 'Admin requerido' });
  const { userId, email, newPassword } = req.body || {};
  if (!newPassword || String(newPassword).length < 4) return res.status(400).json({ error: 'Contraseña muy corta' });
  const sel = userId
    ? await q(`SELECT id FROM users WHERE id = $1`, [userId])
    : await q(`SELECT id FROM users WHERE lower(email) = lower($1)`, [email || '']);
  if (!sel.rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
  const hash = await bcrypt.hash(newPassword, 10);
  await q(
    `UPDATE users
        SET password_hash = $1, fb_scrypt_hash = NULL, fb_scrypt_salt = NULL,
            data = jsonb_set(data, '{mustChangePassword}', 'true')
      WHERE id = $2`,
    [hash, sel.rows[0].id],
  );
  res.json({ ok: true, method: 'direct' });
});

// POST /auth/change-password { newPassword } — el propio usuario
authRouter.post('/change-password', requireAuth, async (req, res) => {
  const { newPassword } = req.body || {};
  if (!newPassword || String(newPassword).length < 4) {
    return res.status(400).json({ error: 'Contraseña muy corta' });
  }
  const hash = await bcrypt.hash(newPassword, 10);
  await q(
    `UPDATE users
        SET password_hash = $1, fb_scrypt_hash = NULL, fb_scrypt_salt = NULL,
            data = jsonb_set(data, '{mustChangePassword}', 'false')
      WHERE id = $2`,
    [hash, req.user.id],
  );
  res.json({ ok: true });
});

// POST /auth/reset { email } — solicita reset (envía correo o, en dev, devuelve token)
authRouter.post('/reset', async (req, res) => {
  const email = (req.body?.email || '').toLowerCase();
  const { rows } = await q(`SELECT id, email FROM users WHERE lower(email) = $1`, [email]);
  const u = rows[0];
  // No revelar si el email existe.
  if (u) {
    const jti = crypto2.randomUUID();
    const raw = crypto2.randomBytes(32).toString('base64url');
    const tokenHash = crypto2.createHash('sha256').update(raw).digest('hex');
    const expiresAt = Date.now() + 60 * 60 * 1000; // 1h
    await q(
      `INSERT INTO password_resets (id, user_id, token_hash, expires_at, created_at) VALUES ($1,$2,$3,$4,$5)`,
      [jti, u.id, tokenHash, expiresAt, Date.now()],
    );
    const token = `${jti}.${raw}`;
    const link = `${process.env.FRONTEND_URL || 'https://lasaacademy.cloudteco.com'}/reset?token=${token}`;
    const sent = await sendMail({
      to: u.email,
      subject: 'Restablecer tu contraseña — LasaEdu',
      html: `<p>Para restablecer tu contraseña haz clic: <a href="${link}">${link}</a></p><p>Expira en 1 hora.</p>`,
    }).catch(() => false);
    // En dev (sin SMTP) devolvemos el token para poder probar el flujo.
    return res.json({ ok: true, ...(smtpConfigured ? {} : { devToken: token, devLink: link }) });
  }
  res.json({ ok: true });
});

// POST /auth/reset/confirm { token, newPassword }
authRouter.post('/reset/confirm', async (req, res) => {
  const { token, newPassword } = req.body || {};
  const [jti, raw] = String(token || '').split('.');
  if (!jti || !raw || !newPassword) return res.status(400).json({ error: 'token y newPassword requeridos' });
  const tokenHash = crypto2.createHash('sha256').update(raw).digest('hex');
  const { rows } = await q(
    `SELECT user_id, expires_at, used_at FROM password_resets WHERE id = $1 AND token_hash = $2`,
    [jti, tokenHash],
  );
  const r = rows[0];
  if (!r || r.used_at || r.expires_at < Date.now()) return res.status(400).json({ error: 'Token inválido o expirado' });
  const hash = await bcrypt.hash(newPassword, 10);
  await q(`UPDATE users SET password_hash = $1, fb_scrypt_hash = NULL, fb_scrypt_salt = NULL WHERE id = $2`, [hash, r.user_id]);
  await q(`UPDATE password_resets SET used_at = $1 WHERE id = $2`, [Date.now(), jti]);
  res.json({ ok: true });
});

// GET /auth/me
authRouter.get('/me', requireAuth, async (req, res) => {
  const { rows } = await q(
    `SELECT id, email, name, role, status, email_verified, data FROM users WHERE id = $1`,
    [req.user.id],
  );
  if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json({ user: publicUser(rows[0]) });
});
