#!/usr/bin/env node
/**
 * Seed a realistic manufacturing company org chart.
 *
 * Populates two Firestore collections:
 *   - departments: 9 áreas típicas de manufactura
 *   - positions:   ~42 puestos conectados en un árbol jerárquico
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *   npm run seed:org
 *
 *   # Wipe existing departments/positions first (asks you to type the
 *   # projectId to confirm — only touches these two collections, never
 *   # users, courses, sections, etc.):
 *   npm run seed:org -- --reset
 *
 *   # Skip confirmation prompt (scripts/CI only):
 *   npm run seed:org -- --yes
 *
 * Safety:
 *   - Idempotent without --reset: deterministic IDs refresh metadata
 *     without creating duplicates.
 *   - Only writes to "departments" and "positions". Nothing else is touched.
 *   - Always prints the target projectId and asks for confirmation.
 *   - For --reset, you must type the projectId exactly to proceed.
 *
 * Recommended: run `npm run backup` first to snapshot the project.
 */

import admin from 'firebase-admin';
import { readFile, stat, readdir } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import path from 'node:path';

// ─── Estructura de la empresa ────────────────────────────────────────────────

const DEPARTMENTS = [
  { id: 'dept-direction',   name: 'Dirección General',         color: '#0F172A', description: 'Liderazgo ejecutivo de la empresa' },
  { id: 'dept-production',  name: 'Producción',                color: '#DC2626', description: 'Operación de líneas y manufactura' },
  { id: 'dept-quality',     name: 'Calidad',                   color: '#2563EB', description: 'Aseguramiento y control de calidad' },
  { id: 'dept-maintenance', name: 'Mantenimiento',             color: '#EA580C', description: 'Mantenimiento mecánico y eléctrico' },
  { id: 'dept-logistics',   name: 'Logística y Almacén',       color: '#059669', description: 'Inventario, despacho y distribución' },
  { id: 'dept-ehs',         name: 'Seguridad Industrial (EHS)', color: '#F59E0B', description: 'Seguridad y salud ocupacional' },
  { id: 'dept-hr',          name: 'Recursos Humanos',          color: '#DB2777', description: 'Personal, nómina, reclutamiento y capacitación' },
  { id: 'dept-finance',     name: 'Administración y Finanzas', color: '#7C3AED', description: 'Contabilidad, compras y finanzas' },
  { id: 'dept-sales',       name: 'Ventas y Comercial',        color: '#0891B2', description: 'Ventas y servicio al cliente' },
];

/**
 * Cada entrada es un nodo del organigrama.
 *   role   → platformRole heredado por los usuarios al ocupar el puesto
 *   policy → onLeavePolicy: 'keep' mantiene progreso, 'discard' retira auto-inscripciones
 *
 * El CEO es la única raíz (parent=null). Los gerentes son admin de su sub-árbol.
 */
