/**
 * Servicio xAPI
 * Gestiona la creación, almacenamiento y consulta de statements xAPI
 * Almacena en Firebase RTDB (almacenamiento local, sin LRS externo)
 */

import { database } from '@app/config/firebase';
import { ref, get, set, push, remove, query, orderByChild, equalTo } from 'firebase/database';
import type { XAPIStatement, XAPIResult, XAPIContext } from '@shared/types/elearning-standards';
import {
  XAPI_VERBS,
  XAPI_ACTIVITY_TYPES,
  buildActor,
  buildVerb,
  buildActivity,
  buildContext,
  msToISO8601Duration,
} from './xapiVocabulary';

export class XAPIService {
  // =============================================
  // CREAR STATEMENTS
  // =============================================

  createStatement(params: {
    userId: string;
    userName?: string;
    userEmail?: string;
    verb: typeof XAPI_VERBS[keyof typeof XAPI_VERBS];
    activityId: string;
    activityName: string;
    activityType: string;
    activityDescription?: string;
    courseId?: string;
    courseName?: string;
    result?: XAPIResult;
    contextExtras?: Partial<XAPIContext>;
    registration?: string;
  }): Omit<XAPIStatement, 'id' | 'stored'> {
    const actor = buildActor(params.userId, params.userName, params.userEmail);
    const verb = buildVerb(params.verb);
    const object = buildActivity(
      params.activityId,
      params.activityName,
      params.activityType,
      params.activityDescription
    );
    const context = {
      ...buildContext(params.courseId, params.courseName, params.registration),
      ...params.contextExtras
    };

    return {
      actor,
      verb,
      object,
      result: params.result,
      context,
      timestamp: new Date().toISOString()
    };
  }

  // =============================================
  // STATEMENTS PREDEFINIDOS
  // =============================================

  createLessonCompletedStatement(params: {
    userId: string;
    userName?: string;
    lessonId: string;
    lessonName: string;
    courseId: string;
    courseName?: string;
    durationMs?: number;
    score?: { raw?: number; max?: number; scaled?: number };
  }) {
    const result: XAPIResult = { completion: true };
    if (params.durationMs) {
      result.duration = msToISO8601Duration(params.durationMs);
    }
    if (params.score) {
      result.score = params.score;
      result.success = params.score.scaled !== undefined ? params.score.scaled >= 0.6 : undefined;
    }

    return this.createStatement({
      userId: params.userId,
      userName: params.userName,
      verb: XAPI_VERBS.COMPLETED,
      activityId: params.lessonId,
      activityName: params.lessonName,
      activityType: XAPI_ACTIVITY_TYPES.LESSON,
      courseId: params.courseId,
      courseName: params.courseName,
      result,
    });
  }

  createEvaluationCompletedStatement(params: {
    userId: string;
    userName?: string;
    evaluationId: string;
    evaluationName: string;
    courseId: string;
    courseName?: string;
    score: number;
    maxScore: number;
    passed: boolean;
    durationMs?: number;
  }) {
    const result: XAPIResult = {
      score: {
        raw: params.score,
        max: params.maxScore,
        scaled: params.maxScore > 0 ? params.score / params.maxScore : 0,
      },
      success: params.passed,
      completion: true,
    };
    if (params.durationMs) {
      result.duration = msToISO8601Duration(params.durationMs);
    }

    return this.createStatement({
      userId: params.userId,
      userName: params.userName,
      verb: params.passed ? XAPI_VERBS.PASSED : XAPI_VERBS.FAILED,
      activityId: params.evaluationId,
      activityName: params.evaluationName,
      activityType: XAPI_ACTIVITY_TYPES.ASSESSMENT,
      courseId: params.courseId,
      courseName: params.courseName,
      result,
    });
  }

  createCourseCompletedStatement(params: {
    userId: string;
    userName?: string;
    courseId: string;
    courseName: string;
    durationMs?: number;
  }) {
    const result: XAPIResult = { completion: true };
    if (params.durationMs) {
      result.duration = msToISO8601Duration(params.durationMs);
    }

    return this.createStatement({
      userId: params.userId,
      userName: params.userName,
      verb: XAPI_VERBS.COMPLETED,
      activityId: params.courseId,
      activityName: params.courseName,
      activityType: XAPI_ACTIVITY_TYPES.COURSE,
      result,
    });
  }

