# Plan de Implementacion: Sistema de Permisos por Rol

## Resumen del Problema

Actualmente el sistema tiene brechas de seguridad y UX donde:
- Un estudiante puede ver cursos en los que NO esta inscrito
- El menu sidebar no es consistente con las rutas permitidas
- No hay validacion de "propiedad" de recursos (ej: teacher editando curso de otro)
- localStorage se usa como fallback inseguro de autenticacion

---

## FASE 1: Arreglar Menu Sidebar por Rol (Prioridad Alta)

### Objetivo
Cada rol ve SOLO los menus que le corresponden.

### Cambios en `src/shared/components/layout/Sidebar.tsx`

#### ADMIN (ve todo excepto "Mi Progreso")
```
Dashboard, Usuarios, Gestion Usuarios, Cursos, Catalogo, Inscripciones,
Evaluaciones, Calificaciones, Certificados, Gamificacion, Reportes,
Comunicacion, Foros, Notificaciones, Soporte, Configuracion
```

#### TEACHER (gestion de sus cursos y estudiantes)
```
Dashboard, Cursos, Catalogo, Inscripciones, Evaluaciones, Calificaciones,
Certificados, Reportes, Comunicacion, Foros, Notificaciones, Configuracion
```

#### STUDENT (solo lo que le compete)
```
Dashboard, Catalogo, Mis Cursos, Mi Progreso, Mis Evaluaciones,
Mis Calificaciones, Mis Certificados, Gamificacion, Comunicacion,
Foros, Soporte, Configuracion
```

#### SUPPORT (solo soporte)
```
Dashboard, Soporte, Usuarios (solo lectura), Configuracion
```

### Archivo a modificar
- `src/shared/components/layout/Sidebar.tsx`

---

## FASE 2: Filtrar Contenido por Inscripcion (Prioridad Critica)

### Objetivo
Un estudiante SOLO ve los cursos donde esta inscrito.

### Logica a implementar

#### CourseCatalogPage.tsx (Catalogo)
- Mostrar TODOS los cursos publicados (para que pueda inscribirse)
- Marcar visualmente cuales ya tiene inscritos
- ✅ Ya esta implementado correctamente

#### Nuevo: MisCoursesPage.tsx (Mis Cursos - Solo Student)
- Mostrar SOLO cursos donde `enrollments.userId === user.id`
- Mostrar progreso, ultima leccion, etc.

#### LessonViewPage.tsx
- Validar que el estudiante este inscrito en el curso antes de mostrar la leccion
- Si no esta inscrito: redirigir a catalogo con mensaje

#### TakeEvaluationPage.tsx
- Validar que el estudiante este inscrito en el curso de la evaluacion
- Validar que no haya excedido intentos permitidos

### Archivos a crear/modificar
- `src/modules/courses/pages/MyCoursesPage.tsx` (NUEVO)
- `src/modules/courses/pages/LessonViewPage.tsx` (modificar)
- `src/modules/evaluations/pages/TakeEvaluationPage.tsx` (modificar)
- `src/app/router/index.tsx` (agregar nueva ruta)

---

## FASE 3: Filtrar Datos por Rol en Cada Pagina (Prioridad Alta)

### GradesPage.tsx (Calificaciones)
| Rol | Ve |
|-----|-----|
| Admin | Todas las calificaciones de todos |
| Teacher | Calificaciones de SUS cursos |
| Student | SOLO sus propias calificaciones |

### CertificatesPage.tsx (Certificados)
| Rol | Ve |
|-----|-----|
| Admin | Todos los certificados emitidos |
| Teacher | Certificados de SUS cursos |
| Student | SOLO sus propios certificados |

### EvaluationsPage.tsx (Evaluaciones)
| Rol | Ve |
|-----|-----|
| Admin | Todas las evaluaciones |
| Teacher | Evaluaciones de SUS cursos |
| Student | Evaluaciones de cursos donde esta INSCRITO |

### CommunicationPage.tsx (Mensajeria)
| Rol | Ve |
|-----|-----|
| Admin | Todas las conversaciones |
| Teacher | Sus conversaciones con estudiantes |
| Student | Sus conversaciones |

### ForumsPage.tsx (Foros)
| Rol | Ve |
|-----|-----|
| Admin | Todos los foros |
| Teacher | Foros de SUS cursos |
| Student | Foros de cursos donde esta INSCRITO |

### SupportPage.tsx (Soporte)
| Rol | Ve |
|-----|-----|
| Admin | Todos los tickets |
| Support | Todos los tickets (para resolverlos) |
| Teacher | Sus propios tickets |
| Student | Sus propios tickets |

---

## FASE 4: Proteger Rutas con Validacion de Propiedad (Prioridad Alta)

### Crear Hook: useCanAccessCourse(courseId)
```typescript
// Retorna true si:
// - Es admin (acceso total)
// - Es teacher Y es el instructor del curso
// - Es student Y esta inscrito en el curso
```

