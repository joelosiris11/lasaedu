# LasaEdu - Sistema de Gestion de Aprendizaje (LMS)

## Documentacion Tecnica Completa

**Ultima actualizacion:** Febrero 2026
**Version:** 1.0.0 (Sprints 1-6 completados)

---

## Resumen del Proyecto

**LasaEdu** es una plataforma LMS completa diseñada para instituciones educativas. Permite la gestion de cursos, estudiantes, profesores, evaluaciones, certificados y mas.

### Caracteristicas Principales
- **4 roles de usuario**: Admin, Teacher, Student, Support
- **Gestion de cursos**: Creacion, modulos, lecciones con editor WYSIWYG
- **Evaluaciones**: Quizzes, examenes, tareas, proyectos
- **Gamificacion**: Puntos, insignias, rachas, leaderboard, niveles
- **Comunicacion**: Chat, canales, mensajeria
- **Certificados**: Generacion automatica PDF con verificacion publica
- **Analytics**: Reportes y metricas en tiempo real
- **Soporte**: Sistema de tickets
- **Foros**: Posts y respuestas por curso
- **Notificaciones**: Sistema en tiempo real con toasts

---

## Stack Tecnologico

### Frontend
| Tecnologia | Version | Proposito |
|---|---|---|
| React | 19.2.0 | UI Framework |
| TypeScript | 5.9.3 | Tipado estatico |
| Vite | 7.3.1 | Build tool |
| TailwindCSS | 3.4.17 | Estilos |
| Zustand | 5.0.10 | Estado global |
| React Router | 7.12.0 | Navegacion |
| React Hook Form | 7.71.0 | Formularios |
| Zod | 4.3.5 | Validacion |
| Lucide React | 0.562.0 | Iconos |
| jsPDF | 4.0.0 | Generacion de PDFs |
| TipTap | 3.19.0 | Editor WYSIWYG |
| date-fns | 4.1.0 | Manejo de fechas |

### Backend/Database
| Tecnologia | Version | Proposito |
|---|---|---|
| Firebase Auth | 12.7.0 | Autenticacion |
| Firebase Realtime DB | 12.7.0 | Base de datos |
| Firebase Storage | 12.7.0 | Almacenamiento archivos |
| Firebase Hosting | - | Deploy produccion |
| Firebase Emulator | Local | Desarrollo local |

### Testing
| Tecnologia | Version | Proposito |
|---|---|---|
| Vitest | 4.0.17 | Unit testing |
| Testing Library | 16.3.1 | Component testing |
| jsdom | 27.4.0 | DOM simulation |

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

### Servicios Adicionales

| Servicio | Archivo | Proposito |
|---|---|---|
| analyticsService | analyticsService.ts | Calculos de metricas y tendencias |
| gamificationEngine | gamificationEngine.ts | Motor de gamificacion (puntos, badges, streaks) |
| certificateGenerator | certificateGeneratorNew.ts | Generacion de certificados PDF |

---

## Estructura de Directorios

