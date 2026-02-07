import { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from '@modules/auth/components/ProtectedRoute'
import MainLayout from '@shared/components/layout/MainLayout'

// Lazy load pages for code splitting
const LoginPage = lazy(() => import('@modules/auth/pages/LoginPage'))
const RegisterPage = lazy(() => import('@modules/auth/pages/RegisterPage'))
const RecoveryPage = lazy(() => import('@modules/auth/pages/RecoveryPage'))
const VerifyCertificatePage = lazy(() => import('@modules/certificates/pages/VerifyCertificatePage'))

// Lazy load dashboards (largest bundles)
const AdminDashboard = lazy(() => import('@modules/dashboard/pages/AdminDashboard'))
const TeacherDashboard = lazy(() => import('@modules/dashboard/pages/TeacherDashboard'))
const StudentDashboard = lazy(() => import('@modules/dashboard/pages/StudentDashboard'))
const SupportDashboard = lazy(() => import('@modules/dashboard/pages/SupportDashboard'))

// Loading fallback component
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Cargando...</p>
      </div>
    </div>
  )
}

function App() {
  return (
    <Router>
      <MainLayout>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/recovery" element={<RecoveryPage />} />
            <Route path="/verify/:certificateId" element={<VerifyCertificatePage />} />

            {/* Protected Routes */}
            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route path="/admin/*" element={<AdminDashboard />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={['teacher']} />}>
              <Route path="/teacher/*" element={<TeacherDashboard />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={['student']} />}>
              <Route path="/student/*" element={<StudentDashboard />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={['support']} />}>
              <Route path="/support/*" element={<SupportDashboard />} />
            </Route>

            {/* Default redirect to login for now */}
            <Route path="/" element={<Navigate to="/login" replace />} />

            {/* Unauthorized page */}
            <Route
              path="/unauthorized"
              element={
                <div className="min-h-screen flex items-center justify-center bg-gray-50">
                  <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 text-center">
                    <h1 className="text-2xl font-bold text-red-600 mb-4">Sin Autorización</h1>
                    <p className="text-gray-600">No tienes permisos para acceder a esta página.</p>
                  </div>
                </div>
              }
            />
          </Routes>
        </Suspense>
      </MainLayout>
    </Router>
  )
}

export default App