### Crear Hook: useCanAccessEvaluation(evaluationId)
```typescript
// Retorna true si:
// - Es admin
// - Es teacher Y la evaluacion es de su curso
// - Es student Y esta inscrito en el curso de la evaluacion
```

### Crear Componente: ResourceGuard
```typescript
// Wrapper que valida acceso antes de renderizar
<ResourceGuard
  resource="course"
  resourceId={courseId}
  fallback={<Navigate to="/unauthorized" />}
>
  <LessonViewPage />
</ResourceGuard>
```

### Archivos a crear
- `src/shared/hooks/useCanAccessCourse.ts`
- `src/shared/hooks/useCanAccessEvaluation.ts`
- `src/shared/components/guards/ResourceGuard.tsx`

---

## FASE 5: Limpiar Seguridad de AuthStore (Prioridad Critica)

### Problemas actuales
1. Se usa `localStorage.getItem('userRole')` como fallback
2. DashboardRedirect lee del localStorage directamente
3. No se valida expiracion de sesion

### Solucion
1. Eliminar todo uso de `localStorage.getItem('userRole')`
2. DashboardRedirect debe usar SOLO `useAuthStore().user?.role`
3. Agregar validacion de token expirado en ProtectedRoute

### Archivos a modificar
- `src/app/store/authStore.ts`
- `src/app/router/index.tsx` (DashboardRedirect)
- `src/modules/auth/components/ProtectedRoute.tsx`

---

## FASE 6: Dashboards Especificos Mejorados

### StudentDashboard
- Mis Cursos Activos (solo inscritos)
- Proximas Evaluaciones (de mis cursos)
- Mi Progreso General
- Ultimas Calificaciones
- Insignias Recientes

### TeacherDashboard
- Mis Cursos (donde soy instructor)
- Evaluaciones Pendientes de Calificar
- Estudiantes con Bajo Rendimiento
- Ultimas Entregas

### AdminDashboard
- Metricas Globales (usuarios, cursos, inscripciones)
- Tickets de Soporte Urgentes
- Actividad Reciente del Sistema
- Accesos Rapidos a Gestion

### SupportDashboard
- Tickets Pendientes (ordenados por prioridad)
- Tickets Asignados a Mi
- Base de Conocimiento
- Metricas de Resolucion

---

## ORDEN DE IMPLEMENTACION

### Sprint 1 (Inmediato - Seguridad)
1. [ ] Limpiar localStorage en authStore
2. [ ] Arreglar DashboardRedirect
3. [ ] Actualizar Sidebar con menus correctos por rol

### Sprint 2 (Corto Plazo - Acceso a Recursos)
4. [ ] Crear MyCoursesPage para estudiantes
5. [ ] Implementar validacion de inscripcion en LessonViewPage
6. [ ] Implementar validacion de inscripcion en TakeEvaluationPage
7. [ ] Crear hooks useCanAccessCourse y useCanAccessEvaluation

### Sprint 3 (Mediano Plazo - Filtrado de Datos)
8. [ ] Filtrar GradesPage por rol
9. [ ] Filtrar CertificatesPage por rol
10. [ ] Filtrar EvaluationsPage por rol
11. [ ] Filtrar CommunicationPage por rol
12. [ ] Filtrar ForumsPage por rol
13. [ ] Filtrar SupportPage por rol

### Sprint 4 (Mejoras UX)
14. [ ] Mejorar StudentDashboard con datos reales filtrados
15. [ ] Mejorar TeacherDashboard con sus cursos
16. [ ] Agregar notificaciones de acceso denegado amigables
17. [ ] Agregar breadcrumbs contextuales

---

## RESUMEN DE ARCHIVOS A MODIFICAR

### Modificaciones Criticas
| Archivo | Cambio |
|---------|--------|
| `src/shared/components/layout/Sidebar.tsx` | Menu por rol |
| `src/app/store/authStore.ts` | Eliminar localStorage fallback |
| `src/app/router/index.tsx` | DashboardRedirect seguro |
| `src/modules/auth/components/ProtectedRoute.tsx` | Validar sesion |

### Modificaciones de Filtrado
| Archivo | Cambio |
|---------|--------|
| `src/modules/courses/pages/LessonViewPage.tsx` | Validar inscripcion |
| `src/modules/evaluations/pages/TakeEvaluationPage.tsx` | Validar inscripcion |
| `src/modules/grades/pages/GradesPage.tsx` | Filtrar por rol |
| `src/modules/certificates/pages/CertificatesPage.tsx` | Filtrar por rol |
| `src/modules/evaluations/pages/EvaluationsPage.tsx` | Filtrar por rol |
| `src/modules/communication/pages/CommunicationPage.tsx` | Filtrar por rol |
| `src/modules/forums/pages/ForumsPage.tsx` | Filtrar por rol |
| `src/modules/support/pages/SupportPage.tsx` | Filtrar por rol |

