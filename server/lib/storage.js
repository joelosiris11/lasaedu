import * as Minio from 'minio';

// Cliente MinIO (S3-compatible). Reemplaza el almacenamiento en disco.
// Config por env: MINIO_ENDPOINT/PORT/USE_SSL/ACCESS_KEY/SECRET_KEY/BUCKET.
const BUCKET = process.env.MINIO_BUCKET || 'lasaacademy';

export const minio = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || '127.0.0.1',
  port: Number(process.env.MINIO_PORT || 9000),
  useSSL: String(process.env.MINIO_USE_SSL || 'false') === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
});

export const bucket = BUCKET;

export async function ensureBucket() {
  const exists = await minio.bucketExists(BUCKET).catch(() => false);
  if (!exists) await minio.makeBucket(BUCKET);
}

export async function putObject(key, data, contentType) {
  // Coacciona a Buffer (page.pdf() devuelve Uint8Array; MinIO exige Buffer/stream/string).
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  await minio.putObject(BUCKET, key, buffer, buffer.length, {
    'Content-Type': contentType || 'application/octet-stream',
  });
  return key;
}

export const statObject = (key) => minio.statObject(BUCKET, key);
export const getObjectStream = (key) => minio.getObject(BUCKET, key);

export async function getObjectBuffer(key) {
  const stream = await minio.getObject(BUCKET, key);
  const chunks = [];
  for await (const c of stream) chunks.push(c);
  return Buffer.concat(chunks);
}
export const getPartialStream = (key, offset, length) =>
  minio.getPartialObject(BUCKET, key, offset, length);
export const removeObject = (key) => minio.removeObject(BUCKET, key);
