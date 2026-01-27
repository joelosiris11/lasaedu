import { useAuthStore } from '@app/store/authStore';
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

const TeacherDashboard = () => {
  const { user } = useAuthStore();

  const stats = [
    { title: 'Mis Cursos', value: '8', icon: BookOpen, change: '+2 este mes', color: 'text-blue-600' },
    { title: 'Estudiantes Activos', value: '247', icon: Users, change: '+15 esta semana', color: 'text-green-600' },
    { title: 'Horas Impartidas', value: '156h', icon: Clock, change: '+12h esta semana', color: 'text-purple-600' },
    { title: 'Promedio Calificaciones', value: '8.4', icon: Award, change: '+0.2 vs mes anterior', color: 'text-orange-600' },
  ];

  const myCourses = [
    { id: 1, title: 'React Fundamentals', students: 45, progress: 78, status: 'active' },
    { id: 2, title: 'TypeScript Avanzado', students: 32, progress: 92, status: 'active' },
    { id: 3, title: 'Node.js Backend', students: 28, progress: 45, status: 'active' },
    { id: 4, title: 'Testing con Jest', students: 19, progress: 15, status: 'draft' },
  ];

  const pendingTasks = [
    { task: 'Revisar entregas de React Fundamentals', urgent: true, count: 12 },
    { task: 'Calificar examen TypeScript', urgent: false, count: 8 },
    { task: 'Responder preguntas del foro', urgent: true, count: 23 },
    { task: 'Preparar material Semana 6', urgent: false, count: 1 },
  ];

  const recentActivity = [
    { action: 'Nueva entrega recibida', course: 'React Fundamentals', time: '5 min' },
    { action: 'Pregunta en el foro', course: 'TypeScript Avanzado', time: '20 min' },
    { action: 'Estudiante completó módulo', course: 'Node.js Backend', time: '1h' },
    { action: 'Calificación promediada', course: 'Testing con Jest', time: '2h' },
  ];

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
                  <p className="text-sm text-green-600">{stat.change}</p>
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
                      <button className="p-2 text-gray-400 hover:text-gray-600">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button className="p-2 text-gray-400 hover:text-gray-600">
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
              <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <BookOpen className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                <span className="text-sm font-medium">Crear Curso</span>
              </button>
              <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <MessageSquare className="h-6 w-6 text-green-600 mx-auto mb-2" />
                <span className="text-sm font-medium">Revisar Foros</span>
              </button>
              <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <Calendar className="h-6 w-6 text-purple-600 mx-auto mb-2" />
                <span className="text-sm font-medium">Programar Clase</span>
              </button>
              <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
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