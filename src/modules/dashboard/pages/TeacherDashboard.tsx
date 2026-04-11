import { useAuthStore } from '@app/store/authStore';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Users,
  Award,
  TrendingUp,
  Eye,
  BookOpenCheck,
  ArrowUpRight,
  BarChart3,
  UserPlus,
  ClipboardList,
  MessageSquare,
  Layers,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/Card';
import { useTeacherPerformance } from '@shared/hooks/useDashboard';

const TeacherDashboard = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { data: performance, loading } = useTeacherPerformance(user?.id || '');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Cargando dashboard...</div>
      </div>
    );
  }

  const courses = performance?.coursePerformance || [];
  const totalStudents = performance?.totalStudents || 0;
  const progressDist = performance?.progressDistribution || {
    low: 0,
    medium: 0,
    high: 0,
    complete: 0,
  };

  const totalCourses = courses.length;
  const activeCourses = courses.filter((c: any) => c.status === 'publicado').length;
  const avgProgress =
    courses.length > 0
      ? Math.round(
          courses.reduce((sum: number, c: any) => sum + c.avgProgress, 0) / courses.length
        )
      : 0;
  const totalCompleted = courses.reduce(
    (sum: number, c: any) => sum + c.completedStudents,
    0
  );

  const stats = [
    {
      title: 'Mis Cursos',
      value: totalCourses.toString(),
      icon: BookOpen,
      color: 'bg-red-50 text-red-600',
      detail: `${activeCourses} publicados`,
    },
    {
      title: 'Estudiantes',
      value: totalStudents.toString(),
      icon: Users,
      color: 'bg-red-50 text-red-600',
      detail: `${totalCompleted} completaron`,
    },
    {
      title: 'Progreso Prom.',
      value: `${avgProgress}%`,
      icon: TrendingUp,
      color: 'bg-red-50 text-red-600',
      detail: 'De todos los estudiantes',
    },
    {
      title: 'Completaciones',
      value: totalCompleted.toString(),
      icon: Award,
      color: 'bg-red-50 text-red-600',
      detail: 'Cursos terminados',
    },
  ];

  const totalDistStudents = progressDist.low + progressDist.medium + progressDist.high + progressDist.complete;

  const distBars = [
    { label: '0-25%', count: progressDist.low, color: 'bg-red-300' },
    { label: '25-50%', count: progressDist.medium, color: 'bg-red-400' },
    { label: '50-75%', count: progressDist.high, color: 'bg-red-500' },
    { label: '75-100%', count: progressDist.complete, color: 'bg-red-600' },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <Card key={index} className="hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">{stat.title}</p>
                  <p className="text-2xl md:text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{stat.detail}</p>
                </div>
                <div className={`p-2.5 rounded-lg ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Course Performance Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center text-base">
              <BarChart3 className="h-5 w-5 mr-2 text-red-600" />
              Rendimiento por Curso
            </CardTitle>
            <button
              onClick={() => navigate('/courses')}
              className="text-sm text-red-600 hover:text-red-800 font-medium flex items-center"
            >
              Ver todos
              <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {courses.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-4">No tienes cursos creados aún</p>
              <button
                onClick={() => navigate('/courses/new')}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
              >
                Crear mi primer curso
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-xs font-medium text-gray-500 border-b border-gray-100">
                    <th className="text-left pb-3 pr-4">Curso</th>
                    <th className="text-center pb-3 px-2">Estado</th>
                    <th className="text-center pb-3 px-2">Estudiantes</th>
                    <th className="text-center pb-3 px-2">Progreso Prom.</th>
                    <th className="text-center pb-3 px-2">Nota Prom.</th>
                    <th className="text-center pb-3 pl-2">Completaron</th>
                    <th className="text-right pb-3 pl-2">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {courses.map((course: any) => (
                    <tr
                      key={course.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-3 pr-4">
                        <p className="text-sm font-medium text-gray-900 line-clamp-1">
                          {course.title}
                        </p>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            course.status === 'publicado'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {course.status === 'publicado' ? 'Activo' : 'Borrador'}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <Users className="h-3.5 w-3.5 text-gray-400" />
                          <span className="text-sm font-semibold text-gray-900">
                            {course.students}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center justify-center space-x-2">
                          <div className="w-16 bg-gray-100 rounded-full h-1.5">
                            <div
                              className="bg-red-500 h-1.5 rounded-full"
                              style={{ width: `${course.avgProgress}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-600">
                            {course.avgProgress}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span
                          className={`text-sm font-semibold ${
                            course.avgGrade === null
                              ? 'text-gray-400'
                              : course.avgGrade >= 80
                              ? 'text-green-600'
                              : course.avgGrade >= 60
                              ? 'text-amber-600'
                              : 'text-red-600'
                          }`}
                        >
                          {course.avgGrade !== null ? `${course.avgGrade}/100` : '—'}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className="text-sm text-gray-700">
                          {course.completedStudents}
                        </span>
                      </td>
                      <td className="py-3 pl-2">
                        <div className="flex justify-end space-x-1">
                          <button
                            onClick={() => navigate(`/courses/${course.id}/sections`)}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                            title="Secciones"
                          >
                            <Layers className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => navigate(`/courses/${course.id}`)}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                            title="Ver curso"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => navigate(`/courses/${course.id}`)}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                            title="Gestionar"
                          >
                            <BookOpenCheck className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Row 3: Progress Distribution + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Progress Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-base">
              <TrendingUp className="h-5 w-5 mr-2 text-red-600" />
              Distribución de Progreso
            </CardTitle>
          </CardHeader>
          <CardContent>
            {totalDistStudents === 0 ? (
              <div className="text-center py-6 text-gray-500 text-sm">
                No hay estudiantes inscritos aún
              </div>
            ) : (
              <div className="space-y-3">
                {distBars.map((bar) => {
                  const pct =
                    totalDistStudents > 0
                      ? Math.round((bar.count / totalDistStudents) * 100)
                      : 0;
                  return (
                    <div key={bar.label} className="flex items-center space-x-3">
                      <span className="text-xs font-medium text-gray-500 w-14 text-right">
                        {bar.label}
                      </span>
                      <div className="flex-1">
                        <div className="w-full bg-gray-100 rounded-full h-3">
                          <div
                            className={`${bar.color} h-3 rounded-full transition-all`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-sm font-medium text-gray-700 w-20">
                        {bar.count} est. ({pct}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Acciones Rápidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  icon: BookOpen,
                  label: 'Crear Curso',
                  path: '/courses/new',
                  color: 'text-red-600 bg-red-50',
                },
                {
                  icon: ClipboardList,
                  label: 'Calificaciones',
                  path: '/grades',
                  color: 'text-red-600 bg-red-50',
                },
                {
                  icon: UserPlus,
                  label: 'Inscripciones',
                  path: '/enrollments',
                  color: 'text-red-600 bg-red-50',
                },
                {
                  icon: MessageSquare,
                  label: 'Foros',
                  path: '/forums',
                  color: 'text-red-600 bg-red-50',
                },
              ].map((action) => (
                <button
                  key={action.path}
                  onClick={() => navigate(action.path)}
                  className="flex flex-col items-center p-4 rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all"
                >
                  <div className={`p-2 rounded-lg ${action.color} mb-2`}>
                    <action.icon className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">
                    {action.label}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TeacherDashboard;