### Archivos Nuevos
| Archivo | Proposito |
|---------|-----------|
| `src/modules/courses/pages/MyCoursesPage.tsx` | Cursos del estudiante |
| `src/shared/hooks/useCanAccessCourse.ts` | Validar acceso a curso |
| `src/shared/hooks/useCanAccessEvaluation.ts` | Validar acceso a evaluacion |
| `src/shared/components/guards/ResourceGuard.tsx` | Wrapper de proteccion |

---

## ESTIMACION DE ESFUERZO

| Fase | Complejidad | Archivos | Tiempo Estimado |
|------|-------------|----------|-----------------|
| Fase 1 (Sidebar) | Baja | 1 | 30 min |
| Fase 2 (Inscripcion) | Alta | 4 | 2-3 horas |
| Fase 3 (Filtrado) | Media | 6 | 2 horas |
| Fase 4 (Guards) | Media | 3 | 1.5 horas |
| Fase 5 (Auth) | Media | 3 | 1 hora |
| Fase 6 (Dashboards) | Media | 4 | 1.5 horas |
| **TOTAL** | | **21** | **8-10 horas** |

---

---

# PARTE 2: EDITOR DE CURSOS ROBUSTO

## Estado Actual

### ContentEditor.tsx
- Editor de bloques (texto, heading, imagen, video, audio, codigo, cita)
- Subida de archivos a Firebase Storage
- Formato basico (negrita, cursiva, subrayado)
- Vista previa

### VideoPlayer.tsx
- Soporte para YouTube y Vimeo (detecta automaticamente)
- Controles personalizados
- Progreso y completado

### Problemas Actuales
1. **No permite pegar URL de YouTube** - Solo sube archivos .mp4
2. **No es editor WYSIWYG** - Es editor de bloques, no rico como Moodle
3. **No permite imagenes por URL** - Solo sube archivos locales
4. **Sin soporte para embeds** - No soporta iframes, Slides, etc.

---

## FASE 7: Mejorar ContentEditor (Videos de YouTube)

### Objetivo
Permitir agregar videos de YouTube pegando la URL directamente.

### Cambios en ContentEditor.tsx

#### Agregar Dialog para Video por URL
```typescript
// Nuevo estado
const [videoUrlInput, setVideoUrlInput] = useState('');
const [videoInputMode, setVideoInputMode] = useState<'upload' | 'url'>('url');

// Detectar tipo de video
const isYouTubeUrl = (url: string) => {
  return url.includes('youtube.com') || url.includes('youtu.be');
};

const isVimeoUrl = (url: string) => {
  return url.includes('vimeo.com');
};

// Agregar video por URL
const handleAddVideoUrl = () => {
  if (!videoUrlInput.trim()) return;

  const newBlock: ContentBlock = {
    id: generateId(),
    type: 'video',
    content: videoUrlInput,
    metadata: {
      source: isYouTubeUrl(videoUrlInput) ? 'youtube' :
              isVimeoUrl(videoUrlInput) ? 'vimeo' : 'url',
      caption: ''
    },
    order: contentBlocks.length
  };

  setContentBlocks(prev => [...prev, newBlock]);
  setVideoUrlInput('');
  setShowMediaDialog(false);
};
```

#### Modificar Dialog de Video
- Pestanas: "Subir archivo" | "URL de YouTube/Vimeo"
- Input para pegar URL
- Vista previa del video antes de agregar
- Validacion de URL

### Renderizado de Video en Vista Previa
```typescript
case 'video':
  const source = block.metadata?.source;
  if (source === 'youtube' || source === 'vimeo') {
    return (
      <VideoPlayer
        url={block.content}
        title={block.metadata?.caption}
        onProgress={() => {}}
      />
    );
  }
  // Video subido localmente
  return <video src={block.content} controls />;
```

---

## FASE 8: Editor WYSIWYG (Tipo Moodle)

### Opcion A: Integrar TipTap (Recomendado)
TipTap es un editor modular basado en ProseMirror, muy flexible.

#### Instalacion
```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-image
npm install @tiptap/extension-youtube @tiptap/extension-link
npm install @tiptap/extension-placeholder @tiptap/extension-text-align
```

