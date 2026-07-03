import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const SECRET = process.env.JWT_SECRET || 'dev-insecure-secret-change-me';
const ACCESS_TTL = process.env.JWT_ACCESS_TTL || '15m';
const REFRESH_TTL_DAYS = Number(process.env.JWT_REFRESH_TTL_DAYS || 30);

export function signAccess(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email, name: user.name },
    SECRET,
    { expiresIn: ACCESS_TTL },
  );
}

export function verifyAccess(token) {
  return jwt.verify(token, SECRET); // throws si inválido/expirado
}

// El refresh token es opaco (aleatorio); guardamos su hash en la tabla.
export function newRefreshToken() {
  const raw = crypto.randomBytes(48).toString('base64url');
  const jti = crypto.randomUUID();
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const expiresAt = Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000;
  return { raw: `${jti}.${raw}`, jti, hash, expiresAt };
}

export function parseRefreshToken(token) {
  const [jti, raw] = String(token || '').split('.');
  if (!jti || !raw) return null;
  return { jti, hash: crypto.createHash('sha256').update(raw).digest('hex') };
}
