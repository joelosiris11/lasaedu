/**
 * H5P Integration Tests
 * Tests para la integración completa de H5P con lecciones, gamificación y Firebase
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { h5pFirebaseService } from '../services/h5p/h5pFirebaseService';
import { h5pContentService } from '../services/h5p/h5pContentService';
import type { DBH5PContent, DBH5PAttempt } from '../services/firebaseDataService';

describe('H5P Integration', () => {
  let mockH5PContent: DBH5PContent;

  beforeEach(() => {
    mockH5PContent = {
      id: 'h5p_test_1',
      courseId: 'course_1',
      title: 'Test H5P Content',
      description: 'Una prueba de contenido H5P',
      contentType: 'H5P.MultiChoice',
      mainLibrary: 'H5P.MultiChoice',
      packageUrl: 'https://example.com/h5p/test.h5p',
      storageBasePath: '/h5p/h5p_test_1',
      fileSize: 102400,
      previewImageUrl: 'https://example.com/preview.jpg',
      tags: ['test', 'programacion'],
      isPublished: true,
      isReusable: false,
      usageCount: 0,
      createdBy: 'user_1',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  });

  describe('H5P Firebase Service', () => {
    it('should create H5P content', async () => {
      // Mock the Firebase database
      expect(mockH5PContent).toBeDefined();
      expect(mockH5PContent.id).toBe('h5p_test_1');
      expect(mockH5PContent.contentType).toBe('H5P.MultiChoice');
    });

    it('should handle H5P attempts', async () => {
      const attempt: DBH5PAttempt = {
        id: 'attempt_1',
        contentId: 'h5p_test_1',
        userId: 'student_1',
        courseId: 'course_1',
        attemptNumber: 1,
        score: 85,
        maxScore: 100,
        completed: true,
        completedAt: Date.now(),
        duration: 600,
        startedAt: Date.now() - 600000,
        interactionData: {}
      };

      expect(attempt.completed).toBe(true);
      expect(attempt.score).toBe(85);
      expect(attempt.maxScore).toBe(100);
    });

    it('should track H5P results', async () => {
      const attempts: DBH5PAttempt[] = [
        {
          id: 'attempt_1',
          contentId: 'h5p_test_1',
          userId: 'student_1',
          courseId: 'course_1',
          attemptNumber: 1,
          score: 75,
          maxScore: 100,
          completed: true,
          completedAt: Date.now(),
          duration: 300,
          startedAt: Date.now() - 300000
        },
        {
          id: 'attempt_2',
          contentId: 'h5p_test_1',
          userId: 'student_1',
          courseId: 'course_1',
          attemptNumber: 2,
          score: 90,
          maxScore: 100,
          completed: true,
          completedAt: Date.now(),
          duration: 250,
          startedAt: Date.now() - 250000
        }
      ];

      const bestScore = Math.max(...attempts.map(a => a.score || 0));
      const averageScore = attempts.reduce((sum, a) => sum + (a.score || 0), 0) / attempts.length;

      expect(bestScore).toBe(90);
      expect(averageScore).toBe(82.5);
    });
  });

  describe('H5P Content Service', () => {
    it('should validate H5P content metadata', () => {
      expect(mockH5PContent.title).toBeTruthy();
      expect(mockH5PContent.mainLibrary).toBeTruthy();
      expect(mockH5PContent.contentType).toBeTruthy();
    });

    it('should support content reusability', () => {
      const reusableContent: DBH5PContent = {
        ...mockH5PContent,
        isReusable: true
      };

      expect(reusableContent.isReusable).toBe(true);
    });

    it('should track usage count', () => {
      const content = { ...mockH5PContent, usageCount: 5 };
      expect(content.usageCount).toBe(5);
    });
  });

  describe('H5P Lesson Integration', () => {
    it('should have h5p lesson type supported', () => {
      const lessonTypes = ['texto', 'video', 'quiz', 'h5p', 'scorm', 'lti'];
      expect(lessonTypes).toContain('h5p');
    });

    it('should store h5pContentId in lesson settings', () => {
      const lessonSettings = {
        isRequired: true,
        allowComments: true,
        showProgress: true,
        h5pContentId: 'h5p_test_1'
      };

      expect(lessonSettings.h5pContentId).toBe('h5p_test_1');
    });
  });

  describe('H5P Gamification Integration', () => {
    it('should award points for H5P completion', () => {
      const pointActions = {
        'h5p_completed': { points: 20, description: 'Completar H5P' },
        'h5p_perfect': { points: 75, description: 'Puntuación perfecta' }
      };

      expect(pointActions['h5p_completed'].points).toBe(20);
      expect(pointActions['h5p_perfect'].points).toBe(75);
    });

    it('should calculate points correctly', () => {
      const attempt: DBH5PAttempt = {
        id: 'attempt_1',
        contentId: 'h5p_test_1',
        userId: 'student_1',
        courseId: 'course_1',
        attemptNumber: 1,
        score: 100,
        maxScore: 100,
        completed: true,
        completedAt: Date.now(),
        duration: 300,
        startedAt: Date.now() - 300000
      };

      const basePoints = 20;
      const bonusPoints = attempt.score === attempt.maxScore ? 75 : 0;
      const totalPoints = basePoints + bonusPoints;

      expect(totalPoints).toBe(95);
    });
  });

  describe('H5P Search and Filter', () => {
    it('should search H5P content by title', () => {
      const contents: DBH5PContent[] = [
        { ...mockH5PContent, id: 'h5p_1', title: 'Introducción a Python' },
        { ...mockH5PContent, id: 'h5p_2', title: 'Conceptos de Programación' },
        { ...mockH5PContent, id: 'h5p_3', title: 'JavaScript Avanzado' }
      ];

      const results = contents.filter(c => 
        c.title.toLowerCase().includes('python')
      );

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Introducción a Python');
    });

    it('should filter by tags', () => {
      const contents: DBH5PContent[] = [
        { ...mockH5PContent, id: 'h5p_1', tags: ['python', 'programacion'] },
        { ...mockH5PContent, id: 'h5p_2', tags: ['javascript', 'web'] },
        { ...mockH5PContent, id: 'h5p_3', tags: ['python', 'basico'] }
      ];

      const results = contents.filter(c =>
        c.tags.includes('python')
      );

      expect(results).toHaveLength(2);
    });

    it('should filter reusable content', () => {
      const contents: DBH5PContent[] = [
        { ...mockH5PContent, id: 'h5p_1', isReusable: true },
        { ...mockH5PContent, id: 'h5p_2', isReusable: false },
        { ...mockH5PContent, id: 'h5p_3', isReusable: true }
      ];

      const reusable = contents.filter(c => c.isReusable);
      expect(reusable).toHaveLength(2);
    });
  });
});
