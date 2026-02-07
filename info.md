# LasaEdu - Sistema de Gestion de Aprendizaje (LMS)

## Documentacion Tecnica Completa

**Ultima actualizacion:** Febrero 2026

---

## Resumen del Proyecto

**LasaEdu** es una plataforma LMS completa diseñada para instituciones educativas. Permite la gestion de cursos, estudiantes, profesores, evaluaciones, certificados y mas.

### Caracteristicas Principales
- **4 roles de usuario**: Admin, Teacher, Student, Support
- **Gestion de cursos**: Creacion, modulos, lecciones
- **Evaluaciones**: Quizzes, examenes, tareas, proyectos
- **Gamificacion**: Puntos, insignias, rachas, leaderboard
- **Comunicacion**: Chat, canales, mensajeria
- **Certificados**: Generacion automatica
- **Analytics**: Reportes y metricas
- **Soporte**: Sistema de tickets
- **Foros**: Posts y respuestas por curso

---

## Stack Tecnologico

### Frontend
| Tecnologia | Version | Proposito |
|---|---|---|
| React | 19.2.0 | UI Framework |
| TypeScript | 5.x | Tipado estatico |
| Vite | 7.3.1 | Build tool |
| TailwindCSS | 3.x | Estilos |
| Zustand | 5.0.10 | Estado global |
| React Router | 7.12.0 | Navegacion |
| React Hook Form | 7.71.0 | Formularios |
| Zod | 4.3.5 | Validacion |
| Lucide React | 0.562.0 | Iconos |

### Backend/Database
| Tecnologia | Version | Proposito |
|---|---|---|
| Firebase Auth | 12.7.0 | Autenticacion |
| Firebase Realtime DB | 12.7.0 | Base de datos |
| Firebase Storage | 12.7.0 | Almacenamiento archivos |
| Firebase Emulator | Local | Desarrollo local |

### Testing
| Tecnologia | Proposito |
|---|---|
| Vitest | Unit testing |
| Testing Library | Component testing |
| jsdom | DOM simulation |

---

## Arquitectura del Sistema

```
Pages/Components
       |
   dataService.ts          (servicios de alto nivel)
       |
   firebaseDataService.ts  (CRUD bajo nivel - Firebase Realtime DB)
       |
   Firebase Realtime Database (Emulator: localhost:9000)
```

**Regla:** Las paginas importan de `dataService.ts`, NUNCA directamente de `firebaseDataService.ts`.

### Servicios Disponibles (dataService.ts)

```
dashboardService, userService, courseService, moduleService, lessonService,
enrollmentService, legacyEnrollmentService, evaluationService, gradeService,
certificateService, conversationService, messageService, notificationService,
supportTicketService, activityService, gamificationService, progressActivityService,
userSettingsService, forumService, metricsService, dataUtils
```

---

## Estructura de Directorios

```
lasaedu/
  src/
    app/
      config/firebase.ts       # Configuracion Firebase + emuladores
      router/index.tsx          # Rutas de la aplicacion
      store/authStore.ts        # Estado de autenticacion (Zustand)
    modules/
      auth/                     # Login, registro, recuperacion
      analytics/                # ReportsPage
      certificates/             # CertificatesPage
      communication/            # CommunicationPage (mensajeria)
      courses/                  # CourseCatalogPage, LessonBuilderPage, ContentEditor
      dashboard/                # AdminDashboard, TeacherDashboard, StudentDashboard, SupportDashboard
      enrollments/              # EnrollmentManagementPage
      evaluations/              # EvaluationsPage, TakeEvaluationPage, EvaluationBuilderPage
      forums/                   # ForumsPage
      gamification/             # GamificationPage
      grades/                   # GradesPage
      notifications/            # NotificationSystemPage
      progress/                 # MyProgressPage
      settings/                 # SettingsPage
      support/                  # SupportPage
      users/                    # UsersPage, UserManagementPage
    shared/
      components/
        layout/                 # Header, Sidebar, MainLayout
        ui/                     # Button, Card, Input, Label
        media/                  # VideoPlayer
      services/
        dataService.ts          # Capa de abstraccion unificada
        firebaseDataService.ts  # Implementacion Firebase
        assessmentService.ts    # Servicio de assessments (Firestore)
        certificateGenerator.ts # Generador de certificados
        enrollmentService.ts    # Servicio de enrollment
        fileUploadService.ts    # Subida de archivos
        progressTrackingService.ts # Tracking de progreso
      types/
        index.ts                # Tipos TypeScript principales
        assessment.ts           # Tipos de assessments
        progress.ts             # Tipos de progreso
      utils/
        cn.ts                   # Utilidad classnames
        storage.ts              # Utilidades de almacenamiento
  seed-data.mjs                 # Script de semilla (Auth + DB)
  database.rules.json           # Reglas de seguridad Firebase
  firebase.json                 # Configuracion Firebase emulators
  storage.rules                 # Reglas de Storage
```

