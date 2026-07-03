import { verifyAccess } from './jwt.js';

// Reimplementación server-side de firestore.rules / database.rules.json.
// req.user = { id, role, email, name } tras requireAuth.

export function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return res.status(401).json({ error: 'No autenticado' });
  try {
    const payload = verifyAccess(h.slice(7));
    req.user = { id: payload.sub, role: payload.role, email: payload.email, name: payload.name };
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

export const isAdmin = (u) => u?.role === 'admin' || u?.role === 'supervisor';
export const isTeacher = (u) => u?.role === 'teacher';
export const isStaff = (u) => isAdmin(u) || isTeacher(u);

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'No autenticado' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Permiso insuficiente' });
    next();
  };
}

// Política de ESCRITURA por colección (espejo de las reglas):
//  - staff (admin|teacher) puede crear contenido; teacher solo edita lo suyo (instructorId).
//  - users: admin crea/borra; cada quien edita su propio doc.
//  - logs/auditoría: solo backend/staff.
// Devuelve null si permitido, o un string con el motivo si se niega.
export function canWrite({ collection, action, user, existing }) {
  const uid = user?.id;
  const staffCollections = new Set([
    'modules', 'lessons', 'evaluations',
    'sectionLessonOverrides', 'departments', 'positions', 'aiAssistantPrompts',
  ]);

  // Logs de actividad/auditoría: cualquier autenticado los CREA (registra su
  // propia acción); solo admin edita/borra.
  if (collection === 'auditLogs' || collection === 'studentActivityLogs') {
    if (action === 'create') return null;
    return isAdmin(user) ? null : 'solo admin';
  }

  // Sesiones de chat IA: el dueño (userId) o admin.
  if (collection === 'aiAssistantSessions' || collection === 'evaluationAttempts') {
    if (action === 'create') return null; // se crea con el propio userId
    const owner = existing?.data?.userId;
    return isStaff(user) || owner === uid ? null : 'solo tu registro o staff';
  }

  // Certificados: el estudiante emite el suyo al completar (como los intentos);
  // editar/borrar solo el dueño o staff.
  if (collection === 'certificates') {
    if (action === 'create') return null; // se crea con el propio userId
    const owner = existing?.data?.userId;
    return isStaff(user) || owner === uid ? null : 'solo tu certificado o staff';
  }

  // Mensajería: autenticado crea; admin modera.
  if (collection === 'conversations' || collection === 'messages') {
    if (action === 'create') return null;
    return isAdmin(user) ? null : 'solo admin';
  }

  // Matrículas: staff, o el propio estudiante (auto-matrícula / su progreso).
  if (collection === 'enrollments') {
    if (isStaff(user) || action === 'create') return null;
    return existing?.data?.userId === uid ? null : 'solo tu matrícula o staff';
  }

  if (collection === 'users') {
    if (action === 'create' || action === 'delete') return isAdmin(user) ? null : 'solo admin';
    if (action === 'update') {
      if (isAdmin(user)) return null;
      return existing && existing.id === user.id ? null : 'solo tu propio usuario o admin';
    }
  }

  // cursos/secciones: admin total; teacher solo si es el instructor (propiedad)
  if (collection === 'courses' || collection === 'sections') {
    if (action === 'create') return isStaff(user) ? null : 'solo staff';
    if (isAdmin(user)) return null;
    const ownerId = existing?.data?.instructorId ?? existing?.instructor_id;
    if (isTeacher(user) && ownerId === user.id) return null;
    return 'solo el dueño (instructor) o admin';
  }

  if (staffCollections.has(collection)) return isStaff(user) ? null : 'solo staff';

  // por defecto: escritura requiere admin (conservador)
  return isAdmin(user) ? null : 'permiso insuficiente';
}
