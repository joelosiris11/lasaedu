# Guía de Integración de H5P - Pasos Siguientes

## Tarea 1: Integración con LessonBuilder

### Archivo a modificar
`src/modules/courses/pages/LessonBuilderPage.tsx`

### Cambios necesarios

1. Importar H5P components:
```typescript
import { H5PContentBank, H5PUploader } from '@modules/h5p';
```

2. En el formulario de crear/editar lección, agregar:
```typescript
{lessonType === 'h5p' && (
  <div className="mt-4">
    <label className="block text-sm font-medium mb-2">Contenido H5P</label>
    <div className="space-y-4">
      {/* Tabs: Subir vs Seleccionar */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setH5PTab('upload')}
          className={`py-2 px-4 ${h5pTab === 'upload' ? 'border-b-2 border-blue-600' : ''}`}
        >
          Subir Nuevo
        </button>
        <button
          onClick={() => setH5PTab('select')}
          className={`py-2 px-4 ${h5pTab === 'select' ? 'border-b-2 border-blue-600' : ''}`}
        >
          Seleccionar Existente
        </button>
      </div>

      {h5pTab === 'upload' ? (
        <H5PUploader
          courseId={courseId}
          userId={user!.id}
          onUploadSuccess={(contentId) => {
            // Guardar contentId en formData
          }}
        />
      ) : (
        <H5PContentBank
          courseId={courseId}
          isSelectable={true}
          onSelectContent={(content) => {
            // Guardar content.id
          }}
        />
      )}
    </div>
  </div>
)}
```

3. Actualizar formData para guardar:
```typescript
interface LessonFormData {
  // ... otros campos
  h5pContentId?: string; // Nuevo
}
```

---

## Tarea 2: Integración con LessonView

### Archivo a modificar
`src/modules/courses/pages/LessonViewPage.tsx`

### Cambios necesarios

1. Importar H5PPlayer:
```typescript
import { H5PPlayer } from '@modules/h5p';
```

2. En el renderizado de lecciones:
```typescript
{lesson.type === 'scorm' && <SCORMPlayer ... />}
{lesson.type === 'lti' && <LTIToolLauncher ... />}
{lesson.type === 'h5p' && (
  <H5PPlayer
    content={h5pContent} // Buscar del servicio
    onCompletion={(score, maxScore) => {
      // Registrar completación
      recordH5PAttempt({
        contentId: lesson.h5pContentId,
        userId: user!.id,
        score,
        maxScore
      });
    }}
  />
)}
```

3. Agregar lógica para obtener contenido H5P:
```typescript
const getH5PContent = async () => {
  if (!lesson.h5pContentId) return;
  try {
    // TODO: Implementar en H5PContentService
    const content = await h5pService.getContentById(lesson.h5pContentId);
    setH5PContent(content);
  } catch (error) {
    console.error('Error loading H5P content:', error);
  }
};
```

---

## Tarea 3: Integración con Gamificación

### Archivo a modificar
`src/shared/services/gamificationEngine.ts`

### Cambios necesarios

```typescript
// Agregar al enum POINT_ACTIONS
const POINT_ACTIONS = {
  ...existentes,
  'h5p_completed': {
    points: 50,      // Puntos base
    name: 'Completar H5P',
    icon: 'h5p'
  },
  'h5p_perfect_score': {
    points: 100,     // Bonus por puntuación perfecta
    name: 'H5P con puntuación perfecta',
    icon: 'star'
  }
} as const;

// En la función de registro de puntos:
export function awardPoints(action: KeyOf<typeof POINT_ACTIONS>, userId: string) {
  const actionConfig = POINT_ACTIONS[action];
  if (!actionConfig) return;

  // Registrar puntos
  const basePoints = actionConfig.points;
  // ... guardar en Firebase
}
```

---

## Tarea 4: Firebase Integration

### Archivo a modificar
`src/shared/services/firebaseDataService.ts`

### Agregar tipos y métodos

