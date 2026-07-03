-- ============================================================================
-- LasaEdu — Esquema PostgreSQL (migración 1:1 desde Firestore)
-- Generado a partir del manifiesto REAL de la base viva (scripts/inventory-output).
--
-- Principio LOSSLESS: cada tabla guarda el DOCUMENTO COMPLETO en `data JSONB`
-- (nada se pierde, ni campos fuera del esquema) + columnas tipadas SOLO para lo
-- que se filtra/ordena/une (los patrones de query reales de firebaseDB). Las
-- columnas tipadas se derivan de `data` en la migración; `data` es la verdad.
--
-- PK = el ID de documento de Firestore (TEXT) → preserva todas las referencias.
-- Fechas: epoch ms se guardan como BIGINT; fechas ISO quedan en `data`.
-- 16 colecciones reales · ~2147 docs. RTDB vacía (no migra nada).
-- ============================================================================

-- ── usuarios ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL,
  name          TEXT,
  role          TEXT NOT NULL,            -- student|teacher|admin|support|supervisor
  status        TEXT,
  email_verified BOOLEAN,
  created_at    BIGINT,
  updated_at    BIGINT,
  -- auth self-host (se llena en import-auth.mjs desde firebase auth:export):
  password_hash TEXT,                     -- bcrypt una vez re-hasheado
  fb_scrypt_hash TEXT,                    -- hash scrypt original de Firebase
  fb_scrypt_salt TEXT,                    -- salt por usuario del export
  data          JSONB NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));
CREATE INDEX IF NOT EXISTS users_role_idx ON users (role);

