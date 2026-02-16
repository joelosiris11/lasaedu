/**
 * H5P Firebase Service
 * Métodos CRUD para contenido H5P en Firebase Realtime Database
 */

import { database } from '@app/config/firebase';
import {
  ref,
  get,
  set,
  push,
  update,
  remove,
  query,
  orderByChild,
  equalTo,
  DatabaseReference
} from 'firebase/database';
import type { DBH5PContent, DBH5PAttempt, DBH5PResult } from './firebaseDataService';

export class H5PFirebaseService {
  /**
   * Crear contenido H5P
   */
  async createContent(content: DBH5PContent): Promise<DBH5PContent> {
    try {
      const contentRef = ref(database, `h5pContent/${content.id}`);
      await set(contentRef, content);
      return content;
    } catch (error) {
      console.error('Error creating H5P content:', error);
      throw error;
    }
  }

  /**
   * Obtener contenido H5P por ID
   */
  async getContentById(contentId: string): Promise<DBH5PContent | null> {
    try {
      const contentRef = ref(database, `h5pContent/${contentId}`);
      const snapshot = await get(contentRef);
      return snapshot.val() || null;
    } catch (error) {
      console.error('Error getting H5P content:', error);
      throw error;
    }
  }

  /**
   * Listar contenido H5P por curso
   */
  async listByCourse(courseId: string): Promise<DBH5PContent[]> {
    try {
      const contentRef = ref(database, 'h5pContent');
      const courseQuery = query(contentRef, orderByChild('courseId'), equalTo(courseId));
      const snapshot = await get(courseQuery);
      
      if (!snapshot.exists()) return [];
      
      const data = snapshot.val();
      return Object.keys(data).map(key => ({
        ...data[key],
        id: key
      }));
    } catch (error) {
      console.error('Error listing H5P content by course:', error);
      throw error;
    }
  }

  /**
   * Listar contenido H5P reutilizable
   */
  async listReusable(courseId?: string): Promise<DBH5PContent[]> {
    try {
      const contentRef = ref(database, 'h5pContent');
      const snapshot = await get(contentRef);
      
      if (!snapshot.exists()) return [];
      
      const data = snapshot.val();
      let contents = Object.keys(data)
        .map(key => ({
          ...data[key],
          id: key
        }))
        .filter((c: DBH5PContent) => c.isReusable);

      // Si se proporciona courseId, excluir el contenido del mismo curso
      if (courseId) {
        contents = contents.filter((c: DBH5PContent) => c.courseId !== courseId);
      }

      return contents;
    } catch (error) {
      console.error('Error listing reusable H5P content:', error);
      throw error;
    }
  }

  /**
   * Actualizar contenido H5P
   */
  async updateContent(
    contentId: string,
    updates: Partial<DBH5PContent>
  ): Promise<void> {
    try {
      const contentRef = ref(database, `h5pContent/${contentId}`);
      await update(contentRef, {
        ...updates,
        updatedAt: Date.now()
      });
    } catch (error) {
      console.error('Error updating H5P content:', error);
      throw error;
    }
  }

  /**
   * Eliminar contenido H5P
   */
  async deleteContent(contentId: string): Promise<void> {
    try {
      const contentRef = ref(database, `h5pContent/${contentId}`);
      await remove(contentRef);
    } catch (error) {
      console.error('Error deleting H5P content:', error);
      throw error;
    }
  }

  /**
   * Registrar intento H5P
   */
  async recordAttempt(attempt: DBH5PAttempt): Promise<DBH5PAttempt> {
    try {
      const attemptsRef = ref(database, 'h5pAttempts');
      const newAttemptRef = push(attemptsRef);
      
      const attemptWithId: DBH5PAttempt = {
        ...attempt,
        id: newAttemptRef.key || ''
      };

      await set(newAttemptRef, attemptWithId);
      
      // Actualizar contenido para incrementar contador de uso
      await this.updateContent(attempt.contentId, {
        usageCount: (attempt as any).usageCount + 1
      });

      return attemptWithId;
    } catch (error) {
      console.error('Error recording H5P attempt:', error);
      throw error;
    }
  }

