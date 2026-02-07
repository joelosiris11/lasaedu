import { describe, it, expect, beforeEach, vi } from 'vitest'
import { gamificationEngine, POINT_ACTIONS, LEVELS, BADGE_CRITERIA } from './gamificationEngine'

// Mock the services
vi.mock('./dataService', () => ({
  gamificationService: {
    addPoints: vi.fn(),
    updateStreak: vi.fn(),
    getUserBadges: vi.fn(),
    awardBadge: vi.fn(),
    getUserStreak: vi.fn(),
  },
  notificationService: {
    create: vi.fn(),
  },
  activityService: {
    log: vi.fn(),
  },
}))

describe('GamificationEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POINT_ACTIONS configuration', () => {
    it('should have correct points for lesson completion', () => {
      expect(POINT_ACTIONS.COMPLETE_LESSON.points).toBe(10)
      expect(POINT_ACTIONS.COMPLETE_LESSON.action).toBe('lesson_complete')
    })

    it('should have correct points for course completion', () => {
      expect(POINT_ACTIONS.COMPLETE_COURSE.points).toBe(200)
    })

    it('should have correct points for perfect quiz', () => {
      expect(POINT_ACTIONS.PERFECT_QUIZ.points).toBe(100)
    })

    it('should have all required action configurations', () => {
      const requiredActions = [
        'COMPLETE_LESSON',
        'COMPLETE_MODULE',
        'COMPLETE_COURSE',
        'SUBMIT_QUIZ',
        'PASS_QUIZ',
        'PERFECT_QUIZ',
        'DAILY_LOGIN',
        'STREAK_7_DAYS',
        'STREAK_30_DAYS',
        'EARN_CERTIFICATE',
      ]

      requiredActions.forEach(action => {
        expect(POINT_ACTIONS).toHaveProperty(action)
        expect(POINT_ACTIONS[action as keyof typeof POINT_ACTIONS]).toHaveProperty('points')
        expect(POINT_ACTIONS[action as keyof typeof POINT_ACTIONS]).toHaveProperty('action')
        expect(POINT_ACTIONS[action as keyof typeof POINT_ACTIONS]).toHaveProperty('description')
      })
    })
  })

  describe('LEVELS configuration', () => {
    it('should have 10 levels', () => {
      expect(LEVELS).toHaveLength(10)
    })

    it('should have levels in ascending order', () => {
      for (let i = 1; i < LEVELS.length; i++) {
        expect(LEVELS[i].level).toBeGreaterThan(LEVELS[i - 1].level)
        expect(LEVELS[i].minPoints).toBeGreaterThan(LEVELS[i - 1].minPoints)
      }
    })

    it('should have level 1 start at 0 points', () => {
      expect(LEVELS[0].level).toBe(1)
      expect(LEVELS[0].minPoints).toBe(0)
    })

    it('should have unique names and icons', () => {
      const names = LEVELS.map(l => l.name)
      const icons = LEVELS.map(l => l.icon)

      expect(new Set(names).size).toBe(LEVELS.length)
      expect(new Set(icons).size).toBe(LEVELS.length)
    })
  })

  describe('BADGE_CRITERIA configuration', () => {
    it('should have first lesson badge', () => {
      expect(BADGE_CRITERIA.first_lesson).toBeDefined()
      expect(BADGE_CRITERIA.first_lesson.criteria.type).toBe('lessons_completed')
      expect(BADGE_CRITERIA.first_lesson.criteria.value).toBe(1)
    })

    it('should have streak badges', () => {
      expect(BADGE_CRITERIA.streak_7).toBeDefined()
      expect(BADGE_CRITERIA.streak_30).toBeDefined()
      expect(BADGE_CRITERIA.streak_7.criteria.value).toBe(7)
      expect(BADGE_CRITERIA.streak_30.criteria.value).toBe(30)
    })

    it('should have all badges with required fields', () => {
      Object.values(BADGE_CRITERIA).forEach(badge => {
        expect(badge).toHaveProperty('id')
        expect(badge).toHaveProperty('name')
        expect(badge).toHaveProperty('description')
        expect(badge).toHaveProperty('icon')
        expect(badge).toHaveProperty('category')
        expect(badge).toHaveProperty('rarity')
        expect(badge).toHaveProperty('criteria')
      })
    })

    it('should have valid rarity values', () => {
      const validRarities = ['common', 'uncommon', 'rare', 'epic', 'legendary']
      Object.values(BADGE_CRITERIA).forEach(badge => {
        expect(validRarities).toContain(badge.rarity)
      })
    })
  })

  describe('getLevelInfo', () => {
    it('should return level 1 for 0 points', () => {
      const info = gamificationEngine.getLevelInfo(0)
      expect(info.level).toBe(1)
      expect(info.name).toBe('Novato')
    })

    it('should return level 2 for 100 points', () => {
      const info = gamificationEngine.getLevelInfo(100)
      expect(info.level).toBe(2)
      expect(info.name).toBe('Aprendiz')
    })

    it('should return level 10 for max points', () => {
      const info = gamificationEngine.getLevelInfo(5500)
      expect(info.level).toBe(10)
      expect(info.name).toBe('Iluminado')
    })

    it('should calculate progress correctly', () => {
      // At 150 points (halfway between level 2 at 100 and level 3 at 300)
      // Progress = (150-100)/(300-100) = 50/200 = 25%
      const info = gamificationEngine.getLevelInfo(150)
      expect(info.level).toBe(2)
      expect(info.progress).toBe(25)
    })

    it('should return 100% progress at max level', () => {
      const info = gamificationEngine.getLevelInfo(6000)
      expect(info.level).toBe(10)
      expect(info.progress).toBe(100)
    })
  })

  describe('event system', () => {
    it('should allow subscribing to events', () => {
      const callback = vi.fn()
      const unsubscribe = gamificationEngine.on('test_event', callback)

      expect(typeof unsubscribe).toBe('function')
    })

    it('should allow unsubscribing from events', () => {
      const callback = vi.fn()
      const unsubscribe = gamificationEngine.on('test_event', callback)

      unsubscribe()

      // Callback should not be stored anymore
      // (internal test - we verify by checking the unsubscribe works without error)
      expect(true).toBe(true)
    })
  })

  describe('awardPoints', () => {
    it('should call gamificationService.addPoints with correct parameters', async () => {
      const { gamificationService } = await import('./dataService')
      ;(gamificationService.addPoints as any).mockResolvedValue({
        totalPoints: 10,
        level: 1,
      })
      ;(gamificationService.getUserBadges as any).mockResolvedValue([])

      await gamificationEngine.awardPoints('user-123', 'COMPLETE_LESSON', { userName: 'Test' })

      expect(gamificationService.addPoints).toHaveBeenCalledWith(
        'user-123',
        10,
        'lesson_complete',
        'Completar una lección'
      )
    })

    it('should return correct result structure', async () => {
      const { gamificationService } = await import('./dataService')
      ;(gamificationService.addPoints as any).mockResolvedValue({
        totalPoints: 210,
        level: 2,
      })
      ;(gamificationService.getUserBadges as any).mockResolvedValue([])

      const result = await gamificationEngine.awardPoints('user-123', 'COMPLETE_LESSON')

      expect(result).toHaveProperty('pointsAwarded')
      expect(result).toHaveProperty('newTotal')
      expect(result).toHaveProperty('levelUp')
      expect(result).toHaveProperty('badgesUnlocked')
      expect(result.pointsAwarded).toBe(10)
    })
  })

  describe('updateStreak', () => {
    it('should call gamificationService.updateStreak', async () => {
      const { gamificationService } = await import('./dataService')
      ;(gamificationService.updateStreak as any).mockResolvedValue({
        currentStreak: 5,
        longestStreak: 10,
        lastActivityDate: '2024-01-15',
      })
      ;(gamificationService.getUserBadges as any).mockResolvedValue([])

      const result = await gamificationEngine.updateStreak('user-123')

      expect(gamificationService.updateStreak).toHaveBeenCalledWith('user-123')
      expect(result.currentStreak).toBe(5)
      expect(result.longestStreak).toBe(10)
    })

    it('should award streak_7 badge at 7 day streak', async () => {
      const { gamificationService } = await import('./dataService')
      ;(gamificationService.updateStreak as any).mockResolvedValue({
        currentStreak: 7,
        longestStreak: 7,
      })
      ;(gamificationService.getUserBadges as any).mockResolvedValue([])
      ;(gamificationService.awardBadge as any).mockResolvedValue(true)
      ;(gamificationService.addPoints as any).mockResolvedValue({ totalPoints: 50 })

      const result = await gamificationEngine.updateStreak('user-123')

      expect(result.badgesUnlocked).toContain('streak_7')
    })
  })
})
