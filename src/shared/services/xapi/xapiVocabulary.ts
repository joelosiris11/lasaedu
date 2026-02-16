/**
 * Vocabulario estándar xAPI
 * Verbos, tipos de actividad y helpers para construir statements
 */

import type { XAPIVerb, XAPIActor, XAPIObject, XAPIContext } from '@shared/types/elearning-standards';

// =============================================
// VERBOS xAPI ESTÁNDAR (ADL Vocabulary)
// =============================================

export const XAPI_VERBS = {
  LAUNCHED: {
    id: 'http://adlnet.gov/expapi/verbs/launched',
    display: { 'es': 'lanzó', 'en-US': 'launched' }
  },
  INITIALIZED: {
    id: 'http://adlnet.gov/expapi/verbs/initialized',
    display: { 'es': 'inicializó', 'en-US': 'initialized' }
  },
  COMPLETED: {
    id: 'http://adlnet.gov/expapi/verbs/completed',
    display: { 'es': 'completó', 'en-US': 'completed' }
  },
  PASSED: {
    id: 'http://adlnet.gov/expapi/verbs/passed',
    display: { 'es': 'aprobó', 'en-US': 'passed' }
  },
  FAILED: {
    id: 'http://adlnet.gov/expapi/verbs/failed',
    display: { 'es': 'reprobó', 'en-US': 'failed' }
  },
  ATTEMPTED: {
    id: 'http://adlnet.gov/expapi/verbs/attempted',
    display: { 'es': 'intentó', 'en-US': 'attempted' }
  },
  EXPERIENCED: {
    id: 'http://adlnet.gov/expapi/verbs/experienced',
    display: { 'es': 'experimentó', 'en-US': 'experienced' }
  },
  ANSWERED: {
    id: 'http://adlnet.gov/expapi/verbs/answered',
    display: { 'es': 'respondió', 'en-US': 'answered' }
  },
  SUSPENDED: {
    id: 'http://adlnet.gov/expapi/verbs/suspended',
    display: { 'es': 'suspendió', 'en-US': 'suspended' }
  },
  TERMINATED: {
    id: 'http://adlnet.gov/expapi/verbs/terminated',
    display: { 'es': 'terminó', 'en-US': 'terminated' }
  },
  PROGRESSED: {
    id: 'http://adlnet.gov/expapi/verbs/progressed',
    display: { 'es': 'progresó', 'en-US': 'progressed' }
  },
  REGISTERED: {
    id: 'http://adlnet.gov/expapi/verbs/registered',
    display: { 'es': 'se registró', 'en-US': 'registered' }
  },
  SCORED: {
    id: 'http://adlnet.gov/expapi/verbs/scored',
    display: { 'es': 'puntuó', 'en-US': 'scored' }
  },
} as const;

// =============================================
// TIPOS DE ACTIVIDAD xAPI
// =============================================

export const XAPI_ACTIVITY_TYPES = {
  COURSE: 'http://adlnet.gov/expapi/activities/course',
  MODULE: 'http://adlnet.gov/expapi/activities/module',
  LESSON: 'http://adlnet.gov/expapi/activities/lesson',
  ASSESSMENT: 'http://adlnet.gov/expapi/activities/assessment',
  QUESTION: 'http://adlnet.gov/expapi/activities/question',
  MEDIA: 'http://adlnet.gov/expapi/activities/media',
  INTERACTION: 'http://adlnet.gov/expapi/activities/interaction',
  SIMULATION: 'http://adlnet.gov/expapi/activities/simulation',
} as const;

// =============================================
// HELPERS
// =============================================

const PLATFORM_BASE_URL = 'https://lasaedu.com';

export function buildActor(userId: string, userName?: string, email?: string): XAPIActor {
  const actor: XAPIActor = {
    objectType: 'Agent',
    account: {
      homePage: PLATFORM_BASE_URL,
      name: userId
    }
  };
  if (userName) actor.name = userName;
  if (email) actor.mbox = `mailto:${email}`;
  return actor;
}

export function buildVerb(verb: XAPIVerb): XAPIVerb {
  return { id: verb.id, display: verb.display };
}

export function buildActivity(
  activityId: string,
  name: string,
  type: string,
  description?: string
): XAPIObject {
  return {
    objectType: 'Activity',
    id: `${PLATFORM_BASE_URL}/activities/${activityId}`,
    definition: {
      name: { 'es': name },
      type,
      ...(description ? { description: { 'es': description } } : {})
    }
  };
}

export function buildContext(
  courseId?: string,
  courseName?: string,
  registration?: string
): XAPIContext {
  const context: XAPIContext = {
    platform: 'LASA EDU',
    language: 'es',
  };

  if (registration) {
    context.registration = registration;
  }

  if (courseId) {
    context.contextActivities = {
      parent: [{
        objectType: 'Activity',
        id: `${PLATFORM_BASE_URL}/activities/${courseId}`,
        definition: {
          name: courseName ? { 'es': courseName } : undefined,
          type: XAPI_ACTIVITY_TYPES.COURSE
        }
      }]
    };
  }

  return context;
}

/**
 * Convierte milisegundos a formato de duración ISO 8601 (PT...)
 */
export function msToISO8601Duration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  let duration = 'PT';
  if (hours > 0) duration += `${hours}H`;
  if (minutes > 0) duration += `${minutes}M`;
  duration += `${seconds}S`;
  return duration;
}
