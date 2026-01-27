import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from '@modules/auth/pages/LoginPage'
import RegisterPage from '@modules/auth/pages/RegisterPage'
import RecoveryPage from '@modules/auth/pages/RecoveryPage'
import ProtectedRoute from '@modules/auth/components/ProtectedRoute'
import MainLayout from '@shared/components/layout/MainLayout'
import AdminDashboard from '@modules/dashboard/pages/AdminDashboard'
import TeacherDashboard from '@modules/dashboard/pages/TeacherDashboard'
import StudentDashboard from '@modules/dashboard/pages/StudentDashboard'
import SupportDashboard from '@modules/dashboard/pages/SupportDashboard'


  
function App() {
  return (
    <Router>
      <MainLayout>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/recovery" element={<RecoveryPage />} />
          
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
      </MainLayout>
    </Router>
  )
}

export default App