const POSITIONS = [
  // ── Dirección ────────────────────────────────────────────────────────────
  { id: 'pos-ceo', title: 'Director General (CEO)', department: 'dept-direction', parent: null, role: 'admin', policy: 'keep', description: 'Máxima autoridad; alcance total.' },

  // ── Producción ───────────────────────────────────────────────────────────
  { id: 'pos-prod-manager', title: 'Gerente de Producción', department: 'dept-production', parent: 'pos-ceo', role: 'admin', policy: 'keep' },
  { id: 'pos-prod-planner', title: 'Planificador de Producción', department: 'dept-production', parent: 'pos-prod-manager', role: 'student', policy: 'keep' },
  { id: 'pos-prod-sup-a', title: 'Supervisor de Producción — Turno A', department: 'dept-production', parent: 'pos-prod-manager', role: 'supervisor', policy: 'keep' },
  { id: 'pos-prod-sup-b', title: 'Supervisor de Producción — Turno B', department: 'dept-production', parent: 'pos-prod-manager', role: 'supervisor', policy: 'keep' },
  { id: 'pos-line-lead-1', title: 'Líder de Línea 1', department: 'dept-production', parent: 'pos-prod-sup-a', role: 'supervisor', policy: 'keep' },
  { id: 'pos-line-lead-2', title: 'Líder de Línea 2', department: 'dept-production', parent: 'pos-prod-sup-a', role: 'supervisor', policy: 'keep' },
  { id: 'pos-line-lead-3', title: 'Líder de Línea 3', department: 'dept-production', parent: 'pos-prod-sup-b', role: 'supervisor', policy: 'keep' },
  { id: 'pos-machine-operator-1', title: 'Operador de Máquina — Línea 1', department: 'dept-production', parent: 'pos-line-lead-1', role: 'student', policy: 'discard' },
  { id: 'pos-machine-operator-2', title: 'Operador de Envasado — Línea 2', department: 'dept-production', parent: 'pos-line-lead-2', role: 'student', policy: 'discard' },
  { id: 'pos-machine-operator-3', title: 'Operador de Empaque — Línea 3', department: 'dept-production', parent: 'pos-line-lead-3', role: 'student', policy: 'discard' },
  { id: 'pos-prod-helper', title: 'Auxiliar de Línea', department: 'dept-production', parent: 'pos-line-lead-1', role: 'student', policy: 'discard' },

  // ── Calidad ──────────────────────────────────────────────────────────────
  { id: 'pos-qa-manager', title: 'Gerente de Calidad', department: 'dept-quality', parent: 'pos-ceo', role: 'admin', policy: 'keep' },
  { id: 'pos-qc-supervisor', title: 'Supervisor de Control de Calidad', department: 'dept-quality', parent: 'pos-qa-manager', role: 'supervisor', policy: 'keep' },
  { id: 'pos-qc-inspector', title: 'Inspector de Calidad', department: 'dept-quality', parent: 'pos-qc-supervisor', role: 'student', policy: 'keep' },
  { id: 'pos-qc-lab-tech', title: 'Técnico de Laboratorio', department: 'dept-quality', parent: 'pos-qc-supervisor', role: 'student', policy: 'keep' },
  { id: 'pos-qa-auditor', title: 'Auditor Interno de Calidad', department: 'dept-quality', parent: 'pos-qa-manager', role: 'student', policy: 'keep' },

  // ── Mantenimiento ────────────────────────────────────────────────────────
  { id: 'pos-maint-manager', title: 'Gerente de Mantenimiento', department: 'dept-maintenance', parent: 'pos-ceo', role: 'admin', policy: 'keep' },
  { id: 'pos-maint-sup-mech', title: 'Supervisor de Mantenimiento Mecánico', department: 'dept-maintenance', parent: 'pos-maint-manager', role: 'supervisor', policy: 'keep' },
  { id: 'pos-maint-sup-elec', title: 'Supervisor de Mantenimiento Eléctrico', department: 'dept-maintenance', parent: 'pos-maint-manager', role: 'supervisor', policy: 'keep' },
  { id: 'pos-maint-tech-mech', title: 'Técnico Mecánico', department: 'dept-maintenance', parent: 'pos-maint-sup-mech', role: 'student', policy: 'keep' },
  { id: 'pos-maint-tech-elec', title: 'Técnico Eléctrico', department: 'dept-maintenance', parent: 'pos-maint-sup-elec', role: 'student', policy: 'keep' },

  // ── Logística ────────────────────────────────────────────────────────────
  { id: 'pos-log-manager', title: 'Gerente de Logística', department: 'dept-logistics', parent: 'pos-ceo', role: 'admin', policy: 'keep' },
  { id: 'pos-warehouse-sup', title: 'Supervisor de Almacén', department: 'dept-logistics', parent: 'pos-log-manager', role: 'supervisor', policy: 'keep' },
  { id: 'pos-forklift-op', title: 'Operador de Montacargas', department: 'dept-logistics', parent: 'pos-warehouse-sup', role: 'student', policy: 'discard' },
  { id: 'pos-warehouse-aux', title: 'Auxiliar de Almacén', department: 'dept-logistics', parent: 'pos-warehouse-sup', role: 'student', policy: 'keep' },
  { id: 'pos-dispatch-coord', title: 'Coordinador de Despacho', department: 'dept-logistics', parent: 'pos-log-manager', role: 'supervisor', policy: 'keep' },
  { id: 'pos-driver', title: 'Chofer de Distribución', department: 'dept-logistics', parent: 'pos-dispatch-coord', role: 'student', policy: 'keep' },

  // ── EHS ──────────────────────────────────────────────────────────────────
  { id: 'pos-ehs-manager', title: 'Gerente de EHS', department: 'dept-ehs', parent: 'pos-ceo', role: 'admin', policy: 'keep' },
  { id: 'pos-safety-sup', title: 'Supervisor de Seguridad', department: 'dept-ehs', parent: 'pos-ehs-manager', role: 'supervisor', policy: 'keep' },
  { id: 'pos-occ-nurse', title: 'Enfermero Ocupacional', department: 'dept-ehs', parent: 'pos-ehs-manager', role: 'student', policy: 'keep' },
  { id: 'pos-brigade', title: 'Brigadista de Emergencia', department: 'dept-ehs', parent: 'pos-safety-sup', role: 'student', policy: 'keep' },

  // ── RRHH ─────────────────────────────────────────────────────────────────
  { id: 'pos-hr-manager', title: 'Gerente de Recursos Humanos', department: 'dept-hr', parent: 'pos-ceo', role: 'admin', policy: 'keep' },
  { id: 'pos-payroll', title: 'Especialista en Nómina', department: 'dept-hr', parent: 'pos-hr-manager', role: 'student', policy: 'keep' },
  { id: 'pos-recruiter', title: 'Especialista en Reclutamiento', department: 'dept-hr', parent: 'pos-hr-manager', role: 'student', policy: 'keep' },
  { id: 'pos-training-coord', title: 'Coordinador de Capacitación', department: 'dept-hr', parent: 'pos-hr-manager', role: 'supervisor', policy: 'keep' },

  // ── Finanzas ─────────────────────────────────────────────────────────────
  { id: 'pos-fin-manager', title: 'Gerente Administrativo y Financiero', department: 'dept-finance', parent: 'pos-ceo', role: 'admin', policy: 'keep' },
  { id: 'pos-accountant', title: 'Contador General', department: 'dept-finance', parent: 'pos-fin-manager', role: 'student', policy: 'keep' },
  { id: 'pos-purchasing', title: 'Analista de Compras', department: 'dept-finance', parent: 'pos-fin-manager', role: 'student', policy: 'keep' },
  { id: 'pos-accounting-aux', title: 'Auxiliar Contable', department: 'dept-finance', parent: 'pos-accountant', role: 'student', policy: 'keep' },

  // ── Ventas ───────────────────────────────────────────────────────────────
  { id: 'pos-sales-manager', title: 'Gerente Comercial', department: 'dept-sales', parent: 'pos-ceo', role: 'admin', policy: 'keep' },
  { id: 'pos-sales-rep', title: 'Ejecutivo de Ventas', department: 'dept-sales', parent: 'pos-sales-manager', role: 'student', policy: 'keep' },
  { id: 'pos-cs-coord', title: 'Coordinador de Servicio al Cliente', department: 'dept-sales', parent: 'pos-sales-manager', role: 'support', policy: 'keep' },
  { id: 'pos-cs-agent', title: 'Agente de Servicio al Cliente', department: 'dept-sales', parent: 'pos-cs-coord', role: 'support', policy: 'keep' },
];

