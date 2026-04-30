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
  SupervisorDashboard,
  StudentDashboard,
  SupportDashboard,
  UsersPage,
  OrganizationPage,
  CoursesPage,
  CommunicationPage
} from '@/pages';
import CourseDetailPage from '@modules/courses/pages/CourseDetailPage';
import LessonViewPage from '@modules/courses/pages/LessonViewPage';
import LessonBuilderPage from '@modules/courses/pages/LessonBuilderPage';
import EvaluationBuilderPage from '@modules/evaluations/pages/EvaluationBuilderPage';
import TakeEvaluationPage from '@modules/evaluations/pages/TakeEvaluationPage';
import GradesPage from '@modules/grades/pages/GradesPage';
import CertificatesPage from '@modules/certificates/pages/CertificatesPage';
import SupportPage from '@modules/support/pages/SupportPage';
import SettingsPage from '@modules/settings/pages/SettingsPage';

// Import new critical pages
import EnrollmentManagementPage from '@modules/enrollments/pages/EnrollmentManagementPage';
import ForumsPage from '@modules/forums/pages/ForumsPage';

// Audit pages
import AuditLogsPage from '@modules/audit/pages/AuditLogsPage';
import StudentActivityPage from '@modules/audit/pages/StudentActivityPage';

// Section pages
import MySectionsPage from '@modules/courses/pages/MySectionsPage';
import SectionDatesPage from '@modules/courses/pages/SectionDatesPage';
import SectionDetailPage from '@modules/courses/pages/SectionDetailPage';
import SectionGradesPage from '@modules/courses/pages/SectionGradesPage';

// Quiz popup (standalone, no layout)
import QuizPopupPage from '@modules/courses/pages/QuizPopupPage';

// AI assistant (admin-only content editor)
import AIAssistantPage from '@modules/ai-assistant/pages/AIAssistantPage';

// Componente para página no encontrada
const NotFoundPage = () => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
    <h1 className="text-6xl font-bold text-gray-300">404</h1>
    <p className="text-xl text-gray-600 mt-4">Página no encontrada</p>
    <a href="/dashboard" className="mt-6 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
      Volver al inicio
    </a>
  </div>
);

// Componente para acceso no autorizado
const UnauthorizedPage = () => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
    <h1 className="text-6xl font-bold text-red-300">403</h1>
    <p className="text-xl text-gray-600 mt-4">No tienes permiso para acceder a esta página</p>
    <a href="/dashboard" className="mt-6 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
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
    case 'supervisor':
      return <SupervisorDashboard />;
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
  // Quiz popup — standalone window, no MainLayout
  {
    path: '/quiz/:sectionId/:lessonId',
    element: (
      <ProtectedRoute allowedRoles={['student']}>
        <QuizPopupPage />
      </ProtectedRoute>
    )
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
        path: 'organization',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'supervisor']}>
            <OrganizationPage />
          </ProtectedRoute>
        )
      },
      {
        path: 'courses',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'supervisor', 'teacher']}>
            <CoursesPage />
          </ProtectedRoute>
        )
      },
      {
        path: 'courses/:courseId',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'supervisor', 'teacher', 'student']}>
            <CourseDetailPage />
          </ProtectedRoute>
        )
      },
      {
        path: 'courses/:courseId/lesson/:lessonId',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'supervisor', 'teacher', 'student']}>
            <LessonViewPage />
          </ProtectedRoute>
        )
      },
      {
        path: 'courses/:courseId/modules/:moduleId/lessons/new',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'supervisor', 'teacher']}>
            <LessonBuilderPage />
          </ProtectedRoute>
        )
      },
      {
        path: 'courses/:courseId/modules/:moduleId/lessons/:lessonId/edit',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'supervisor', 'teacher']}>
            <LessonBuilderPage />
          </ProtectedRoute>
        )
      },
      // Section routes
      {
        path: 'my-sections',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'supervisor', 'teacher', 'student']}>
            <MySectionsPage />
          </ProtectedRoute>
        )
      },
      {
        path: 'sections/:sectionId/dates',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'supervisor', 'teacher']}>
            <SectionDatesPage />
          </ProtectedRoute>
        )
      },
      {
        path: 'sections/:sectionId/grades',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'supervisor', 'teacher']}>
            <SectionGradesPage />
          </ProtectedRoute>
        )
      },
      {
        path: 'sections/:sectionId',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'supervisor', 'teacher', 'student']}>
            <SectionDetailPage />
          </ProtectedRoute>
        )
      },
      {
        path: 'sections/:sectionId/lesson/:lessonId',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'supervisor', 'teacher', 'student']}>
            <LessonViewPage />
          </ProtectedRoute>
        )
      },
      {
        path: 'evaluations/:evaluationId/edit',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'supervisor', 'teacher']}>
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
          <ProtectedRoute allowedRoles={['admin', 'supervisor', 'teacher', 'student']}>
            <CommunicationPage />
          </ProtectedRoute>
        )
      },
      {
        path: 'forums',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'supervisor', 'teacher', 'student']}>
            <ForumsPage />
          </ProtectedRoute>
        )
      },
      {
        path: 'grades',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'supervisor', 'teacher', 'student']}>
            <GradesPage />
          </ProtectedRoute>
        )
      },
      {
        path: 'certificates',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'supervisor', 'teacher', 'student']}>
            <CertificatesPage />
          </ProtectedRoute>
        )
      },
      {
        path: 'support',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'supervisor', 'support', 'teacher', 'student']}>
            <SupportPage />
          </ProtectedRoute>
        )
      },
      {
        path: 'enrollments',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'supervisor', 'teacher']}>
            <EnrollmentManagementPage />
          </ProtectedRoute>
        )
      },
      {
        path: 'user-management',
        element: <Navigate to="/users" replace />
      },
      {
        path: 'settings',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'supervisor', 'teacher', 'student', 'support']}>
            <SettingsPage />
          </ProtectedRoute>
        )
      },
      {
        path: 'ai-assistant',
        element: (
          <ProtectedRoute allowedRoles={['admin']}>
            <AIAssistantPage />
          </ProtectedRoute>
        )
      },
      {
        path: 'audit-logs',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'supervisor', 'teacher']}>
            <AuditLogsPage />
          </ProtectedRoute>
        )
      },
      {
        path: 'student-activity',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'supervisor', 'teacher']}>
            <StudentActivityPage />
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