  createSCORMCompletedStatement(params: {
    userId: string;
    userName?: string;
    packageId: string;
    packageName: string;
    courseId: string;
    courseName?: string;
    score?: number;
    maxScore?: number;
    passed?: boolean;
    durationMs?: number;
  }) {
    const result: XAPIResult = { completion: true };
    if (params.score !== undefined && params.maxScore !== undefined) {
      result.score = {
        raw: params.score,
        max: params.maxScore,
        scaled: params.maxScore > 0 ? params.score / params.maxScore : undefined,
      };
    }
    if (params.passed !== undefined) {
      result.success = params.passed;
    }
    if (params.durationMs) {
      result.duration = msToISO8601Duration(params.durationMs);
    }

    return this.createStatement({
      userId: params.userId,
      userName: params.userName,
      verb: params.passed === false ? XAPI_VERBS.FAILED : XAPI_VERBS.COMPLETED,
      activityId: params.packageId,
      activityName: params.packageName,
      activityType: XAPI_ACTIVITY_TYPES.MODULE,
      courseId: params.courseId,
      courseName: params.courseName,
      result,
    });
  }

  // =============================================
  // PERSISTENCIA (Firebase RTDB)
  // =============================================

  async sendStatement(statement: Omit<XAPIStatement, 'id' | 'stored'>): Promise<XAPIStatement> {
    const statementsRef = ref(database, 'xapiStatements');
    const newRef = push(statementsRef);
    const stored: XAPIStatement = {
      ...statement,
      id: newRef.key!,
      stored: new Date().toISOString()
    };
    await set(newRef, stored);
    return stored;
  }

  async getStatementsByUser(userId: string): Promise<XAPIStatement[]> {
    const q = query(
      ref(database, 'xapiStatements'),
      orderByChild('actor/account/name'),
      equalTo(userId)
    );
    const snapshot = await get(q);
    if (!snapshot.exists()) return [];
    return Object.values(snapshot.val()) as XAPIStatement[];
  }

  async getStatementsByCourse(courseId: string): Promise<XAPIStatement[]> {
    // Firebase no soporta queries anidadas directamente,
    // por lo que cargamos todos y filtramos en cliente
    const snapshot = await get(ref(database, 'xapiStatements'));
    if (!snapshot.exists()) return [];

    const all = Object.values(snapshot.val()) as XAPIStatement[];
    return all.filter(s => {
      const parents = s.context?.contextActivities?.parent;
      if (!parents) return false;
      return parents.some(p => p.id.includes(courseId));
    });
  }

  async getStatementsByVerb(verbId: string): Promise<XAPIStatement[]> {
    const q = query(
      ref(database, 'xapiStatements'),
      orderByChild('verb/id'),
      equalTo(verbId)
    );
    const snapshot = await get(q);
    if (!snapshot.exists()) return [];
    return Object.values(snapshot.val()) as XAPIStatement[];
  }

  async getStatements(filters?: {
    userId?: string;
    courseId?: string;
    verbId?: string;
    since?: string;
    until?: string;
    limit?: number;
  }): Promise<XAPIStatement[]> {
    // Si hay un filtro indexable, usarlo; sino cargar todo
    if (filters?.userId) {
      let statements = await this.getStatementsByUser(filters.userId);
      return this.applyFilters(statements, filters);
    }
    if (filters?.verbId) {
      let statements = await this.getStatementsByVerb(filters.verbId);
      return this.applyFilters(statements, filters);
    }

    const snapshot = await get(ref(database, 'xapiStatements'));
    if (!snapshot.exists()) return [];
    let statements = Object.values(snapshot.val()) as XAPIStatement[];
    return this.applyFilters(statements, filters);
  }

  private applyFilters(
    statements: XAPIStatement[],
    filters?: {
      userId?: string;
      courseId?: string;
      verbId?: string;
      since?: string;
      until?: string;
      limit?: number;
    }
  ): XAPIStatement[] {
    let result = statements;

    if (filters?.userId) {
      result = result.filter(s => s.actor.account?.name === filters.userId);
    }
    if (filters?.courseId) {
      result = result.filter(s => {
        const parents = s.context?.contextActivities?.parent;
        return parents?.some(p => p.id.includes(filters.courseId!));
      });
    }
    if (filters?.verbId) {
      result = result.filter(s => s.verb.id === filters.verbId);
    }
    if (filters?.since) {
      result = result.filter(s => s.timestamp >= filters.since!);
    }
    if (filters?.until) {
      result = result.filter(s => s.timestamp <= filters.until!);
    }

    // Ordenar por timestamp descendente
    result.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    if (filters?.limit) {
      result = result.slice(0, filters.limit);
    }

    return result;
  }

  async deleteStatementsByCourse(courseId: string): Promise<void> {
    const statements = await this.getStatementsByCourse(courseId);
    const deletePromises = statements.map(s =>
      remove(ref(database, `xapiStatements/${s.id}`))
    );
    await Promise.all(deletePromises);
  }
}

export const xapiService = new XAPIService();