// ─── Runner ──────────────────────────────────────────────────────────────────

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

/**
 * Autodetect credentials + projectId.
 *   1. --project <id>
 *   2. GOOGLE_APPLICATION_CREDENTIALS path (if file exists)
 *   3. ./service-account*.json at repo root
 *   4. gcloud Application Default Credentials
 * ProjectId fallback: .firebaserc "default".
 */
async function resolveAuth(projectArg) {
  let projectId = projectArg || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
  let serviceAccount = null;
  let credentialSource = 'application-default (gcloud)';

  const candidates = [];
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    candidates.push(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  }
  candidates.push('./service-account.json');
  try {
    const files = await readdir('.');
    for (const f of files) {
      if (/^service-account.*\.json$/.test(f) && !candidates.includes('./' + f)) {
        candidates.push('./' + f);
      }
    }
  } catch { /* ignore */ }

  for (const candidate of candidates) {
    if (await exists(candidate)) {
      try {
        const parsed = JSON.parse(await readFile(candidate, 'utf8'));
        if (parsed.type === 'service_account' && parsed.private_key) {
          serviceAccount = parsed;
          if (!projectId) projectId = parsed.project_id;
          credentialSource = `service-account (${candidate})`;
          break;
        }
      } catch { /* skip */ }
    }
  }

  if (!projectId) {
    const firebaseRc = path.resolve('./.firebaserc');
    if (await exists(firebaseRc)) {
      try {
        const parsed = JSON.parse(await readFile(firebaseRc, 'utf8'));
        projectId = parsed?.projects?.default;
      } catch { /* ignore */ }
    }
  }

  if (!projectId) {
    console.error('No pude detectar el projectId. Pasa --project <id> o setea GOOGLE_CLOUD_PROJECT.');
    process.exit(1);
  }

  return { projectId, serviceAccount, credentialSource };
}