---

## Levantar el Proyecto

### Prerequisitos

- **Node.js** (v18+)
- **Java** (OpenJDK) - necesario para Firebase Emulator
  ```bash
  brew install openjdk
  # Si java no esta en PATH:
  export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"
  # Para hacerlo permanente, agregar a ~/.zshrc
  ```

### Pasos

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar Firebase Emulator (terminal 1)
export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"
npm run firebase:emulator

# 3. Sembrar datos (terminal 2, una sola vez)
node seed-data.mjs

# 4. Iniciar app (terminal 2)
npm run dev
```

### URLs

| Servicio | URL |
|---|---|
| App (Vite) | http://localhost:5173/ |
| Firebase Emulator UI | http://127.0.0.1:4000/ |
| Auth Emulator | http://127.0.0.1:9099 |
| Database Emulator | http://127.0.0.1:9000 |
| Storage Emulator | http://127.0.0.1:9199 |

### Scripts Disponibles

| Comando | Descripcion |
|---|---|
| `npm run dev` | Servidor de desarrollo (Vite) |
| `npm run build` | Build de produccion (tsc + vite) |
| `npm run lint` | Linter (eslint) |
| `npm run test` | Tests (vitest) |
| `npm run firebase:emulator` | Iniciar emuladores Firebase |
| `npm run firebase:emulator:export` | Exportar datos del emulador |
| `npm run firebase:emulator:import` | Importar datos al emulador |

---

## Usuarios de Prueba

| Email | Password | Rol | Descripcion |
|---|---|---|---|
| admin@lasaedu.com | password123 | admin | Acceso total |
| profesor@lasaedu.com | password123 | teacher | Gestion de cursos |
| estudiante@lasaedu.com | password123 | student | Vista estudiante |
| ana@lasaedu.com | password123 | student | Estudiante adicional |
| soporte@lasaedu.com | password123 | support | Atencion a usuarios |

Los usuarios se crean tanto en **Firebase Auth** (para login) como en **Realtime Database** (para datos de perfil).

---

## Flujo de Datos

### Autenticacion
```
LoginPage -> authService.login()
  -> signInWithEmailAndPassword() (Firebase Auth)
  -> firebaseDB.getUserByEmail() (Realtime DB)
  -> authStore (Zustand) + localStorage
  -> ProtectedRoute -> DashboardRedirect (por rol)
```

### CRUD General
```
Page Component
  -> servicio de dataService.ts (ej: courseService.getAll())
  -> firebaseDataService (Firebase Realtime DB)
  -> Firebase Database Emulator
