# 📚 LasaEdu - Sistema de Gestión de Aprendizaje (LMS)

## Documentación Técnica Completa

---

## 📋 Índice

1. [Resumen del Proyecto](#resumen-del-proyecto)
2. [Stack Tecnológico](#stack-tecnológico)
3. [Arquitectura del Sistema](#arquitectura-del-sistema)
4. [Estructura de Directorios](#estructura-de-directorios)
5. [Flujo de Datos](#flujo-de-datos)
6. [Módulos del Sistema](#módulos-del-sistema)
7. [Servicios y Utilidades](#servicios-y-utilidades)
8. [Estado Actual de Completitud](#estado-actual-de-completitud)
9. [Tareas Pendientes para 100%](#tareas-pendientes-para-100)
10. [Guía de Desarrollo](#guía-de-desarrollo)

---

## 🎯 Resumen del Proyecto

**LasaEdu** es una plataforma LMS (Learning Management System) completa diseñada para instituciones educativas. Permite la gestión de cursos, estudiantes, profesores, evaluaciones, certificados y más.

### Características Principales
- 👥 **4 roles de usuario**: Admin, Teacher, Student, Support
- 📖 **Gestión de cursos**: Creación, módulos, lecciones
- 📝 **Evaluaciones**: Quizzes, exámenes, tareas, proyectos
- 🏆 **Gamificación**: Puntos, insignias, rachas, leaderboard
- 💬 **Comunicación**: Chat, canales, mensajería
- 🎓 **Certificados**: Generación automática
- 📊 **Analytics**: Reportes y métricas
- 🎫 **Soporte**: Sistema de tickets

---

## 🛠 Stack Tecnológico

### Frontend
| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| React | 19.2.0 | UI Framework |
| TypeScript | 5.x | Tipado estático |
| Vite | 7.3.1 | Build tool |
| TailwindCSS | 3.x | Estilos |
| Zustand | 5.0.10 | Estado global |
| React Router | 7.12.0 | Navegación |
| React Hook Form | 7.71.0 | Formularios |
| Zod | 4.3.5 | Validación |
| Lucide React | 0.562.0 | Iconos |

### Backend/Database
| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| Firebase Realtime DB | 12.7.0 | Base de datos |
| Firebase Storage | 12.7.0 | Almacenamiento archivos |
| Firebase Emulator | Local | Desarrollo local |

### Testing
| Tecnología | Propósito |
|------------|-----------|
| Vitest | Unit testing |
| Testing Library | Component testing |
| jsdom | DOM simulation |

---

## 🏗 Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                         │
├─────────────────────────────────────────────────────────────────┤
│  Pages/Views    │    Components    │    Hooks    │    Store     │
│  ─────────────  │    ──────────    │    ─────    │    ─────     │
│  • Dashboards   │    • UI (Button) │    • useDashboard          │
│  • Courses      │    • Layout      │    • useAuth (Zustand)     │
│  • Users        │    • Forms       │    • Custom hooks          │
│  • Evaluations  │    • Cards       │                            │
├─────────────────────────────────────────────────────────────────┤
│                      SERVICE LAYER                               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    dataService.ts                         │   │
│  │  • dashboardService  • courseService  • userService      │   │
│  │  • evaluationService • gradeService   • certificateService│   │
│  │  • gamificationService • supportService • messageService │   │
│  └──────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│                    DATA ABSTRACTION LAYER                        │
│  ┌───────────────────────┐    ┌────────────────────────────┐   │
│  │  firebaseDataService  │ OR │       localDB.ts           │   │
│  │  (Firebase Realtime)  │    │    (localStorage mock)     │   │
│  └───────────────────────┘    └────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│                         DATABASE                                 │
│  Firebase Realtime Database (Emulator: localhost:9000)          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 Estructura de Directorios

```
lasaedu/
├── src/
│   ├── app/                    # Configuración core de la app
│   │   ├── config/
│   │   │   └── firebase.ts     # Configuración Firebase
│   │   ├── router/
│   │   │   └── index.tsx       # Rutas de la aplicación
│   │   └── store/
│   │       └── authStore.ts    # Estado de autenticación (Zustand)
│   │
│   ├── modules/                # Módulos funcionales
│   │   ├── analytics/          # Reportes y estadísticas
│   │   ├── auth/               # Autenticación
│   │   ├── certificates/       # Certificados
│   │   ├── communication/      # Mensajería y chat
│   │   ├── courses/            # Gestión de cursos
│   │   ├── dashboard/          # Dashboards por rol
│   │   ├── evaluations/        # Evaluaciones
│   │   ├── gamification/       # Sistema de puntos/insignias
│   │   ├── grades/             # Calificaciones
│   │   ├── progress/           # Progreso del estudiante
│   │   ├── settings/           # Configuración de usuario
│   │   ├── support/            # Sistema de tickets
│   │   └── users/              # Gestión de usuarios
│   │
│   ├── shared/                 # Recursos compartidos
│   │   ├── components/
│   │   │   ├── layout/         # Header, Sidebar, MainLayout
│   │   │   └── ui/             # Button, Card, Input, Label
│   │   ├── hooks/
│   │   │   └── useDashboard.ts # Hooks para datos del dashboard
│   │   ├── services/
│   │   │   ├── dataService.ts          # Capa de abstracción unificada
│   │   │   ├── firebaseDataService.ts  # Implementación Firebase
│   │   │   └── seedDatabase.ts         # Semilla de datos
│   │   ├── types/
│   │   │   └── index.ts        # Tipos TypeScript
│   │   └── utils/
│   │       ├── cn.ts           # Utilidad classnames
│   │       ├── localDB.ts      # Mock database (localStorage)
│   │       ├── mockData.ts     # Datos de prueba
│   │       └── storage.ts      # Utilidades de almacenamiento
│   │
│   ├── pages/
│   │   └── index.ts            # Barrel exports
│   │
│   ├── App.tsx                 # Componente raíz
│   ├── main.tsx                # Entry point
│   └── index.css               # Estilos globales (Tailwind)
│
├── public/                     # Assets estáticos
├── database.rules.json         # Reglas de seguridad Firebase
├── firebase.json               # Configuración Firebase
├── storage.rules               # Reglas de Storage
├── seed-data.mjs               # Script de semilla
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

---

## 🔄 Flujo de Datos

### 1. Autenticación
```
LoginPage → authService.login() → authStore (Zustand) → localStorage
                                          ↓
                                   ProtectedRoute
                                          ↓
                              DashboardRedirect (por rol)
```

### 2. Carga de Datos (Dashboard)
```
Dashboard Component
       ↓
useDashboard hook (useSystemStats, useRecentActivity, etc.)
       ↓
dashboardService.getSystemStats()
       ↓
firebaseDataService.getUsers(), getCourses(), etc.
       ↓
Firebase Realtime Database (Emulator)
```

### 3. CRUD de Cursos
```
CoursesPage
    ↓
courseService.getAll() / create() / update() / delete()
    ↓
firebaseDataService → ref(database, 'courses')
    ↓
Firebase Realtime Database
```

---

## 📦 Módulos del Sistema

### 1. **auth** - Autenticación
**Archivos:**
- `services/authService.ts` - Login, registro, logout
- `components/ProtectedRoute.tsx` - Guardia de rutas
- `pages/LoginPage.tsx` - Formulario de login
- `pages/RegisterPage.tsx` - Registro de usuarios
- `pages/RecoveryPage.tsx` - Recuperación de contraseña

**Estado:** ⚠️ 70% - Usa usuarios mock, no Firebase Auth real

### 2. **dashboard** - Paneles de Control
**Archivos:**
- `pages/AdminDashboard.tsx` - Vista administrador
- `pages/TeacherDashboard.tsx` - Vista profesor
- `pages/StudentDashboard.tsx` - Vista estudiante
- `pages/SupportDashboard.tsx` - Vista soporte

**Estado:** ✅ 90% - Conectado a Firebase, falta optimización

### 3. **courses** - Gestión de Cursos
**Archivos:**
- `pages/CoursesPage.tsx` - Listado y CRUD de cursos
- `pages/CourseDetailPage.tsx` - Detalle con módulos/lecciones
- `pages/CourseCatalogPage.tsx` - Catálogo público

**Estado:** ✅ 85% - CRUD funcional, falta reproductor de video

### 4. **evaluations** - Evaluaciones
**Archivos:**
- `pages/EvaluationsPage.tsx` - Listado de evaluaciones
- `pages/EvaluationBuilderPage.tsx` - Constructor de evaluaciones
- `pages/TakeEvaluationPage.tsx` - Tomar evaluación

**Estado:** ⚠️ 60% - Usa localDB, no migrado a Firebase

### 5. **grades** - Calificaciones
**Archivos:**
- `pages/GradesPage.tsx` - Libro de calificaciones

**Estado:** ⚠️ 50% - Interfaz básica, usa localDB

### 6. **certificates** - Certificados
**Archivos:**
- `pages/CertificatesPage.tsx` - Gestión de certificados

**Estado:** ⚠️ 40% - Mockup, sin generación PDF real

### 7. **communication** - Mensajería
**Archivos:**
- `pages/CommunicationPage.tsx` - Chat y canales

**Estado:** ⚠️ 50% - Usa localDB, sin WebSocket real-time

### 8. **gamification** - Gamificación
**Archivos:**
- `pages/GamificationPage.tsx` - Puntos, badges, leaderboard

**Estado:** ⚠️ 60% - Datos mock, no integrado con eventos reales

### 9. **support** - Soporte
**Archivos:**
- `pages/SupportPage.tsx` - Sistema de tickets

**Estado:** ⚠️ 55% - Usa localDB, falta migrar a Firebase

### 10. **users** - Usuarios
**Archivos:**
- `pages/UsersPage.tsx` - CRUD de usuarios (solo admin)

**Estado:** ⚠️ 50% - Usa localDB, no Firebase

### 11. **analytics** - Reportes
**Archivos:**
- `pages/ReportsPage.tsx` - Dashboard de métricas

**Estado:** ⚠️ 40% - Datos mock, sin gráficas reales

### 12. **settings** - Configuración
**Archivos:**
- `pages/SettingsPage.tsx` - Perfil y preferencias

**Estado:** ⚠️ 60% - Interfaz completa, persistencia parcial

### 13. **progress** - Progreso
**Archivos:**
- `pages/MyProgressPage.tsx` - Progreso del estudiante

**Estado:** ⚠️ 45% - Datos básicos, sin tracking detallado

---

## 🔧 Servicios y Utilidades

### dataService.ts (Capa de Abstracción)
```typescript
// Servicios disponibles:
dashboardService    // Estadísticas del sistema
userService         // CRUD usuarios
courseService       // CRUD cursos
moduleService       // CRUD módulos
lessonService       // CRUD lecciones
enrollmentService   // Inscripciones
evaluationService   // Evaluaciones
gradeService        // Calificaciones
certificateService  // Certificados
conversationService // Conversaciones
messageService      // Mensajes
notificationService // Notificaciones
supportTicketService // Tickets de soporte
activityService     // Log de actividades
gamificationService // Puntos e insignias
metricsService      // Métricas del sistema
```

### firebaseDataService.ts
- **Colecciones:** users, courses, modules, lessons, enrollments, evaluations, grades, certificates, conversations, messages, notifications, supportTickets, activities, userPoints, badges, userBadges, learningStreaks, systemMetrics
- **Métodos genéricos:** getAll, getById, create, update, delete, query, subscribe
- **Métodos específicos por entidad**

### localDB.ts (Mock para desarrollo)
- Usa localStorage como persistencia
- API compatible con Firebase
- Útil para desarrollo offline

---

## 📊 Estado Actual de Completitud

| Módulo | Firebase | UI | Funcionalidad | Total |
|--------|----------|-----|---------------|-------|
| Auth | 30% | 90% | 70% | **63%** |
| Dashboard | 95% | 95% | 90% | **93%** |
| Courses | 90% | 85% | 80% | **85%** |
| Course Detail | 90% | 80% | 75% | **82%** |
| Evaluations | 20% | 80% | 50% | **50%** |
| Grades | 20% | 70% | 40% | **43%** |
| Certificates | 30% | 70% | 30% | **43%** |
| Communication | 20% | 75% | 45% | **47%** |
| Gamification | 40% | 80% | 50% | **57%** |
| Support | 30% | 80% | 55% | **55%** |
| Users | 20% | 85% | 50% | **52%** |
| Analytics | 20% | 70% | 30% | **40%** |
| Settings | 30% | 85% | 55% | **57%** |
| Progress | 30% | 60% | 40% | **43%** |

### **Promedio General: ~58%**

---

## 🚀 Tareas Pendientes para 100%

### 🔴 CRÍTICAS (Bloquean funcionalidad)

#### 1. **Autenticación Real con Firebase Auth**
```
Archivos a modificar:
- src/modules/auth/services/authService.ts
- src/app/store/authStore.ts
- src/app/config/firebase.ts

Tareas:
□ Integrar Firebase Authentication
□ Implementar login con email/password real
□ Añadir login social (Google, Facebook)
□ Implementar refresh token real
□ Verificación de email
□ Reset de contraseña funcional
□ Bloqueo por intentos fallidos
```

#### 2. **Migrar Módulos de localDB a Firebase**
```
Módulos pendientes:
□ evaluations → evaluationService (firebaseDataService)
□ grades → gradeService
□ certificates → certificateService  
□ communication → conversationService, messageService
□ gamification → gamificationService
□ support → supportTicketService
□ users → userService
□ analytics → metricsService
□ settings → userSettingsService
```

#### 3. **Sistema de Evaluaciones Completo**
```
Archivos:
- src/modules/evaluations/pages/EvaluationBuilderPage.tsx
- src/modules/evaluations/pages/TakeEvaluationPage.tsx

Tareas:
□ Migrar a Firebase
□ Banco de preguntas
□ Diferentes tipos de preguntas (matching, ordering)
□ Timer para evaluaciones
□ Anti-trampas (cambio de pestaña, copiar/pegar)
□ Auto-calificación
□ Retroalimentación automática
□ Intentos múltiples
□ Randomización de preguntas/opciones
```

### 🟠 IMPORTANTES (Mejoran UX significativamente)

#### 4. **Sistema de Notificaciones Real-time**
```
Tareas:
□ Implementar Firebase Cloud Messaging
□ Notificaciones push en navegador
□ Centro de notificaciones en UI
□ Preferencias de notificación
□ Notificaciones por email (SendGrid/Firebase Extensions)
```

#### 5. **Reproductor de Contenido Multimedia**
```
Archivos:
- src/modules/courses/components/VideoPlayer.tsx (crear)
- src/modules/courses/components/PDFViewer.tsx (crear)

Tareas:
□ Integrar reproductor de video (Video.js, Plyr, o HLS.js)
□ Soporte para YouTube/Vimeo embeds
□ Visor de PDF integrado
□ Tracking de progreso por video
□ Bookmarks y notas
```

#### 6. **Generación de Certificados PDF**
```
Tareas:
□ Integrar biblioteca PDF (jsPDF o pdfmake)
□ Diseñar plantillas de certificado
□ QR de verificación
□ Firma digital
□ Exportación a LinkedIn
```

#### 7. **Chat en Tiempo Real**
```
Tareas:
□ Migrar a Firebase Realtime listeners
□ Indicador de "escribiendo..."
□ Lectura de mensajes
□ Notificaciones de nuevos mensajes
□ Subida de archivos/imágenes
□ Emojis
```

#### 8. **Sistema de Gamificación Activo**
```
Tareas:
□ Eventos automáticos para puntos:
  - Completar lección (+10 pts)
  - Completar módulo (+50 pts)
  - Completar curso (+200 pts)
  - Evaluación perfecta (+100 pts)
  - Racha diaria (+5 pts)
□ Desbloqueo automático de badges
□ Leaderboard real con ranking
□ Animaciones de logros
□ Compartir logros en redes
```

### 🟡 MEJORAS (Pulido y optimización)

#### 9. **Testing**
```
Tareas:
□ Unit tests para servicios (>80% coverage)
□ Integration tests para flujos principales
□ E2E tests con Playwright
□ Tests de accesibilidad
```

#### 10. **Optimización de Performance**
```
Tareas:
□ Lazy loading de módulos
□ Virtualización de listas largas
□ Caché de datos con React Query o SWR
□ Optimización de re-renders
□ Bundle splitting
□ Service Worker para offline
```

#### 11. **UI/UX Improvements**
```
Tareas:
□ Dark mode completo
□ Responsive design refinado
□ Skeleton loaders
□ Transiciones y animaciones
□ Breadcrumbs
□ Shortcuts de teclado
□ Tour de onboarding
□ Estados vacíos mejorados
```

#### 12. **Reportes y Analytics Avanzados**
```
Tareas:
□ Integrar librería de gráficos (Chart.js, Recharts)
□ Exportación a Excel/CSV
□ Reportes programados
□ Dashboards personalizables
□ Métricas de engagement
□ Predicción de abandono
```

#### 13. **Seguridad**
```
Tareas:
□ Rate limiting
□ CSRF protection
□ Input sanitization
□ Audit logging
□ Roles y permisos granulares
□ 2FA (Two-Factor Authentication)
```

#### 14. **Internacionalización (i18n)**
```
Tareas:
□ Integrar react-i18next
□ Extraer strings a archivos de traducción
□ Soporte para español e inglés
□ Selector de idioma
□ Formateo de fechas/números por locale
```

#### 15. **Accesibilidad (a11y)**
```
Tareas:
□ ARIA labels
□ Navegación por teclado
□ Alto contraste
□ Screen reader friendly
□ Focus management
```

---

## 📝 Guía de Desarrollo

### Iniciar el Proyecto

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar Firebase Emulator (requiere Java 17+)
export JAVA_HOME="/Applications/Unity/Hub/Editor/6000.2.2f1/PlaybackEngines/AndroidPlayer/OpenJDK"
firebase emulators:start --only database

# 3. Sembrar datos de prueba (en otra terminal)
node seed-data.mjs

# 4. Iniciar servidor de desarrollo
npm run dev

# 5. Abrir en navegador
open http://localhost:5173
```

### Usuarios de Prueba
| Email | Rol | Descripción |
|-------|-----|-------------|
| admin@lasaedu.com | admin | Acceso total |
| profesor@lasaedu.com | teacher | Gestión de cursos |
| estudiante@lasaedu.com | student | Vista estudiante |
| ana@lasaedu.com | student | Estudiante adicional |
| soporte@lasaedu.com | support | Atención a usuarios |

### URLs Importantes
- **App**: http://localhost:5173
- **Firebase Emulator UI**: http://127.0.0.1:4000
- **Database Emulator**: http://127.0.0.1:9000

### Agregar Nueva Funcionalidad

1. **Crear componente de página** en `src/modules/[modulo]/pages/`
2. **Agregar ruta** en `src/app/router/index.tsx`
3. **Crear servicio** (si es necesario) en `dataService.ts`
4. **Agregar al sidebar** en `src/shared/components/layout/Sidebar.tsx`
5. **Exportar** en `src/pages/index.ts`

### Convenciones de Código

```typescript
// Nombres de archivos: PascalCase para componentes
CoursesPage.tsx
CourseDetailPage.tsx

// Nombres de variables/funciones: camelCase
const courseService = { ... }
const handleSubmit = () => { ... }

// Tipos: PascalCase con prefijo DB para entidades de base de datos
interface DBCourse { ... }
interface DBUser { ... }

// Hooks: prefijo use
const useSystemStats = () => { ... }
```

---

## 🔗 Referencias

- [Firebase Documentation](https://firebase.google.com/docs)
- [React Documentation](https://react.dev)
- [Zustand Documentation](https://zustand-demo.pmnd.rs/)
- [TailwindCSS Documentation](https://tailwindcss.com/docs)
- [Vite Documentation](https://vitejs.dev/guide/)

---

## 📞 Contacto

**Proyecto:** LasaEdu LMS  
**Versión:** 0.0.0 (Alpha)  
**Última actualización:** Enero 2026

---

*Este documento se actualizará conforme avance el desarrollo del proyecto.*
