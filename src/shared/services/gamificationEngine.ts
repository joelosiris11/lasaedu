/**
 * Sistema de Gamificación Activa
 * 
 * Este módulo maneja la lógica de:
 * - Puntos por acciones
 * - Desbloqueo de insignias
 * - Rachas de aprendizaje
 * - Subida de nivel
 * - Notificaciones de logros
 */

import { gamificationService, notificationService, activityService } from './dataService';

// ============================================
// CONFIGURACIÓN DE PUNTOS
// ============================================

export const POINT_ACTIONS = {
  // Acciones de aprendizaje
  COMPLETE_LESSON: { points: 10, action: 'lesson_complete', description: 'Completar una lección' },
  COMPLETE_MODULE: { points: 50, action: 'module_complete', description: 'Completar un módulo' },
  COMPLETE_COURSE: { points: 200, action: 'course_complete', description: 'Completar un curso' },
  
  // Evaluaciones
  SUBMIT_QUIZ: { points: 15, action: 'quiz_submit', description: 'Enviar un quiz' },
  PASS_QUIZ: { points: 25, action: 'quiz_pass', description: 'Aprobar un quiz' },
  PERFECT_QUIZ: { points: 100, action: 'quiz_perfect', description: '100% en un quiz' },
  SUBMIT_EXAM: { points: 30, action: 'exam_submit', description: 'Enviar un examen' },
  PASS_EXAM: { points: 75, action: 'exam_pass', description: 'Aprobar un examen' },
  
  // Social
  SEND_MESSAGE: { points: 2, action: 'message_send', description: 'Enviar un mensaje' },
  HELP_PEER: { points: 20, action: 'peer_help', description: 'Ayudar a un compañero' },
  FIRST_POST: { points: 15, action: 'first_post', description: 'Primer mensaje en foro' },
  
  // Engagement
  DAILY_LOGIN: { points: 5, action: 'daily_login', description: 'Inicio de sesión diario' },
  STREAK_7_DAYS: { points: 50, action: 'streak_7', description: 'Racha de 7 días' },
  STREAK_30_DAYS: { points: 200, action: 'streak_30', description: 'Racha de 30 días' },
  PROFILE_COMPLETE: { points: 25, action: 'profile_complete', description: 'Completar perfil' },
  
  // Certificados
  EARN_CERTIFICATE: { points: 150, action: 'certificate_earn', description: 'Obtener certificado' },
  SHARE_CERTIFICATE: { points: 30, action: 'certificate_share', description: 'Compartir certificado' },

  // SCORM / LTI
  COMPLETE_SCORM: { points: 15, action: 'scorm_complete', description: 'Completar un paquete SCORM' },
  COMPLETE_LTI: { points: 10, action: 'lti_complete', description: 'Completar una actividad LTI' },

  // H5P
  COMPLETE_H5P: { points: 20, action: 'h5p_complete', description: 'Completar contenido H5P' },
  PERFECT_H5P: { points: 75, action: 'h5p_perfect', description: 'Puntuación perfecta en H5P' },
} as const;

// ============================================
// CONFIGURACIÓN DE NIVELES
// ============================================

export const LEVELS = [
  { level: 1, name: 'Novato', minPoints: 0, icon: '🌱' },
  { level: 2, name: 'Aprendiz', minPoints: 100, icon: '📚' },
  { level: 3, name: 'Estudiante', minPoints: 300, icon: '✏️' },
  { level: 4, name: 'Aplicado', minPoints: 600, icon: '📝' },
  { level: 5, name: 'Avanzado', minPoints: 1000, icon: '🎯' },
  { level: 6, name: 'Experto', minPoints: 1500, icon: '💡' },
  { level: 7, name: 'Maestro', minPoints: 2200, icon: '🏆' },
  { level: 8, name: 'Gran Maestro', minPoints: 3000, icon: '👑' },
  { level: 9, name: 'Leyenda', minPoints: 4000, icon: '⭐' },
  { level: 10, name: 'Iluminado', minPoints: 5500, icon: '🌟' },
];