```
lasaedu/
  src/
    app/
      config/firebase.ts          # Configuracion Firebase + emuladores
      router/index.tsx            # Rutas de la aplicacion
      store/
        authStore.ts              # Estado de autenticacion (Zustand)
        notificationStore.ts      # Estado de notificaciones (Zustand)
    modules/
      auth/                       # Login, registro, recuperacion
      analytics/                  # ReportsPage
      certificates/               # CertificatesPage, VerifyCertificatePage
      communication/              # CommunicationPage (mensajeria)
      courses/                    # CourseCatalogPage, LessonBuilderPage, ContentEditor
      dashboard/                  # AdminDashboard, TeacherDashboard, StudentDashboard, SupportDashboard
      enrollments/                # EnrollmentManagementPage
      evaluations/                # EvaluationsPage, TakeEvaluationPage, EvaluationBuilderPage
      forums/                     # ForumsPage
      gamification/               # GamificationPage
      grades/                     # GradesPage
      notifications/              # NotificationSystemPage, MyNotificationsPage
      progress/                   # MyProgressPage
      settings/                   # SettingsPage
      support/                    # SupportPage
      users/                      # UsersPage, UserManagementPage
    shared/
      components/
        editor/                   # RichTextEditor (TipTap)
        layout/                   # Header, Sidebar, MainLayout, NotificationCenter
        ui/                       # Button, Card, Input, Label, Toast
        media/                    # VideoPlayer
      hooks/
        useDashboard.ts           # Hooks para dashboard data
      services/
        dataService.ts            # Capa de abstraccion unificada
        firebaseDataService.ts    # Implementacion Firebase
        analyticsService.ts       # Servicio de analytics
        gamificationEngine.ts     # Motor de gamificacion
        certificateGeneratorNew.ts # Generador de certificados PDF
        assessmentService.ts      # Servicio de assessments
        enrollmentService.ts      # Servicio de enrollment
        fileUploadService.ts      # Subida de archivos
        progressTrackingService.ts # Tracking de progreso
      types/
        index.ts                  # Tipos TypeScript principales
        assessment.ts             # Tipos de assessments
        progress.ts               # Tipos de progreso
      utils/
        cn.ts                     # Utilidad classnames
        storage.ts                # Utilidades de almacenamiento
    test/
      setup.ts                    # Configuracion de tests
      testUtils.tsx               # Utilidades de testing
  vitest.config.ts                # Configuracion Vitest
  seed-data.mjs                   # Script de semilla (Auth + DB)
  database.rules.json             # Reglas de seguridad Firebase
  firebase.json                   # Configuracion Firebase (emulators + hosting)
  storage.rules                   # Reglas de Storage
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
| Hosting Emulator | http://127.0.0.1:5000 |

### Scripts Disponibles

| Comando | Descripcion |
|---|---|
| `npm run dev` | Servidor de desarrollo (Vite) |
| `npm run build` | Build de produccion (tsc + vite) |
| `npm run lint` | Linter (eslint) |
| `npm run test` | Tests en modo watch (vitest) |
| `npm run test:run` | Tests una sola vez |
| `npm run test:coverage` | Tests con cobertura |
| `npm run firebase:emulator` | Iniciar emuladores Firebase |
| `npm run firebase:emulator:export` | Exportar datos del emulador |
| `npm run firebase:emulator:import` | Importar datos al emulador |
| `npm run deploy` | Build + deploy a Firebase Hosting |
| `npm run deploy:preview` | Deploy a canal preview |

---

## Usuarios de Prueba

| Email | Password | Rol | Descripcion |
|---|---|---|---|
| admin@lasaedu.com | password123 | admin | Acceso total |
| teacher@lasaedu.com | password123 | teacher | Gestion de cursos |
| student@lasaedu.com | password123 | student | Vista estudiante |
| laura@lasaedu.com | password123 | student | Estudiante adicional |
| support@lasaedu.com | password123 | support | Atencion a usuarios |

Los usuarios se crean tanto en **Firebase Auth** (para login) como en **Realtime Database** (para datos de perfil).

---

## Testing

### Configuracion

El proyecto usa **Vitest** con **Testing Library**. La configuracion esta en `vitest.config.ts`.

### Estructura de Tests

```
src/
  app/store/
    authStore.test.ts         # Tests del store de autenticacion (13 tests)
  shared/
    components/ui/
      Button.test.tsx         # Tests del componente Button (19 tests)
      Input.test.tsx          # Tests del componente Input (20 tests)
      Card.test.tsx           # Tests del componente Card (18 tests)
    hooks/
      useDashboard.test.ts    # Tests de hooks del dashboard (14 tests)
    services/
      gamificationEngine.test.ts # Tests del motor de gamificacion (23 tests)
  test/
    setup.ts                  # Setup global (mocks de Firebase)
    testUtils.tsx             # Utilidades (render con providers, mock data)