#### Crear RichTextEditor.tsx
```typescript
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  onSave?: () => void;
  courseId?: string;
  lessonId?: string;
}

export default function RichTextEditor({
  content,
  onChange,
  courseId,
  lessonId
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: true }),
      Youtube.configure({
        controls: true,
        nocookie: true
      }),
      Link.configure({ openOnClick: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({
        placeholder: 'Escribe tu contenido aqui...'
      })
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    }
  });

  // Toolbar con botones para:
  // - Formato: Bold, Italic, Strike, Underline
  // - Headings: H1, H2, H3
  // - Listas: Bullet, Ordered
  // - Alineacion: Left, Center, Right
  // - Insertar: Link, Image, YouTube, Code
  // - Otros: Quote, HorizontalRule, Undo, Redo

  return (
    <div className="border rounded-lg">
      <Toolbar editor={editor} courseId={courseId} lessonId={lessonId} />
      <EditorContent editor={editor} className="prose max-w-none p-4" />
    </div>
  );
}
```

### Opcion B: Usar React-Quill (Mas Simple)
Menos flexible pero mas rapido de implementar.

```bash
npm install react-quill
```

### Decision: Usar TipTap
- Mas moderno y mantenido
- Extension nativa para YouTube
- Mejor soporte para imagenes
- Extensible

---

## FASE 9: Imagenes por URL y Subida

### Mejorar Dialog de Imagenes

#### Pestanas
1. **Subir archivo** - Actual funcionalidad
2. **Desde URL** - Pegar URL de imagen
3. **Galeria** - Imagenes ya subidas al curso

#### Validacion de URL de Imagen
```typescript
const validateImageUrl = async (url: string): Promise<boolean> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
};
```

#### Vista Previa Antes de Agregar
```typescript
const [previewUrl, setPreviewUrl] = useState('');
const [isValidImage, setIsValidImage] = useState(false);

const handleUrlChange = async (url: string) => {
  setPreviewUrl(url);
  const isValid = await validateImageUrl(url);
  setIsValidImage(isValid);
};
```

---

## FASE 10: Sincronizacion con Firebase

### Guardado Automatico (Autosave)
```typescript
// En ContentEditor o RichTextEditor
useEffect(() => {
  const timer = setTimeout(() => {
    if (hasChanges) {
      saveToFirebase();
    }
  }, 2000); // Guardar 2 segundos despues de parar de escribir

  return () => clearTimeout(timer);
}, [content]);
```

### Indicador de Estado
```typescript
const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');

// Mostrar en UI:
// - "Guardado" (verde)
// - "Guardando..." (amarillo)
// - "Error al guardar" (rojo)
```

### Estructura en Firebase para Lecciones
```json
{
  "lessons": {
    "lesson_id": {
      "id": "lesson_id",
      "moduleId": "module_id",
      "courseId": "course_id",
      "title": "Introduccion a Python",
      "description": "Aprende los basicos",
      "type": "video",
      "content": "<p>Contenido HTML...</p>",
      "videoUrl": "https://youtube.com/watch?v=xxx",
      "duration": "15 min",
      "order": 1,
      "status": "publicado",
      "settings": {
        "isRequired": true,
        "allowComments": true,
        "showProgress": true
      },
      "createdAt": 1234567890,
      "updatedAt": 1234567890
    }
  }
}
```

---

## FASE 11: Embeds Adicionales

### Tipos de Embed Soportados
1. **YouTube** - Videos
2. **Vimeo** - Videos
3. **Google Slides** - Presentaciones
4. **Google Docs** - Documentos
5. **Canva** - Disenos
6. **CodePen** - Codigo interactivo
7. **Genially** - Presentaciones interactivas