// ============================================
// CONFIGURACIÓN DE INSIGNIAS
// ============================================

export const BADGE_CRITERIA = {
  // Logros de cursos
  first_lesson: {
    id: 'first_lesson',
    name: 'Primer Paso',
    description: 'Completar tu primera lección',
    icon: '🎯',
    category: 'achievement',
    rarity: 'common',
    criteria: { type: 'lessons_completed', value: 1 }
  },
  ten_lessons: {
    id: 'ten_lessons',
    name: 'Estudiante Dedicado',
    description: 'Completar 10 lecciones',
    icon: '📚',
    category: 'achievement',
    rarity: 'uncommon',
    criteria: { type: 'lessons_completed', value: 10 }
  },
  first_course: {
    id: 'first_course',
    name: 'Primera Graduación',
    description: 'Completar tu primer curso',
    icon: '🎓',
    category: 'course',
    rarity: 'rare',
    criteria: { type: 'courses_completed', value: 1 }
  },
  five_courses: {
    id: 'five_courses',
    name: 'Coleccionista de Conocimiento',
    description: 'Completar 5 cursos',
    icon: '📖',
    category: 'course',
    rarity: 'epic',
    criteria: { type: 'courses_completed', value: 5 }
  },
  
  // Logros de evaluaciones
  perfect_score: {
    id: 'perfect_score',
    name: 'Perfeccionista',
    description: 'Obtener 100% en una evaluación',
    icon: '💯',
    category: 'achievement',
    rarity: 'rare',
    criteria: { type: 'perfect_scores', value: 1 }
  },
  quiz_master: {
    id: 'quiz_master',
    name: 'Maestro del Quiz',
    description: 'Completar 20 quizzes',
    icon: '🧠',
    category: 'achievement',
    rarity: 'epic',
    criteria: { type: 'quizzes_completed', value: 20 }
  },
  
  // Logros de racha
  streak_7: {
    id: 'streak_7',
    name: 'Constante',
    description: 'Mantener una racha de 7 días',
    icon: '🔥',
    category: 'streak',
    rarity: 'uncommon',
    criteria: { type: 'streak_days', value: 7 }
  },
  streak_30: {
    id: 'streak_30',
    name: 'Imparable',
    description: 'Mantener una racha de 30 días',
    icon: '⚡',
    category: 'streak',
    rarity: 'legendary',
    criteria: { type: 'streak_days', value: 30 }
  },
  
  // Logros sociales
  helpful: {
    id: 'helpful',
    name: 'Ayudante',
    description: 'Ayudar a 10 compañeros',
    icon: '🤝',
    category: 'social',
    rarity: 'rare',
    criteria: { type: 'peers_helped', value: 10 }
  },
  
  // Logros especiales
  early_bird: {
    id: 'early_bird',
    name: 'Madrugador',
    description: 'Completar una lección antes de las 7am',
    icon: '🌅',
    category: 'special',
    rarity: 'common',
    criteria: { type: 'early_lesson', value: 1 }
  },
  night_owl: {
    id: 'night_owl',
    name: 'Búho Nocturno',
    description: 'Completar una lección después de las 11pm',
    icon: '🦉',
    category: 'special',
    rarity: 'common',
    criteria: { type: 'night_lesson', value: 1 }
  },
  level_10: {
    id: 'level_10',
    name: 'Leyenda',
    description: 'Alcanzar nivel 10',
    icon: '👑',
    category: 'special',
    rarity: 'legendary',
    criteria: { type: 'level_reached', value: 10 }
  },
};

// ============================================
// CLASE PRINCIPAL DE GAMIFICACIÓN
// ============================================