```

### Ejecutar Tests

```bash
# Modo watch (desarrollo)
npm run test

# Ejecucion unica
npm run test:run

# Con cobertura
npm run test:coverage

# Interface visual
npm run test:ui
```

### Total: 107 tests pasando

---

## Sistema de Notificaciones

### Arquitectura

```
notificationStore.ts (Zustand)
       |
   +---+---+
   |       |
Notifications    Toast Queue
(Firebase)       (In-memory)
   |                |
NotificationCenter  ToastContainer
(Header dropdown)   (Fixed overlay)
```

### Componentes

| Componente | Ubicacion | Proposito |
|---|---|---|
| notificationStore | app/store/notificationStore.ts | Estado global de notificaciones |
| NotificationCenter | layout/NotificationCenter.tsx | Dropdown en header |
| ToastContainer | ui/Toast.tsx | Notificaciones toast |
| MyNotificationsPage | notifications/MyNotificationsPage.tsx | Vista completa |

### Uso

```typescript
// Mostrar toast
const toast = useToast();
toast.success('Exito', 'Operacion completada');
toast.error('Error', 'Algo salio mal');

// Notificaciones persistentes (Firebase)
await notificationService.create({
  userId: 'user-id',
  type: 'info',
  title: 'Titulo',
  message: 'Mensaje',
  read: false,
  createdAt: Date.now()
});
```

---

## Sistema de Gamificacion

### Motor (gamificationEngine.ts)

El motor de gamificacion maneja:
- **Puntos**: Por acciones (completar leccion, pasar quiz, etc.)
- **Niveles**: 10 niveles (Novato -> Iluminado)
- **Badges**: 12+ insignias desbloqueables
- **Streaks**: Racha de dias consecutivos

### Configuracion de Puntos

| Accion | Puntos |
|---|---|
| COMPLETE_LESSON | 10 |
| COMPLETE_MODULE | 50 |
| COMPLETE_COURSE | 200 |
| SUBMIT_QUIZ | 15 |
| PASS_QUIZ | 25 |
| PERFECT_QUIZ | 100 |
| DAILY_LOGIN | 5 |
| STREAK_7_DAYS | 50 |
| STREAK_30_DAYS | 200 |
| EARN_CERTIFICATE | 150 |

### Niveles

| Nivel | Nombre | Puntos Minimos |
|---|---|---|
| 1 | Novato | 0 |
| 2 | Aprendiz | 100 |
| 3 | Estudiante | 300 |
| 4 | Aplicado | 600 |
| 5 | Avanzado | 1000 |
| 6 | Experto | 1500 |
| 7 | Maestro | 2200 |
| 8 | Gran Maestro | 3000 |
| 9 | Leyenda | 4000 |
| 10 | Iluminado | 5500 |

### Uso

```typescript
import { gamificationEngine } from '@shared/services/gamificationEngine';

// Otorgar puntos
const result = await gamificationEngine.awardPoints(userId, 'COMPLETE_LESSON', { userName });
// result: { pointsAwarded, newTotal, levelUp, badgesUnlocked }

// Registrar completado de leccion
await gamificationEngine.onLessonComplete(userId, lessonId, courseId, userName);

