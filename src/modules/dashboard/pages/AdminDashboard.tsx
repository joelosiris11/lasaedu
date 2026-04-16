import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@app/store/authStore';
import {
  Users,
  BookOpen,
  TrendingUp,
  MessageCircle,
  Settings,
  BarChart3,
  UserCog,
  GraduationCap,
  Shield,
  Headphones,
  ArrowUpRight,
  Award,
  History,
  RotateCcw,
  Save,
  Check,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/Card';
import {
  useSystemStats,
  useAdminOverview,
  useCourseSnapshots,
} from '@shared/hooks/useDashboard';
import { courseService } from '@shared/services/dataService';

const AdminDashboard = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const isSupervisor = user?.role === 'supervisor';
  const { stats, loading: statsLoading } = useSystemStats();
  const { data: overview, loading: overviewLoading } = useAdminOverview();
  const { snapshots, loading: snapshotsLoading, saveSnapshot, rollback, refetch } = useCourseSnapshots();

  const [savingCourse, setSavingCourse] = useState<string | null>(null);
  const [rollingBack, setRollingBack] = useState<string | null>(null);
  const [allCourses, setAllCourses] = useState<any[]>([]);
  const [coursesLoaded, setCoursesLoaded] = useState(false);

  // Load all courses for the snapshot section
  if (!coursesLoaded) {
    courseService.getAll().then((courses) => {
      setAllCourses(courses);
      setCoursesLoaded(true);
    });
  }

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Cargando estadísticas...</div>
      </div>
    );
  }

  const statsCards = stats
    ? [
        {
          title: 'Total Usuarios',
          value: stats.totalUsers.toString(),
          icon: Users,
          color: 'bg-red-50 text-red-600',
          detail: `${stats.activeStudents} estudiantes`,
        },
        {
          title: 'Cursos Activos',
          value: stats.activeCourses.toString(),
          icon: BookOpen,
          color: 'bg-red-50 text-red-600',
          detail: `${stats.completedCourses} completados`,
        },
        {
          title: 'Inscripciones',
          value: stats.totalEnrollments.toString(),
          icon: TrendingUp,
          color: 'bg-red-50 text-red-600',
          detail: overview ? `${overview.completionRate}% tasa completación` : '',
        },
        {
          title: 'Tickets Abiertos',
          value: stats.openTickets.toString(),
          icon: MessageCircle,
          color: 'bg-red-50 text-red-600',
          detail: stats.openTickets > 0 ? 'Requieren atención' : 'Todo al día',
        },
      ]
    : [];

  const roleIcons: Record<string, any> = {
    student: GraduationCap,
    teacher: BookOpen,
    admin: Shield,
    supervisor: Shield,
    support: Headphones,
  };

  const roleColors: Record<string, string> = {
    student: 'bg-red-500',
    teacher: 'bg-red-500',
    admin: 'bg-red-500',
    supervisor: 'bg-orange-500',
    support: 'bg-red-500',
  };

  const roleLabels: Record<string, string> = {
    student: 'Estudiantes',
    teacher: 'Profesores',
    admin: 'Administradores',
    supervisor: 'Supervisores',
    support: 'Soporte',
  };

  const statusColors: Record<string, string> = {
    active: 'bg-red-600',
    completed: 'bg-red-500',
    paused: 'bg-red-400',
    cancelled: 'bg-red-300',
  };

  const statusLabels: Record<string, string> = {
    active: 'Activas',
    completed: 'Completadas',
    paused: 'Pausadas',
    cancelled: 'Canceladas',
  };

  const handleSaveSnapshot = async (courseId: string) => {
    if (!user?.id) return;
    setSavingCourse(courseId);
    try {
      await saveSnapshot(courseId, user.id);
    } catch (err) {
      console.error('Error saving snapshot:', err);
      alert('Error al guardar el snapshot');
    } finally {
      setSavingCourse(null);
    }
  };

  const handleRollback = async (courseId: string, courseTitle: string) => {
    const confirmed = window.confirm(
      `¿Restaurar "${courseTitle}" al último punto guardado? Esto reemplazará los módulos y lecciones actuales.`
    );
    if (!confirmed) return;

    setRollingBack(courseId);
    try {
      await rollback(courseId);
      alert(`"${courseTitle}" restaurado exitosamente`);
    } catch (err) {
      console.error('Error rolling back:', err);
      alert('Error al restaurar el curso');
    } finally {
      setRollingBack(null);
    }
  };

  // Build snapshot lookup
  const snapshotMap = new Map(snapshots.map(s => [s.courseId, s]));

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((stat, index) => (
          <Card key={index} className="hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">{stat.title}</p>
                  <p className="text-2xl md:text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
                  {stat.detail && (
                    <p className="text-xs text-gray-500 mt-1">{stat.detail}</p>
                  )}
                </div>
                <div className={`p-2.5 rounded-lg ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Row 2: User Distribution + Enrollment Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-base">
              <Users className="h-5 w-5 mr-2 text-red-600" />
              Distribución de Usuarios
            </CardTitle>
          </CardHeader>
          <CardContent>
            {overviewLoading || !overview ? (
              <div className="text-gray-500 text-center py-4">Cargando...</div>
            ) : (
              <div className="space-y-3">
                {Object.entries(overview.usersByRole).map(([role, count]) => {
                  const total = stats?.totalUsers || 1;
                  const percentage = Math.round(((count as number) / total) * 100);
                  const Icon = roleIcons[role] || Users;
                  return (
                    <div key={role} className="flex items-center space-x-3">
                      <div
                        className={`w-8 h-8 rounded-lg ${roleColors[role]} bg-opacity-10 flex items-center justify-center`}
                      >
                        <Icon className={`h-4 w-4 ${roleColors[role].replace('bg-', 'text-')}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700">
                            {roleLabels[role]}
                          </span>
                          <span className="text-sm text-gray-500">
                            {count as number} ({percentage}%)
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div
                            className={`${roleColors[role]} h-2 rounded-full transition-all`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Enrollment Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-base">
              <TrendingUp className="h-5 w-5 mr-2 text-red-600" />
              Estado de Inscripciones
            </CardTitle>
          </CardHeader>
          <CardContent>
            {overviewLoading || !overview ? (
              <div className="text-gray-500 text-center py-4">Cargando...</div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {Object.entries(overview.enrollmentsByStatus).map(([status, count]) => (
                    <div
                      key={status}
                      className="p-3 rounded-lg bg-gray-50 border border-gray-100"
                    >
                      <div className="flex items-center space-x-2 mb-1">
                        <div
                          className={`w-2.5 h-2.5 rounded-full ${statusColors[status]}`}
                        />
                        <span className="text-xs font-medium text-gray-500">
                          {statusLabels[status]}
                        </span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">
                        {count as number}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Award className="h-4 w-4 text-red-600" />
                    <span className="text-sm font-medium text-red-700">
                      Tasa de completación
                    </span>
                  </div>
                  <span className="text-lg font-bold text-red-700">
                    {overview.completionRate}%
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Top Courses + Course History/Rollback */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Courses */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center text-base">
                  <BarChart3 className="h-5 w-5 mr-2 text-red-600" />
                  Cursos Más Populares
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
              {overviewLoading || !overview ? (
                <div className="text-gray-500 text-center py-4">Cargando...</div>
              ) : overview.topCourses.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No hay cursos creados aún
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-xs font-medium text-gray-500 border-b border-gray-100">
                        <th className="text-left pb-3 pr-4">Curso</th>
                        <th className="text-center pb-3 px-2">Inscritos</th>
                        <th className="text-center pb-3 px-2">Progreso Prom.</th>
                        <th className="text-center pb-3 pl-2">Completación</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {overview.topCourses.map((course: any, idx: number) => (
                        <tr
                          key={course.id}
                          className="hover:bg-gray-50 cursor-pointer transition-colors"
                          onClick={() => navigate(`/courses/${course.id}`)}
                        >
                          <td className="py-3 pr-4">
                            <div className="flex items-center space-x-3">
                              <span className="text-xs font-bold text-gray-400 w-5">
                                {idx + 1}
                              </span>
                              <div>
                                <p className="text-sm font-medium text-gray-900 line-clamp-1">
                                  {course.title}
                                </p>
                                <span
                                  className={`text-xs px-1.5 py-0.5 rounded-full ${
                                    course.status === 'publicado'
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-yellow-100 text-yellow-700'
                                  }`}
                                >
                                  {course.status === 'publicado' ? 'Publicado' : 'Borrador'}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-2 text-center">
                            <span className="text-sm font-semibold text-gray-900">
                              {course.enrollments}
                            </span>
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
                          <td className="py-3 pl-2 text-center">
                            <span
                              className={`text-sm font-semibold ${
                                course.completionRate >= 50
                                  ? 'text-green-600'
                                  : course.completionRate >= 25
                                  ? 'text-amber-600'
                                  : 'text-gray-500'
                              }`}
                            >
                              {course.completionRate}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Course History / Rollback */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-base">
              <History className="h-5 w-5 mr-2 text-red-600" />
              Historial de Cursos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {snapshotsLoading || !coursesLoaded ? (
              <div className="text-gray-500 text-center py-4">Cargando...</div>
            ) : allCourses.length === 0 ? (
              <div className="text-center py-4 text-gray-500 text-sm">
                No hay cursos creados
              </div>
            ) : (
              <div className="space-y-3">
                {allCourses.slice(0, 8).map((course) => {
                  const snapshot = snapshotMap.get(course.id);
                  const isSaving = savingCourse === course.id;
                  const isRolling = rollingBack === course.id;

                  return (
                    <div
                      key={course.id}
                      className="p-3 border border-gray-100 rounded-lg"
                    >
                      <div className="flex items-start justify-between mb-1">
                        <p className="text-sm font-medium text-gray-900 line-clamp-1 flex-1 mr-2">
                          {course.title}
                        </p>
                      </div>

                      {snapshot ? (
                        <p className="text-xs text-gray-500 mb-2">
                          Guardado:{' '}
                          {new Date(snapshot.savedAt).toLocaleDateString('es', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-400 mb-2">Sin punto de restauración</p>
                      )}

                      {!isSupervisor && (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleSaveSnapshot(course.id)}
                            disabled={isSaving || isRolling}
                            className="flex items-center text-xs px-2 py-2 rounded bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
                          >
                            {isSaving ? (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : snapshot ? (
                              <Check className="h-3 w-3 mr-1" />
                            ) : (
                              <Save className="h-3 w-3 mr-1" />
                            )}
                            {snapshot ? 'Actualizar' : 'Guardar'}
                          </button>

                          {snapshot && (
                            <button
                              onClick={() => handleRollback(course.id, course.title)}
                              disabled={isSaving || isRolling}
                              className="flex items-center text-xs px-2 py-2 rounded bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
                            >
                              {isRolling ? (
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              ) : (
                                <RotateCcw className="h-3 w-3 mr-1" />
                              )}
                              Restaurar
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Acciones Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              {
                icon: UserCog,
                label: 'Gestionar Usuarios',
                path: '/users',
                color: 'text-red-600 bg-red-50',
              },
              {
                icon: BookOpen,
                label: 'Revisar Cursos',
                path: '/courses',
                color: 'text-red-600 bg-red-50',
              },
              {
                icon: Settings,
                label: 'Configuración',
                path: '/settings',
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
                <span className="text-sm font-medium text-gray-700">{action.label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;