class GamificationEngine {
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  /**
   * Registrar una acción y otorgar puntos
   */
  async awardPoints(
    userId: string,
    action: keyof typeof POINT_ACTIONS,
    metadata?: Record<string, any>
  ): Promise<{ 
    pointsAwarded: number; 
    newTotal: number;
    levelUp: boolean;
    newLevel?: number;
    badgesUnlocked: string[];
  }> {
    const actionConfig = POINT_ACTIONS[action];
    const points = actionConfig.points;

    try {
      // Agregar puntos
      const result = await gamificationService.addPoints(
        userId,
        points,
        actionConfig.action,
        actionConfig.description
      );

      if (!result) {
        console.error('Failed to add points - no result returned');
        return {
          pointsAwarded: 0,
          newTotal: 0,
          levelUp: false,
          badgesUnlocked: []
        };
      }

      // Verificar subida de nivel
      const levelUp = this.checkLevelUp(result.totalPoints, result.totalPoints - points);
      const currentLevel = this.calculateLevel(result.totalPoints);

      // Verificar insignias desbloqueadas
      const badgesUnlocked = await this.checkBadgeUnlocks(userId, action, metadata);

      // Registrar actividad
      await activityService.log({
        userId,
        userName: metadata?.userName || 'Usuario',
        type: 'system',
        action: `Ganó ${points} puntos`,
        description: actionConfig.description,
        createdAt: Date.now(),
        metadata: { points, action, ...metadata }
      });

      // Notificar si subió de nivel
      if (levelUp) {
        await this.notifyLevelUp(userId, currentLevel);
      }

      // Notificar insignias desbloqueadas
      for (const badgeId of badgesUnlocked) {
        await this.notifyBadgeUnlock(userId, badgeId);
      }

      // Emitir eventos
      this.emit('points_awarded', { userId, points, action, newTotal: result.totalPoints });
      
      if (levelUp) {
        this.emit('level_up', { userId, newLevel: currentLevel });
      }

      if (badgesUnlocked.length > 0) {
        this.emit('badges_unlocked', { userId, badges: badgesUnlocked });
      }

      return {
        pointsAwarded: points,
        newTotal: result.totalPoints,
        levelUp,
        newLevel: levelUp ? currentLevel : undefined,
        badgesUnlocked
      };
    } catch (error) {
      console.error('Error awarding points:', error);
      throw error;
    }
  }

  /**
   * Actualizar racha de aprendizaje
   */
  async updateStreak(userId: string): Promise<{
    currentStreak: number;
    longestStreak: number;
    streakBroken: boolean;
    badgesUnlocked: string[];
  }> {
    try {
      const result = await gamificationService.updateStreak(userId);
      const badgesUnlocked: string[] = [];
      
      if (!result) {
        return {
          currentStreak: 0,
          longestStreak: 0,
          streakBroken: false,
          badgesUnlocked: []
        };
      }

      // Verificar insignias de racha
      if (result.currentStreak >= 7) {
        const awarded = await this.tryAwardBadge(userId, 'streak_7');
        if (awarded) badgesUnlocked.push('streak_7');
      }
      if (result.currentStreak >= 30) {
        const awarded = await this.tryAwardBadge(userId, 'streak_30');
        if (awarded) badgesUnlocked.push('streak_30');
      }

      // Puntos por racha
      if (result.currentStreak === 7) {
        await this.awardPoints(userId, 'STREAK_7_DAYS');
      }
      if (result.currentStreak === 30) {
        await this.awardPoints(userId, 'STREAK_30_DAYS');
      }

      this.emit('streak_updated', { 
        oderId: userId, 
        currentStreak: result.currentStreak,
        longestStreak: result.longestStreak,
        badgesUnlocked 
      });

      const streakBroken = false; // Assuming no break since we're updating
      return { 
        currentStreak: result.currentStreak,
        longestStreak: result.longestStreak,
        streakBroken,
        badgesUnlocked 
      };
    } catch (error) {
      console.error('Error updating streak:', error);
      throw error;
    }
  }

