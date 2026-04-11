import { useAuthStore } from '@app/store/authStore';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Trophy,
  TrendingUp,
  PlayCircle,
  ClipboardList,
  Award,
  Clock,
  AlertCircle,
  Calendar,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/Card';
import { useStudentCourses, useStudentGrades, useStudentDeadlines } from '@shared/hooks/useDashboard';

const StudentDashboard = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { courses, loading } = useStudentCourses(user?.id || '');
  const { data: gradesData } = useStudentGrades(user?.id || '');
  const { deadlines } = useStudentDeadlines(user?.id || '');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Cargando cursos...</div>
      </div>
    );
  }

  const totalCourses = courses.length;
  const avgProgress =
    courses.length > 0
      ? Math.round(
          courses.reduce((sum: number, course: any) => sum + course.progress, 0) /
            courses.length
        )
      : 0;
  const completedCourses = courses.filter((c: any) => c.progress >= 100).length;

  const stats = [
    {
      title: 'Cursos Inscritos',
      value: totalCourses.toString(),
      icon: BookOpen,
      color: 'bg-red-50 text-red-600',
    },
    {
      title: 'Progreso General',
      value: `${avgProgress}%`,
      icon: TrendingUp,
      color: 'bg-red-50 text-red-600',
    },
    {
      title: 'Promedio',
      value: gradesData?.avgGrade != null ? `${gradesData.avgGrade}` : '—',
      icon: ClipboardList,
      color: 'bg-red-50 text-red-600',
    },
    {
      title: 'Certificados',
      value: completedCourses.toString(),
      icon: Trophy,
      color: 'bg-red-50 text-red-600',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <Card key={index} className="hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500">{stat.title}</p>
                  <p className="text-xl md:text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                </div>
                <div className={`p-2 rounded-lg ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Enrolled Courses */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center text-base">
                  <BookOpen className="h-5 w-5 mr-2 text-red-600" />
                  Mis Cursos
                </CardTitle>
                <button
                  onClick={() => navigate('/courses')}
                  className="text-sm text-red-600 hover:text-red-800 font-medium"
                >
                  Ver todos
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {courses.length === 0 ? (
                  <div className="text-center py-10">
                    <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 mb-4">
                      No tienes cursos inscritos aún
                    </p>
                    <button
                      onClick={() => navigate('/courses')}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                    >
                      Explorar cursos
                    </button>
                  </div>
                ) : (
                  courses.slice(0, 4).map((course: any, idx: number) => (
                    <div
                      key={course.sectionId || course.id}
                      className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer"
                      onClick={() => navigate(course.sectionId ? `/sections/${course.sectionId}` : `/courses/${course.id}`)}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 truncate">
                            {course.title}
                          </h3>
                          <p className="text-sm text-gray-500">
                            por {course.instructor}
                          </p>
                        </div>
                        <div className="ml-3 flex-shrink-0">
                          {course.progress >= 100 ? (
                            <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700 font-medium">
                              Completado
                            </span>
                          ) : (
                            <button className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100">
                              <PlayCircle className="h-5 w-5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="mb-2">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-500">Progreso</span>
                          <span className="font-medium text-gray-700">
                            {course.progress}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div
                            className="h-2 rounded-full transition-all bg-red-500"
                            style={{ width: `${Math.min(course.progress, 100)}%` }}
                          />
                        </div>
                      </div>

                      {course.lastAccessedAt && (
                        <p className="text-xs text-gray-400">
                          Último acceso:{' '}
                          {new Date(course.lastAccessedAt).toLocaleDateString('es', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column: Deadlines + Grades + Certificates */}
        <div className="space-y-6">
          {/* Upcoming Deadlines */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-base">
                <Calendar className="h-5 w-5 mr-2 text-red-600" />
                Próximas Entregas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {deadlines.length === 0 ? (
                <div className="text-center py-4">
                  <Clock className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No hay entregas pendientes</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {deadlines.slice(0, 5).map((dl, i) => {
                    const isUrgent = dl.dueTimestamp - Date.now() < 24 * 60 * 60 * 1000;
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer"
                        onClick={() => {
                          if (dl.sectionId) {
                            navigate(`/sections/${dl.sectionId}/lesson/${dl.lessonId}`);
                          } else {
                            navigate(`/courses/${dl.courseId}/lesson/${dl.lessonId}`);
                          }
                        }}
                      >
                        <div className={`p-1.5 rounded-lg ${isUrgent ? 'bg-red-50' : 'bg-gray-50'}`}>
                          {dl.type === 'quiz' ? (
                            <AlertCircle className={`h-4 w-4 ${isUrgent ? 'text-red-500' : 'text-gray-500'}`} />
                          ) : (
                            <ClipboardList className={`h-4 w-4 ${isUrgent ? 'text-red-500' : 'text-gray-500'}`} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{dl.lessonTitle}</p>
                          <p className="text-xs text-gray-500 truncate">{dl.courseTitle}</p>
                        </div>
                        <span className={`text-xs font-medium whitespace-nowrap ${isUrgent ? 'text-red-600' : 'text-gray-500'}`}>
                          {dl.timeRemaining}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Grades Quick View */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-base">
                <ClipboardList className="h-5 w-5 mr-2 text-red-600" />
                Mis Calificaciones
              </CardTitle>
            </CardHeader>
            <CardContent>
              {gradesData && gradesData.totalGrades > 0 ? (
                <div>
                  <div className="text-center mb-4">
                    <p className="text-xs font-medium text-gray-500 mb-1">
                      Promedio General
                    </p>
                    <p
                      className={`text-3xl md:text-4xl font-bold ${
                        (gradesData.avgGrade || 0) >= 80
                          ? 'text-green-600'
                          : (gradesData.avgGrade || 0) >= 60
                          ? 'text-amber-600'
                          : 'text-red-600'
                      }`}
                    >
                      {gradesData.avgGrade}
                    </p>
                    <p className="text-xs text-gray-500">
                      de {gradesData.totalGrades} evaluacion
                      {gradesData.totalGrades !== 1 ? 'es' : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/grades')}
                    className="w-full text-center text-sm text-red-600 hover:text-red-800 font-medium py-2 border-t border-gray-100"
                  >
                    Ver detalle
                  </button>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-500 mb-2">
                    Sin calificaciones aún
                  </p>
                  <button
                    onClick={() => navigate('/grades')}
                    className="text-sm text-red-600 hover:text-red-800 font-medium"
                  >
                    Ver calificaciones
                  </button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Certificates */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-base">
                <Award className="h-5 w-5 mr-2 text-red-600" />
                Certificados
              </CardTitle>
            </CardHeader>
            <CardContent>
              {completedCourses > 0 ? (
                <div>
                  <div className="text-center mb-4">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-50 mb-2">
                      <Trophy className="h-7 w-7 text-red-500" />
                    </div>
                    <p className="text-xl md:text-2xl font-bold text-gray-900">
                      {completedCourses}
                    </p>
                    <p className="text-xs text-gray-500">
                      Curso{completedCourses !== 1 ? 's' : ''} completado
                      {completedCourses !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/certificates')}
                    className="w-full text-center text-sm text-red-600 hover:text-red-800 font-medium py-2 border-t border-gray-100"
                  >
                    Ver certificados
                  </button>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-500 mb-1">
                    Completa un curso para obtener tu primer certificado
                  </p>
                  {avgProgress > 0 && (
                    <div className="mt-3 p-2 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500">Más cerca de completar:</p>
                      <p className="text-sm font-medium text-gray-900 mt-0.5">
                        {avgProgress}% promedio
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
