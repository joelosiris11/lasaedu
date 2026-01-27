import { useAuthStore } from '@app/store/authStore';
import { 
  BookOpen, 
  Trophy, 
  Clock, 
  Target,
  TrendingUp,
  Calendar,
  Star,
  CheckCircle,
  PlayCircle,
  Award
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/Card';
import { useStudentCourses } from '@shared/hooks/useDashboard';
const StudentDashboard = () => {
  const { user } = useAuthStore();
  const { courses, loading } = useStudentCourses(user?.id || '');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Cargando cursos...</div>
      </div>
    );
  }

  // Calcular estadísticas basadas en datos reales
  const totalCourses = courses.length;
  const avgProgress = courses.length > 0 
    ? Math.round(courses.reduce((sum, course) => sum + course.progress, 0) / courses.length)
    : 0;
  const totalHours = Math.floor(totalCourses * 8.5); // Mock calculation
  const certificates = courses.filter(c => c.progress >= 100).length;

  const stats = [
    { title: 'Cursos Inscritos', value: totalCourses.toString(), icon: BookOpen, change: '+1 este mes', color: 'text-blue-600' },
    { title: 'Progreso General', value: `${avgProgress}%`, icon: TrendingUp, change: '+12% esta semana', color: 'text-green-600' },
    { title: 'Horas Estudiadas', value: `${totalHours}h`, icon: Clock, change: '+8h esta semana', color: 'text-purple-600' },
    { title: 'Certificados', value: certificates.toString(), icon: Trophy, change: '+1 este mes', color: 'text-orange-600' },
  ];

  // Mock data para elementos que aún no tenemos en BD
  const upcomingTasks = [
    { task: 'Entrega Proyecto React', course: 'React Fundamentals', dueDate: 'Mañana', urgent: true },
    { task: 'Quiz TypeScript Módulo 3', course: 'TypeScript Avanzado', dueDate: '3 días', urgent: false },
    { task: 'Revisión de Pares', course: 'Node.js Backend', dueDate: '5 días', urgent: false },
  ];

  const recentAchievements = [
    { title: 'Completaste React Fundamentals', type: 'course', date: 'Ayer' },
    { title: 'Primera racha de 7 días', type: 'streak', date: 'Hace 3 días' },
    { title: 'Nota perfecta en TypeScript', type: 'grade', date: 'Hace 1 semana' },
  ];

  const recommendations = [
    { title: 'JavaScript ES6+', level: 'Intermedio', rating: 4.8 },
    { title: 'Vue.js Essentials', level: 'Principiante', rating: 4.9 },
    { title: 'Database Design', level: 'Avanzado', rating: 4.7 },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-800 rounded-xl p-6 text-white">
        <h1 className="text-2xl font-bold">¡Hola, {user?.name}!</h1>
        <p className="text-purple-100 mt-2">
          Continúa tu aprendizaje y alcanza tus metas
        </p>
        <div className="mt-4 flex items-center space-x-4">
          <div className="flex items-center">
            <Target className="h-5 w-5 mr-2" />
            <span>Meta semanal: 10h</span>
          </div>
          <div className="bg-purple-700 px-3 py-1 rounded-full text-sm">
            8.5h completadas
          </div>
        </div>
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
                  <p className="text-sm text-green-600">{stat.change}</p>
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
              <CardTitle className="flex items-center">
                <BookOpen className="h-5 w-5 mr-2" />
                Mis Cursos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {courses.map((course) => (
                  <div key={course.id} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-medium text-gray-900">{course.title}</h3>
                        <p className="text-sm text-gray-600">por {course.instructor}</p>
                      </div>
                      <button className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200">
                        <PlayCircle className="h-5 w-5" />
                      </button>
                    </div>
                    
                    <div className="mb-3">
                      <div className="flex justify-between text-sm mb-1">
                        <span>Progreso</span>
                        <span>{course.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ width: `${course.progress}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">
                        Estado: {course.status === 'activo' ? 'En progreso' : course.status}
                      </span>
                      <span className="text-orange-600">
                        Último acceso: {new Date(course.lastActivity).toLocaleDateString('es')}
                      </span>
                    </div>
                  </div>
                ))}
                {courses.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No tienes cursos inscritos aún
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              Próximas Tareas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingTasks.map((task, index) => (
                <div key={index} className="p-3 border border-gray-200 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <div className={`w-2 h-2 rounded-full mt-2 ${
                      task.urgent ? 'bg-red-500' : 'bg-blue-500'
                    }`} />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{task.task}</p>
                      <p className="text-xs text-gray-600 mt-1">{task.course}</p>
                      <p className={`text-xs mt-1 ${
                        task.urgent ? 'text-red-600' : 'text-gray-500'
                      }`}>
                        Vence en {task.dueDate}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Achievements */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Trophy className="h-5 w-5 mr-2" />
              Logros Recientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentAchievements.map((achievement, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    {achievement.type === 'course' && <CheckCircle className="h-5 w-5 text-yellow-600" />}
                    {achievement.type === 'streak' && <Target className="h-5 w-5 text-yellow-600" />}
                    {achievement.type === 'grade' && <Award className="h-5 w-5 text-yellow-600" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{achievement.title}</p>
                    <p className="text-xs text-gray-500">{achievement.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Course Recommendations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Star className="h-5 w-5 mr-2" />
              Cursos Recomendados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recommendations.map((rec, index) => (
                <div key={index} className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{rec.title}</p>
                      <p className="text-xs text-gray-600">{rec.level}</p>
                    </div>
                    <div className="flex items-center">
                      <Star className="h-4 w-4 text-yellow-500 mr-1" />
                      <span className="text-sm text-gray-600">{rec.rating}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StudentDashboard;