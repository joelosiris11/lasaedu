/**
 * migrate-files-to-minio.mjs — Copia los archivos del disco del file-server a
 * MinIO, PRESERVANDO los paths (las URLs /files/... siguen resolviendo).
 * Idempotente (sobrescribe). Corre en el VPS (o donde MinIO sea alcanzable).
 *
 * Uso:
 *   SRC_DIR=/var/lasaedu/uploads \
 *   MINIO_ENDPOINT=127.0.0.1 MINIO_PORT=9000 MINIO_ACCESS_KEY=... MINIO_SECRET_KEY=... \
 *   MINIO_BUCKET=lasaacademy \
 *   node scripts/migrate-files-to-minio.mjs
 */
import fs from 'fs';
import path from 'path';
import * as Minio from 'minio';

const SRC = process.env.SRC_DIR;
if (!SRC || !fs.existsSync(SRC)) {
  console.error('❌ Define SRC_DIR con el directorio de uploads del file-server.');
  process.exit(1);
}
const BUCKET = process.env.MINIO_BUCKET || 'lasaacademy';
const minio = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || '127.0.0.1',
  port: Number(process.env.MINIO_PORT || 9000),
  useSSL: String(process.env.MINIO_USE_SSL || 'false') === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
});

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml' };

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(full);
    else yield full;
  }
}

async function main() {
  if (!(await minio.bucketExists(BUCKET).catch(() => false))) await minio.makeBucket(BUCKET);
  let n = 0, bytes = 0;
  for (const file of walk(SRC)) {
    const key = path.relative(SRC, file).split(path.sep).join('/'); // preserva el path
    const stat = fs.statSync(file);
    const ct = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    await minio.fPutObject(BUCKET, key, file, { 'Content-Type': ct });
    n += 1; bytes += stat.size;
    if (n % 50 === 0) console.log(`  ${n} archivos…`);
  }
  console.log(`✅ ${n} archivos → MinIO (${(bytes / 1e6).toFixed(1)} MB), paths preservados.`);
}
main().catch((e) => { console.error('❌', e); process.exit(1); });
