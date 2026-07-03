/**
 * inventory-firestore.mjs — Inventario 1:1 de la base VIVA (Firestore + RTDB).
 *
 * READ-ONLY. No escribe nada en Firebase. Produce el "manifiesto" que define
 * el esquema PostgreSQL de la migración: TODA colección real (no la del código),
 * conteos, y la UNIÓN de todos los campos con sus tipos por colección, además
 * del árbol de Realtime Database.
 *
 * Uso:
 *   GOOGLE_APPLICATION_CREDENTIALS=/ruta/lasaedurd-sa.json \
 *   FIREBASE_PROJECT_ID=lasaedurd \
 *   FIREBASE_DATABASE_URL=https://lasaedurd-default-rtdb.firebaseio.com \
 *   node scripts/inventory-firestore.mjs
 *
 * Salida:
 *   scripts/inventory-output/manifest.json   (máquina → dirige el esquema)
 *   scripts/inventory-output/manifest.md     (humano → para que lo apruebes)
 *
 * Notas:
 * - Escanea TODOS los documentos de cada colección para la unión de campos
 *   (no muestrea), así no se escapa ningún campo raro. Solo lee nombres+tipos,
 *   no acumula los datos → liviano en memoria.
 * - Subcolecciones: detectadas por doc (listCollections por documento). Puede
 *   ser lento en colecciones enormes; se puede limitar con SUBCOL_SCAN_LIMIT.
 */

import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Timestamp, GeoPoint, DocumentReference } from 'firebase-admin/firestore';
import { getDatabase } from 'firebase-admin/database';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, 'inventory-output');

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'lasaedurd';
const DATABASE_URL =
  process.env.FIREBASE_DATABASE_URL ||
  `https://${PROJECT_ID}-default-rtdb.firebaseio.com`;
// 0 = sin límite (escanea subcolecciones en cada doc). Pon un número para acotar.
const SUBCOL_SCAN_LIMIT = Number(process.env.SUBCOL_SCAN_LIMIT || 0);

// ── init admin ────────────────────────────────────────────────────────────
// Usa el service-account si está disponible; si no, cae a Application Default
// Credentials (gcloud ADC) — útil cuando la cuenta gcloud tiene acceso al proyecto.
const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const hasSA = saPath && fs.existsSync(saPath);
console.log(`🔑 Credencial: ${hasSA ? `service-account (${saPath})` : 'Application Default Credentials (gcloud)'}`);
initializeApp({
  credential: hasSA ? cert(JSON.parse(fs.readFileSync(saPath, 'utf8'))) : applicationDefault(),
  projectId: PROJECT_ID,
  databaseURL: DATABASE_URL,
});
const db = getFirestore();

// ── inferencia de tipos de un valor Firestore ──────────────────────────────
function typeOfValue(v) {
  if (v === null || v === undefined) return 'null';
  if (v instanceof Timestamp) return 'timestamp';
  if (v instanceof GeoPoint) return 'geopoint';
  if (v instanceof DocumentReference) return 'reference';
  if (Buffer.isBuffer(v)) return 'bytes';
  if (Array.isArray(v)) return 'array';
  const t = typeof v;
  if (t === 'object') return 'map';
  return t; // string | number | boolean
}

// Acumula, por colección, la unión de campos de nivel raíz: tipos vistos +
// cuántas veces aparece cada campo (para detectar campos opcionales).
function mergeFields(acc, data) {
  for (const [k, v] of Object.entries(data || {})) {
    const t = typeOfValue(v);
    if (!acc[k]) acc[k] = { types: {}, count: 0 };
    acc[k].count += 1;
    acc[k].types[t] = (acc[k].types[t] || 0) + 1;
  }
}

// ── recorrer una colección (todos los docs) ────────────────────────────────
async function inventoryCollection(colRef, pathLabel) {
  const fields = {};
  let docCount = 0;
  const subcollections = new Set();
  let scannedForSub = 0;

  // stream para no cargar todo en memoria
  const snap = await colRef.get();
  for (const doc of snap.docs) {
    docCount += 1;
    mergeFields(fields, doc.data());
    if (SUBCOL_SCAN_LIMIT === 0 || scannedForSub < SUBCOL_SCAN_LIMIT) {
      const subs = await doc.ref.listCollections();
      for (const s of subs) subcollections.add(s.id);
      scannedForSub += 1;
    }
  }

  const result = {
    path: pathLabel,
    docCount,
    fields: Object.fromEntries(
      Object.entries(fields)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, info]) => [
          name,
          {
            types: info.types,
            presentInDocs: info.count,
            optional: info.count < docCount,
          },
        ]),
    ),
    subcollections: [...subcollections].sort(),
  };

  // recursar subcolecciones (agregando una entrada por nombre de subcolección,
  // recorriendo cada doc padre). Para mantenerlo simple y completo, recolectamos
  // la unión de campos de la subcolección a través de todos los padres.
  const subResults = {};
  if (result.subcollections.length) {
    for (const subName of result.subcollections) {
      const subFields = {};
      let subCount = 0;
      for (const doc of snap.docs) {
        const subSnap = await doc.ref.collection(subName).get();
        for (const sd of subSnap.docs) {
          subCount += 1;
          mergeFields(subFields, sd.data());
        }
      }
      subResults[subName] = {
        path: `${pathLabel}/{id}/${subName}`,
        docCount: subCount,
        fields: Object.fromEntries(
          Object.entries(subFields).sort(([a], [b]) => a.localeCompare(b)).map(([n, i]) => [
            n,
            { types: i.types, presentInDocs: i.count, optional: i.count < subCount },
          ]),
        ),
      };
    }
  }

  return { result, subResults };
}