  /**
   * Obtener intentos de un usuario en un contenido
   */
  async getAttempts(contentId: string, userId: string): Promise<DBH5PAttempt[]> {
    try {
      const attemptsRef = ref(database, 'h5pAttempts');
      const snapshot = await get(attemptsRef);

      if (!snapshot.exists()) return [];

      const data = snapshot.val();
      return Object.keys(data)
        .map(key => ({
          ...data[key],
          id: key
        }))
        .filter((a: DBH5PAttempt) => a.contentId === contentId && a.userId === userId)
        .sort((a: DBH5PAttempt, b: DBH5PAttempt) => b.startedAt - a.startedAt);
    } catch (error) {
      console.error('Error getting H5P attempts:', error);
      throw error;
    }
  }

  /**
   * Obtener resultado agregado de un usuario en un contenido
   */
  async getResult(contentId: string, userId: string): Promise<DBH5PResult | null> {
    try {
      const attempts = await this.getAttempts(contentId, userId);

      if (attempts.length === 0) return null;

      const completed = attempts.some(a => a.completed);
      const completedAt = attempts.find(a => a.completed)?.completedAt;
      const scores = attempts.filter(a => a.score !== undefined).map(a => a.score!);
      const bestScore = Math.max(...scores, 0);
      const averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

      return {
        id: `result_${contentId}_${userId}`,
        contentId,
        userId,
        courseId: attempts[0]?.courseId || '',
        lastAttemptDate: attempts[0]?.startedAt || 0,
        bestScore,
        attempts,
        completed,
        completedAt,
        averageScore
      };
    } catch (error) {
      console.error('Error getting H5P result:', error);
      throw error;
    }
  }

  /**
   * Buscar contenido H5P
   */
  async searchContent(query: string, filters?: {
    courseId?: string;
    contentType?: string;
    tags?: string[];
    reusableOnly?: boolean;
  }): Promise<DBH5PContent[]> {
    try {
      const contentRef = ref(database, 'h5pContent');
      const snapshot = await get(contentRef);

      if (!snapshot.exists()) return [];

      const data = snapshot.val();
      let results = Object.keys(data)
        .map(key => ({
          ...data[key],
          id: key
        }))
        .filter((c: DBH5PContent) => {
          // Búsqueda por texto
          const matchesQuery = !query || 
            c.title.toLowerCase().includes(query.toLowerCase()) ||
            (c.description || '').toLowerCase().includes(query.toLowerCase()) ||
            c.tags.some(t => t.toLowerCase().includes(query.toLowerCase()));

          // Filtros adicionales
          if (filters?.courseId && c.courseId !== filters.courseId) return false;
          if (filters?.contentType && c.contentType !== filters.contentType) return false;
          if (filters?.reusableOnly && !c.isReusable) return false;
          if (filters?.tags && !filters.tags.some(t => c.tags.includes(t))) return false;

          return matchesQuery;
        });

      return results as DBH5PContent[];
    } catch (error) {
      console.error('Error searching H5P content:', error);
      throw error;
    }
  }

  /**
   * Marcar contenido como reutilizable
   */
  async markAsReusable(contentId: string, isReusable: boolean): Promise<void> {
    try {
      await this.updateContent(contentId, { isReusable });
    } catch (error) {
      console.error('Error marking H5P as reusable:', error);
      throw error;
    }
  }

  /**
   * Copiar contenido H5P a otro curso
   */
  async copyContent(
    sourceContentId: string,
    targetCourseId: string,
    newTitle?: string
  ): Promise<DBH5PContent> {
    try {
      const source = await this.getContentById(sourceContentId);
      if (!source) throw new Error('Source H5P content not found');

      const newContent: DBH5PContent = {
        ...source,
        id: `h5p_${Date.now()}`,
        courseId: targetCourseId,
        title: newTitle || `${source.title} (copia)`,
        usageCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await this.createContent(newContent);
      return newContent;
    } catch (error) {
      console.error('Error copying H5P content:', error);
      throw error;
    }
  }
}

export const h5pFirebaseService = new H5PFirebaseService();
