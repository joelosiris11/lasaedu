/**
 * Data Init - Inicialización completa de datos para desarrollo/demo
 *
 * Crea 3 cursos con 7 módulos cada uno, evaluaciones, inscripciones,
 * notas aleatorias y progreso para cada estudiante.
 *
 * Uso desde consola del navegador:
 *   dataInit()           // Inicializar (sin borrar datos previos)
 *   dataInit(true)       // Borrar datos previos e inicializar
 *   dataClear()          // Solo borrar todos los datos
 */

import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { ref, set, remove } from 'firebase/database';
import { auth, database } from '@app/config/firebase';
import { firebaseDB } from './firebaseDataService';
import { ENRICHED_CONTENT } from './lessonContentData';
import type {
  DBUser,
  DBCourse,
  DBModule,
  DBLesson,
  DBEvaluation,
  DBBadge
} from './firebaseDataService';

// ============================================
// HELPERS
// ============================================

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number, decimals = 1): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const DAY = 86400000;

/** Converts markdown-style lesson content to JSON ContentBlock array for the ContentEditor */
function mdToBlocks(title: string, md: string, lessonType: string): string {
  const blocks: { id: string; type: string; content: string; metadata?: Record<string, unknown>; order: number }[] = [];
  let n = 0;
  const add = (type: string, content: string, metadata?: Record<string, unknown>) => {
    blocks.push({ id: `blk-${++n}`, type, content, ...(metadata ? { metadata } : {}), order: n - 1 });
  };

  add('heading', title, { level: 1 });

  // Remove leading H1 if present (already added as heading block)
  let text = md.replace(/^#\s+[^\n]+\n*/m, '').trim();
  if (!text) return JSON.stringify(blocks);

  // Parse into segments, keeping code blocks intact
  const segments: string[] = [];
  let cur = '';
  let inCode = false;

  for (const line of text.split('\n')) {
    if (/^```/.test(line) && !inCode) {
      if (cur.trim()) segments.push(cur.trim());
      cur = line + '\n';
      inCode = true;
    } else if (/^```/.test(line) && inCode) {
      cur += line;
      segments.push(cur);
      cur = '';
      inCode = false;
    } else if (inCode) {
      cur += line + '\n';
    } else if (line === '' && cur.trim()) {
      segments.push(cur.trim());
      cur = '';
    } else {
      cur += (cur ? '\n' : '') + line;
    }
  }
  if (cur.trim()) segments.push(cur.trim());

  for (const seg of segments) {
    if (seg.startsWith('```')) {
      const lang = seg.match(/^```(\w+)/)?.[1] || 'javascript';
      const code = seg.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
      add('code', code, { language: lang });
    } else if (seg.startsWith('## ')) {
      add('heading', seg.slice(3), { level: 2 });
    } else if (seg.startsWith('### ')) {
      add('heading', seg.slice(4), { level: 3 });
    } else if (seg.startsWith('> ')) {
      add('quote', seg.replace(/^> ?/gm, ''));
    } else {
      add('text', seg);
    }
  }

  if (lessonType === 'video') {
    add('video', `Video: ${title}`, { source: 'youtube' });
  }

  return JSON.stringify(blocks);
}

async function createAuthUser(email: string, password: string): Promise<string> {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    console.log(`   🔐 Auth creado: ${email}`);
    return cred.user.uid;
  } catch (error: any) {
    if (error.code === 'auth/email-already-in-use') {
      console.log(`   ⏭️ Auth ya existe: ${email}`);
      // Sign in to get the UID
      const cred = await signInWithEmailAndPassword(auth, email, password);
      return cred.user.uid;
    }
    throw error;
  }
}

// ============================================
// CLEAR ALL DATA
// ============================================

export async function dataClear(): Promise<void> {
  console.log('🗑️ Borrando todos los datos...');

  const collections = [
    'users', 'courses', 'modules', 'lessons',
    'enrollments', 'evaluations', 'evaluationAttempts',
    'grades', 'certificates', 'messages', 'conversations',
    'notifications', 'supportTickets', 'activities',
    'userPoints', 'badges', 'userBadges',
    'learningStreaks', 'progressActivities',
    'userSettings', 'systemMetrics',
    'forumPosts', 'forumReplies'
  ];

  for (const col of collections) {
    try {
      await remove(ref(database, col));
    } catch {
      // ignore
    }
  }

  console.log('✅ Base de datos limpiada');
}

// ============================================
// COURSE DEFINITIONS
// ============================================

const COURSES_DATA = [
  {
    title: 'Desarrollo Web Full Stack',
    description: 'Aprende a crear aplicaciones web completas desde el frontend hasta el backend. Cubre HTML, CSS, JavaScript, React, Node.js y bases de datos.',
    category: 'programacion',
    level: 'intermedio' as const,
    duration: '12 semanas',
    tags: ['web', 'react', 'nodejs', 'fullstack'],
    requirements: ['Conocimientos básicos de programación', 'Computadora con internet'],
    objectives: ['Crear aplicaciones web completas', 'Dominar React y Node.js', 'Trabajar con bases de datos', 'Desplegar aplicaciones en la nube'],
    modules: [
      {
        title: 'HTML y CSS Fundamentals',
        description: 'Estructura y estilos de páginas web',
        lessons: [
          { title: 'Estructura HTML5', type: 'texto' as const, duration: '30 min', content: '# HTML5\n\nHTML5 es el estándar actual para estructurar contenido web. En esta lección aprenderás las etiquetas semánticas principales...' },
          { title: 'CSS3 y Flexbox', type: 'video' as const, duration: '45 min', content: 'Aprende a estilizar páginas web con CSS3 moderno incluyendo Flexbox para layouts responsivos.' },
          { title: 'Responsive Design', type: 'texto' as const, duration: '35 min', content: '# Diseño Responsivo\n\nEl diseño responsivo permite que tu página se vea bien en cualquier dispositivo...' },
        ]
      },
      {
        title: 'JavaScript Moderno',
        description: 'Fundamentos de JavaScript ES6+',
        lessons: [
          { title: 'Variables y Tipos de Datos', type: 'video' as const, duration: '40 min', content: 'Variables con let y const, tipos primitivos y objetos en JavaScript moderno.' },
          { title: 'Funciones y Arrow Functions', type: 'texto' as const, duration: '35 min', content: '# Funciones en JavaScript\n\nLas arrow functions simplifican la sintaxis de funciones en JavaScript...' },
          { title: 'Promesas y Async/Await', type: 'video' as const, duration: '50 min', content: 'Manejo de operaciones asíncronas con Promesas y la sintaxis async/await.' },
        ]
      },
      {
        title: 'React Fundamentos',
        description: 'Biblioteca para interfaces de usuario',
        lessons: [
          { title: 'Componentes y JSX', type: 'video' as const, duration: '45 min', content: 'Creación de componentes funcionales con JSX en React.' },
          { title: 'Estado y Props', type: 'texto' as const, duration: '40 min', content: '# Estado y Props\n\nEl estado (state) y las propiedades (props) son los mecanismos principales para manejar datos en React...' },
          { title: 'Hooks: useState y useEffect', type: 'video' as const, duration: '55 min', content: 'Los hooks más importantes de React para manejar estado y efectos secundarios.' },
        ]
      },
      {
        title: 'React Avanzado',
        description: 'Patrones avanzados y estado global',
        lessons: [
          { title: 'Context API y Zustand', type: 'video' as const, duration: '50 min', content: 'Manejo de estado global con Context API y la librería Zustand.' },
          { title: 'React Router', type: 'texto' as const, duration: '40 min', content: '# React Router\n\nNavegación del lado del cliente con React Router v6...' },
          { title: 'Formularios con React Hook Form', type: 'video' as const, duration: '45 min', content: 'Manejo eficiente de formularios con validación usando React Hook Form y Zod.' },
        ]
      },
      {
        title: 'Node.js y Express',
        description: 'Backend con JavaScript',
        lessons: [
          { title: 'Introducción a Node.js', type: 'video' as const, duration: '40 min', content: 'Fundamentos de Node.js y el runtime de JavaScript en el servidor.' },
          { title: 'API REST con Express', type: 'texto' as const, duration: '50 min', content: '# APIs REST con Express\n\nExpress es el framework más popular para crear APIs REST con Node.js...' },
          { title: 'Middleware y Autenticación', type: 'video' as const, duration: '55 min', content: 'Middleware en Express, JWT y autenticación de usuarios.' },
        ]
      },
      {
        title: 'Bases de Datos',
        description: 'SQL y NoSQL para aplicaciones web',
        lessons: [
          { title: 'SQL con PostgreSQL', type: 'video' as const, duration: '50 min', content: 'Fundamentos de SQL, consultas, joins y diseño de esquemas con PostgreSQL.' },
          { title: 'Firebase Realtime Database', type: 'texto' as const, duration: '45 min', content: '# Firebase Realtime Database\n\nBase de datos NoSQL en tiempo real de Google Firebase...' },
          { title: 'ORM y Modelado de Datos', type: 'video' as const, duration: '40 min', content: 'Uso de ORMs como Prisma para interactuar con bases de datos de forma tipada.' },
        ]
      },
      {
        title: 'Despliegue y DevOps',
        description: 'Llevar aplicaciones a producción',
        lessons: [
          { title: 'Docker Basics', type: 'video' as const, duration: '45 min', content: 'Containerización de aplicaciones con Docker y Docker Compose.' },
          { title: 'CI/CD con GitHub Actions', type: 'texto' as const, duration: '40 min', content: '# CI/CD\n\nIntegración y despliegue continuo con GitHub Actions para automatizar el proceso de release...' },
          { title: 'Deploy en Vercel y Firebase', type: 'video' as const, duration: '35 min', content: 'Despliegue de frontend en Vercel y backend en Firebase Hosting.' },
        ]
      }
    ]
  },
  {
    title: 'Ciencia de Datos con Python',
    description: 'Domina el análisis de datos, visualización y machine learning con Python. Desde pandas hasta scikit-learn.',
    category: 'ciencia_datos',
    level: 'intermedio' as const,
    duration: '10 semanas',
    tags: ['python', 'data science', 'machine learning', 'pandas'],
    requirements: ['Python básico', 'Matemáticas básicas'],
    objectives: ['Analizar datasets reales', 'Crear visualizaciones efectivas', 'Construir modelos de ML', 'Presentar insights de datos'],
    modules: [
      {
        title: 'Python para Data Science',
        description: 'Herramientas esenciales de Python',
        lessons: [
          { title: 'Jupyter Notebooks', type: 'video' as const, duration: '30 min', content: 'Configuración y uso de Jupyter Notebooks para análisis interactivo de datos.' },
          { title: 'NumPy: Arrays y Operaciones', type: 'texto' as const, duration: '45 min', content: '# NumPy\n\nNumPy es la librería fundamental para computación numérica en Python...' },
          { title: 'Estructuras de Datos en Python', type: 'video' as const, duration: '40 min', content: 'Listas, diccionarios, sets y tuples optimizados para data science.' },
        ]
      },
      {
        title: 'Pandas y Manipulación de Datos',
        description: 'El corazón del análisis de datos',
        lessons: [
          { title: 'DataFrames y Series', type: 'video' as const, duration: '50 min', content: 'Creación y manipulación de DataFrames, la estructura principal de Pandas.' },
          { title: 'Limpieza de Datos', type: 'texto' as const, duration: '45 min', content: '# Limpieza de Datos\n\nEl 80% del trabajo en data science es limpiar datos. Aprende a manejar valores nulos, duplicados y formatos inconsistentes...' },
          { title: 'Agrupación y Pivoteo', type: 'video' as const, duration: '40 min', content: 'GroupBy, pivot tables y merge para combinar y resumir datos.' },
        ]
      },
      {
        title: 'Visualización de Datos',
        description: 'Comunicar insights visualmente',
        lessons: [
          { title: 'Matplotlib Fundamentals', type: 'video' as const, duration: '45 min', content: 'Gráficos básicos con Matplotlib: líneas, barras, scatter plots e histogramas.' },
          { title: 'Seaborn para Estadísticas', type: 'texto' as const, duration: '40 min', content: '# Seaborn\n\nSeaborn extiende Matplotlib con gráficos estadísticos elegantes...' },
          { title: 'Dashboards con Plotly', type: 'video' as const, duration: '50 min', content: 'Visualizaciones interactivas y dashboards web con Plotly y Dash.' },
        ]
      },
      {
        title: 'Estadística Aplicada',
        description: 'Fundamentos estadísticos para data science',
        lessons: [
          { title: 'Estadística Descriptiva', type: 'video' as const, duration: '45 min', content: 'Media, mediana, desviación estándar, percentiles y distribuciones.' },
          { title: 'Probabilidad y Distribuciones', type: 'texto' as const, duration: '50 min', content: '# Probabilidad\n\nConceptos fundamentales de probabilidad y distribuciones de probabilidad más comunes...' },
          { title: 'Tests de Hipótesis', type: 'video' as const, duration: '55 min', content: 'Tests t, chi-cuadrado, ANOVA y p-values para tomar decisiones basadas en datos.' },
        ]
      },
      {
        title: 'Machine Learning Supervisado',
        description: 'Modelos predictivos con scikit-learn',
        lessons: [
          { title: 'Regresión Lineal y Logística', type: 'video' as const, duration: '50 min', content: 'Modelos de regresión para predicción numérica y clasificación binaria.' },
          { title: 'Árboles de Decisión y Random Forest', type: 'texto' as const, duration: '45 min', content: '# Árboles de Decisión\n\nLos árboles de decisión son modelos intuitivos que dividen los datos según reglas...' },
          { title: 'Evaluación de Modelos', type: 'video' as const, duration: '40 min', content: 'Métricas de evaluación: accuracy, precision, recall, F1-score, AUC-ROC.' },
        ]
      },
      {
        title: 'Machine Learning No Supervisado',
        description: 'Descubrimiento de patrones',
        lessons: [
          { title: 'Clustering con K-Means', type: 'video' as const, duration: '45 min', content: 'Agrupamiento de datos con K-Means y selección del número óptimo de clusters.' },
          { title: 'Reducción de Dimensionalidad (PCA)', type: 'texto' as const, duration: '50 min', content: '# PCA\n\nEl Análisis de Componentes Principales reduce la dimensionalidad manteniendo la varianza...' },
          { title: 'Detección de Anomalías', type: 'video' as const, duration: '40 min', content: 'Técnicas para identificar outliers y datos anómalos en datasets.' },
        ]
      },
      {
        title: 'Proyecto Final: Análisis Completo',
        description: 'Aplicar todo lo aprendido en un proyecto real',
        lessons: [
          { title: 'Definición del Proyecto', type: 'texto' as const, duration: '30 min', content: '# Proyecto Final\n\nElige un dataset real y define las preguntas que quieres responder con datos...' },
          { title: 'EDA y Feature Engineering', type: 'video' as const, duration: '60 min', content: 'Análisis exploratorio de datos y creación de features para modelos de ML.' },
          { title: 'Presentación de Resultados', type: 'tarea' as const, duration: '90 min', content: 'Crea un notebook completo con análisis, visualizaciones y conclusiones.' },
        ]
      }
    ]
  },
  {
    title: 'Inglés para Profesionales de TI',
    description: 'Mejora tu inglés técnico para comunicarte efectivamente en equipos internacionales, leer documentación y participar en reuniones.',
    category: 'idiomas',
    level: 'intermedio' as const,
    duration: '8 semanas',
    tags: ['inglés', 'comunicación', 'profesional', 'IT'],
    requirements: ['Inglés básico (A2)', 'Experiencia en TI'],
    objectives: ['Leer documentación técnica en inglés', 'Participar en reuniones y stand-ups', 'Escribir emails y documentación técnica', 'Entender y dar presentaciones técnicas'],
    modules: [
      {
        title: 'Technical Vocabulary',
        description: 'Vocabulario esencial de TI en inglés',
        lessons: [
          { title: 'Programming Terms', type: 'texto' as const, duration: '30 min', content: '# Programming Vocabulary\n\nEssential programming terms: variable, function, loop, array, object, class, interface, method, parameter, return value...' },
          { title: 'Infrastructure & Cloud', type: 'video' as const, duration: '35 min', content: 'Vocabulario de infraestructura: server, deployment, container, pipeline, load balancer, CDN.' },
          { title: 'Agile & Project Management', type: 'texto' as const, duration: '30 min', content: '# Agile Vocabulary\n\nSprint, backlog, user story, acceptance criteria, standup, retrospective, velocity...' },
        ]
      },
      {
        title: 'Reading Documentation',
        description: 'Comprensión de documentación técnica',
        lessons: [
          { title: 'API Documentation', type: 'texto' as const, duration: '40 min', content: '# Reading API Docs\n\nLearn to navigate and understand API documentation: endpoints, parameters, response codes, examples...' },
          { title: 'Stack Overflow & GitHub', type: 'video' as const, duration: '35 min', content: 'Cómo leer y escribir en Stack Overflow, issues de GitHub y pull request reviews.' },
          { title: 'Technical Blogs & RFCs', type: 'texto' as const, duration: '45 min', content: '# Technical Reading\n\nEstratégias para leer blogs técnicos, RFCs y whitepapers en inglés...' },
        ]
      },
      {
        title: 'Writing Skills',
        description: 'Escritura técnica en inglés',
        lessons: [
          { title: 'Professional Emails', type: 'texto' as const, duration: '35 min', content: '# Professional Email Writing\n\nStructure: greeting, context, request/information, closing. Templates for common scenarios...' },
          { title: 'Code Reviews & Comments', type: 'video' as const, duration: '30 min', content: 'Escribir comentarios constructivos en code reviews, commits y documentación de código.' },
          { title: 'Technical Documentation', type: 'tarea' as const, duration: '50 min', content: 'Práctica: escribe un README y documentación de API en inglés para un proyecto.' },
        ]
      },
      {
        title: 'Speaking in Meetings',
        description: 'Comunicación oral en reuniones técnicas',
        lessons: [
          { title: 'Daily Standups', type: 'video' as const, duration: '30 min', content: 'Frases y estructura para reportar en standups: what I did, what I will do, blockers.' },
          { title: 'Technical Discussions', type: 'texto' as const, duration: '40 min', content: '# Technical Discussions\n\nCómo expresar opiniones técnicas: "I suggest we...", "One approach could be...", "The trade-off is..."' },
          { title: 'Presenting Solutions', type: 'video' as const, duration: '45 min', content: 'Estructura y frases para presentar soluciones técnicas ante equipos y stakeholders.' },
        ]
      },
      {
        title: 'Interview Preparation',
        description: 'Preparación para entrevistas técnicas en inglés',
        lessons: [
          { title: 'Behavioral Questions', type: 'video' as const, duration: '45 min', content: 'Método STAR para responder preguntas de comportamiento en entrevistas en inglés.' },
          { title: 'Technical Interview Patterns', type: 'texto' as const, duration: '50 min', content: '# Technical Interviews\n\nCómo explicar tu proceso de pensamiento mientras resuelves problemas de código en inglés...' },
          { title: 'System Design Discussions', type: 'video' as const, duration: '55 min', content: 'Vocabulario y estructura para discusiones de diseño de sistemas en entrevistas.' },
        ]
      },
      {
        title: 'Listening Comprehension',
        description: 'Comprensión auditiva técnica',
        lessons: [
          { title: 'Tech Podcasts & Talks', type: 'video' as const, duration: '40 min', content: 'Práctica de listening con conferencias técnicas, podcasts y tutoriales en inglés.' },
          { title: 'Accents & Speaking Styles', type: 'video' as const, duration: '35 min', content: 'Familiarización con diferentes acentos y estilos de comunicación en equipos internacionales.' },
          { title: 'Note-taking Strategies', type: 'texto' as const, duration: '30 min', content: '# Note-taking\n\nEstrategias para tomar notas efectivas durante reuniones y presentaciones en inglés...' },
        ]
      },
      {
        title: 'Real-world Practice',
        description: 'Proyecto integrador de habilidades',
        lessons: [
          { title: 'Open Source Contribution', type: 'texto' as const, duration: '45 min', content: '# Contributing to Open Source\n\nGuía para contribuir a proyectos open source en inglés: issues, PRs, discussions...' },
          { title: 'Mock Interview', type: 'tarea' as const, duration: '60 min', content: 'Simula una entrevista técnica completa en inglés, grabándote para auto-evaluación.' },
          { title: 'Technical Presentation', type: 'tarea' as const, duration: '60 min', content: 'Prepara y graba una presentación técnica de 10 minutos sobre un tema de tu elección.' },
        ]
      }
    ]
  }
];

// Questions for evaluations
function generateQuestions(courseIndex: number, moduleIndex: number): DBEvaluation['questions'] {
  const allQuestions = [
    // Course 0: Desarrollo Web
    [
      // Module questions pools
      [
        { q: '¿Cuál es la etiqueta HTML5 para contenido principal?', opts: ['<main>', '<div>', '<section>', '<article>'], ans: '<main>' },
        { q: '¿Flexbox es un modelo de layout unidimensional?', opts: ['Verdadero', 'Falso'], ans: 'Verdadero', type: 'true_false' as const },
        { q: '¿Qué propiedad CSS hace un diseño responsivo?', opts: ['media queries', 'float', 'position', 'z-index'], ans: 'media queries' },
      ],
      [
        { q: '¿Cuál es la diferencia entre let y const?', opts: ['const no se puede reasignar', 'let es global', 'const es más rápido', 'No hay diferencia'], ans: 'const no se puede reasignar' },
        { q: '¿Las arrow functions tienen su propio this?', opts: ['Verdadero', 'Falso'], ans: 'Falso', type: 'true_false' as const },
        { q: '¿Qué retorna una función async?', opts: ['Una Promise', 'Un callback', 'undefined', 'Un Observable'], ans: 'Una Promise' },
      ],
      [
        { q: '¿Qué es JSX?', opts: ['Extensión de sintaxis de JavaScript', 'Un framework', 'Un lenguaje', 'Una base de datos'], ans: 'Extensión de sintaxis de JavaScript' },
        { q: '¿useState retorna un array?', opts: ['Verdadero', 'Falso'], ans: 'Verdadero', type: 'true_false' as const },
        { q: '¿Cuándo se ejecuta useEffect sin dependencias?', opts: ['Cada render', 'Solo al montar', 'Nunca', 'Al desmontar'], ans: 'Cada render' },
      ],
      [
        { q: '¿Zustand requiere un Provider?', opts: ['No', 'Sí', 'Solo en producción', 'Depende'], ans: 'No' },
        { q: '¿React Router v6 usa element en vez de component?', opts: ['Verdadero', 'Falso'], ans: 'Verdadero', type: 'true_false' as const },
        { q: '¿Qué librería se usa para validación de formularios?', opts: ['Zod', 'Lodash', 'Axios', 'Moment'], ans: 'Zod' },
      ],
      [
        { q: '¿Node.js usa el motor V8?', opts: ['Verdadero', 'Falso'], ans: 'Verdadero', type: 'true_false' as const },
        { q: '¿Qué método HTTP se usa para crear recursos?', opts: ['POST', 'GET', 'PUT', 'DELETE'], ans: 'POST' },
        { q: '¿JWT significa?', opts: ['JSON Web Token', 'JavaScript Web Tool', 'Java Web Template', 'JSON Widget Token'], ans: 'JSON Web Token' },
      ],
      [
        { q: '¿SQL es un lenguaje declarativo?', opts: ['Verdadero', 'Falso'], ans: 'Verdadero', type: 'true_false' as const },
        { q: '¿Qué tipo de base de datos es Firebase?', opts: ['NoSQL', 'SQL', 'Grafo', 'Columnar'], ans: 'NoSQL' },
        { q: '¿Qué hace un ORM?', opts: ['Mapea objetos a tablas', 'Optimiza queries', 'Crea backups', 'Encripta datos'], ans: 'Mapea objetos a tablas' },
      ],
      [
        { q: '¿Docker empaqueta aplicaciones en contenedores?', opts: ['Verdadero', 'Falso'], ans: 'Verdadero', type: 'true_false' as const },
        { q: '¿Qué es CI/CD?', opts: ['Integración y Despliegue Continuo', 'Code Integration/Delivery', 'Continuous Input/Data', 'Cloud Infrastructure/Design'], ans: 'Integración y Despliegue Continuo' },
        { q: '¿Vercel es ideal para desplegar aplicaciones?', opts: ['Frontend', 'Backend', 'Bases de datos', 'Mobile'], ans: 'Frontend' },
      ],
    ],
    // Course 1: Ciencia de Datos
    [
      [
        { q: '¿Jupyter permite ejecutar código interactivamente?', opts: ['Verdadero', 'Falso'], ans: 'Verdadero', type: 'true_false' as const },
        { q: '¿Qué librería se usa para arrays numéricos?', opts: ['NumPy', 'Pandas', 'Matplotlib', 'Seaborn'], ans: 'NumPy' },
        { q: '¿Un diccionario en Python usa llaves {}?', opts: ['Verdadero', 'Falso'], ans: 'Verdadero', type: 'true_false' as const },
      ],
      [
        { q: '¿Cuál es la estructura principal de Pandas?', opts: ['DataFrame', 'Array', 'List', 'Dictionary'], ans: 'DataFrame' },
        { q: '¿dropna() elimina filas con valores nulos?', opts: ['Verdadero', 'Falso'], ans: 'Verdadero', type: 'true_false' as const },
        { q: '¿Qué método agrupa datos en Pandas?', opts: ['groupby()', 'sort()', 'filter()', 'merge()'], ans: 'groupby()' },
      ],
      [
        { q: '¿Matplotlib es la librería base de visualización?', opts: ['Verdadero', 'Falso'], ans: 'Verdadero', type: 'true_false' as const },
        { q: '¿Seaborn está construido sobre Matplotlib?', opts: ['Verdadero', 'Falso'], ans: 'Verdadero', type: 'true_false' as const },
        { q: '¿Plotly crea gráficos interactivos?', opts: ['Verdadero', 'Falso'], ans: 'Verdadero', type: 'true_false' as const },
      ],
      [
        { q: '¿La mediana es resistente a outliers?', opts: ['Verdadero', 'Falso'], ans: 'Verdadero', type: 'true_false' as const },
        { q: '¿Qué distribución tiene forma de campana?', opts: ['Normal', 'Uniforme', 'Poisson', 'Exponencial'], ans: 'Normal' },
        { q: '¿Un p-value < 0.05 se considera significativo?', opts: ['Verdadero', 'Falso'], ans: 'Verdadero', type: 'true_false' as const },
      ],
      [
        { q: '¿Regresión lineal predice valores continuos?', opts: ['Verdadero', 'Falso'], ans: 'Verdadero', type: 'true_false' as const },
        { q: '¿Random Forest es un ensemble de árboles?', opts: ['Verdadero', 'Falso'], ans: 'Verdadero', type: 'true_false' as const },
        { q: '¿Qué métrica se usa para clasificación?', opts: ['F1-Score', 'MSE', 'R²', 'MAE'], ans: 'F1-Score' },
      ],
      [
        { q: '¿K-Means requiere especificar K?', opts: ['Verdadero', 'Falso'], ans: 'Verdadero', type: 'true_false' as const },
        { q: '¿PCA reduce la dimensionalidad?', opts: ['Verdadero', 'Falso'], ans: 'Verdadero', type: 'true_false' as const },
        { q: '¿Qué técnica detecta datos anómalos?', opts: ['Isolation Forest', 'Random Forest', 'Gradient Boost', 'AdaBoost'], ans: 'Isolation Forest' },
      ],
      [
        { q: '¿EDA significa Exploratory Data Analysis?', opts: ['Verdadero', 'Falso'], ans: 'Verdadero', type: 'true_false' as const },
        { q: '¿Feature engineering crea nuevas variables?', opts: ['Verdadero', 'Falso'], ans: 'Verdadero', type: 'true_false' as const },
        { q: '¿Qué es lo más importante al presentar datos?', opts: ['Contar una historia', 'Usar muchos gráficos', 'Mostrar todo el código', 'Usar colores'], ans: 'Contar una historia' },
      ],
    ],
    // Course 2: Inglés para TI
    [
      [
        { q: '¿"Bug" en programación significa error?', opts: ['Verdadero', 'Falso'], ans: 'Verdadero', type: 'true_false' as const },
        { q: '¿Qué significa "deploy"?', opts: ['Desplegar', 'Destruir', 'Diseñar', 'Depurar'], ans: 'Desplegar' },
        { q: '¿"Sprint" es un período de trabajo en Agile?', opts: ['Verdadero', 'Falso'], ans: 'Verdadero', type: 'true_false' as const },
      ],
      [
        { q: '¿"Endpoint" en una API es una URL de acceso?', opts: ['Verdadero', 'Falso'], ans: 'Verdadero', type: 'true_false' as const },
        { q: '¿Qué significa "PR" en GitHub?', opts: ['Pull Request', 'Program Run', 'Project Review', 'Push Release'], ans: 'Pull Request' },
        { q: '¿"RFC" significa Request for Comments?', opts: ['Verdadero', 'Falso'], ans: 'Verdadero', type: 'true_false' as const },
      ],
      [
        { q: '¿Cuál es el cierre correcto de un email formal?', opts: ['Best regards', 'See ya', 'Bye', 'XOXO'], ans: 'Best regards' },
        { q: '¿En code reviews se deben dar sugerencias constructivas?', opts: ['Verdadero', 'Falso'], ans: 'Verdadero', type: 'true_false' as const },
        { q: '¿README es documentación del proyecto?', opts: ['Verdadero', 'Falso'], ans: 'Verdadero', type: 'true_false' as const },
      ],
      [
        { q: '¿Qué se reporta en un standup?', opts: ['Lo que hice, haré y bloqueos', 'Solo problemas', 'Código escrito', 'Horas trabajadas'], ans: 'Lo que hice, haré y bloqueos' },
        { q: '¿"Trade-off" significa compromiso entre opciones?', opts: ['Verdadero', 'Falso'], ans: 'Verdadero', type: 'true_false' as const },
        { q: '¿"I suggest we..." es una frase para proponer?', opts: ['Verdadero', 'Falso'], ans: 'Verdadero', type: 'true_false' as const },
      ],
      [
        { q: '¿STAR significa Situation, Task, Action, Result?', opts: ['Verdadero', 'Falso'], ans: 'Verdadero', type: 'true_false' as const },
        { q: '¿En entrevistas técnicas debes explicar tu razonamiento?', opts: ['Verdadero', 'Falso'], ans: 'Verdadero', type: 'true_false' as const },
        { q: '¿"Scalability" se refiere a escalabilidad?', opts: ['Verdadero', 'Falso'], ans: 'Verdadero', type: 'true_false' as const },
      ],
      [
        { q: '¿Escuchar podcasts mejora la comprensión auditiva?', opts: ['Verdadero', 'Falso'], ans: 'Verdadero', type: 'true_false' as const },
        { q: '¿Todos los hablantes de inglés tienen el mismo acento?', opts: ['Verdadero', 'Falso'], ans: 'Falso', type: 'true_false' as const },
        { q: '¿Tomar notas ayuda a retener información?', opts: ['Verdadero', 'Falso'], ans: 'Verdadero', type: 'true_false' as const },
      ],
      [
        { q: '¿Contribuir a open source mejora el inglés técnico?', opts: ['Verdadero', 'Falso'], ans: 'Verdadero', type: 'true_false' as const },
        { q: '¿Una presentación técnica debe tener estructura clara?', opts: ['Verdadero', 'Falso'], ans: 'Verdadero', type: 'true_false' as const },
        { q: '¿Practicar regularmente es clave para mejorar?', opts: ['Verdadero', 'Falso'], ans: 'Verdadero', type: 'true_false' as const },
      ],
    ],
  ];

  const pool = allQuestions[courseIndex]?.[moduleIndex] || allQuestions[0][0];
  return pool.map((q, i) => ({
    id: `q${i + 1}`,
    type: (q as any).type || 'multiple_choice',
    question: q.q,
    options: q.opts,
    correctAnswer: q.ans,
    points: 10,
    explanation: `La respuesta correcta es: ${q.ans}`
  }));
}

// ============================================
// MAIN INIT FUNCTION
// ============================================

export async function dataInit(clearFirst = false): Promise<void> {
  const startTime = Date.now();
  console.log('🚀 Iniciando Data Init...');

  if (clearFirst) {
    await dataClear();
  }

  const PASSWORD = 'password123';
  const now = Date.now();

  // =============================================
  // 1. USUARIOS
  // =============================================
  console.log('\n👥 Creando usuarios...');

  const usersData: Omit<DBUser, 'id'>[] = [
    {
      email: 'admin@lasaedu.com', name: 'Administrador', role: 'admin',
      emailVerified: true, loginAttempts: 0,
      profile: { avatar: '', bio: 'Administrador del sistema LasaEdu', phone: '+18091234567', location: 'Santo Domingo' },
      preferences: { language: 'es', timezone: 'America/Santo_Domingo', notifications: { email: true, push: true, sms: false, marketing: false }, privacy: { showProfile: true, showProgress: true, showBadges: true } },
      createdAt: now - 60 * DAY, updatedAt: now, lastActive: now
    },
    {
      email: 'teacher@lasaedu.com', name: 'Prof. María García', role: 'teacher',
      emailVerified: true, loginAttempts: 0,
      profile: { avatar: '', bio: 'Profesora de programación y ciencia de datos con 10 años de experiencia', phone: '+18091234568', location: 'Santiago' },
      preferences: { language: 'es', timezone: 'America/Santo_Domingo', notifications: { email: true, push: true, sms: false, marketing: true }, privacy: { showProfile: true, showProgress: true, showBadges: true } },
      createdAt: now - 55 * DAY, updatedAt: now, lastActive: now
    },
    {
      email: 'teacher2@lasaedu.com', name: 'Prof. Carlos Martínez', role: 'teacher',
      emailVerified: true, loginAttempts: 0,
      profile: { avatar: '', bio: 'Profesor de idiomas con certificación TOEFL y 8 años enseñando inglés técnico', phone: '+18091234573', location: 'Santo Domingo' },
      preferences: { language: 'es', timezone: 'America/Santo_Domingo', notifications: { email: true, push: true, sms: false, marketing: false }, privacy: { showProfile: true, showProgress: true, showBadges: true } },
      createdAt: now - 50 * DAY, updatedAt: now, lastActive: now
    },
    {
      email: 'student@lasaedu.com', name: 'Carlos Rodríguez', role: 'student',
      emailVerified: true, loginAttempts: 0,
      profile: { avatar: '', bio: 'Estudiante de ingeniería de software', phone: '+18091234569', location: 'Santo Domingo' },
      preferences: { language: 'es', timezone: 'America/Santo_Domingo', notifications: { email: true, push: true, sms: false, marketing: false }, privacy: { showProfile: true, showProgress: true, showBadges: true } },
      createdAt: now - 45 * DAY, updatedAt: now, lastActive: now - 1 * DAY
    },
    {
      email: 'laura@lasaedu.com', name: 'Laura Mendoza', role: 'student',
      emailVerified: true, loginAttempts: 0,
      profile: { avatar: '', bio: 'Diseñadora gráfica aprendiendo desarrollo web', phone: '+18091234571', location: 'Santiago' },
      preferences: { language: 'es', timezone: 'America/Santo_Domingo', notifications: { email: true, push: false, sms: false, marketing: true }, privacy: { showProfile: true, showProgress: true, showBadges: true } },
      createdAt: now - 40 * DAY, updatedAt: now, lastActive: now - 2 * DAY
    },
    {
      email: 'pedro@lasaedu.com', name: 'Pedro Sánchez', role: 'student',
      emailVerified: true, loginAttempts: 0,
      profile: { avatar: '', bio: 'Analista de datos en formación', phone: '+18091234572', location: 'Santo Domingo' },
      preferences: { language: 'es', timezone: 'America/Santo_Domingo', notifications: { email: true, push: true, sms: false, marketing: false }, privacy: { showProfile: true, showProgress: true, showBadges: true } },
      createdAt: now - 35 * DAY, updatedAt: now, lastActive: now - 3 * DAY
    },
    {
      email: 'support@lasaedu.com', name: 'Ana Soporte', role: 'support',
      emailVerified: true, loginAttempts: 0,
      profile: { avatar: '', bio: 'Agente de soporte técnico', phone: '+18091234570', location: 'Santo Domingo' },
      preferences: { language: 'es', timezone: 'America/Santo_Domingo', notifications: { email: true, push: true, sms: true, marketing: false }, privacy: { showProfile: false, showProgress: false, showBadges: false } },
      createdAt: now - 58 * DAY, updatedAt: now, lastActive: now
    }
  ];

  const createdUsers: (DBUser)[] = [];
  for (const u of usersData) {
    const uid = await createAuthUser(u.email, PASSWORD);
    // Store user with Auth UID as key so login can find them by UID directly
    const userData = { ...u, id: uid };
    await set(ref(database, `users/${uid}`), userData);
    createdUsers.push(userData as DBUser);
    console.log(`   ✅ ${userData.role}: ${userData.name} (${userData.email})`);
  }

  const teacher1 = createdUsers.find(u => u.email === 'teacher@lasaedu.com')!;
  const teacher2 = createdUsers.find(u => u.email === 'teacher2@lasaedu.com')!;
  const students = createdUsers.filter(u => u.role === 'student');
  const supportUser = createdUsers.find(u => u.role === 'support')!;

  // =============================================
  // 2. CURSOS (3 cursos, teacher1 maneja 2)
  // =============================================
  console.log('\n📚 Creando cursos...');

  const instructors = [
    { id: teacher1.id, name: teacher1.name },  // Curso 0: Desarrollo Web
    { id: teacher1.id, name: teacher1.name },  // Curso 1: Ciencia de Datos
    { id: teacher2.id, name: teacher2.name },  // Curso 2: Inglés (otro teacher)
  ];

  const createdCourses: DBCourse[] = [];
  const allModules: { courseIdx: number; module: DBModule; lessons: DBLesson[] }[] = [];

  for (let ci = 0; ci < COURSES_DATA.length; ci++) {
    const cd = COURSES_DATA[ci];
    const inst = instructors[ci];

    const course = await firebaseDB.createCourse({
      title: cd.title,
      description: cd.description,
      instructor: inst.name,
      instructorId: inst.id,
      category: cd.category,
      level: cd.level,
      duration: cd.duration,
      status: 'publicado',
      rating: randFloat(4.2, 4.9),
      studentsCount: students.length,
      tags: cd.tags,
      requirements: cd.requirements,
      objectives: cd.objectives,
      createdAt: now - (50 - ci * 5) * DAY,
      updatedAt: now
    });
    createdCourses.push(course);
    console.log(`   ✅ Curso: ${course.title} (${inst.name})`);

    // Modules and lessons
    for (let mi = 0; mi < cd.modules.length; mi++) {
      const md = cd.modules[mi];
      const mod = await firebaseDB.createModule({
        courseId: course.id,
        title: md.title,
        description: md.description,
        order: mi + 1,
        duration: `${md.lessons.reduce((acc, l) => acc + parseInt(l.duration), 0)} min`,
        status: 'publicado',
        createdAt: now - (48 - ci * 5) * DAY,
        updatedAt: now
      });

      const createdLessons: DBLesson[] = [];
      for (let li = 0; li < md.lessons.length; li++) {
        const ld = md.lessons[li];
        const lesson = await firebaseDB.createLesson({
          moduleId: mod.id,
          courseId: course.id,
          title: ld.title,
          description: ld.content.replace(/^#[^\n]*\n+/, '').split(/\n\n/)[0].substring(0, 120),
          type: ld.type,
          content: mdToBlocks(ld.title, ENRICHED_CONTENT[ld.title] || ld.content, ld.type),
          ...(ld.type === 'video' ? { videoUrl: `https://example.com/videos/${course.id}/${mod.id}/${li + 1}` } : {}),
          duration: ld.duration,
          order: li + 1,
          status: 'publicado',
          createdAt: now - (47 - ci * 5) * DAY,
          updatedAt: now
        });
        createdLessons.push(lesson);
      }
      allModules.push({ courseIdx: ci, module: mod, lessons: createdLessons });
      console.log(`      📦 Módulo ${mi + 1}: ${mod.title} (${createdLessons.length} lecciones)`);
    }
  }

  // =============================================
  // 3. EVALUACIONES (1 por módulo)
  // =============================================
  console.log('\n📝 Creando evaluaciones...');

  const createdEvals: { courseIdx: number; moduleId: string; eval: DBEvaluation }[] = [];

  for (const { courseIdx, module: mod } of allModules) {
    const course = createdCourses[courseIdx];
    const questions = generateQuestions(courseIdx, allModules.filter(m => m.courseIdx === courseIdx).indexOf(
      allModules.find(m => m.module.id === mod.id)!
    ));

    const evaluation = await firebaseDB.createEvaluation({
      courseId: course.id,
      moduleId: mod.id,
      title: `Quiz: ${mod.title}`,
      description: `Evaluación del módulo ${mod.title}`,
      type: 'quiz',
      questions,
      settings: {
        timeLimit: 15,
        attempts: 3,
        passingScore: 60,
        shuffleQuestions: true,
        shuffleOptions: true,
        showResults: true,
        showCorrectAnswers: true
      },
      status: 'publicado',
      createdBy: instructors[courseIdx].id,
      createdAt: now - (45 - courseIdx * 5) * DAY,
      updatedAt: now
    });
    createdEvals.push({ courseIdx, moduleId: mod.id, eval: evaluation });
  }
  console.log(`   ✅ ${createdEvals.length} evaluaciones creadas`);

  // =============================================
  // 4. INSCRIPCIONES + PROGRESO + NOTAS
  // =============================================
  console.log('\n🎓 Creando inscripciones, progreso y notas...');

  for (const student of students) {
    for (let ci = 0; ci < createdCourses.length; ci++) {
      const course = createdCourses[ci];
      const courseModules = allModules.filter(m => m.courseIdx === ci);
      const totalLessons = courseModules.reduce((acc, m) => acc + m.lessons.length, 0);

      // Random progress: between 20% and 100%
      const progressPct = rand(20, 100);
      const completedLessonCount = Math.floor((progressPct / 100) * totalLessons);
      const completedModuleCount = Math.floor((progressPct / 100) * courseModules.length);

      // Build completed lessons list
      const allLessonsFlat = courseModules.flatMap(m => m.lessons);
      const completedLessons = allLessonsFlat.slice(0, completedLessonCount).map(l => l.id);
      const completedModules = courseModules.slice(0, completedModuleCount).map(m => m.module.id);

      const enrollDaysAgo = rand(20, 40);
      const isCompleted = progressPct === 100;

      await firebaseDB.createEnrollment({
        courseId: course.id,
        userId: student.id,
        enrolledAt: new Date(now - enrollDaysAgo * DAY).toISOString(),
        progress: progressPct,
        status: isCompleted ? 'completed' : 'active',
        completedLessons,
        completedModules,
        totalTimeSpent: rand(60, 600), // minutes
        lastAccessedAt: new Date(now - rand(0, 5) * DAY).toISOString(),
        ...(isCompleted ? { grade: rand(70, 98) } : {}),
        createdAt: now - enrollDaysAgo * DAY,
        updatedAt: now
      });

      console.log(`   📋 ${student.name} → ${course.title}: ${progressPct}%`);

      // Create evaluation attempts and grades for completed modules
      const courseEvals = createdEvals.filter(e => e.courseIdx === ci);

      for (let ei = 0; ei < courseEvals.length; ei++) {
        const { eval: evaluation, moduleId: _moduleId } = courseEvals[ei];

        // Only create attempts for modules the student has reached
        if (ei >= completedModuleCount + 1) continue;

        const score = rand(4, 10) * evaluation.questions.length; // per question max 10
        const maxScore = evaluation.questions.length * 10;
        const percentage = Math.round((score / maxScore) * 100);
        const passed = percentage >= 60;
        const attemptDaysAgo = enrollDaysAgo - rand(1, enrollDaysAgo - 1);

        // Evaluation attempt
        await firebaseDB.create('evaluationAttempts', {
          evaluationId: evaluation.id,
          userId: student.id,
          courseId: course.id,
          answers: evaluation.questions.map((q, _qi) => {
            const isCorrect = Math.random() < (percentage / 100);
            return {
              questionId: q.id,
              answer: isCorrect ? q.correctAnswer : (q.options?.[0] || ''),
              isCorrect,
              pointsEarned: isCorrect ? q.points : 0
            };
          }),
          score,
          maxScore,
          percentage,
          passed,
          timeSpent: rand(180, 900), // seconds
          startedAt: new Date(now - attemptDaysAgo * DAY).toISOString(),
          completedAt: new Date(now - attemptDaysAgo * DAY + rand(300, 900) * 1000).toISOString(),
          status: 'completed',
          createdAt: now - attemptDaysAgo * DAY,
          updatedAt: now - attemptDaysAgo * DAY
        });

        // Grade
        await firebaseDB.createGrade({
          courseId: course.id,
          evaluationId: evaluation.id,
          studentId: student.id,
          teacherId: instructors[ci].id,
          type: 'evaluation',
          score,
          maxScore,
          percentage,
          weight: 1,
          feedback: percentage >= 90 ? 'Excelente trabajo' :
                    percentage >= 70 ? 'Buen desempeño' :
                    percentage >= 60 ? 'Aprobado, pero puedes mejorar' :
                    'Necesitas repasar el material',
          status: 'graded',
          createdAt: now - attemptDaysAgo * DAY,
          updatedAt: now - attemptDaysAgo * DAY
        });
      }
    }
  }

  // =============================================
  // 5. INSIGNIAS
  // =============================================
  console.log('\n🏆 Creando insignias...');

  const badges: Omit<DBBadge, 'id'>[] = [
    { name: 'Primer Paso', description: 'Completar tu primera lección', icon: '🎯', category: 'course', criteria: { type: 'lessons_completed', value: 1, description: 'Completar 1 lección' }, points: 10, rarity: 'common', isActive: true, createdAt: now },
    { name: 'Estudiante Dedicado', description: 'Completar 5 cursos', icon: '📚', category: 'course', criteria: { type: 'courses_completed', value: 5, description: 'Completar 5 cursos' }, points: 150, rarity: 'rare', isActive: true, createdAt: now },
    { name: 'Perfeccionista', description: 'Obtener 100% en una evaluación', icon: '💯', category: 'achievement', criteria: { type: 'perfect_score', value: 1, description: '100% en evaluación' }, points: 100, rarity: 'epic', isActive: true, createdAt: now },
    { name: 'Constante', description: 'Mantener una racha de 7 días', icon: '🔥', category: 'streak', criteria: { type: 'streak_days', value: 7, description: 'Racha de 7 días' }, points: 70, rarity: 'rare', isActive: true, createdAt: now },
    { name: 'Imparable', description: 'Mantener una racha de 30 días', icon: '⚡', category: 'streak', criteria: { type: 'streak_days', value: 30, description: 'Racha de 30 días' }, points: 300, rarity: 'legendary', isActive: true, createdAt: now },
    { name: 'Maestro del Quiz', description: 'Completar 20 quizzes', icon: '🧠', category: 'achievement', criteria: { type: 'quizzes_completed', value: 20, description: 'Completar 20 quizzes' }, points: 200, rarity: 'epic', isActive: true, createdAt: now },
  ];

  for (const badge of badges) {
    await firebaseDB.create('badges', badge);
  }
  console.log(`   ✅ ${badges.length} insignias creadas`);

  // =============================================
  // 6. PUNTOS Y GAMIFICACIÓN
  // =============================================
  console.log('\n🎮 Creando puntos y gamificación...');

  const levels = [
    { min: 0, name: 'Novato' },
    { min: 100, name: 'Aprendiz' },
    { min: 300, name: 'Estudiante' },
    { min: 600, name: 'Aplicado' },
    { min: 1000, name: 'Experto' },
  ];

  for (const student of students) {
    const pts = rand(100, 800);
    const lvl = levels.filter(l => l.min <= pts).pop()!;
    const lvlIdx = levels.indexOf(lvl);
    const nextLvl = levels[lvlIdx + 1] || { min: 1500 };

    await firebaseDB.create('userPoints', {
      userId: student.id,
      totalPoints: pts,
      level: lvlIdx + 1,
      levelName: lvl.name,
      nextLevelPoints: nextLvl.min,
      history: [
        { id: 'h1', action: 'enrollment', points: 50, description: 'Inscripción en curso', timestamp: new Date(now - 30 * DAY).toISOString() },
        { id: 'h2', action: 'lesson_complete', points: rand(25, 100), description: 'Lecciones completadas', timestamp: new Date(now - 15 * DAY).toISOString() },
        { id: 'h3', action: 'quiz_pass', points: rand(30, 80), description: 'Quizzes aprobados', timestamp: new Date(now - 7 * DAY).toISOString() },
      ],
      createdAt: now - 30 * DAY,
      updatedAt: now
    });

    // Learning streaks
    const streak = rand(1, 14);
    await firebaseDB.create('learningStreaks', {
      userId: student.id,
      currentStreak: streak,
      longestStreak: rand(streak, 21),
      lastActiveDate: new Date().toISOString().split('T')[0],
      weeklyActivity: Array.from({ length: 7 }, () => rand(0, 5)),
      monthlyActivity: {},
      createdAt: now - 30 * DAY,
      updatedAt: now
    });

    // Award first badge to all students
    await firebaseDB.create('userBadges', {
      userId: student.id,
      badgeId: 'first_step',
      earnedAt: new Date(now - 25 * DAY).toISOString(),
      notified: true,
      createdAt: now - 25 * DAY
    });

    console.log(`   ✅ ${student.name}: ${pts} pts, nivel ${lvlIdx + 1} (${lvl.name}), racha ${streak}`);
  }

  // =============================================
  // 7. ACTIVIDADES RECIENTES
  // =============================================
  console.log('\n📊 Creando actividades...');

  const activityTypes: DBActivity['type'][] = ['login', 'lesson_complete', 'evaluation_submit', 'course_view'];
  for (const student of students) {
    for (let i = 0; i < 8; i++) {
      const type = pick(activityTypes);
      const daysAgo = rand(0, 14);
      await firebaseDB.create('activities', {
        userId: student.id,
        userName: student.name,
        type,
        action: type,
        description: type === 'login' ? 'Inicio de sesión' :
                     type === 'lesson_complete' ? `Completó lección en ${pick(createdCourses).title}` :
                     type === 'evaluation_submit' ? `Envió evaluación en ${pick(createdCourses).title}` :
                     `Visitó curso ${pick(createdCourses).title}`,
        timestamp: now - daysAgo * DAY - rand(0, DAY),
        createdAt: now - daysAgo * DAY
      });
    }
  }
  console.log(`   ✅ ${students.length * 8} actividades creadas`);

  // =============================================
  // 8. NOTIFICACIONES
  // =============================================
  console.log('\n🔔 Creando notificaciones...');

  for (const student of students) {
    await firebaseDB.createNotification({
      userId: student.id,
      type: 'grade',
      title: 'Nueva calificación',
      message: `Has recibido una calificación en ${pick(createdCourses).title}`,
      link: '/grades',
      read: Math.random() > 0.5,
      createdAt: now - rand(1, 7) * DAY
    });
    await firebaseDB.createNotification({
      userId: student.id,
      type: 'course',
      title: 'Nuevo contenido disponible',
      message: `Se ha publicado nuevo material en ${pick(createdCourses).title}`,
      link: '/courses',
      read: Math.random() > 0.3,
      createdAt: now - rand(1, 5) * DAY
    });
  }
  console.log(`   ✅ ${students.length * 2} notificaciones creadas`);

  // =============================================
  // 9. CONVERSACIONES Y MENSAJES
  // =============================================
  console.log('\n💬 Creando conversaciones...');

  const conv = await firebaseDB.create('conversations', {
    type: 'direct',
    participants: [students[0].id, teacher1.id],
    lastMessage: { content: 'Gracias profesora, me quedó claro', senderId: students[0].id, timestamp: now },
    createdAt: now - 5 * DAY,
    updatedAt: now
  });

  const messages = [
    { senderId: students[0].id, senderName: students[0].name, content: 'Hola profesora, tengo una duda sobre React hooks' },
    { senderId: teacher1.id, senderName: teacher1.name, content: 'Claro Carlos, ¿cuál es tu duda?' },
    { senderId: students[0].id, senderName: students[0].name, content: '¿Cuándo debo usar useEffect vs useMemo?' },
    { senderId: teacher1.id, senderName: teacher1.name, content: 'useEffect es para efectos secundarios (API calls, suscripciones). useMemo es para memorizar cálculos costosos y evitar re-renders innecesarios.' },
    { senderId: students[0].id, senderName: students[0].name, content: 'Gracias profesora, me quedó claro' },
  ];

  for (let i = 0; i < messages.length; i++) {
    await firebaseDB.create('messages', {
      conversationId: conv.id,
      ...messages[i],
      type: 'text',
      readBy: [messages[i].senderId],
      edited: false,
      createdAt: now - 5 * DAY + i * 600000,
      updatedAt: now - 5 * DAY + i * 600000
    });
  }
  console.log('   ✅ Conversación de ejemplo creada');

  // =============================================
  // 10. FORO (estilo Moodle - múltiples posts y respuestas)
  // =============================================
  console.log('\n💭 Creando foro de discusión...');

  let forumPostCount = 0;
  let forumReplyCount = 0;

  // Helper to create a post with replies
  async function createForumThread(
    courseIdx: number,
    authorIdx: number,
    authorType: 'student' | 'teacher',
    data: {
      title: string; content: string; isPinned?: boolean; isResolved?: boolean;
      tags: string[]; daysAgo: number; views: number; likesCount: number;
      likedBy: string[];
    },
    replies: {
      authorIdx: number; authorType: 'student' | 'teacher'; content: string;
      isAnswer?: boolean; daysAgo: number; likesCount: number; likedBy: string[];
      parentReplyId?: string;
    }[]
  ) {
    const course = createdCourses[courseIdx];
    const author = authorType === 'teacher'
      ? (authorIdx === 0 ? teacher1 : teacher2)
      : students[authorIdx];

    const post = await firebaseDB.create('forumPosts', {
      courseId: course.id,
      courseName: course.title,
      authorId: author.id,
      authorName: author.name,
      authorRole: authorType,
      title: data.title,
      content: data.content,
      isPinned: data.isPinned || false,
      isResolved: data.isResolved || false,
      likesCount: data.likesCount,
      likedBy: data.likedBy,
      repliesCount: replies.length,
      views: data.views,
      tags: data.tags,
      createdAt: now - data.daysAgo * DAY,
      updatedAt: now - (data.daysAgo - 1) * DAY
    });
    forumPostCount++;

    const createdReplies: string[] = [];
    for (const reply of replies) {
      const rAuthor = reply.authorType === 'teacher'
        ? (reply.authorIdx === 0 ? teacher1 : teacher2)
        : students[reply.authorIdx];
      const r = await firebaseDB.create('forumReplies', {
        postId: post.id,
        ...(reply.parentReplyId ? { parentReplyId: createdReplies[parseInt(reply.parentReplyId)] } : {}),
        authorId: rAuthor.id,
        authorName: rAuthor.name,
        authorRole: reply.authorType,
        content: reply.content,
        isAnswer: reply.isAnswer || false,
        likesCount: reply.likesCount,
        likedBy: reply.likedBy,
        createdAt: now - reply.daysAgo * DAY,
        updatedAt: now - reply.daysAgo * DAY
      });
      createdReplies.push(r.id!);
      forumReplyCount++;
    }
    return post;
  }

  // ---- CURSO 0: Desarrollo Web Full Stack ----

  // Post 1: Estado global en React (resuelto)
  await createForumThread(0, 1, 'student', {
    title: '¿Cómo manejar estado global en React?',
    content: 'Estoy confundida entre Context API, Redux y Zustand. ¿Cuál recomiendan para un proyecto mediano? He visto tutoriales de los tres pero no me queda claro cuándo usar cada uno.',
    isResolved: true, tags: ['react', 'estado', 'zustand'], daysAgo: 8, views: 47,
    likesCount: 6, likedBy: [students[0].id, students[2].id, teacher1.id]
  }, [
    { authorIdx: 0, authorType: 'teacher', content: 'Para proyectos medianos recomiendo Zustand: es simple, ligero (~1KB) y no requiere Provider. Context API está bien para estado simple (tema, idioma), y Redux es para apps muy grandes con lógica compleja.', isAnswer: true, daysAgo: 7, likesCount: 5, likedBy: [students[0].id, students[1].id, students[2].id] },
    { authorIdx: 0, authorType: 'student', content: 'Yo empecé con Context API pero se volvió un desastre de Providers anidados. Me cambié a Zustand y la diferencia es enorme, el código quedó mucho más limpio.', daysAgo: 7, likesCount: 3, likedBy: [students[1].id, teacher1.id] },
    { authorIdx: 2, authorType: 'student', content: '¿Y qué opinan de Jotai? He leído que es aún más simple que Zustand para estado atómico.', daysAgo: 6, likesCount: 1, likedBy: [students[1].id] },
    { authorIdx: 0, authorType: 'teacher', content: 'Jotai es excelente para estado granular. La regla general: Zustand para stores centralizados, Jotai para estado distribuido/atómico. Ambos son muy buenos.', daysAgo: 6, likesCount: 4, likedBy: [students[0].id, students[1].id, students[2].id] },
  ]);

  // Post 2: Error al desplegar con Docker (no resuelto)
  await createForumThread(0, 0, 'student', {
    title: 'Error al desplegar con Docker: módulos no encontrados',
    content: 'Cuando hago docker compose up me dice "Failed to resolve import" para varios paquetes. En local funciona perfecto. ¿Alguien ha tenido este problema?',
    tags: ['docker', 'deploy', 'error'], daysAgo: 3, views: 18,
    likesCount: 2, likedBy: [students[1].id]
  }, [
    { authorIdx: 2, authorType: 'student', content: 'Me pasó lo mismo. El problema es que Docker usa un volumen anónimo para node_modules que no se actualiza cuando agregas nuevas dependencias. Tienes que hacer docker compose up --build.', daysAgo: 2, likesCount: 2, likedBy: [students[0].id, teacher1.id] },
    { authorIdx: 0, authorType: 'student', content: '¡Eso era! Gracias Pedro. Ahora funciona. ¿Hay forma de que se actualice automáticamente?', daysAgo: 2, likesCount: 0, likedBy: [] },
  ]);

  // Post 3: Recursos CSS Grid (fijado por profesor)
  await createForumThread(0, 0, 'teacher', {
    title: '📌 Recursos adicionales: CSS Grid y layouts modernos',
    content: 'Comparto una lista de recursos para profundizar en CSS Grid, que complementa lo visto en el módulo 1:\n\n- CSS Grid Garden (juego interactivo): https://cssgridgarden.com\n- Guía completa de CSS Tricks: https://css-tricks.com/snippets/css/complete-guide-grid/\n- Layouts reales con Grid: https://gridbyexample.com\n\nPractiquen con estos recursos y compartan sus proyectos en este hilo.',
    isPinned: true, tags: ['css', 'recursos', 'grid'], daysAgo: 15, views: 62,
    likesCount: 8, likedBy: [students[0].id, students[1].id, students[2].id]
  }, [
    { authorIdx: 1, authorType: 'student', content: '¡Excelentes recursos profesora! CSS Grid Garden es adictivo. Ya completé todos los niveles 🎮', daysAgo: 14, likesCount: 2, likedBy: [students[0].id, teacher1.id] },
    { authorIdx: 2, authorType: 'student', content: 'Hice un layout de dashboard usando Grid para mi proyecto. ¿Puedo compartirlo aquí para feedback?', daysAgo: 12, likesCount: 1, likedBy: [teacher1.id] },
    { authorIdx: 0, authorType: 'teacher', content: '¡Claro Pedro! Comparte tu código y te doy retroalimentación. Es excelente que practiques con proyectos reales.', daysAgo: 12, likesCount: 1, likedBy: [students[2].id] },
  ]);

  // Post 4: REST vs GraphQL (discusión)
  await createForumThread(0, 2, 'student', {
    title: '¿Cuál es la diferencia entre REST y GraphQL?',
    content: 'En el módulo de APIs vimos REST, pero he escuchado mucho sobre GraphQL. ¿Cuándo conviene usar uno u otro? ¿GraphQL va a reemplazar a REST?',
    isResolved: true, tags: ['api', 'rest', 'graphql'], daysAgo: 6, views: 34,
    likesCount: 5, likedBy: [students[0].id, students[1].id]
  }, [
    { authorIdx: 0, authorType: 'teacher', content: 'REST y GraphQL resuelven problemas diferentes. REST es simple, cacheable y ampliamente soportado. GraphQL brilla cuando el frontend necesita datos muy específicos de múltiples recursos en una sola petición. No se reemplazarán mutuamente.', isAnswer: true, daysAgo: 5, likesCount: 4, likedBy: [students[0].id, students[1].id, students[2].id] },
    { authorIdx: 0, authorType: 'student', content: 'En mi trabajo actual usamos REST para todo. ¿Valdría la pena migrar a GraphQL?', daysAgo: 5, likesCount: 1, likedBy: [students[2].id] },
    { authorIdx: 0, authorType: 'teacher', content: 'Solo migra si tienes problemas reales de over-fetching o under-fetching. Migrar por moda técnica no es buena idea. Si REST te funciona bien, quédate con REST.', daysAgo: 4, likesCount: 6, likedBy: [students[0].id, students[1].id, students[2].id] },
  ]);

  // ---- CURSO 1: Ciencia de Datos con Python ----

  // Post 5: Dataset con muchos nulos (resuelto)
  await createForumThread(1, 0, 'student', {
    title: '¿Cómo manejar un dataset con 40% de valores nulos?',
    content: 'Estoy trabajando con un dataset de Kaggle sobre precios de viviendas y tiene muchas columnas con 30-40% de nulos. ¿Los elimino todos? ¿Los relleno? No sé cuál es el enfoque correcto.',
    isResolved: true, tags: ['pandas', 'limpieza', 'nulos'], daysAgo: 10, views: 38,
    likesCount: 4, likedBy: [students[1].id, students[2].id]
  }, [
    { authorIdx: 0, authorType: 'teacher', content: 'Depende del contexto:\n1. Si la columna tiene >50% nulos y no es crucial, elimínala\n2. Para numéricas, rellena con la mediana (robusta a outliers)\n3. Para categóricas, usa la moda o crea una categoría "Desconocido"\n4. Para datos temporales, usa interpolación\n\nNunca rellenes a ciegas con la media sin analizar la distribución primero.', isAnswer: true, daysAgo: 9, likesCount: 7, likedBy: [students[0].id, students[1].id, students[2].id] },
    { authorIdx: 1, authorType: 'student', content: 'También puedes usar KNNImputer de sklearn para rellenar basándote en los registros más similares. Me funcionó muy bien en un proyecto similar.', daysAgo: 9, likesCount: 3, likedBy: [students[0].id, teacher1.id] },
    { authorIdx: 0, authorType: 'student', content: 'Usé la mediana para numéricas y "Desconocido" para categóricas como sugirió la profesora. Mi modelo mejoró bastante. ¡Gracias a ambos!', daysAgo: 8, likesCount: 1, likedBy: [teacher1.id] },
  ]);

  // Post 6: Kaggle vs proyectos propios (discusión)
  await createForumThread(1, 1, 'student', {
    title: '¿Kaggle o proyectos propios para el portfolio?',
    content: '¿Qué vale más en un portfolio de data science: competiciones de Kaggle o proyectos propios con datos reales? Quiero preparar mi portfolio para buscar trabajo.',
    tags: ['portfolio', 'carrera', 'kaggle'], daysAgo: 7, views: 52,
    likesCount: 7, likedBy: [students[0].id, students[2].id, teacher1.id]
  }, [
    { authorIdx: 0, authorType: 'teacher', content: 'Los dos tienen valor pero son diferentes:\n\n- Kaggle muestra habilidad técnica y competitiva\n- Proyectos propios muestran creatividad, pensamiento de negocio y capacidad end-to-end\n\nMi recomendación: 2-3 proyectos propios con datos reales y 1-2 competiciones de Kaggle. Los reclutadores valoran más los proyectos propios porque demuestran iniciativa.', daysAgo: 6, likesCount: 8, likedBy: [students[0].id, students[1].id, students[2].id] },
    { authorIdx: 2, authorType: 'student', content: 'Yo conseguí mi pasantía mostrando un proyecto donde analicé datos de transporte público de mi ciudad. El entrevistador se interesó mucho más en eso que en mis notebooks de Kaggle.', daysAgo: 5, likesCount: 5, likedBy: [students[0].id, students[1].id, teacher1.id] },
    { authorIdx: 0, authorType: 'student', content: '¿Alguna idea de fuentes de datos reales para proyectos interesantes?', daysAgo: 5, likesCount: 1, likedBy: [students[1].id] },
    { authorIdx: 0, authorType: 'teacher', content: 'APIs públicas: Spotify, Twitter, GitHub. Datos abiertos: datos.gob.do, data.worldbank.org. También puedes hacer web scraping (ético) de sitios como inmobiliarias o sitios de empleo.', daysAgo: 4, likesCount: 3, likedBy: [students[0].id, students[1].id] },
  ]);

  // Post 7: Error matplotlib (resuelto, técnico)
  await createForumThread(1, 2, 'student', {
    title: 'Error al importar matplotlib: "No module named tkinter"',
    content: 'Instalé matplotlib con pip pero cuando hago import matplotlib.pyplot me da error de tkinter. ¿Cómo lo resuelvo?',
    isResolved: true, tags: ['matplotlib', 'error', 'instalación'], daysAgo: 12, views: 25,
    likesCount: 2, likedBy: [students[0].id]
  }, [
    { authorIdx: 0, authorType: 'student', content: 'En Ubuntu/Debian instala: sudo apt-get install python3-tk\nEn macOS: brew install python-tk\nEn Windows debería venir incluido con Python.\n\nAlternativa: usa el backend Agg que no necesita GUI:\nimport matplotlib\nmatplotlib.use("Agg")', daysAgo: 11, likesCount: 4, likedBy: [students[2].id, teacher1.id] },
    { authorIdx: 2, authorType: 'student', content: 'El sudo apt-get install python3-tk me funcionó perfecto. ¡Gracias Carlos!', daysAgo: 11, likesCount: 0, likedBy: [] },
  ]);

  // Post 8: Recursos SQL (fijado por profesor)
  await createForumThread(1, 0, 'teacher', {
    title: '📌 Recursos para practicar SQL',
    content: 'SQL es fundamental para data science. Aquí van recursos para practicar:\n\n- SQLBolt (tutorial interactivo): https://sqlbolt.com\n- Mode Analytics SQL Tutorial: https://mode.com/sql-tutorial\n- HackerRank SQL: https://hackerrank.com/domains/sql\n- LeetCode Database Problems: https://leetcode.com/problemset/database\n\nEmpiecen por SQLBolt y luego pasen a los ejercicios de HackerRank.',
    isPinned: true, tags: ['sql', 'recursos', 'práctica'], daysAgo: 20, views: 71,
    likesCount: 9, likedBy: [students[0].id, students[1].id, students[2].id]
  }, [
    { authorIdx: 1, authorType: 'student', content: 'SQLBolt es genial para empezar. Lo completé en una tarde y ahora me siento mucho más cómoda con JOINs.', daysAgo: 18, likesCount: 3, likedBy: [students[0].id, teacher1.id] },
    { authorIdx: 0, authorType: 'student', content: 'Agrego otro recurso: https://pgexercises.com - es específico para PostgreSQL con ejercicios progresivos muy buenos.', daysAgo: 15, likesCount: 4, likedBy: [students[1].id, students[2].id, teacher1.id] },
  ]);

  // ---- CURSO 2: Inglés para Profesionales de TI ----

  // Post 9: Miedo a hablar en reuniones (discusión popular)
  await createForumThread(2, 1, 'student', {
    title: 'Tips para perder el miedo a hablar en reuniones en inglés',
    content: 'Entré a un equipo internacional y me da mucho nervio participar en las reuniones. Entiendo casi todo pero a la hora de hablar me bloqueo. ¿Algún consejo?',
    tags: ['speaking', 'reuniones', 'confianza'], daysAgo: 5, views: 65,
    likesCount: 10, likedBy: [students[0].id, students[2].id, teacher1.id, teacher2.id]
  }, [
    { authorIdx: 1, authorType: 'teacher', content: 'Es completamente normal. Aquí van mis tips:\n1. Prepara lo que vas a decir ANTES de la reunión\n2. Empieza participando en el chat (más fácil que hablar)\n3. Practica tu update del standup en voz alta cada mañana\n4. No busques perfección, busca comunicación\n5. Pide que repitan si no entiendes - es profesional, no vergonzoso', daysAgo: 4, likesCount: 8, likedBy: [students[0].id, students[1].id, students[2].id] },
    { authorIdx: 0, authorType: 'student', content: 'A mí me ayudó mucho empezar con preguntas simples. "Could you repeat that?" o "Just to clarify..." son frases que te dan tiempo para pensar mientras suenas profesional.', daysAgo: 4, likesCount: 6, likedBy: [students[1].id, students[2].id, teacher2.id] },
    { authorIdx: 2, authorType: 'student', content: 'Yo practico con ChatGPT simulando reuniones antes de las reales. También me grabé haciendo presentaciones para escucharme y mejorar.', daysAgo: 3, likesCount: 4, likedBy: [students[0].id, students[1].id] },
    { authorIdx: 1, authorType: 'teacher', content: 'Excelentes tips todos. Recuerden: nadie espera que hablen perfecto. Lo que importa es que se comuniquen. Con práctica, la fluidez llega sola.', daysAgo: 3, likesCount: 3, likedBy: [students[0].id, students[1].id, students[2].id] },
  ]);

  // Post 10: Pronunciación de términos técnicos (resuelto)
  await createForumThread(2, 0, 'student', {
    title: '¿Cómo se pronuncian correctamente estos términos?',
    content: 'Tengo dudas con la pronunciación de: cache, query, nginx, kubernetes, sudo, GUI, API, char, null. ¿Pueden ayudarme?',
    isResolved: true, tags: ['pronunciación', 'vocabulario'], daysAgo: 9, views: 43,
    likesCount: 5, likedBy: [students[1].id, students[2].id, teacher2.id]
  }, [
    { authorIdx: 1, authorType: 'teacher', isAnswer: true, content: '¡Buena pregunta! Aquí van:\n- cache: /kæʃ/ (como "cash")\n- query: /ˈkwɪəri/ (como "kwiri")\n- nginx: /ˈɛndʒɪnˈɛks/ ("engine-x")\n- kubernetes: /kuːbərˈnɛtiːz/ ("kuber-netis")\n- sudo: /ˈsuːduː/ ("sudu")\n- GUI: /ˈɡuːi/ ("gui") o deletreado G-U-I\n- API: siempre deletreado A-P-I\n- char: /tʃɑːr/ (como "char" en charcoal)\n- null: /nʌl/ (como "nul")', daysAgo: 8, likesCount: 9, likedBy: [students[0].id, students[1].id, students[2].id] },
    { authorIdx: 1, authorType: 'student', content: '¡No sabía que "cache" se pronuncia como "cash"! Yo decía "ca-ché" 😅', daysAgo: 8, likesCount: 3, likedBy: [students[0].id, students[2].id] },
  ]);

  // Post 11: Plantillas de emails (fijado, recurso)
  await createForumThread(2, 1, 'teacher', {
    title: '📌 Plantillas de emails profesionales en inglés',
    content: 'Les comparto las plantillas que más uso en mi trabajo con equipos internacionales:\n\n1. Pedir ayuda: "Hi [name], I\'m working on [X] and could use your expertise on [Y]..."\n2. Reportar problema: "Hi team, I\'ve noticed an issue with [X]. Steps to reproduce: ..."\n3. Pedir extensión: "Hi [name], I wanted to give you a heads-up that [task] may need an extra [time]..."\n4. Agradecer: "Thanks for your help with [X]. It really made a difference."\n\nGuárdenlas y personalícenlas para sus contextos.',
    isPinned: true, tags: ['emails', 'plantillas', 'writing'], daysAgo: 18, views: 78,
    likesCount: 12, likedBy: [students[0].id, students[1].id, students[2].id]
  }, [
    { authorIdx: 0, authorType: 'student', content: 'Esto es oro. ¿Tienen plantillas también para dar feedback en code reviews?', daysAgo: 17, likesCount: 3, likedBy: [students[1].id, teacher2.id] },
    { authorIdx: 1, authorType: 'teacher', content: 'Para code reviews:\n- Sugerencia menor: "Nit: consider renaming X to Y for clarity"\n- Sugerencia importante: "I\'d suggest [approach] because [reason]"\n- Pregunta: "What was the reasoning behind [decision]?"\n- Aprobación: "LGTM! Nice work on the refactor."', daysAgo: 16, likesCount: 7, likedBy: [students[0].id, students[1].id, students[2].id] },
    { authorIdx: 2, authorType: 'student', content: 'Empecé a usar estas plantillas en mi trabajo y mis emails son mucho más claros ahora. Antes tardaba 20 minutos redactando, ahora 5.', daysAgo: 10, likesCount: 4, likedBy: [students[0].id, students[1].id, teacher2.id] },
  ]);

  // Post 12: Primera entrevista en inglés (experiencia)
  await createForumThread(2, 2, 'student', {
    title: 'Mi experiencia en mi primera entrevista técnica en inglés',
    content: 'Acabo de hacer mi primera entrevista técnica en inglés para una empresa remota y quiero compartir la experiencia:\n\n- Me preparé 2 semanas con mock interviews\n- Usé el método STAR para las behavioral questions\n- Lo más difícil fue explicar mi código en vivo (live coding)\n- El entrevistador fue muy paciente cuando me trabé\n\n¿Alguien más ha tenido entrevistas en inglés? ¿Cómo les fue?',
    tags: ['entrevista', 'experiencia', 'carrera'], daysAgo: 2, views: 41,
    likesCount: 8, likedBy: [students[0].id, students[1].id, teacher1.id, teacher2.id]
  }, [
    { authorIdx: 1, authorType: 'teacher', content: '¡Felicidades por dar el paso Pedro! Independientemente del resultado, cada entrevista es práctica invaluable. ¿Qué preguntas técnicas te hicieron?', daysAgo: 1, likesCount: 2, likedBy: [students[2].id] },
    { authorIdx: 2, authorType: 'student', content: 'Me pidieron diseñar una API REST para un sistema de tareas, y luego preguntas de behavioral: "Tell me about a time you disagreed with a teammate." Usé STAR como practicamos en clase y creo que salió bien.', daysAgo: 1, likesCount: 3, likedBy: [students[0].id, students[1].id, teacher2.id] },
    { authorIdx: 1, authorType: 'student', content: '¡Qué inspiración! Yo aún no me animo pero tu experiencia me motiva. ¿Qué recursos usaste para preparar el live coding en inglés?', daysAgo: 1, likesCount: 1, likedBy: [students[2].id] },
    { authorIdx: 0, authorType: 'student', content: 'Yo tuve una hace un mes. El tip más útil: practica en voz alta explicando tu código. Puedes grabarte resolviendo problemas de LeetCode narrado en inglés.', daysAgo: 1, likesCount: 5, likedBy: [students[1].id, students[2].id, teacher2.id] },
  ]);

  console.log(`   ✅ ${forumPostCount} posts y ${forumReplyCount} respuestas de foro creados`);

  // =============================================
  // 11. TICKETS DE SOPORTE
  // =============================================
  console.log('\n🎫 Creando tickets de soporte...');

  const ticketTemplates = [
    { subject: 'No puedo acceder al curso de React', description: 'Cuando intento entrar al curso me sale error 404. Ya intenté recargar la página.', category: 'tecnico' as const, priority: 'alta' as const, status: 'open' as const },
    { subject: 'Error al subir tarea', description: 'Intento subir mi archivo PDF pero dice que el formato no es válido.', category: 'tecnico' as const, priority: 'media' as const, status: 'in_progress' as const },
    { subject: 'Consulta sobre certificado', description: '¿El certificado tiene validez internacional? ¿Puedo ponerlo en LinkedIn?', category: 'academico' as const, priority: 'baja' as const, status: 'resolved' as const },
    { subject: 'No recibí mi calificación', description: 'Ya pasaron 3 días desde el examen y aún no veo mi nota.', category: 'academico' as const, priority: 'media' as const, status: 'open' as const },
    { subject: 'Video no carga en móvil', description: 'Los videos de la lección 3 del módulo 2 no cargan desde mi celular. En PC sí funcionan.', category: 'tecnico' as const, priority: 'media' as const, status: 'resolved' as const },
    { subject: 'Quiero cambiar mi email', description: 'Necesito actualizar mi correo electrónico porque cambié de empresa.', category: 'cuenta' as const, priority: 'baja' as const, status: 'closed' as const },
    { subject: 'Prórroga para entrega', description: 'Tuve una emergencia familiar y no pude entregar a tiempo. ¿Es posible una extensión?', category: 'academico' as const, priority: 'alta' as const, status: 'in_progress' as const },
    { subject: 'La plataforma está muy lenta', description: 'Desde ayer la plataforma tarda mucho en cargar las páginas y los quizzes.', category: 'tecnico' as const, priority: 'urgente' as const, status: 'open' as const },
  ];

  const ticketMessages = [
    ['Hola, ¿pueden ayudarme con esto?', 'Claro, estamos revisando tu caso. ¿Puedes indicar qué navegador usas?', 'Uso Chrome versión 120', 'Gracias, ya identificamos el problema. Debería estar resuelto ahora.'],
    ['Buenos días, necesito ayuda urgente', 'Hola, estamos atendiendo tu solicitud. Dame un momento.', 'Listo, ya revisamos y el problema fue corregido. Intenta de nuevo.'],
    ['Buenas tardes, tengo una consulta', 'Con gusto te ayudamos. ¿Cuál es tu pregunta?', 'Ya respondí arriba en la descripción', 'Sí, el certificado es válido y puedes compartirlo en LinkedIn. Te envío las instrucciones.'],
  ];

  let ticketCount = 0;
  for (let ti = 0; ti < ticketTemplates.length; ti++) {
    const tmpl = ticketTemplates[ti];
    const student = students[ti % students.length];
    const daysAgo = rand(1, 14);
    const msgs = ticketMessages[ti % ticketMessages.length];

    const ticketMsgs = msgs.map((content, mi) => ({
      id: `msg_${ti}_${mi}`,
      ticketId: '',
      senderId: mi % 2 === 0 ? student.id : supportUser.id,
      senderName: mi % 2 === 0 ? student.name : supportUser.name,
      senderRole: (mi % 2 === 0 ? 'user' : 'support') as 'user' | 'support',
      content,
      isInternal: false,
      createdAt: now - daysAgo * DAY + mi * 3600000
    }));

    await firebaseDB.create('supportTickets', {
      userId: student.id,
      userName: student.name,
      userEmail: student.email,
      category: tmpl.category,
      priority: tmpl.priority,
      subject: tmpl.subject,
      description: tmpl.description,
      status: tmpl.status,
      ...(tmpl.status !== 'open' ? { assignedTo: supportUser.id, assignedName: supportUser.name } : {}),
      messages: ticketMsgs,
      ...(tmpl.status === 'resolved' || tmpl.status === 'closed' ? { resolution: 'Problema resuelto satisfactoriamente' } : {}),
      ...(tmpl.status === 'resolved' ? { satisfactionRating: rand(3, 5) } : {}),
      tags: [tmpl.category],
      createdAt: now - daysAgo * DAY,
      updatedAt: now - rand(0, daysAgo) * DAY,
      ...(tmpl.status === 'resolved' || tmpl.status === 'closed' ? { resolvedAt: now - rand(0, daysAgo) * DAY } : {}),
    });
    ticketCount++;
  }
  console.log(`   ✅ ${ticketCount} tickets de soporte creados`);

  // =============================================
  // 12. CERTIFICADOS (para estudiantes con 100%)
  // =============================================
  console.log('\n🏅 Creando certificados...');

  let certCount = 0;
  // Check enrollments for completed ones and create certificates
  const allEnrollments = await firebaseDB.getEnrollments();
  for (const enrollment of allEnrollments) {
    if (enrollment.status === 'completed' && enrollment.progress === 100) {
      const student = createdUsers.find(u => u.id === enrollment.userId);
      const course = createdCourses.find(c => c.id === enrollment.courseId);
      if (!student || !course) continue;

      const credNum = String(certCount + 1).padStart(3, '0');
      await firebaseDB.createCertificate({
        courseId: course.id,
        userId: student.id,
        courseName: course.title,
        studentName: student.name,
        instructorName: course.instructor,
        completionDate: new Date(now - rand(1, 10) * DAY).toISOString(),
        grade: enrollment.grade || rand(75, 98),
        credentialId: `LASA-${course.category.toUpperCase().slice(0, 3)}-2026-${credNum}`,
        verificationUrl: `https://lasaedu.com/verify/LASA-2026-${credNum}`,
        templateId: 'default',
        status: 'generated',
        createdAt: now - rand(1, 10) * DAY,
        updatedAt: now
      });
      certCount++;
    }
  }
  console.log(`   ✅ ${certCount} certificados creados`);

  // =============================================
  // 13. MÉTRICAS DEL SISTEMA (últimos 7 días)
  // =============================================
  console.log('\n📈 Creando métricas del sistema...');

  for (let d = 6; d >= 0; d--) {
    const date = new Date(now - d * DAY);
    const dateStr = date.toISOString().split('T')[0];
    const dateKey = dateStr.replace(/-/g, '_');

    await firebaseDB.create('systemMetrics', {
      id: dateKey,
      date: dateStr,
      metrics: {
        activeUsers: rand(3, 7),
        newUsers: rand(0, 2),
        courseEnrollments: rand(1, 4),
        lessonsCompleted: rand(5, 20),
        evaluationsSubmitted: rand(2, 8),
        certificatesIssued: rand(0, 2),
        supportTickets: rand(0, 3),
        avgSessionDuration: rand(15, 45),
        avgCourseProgress: rand(35, 65),
      },
      createdAt: date.getTime()
    });
  }
  console.log('   ✅ 7 días de métricas creadas');

  // =============================================
  // 14. USER SETTINGS (para todos los usuarios)
  // =============================================
  console.log('\n⚙️ Creando configuraciones de usuario...');

  for (const user of createdUsers) {
    await firebaseDB.create('userSettings', {
      userId: user.id,
      theme: 'light',
      language: 'es',
      timezone: 'America/Santo_Domingo',
      notifications: {
        email: { courseUpdates: true, grades: true, messages: true, announcements: true, marketing: false },
        push: { enabled: true, courseUpdates: true, grades: true, messages: true },
        sms: { enabled: false, urgentOnly: true },
      },
      privacy: { showProfile: true, showProgress: true, showBadges: true, showActivity: true },
      accessibility: { fontSize: 'medium', highContrast: false, reduceMotion: false },
      createdAt: user.createdAt,
      updatedAt: now
    });
  }
  console.log(`   ✅ ${createdUsers.length} configuraciones creadas`);

  // =============================================
  // 15. PROGRESS ACTIVITIES (historial detallado)
  // =============================================
  console.log('\n📜 Creando historial de progreso...');

  let paCount = 0;
  for (const student of students) {
    // Enrollment activities
    for (const course of createdCourses) {
      await firebaseDB.create('progressActivities', {
        userId: student.id,
        type: 'course_started',
        courseId: course.id,
        details: `Inició el curso ${course.title}`,
        points: 10,
        timestamp: new Date(now - rand(20, 40) * DAY).toISOString(),
        createdAt: now - rand(20, 40) * DAY
      });
      paCount++;
    }

    // Lesson completions
    for (let i = 0; i < rand(3, 8); i++) {
      const courseModule = pick(allModules);
      const lesson = pick(courseModule.lessons);
      await firebaseDB.create('progressActivities', {
        userId: student.id,
        type: 'lesson_completed',
        courseId: createdCourses[courseModule.courseIdx].id,
        lessonId: lesson.id,
        details: `Completó la lección ${lesson.title}`,
        points: rand(5, 15),
        timestamp: new Date(now - rand(1, 20) * DAY).toISOString(),
        createdAt: now - rand(1, 20) * DAY
      });
      paCount++;
    }

    // Quiz passes
    for (let i = 0; i < rand(1, 4); i++) {
      const evalItem = pick(createdEvals);
      await firebaseDB.create('progressActivities', {
        userId: student.id,
        type: 'quiz_passed',
        courseId: createdCourses[evalItem.courseIdx].id,
        details: `Aprobó ${evalItem.eval.title}`,
        points: rand(15, 30),
        timestamp: new Date(now - rand(1, 15) * DAY).toISOString(),
        createdAt: now - rand(1, 15) * DAY
      });
      paCount++;
    }
  }
  console.log(`   ✅ ${paCount} actividades de progreso creadas`);

  // =============================================
  // RESUMEN FINAL
  // =============================================
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n${'='.repeat(50)}`);
  console.log('🎉 ¡Data Init completado!');
  console.log(`⏱️  Tiempo: ${elapsed}s`);
  console.log(`${'='.repeat(50)}`);
  console.log('\n📋 Resumen:');
  console.log(`   👥 ${createdUsers.length} usuarios (2 teachers, 3 students, 1 admin, 1 support)`);
  console.log(`   📚 ${createdCourses.length} cursos con 7 módulos cada uno`);
  console.log(`   📖 ${allModules.reduce((acc, m) => acc + m.lessons.length, 0)} lecciones totales`);
  console.log(`   📝 ${createdEvals.length} evaluaciones`);
  console.log(`   🎓 ${students.length * createdCourses.length} inscripciones con notas aleatorias`);
  console.log(`   🎫 ${ticketCount} tickets de soporte`);
  console.log(`   🏅 ${certCount} certificados`);
  console.log(`   📈 7 días de métricas del sistema`);
  console.log(`   ⚙️  ${createdUsers.length} configuraciones de usuario`);
  console.log(`   📜 ${paCount} actividades de progreso`);
  console.log('\n🔑 Credenciales:');
  console.log('   admin@lasaedu.com / password123');
  console.log('   teacher@lasaedu.com / password123 (2 cursos)');
  console.log('   teacher2@lasaedu.com / password123 (1 curso)');
  console.log('   student@lasaedu.com / password123');
  console.log('   laura@lasaedu.com / password123');
  console.log('   pedro@lasaedu.com / password123');
  console.log('   support@lasaedu.com / password123');
}

// Type for activities
interface DBActivity {
  id: string;
  userId: string;
  userName: string;
  type: 'login' | 'logout' | 'course_view' | 'lesson_complete' | 'evaluation_submit' | 'message_send' | 'enrollment' | 'certificate' | 'profile_update' | 'system';
  action: string;
  description: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
  createdAt: number;
}

// Expose to window for console usage
if (typeof window !== 'undefined') {
  (window as any).dataInit = dataInit;
  (window as any).dataClear = dataClear;
}

export default dataInit;