// ── árbol RTDB (shallow + conteos) ──────────────────────────────────────────
async function inventoryRTDB() {
  try {
    const rtdb = getDatabase();
    const rootSnap = await rtdb.ref('/').get();
    const root = rootSnap.val() || {};
    const tree = {};
    for (const [topKey, topVal] of Object.entries(root)) {
      if (topVal && typeof topVal === 'object') {
        const children = Object.keys(topVal);
        // campos de una muestra de hijos
        const fieldUnion = {};
        let n = 0;
        for (const childKey of children) {
          const childVal = topVal[childKey];
          if (childVal && typeof childVal === 'object' && !Array.isArray(childVal)) {
            mergeFields(fieldUnion, childVal);
            n += 1;
          }
        }
        tree[topKey] = {
          childCount: children.length,
          sampleChildKeys: children.slice(0, 5),
          fields: Object.fromEntries(
            Object.entries(fieldUnion).map(([k, i]) => [k, { types: i.types, presentInDocs: i.count }]),
          ),
        };
      } else {
        tree[topKey] = { value: typeof topVal, scalar: true };
      }
    }
    return tree;
  } catch (err) {
    return { error: String(err?.message || err) };
  }
}

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`🔎 Inventario de ${PROJECT_ID} (READ-ONLY)…\n`);

  const collections = await db.listCollections();
  console.log(`Firestore: ${collections.length} colecciones de nivel raíz.`);

  const manifest = {
    project: PROJECT_ID,
    generatedAt: new Date().toISOString(),
    firestore: {},
    rtdb: {},
    summary: { collections: 0, totalDocs: 0 },
  };

  for (const col of collections) {
    process.stdout.write(`  · ${col.id} … `);
    const { result, subResults } = await inventoryCollection(col, col.id);
    manifest.firestore[col.id] = result;
    for (const [subName, subRes] of Object.entries(subResults)) {
      manifest.firestore[`${col.id}/{id}/${subName}`] = subRes;
    }
    manifest.summary.collections += 1;
    manifest.summary.totalDocs += result.docCount;
    console.log(
      `${result.docCount} docs, ${Object.keys(result.fields).length} campos${
        result.subcollections.length ? `, subcols: ${result.subcollections.join(',')}` : ''
      }`,
    );
  }

  console.log(`\nRealtime Database: ${DATABASE_URL}`);
  manifest.rtdb = await inventoryRTDB();
  if (manifest.rtdb.error) console.log(`  ⚠️ RTDB: ${manifest.rtdb.error}`);
  else console.log(`  nodos raíz: ${Object.keys(manifest.rtdb).join(', ')}`);

  // ── escribir salidas ──────────────────────────────────────────────────────
  fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));

  // markdown legible
  let md = `# Manifiesto de la base viva — ${PROJECT_ID}\n\n`;
  md += `Generado: ${manifest.generatedAt}\n\n`;
  md += `**${manifest.summary.collections} colecciones · ${manifest.summary.totalDocs} documentos**\n\n`;
  md += `## Firestore\n\n`;
  for (const [name, c] of Object.entries(manifest.firestore)) {
    md += `### \`${name}\` — ${c.docCount} docs\n\n`;
    md += `| campo | tipo(s) | opcional |\n|---|---|---|\n`;
    for (const [fname, finfo] of Object.entries(c.fields)) {
      const types = Object.entries(finfo.types).map(([t, n]) => `${t}(${n})`).join(', ');
      md += `| \`${fname}\` | ${types} | ${finfo.optional ? 'sí' : 'no'} |\n`;
    }
    if (c.subcollections?.length) md += `\n_subcolecciones:_ ${c.subcollections.join(', ')}\n`;
    md += `\n`;
  }
  md += `## Realtime Database\n\n`;
  if (manifest.rtdb.error) {
    md += `⚠️ ${manifest.rtdb.error}\n`;
  } else {
    for (const [node, info] of Object.entries(manifest.rtdb)) {
      if (info.scalar) {
        md += `- \`${node}\`: escalar (${info.value})\n`;
      } else {
        const fields = Object.keys(info.fields || {}).join(', ') || '—';
        md += `- \`${node}\`: ${info.childCount} hijos · campos: ${fields}\n`;
      }
    }
  }
  fs.writeFileSync(path.join(OUT_DIR, 'manifest.md'), md);

  console.log(`\n✅ Manifiesto escrito en:`);
  console.log(`   ${path.join(OUT_DIR, 'manifest.json')}`);
  console.log(`   ${path.join(OUT_DIR, 'manifest.md')}`);
  console.log(`\nPégame el manifest.md (o súbelo) y con eso diseño el esquema 1:1.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Error en el inventario:', err);
  process.exit(1);
});
