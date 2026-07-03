import crypto from 'crypto';

// Verificación del algoritmo scrypt de Firebase Auth. Los parámetros del
// proyecto vienen del .env (getConfig de Identity Toolkit). Permite que los
// usuarios migrados conserven su contraseña sin resetear.
const CFG = {
  signerKey: process.env.AUTH_SCRYPT_SIGNER_KEY || '',
  saltSeparator: process.env.AUTH_SCRYPT_SALT_SEPARATOR || 'Bw==',
  rounds: Number(process.env.AUTH_SCRYPT_ROUNDS || 8),
  memCost: Number(process.env.AUTH_SCRYPT_MEM_COST || 14),
};

export function firebaseScryptVerify(password, saltB64, knownHashB64) {
  if (!CFG.signerKey || !saltB64 || !knownHashB64) return false;
  const salt = Buffer.concat([
    Buffer.from(saltB64, 'base64'),
    Buffer.from(CFG.saltSeparator, 'base64'),
  ]);
  const derivedKey = crypto.scryptSync(Buffer.from(password, 'utf8'), salt, 64, {
    N: 2 ** CFG.memCost,
    r: CFG.rounds,
    p: 1,
    maxmem: 256 * 1024 * 1024,
  });
  const cipher = crypto.createCipheriv('aes-256-ctr', derivedKey.slice(0, 32), Buffer.alloc(16, 0));
  const out = Buffer.concat([
    cipher.update(Buffer.from(CFG.signerKey, 'base64')),
    cipher.final(),
  ]);
  // comparación en tiempo constante
  const a = out.toString('base64');
  return a.length === knownHashB64.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(knownHashB64));
}
