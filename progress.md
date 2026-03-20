# Progress

Fecha: 2026-03-20

## Estado actual

- El repo esta limpio: no hay cambios sin commit (`git status --short` no devuelve nada).
- La app corre con React + Vite y usa Firebase Emulator para desarrollo local.
- La ruta para inicializar datos desde la UI existe en `/data-init`.
- El script `npm run firebase:emulator:import` apunta a `./firebase-data`, pero esa carpeta no existe ahora mismo en el repo.

## Pendientes principales

### 1. Arreglar como se ve la experiencia de estudiante en movil

Punto de entrada principal:

- `src/modules/dashboard/pages/StudentDashboard.tsx`

Archivos relacionados que probablemente haya que revisar si el problema tambien afecta layout o navegacion:

- `src/shared/components/layout/MainLayout.tsx`
- `src/shared/components/layout/Sidebar.tsx`
- `src/shared/components/layout/Header.tsx`

Si el problema reportado no es solo el dashboard, revisar tambien las pantallas que usa el estudiante:

- `src/modules/courses/pages/CourseCatalogPage.tsx`
- `src/modules/courses/pages/CourseDetailPage.tsx`
- `src/modules/progress/pages/MyProgressPage.tsx`

Notas:

- `StudentDashboard.tsx` ya usa grids responsive (`grid-cols-1`, `lg:grid-cols-*`), pero igual hay bloques con bastante contenido horizontal y tarjetas que pueden necesitar mejor espaciado/stacking en pantallas pequenas.
- El sidebar movil ya existe, asi que vale la pena validar si el problema real es del contenido o del layout general con sidebar/header.

### 2. Reimportar la base de datos

Opciones segun lo que se quiera recuperar:

#### Opcion A: importar una exportacion existente

Usar esto solo si alguien tiene una copia valida de `firebase-data/`:

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
npm run firebase:emulator:import
```

Importante:

- Ahora mismo `./firebase-data` no existe en este repo.
- Si no aparece esa carpeta, ese comando no resuelve nada por si solo.

#### Opcion B: regenerar datos desde cero

1. Levantar emuladores:

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
npm run firebase:emulator
```

2. Poblar datos de una de estas formas:

Por script:

```bash
node seed-data.mjs
```

O por UI:

- abrir `http://localhost:5173/data-init`
- dejar marcado `Borrar datos existentes antes de inicializar`
- ejecutar `Inicializar datos`

Notas utiles:

- `src/app/config/firebase.ts` solo conecta a emuladores si `VITE_USE_FIREBASE_EMULATOR=true`.
- La pagina `src/modules/auth/pages/DataInitPage.tsx` usa `dataInit()` y `dataClear()` para borrar y recrear usuarios, cursos, modulos, evaluaciones y demas datos base.

## Credenciales utiles despues de inicializar

- `admin@lasaedu.com` / `password123`
- `teacher@lasaedu.com` / `password123`
- `teacher2@lasaedu.com` / `password123`
- `student@lasaedu.com` / `password123`
- `laura@lasaedu.com` / `password123`
- `pedro@lasaedu.com` / `password123`
- `support@lasaedu.com` / `password123`

## Siguiente paso recomendado

1. Confirmar si el problema de movil es solo `StudentDashboard` o toda la experiencia del rol student.
2. Levantar emuladores y resembrar datos si hace falta probar con contenido real.
3. Probar en viewport movil con usuario `student@lasaedu.com`.
