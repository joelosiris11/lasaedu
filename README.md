# LasaEdu - Plataforma Educativa LMS

Una plataforma educativa tipo Moodle construida con React + TypeScript + Firebase.

## 🚀 Stack Tecnológico

- **Frontend**: React 18+ con TypeScript
- **Backend**: Firebase (Realtime Database, Storage, Hosting)
- **Autenticación**: JWT personalizada con bcrypt
- **Estado Global**: Zustand
- **Routing**: React Router v6
- **UI**: Tailwind CSS + Headless UI
- **Formularios**: React Hook Form + Zod
- **Build Tool**: Vite
- **Testing**: Vitest + React Testing Library

## 📁 Estructura del Proyecto

```
src/
├── app/                    # Configuración de la aplicación
│   ├── config/            # Configuración Firebase, etc.
│   ├── router/            # Configuración de rutas
│   └── store/             # Estado global (Zustand)
├── modules/               # Módulos por dominio de negocio
│   ├── auth/              # Autenticación y autorización
│   ├── users/             # Gestión de usuarios
│   ├── courses/           # Gestión de cursos
│   ├── evaluations/       # Sistema de evaluaciones
│   ├── communication/     # Mensajería y foros
│   ├── support/           # Sistema de tickets
│   ├── gamification/      # Puntos, badges, etc.
│   └── analytics/         # Reportes y estadísticas
├── shared/                # Código compartido
│   ├── components/        # Componentes UI reutilizables
│   ├── hooks/             # Custom hooks
│   ├── utils/             # Utilidades
│   └── types/             # Tipos TypeScript
└── test/                  # Setup y utilities de testing
```

## 🎯 Roles de Usuario

- **Admin**: Control total del sistema
- **Profesor**: Gestión de cursos y evaluaciones
- **Alumno**: Acceso a cursos y evaluaciones
- **Soporte**: Gestión de tickets y ayuda

## 🛠️ Comandos de Desarrollo

### Instalación
```bash
npm install
```

### Desarrollo
```bash
npm run dev          # Servidor de desarrollo
npm run build        # Build de producción
npm run preview      # Vista previa del build
```

### Testing
```bash
npm run test         # Tests en modo watch
npm run test:run     # Ejecutar tests una vez
npm run test:ui      # UI de testing
```

### Código
```bash
npm run lint         # ESLint
```

## 🔥 Firebase Setup

1. Crear proyecto en Firebase Console
2. Habilitar Realtime Database
3. Habilitar Storage
4. Configurar variables de entorno en `.env.local`:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your_project-default-rtdb.firebaseio.com/
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef123456789
```

## 📅 Plan de Desarrollo

### ✅ Sprint 1.1 - COMPLETADO
- [x] Configuración inicial Vite + React + TypeScript
- [x] Configuración Firebase básica
- [x] Setup Tailwind CSS
- [x] Configuración testing (Vitest + RTL)
- [x] Estructura de carpetas modular
- [x] Routing básico con protección por roles
- [x] Estado global con Zustand
- [x] Types TypeScript base

### 🔄 Sprint 1.2 - PRÓXIMO
- [ ] Sistema de autenticación JWT
- [ ] Hash de passwords con bcrypt
- [ ] Componentes UI base
- [ ] Páginas Login/Registro
- [ ] Context de autenticación
- [ ] Interceptores HTTP

## 📝 Estado Actual

**Sprint 1.1 COMPLETADO** ✅

El proyecto está listo para comenzar el desarrollo del sistema de autenticación en el Sprint 1.2.

La aplicación actualmente muestra:
- Página de login placeholder
- Routing configurado por roles
- Guards de rutas funcionando
- Estado de autenticación preparado
- Testing funcional

## 🚀 Próximos Pasos

1. Implementar sistema de autenticación JWT (Sprint 1.2)
2. Crear componentes UI base
3. Implementar páginas de login y registro
4. Configurar interceptores HTTP para tokens
5. Continuar con el plan de 22 semanas según especificado
