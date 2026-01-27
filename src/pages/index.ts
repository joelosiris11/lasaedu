// Re-export de módulos de autenticación
export { default as LoginPage } from '../modules/auth/pages/LoginPage';
export { default as RegisterPage } from '../modules/auth/pages/RegisterPage';
export { default as RecoveryPage } from '../modules/auth/pages/RecoveryPage';

// Re-export de componentes de layout
export { default as MainLayout } from '../shared/components/layout/MainLayout';
export { default as ProtectedRoute } from '../modules/auth/components/ProtectedRoute';

// Re-export de dashboards
export { default as AdminDashboard } from '../modules/dashboard/pages/AdminDashboard';
export { default as TeacherDashboard } from '../modules/dashboard/pages/TeacherDashboard';
export { default as StudentDashboard } from '../modules/dashboard/pages/StudentDashboard';
export { default as SupportDashboard } from '../modules/dashboard/pages/SupportDashboard';

// Re-export de módulos principales
export { default as UsersPage } from '../modules/users/pages/UsersPage';
export { default as CoursesPage } from '../modules/courses/pages/CoursesPage';
export { default as EvaluationsPage } from '../modules/evaluations/pages/EvaluationsPage';
export { default as CommunicationPage } from '../modules/communication/pages/CommunicationPage';