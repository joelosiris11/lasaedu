import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

// Use vi.hoisted to create mock functions before vi.mock is hoisted
const {
  mockGetSystemStats,
  mockGetRecentActivity,
  mockGetSystemMetrics,
  mockGetTeacherCourses,
  mockGetStudentCourses,
  mockGetSupportTickets,
  mockGetSupportStats,
} = vi.hoisted(() => ({
  mockGetSystemStats: vi.fn(),
  mockGetRecentActivity: vi.fn(),
  mockGetSystemMetrics: vi.fn(),
  mockGetTeacherCourses: vi.fn(),
  mockGetStudentCourses: vi.fn(),
  mockGetSupportTickets: vi.fn(),
  mockGetSupportStats: vi.fn(),
}))

vi.mock('@shared/services/dataService', () => ({
  dashboardService: {
    getSystemStats: mockGetSystemStats,
    getRecentActivity: mockGetRecentActivity,
    getSystemMetrics: mockGetSystemMetrics,
    getTeacherCourses: mockGetTeacherCourses,
    getStudentCourses: mockGetStudentCourses,
    getSupportTickets: mockGetSupportTickets,
    getSupportStats: mockGetSupportStats,
  },
}))

import {
  useSystemStats,
  useRecentActivity,
  useSystemMetrics,
  useTeacherCourses,
  useStudentCourses,
  useSupportTickets,
  useSupportStats,
} from './useDashboard'

describe('Dashboard Hooks', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('useSystemStats', () => {
    it('should return loading state initially', async () => {
      mockGetSystemStats.mockResolvedValue({
        totalUsers: 100,
        activeStudents: 50,
      })

      const { result } = renderHook(() => useSystemStats())

      expect(result.current.loading).toBe(true)
      expect(result.current.stats).toBeNull()
    })

    it('should return stats after loading', async () => {
      const mockStats = {
        totalUsers: 100,
        activeStudents: 50,
        activeCourses: 20,
        totalEnrollments: 150,
        openTickets: 5,
        totalTeachers: 10,
        completedCourses: 8,
      }

      mockGetSystemStats.mockResolvedValue(mockStats)

      const { result } = renderHook(() => useSystemStats())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      }, { timeout: 1000 })

      expect(result.current.stats).toEqual(mockStats)
      expect(result.current.error).toBeNull()
    })

    it('should set error on failure', async () => {
      mockGetSystemStats.mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(() => useSystemStats())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      }, { timeout: 1000 })

      expect(result.current.error).toBe('Network error')
      expect(result.current.stats).toBeNull()
    })

    it('should cleanup interval on unmount', async () => {
      mockGetSystemStats.mockResolvedValue({})

      const { unmount } = renderHook(() => useSystemStats())

      await waitFor(() => {
        expect(mockGetSystemStats).toHaveBeenCalledTimes(1)
      }, { timeout: 1000 })

      unmount()

      // Fast-forward time - should NOT trigger another fetch
      await act(async () => {
        vi.advanceTimersByTime(30000)
      })

      // Should still be only 1 call since we unmounted
      expect(mockGetSystemStats).toHaveBeenCalledTimes(1)
    })
  })

  describe('useRecentActivity', () => {
    it('should fetch activities with default limit', async () => {
      const mockActivities = [
        { id: '1', type: 'login', action: 'User logged in' },
        { id: '2', type: 'lesson', action: 'Completed lesson' },
      ]

      mockGetRecentActivity.mockResolvedValue(mockActivities)

      const { result } = renderHook(() => useRecentActivity())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      }, { timeout: 1000 })

      expect(mockGetRecentActivity).toHaveBeenCalledWith(10)
      expect(result.current.activities).toEqual(mockActivities)
    })

    it('should fetch activities with custom limit', async () => {
      mockGetRecentActivity.mockResolvedValue([])

      renderHook(() => useRecentActivity(5))

      await waitFor(() => {
        expect(mockGetRecentActivity).toHaveBeenCalledWith(5)
      }, { timeout: 1000 })
    })
  })

  describe('useSystemMetrics', () => {
    it('should return metrics after loading', async () => {
      const mockMetrics = {
        activeUsers: 50,
        totalUsers: 100,
        avgProgress: 65.5,
        totalCourses: 20,
        publishedCourses: 15,
        totalEnrollments: 200,
      }

      mockGetSystemMetrics.mockResolvedValue(mockMetrics)

      const { result } = renderHook(() => useSystemMetrics())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      }, { timeout: 1000 })

      expect(result.current.metrics).toEqual(mockMetrics)
    })
  })

  describe('useTeacherCourses', () => {
    it('should fetch courses for teacher', async () => {
      const mockCourses = [
        { id: 'course-1', title: 'Course 1' },
        { id: 'course-2', title: 'Course 2' },
      ]

      mockGetTeacherCourses.mockResolvedValue(mockCourses)

      const { result } = renderHook(() => useTeacherCourses('teacher-123'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      }, { timeout: 1000 })

      expect(mockGetTeacherCourses).toHaveBeenCalledWith('teacher-123')
      expect(result.current.courses).toEqual(mockCourses)
    })

    it('should not fetch if teacherId is empty', async () => {
      renderHook(() => useTeacherCourses(''))

      // Wait a bit to ensure no fetch was made
      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      expect(mockGetTeacherCourses).not.toHaveBeenCalled()
    })
  })

  describe('useStudentCourses', () => {
    it('should fetch courses for student', async () => {
      const mockCourses = [
        { id: 'course-1', title: 'My Course', progress: 50 },
      ]

      mockGetStudentCourses.mockResolvedValue(mockCourses)

      const { result } = renderHook(() => useStudentCourses('student-123'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      }, { timeout: 1000 })

      expect(mockGetStudentCourses).toHaveBeenCalledWith('student-123')
      expect(result.current.courses).toEqual(mockCourses)
    })

    it('should not fetch if studentId is empty', async () => {
      renderHook(() => useStudentCourses(''))

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      expect(mockGetStudentCourses).not.toHaveBeenCalled()
    })
  })

  describe('useSupportTickets', () => {
    it('should fetch all tickets when no assigneeId', async () => {
      const mockTickets = [
        { id: 'ticket-1', subject: 'Help needed' },
      ]

      mockGetSupportTickets.mockResolvedValue(mockTickets)

      const { result } = renderHook(() => useSupportTickets())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      }, { timeout: 1000 })

      expect(mockGetSupportTickets).toHaveBeenCalledWith(undefined)
      expect(result.current.tickets).toEqual(mockTickets)
    })

    it('should fetch tickets for specific assignee', async () => {
      mockGetSupportTickets.mockResolvedValue([])

      renderHook(() => useSupportTickets('support-123'))

      await waitFor(() => {
        expect(mockGetSupportTickets).toHaveBeenCalledWith('support-123')
      }, { timeout: 1000 })
    })
  })

  describe('useSupportStats', () => {
    it('should fetch support statistics', async () => {
      const mockStats = {
        openTickets: 10,
        closedTickets: 50,
        avgResponseTime: 120,
      }

      mockGetSupportStats.mockResolvedValue(mockStats)

      const { result } = renderHook(() => useSupportStats())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      }, { timeout: 1000 })

      expect(result.current.stats).toEqual(mockStats)
    })
  })
})