function validateSpec() {
  const deptIds = new Set(DEPARTMENTS.map(d => d.id));
  const posIds = new Set(POSITIONS.map(p => p.id));
  const errors = [];

  // Unique IDs
  if (deptIds.size !== DEPARTMENTS.length) errors.push('Duplicate department id');
  if (posIds.size !== POSITIONS.length) errors.push('Duplicate position id');

  for (const p of POSITIONS) {
    if (!deptIds.has(p.department)) {
      errors.push(`Position ${p.id} references unknown department ${p.department}`);
    }
    if (p.parent !== null && !posIds.has(p.parent)) {
      errors.push(`Position ${p.id} references unknown parent ${p.parent}`);
    }
    if (!['admin', 'supervisor', 'teacher', 'student', 'support'].includes(p.role)) {
      errors.push(`Position ${p.id} has invalid role ${p.role}`);
    }
    if (!['keep', 'discard'].includes(p.policy)) {
      errors.push(`Position ${p.id} has invalid policy ${p.policy}`);
    }
  }

  // Cycle detection
  const parentMap = new Map(POSITIONS.map(p => [p.id, p.parent]));
  for (const p of POSITIONS) {
    const seen = new Set([p.id]);
    let cur = parentMap.get(p.id);
    while (cur) {
      if (seen.has(cur)) {
        errors.push(`Cycle detected at position ${p.id}`);
        break;
      }
      seen.add(cur);
      cur = parentMap.get(cur);
    }
  }

  if (errors.length) {
    console.error('Seed spec is invalid:\n  - ' + errors.join('\n  - '));
    process.exit(1);
  }
}

async function wipeCollection(firestore, name) {
  const snapshot = await firestore.collection(name).get();
  if (snapshot.empty) {
    console.log(`  • ${name}: already empty`);
    return;
  }
  const batch = firestore.batch();
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  console.log(`  • ${name}: deleted ${snapshot.size} docs`);
}

async function seedDepartments(firestore) {
  const now = Date.now();
  const batch = firestore.batch();
  for (const d of DEPARTMENTS) {
    const ref = firestore.collection('departments').doc(d.id);
    batch.set(ref, {
      id: d.id,
      name: d.name,
      description: d.description,
      color: d.color,
      createdAt: now,
      updatedAt: now,
    }, { merge: true });
  }
  await batch.commit();
  console.log(`✓ Seeded ${DEPARTMENTS.length} departments`);
}