  /**
   * Registrar completado de lección
   */
  async onLessonComplete(
    userId: string,
    lessonId: string,
    courseId: string,
    userName: string
  ): Promise<{ pointsAwarded: number; newTotal: number; levelUp: boolean; badgesUnlocked: string[] }> {
    // Otorgar puntos
    const result = await this.awardPoints(userId, 'COMPLETE_LESSON', { userName, lessonId, courseId });

    // Actualizar racha
    await this.updateStreak(userId);

    // Verificar hora del día para badges especiales
    const hour = new Date().getHours();
    if (hour < 7) {
      await this.tryAwardBadge(userId, 'early_bird');
    }
    if (hour >= 23) {
      await this.tryAwardBadge(userId, 'night_owl');
    }

    // Verificar badge de primera lección
    await this.tryAwardBadge(userId, 'first_lesson');
    
    return result;
  }

  /**
   * Registrar completado de módulo
   */
  async onModuleComplete(
    userId: string,
    moduleId: string,
    courseId: string,
    userName: string
  ): Promise<void> {
    await this.awardPoints(userId, 'COMPLETE_MODULE', { userName, moduleId, courseId });
  }

  /**
   * Registrar completado de curso
   */
  async onCourseComplete(
    userId: string,
    courseId: string,
    userName: string,
    grade?: number
  ): Promise<void> {
    await this.awardPoints(userId, 'COMPLETE_COURSE', { userName, courseId, grade });
    await this.tryAwardBadge(userId, 'first_course');
  }

  /**
   * Registrar evaluación completada
   */
  async onEvaluationComplete(
    userId: string,
    evaluationId: string,
    type: 'quiz' | 'exam',
    score: number,
    maxScore: number,
    userName: string
  ): Promise<void> {
    const percentage = (score / maxScore) * 100;
    const passed = percentage >= 60;

    // Puntos por enviar
    await this.awardPoints(userId, type === 'quiz' ? 'SUBMIT_QUIZ' : 'SUBMIT_EXAM', {
      userName,
      evaluationId,
      score,
      percentage
    });

    // Puntos adicionales por aprobar
    if (passed) {
      await this.awardPoints(userId, type === 'quiz' ? 'PASS_QUIZ' : 'PASS_EXAM', {
        userName,
        evaluationId
      });
    }

    // Puntos por puntuación perfecta
    if (percentage === 100) {
      await this.awardPoints(userId, 'PERFECT_QUIZ', { userName, evaluationId });
      await this.tryAwardBadge(userId, 'perfect_score');
    }
  }

  /**
   * Registrar login diario
   */
  async onDailyLogin(userId: string, userName: string): Promise<void> {
    // Verificar si ya se dio puntos hoy
    const today = new Date().toDateString();
    const lastLogin = localStorage.getItem(`lastLoginPoints_${userId}`);
    
    if (lastLogin !== today) {
      await this.awardPoints(userId, 'DAILY_LOGIN', { userName });
      localStorage.setItem(`lastLoginPoints_${userId}`, today);
    }

    // Actualizar racha
    await this.updateStreak(userId);
  }

  /**
   * Registrar obtención de certificado
   */
  async onCertificateEarned(
    userId: string,
    certificateId: string,
    courseName: string,
    userName: string
  ): Promise<void> {
    await this.awardPoints(userId, 'EARN_CERTIFICATE', {
      userName,
      certificateId,
      courseName
    });
  }

  /**
   * Registrar compartir certificado
   */
  async onCertificateShared(
    userId: string,
    certificateId: string,
    platform: string,
    userName: string
  ): Promise<void> {
    await this.awardPoints(userId, 'SHARE_CERTIFICATE', {
      userName,
      certificateId,
      platform
    });
  }

  /**
   * Registrar completado de paquete SCORM
   */
  async onSCORMComplete(
    userId: string,
    packageId: string,
    courseId: string,
    userName: string,
    score?: number
  ): Promise<void> {
    await this.awardPoints(userId, 'COMPLETE_SCORM', {
      userName,
      packageId,
      courseId,
      score
    });
  }

  /**
   * Registrar completado de actividad LTI
   */
  async onLTIComplete(
    userId: string,
    toolId: string,
    courseId: string,
    userName: string,
    grade?: number
  ): Promise<void> {
    await this.awardPoints(userId, 'COMPLETE_LTI', {
      userName,
      toolId,
      courseId,
      grade
    });
  }

