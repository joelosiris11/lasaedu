import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@app/store/authStore';
import { localDB } from '@shared/utils/localDB';
import { 
  exportUsers,
  exportGrades,
  exportProgress,
  exportData,
  type UserExportData,
  type GradeExportData,
  type ProgressExportData
} from '@shared/services/exportService';
import { 
  BarChart3,
  TrendingUp,
  Users,
  BookOpen,
  Award,
  Clock,
  Download,
  FileText,
  Activity,
  Target,
  FileSpreadsheet,
  File,
  ChevronDown
} from 'lucide-react';
import { Card, CardContent } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';

interface ReportData {
  totalUsers: number;
  usersByRole: { role: string; count: number }[];
  totalCourses: number;
  activeCourses: number;
  totalEnrollments: number;
  completionRate: number;
  avgCourseRating: number;
  certificatesIssued: number;
  ticketsResolved: number;
  monthlyStats: {
    month: string;
    newUsers: number;
    newEnrollments: number;
    completions: number;
  }[];
  topCourses: {
    id: string;
    title: string;
    enrollments: number;
    completionRate: number;
    rating: number;
  }[];
  userActivity: {
    date: string;
    activeUsers: number;
    lessonsCompleted: number;
    evaluationsSubmitted: number;
  }[];
}

export default function ReportsPage() {
  const { user } = useAuthStore();
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'courses' | 'engagement'>('overview');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    loadReportData();
  }, [selectedPeriod]);

  const loadReportData = async () => {
    try {
      // Generate mock report data
      const users = localDB.getCollection<any>('users');
      const courses = localDB.getCollection<any>('courses');
      const enrollments = localDB.getCollection<any>('enrollments');
      const certificates = localDB.getCollection<any>('certificates');
      const tickets = localDB.getCollection<any>('supportTickets');

      // Count users by role
      const usersByRole = [
        { role: 'Estudiantes', count: users.filter(u => u.role === 'student').length || 85 },
        { role: 'Profesores', count: users.filter(u => u.role === 'teacher').length || 12 },
        { role: 'Administradores', count: users.filter(u => u.role === 'admin').length || 3 },
        { role: 'Soporte', count: users.filter(u => u.role === 'support').length || 5 }
      ];

      // Monthly stats (mock data)
      const monthlyStats = [
        { month: 'Ene', newUsers: 45, newEnrollments: 78, completions: 23 },
        { month: 'Feb', newUsers: 52, newEnrollments: 89, completions: 31 },
        { month: 'Mar', newUsers: 61, newEnrollments: 102, completions: 45 },
        { month: 'Abr', newUsers: 48, newEnrollments: 95, completions: 38 },
        { month: 'May', newUsers: 72, newEnrollments: 118, completions: 52 },
        { month: 'Jun', newUsers: 68, newEnrollments: 110, completions: 48 }
      ];

      // Top courses
      const topCourses = courses.slice(0, 5).map((course: any, index: number) => ({
        id: course.id,
        title: course.title || `Curso ${index + 1}`,
        enrollments: Math.floor(Math.random() * 100) + 20,
        completionRate: Math.floor(Math.random() * 40) + 60,
        rating: parseFloat((Math.random() * 1.5 + 3.5).toFixed(1))
      }));

      // Fill with mock data if not enough courses
      while (topCourses.length < 5) {
        topCourses.push({
          id: `course_${topCourses.length + 1}`,
          title: `Curso Popular ${topCourses.length + 1}`,
          enrollments: Math.floor(Math.random() * 100) + 20,
          completionRate: Math.floor(Math.random() * 40) + 60,
          rating: parseFloat((Math.random() * 1.5 + 3.5).toFixed(1))
        });
      }

      // User activity (last 7 days)
      const userActivity = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        userActivity.push({
          date: date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }),
          activeUsers: Math.floor(Math.random() * 50) + 30,
          lessonsCompleted: Math.floor(Math.random() * 100) + 50,
          evaluationsSubmitted: Math.floor(Math.random() * 30) + 10
        });
      }

      setReportData({
        totalUsers: users.length || 105,
        usersByRole,
        totalCourses: courses.length || 24,
        activeCourses: courses.filter((c: any) => c.status === 'publicado').length || 18,
        totalEnrollments: enrollments.length || 342,
        completionRate: 72,
        avgCourseRating: 4.3,
        certificatesIssued: certificates.length || 156,
        ticketsResolved: tickets.filter((t: any) => t.status === 'resolved').length || 89,
        monthlyStats,
        topCourses,
        userActivity
      });
    } catch (error) {
      console.error('Error loading report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportReport = () => {
    if (!reportData) return;

    const report = `
REPORTE DE LA PLATAFORMA LASAEDU
================================
Fecha: ${new Date().toLocaleDateString('es-ES', { 
  year: 'numeric', month: 'long', day: 'numeric' 
})}
Período: ${selectedPeriod === 'week' ? 'Última Semana' : 
         selectedPeriod === 'month' ? 'Último Mes' :
         selectedPeriod === 'quarter' ? 'Último Trimestre' : 'Último Año'}

RESUMEN GENERAL
---------------
Total de Usuarios: ${reportData.totalUsers}
Total de Cursos: ${reportData.totalCourses}
Cursos Activos: ${reportData.activeCourses}
Total de Inscripciones: ${reportData.totalEnrollments}
Tasa de Completado: ${reportData.completionRate}%
Calificación Promedio: ${reportData.avgCourseRating}/5
Certificados Emitidos: ${reportData.certificatesIssued}
Tickets Resueltos: ${reportData.ticketsResolved}

USUARIOS POR ROL
----------------
${reportData.usersByRole.map(u => `${u.role}: ${u.count}`).join('\n')}

TOP 5 CURSOS
------------
${reportData.topCourses.map((c, i) => `${i + 1}. ${c.title} - ${c.enrollments} inscripciones (${c.completionRate}% completado)`).join('\n')}
    `.trim();

    const blob = new Blob([report], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_lasaedu_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Export functions with format options
  const handleExportUsers = (format: 'csv' | 'excel' | 'pdf') => {
    const userData: UserExportData[] = reportData?.usersByRole.flatMap(role => 
      Array(role.count).fill(null).map((_, i) => ({
        name: `Usuario ${role.role} ${i + 1}`,
        email: `usuario${i + 1}@${role.role.toLowerCase()}.com`,
        role: role.role,
        status: 'Activo',
        coursesEnrolled: Math.floor(Math.random() * 5) + 1,
        coursesCompleted: Math.floor(Math.random() * 3),
        lastLogin: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toLocaleDateString('es-ES'),
        createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toLocaleDateString('es-ES')
      }))
    ) || [];
    
    exportUsers(userData, format);
    setShowExportMenu(false);
  };

  const handleExportGrades = (format: 'csv' | 'excel' | 'pdf') => {
    const gradeData: GradeExportData[] = reportData?.topCourses.flatMap(course =>
      Array(5).fill(null).map((_, i) => ({
        studentName: `Estudiante ${i + 1}`,
        studentEmail: `estudiante${i + 1}@email.com`,
        courseName: course.title,
        evaluationName: `Evaluación ${i + 1}`,
        evaluationType: ['Quiz', 'Tarea', 'Examen'][i % 3],
        grade: Math.floor(Math.random() * 40) + 60,
        maxGrade: 100,
        percentage: Math.floor(Math.random() * 40) + 60,
        status: Math.random() > 0.2 ? 'Calificado' : 'Pendiente',
        submittedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toLocaleDateString('es-ES'),
        gradedAt: new Date(Date.now() - Math.random() * 15 * 24 * 60 * 60 * 1000).toLocaleDateString('es-ES')
      }))
    ) || [];
    
    exportGrades(gradeData, format);
    setShowExportMenu(false);
  };

  const handleExportProgress = (format: 'csv' | 'excel' | 'pdf') => {
    const progressData: ProgressExportData[] = reportData?.topCourses.flatMap(course =>
      Array(5).fill(null).map((_, i) => ({
        studentName: `Estudiante ${i + 1}`,
        studentEmail: `estudiante${i + 1}@email.com`,
        courseName: course.title,
        progress: Math.floor(Math.random() * 100),
        lessonsCompleted: Math.floor(Math.random() * 20),
        totalLessons: 20,
        evaluationsCompleted: Math.floor(Math.random() * 5),
        totalEvaluations: 5,
        averageGrade: Math.floor(Math.random() * 40) + 60,
        timeSpent: `${Math.floor(Math.random() * 20)}h ${Math.floor(Math.random() * 60)}m`,
        lastAccess: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toLocaleDateString('es-ES'),
        status: ['Activo', 'Completado', 'En progreso'][Math.floor(Math.random() * 3)]
      }))
    ) || [];
    
    exportProgress(progressData, format);
    setShowExportMenu(false);
  };

  const handleExportCourses = (format: 'csv' | 'excel' | 'pdf') => {
    const courseData = reportData?.topCourses.map(course => ({
      title: course.title,
      enrollments: course.enrollments,
      completionRate: `${course.completionRate}%`,
      rating: course.rating,
      status: 'Publicado'
    })) || [];
    
    exportData(courseData, [
      { key: 'title', header: 'Curso', width: 40 },
      { key: 'enrollments', header: 'Inscripciones', width: 20 },
      { key: 'completionRate', header: 'Tasa Completado', width: 20 },
      { key: 'rating', header: 'Calificación', width: 15 },
      { key: 'status', header: 'Estado', width: 15 }
    ], format, {
      filename: `cursos_${Date.now()}`,
      title: 'Reporte de Cursos',
      includeDate: true
    });
    setShowExportMenu(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!reportData) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reportes y Analytics</h1>
          <p className="text-gray-600">
            {isAdmin 
              ? 'Vista general de la plataforma y métricas de rendimiento'
              : 'Estadísticas de tus cursos y estudiantes'
            }
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={selectedPeriod}
            onChange={e => setSelectedPeriod(e.target.value as any)}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="week">Última Semana</option>
            <option value="month">Último Mes</option>
            <option value="quarter">Último Trimestre</option>
            <option value="year">Último Año</option>
          </select>
          
          {/* Export Dropdown Menu */}
          <div className="relative" ref={exportMenuRef}>
            <Button 
              variant="outline" 
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
            
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border z-50">
                <div className="p-2">
                  <p className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Exportar Usuarios</p>
                  <div className="flex space-x-1 px-2 mb-2">
                    <button onClick={() => handleExportUsers('csv')} className="flex-1 flex items-center justify-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">
                      <FileText className="h-4 w-4 mr-1 text-green-600" /> CSV
                    </button>
                    <button onClick={() => handleExportUsers('excel')} className="flex-1 flex items-center justify-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">
                      <FileSpreadsheet className="h-4 w-4 mr-1 text-green-700" /> Excel
                    </button>
                    <button onClick={() => handleExportUsers('pdf')} className="flex-1 flex items-center justify-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">
                      <File className="h-4 w-4 mr-1 text-red-600" /> PDF
                    </button>
                  </div>
                  
                  <div className="border-t my-1"></div>
                  
                  <p className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Exportar Calificaciones</p>
                  <div className="flex space-x-1 px-2 mb-2">
                    <button onClick={() => handleExportGrades('csv')} className="flex-1 flex items-center justify-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">
                      <FileText className="h-4 w-4 mr-1 text-green-600" /> CSV
                    </button>
                    <button onClick={() => handleExportGrades('excel')} className="flex-1 flex items-center justify-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">
                      <FileSpreadsheet className="h-4 w-4 mr-1 text-green-700" /> Excel
                    </button>
                    <button onClick={() => handleExportGrades('pdf')} className="flex-1 flex items-center justify-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">
                      <File className="h-4 w-4 mr-1 text-red-600" /> PDF
                    </button>
                  </div>
                  
                  <div className="border-t my-1"></div>
                  
                  <p className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Exportar Progreso</p>
                  <div className="flex space-x-1 px-2 mb-2">
                    <button onClick={() => handleExportProgress('csv')} className="flex-1 flex items-center justify-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">
                      <FileText className="h-4 w-4 mr-1 text-green-600" /> CSV
                    </button>
                    <button onClick={() => handleExportProgress('excel')} className="flex-1 flex items-center justify-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">
                      <FileSpreadsheet className="h-4 w-4 mr-1 text-green-700" /> Excel
                    </button>
                    <button onClick={() => handleExportProgress('pdf')} className="flex-1 flex items-center justify-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">
                      <File className="h-4 w-4 mr-1 text-red-600" /> PDF
                    </button>
                  </div>
                  
                  <div className="border-t my-1"></div>
                  
                  <p className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Exportar Cursos</p>
                  <div className="flex space-x-1 px-2 mb-2">
                    <button onClick={() => handleExportCourses('csv')} className="flex-1 flex items-center justify-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">
                      <FileText className="h-4 w-4 mr-1 text-green-600" /> CSV
                    </button>
                    <button onClick={() => handleExportCourses('excel')} className="flex-1 flex items-center justify-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">
                      <FileSpreadsheet className="h-4 w-4 mr-1 text-green-700" /> Excel
                    </button>
                    <button onClick={() => handleExportCourses('pdf')} className="flex-1 flex items-center justify-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">
                      <File className="h-4 w-4 mr-1 text-red-600" /> PDF
                    </button>
                  </div>
                  
                  <div className="border-t my-1"></div>
                  
                  <button 
                    onClick={exportReport}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded flex items-center"
                  >
                    <FileText className="h-4 w-4 mr-2 text-gray-500" />
                    Exportar Resumen (TXT)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">Total Usuarios</p>
                <p className="text-3xl font-bold">{reportData.totalUsers}</p>
                <p className="text-blue-200 text-xs flex items-center mt-1">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  +12% vs mes anterior
                </p>
              </div>
              <Users className="h-10 w-10 text-blue-200" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">Inscripciones</p>
                <p className="text-3xl font-bold">{reportData.totalEnrollments}</p>
                <p className="text-green-200 text-xs flex items-center mt-1">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  +8% vs mes anterior
                </p>
              </div>
              <BookOpen className="h-10 w-10 text-green-200" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm">Tasa Completado</p>
                <p className="text-3xl font-bold">{reportData.completionRate}%</p>
                <p className="text-purple-200 text-xs flex items-center mt-1">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  +5% vs mes anterior
                </p>
              </div>
              <Target className="h-10 w-10 text-purple-200" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-100 text-sm">Certificados</p>
                <p className="text-3xl font-bold">{reportData.certificatesIssued}</p>
                <p className="text-amber-200 text-xs flex items-center mt-1">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  +15% vs mes anterior
                </p>
              </div>
              <Award className="h-10 w-10 text-amber-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex space-x-4 border-b">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-2 px-1 font-medium ${
            activeTab === 'overview' 
              ? 'border-b-2 border-indigo-600 text-indigo-600' 
              : 'text-gray-500'
          }`}
        >
          <BarChart3 className="h-4 w-4 inline mr-2" />
          Resumen
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-2 px-1 font-medium ${
            activeTab === 'users' 
              ? 'border-b-2 border-indigo-600 text-indigo-600' 
              : 'text-gray-500'
          }`}
        >
          <Users className="h-4 w-4 inline mr-2" />
          Usuarios
        </button>
        <button
          onClick={() => setActiveTab('courses')}
          className={`pb-2 px-1 font-medium ${
            activeTab === 'courses' 
              ? 'border-b-2 border-indigo-600 text-indigo-600' 
              : 'text-gray-500'
          }`}
        >
          <BookOpen className="h-4 w-4 inline mr-2" />
          Cursos
        </button>
        <button
          onClick={() => setActiveTab('engagement')}
          className={`pb-2 px-1 font-medium ${
            activeTab === 'engagement' 
              ? 'border-b-2 border-indigo-600 text-indigo-600' 
              : 'text-gray-500'
          }`}
        >
          <Activity className="h-4 w-4 inline mr-2" />
          Engagement
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Monthly Trends Chart */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Tendencias Mensuales</h3>
              <div className="space-y-4">
                {reportData.monthlyStats.map((stat) => (
                  <div key={stat.month} className="flex items-center">
                    <span className="w-12 text-sm text-gray-600">{stat.month}</span>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center">
                        <div 
                          className="h-2 bg-blue-500 rounded"
                          style={{ width: `${(stat.newUsers / 80) * 100}%` }}
                        />
                        <span className="ml-2 text-xs text-gray-500">{stat.newUsers} usuarios</span>
                      </div>
                      <div className="flex items-center">
                        <div 
                          className="h-2 bg-green-500 rounded"
                          style={{ width: `${(stat.newEnrollments / 120) * 100}%` }}
                        />
                        <span className="ml-2 text-xs text-gray-500">{stat.newEnrollments} inscripciones</span>
                      </div>
                      <div className="flex items-center">
                        <div 
                          className="h-2 bg-purple-500 rounded"
                          style={{ width: `${(stat.completions / 60) * 100}%` }}
                        />
                        <span className="ml-2 text-xs text-gray-500">{stat.completions} completados</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center space-x-4 mt-4 text-xs">
                <span className="flex items-center"><div className="w-3 h-3 bg-blue-500 rounded mr-1" /> Usuarios</span>
                <span className="flex items-center"><div className="w-3 h-3 bg-green-500 rounded mr-1" /> Inscripciones</span>
                <span className="flex items-center"><div className="w-3 h-3 bg-purple-500 rounded mr-1" /> Completados</span>
              </div>
            </CardContent>
          </Card>

          {/* Key Metrics */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Métricas Clave</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <BookOpen className="h-5 w-5 text-blue-500 mr-3" />
                    <span>Cursos Activos</span>
                  </div>
                  <span className="font-bold">{reportData.activeCourses} / {reportData.totalCourses}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <Target className="h-5 w-5 text-green-500 mr-3" />
                    <span>Tasa de Finalización</span>
                  </div>
                  <span className="font-bold text-green-600">{reportData.completionRate}%</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <Award className="h-5 w-5 text-yellow-500 mr-3" />
                    <span>Calificación Promedio</span>
                  </div>
                  <span className="font-bold">{reportData.avgCourseRating} / 5.0</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <FileText className="h-5 w-5 text-purple-500 mr-3" />
                    <span>Tickets Resueltos</span>
                  </div>
                  <span className="font-bold">{reportData.ticketsResolved}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Users by Role */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Usuarios por Rol</h3>
              <div className="space-y-3">
                {reportData.usersByRole.map(item => {
                  const total = reportData.totalUsers;
                  const percentage = Math.round((item.count / total) * 100);
                  const colors: Record<string, string> = {
                    'Estudiantes': 'bg-blue-500',
                    'Profesores': 'bg-green-500',
                    'Administradores': 'bg-purple-500',
                    'Soporte': 'bg-orange-500'
                  };
                  
                  return (
                    <div key={item.role} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{item.role}</span>
                        <span className="font-medium">{item.count} ({percentage}%)</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div 
                          className={`h-3 rounded-full ${colors[item.role] || 'bg-gray-500'}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* User Growth */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Crecimiento de Usuarios</h3>
              <div className="h-64 flex items-end justify-between space-x-2">
                {reportData.monthlyStats.map(stat => (
                  <div key={stat.month} className="flex-1 flex flex-col items-center">
                    <div 
                      className="w-full bg-blue-500 rounded-t"
                      style={{ height: `${(stat.newUsers / 80) * 200}px` }}
                    />
                    <span className="text-xs text-gray-500 mt-2">{stat.month}</span>
                    <span className="text-xs font-medium">{stat.newUsers}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Courses Tab */}
      {activeTab === 'courses' && (
        <div className="space-y-6">
          {/* Top Courses */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Cursos Más Populares</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 text-sm font-medium text-gray-600">Curso</th>
                      <th className="text-center py-2 text-sm font-medium text-gray-600">Inscripciones</th>
                      <th className="text-center py-2 text-sm font-medium text-gray-600">Completado</th>
                      <th className="text-center py-2 text-sm font-medium text-gray-600">Calificación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.topCourses.map((course, index) => (
                      <tr key={course.id} className="border-b hover:bg-gray-50">
                        <td className="py-3">
                          <div className="flex items-center">
                            <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-medium mr-3">
                              {index + 1}
                            </span>
                            <span className="font-medium">{course.title}</span>
                          </div>
                        </td>
                        <td className="text-center py-3">
                          <span className="font-bold text-blue-600">{course.enrollments}</span>
                        </td>
                        <td className="text-center py-3">
                          <span className={`font-medium ${
                            course.completionRate >= 70 ? 'text-green-600' :
                            course.completionRate >= 50 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {course.completionRate}%
                          </span>
                        </td>
                        <td className="text-center py-3">
                          <span className="inline-flex items-center">
                            <Award className="h-4 w-4 text-yellow-500 mr-1" />
                            {course.rating}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Engagement Tab */}
      {activeTab === 'engagement' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Daily Activity */}
          <Card className="md:col-span-2">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Actividad Diaria (Última Semana)</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 text-sm font-medium text-gray-600">Día</th>
                      <th className="text-center py-2 text-sm font-medium text-gray-600">Usuarios Activos</th>
                      <th className="text-center py-2 text-sm font-medium text-gray-600">Lecciones Completadas</th>
                      <th className="text-center py-2 text-sm font-medium text-gray-600">Evaluaciones Enviadas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.userActivity.map(day => (
                      <tr key={day.date} className="border-b hover:bg-gray-50">
                        <td className="py-3 font-medium">{day.date}</td>
                        <td className="text-center py-3">
                          <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 rounded">
                            <Users className="h-4 w-4 mr-1" />
                            {day.activeUsers}
                          </span>
                        </td>
                        <td className="text-center py-3">
                          <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-700 rounded">
                            <BookOpen className="h-4 w-4 mr-1" />
                            {day.lessonsCompleted}
                          </span>
                        </td>
                        <td className="text-center py-3">
                          <span className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-700 rounded">
                            <FileText className="h-4 w-4 mr-1" />
                            {day.evaluationsSubmitted}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Engagement Summary */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Resumen de Engagement</h3>
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-blue-700 font-medium">Usuarios Activos Promedio</span>
                    <span className="text-2xl font-bold text-blue-700">
                      {Math.round(reportData.userActivity.reduce((sum, d) => sum + d.activeUsers, 0) / 7)}
                    </span>
                  </div>
                  <p className="text-sm text-blue-600">por día en la última semana</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-green-700 font-medium">Lecciones/Día</span>
                    <span className="text-2xl font-bold text-green-700">
                      {Math.round(reportData.userActivity.reduce((sum, d) => sum + d.lessonsCompleted, 0) / 7)}
                    </span>
                  </div>
                  <p className="text-sm text-green-600">completadas en promedio</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-purple-700 font-medium">Tasa de Retención</span>
                    <span className="text-2xl font-bold text-purple-700">78%</span>
                  </div>
                  <p className="text-sm text-purple-600">usuarios que regresan semanalmente</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Peak Hours */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Horas Pico de Actividad</h3>
              <div className="space-y-2">
                {[
                  { hour: '9:00 - 11:00', percentage: 85 },
                  { hour: '14:00 - 16:00', percentage: 72 },
                  { hour: '19:00 - 21:00', percentage: 95 },
                  { hour: '21:00 - 23:00', percentage: 68 }
                ].map(peak => (
                  <div key={peak.hour} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{peak.hour}</span>
                      <span className="font-medium">{peak.percentage}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="h-2 rounded-full bg-indigo-500"
                        style={{ width: `${peak.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-4">
                <Clock className="h-3 w-3 inline mr-1" />
                Basado en actividad de las últimas 4 semanas
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
