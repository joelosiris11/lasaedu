import { useState, useEffect } from 'react';
import { useAuthStore } from '@app/store/authStore';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Users,
  Clock,
  Award,
  TrendingUp,
  Calendar,
  CheckCircle,
  AlertTriangle,
  Eye,
  BookOpenCheck,
  MessageSquare
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/Card';
import { useTeacherCourses } from '@shared/hooks/useDashboard';
import { legacyEnrollmentService, type DBEnrollment } from '@shared/services/dataService';

const formatTime = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const TeacherDashboard = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { courses: teacherCourses, loading: coursesLoading } = useTeacherCourses(user?.id || '');
  const [allEnrollments, setAllEnrollments] = useState<DBEnrollment[]>([]);
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(true);

  useEffect(() => {
    const loadEnrollments = async () => {
      if (!teacherCourses.length) {
        setAllEnrollments([]);
        setEnrollmentsLoading(false);
        return;
      }
      try {
        const courseIds = teacherCourses.map((c: any) => c.id);
        const enrollmentPromises = courseIds.map((id: string) => legacyEnrollmentService.getByCourse(id));
        const results = await Promise.all(enrollmentPromises);
        setAllEnrollments(results.flat());
      } catch (err) {
        console.error('Error loading enrollments:', err);
      } finally {
        setEnrollmentsLoading(false);
      }
    };
    if (!coursesLoading) {
      loadEnrollments();
    }
  }, [teacherCourses, coursesLoading]);

  const loading = coursesLoading || enrollmentsLoading;

  const uniqueStudents = new Set(allEnrollments.map(e => e.userId)).size;
  const totalTimeMinutes = allEnrollments.reduce((sum, e) => sum + (e.totalTimeSpent || 0), 0);

  const stats = [
    { title: 'Mis Cursos', value: teacherCourses.length.toString(), icon: BookOpen, color: 'text-blue-600' },
    { title: 'Estudiantes Activos', value: uniqueStudents.toString(), icon: Users, color: 'text-green-600' },
    { title: 'Horas Impartidas', value: formatTime(totalTimeMinutes), icon: Clock, color: 'text-purple-600' },
    { title: 'Promedio Calificaciones', value: '—', icon: Award, color: 'text-orange-600' },
  ];

  // Map real courses for the course list
  const myCourses = teacherCourses.map((c: any) => {
    const courseEnrollments = allEnrollments.filter(e => e.courseId === c.id);
    const avgProgress = courseEnrollments.length > 0
      ? Math.round(courseEnrollments.reduce((sum, e) => sum + (e.progress || 0), 0) / courseEnrollments.length)
      : 0;
    return {
      id: c.id,
      title: c.title,
      students: courseEnrollments.length,
      progress: avgProgress,
      status: c.status === 'publicado' ? 'active' : 'draft'
    };
  });

  const pendingTasks = [
    { task: 'Revisar entregas pendientes', urgent: true, count: 0 },
    { task: 'Responder preguntas del foro', urgent: false, count: 0 },
  ];

  const recentActivity = [
    { action: 'Datos de actividad próximamente', course: '—', time: '—' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Cargando dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-800 rounded-xl p-6 text-white">
        <h1 className="text-2xl font-bold">¡Bienvenido, Prof. {user?.name}!</h1>
        <p className="text-green-100 mt-2">
          Gestiona tus cursos y conecta con tus estudiantes
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className={`${stat.color} bg-opacity-10 p-3 rounded-lg`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* My Courses */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BookOpen className="h-5 w-5 mr-2" />
                Mis Cursos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {myCourses.map((course) => (
                  <div key={course.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h3 className="font-medium text-gray-900">{course.title}</h3>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          course.status === 'active' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {course.status === 'active' ? 'Activo' : 'Borrador'}
                        </span>
                      </div>
                      <div className="flex items-center mt-2 space-x-4">
                        <span className="text-sm text-gray-600 flex items-center">
                          <Users className="h-4 w-4 mr-1" />
                          {course.students} estudiantes
                        </span>
                        <span className="text-sm text-gray-600 flex items-center">
                          <TrendingUp className="h-4 w-4 mr-1" />
                          {course.progress}% completado
                        </span>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button onClick={() => navigate(`/courses/${course.id}`)} className="p-2 text-gray-400 hover:text-gray-600" title="Ver curso">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button onClick={() => navigate(`/courses/${course.id}`)} className="p-2 text-gray-400 hover:text-gray-600" title="Gestionar curso">
                        <BookOpenCheck className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pending Tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CheckCircle className="h-5 w-5 mr-2" />
              Tareas Pendientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingTasks.map((task, index) => (
                <div key={index} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg">
                  {task.urgent ? (
                    <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                  ) : (
                    <Clock className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{task.task}</p>
                    <p className="text-xs text-gray-500">{task.count} elementos</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="h-5 w-5 mr-2" />
              Actividad Reciente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                    <p className="text-xs text-gray-500">{activity.course} • hace {activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Acciones Rápidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => navigate('/courses/new')} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <BookOpen className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                <span className="text-sm font-medium">Crear Curso</span>
              </button>
              <button onClick={() => navigate('/forums')} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <MessageSquare className="h-6 w-6 text-green-600 mx-auto mb-2" />
                <span className="text-sm font-medium">Revisar Foros</span>
              </button>
              <button onClick={() => navigate('/evaluations')} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <Calendar className="h-6 w-6 text-purple-600 mx-auto mb-2" />
                <span className="text-sm font-medium">Evaluaciones</span>
              </button>
              <button onClick={() => navigate('/grades')} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <Award className="h-6 w-6 text-orange-600 mx-auto mb-2" />
                <span className="text-sm font-medium">Ver Calificaciones</span>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TeacherDashboard;