-- ── cursos ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS courses (
  id            TEXT PRIMARY KEY,
  instructor_id TEXT,
  status        TEXT,
  category      TEXT,
  level         TEXT,
  created_at    BIGINT,
  updated_at    BIGINT,
  data          JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS courses_instructor_idx ON courses (instructor_id);
CREATE INDEX IF NOT EXISTS courses_status_idx ON courses (status);

-- ── secciones ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sections (
  id            TEXT PRIMARY KEY,
  course_id     TEXT,
  instructor_id TEXT,
  status        TEXT,
  created_at    BIGINT,
  updated_at    BIGINT,
  data          JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS sections_course_idx ON sections (course_id);
CREATE INDEX IF NOT EXISTS sections_instructor_idx ON sections (instructor_id);

-- ── módulos ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS modules (
  id            TEXT PRIMARY KEY,
  course_id     TEXT,
  status        TEXT,
  "order"       INTEGER,
  created_at    BIGINT,
  updated_at    BIGINT,
  data          JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS modules_course_idx ON modules (course_id);

-- ── lecciones (la tabla más grande: 1106) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS lessons (
  id            TEXT PRIMARY KEY,
  course_id     TEXT,
  module_id     TEXT,
  type          TEXT,
  status        TEXT,
  "order"       INTEGER,
  created_at    BIGINT,
  updated_at    BIGINT,
  data          JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS lessons_course_idx ON lessons (course_id);
CREATE INDEX IF NOT EXISTS lessons_module_idx ON lessons (module_id);

-- ── matrículas ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS enrollments (
  id            TEXT PRIMARY KEY,
  user_id       TEXT,
  course_id     TEXT,
  section_id    TEXT,
  status        TEXT,
  progress      NUMERIC,
  created_at    BIGINT,
  updated_at    BIGINT,
  data          JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS enrollments_user_idx ON enrollments (user_id);
CREATE INDEX IF NOT EXISTS enrollments_course_idx ON enrollments (course_id);
CREATE INDEX IF NOT EXISTS enrollments_section_idx ON enrollments (section_id);
-- OJO: la base viva tiene matrículas DUPLICADAS por (user_id, course_id) — el
-- doble origen histórico (RTDB legacy + Firestore) dejó duplicados. La unicidad
-- por (user,curso) NO es un invariante del dato → índice NO único (1:1 lossless).
-- La dedup/regla de negocio se decide aparte, NO en la migración.
CREATE INDEX IF NOT EXISTS enrollments_user_course_idx ON enrollments (user_id, course_id);

-- ── intentos de evaluación ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS evaluation_attempts (
  id            TEXT PRIMARY KEY,
  user_id       TEXT,
  course_id     TEXT,
  evaluation_id TEXT,
  passed        BOOLEAN,
  created_at    BIGINT,
  updated_at    BIGINT,
  data          JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS eval_attempts_user_idx ON evaluation_attempts (user_id);
CREATE INDEX IF NOT EXISTS eval_attempts_eval_idx ON evaluation_attempts (evaluation_id);
CREATE INDEX IF NOT EXISTS eval_attempts_course_idx ON evaluation_attempts (course_id);

-- ── certificados ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS certificates (
  id            TEXT PRIMARY KEY,
  user_id       TEXT,
  course_id     TEXT,
  credential_id TEXT,
  status        TEXT,
  created_at    BIGINT,
  updated_at    BIGINT,
  data          JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS certificates_user_idx ON certificates (user_id);
CREATE INDEX IF NOT EXISTS certificates_cred_idx ON certificates (credential_id);
CREATE INDEX IF NOT EXISTS certificates_course_idx ON certificates (course_id);

-- ── organigrama: departamentos / posiciones ─────────────────────────────────
CREATE TABLE IF NOT EXISTS departments (
  id            TEXT PRIMARY KEY,
  created_at    BIGINT,
  updated_at    BIGINT,
  data          JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS positions (
  id                 TEXT PRIMARY KEY,
  department_id      TEXT,
  parent_position_id TEXT,
  platform_role      TEXT,
  created_at         BIGINT,
  updated_at         BIGINT,
  data               JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS positions_dept_idx ON positions (department_id);
CREATE INDEX IF NOT EXISTS positions_parent_idx ON positions (parent_position_id);

-- ── overrides de lección por sección ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS section_lesson_overrides (
  id            TEXT PRIMARY KEY,
  section_id    TEXT,
  lesson_id     TEXT,
  course_id     TEXT,
  created_at    BIGINT,
  updated_at    BIGINT,
  data          JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS slo_section_idx ON section_lesson_overrides (section_id);
CREATE INDEX IF NOT EXISTS slo_lesson_idx ON section_lesson_overrides (lesson_id);

-- ── mensajería interna ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id            TEXT PRIMARY KEY,
  type          TEXT,
  created_at    BIGINT,
  updated_at    BIGINT,
  data          JSONB NOT NULL    -- participants[], lastMessage{}, unreadCount{}
);

CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT,
  sender_id       TEXT,
  created_at      BIGINT,
  updated_at      BIGINT,
  data            JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages (conversation_id);

-- ── auditoría / actividad ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id            TEXT PRIMARY KEY,
  actor_id      TEXT,
  resource_type TEXT,
  resource_id   TEXT,
  course_id     TEXT,
  created_at    BIGINT,
  data          JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS audit_actor_idx ON audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS audit_resource_idx ON audit_logs (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS audit_created_idx ON audit_logs (created_at DESC);

CREATE TABLE IF NOT EXISTS student_activity_logs (
  id            TEXT PRIMARY KEY,
  student_id    TEXT,
  course_id     TEXT,
  section_id    TEXT,
  activity_type TEXT,
  created_at    BIGINT,
  data          JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS sal_student_idx ON student_activity_logs (student_id);
CREATE INDEX IF NOT EXISTS sal_course_idx ON student_activity_logs (course_id);

-- ── IA Lasa ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_assistant_prompts (
  id             TEXT PRIMARY KEY,
  is_active      BOOLEAN,
  version_number INTEGER,
  created_at     BIGINT,
  updated_at     BIGINT,
  data           JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS ai_prompts_active_idx ON ai_assistant_prompts (is_active);

CREATE TABLE IF NOT EXISTS ai_assistant_sessions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT,
  course_id     TEXT,
  created_at    BIGINT,
  updated_at    BIGINT,
  data          JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS ai_sessions_user_idx ON ai_assistant_sessions (user_id);

-- ── auth self-host: refresh tokens / sesiones ───────────────────────────────
-- (RTDB tenía authSessions/refreshTokens pero está vacía; aquí va el modelo nuevo)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          TEXT PRIMARY KEY,         -- jti
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,            -- hash del refresh token (no el token)
  expires_at  BIGINT NOT NULL,
  created_at  BIGINT NOT NULL,
  revoked_at  BIGINT
);
CREATE INDEX IF NOT EXISTS refresh_user_idx ON refresh_tokens (user_id);

-- ── reset de contraseña (token de un solo uso) ──────────────────────────────
CREATE TABLE IF NOT EXISTS password_resets (
  id          TEXT PRIMARY KEY,        -- jti
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  expires_at  BIGINT NOT NULL,
  used_at     BIGINT,
  created_at  BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS pwreset_user_idx ON password_resets (user_id);
