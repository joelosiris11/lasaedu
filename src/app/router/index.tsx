import { createBrowserRouter, Navigate } from 'react-router-dom';
import { useAuthStore } from '@app/store/authStore';
import {
  LoginPage,
  RegisterPage,
  RecoveryPage,
  MainLayout,
  ProtectedRoute,
  AdminDashboard,
  TeacherDashboard,
  StudentDashboard,
  SupportDashboard,
  UsersPage,
  CoursesPage,
  EvaluationsPage,
  CommunicationPage
} from '@/pages';
import CourseDetailPage from '@modules/courses/pages/CourseDetailPage';
import CourseWizardPage from '@modules/courses/pages/CourseWizardPage';
import LessonViewPage from '@modules/courses/pages/LessonViewPage';
import LessonBuilderPage from '@modules/courses/pages/LessonBuilderPage';
import CourseCatalogPage from '@modules/courses/pages/CourseCatalogPage';
import EvaluationBuilderPage from '@modules/evaluations/pages/EvaluationBuilderPage';
import TakeEvaluationPage from '@modules/evaluations/pages/TakeEvaluationPage';
import GradesPage from '@modules/grades/pages/GradesPage';
import CertificatesPage from '@modules/certificates/pages/CertificatesPage';
import GamificationPage from '@modules/gamification/pages/GamificationPage';
import SupportPage from '@modules/support/pages/SupportPage';
import ReportsPage from '@modules/analytics/pages/ReportsPage';
import SettingsPage from '@modules/settings/pages/SettingsPage';
import MyProgressPage from '@modules/progress/pages/MyProgressPage';

// Import new critical pages
import EnrollmentManagementPage from '@modules/enrollments/pages/EnrollmentManagementPage';
import NotificationSystemPage from '@modules/notifications/pages/NotificationSystemPage';
import UserManagementPage from '@modules/users/pages/UserManagementPage';
import ForumsPage from '@modules/forums/pages/ForumsPage';

// Componente para página no encontrada
const NotFoundPage = () => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
    <h1 className="text-6xl font-bold text-gray-300">404</h1>
    <p className="text-xl text-gray-600 mt-4">Página no encontrada</p>
    <a href="/dashboard" className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
      Volver al inicio
    </a>
  </div>
);

// Componente para acceso no autorizado
const UnauthorizedPage = () => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
    <h1 className="text-6xl font-bold text-red-300">403</h1>
    <p className="text-xl text-gray-600 mt-4">No tienes permiso para acceder a esta página</p>
    <a href="/dashboard" className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
      Volver al inicio
    </a>
  </div>
);

// Componente para redirigir al dashboard apropiado según el rol
const DashboardRedirect = () => {
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  switch (user.role) {
    case 'admin':
      return <AdminDashboard />;
    case 'teacher':
      return <TeacherDashboard />;
    case 'student':
      return <StudentDashboard />;
    case 'support':
      return <SupportDashboard />;
    default:
      return <Navigate to="/login" replace />;
  }
};

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />
  },
  {
    path: '/register',
    element: <RegisterPage />
  },
  {
    path: '/recovery',
    element: <RecoveryPage />
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />
      },
      {
        path: 'dashboard',
        element: <DashboardRedirect />
      },
      {
        path: 'users',
        element: (
          <ProtectedRoute allowedRoles={['admin']}>
            <UsersPage />
          </ProtectedRoute>
        )
      },
      {
        path: 'courses',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'teacher', 'student']}>
            <CoursesPage />
          </ProtectedRoute>
        )
      },
      {
        path: 'courses/new',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'teacher']}>
            <CourseWizardPage />
          </ProtectedRoute>
        )
      },
      {
        path: 'courses/:courseId',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'teacher', 'student']}>
            <CourseDetailPage />
          </ProtectedRoute>
        )
      },
      {
        path: 'courses/:courseId/lesson/:lessonId',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'teacher', 'student']}>
            <LessonViewPage />
          </ProtectedRoute>
        )
      },
      {
        path: 'courses/:courseId/modules/:moduleId/lessons/new',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'teacher']}>
            <LessonBuilderPage />
          </ProtectedRoute>
        )
      },
      {
        path: 'courses/:courseId/modules/:moduleId/lessons/:lessonId/edit',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'teacher']}>
            <LessonBuilderPage />
          </ProtectedRoute>
        )
      },
      {
        path: 'evaluations',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'teacher', 'student']}>
            <EvaluationsPage />
          </ProtectedRoute>
        )
      },
      {
        path: 'evaluations/:evaluationId/edit',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'teacher']}>
            <EvaluationBuilderPage />
          </ProtectedRoute>
        )
      },
      {
        path: 'evaluations/:evaluationId/take',
        element: (
          <ProtectedRoute allowedRoles={['student']}>
            <TakeEvaluationPage />
          </ProtectedRoute>
        )
      },
      {
        path: 'communication',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'teacher', 'student']}>
            <CommunicationPage />
          </ProtectedRoute>
        )
      },
      {
        path: 'forums',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'teacher', 'student']}>
            <ForumsPage />
          </ProtectedRoute>
        )
      },
      {
        path: 'grades',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'teacher', 'student']}>
            <GradesPage />
          </ProtectedRoute>
        )
      },
      {
        path: 'certificates',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'teacher', 'student']}>
            <CertificatesPage />
          </ProtectedRoute>
        )
      },
      {
        path: 'gamification',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'teacher', 'student']}>
            <GamificationPage />
          </ProtectedRoute>
        )
      },
      {
        path: 'support',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'support', 'teacher', 'student']}>
            <SupportPage />
          </ProtectedRoute>
        )
      },
      {
        path: 'enrollments',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'teacher']}>
            <EnrollmentManagementPage />
          </ProtectedRoute>
        )
      },
      {
        path: 'notifications',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'teacher']}>
            <NotificationSystemPage />
          </ProtectedRoute>
        )
      },
      {
        path: 'user-management',
        element: (
          <ProtectedRoute allowedRoles={['admin']}>
            <UserManagementPage />
          </ProtectedRoute>
        )
      },
      {
        path: 'reports',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'teacher']}>
            <ReportsPage />
          </ProtectedRoute>
        )
      },
      {
        path: 'settings',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'teacher', 'student', 'support']}>
            <SettingsPage />
          </ProtectedRoute>
        )
      },
      {
        path: 'catalog',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'teacher', 'student']}>
            <CourseCatalogPage />
          </ProtectedRoute>
        )
      },
      {
        path: 'progress',
        element: (
          <ProtectedRoute allowedRoles={['student']}>
            <MyProgressPage />
          </ProtectedRoute>
        )
      },
      {
        path: '*',
        element: <NotFoundPage />
      }
    ]
  },
  {
    path: '/unauthorized',
    element: <UnauthorizedPage />
  },
  {
    path: '*',
    element: <NotFoundPage />
  }
]);

export default router;