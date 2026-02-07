import type { ReactElement } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'

// Mock user for testing
export const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  role: 'student' as const,
  avatar: '',
  createdAt: Date.now(),
}

export const mockAdmin = {
  ...mockUser,
  id: 'test-admin-id',
  email: 'admin@example.com',
  name: 'Admin User',
  role: 'admin' as const,
}

export const mockTeacher = {
  ...mockUser,
  id: 'test-teacher-id',
  email: 'teacher@example.com',
  name: 'Teacher User',
  role: 'teacher' as const,
}

// Mock course
export const mockCourse = {
  id: 'test-course-id',
  title: 'Test Course',
  description: 'A test course for testing',
  instructor: 'Test Instructor',
  instructorId: 'test-teacher-id',
  category: 'development',
  level: 'beginner' as const,
  duration: 10,
  modules: 5,
  lessons: 20,
  thumbnail: '',
  rating: 4.5,
  enrolledCount: 100,
  status: 'published' as const,
  createdAt: Date.now(),
  updatedAt: Date.now(),
}

// Mock enrollment
export const mockEnrollment = {
  id: 'test-enrollment-id',
  userId: 'test-user-id',
  courseId: 'test-course-id',
  status: 'active' as const,
  progress: 50,
  grade: 0,
  enrolledAt: Date.now(),
  createdAt: Date.now(),
  updatedAt: Date.now(),
}

// Mock badge
export const mockBadge = {
  id: 'test-badge-id',
  name: 'First Steps',
  description: 'Complete your first lesson',
  icon: 'trophy',
  category: 'achievement',
  criteria: {
    type: 'lessons_completed',
    threshold: 1,
  },
  points: 10,
  rarity: 'common' as const,
}

// Mock notification
export const mockNotification = {
  id: 'test-notification-id',
  userId: 'test-user-id',
  title: 'Test Notification',
  message: 'This is a test notification',
  type: 'info' as const,
  read: false,
  createdAt: Date.now(),
}

// Custom render with providers
interface WrapperProps {
  children: React.ReactNode
}

const AllTheProviders = ({ children }: WrapperProps) => {
  return (
    <BrowserRouter>
      {children}
    </BrowserRouter>
  )
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options })

export * from '@testing-library/react'
export { customRender as render }