### Componente EmbedBlock
```typescript
interface EmbedBlockProps {
  url: string;
  type: 'youtube' | 'vimeo' | 'slides' | 'docs' | 'canva' | 'codepen' | 'iframe';
}

function EmbedBlock({ url, type }: EmbedBlockProps) {
  const getEmbedUrl = () => {
    switch (type) {
      case 'youtube':
        // Convertir youtube.com/watch?v=xxx a youtube.com/embed/xxx
        const videoId = extractYouTubeId(url);
        return `https://www.youtube.com/embed/${videoId}`;
      case 'vimeo':
        const vimeoId = extractVimeoId(url);
        return `https://player.vimeo.com/video/${vimeoId}`;
      // ... otros casos
      default:
        return url;
    }
  };

  return (
    <div className="aspect-video">
      <iframe
        src={getEmbedUrl()}
        className="w-full h-full rounded-lg"
        allowFullScreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
      />
    </div>
  );
}
```

---

## RESUMEN DE ARCHIVOS PARA EDITOR

### Archivos Nuevos
| Archivo | Proposito |
|---------|-----------|
| `src/shared/components/editor/RichTextEditor.tsx` | Editor WYSIWYG con TipTap |
| `src/shared/components/editor/EditorToolbar.tsx` | Barra de herramientas |
| `src/shared/components/editor/ImageDialog.tsx` | Dialog para imagenes |
| `src/shared/components/editor/VideoDialog.tsx` | Dialog para videos |
| `src/shared/components/editor/EmbedBlock.tsx` | Renderizado de embeds |

### Archivos a Modificar
| Archivo | Cambio |
|---------|--------|
| `src/modules/courses/pages/LessonBuilderPage.tsx` | Usar RichTextEditor |
| `src/modules/courses/components/ContentEditor.tsx` | Agregar modo URL para videos |
| `src/shared/components/media/VideoPlayer.tsx` | Ya soporta YouTube (OK) |

### Dependencias a Instalar
```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-image
npm install @tiptap/extension-youtube @tiptap/extension-link
npm install @tiptap/extension-placeholder @tiptap/extension-text-align
npm install @tiptap/extension-code-block-lowlight lowlight
```

---

## ORDEN DE IMPLEMENTACION ACTUALIZADO

### Sprint 1 (Seguridad - Inmediato)
1. [ ] Limpiar localStorage en authStore
2. [ ] Arreglar DashboardRedirect
3. [ ] Actualizar Sidebar con menus correctos por rol

### Sprint 2 (Acceso a Recursos)
4. [ ] Crear MyCoursesPage para estudiantes
5. [ ] Implementar validacion de inscripcion en LessonViewPage
6. [ ] Implementar validacion de inscripcion en TakeEvaluationPage
7. [ ] Crear hooks useCanAccessCourse y useCanAccessEvaluation

### Sprint 3 (Filtrado de Datos)
8. [ ] Filtrar GradesPage por rol
9. [ ] Filtrar CertificatesPage por rol
10. [ ] Filtrar EvaluationsPage por rol
11. [ ] Filtrar ForumsPage por rol

### Sprint 4 (Editor de Cursos)
12. [ ] Agregar modo URL para videos en ContentEditor
13. [ ] Instalar TipTap y crear RichTextEditor
14. [ ] Agregar dialog mejorado para imagenes
15. [ ] Implementar autosave con Firebase
16. [ ] Agregar soporte para embeds

### Sprint 5 (Mejoras UX)
17. [ ] Mejorar dashboards especificos
18. [ ] Agregar notificaciones amigables
19. [ ] Agregar indicadores de guardado

---

## ESTIMACION TOTAL

| Parte | Complejidad | Tiempo Estimado |
|-------|-------------|-----------------|
| Permisos por Rol | Media-Alta | 6-8 horas |
| Editor de Cursos | Alta | 8-10 horas |
| **TOTAL** | | **14-18 horas** |

---

---

# PARTE 3: FEATURES ADICIONALES (Alto Impacto)

## FASE 12: PWA (Progressive Web App)

### Objetivo
Permitir que la app funcione en móviles como app nativa, con instalación y notificaciones.

### Beneficios
- 76% de usuarios acceden desde móvil
- 40% mayor tasa de completado
- Instalable en home screen
- Notificaciones push

### Implementación

#### 1. Configurar Vite PWA Plugin
```bash
npm install vite-plugin-pwa -D
```

#### 2. Modificar vite.config.ts
```typescript
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'LasaEdu - Plataforma Educativa',
        short_name: 'LasaEdu',
        description: 'Sistema de gestión de aprendizaje',
        theme_color: '#4F46E5',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          }
        ]
      }
    })
  ]
});
```

#### 3. Crear iconos PWA
```
public/icons/
  icon-72x72.png
  icon-96x96.png
  icon-128x128.png
  icon-144x144.png
  icon-152x152.png
  icon-192x192.png
  icon-384x384.png
  icon-512x512.png
```

#### 4. Agregar meta tags en index.html
```html
<meta name="theme-color" content="#4F46E5" />
<link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
```

#### 5. Componente InstallPrompt
```typescript
// src/shared/components/pwa/InstallPrompt.tsx
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstall, setShowInstall] = useState(false);

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstall(true);
    });
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowInstall(false);
      }
    }
  };

  if (!showInstall) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-indigo-600 text-white p-4 rounded-lg shadow-lg">
      <p className="mb-2">Instala LasaEdu en tu dispositivo</p>
      <Button onClick={handleInstall}>Instalar</Button>
    </div>
  );
}
```

### Archivos a Crear/Modificar
| Archivo | Cambio |
|---------|--------|
| `vite.config.ts` | Agregar VitePWA plugin |
| `index.html` | Meta tags PWA |
| `public/icons/` | Iconos en varios tamaños |
| `src/shared/components/pwa/InstallPrompt.tsx` | Prompt de instalación |

---

## FASE 13: Gestión de Usuarios Empresarial (Admin)

### Objetivo
Sistema donde SOLO el admin puede crear usuarios. Sin registro público.

### Cambios Requeridos

#### 1. Desactivar Registro Público
```typescript
// src/app/router/index.tsx
// ANTES: { path: '/register', element: <RegisterPage /> }
// DESPUÉS: Quitar o redirigir a login