// Actualizar racha
await gamificationEngine.updateStreak(userId);
```

---

## Certificados

### Generacion

Los certificados se generan con **jsPDF** en `certificateGeneratorNew.ts`.

### Verificacion Publica

La ruta `/verify/:certificateId` permite verificar certificados sin autenticacion.

```
https://lasaedu.com/verify/LASA-2026-ABC123
```

### Estados

| Estado | Descripcion |
|---|---|
| Valido | Certificado autentico y activo |
| Revocado | Certificado cancelado |
| No encontrado | ID no existe en el sistema |

---

## Analytics

### Servicio (analyticsService.ts)

| Metodo | Descripcion |
|---|---|
| getMonthlyStats(months) | Estadisticas mensuales |
| getCourseAnalytics(courseId?) | Analytics por curso |
| getDailyActivityStats(days) | Actividad diaria |
| getEngagementMetrics() | Metricas de engagement |
| getTrendComparison(metric, period) | Comparacion de tendencias |
| getTopCourses(metric, limit) | Cursos mas populares |

---

## Optimizacion de Build

### Lazy Loading

Todas las paginas de dashboard se cargan con `React.lazy()`:

```typescript
const AdminDashboard = lazy(() => import('@modules/dashboard/pages/AdminDashboard'))
```

### Code Splitting (Vite)

Chunks separados en `vite.config.ts`:

```typescript
manualChunks: {
  'vendor-react': ['react', 'react-dom', 'react-router-dom'],
  'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/database'],
  'vendor-ui': ['lucide-react'],
  'vendor-utils': ['zustand', 'jspdf', 'date-fns'],
}
```

### Resultado del Build

| Chunk | Tamaño | Gzip |
|---|---|---|
| CSS | 50 KB | 8.6 KB |
| vendor-react | 99 KB | 33 KB |
| vendor-firebase | 246 KB | 73 KB |
| vendor-utils | 387 KB | 125 KB |
| index (app) | 1.4 MB | 402 KB |

---

## Deploy a Produccion

### Firebase Hosting

1. Crear proyecto en [Firebase Console](https://console.firebase.google.com)
2. Actualizar `.firebaserc` con el project ID real:
   ```json
   {
     "projects": {
       "default": "tu-proyecto-id"
     }
   }
   ```
3. Ejecutar deploy:
   ```bash
   npm run deploy
   ```

### Configuracion de Hosting (firebase.json)

```json
{
  "hosting": {
    "public": "dist",
    "rewrites": [{ "source": "**", "destination": "/index.html" }],
    "headers": [
      {
        "source": "**/*.@(js|css)",
        "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
      }
    ]
  }
}
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

---

## Historial de Sprints

### Sprint 1-2: Fundamentos
- Setup inicial del proyecto
- Autenticacion con Firebase
- CRUD basico de cursos
- Dashboards por rol

### Sprint 3: Notificaciones y Analytics
- Sistema de notificaciones en tiempo real
- Toast notifications con auto-dismiss
- NotificationCenter en header
- Servicio de analytics con datos reales
- Pagina de reportes

### Sprint 4: Gamificacion y Certificados
- Motor de gamificacion (puntos, niveles, badges, streaks)
- Pagina de verificacion publica de certificados
- Foros con posts, respuestas y likes
- Notificaciones de badges desbloqueados

### Sprint 5: Testing
- Configuracion de Vitest con jsdom
- Setup de mocks para Firebase
- 107 tests unitarios:
  - authStore (13 tests)
  - gamificationEngine (23 tests)
  - Button, Input, Card (57 tests)
  - useDashboard hooks (14 tests)

### Sprint 6: Optimizacion y Deploy
- Lazy loading para todas las paginas
- Code splitting con React.lazy
- Optimizacion de build con Vite
- Configuracion de Firebase Hosting
- Scripts de deploy

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
5. Escribir tests en el mismo directorio con extension `.test.tsx`

---

## Tareas Pendientes

### Funcionalidad
- [ ] Login social (Google, Facebook)
- [ ] Verificacion de email
- [ ] 2FA (Two-Factor Authentication)
- [ ] Chat en tiempo real (Firebase listeners)
- [ ] Notificaciones push (Firebase Cloud Messaging)
- [ ] Exportacion a Excel/CSV

### Mejoras Tecnicas
- [ ] Aumentar cobertura de tests
- [ ] Cache de datos (React Query/SWR)
- [ ] Dark mode
- [ ] Internacionalizacion (i18n)
- [ ] Accesibilidad (a11y)
- [ ] Graficos en reportes (Recharts)
- [ ] CI/CD con GitHub Actions

---

*Documento actualizado: Febrero 2026 - Sprints 1-6 completados*