  // ============================================
  // MÉTODOS AUXILIARES
  // ============================================

  private calculateLevel(totalPoints: number): number {
    for (let i = LEVELS.length - 1; i >= 0; i--) {
      if (totalPoints >= LEVELS[i].minPoints) {
        return LEVELS[i].level;
      }
    }
    return 1;
  }

  private checkLevelUp(newTotal: number, oldTotal: number): boolean {
    return this.calculateLevel(newTotal) > this.calculateLevel(oldTotal);
  }

  private async checkBadgeUnlocks(
    userId: string,
    action: keyof typeof POINT_ACTIONS,
    _metadata?: Record<string, any>
  ): Promise<string[]> {
    const unlocked: string[] = [];
    
    // Verificar badges basados en la acción
    switch (action) {
      case 'COMPLETE_LESSON':
        if (await this.tryAwardBadge(userId, 'first_lesson')) {
          unlocked.push('first_lesson');
        }
        break;
      case 'COMPLETE_COURSE':
        if (await this.tryAwardBadge(userId, 'first_course')) {
          unlocked.push('first_course');
        }
        break;
      case 'PERFECT_QUIZ':
        if (await this.tryAwardBadge(userId, 'perfect_score')) {
          unlocked.push('perfect_score');
        }
        break;
    }

    return unlocked;
  }

  private async tryAwardBadge(userId: string, badgeId: string): Promise<boolean> {
    try {
      const userBadges = await gamificationService.getUserBadges(userId);
      const alreadyHas = userBadges.some(b => b.badgeId === badgeId);
      
      if (!alreadyHas) {
        await gamificationService.awardBadge(userId, badgeId);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error awarding badge:', error);
      return false;
    }
  }

  private async notifyLevelUp(userId: string, newLevel: number): Promise<void> {
    const levelInfo = LEVELS.find(l => l.level === newLevel);
    
    await notificationService.create({
      userId,
      type: 'success',
      title: '¡Subiste de nivel! 🎉',
      message: `Ahora eres ${levelInfo?.name} ${levelInfo?.icon}`,
      link: '/gamification',
      read: false,
      createdAt: Date.now()
    });
  }

  private async notifyBadgeUnlock(userId: string, badgeId: string): Promise<void> {
    const badge = BADGE_CRITERIA[badgeId as keyof typeof BADGE_CRITERIA];
    if (!badge) return;

    await notificationService.create({
      userId,
      type: 'success',
      title: `¡Nueva insignia! ${badge.icon}`,
      message: `Desbloqueaste "${badge.name}": ${badge.description}`,
      link: '/gamification',
      read: false,
      createdAt: Date.now()
    });
  }

  // ============================================
  // SISTEMA DE EVENTOS
  // ============================================

  on(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    
    // Retornar función para desuscribirse
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  private emit(event: string, data: any): void {
    this.listeners.get(event)?.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
  }

  /**
   * Obtener información del nivel actual
   */
  getLevelInfo(points: number): {
    level: number;
    name: string;
    icon: string;
    currentPoints: number;
    nextLevelPoints: number;
    progress: number;
  } {
    const currentLevel = this.calculateLevel(points);
    const levelInfo = LEVELS.find(l => l.level === currentLevel)!;
    const nextLevel = LEVELS.find(l => l.level === currentLevel + 1);
    
    const pointsInLevel = points - levelInfo.minPoints;
    const pointsNeeded = nextLevel 
      ? nextLevel.minPoints - levelInfo.minPoints 
      : 0;
    const progress = nextLevel 
      ? Math.round((pointsInLevel / pointsNeeded) * 100) 
      : 100;

    return {
      level: currentLevel,
      name: levelInfo.name,
      icon: levelInfo.icon,
      currentPoints: pointsInLevel,
      nextLevelPoints: pointsNeeded,
      progress
    };
  }
}

// Exportar instancia singleton
export const gamificationEngine = new GamificationEngine();

// Exportar tipos
export type PointAction = keyof typeof POINT_ACTIONS;
export type BadgeId = keyof typeof BADGE_CRITERIA;