// O mostrar mensaje:
// "El registro está deshabilitado. Contacte al administrador."
```

#### 2. Mejorar UserManagementPage para Admin
El admin necesita poder:
- Crear usuarios con email y contraseña temporal
- Asignar rol (student, teacher, support)
- Enviar email de bienvenida con credenciales
- Activar/desactivar cuentas
- Resetear contraseñas

#### 3. Crear Usuario desde Admin
```typescript
// src/modules/users/services/userAdminService.ts
import { createUserWithEmailAndPassword } from 'firebase/auth';

export async function createUserByAdmin(data: {
  email: string;
  name: string;
  role: UserRole;
  tempPassword?: string;
}) {
  // Generar contraseña temporal si no se proporciona
  const password = data.tempPassword || generateTempPassword();

  // Crear en Firebase Auth
  const userCredential = await createUserWithEmailAndPassword(
    auth,
    data.email,
    password
  );

  // Crear en Realtime Database
  const dbUser = await firebaseDB.createUser({
    email: data.email,
    name: data.name,
    role: data.role,
    emailVerified: false,
    mustChangePassword: true, // Forzar cambio en primer login
    createdBy: 'admin',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: 'active'
  });

  // Opcional: Enviar email con credenciales
  // await sendWelcomeEmail(data.email, password);

  return { user: dbUser, tempPassword: password };
}

function generateTempPassword(): string {
  return Math.random().toString(36).slice(-8) + 'A1!';
}
```

#### 4. UI para Crear Usuario (Admin)
```typescript
// src/modules/users/components/CreateUserDialog.tsx
export default function CreateUserDialog({ onClose, onCreated }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'student' as UserRole,
    generatePassword: true,
    customPassword: ''
  });
  const [createdUser, setCreatedUser] = useState(null);
  const [showCredentials, setShowCredentials] = useState(false);

  const handleSubmit = async () => {
    const result = await createUserByAdmin({
      ...formData,
      tempPassword: formData.generatePassword ? undefined : formData.customPassword
    });

    setCreatedUser(result);
    setShowCredentials(true);
  };

  return (
    <Dialog>
      {!showCredentials ? (
        // Formulario de creación
        <form onSubmit={handleSubmit}>
          <Input label="Nombre completo" value={formData.name} ... />
          <Input label="Email" type="email" value={formData.email} ... />
          <Select label="Rol" value={formData.role}>
            <option value="student">Estudiante</option>
            <option value="teacher">Profesor</option>
            <option value="support">Soporte</option>
          </Select>
          <Checkbox
            label="Generar contraseña automática"
            checked={formData.generatePassword}
          />
          {!formData.generatePassword && (
            <Input label="Contraseña" type="password" ... />
          )}
          <Button type="submit">Crear Usuario</Button>
        </form>
      ) : (
        // Mostrar credenciales para copiar/enviar
        <div className="text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
          <h3>Usuario Creado</h3>
          <div className="bg-gray-100 p-4 rounded mt-4">
            <p><strong>Email:</strong> {createdUser.user.email}</p>
            <p><strong>Contraseña:</strong> {createdUser.tempPassword}</p>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            El usuario deberá cambiar la contraseña en su primer login.
          </p>
          <Button onClick={() => copyCredentials()}>
            Copiar Credenciales
          </Button>
        </div>
      )}
    </Dialog>
  );
}
```

#### 5. Forzar Cambio de Contraseña en Primer Login
```typescript
// src/modules/auth/pages/LoginPage.tsx
const handleLogin = async () => {
  const result = await authService.login(email, password);

  // Verificar si debe cambiar contraseña
  if (result.user.mustChangePassword) {
    navigate('/change-password', { state: { firstLogin: true } });
    return;
  }

  navigate('/dashboard');
};
```

#### 6. Página de Cambio de Contraseña
```typescript
// src/modules/auth/pages/ChangePasswordPage.tsx
export default function ChangePasswordPage() {
  const location = useLocation();
  const isFirstLogin = location.state?.firstLogin;

  return (
    <div>
      <h1>{isFirstLogin ? 'Configura tu contraseña' : 'Cambiar contraseña'}</h1>
      {isFirstLogin && (
        <p className="text-gray-600">
          Por seguridad, debes cambiar tu contraseña temporal.
        </p>
      )}
      <form>
        {!isFirstLogin && (
          <Input label="Contraseña actual" type="password" />
        )}
        <Input label="Nueva contraseña" type="password" />
        <Input label="Confirmar contraseña" type="password" />
        <Button>Guardar</Button>
      </form>
    </div>
  );
}
```

#### 7. Importación Masiva de Usuarios (CSV)
```typescript
// Para empresas con muchos usuarios
async function importUsersFromCSV(file: File) {
  const text = await file.text();
  const lines = text.split('\n');
  const results = [];

  for (const line of lines.slice(1)) { // Skip header
    const [name, email, role] = line.split(',');
    try {
      const result = await createUserByAdmin({ name, email, role });
      results.push({ email, success: true, password: result.tempPassword });
    } catch (error) {
      results.push({ email, success: false, error: error.message });
    }
  }

  // Descargar CSV con resultados y contraseñas
  downloadResultsCSV(results);
}
```

### Archivos a Crear/Modificar
| Archivo | Cambio |
|---------|--------|
| `src/modules/users/services/userAdminService.ts` | NUEVO - Servicio admin |
| `src/modules/users/components/CreateUserDialog.tsx` | NUEVO - Dialog creación |
| `src/modules/users/pages/UserManagementPage.tsx` | Mejorar con CRUD completo |
| `src/modules/auth/pages/ChangePasswordPage.tsx` | NUEVO - Cambio contraseña |
| `src/modules/auth/pages/RegisterPage.tsx` | Desactivar o quitar |
| `src/app/router/index.tsx` | Quitar ruta /register pública |
| `src/shared/types/index.ts` | Agregar mustChangePassword, status |

### Flujo de Usuario Empresarial
```
1. Admin crea usuario → Email + contraseña temporal
2. Admin comparte credenciales (email, chat, etc.)
3. Usuario hace login → Detecta mustChangePassword=true
4. Redirige a /change-password → Forzar nueva contraseña
5. Guarda nueva contraseña → mustChangePassword=false
6. Redirige a dashboard
```

---

## FASE 14: Calendario de Eventos

### Objetivo
Mostrar deadlines, clases programadas y eventos importantes.

### Funcionalidades
- Vista mensual/semanal/diaria
- Eventos de cursos (deadlines de tareas)
- Clases programadas (si hay videoconferencia)
- Recordatorios de evaluaciones
- Sincronización con Google Calendar (opcional)

### Implementación

#### 1. Instalar librería de calendario
```bash
npm install @fullcalendar/react @fullcalendar/daygrid @fullcalendar/timegrid
npm install @fullcalendar/interaction
```

#### 2. Crear tipos de eventos
```typescript
// src/shared/types/calendar.ts
export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end?: Date;
  type: 'deadline' | 'class' | 'evaluation' | 'reminder';
  courseId?: string;
  courseName?: string;
  description?: string;
  color?: string;
  url?: string;
}
```

#### 3. Crear CalendarPage
```typescript
// src/modules/calendar/pages/CalendarPage.tsx
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