async function seedPositions(firestore) {
  const now = Date.now();
  // Ordenar por profundidad para que los padres existan antes (cosmética; usamos
  // IDs deterministas así que realmente el orden no cambia el resultado).
  const byParent = new Map();
  for (const p of POSITIONS) {
    const key = p.parent ?? '__root';
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(p);
  }

  const batch = firestore.batch();
  let order = 0;
  for (const p of POSITIONS) {
    const ref = firestore.collection('positions').doc(p.id);
    batch.set(ref, {
      id: p.id,
      title: p.title,
      description: p.description ?? null,
      departmentId: p.department,
      parentPositionId: p.parent,
      platformRole: p.role,
      onLeavePolicy: p.policy,
      order: order++,
      createdAt: now,
      updatedAt: now,
    }, { merge: true });
  }
  await batch.commit();
  console.log(`✓ Seeded ${POSITIONS.length} positions`);
}

function summarize() {
  const byDept = new Map();
  for (const p of POSITIONS) {
    byDept.set(p.department, (byDept.get(p.department) ?? 0) + 1);
  }
  console.log('\nEstructura generada:');
  for (const d of DEPARTMENTS) {
    const count = byDept.get(d.id) ?? 0;
    console.log(`  • ${d.name.padEnd(38)} ${count} puesto${count === 1 ? '' : 's'}`);
  }
  const depth = POSITIONS.reduce((acc, p) => {
    const parentMap = new Map(POSITIONS.map(x => [x.id, x.parent]));
    let d = 0;
    let cur = p.parent;
    while (cur) { d++; cur = parentMap.get(cur); }
    return Math.max(acc, d);
  }, 0);
  console.log(`\nTotales: ${DEPARTMENTS.length} departamentos · ${POSITIONS.length} puestos · profundidad ${depth + 1}`);
}

async function confirm(prompt) {
  if (!stdin.isTTY) {
    console.error('Non-interactive environment. Pass --yes to confirm.');
    process.exit(1);
  }
  const rl = createInterface({ input: stdin, output: stdout });
  const answer = await rl.question(prompt + ' ');
  rl.close();
  return answer.trim();
}

async function main() {
  const rawArgs = process.argv.slice(2);
  const args = new Set(rawArgs);
  const reset = args.has('--reset');
  const skipConfirm = args.has('--yes') || args.has('-y');
  const projectArgIdx = rawArgs.indexOf('--project');
  const projectArg = projectArgIdx >= 0 ? rawArgs[projectArgIdx + 1] : undefined;

  validateSpec();
  const { projectId, serviceAccount, credentialSource } = await resolveAuth(projectArg);

  admin.initializeApp({
    credential: serviceAccount
      ? admin.credential.cert(serviceAccount)
      : admin.credential.applicationDefault(),
    projectId,
  });
  const firestore = admin.firestore();

  console.log('Organigrama seed');
  console.log('  Project     : ' + projectId);
  console.log('  Credentials : ' + credentialSource);
  console.log('  Mode        : ' + (reset ? 'RESET (⚠ borra departments y positions)' : 'merge (idempotente, no destructivo)'));

  // Seguridad: confirmar siempre salvo --yes.
  // Para --reset exigimos escribir el projectId explícitamente.
  if (!skipConfirm) {
    if (reset) {
      const typed = await confirm(
        `Esto borrará TODAS las colecciones "departments" y "positions" del proyecto "${projectId}".\n` +
        `No toca users, courses, sections ni nada más.\n` +
        `Para confirmar escribe el nombre del proyecto exacto: `
      );
      if (typed !== projectId) {
        console.log('Aborted (no coincide con el projectId).');
        process.exit(0);
      }
    } else {
      const ok = await confirm(`Proceder con seed no destructivo en "${projectId}"? (y/N)`);
      if (!/^(y|yes|s|si|sí)$/i.test(ok)) {
        console.log('Aborted.');
        process.exit(0);
      }
    }
  }

  if (reset) {
    console.log('⚠  Wiping existing departments and positions...');
    await wipeCollection(firestore, 'positions');
    await wipeCollection(firestore, 'departments');
  }

  console.log('Seeding manufacturing org chart...');
  await seedDepartments(firestore);
  await seedPositions(firestore);

  summarize();
  console.log('\nDone. Visita /organization para ver el organigrama.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