```

---

## Esquema Firebase (Colecciones)

| Coleccion | Descripcion |
|---|---|
| users | Usuarios del sistema |
| courses | Cursos disponibles |
| modules | Modulos de cada curso |
| lessons | Lecciones de cada modulo |
| enrollments | Inscripciones de estudiantes |
| evaluations | Evaluaciones/examenes |
| evaluationAttempts | Intentos de evaluacion |
| grades | Calificaciones |
| certificates | Certificados emitidos |
| conversations | Conversaciones de mensajeria |
| messages | Mensajes individuales |
| notifications | Notificaciones del sistema |
| supportTickets | Tickets de soporte |
| activities | Registro de actividades |
| userPoints | Puntos de gamificacion |
| userBadges | Insignias ganadas por usuarios |
| badges | Catalogo de insignias |
| learningStreaks | Rachas de aprendizaje |
| forumPosts | Posts del foro |
| forumReplies | Respuestas del foro |
| progressActivities | Actividades de progreso |
| userSettings | Configuracion de usuario |
| systemMetrics | Metricas del sistema |

### Mapeos de Campos Importantes

| Contexto | Campo UI/Ingles | Campo Firebase |
|---|---|---|
| Soporte | category: 'technical' | category: 'tecnico' |
| Soporte | category: 'course' | category: 'academico' |
| Soporte | category: 'payment' | category: 'pagos' |
| Soporte | category: 'account' | category: 'cuenta' |
| Soporte | category: 'other' | category: 'otro' |
| Soporte | priority: 'low' | priority: 'baja' |
| Soporte | priority: 'medium' | priority: 'media' |
| Soporte | priority: 'high' | priority: 'alta' |
| Soporte | priority: 'critical' | priority: 'urgente' |
| Mensajeria | channels | conversations |
| Mensajeria | channelId | conversationId |
| Mensajeria | members | participants |
| Evaluaciones | submissions | evaluationAttempts |

---

## Migracion Completada (Feb 2026)

Se migro TODO el proyecto de `localDB` (almacenamiento local) a Firebase:

### Resumen
- **67 llamadas a localDB** reemplazadas en **13 archivos**
- **Archivos eliminados:** `localDB.ts`, `mockData.ts`, `CertificatesPageOld.tsx`
- **Archivos de servicio limpiados:** dead code branches removidos de `firebaseDataService.ts`
- **Seed data actualizado:** `seed-data.mjs` ahora crea usuarios en Firebase Auth + Database
- **~70 errores TypeScript pre-existentes** corregidos
- **Verificacion:** `grep -r "localDB" src/` = 0 resultados, `tsc --noEmit` = 0 errores

### Servicios Nuevos Agregados
- `forumService` - CRUD de posts y replies del foro
- `progressActivityService` - Actividades de progreso por usuario
- `userSettingsService` - Configuracion de usuario

### Archivos Migrados
1. CourseCatalogPage.tsx
2. CertificatesPage.tsx
3. GamificationPage.tsx
4. EvaluationsPage.tsx
5. SupportPage.tsx
6. GradesPage.tsx
7. TakeEvaluationPage.tsx
8. SettingsPage.tsx
9. UsersPage.tsx
10. ReportsPage.tsx
11. MyProgressPage.tsx
12. CommunicationPage.tsx
13. ForumsPage.tsx

### Errores Pre-existentes Corregidos
- CertificatesPage: mapeo de campos DBCertificate
- EnrollmentManagementPage: tipos, campos, variables no usadas
- 6+ archivos: imports no usados de lucide-react y types
- QuestionBuilder: metadata type extendido
- assessmentService: imports y vars no usados
- certificateGenerator: getter para _style
- certificateGeneratorNew: params no usados prefijados
- enrollmentService: imports no usados, withdrawalReason -> withdrawReason
- fileUploadService: snapshot.totalBytes -> file.size
- progressTrackingService: tipo AssessmentProgressSummary
- VideoPlayer: @ts-expect-error para react-player types

---

## Convenciones de Codigo

```typescript
// Archivos: PascalCase para componentes
CoursesPage.tsx
CourseDetailPage.tsx

// Variables/funciones: camelCase
const courseService = { ... }
const handleSubmit = () => { ... }

// Tipos DB: prefijo DB
interface DBCourse { ... }
interface DBUser { ... }

// Hooks: prefijo use
const useSystemStats = () => { ... }

// Variables no usadas: prefijo _
const [_lesson, setLesson] = useState(...)
const _handleCreate = async () => { ... }
```

### Agregar Nueva Funcionalidad

1. Crear componente de pagina en `src/modules/[modulo]/pages/`
2. Agregar ruta en `src/app/router/index.tsx`
3. Crear servicio (si es necesario) en `dataService.ts`
4. Agregar al sidebar en `src/shared/components/layout/Sidebar.tsx`
5. Exportar en `src/pages/index.ts`

---

## Tareas Pendientes

### Funcionalidad
- Login social (Google, Facebook)
- Verificacion de email
- 2FA (Two-Factor Authentication)
- Reproductor de video integrado
- Generacion de certificados PDF
- Chat en tiempo real (Firebase listeners)
- Gamificacion activa (eventos automaticos de puntos)
- Notificaciones push (Firebase Cloud Messaging)

### Mejoras Tecnicas
- Testing (unit, integration, E2E)
- Lazy loading de modulos
- Cache de datos (React Query/SWR)
- Dark mode
- Internacionalizacion (i18n)
- Accesibilidad (a11y)
- Graficos en reportes (Chart.js/Recharts)
- Exportacion a Excel/CSV

---

*Este documento se actualizara conforme avance el desarrollo del proyecto.*