export default function CalendarPage() {
  const { user } = useAuthStore();
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    loadEvents();
  }, [user]);

  const loadEvents = async () => {
    // Cargar evaluaciones pendientes
    const evaluations = await evaluationService.getByUser(user.id);

    // Cargar deadlines de tareas
    const assignments = await assignmentService.getByUser(user.id);

    // Mapear a eventos de calendario
    const calendarEvents = [
      ...evaluations.map(e => ({
        id: e.id,
        title: `📝 ${e.title}`,
        start: new Date(e.dueDate),
        type: 'evaluation',
        color: '#EF4444'
      })),
      ...assignments.map(a => ({
        id: a.id,
        title: `📚 ${a.title}`,
        start: new Date(a.dueDate),
        type: 'deadline',
        color: '#F59E0B'
      }))
    ];

    setEvents(calendarEvents);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Mi Calendario</h1>

      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay'
        }}
        events={events}
        eventClick={handleEventClick}
        locale="es"
        height="auto"
      />
    </div>
  );
}
```

#### 4. Widget de Calendario para Dashboard
```typescript
// src/shared/components/calendar/CalendarWidget.tsx
export default function CalendarWidget() {
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);

  // Mostrar próximos 5 eventos
  return (
    <Card>
      <CardHeader>
        <CardTitle>Próximos Eventos</CardTitle>
      </CardHeader>
      <CardContent>
        {upcomingEvents.map(event => (
          <div key={event.id} className="flex items-center py-2 border-b">
            <div className={`w-3 h-3 rounded-full mr-3 bg-${event.color}`} />
            <div>
              <p className="font-medium">{event.title}</p>
              <p className="text-sm text-gray-500">
                {format(event.start, 'dd MMM, HH:mm')}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

#### 5. Agregar ruta y menú
```typescript
// En router/index.tsx
{ path: '/calendar', element: <CalendarPage /> }

// En Sidebar.tsx
{ icon: Calendar, label: 'Calendario', path: '/calendar' }
```

### Estructura en Firebase
```json
{
  "events": {
    "event_id": {
      "id": "event_id",
      "title": "Entrega Proyecto Final",
      "type": "deadline",
      "courseId": "course_1",
      "startDate": 1234567890,
      "endDate": 1234567890,
      "description": "Proyecto final de Python",
      "createdBy": "teacher_1",
      "createdAt": 1234567890
    }
  }
}
```

### Archivos a Crear
| Archivo | Propósito |
|---------|-----------|
| `src/modules/calendar/pages/CalendarPage.tsx` | Página principal |
| `src/shared/components/calendar/CalendarWidget.tsx` | Widget para dashboard |
| `src/shared/types/calendar.ts` | Tipos |
| `src/shared/services/calendarService.ts` | Servicio CRUD |

---

## FASE 15: Notificaciones Push

### Objetivo
Alertas en tiempo real para eventos importantes.

### Tipos de Notificaciones
- Nueva evaluación disponible
- Deadline próximo (24h, 1h antes)
- Calificación publicada
- Mensaje nuevo
- Respuesta en foro
- Insignia desbloqueada

### Implementación

#### 1. Configurar Firebase Cloud Messaging
```bash
# En firebase.json agregar
{
  "messaging": {
    "vapidKey": "YOUR_VAPID_KEY"
  }
}
```

#### 2. Service Worker para notificaciones
```typescript
// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  // config
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification;
  self.registration.showNotification(title, {
    body,
    icon: icon || '/icons/icon-192x192.png'
  });
});
```

#### 3. Hook para notificaciones
```typescript
// src/shared/hooks/useNotifications.ts
export function useNotifications() {
  const [permission, setPermission] = useState(Notification.permission);

  const requestPermission = async () => {
    const result = await Notification.requestPermission();
    setPermission(result);

    if (result === 'granted') {
      const token = await getToken(messaging, { vapidKey: VAPID_KEY });
      // Guardar token en Firebase para el usuario
      await saveUserFCMToken(token);
    }
  };

  return { permission, requestPermission };
}
```

#### 4. Componente de solicitud de permiso
```typescript
// src/shared/components/notifications/NotificationPrompt.tsx
export default function NotificationPrompt() {
  const { permission, requestPermission } = useNotifications();

  if (permission === 'granted') return null;

  return (
    <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
      <div className="flex">
        <Bell className="h-5 w-5 text-blue-500" />
        <div className="ml-3">
          <p className="text-sm text-blue-700">
            Activa las notificaciones para no perderte deadlines importantes
          </p>
          <Button size="sm" onClick={requestPermission}>
            Activar notificaciones
          </Button>
        </div>
      </div>
    </div>
  );
}
```

---

## ORDEN DE IMPLEMENTACIÓN COMPLETO

### Sprint 1 (Seguridad - Inmediato) ⏱️ 2-3 horas
1. [ ] Limpiar localStorage en authStore
2. [ ] Arreglar DashboardRedirect
3. [ ] Actualizar Sidebar con menus correctos por rol

### Sprint 2 (Acceso a Recursos) ⏱️ 3-4 horas
4. [ ] Crear MyCoursesPage para estudiantes
5. [ ] Implementar validacion de inscripcion en LessonViewPage
6. [ ] Crear hooks useCanAccessCourse

### Sprint 3 (Editor de Cursos) ⏱️ 4-5 horas
7. [ ] Agregar modo URL para videos YouTube/Vimeo
8. [ ] Instalar TipTap y crear RichTextEditor
9. [ ] Implementar autosave

### Sprint 4 (PWA + Gestión Usuarios) ⏱️ 4-5 horas
10. [ ] Configurar Vite PWA
11. [ ] Crear iconos y manifest
12. [ ] Crear userAdminService (crear usuarios)
13. [ ] Crear CreateUserDialog
14. [ ] Implementar cambio de contraseña obligatorio
15. [ ] Desactivar registro público

### Sprint 5 (Calendario + Notificaciones) ⏱️ 4-5 horas
14. [ ] Instalar FullCalendar
15. [ ] Crear CalendarPage
16. [ ] Crear CalendarWidget
17. [ ] Configurar Firebase Cloud Messaging
18. [ ] Implementar notificaciones push

### Sprint 6 (Filtrado y UX) ⏱️ 3-4 horas
19. [ ] Filtrar páginas por rol (Grades, Certificates, etc.)
20. [ ] Mejorar dashboards específicos
21. [ ] Agregar indicadores de estado

---

## ESTIMACIÓN TOTAL ACTUALIZADA

| Parte | Tiempo Estimado |
|-------|-----------------|
| Permisos por Rol | 6-8 horas |
| Editor de Cursos | 4-5 horas |
| PWA | 2-3 horas |
| Gestión Usuarios Admin | 3-4 horas |
| Calendario | 3-4 horas |
| Notificaciones Push | 2-3 horas |
| **TOTAL** | **20-27 horas** |

---

## DEPENDENCIAS A INSTALAR

```bash
# PWA
npm install vite-plugin-pwa -D

# Calendario
npm install @fullcalendar/react @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/interaction

# Editor TipTap
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-image @tiptap/extension-youtube @tiptap/extension-link @tiptap/extension-placeholder @tiptap/extension-text-align
```

---

*Plan creado: Febrero 2026*
*Estado: Pendiente de aprobacion*