```typescript
// Tipos
export interface DBH5PContent extends H5PContentMeta {
  courseId: string;
  createdBy: string;
}

export interface DBH5PAttempt {
  id: string;
  contentId: string;
  userId: string;
  courseId: string;
  score: number;
  maxScore: number;
  completed: boolean;
  completedAt?: number;
  duration: number;
  startedAt: number;
}

// Métodos CRUD
export const h5pService = {
  async createContent(content: DBH5PContent) {
    const ref = database.ref(`h5pContent/${content.id}`);
    await ref.set(content);
    return content;
  },

  async getContent(contentId: string) {
    const ref = database.ref(`h5pContent/${contentId}`);
    const snapshot = await ref.once('value');
    return snapshot.val() as DBH5PContent | null;
  },

  async listByCourse(courseId: string) {
    const ref = database.ref('h5pContent');
    const query = ref.orderByChild('courseId').equalTo(courseId);
    const snapshot = await query.once('value');
    return Object.values(snapshot.val() || {}) as DBH5PContent[];
  },

  async deleteContent(contentId: string) {
    const ref = database.ref(`h5pContent/${contentId}`);
    await ref.remove();
  },

  async recordAttempt(attempt: DBH5PAttempt) {
    const ref = database.ref(`h5pAttempts/${attempt.id}`);
    await ref.set(attempt);
  },

  async getAttempts(contentId: string, userId: string) {
    const ref = database.ref('h5pAttempts');
    const query = ref.orderByChild('contentId').equalTo(contentId);
    const snapshot = await query.once('value');
    return Object.values(snapshot.val() || {})
      .filter(a => a.userId === userId) as DBH5PAttempt[];
  }
};
```

---

## Tarea 5: Completar H5PContentService

### Archivo a modificar
`src/shared/services/h5p/h5pContentService.ts`

### Métodos a agregar

```typescript
export class H5PContentService {
  // ... métodos existentes

  async getReusableContents(tags?: string[]): Promise<H5PContentMeta[]> {
    // Obtener de Firebase - contenido marcado como reutilizable
    // Filtrar por tags si es necesario
  }

  async deleteContent(contentId: string): Promise<void> {
    // Eliminar de Firebase Storage y Database
    // Eliminar registros de intentos asociados
  }

  async copyContent(
    sourceContentId: string,
    targetCourseId: string,
    newTitle?: string
  ): Promise<H5PContentMeta> {
    // Obtener contenido origen
    // Crear copia en Storage
    // Crear nuevo registro en Database
  }

  async markAsReusable(
    contentId: string,
    isReusable: boolean
  ): Promise<void> {
    // Actualizar flag isReusable en Database
  }

  async searchContent(
    query: string,
    filters?: {
      type?: H5PContentType;
      tags?: string[];
      reusableOnly?: boolean;
    }
  ): Promise<H5PContentMeta[]> {
    // Búsqueda en texto y filtros
  }
}
```

---

## Checklist de Implementación

- [ ] Integración LessonBuilder
- [ ] Integración LessonView
- [ ] Integración Gamificación
- [ ] Firebase CRUD completado
- [ ] H5PContentService métodos completados
- [ ] Tests de integración
- [ ] Manual testing (crear lección H5P → subir → visualizar)
- [ ] Verificar build: `npm run build`
- [ ] Ejecutar tests: `npm run test:run`
- [ ] Actualizar tareas-pendientes.txt (cambiar a ✔ COMPLETADO)

---

## Comandos Útiles

```bash
# Verificar tipos TypeScript
npm run build

# Ejecutar tests
npm run test:run

# Lint
npm run lint

# Desarrollo con HMR
npm run dev
```

---

## Dependencias ya disponibles

- ✅ `jszip` - Manipulación de paquetes H5P
- ✅ `h5p-standalone` - Renderización de H5P
- ✅ Firebase SDK - Almacenamiento de datos

## Estimación de tiempo

- LessonBuilder: 1-2 horas
- LessonView: 1-2 horas
- Gamificación: 1 hora
- Firebase: 2-3 horas
- H5PContentService: 2 horas
- Testing: 2 horas

**Total: 10-14 horas de desarrollo**

---

Fecha: 16 de febrero de 2026
