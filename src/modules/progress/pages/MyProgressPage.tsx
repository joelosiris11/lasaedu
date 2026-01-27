import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@app/store/authStore';
import { localDB } from '@shared/utils/localDB';
import { 
  BookOpen, 
  Clock,
  Trophy,
  Target,
  TrendingUp,
  Calendar,
  CheckCircle,
  Play,
  Award,
  BarChart3,
  Flame,
  Star,
  Zap
} from 'lucide-react';
import { Card, CardContent } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';

interface Enrollment {
  id: string;
  courseId: string;
  userId: string;
  enrolledAt: string;
  progress: number;
  status: 'active' | 'completed' | 'paused';
  completedLessons: string[];
  lastAccessedAt?: string;
  totalTimeSpent?: number; // in minutes
}

interface Course {
  id: string;
  title: string;
  description: string;
  instructor: string;
  duration: string;
  level: string;
  category: string;
  modules?: CourseModule[];
}

interface CourseModule {
  id: string;
  title: string;
  lessons: Lesson[];
}

interface Lesson {
  id: string;
  title: string;
  duration: string;
}

interface ProgressActivity {
  id: string;
  userId: string;
  type: 'lesson_completed' | 'course_started' | 'course_completed' | 'quiz_passed' | 'badge_earned';
  courseId?: string;
  lessonId?: string;
  timestamp: string;
  details?: string;
  points?: number;
}

interface LearningStreak {
  id: string;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string;
}

export default function MyProgressPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [activities, setActivities] = useState<ProgressActivity[]>([]);
  const [streak, setStreak] = useState<LearningStreak>({ id: '', currentStreak: 0, longestStreak: 0, lastActiveDate: '' });
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'all'>('week');

  useEffect(() => {
    loadProgress();
  }, [user]);

  const loadProgress = async () => {
    if (!user) return;

    try {
      // Load enrollments
      const allEnrollments = localDB.getCollection<Enrollment>('enrollments');
      const userEnrollments = allEnrollments.filter(e => e.userId === user.id);
      
      // Generate sample enrollments if none exist
      if (userEnrollments.length === 0) {
        const sampleEnrollments: Enrollment[] = [
          {
            id: 'enroll_1',
            courseId: 'course_1',
            userId: user.id,
            enrolledAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
            progress: 75,
            status: 'active',
            completedLessons: ['lesson_1', 'lesson_2', 'lesson_3', 'lesson_4', 'lesson_5', 'lesson_6'],
            lastAccessedAt: new Date().toISOString(),
            totalTimeSpent: 320
          },
          {
            id: 'enroll_2',
            courseId: 'course_2',
            userId: user.id,
            enrolledAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            progress: 100,
            status: 'completed',
            completedLessons: ['lesson_1', 'lesson_2', 'lesson_3', 'lesson_4', 'lesson_5'],
            lastAccessedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            totalTimeSpent: 480
          },
          {
            id: 'enroll_3',
            courseId: 'course_3',
            userId: user.id,
            enrolledAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            progress: 30,
            status: 'active',
            completedLessons: ['lesson_1', 'lesson_2'],
            lastAccessedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            totalTimeSpent: 90
          }
        ];
        
        sampleEnrollments.forEach(e => localDB.add('enrollments', e));
        setEnrollments(sampleEnrollments);
      } else {
        setEnrollments(userEnrollments);
      }

      // Load courses
      const allCourses = localDB.getCollection<Course>('courses');
      setCourses(allCourses);

      // Load or generate activities
      const allActivities = localDB.getCollection<ProgressActivity>('progressActivities');
      const userActivities = allActivities.filter(a => a.userId === user.id);
      
      if (userActivities.length === 0) {
        const sampleActivities: ProgressActivity[] = [
          {
            id: 'act_1',
            userId: user.id,
            type: 'lesson_completed',
            courseId: 'course_1',
            lessonId: 'lesson_6',
            timestamp: new Date().toISOString(),
            details: 'Variables y tipos de datos',
            points: 25
          },
          {
            id: 'act_2',
            userId: user.id,
            type: 'quiz_passed',
            courseId: 'course_1',
            timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            details: 'Quiz: Fundamentos de Python',
            points: 50
          },
          {
            id: 'act_3',
            userId: user.id,
            type: 'course_completed',
            courseId: 'course_2',
            timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            details: 'Matemáticas Avanzadas',
            points: 200
          },
          {
            id: 'act_4',
            userId: user.id,
            type: 'badge_earned',
            timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            details: 'Primera graduación',
            points: 100
          },
          {
            id: 'act_5',
            userId: user.id,
            type: 'lesson_completed',
            courseId: 'course_3',
            lessonId: 'lesson_2',
            timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            details: 'Componentes en React',
            points: 25
          }
        ];
        
        sampleActivities.forEach(a => localDB.add('progressActivities', a));
        setActivities(sampleActivities);
      } else {
        setActivities(userActivities);
      }

      // Calculate streak
      const streakData = localDB.getById<LearningStreak>('learningStreaks', user.id);
      if (streakData) {
        setStreak(streakData);
      } else {
        const newStreak: LearningStreak = { id: user.id, currentStreak: 5, longestStreak: 12, lastActiveDate: new Date().toISOString() };
        localDB.add('learningStreaks', newStreak);
        setStreak(newStreak);
      }
    } catch (error) {
      console.error('Error loading progress:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCourse = (courseId: string) => {
    return courses.find(c => c.id === courseId);
  };

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'lesson_completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'course_started': return <Play className="h-4 w-4 text-blue-500" />;
      case 'course_completed': return <Trophy className="h-4 w-4 text-yellow-500" />;
      case 'quiz_passed': return <Target className="h-4 w-4 text-purple-500" />;
      case 'badge_earned': return <Award className="h-4 w-4 text-amber-500" />;
      default: return <Zap className="h-4 w-4 text-gray-500" />;
    }
  };

  const getActivityLabel = (type: string) => {
    switch (type) {
      case 'lesson_completed': return 'Lección completada';
      case 'course_started': return 'Curso iniciado';
      case 'course_completed': return 'Curso completado';
      case 'quiz_passed': return 'Evaluación aprobada';
      case 'badge_earned': return 'Insignia obtenida';
      default: return 'Actividad';
    }
  };

  const stats = {
    totalCourses: enrollments.length,
    completedCourses: enrollments.filter(e => e.status === 'completed').length,
    totalLessons: enrollments.reduce((acc, e) => acc + e.completedLessons.length, 0),
    totalTime: enrollments.reduce((acc, e) => acc + (e.totalTimeSpent || 0), 0),
    avgProgress: Math.round(enrollments.reduce((acc, e) => acc + e.progress, 0) / (enrollments.length || 1)),
    totalPoints: activities.reduce((acc, a) => acc + (a.points || 0), 0)
  };

  const weekDays = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const activityHeatmap = weekDays.map(() => {
    // Simulate activity for each day
    const dayActivities = Math.floor(Math.random() * 5);
    return dayActivities;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mi Progreso</h1>
          <p className="text-gray-600">Seguimiento de tu aprendizaje y logros</p>
        </div>
        <div className="flex items-center space-x-2">
          <select
            value={selectedPeriod}
            onChange={e => setSelectedPeriod(e.target.value as any)}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="week">Esta semana</option>
            <option value="month">Este mes</option>
            <option value="all">Todo el tiempo</option>
          </select>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="p-4 text-center">
            <BookOpen className="h-6 w-6 mx-auto mb-2 text-blue-200" />
            <p className="text-2xl font-bold">{stats.totalCourses}</p>
            <p className="text-xs text-blue-200">Cursos Inscritos</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardContent className="p-4 text-center">
            <Trophy className="h-6 w-6 mx-auto mb-2 text-green-200" />
            <p className="text-2xl font-bold">{stats.completedCourses}</p>
            <p className="text-xs text-green-200">Completados</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardContent className="p-4 text-center">
            <CheckCircle className="h-6 w-6 mx-auto mb-2 text-purple-200" />
            <p className="text-2xl font-bold">{stats.totalLessons}</p>
            <p className="text-xs text-purple-200">Lecciones</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
          <CardContent className="p-4 text-center">
            <Clock className="h-6 w-6 mx-auto mb-2 text-amber-200" />
            <p className="text-2xl font-bold">{formatTime(stats.totalTime)}</p>
            <p className="text-xs text-amber-200">Tiempo Total</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
          <CardContent className="p-4 text-center">
            <Flame className="h-6 w-6 mx-auto mb-2 text-red-200" />
            <p className="text-2xl font-bold">{streak.currentStreak}</p>
            <p className="text-xs text-red-200">Días de Racha</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white">
          <CardContent className="p-4 text-center">
            <Star className="h-6 w-6 mx-auto mb-2 text-indigo-200" />
            <p className="text-2xl font-bold">{stats.totalPoints}</p>
            <p className="text-xs text-indigo-200">Puntos XP</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Courses */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center">
                  <TrendingUp className="h-5 w-5 mr-2 text-indigo-600" />
                  Cursos en Progreso
                </h2>
                <Button variant="outline" size="sm" onClick={() => navigate('/catalog')}>
                  Ver catálogo
                </Button>
              </div>

              {enrollments.filter(e => e.status === 'active').length === 0 ? (
                <div className="text-center py-8">
                  <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500">No tienes cursos en progreso</p>
                  <Button className="mt-4" onClick={() => navigate('/catalog')}>
                    Explorar cursos
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {enrollments.filter(e => e.status === 'active').map(enrollment => {
                    const course = getCourse(enrollment.courseId);
                    if (!course) return null;

                    return (
                      <div key={enrollment.id} className="border rounded-lg p-4 hover:border-indigo-300 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-medium">{course.title}</h3>
                            <p className="text-sm text-gray-500">{course.instructor}</p>
                            
                            <div className="mt-3">
                              <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-600">{enrollment.completedLessons.length} lecciones completadas</span>
                                <span className="font-medium text-indigo-600">{enrollment.progress}%</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-3">
                                <div 
                                  className={`h-3 rounded-full transition-all ${
                                    enrollment.progress >= 75 ? 'bg-green-500' :
                                    enrollment.progress >= 50 ? 'bg-yellow-500' : 'bg-indigo-500'
                                  }`}
                                  style={{ width: `${enrollment.progress}%` }}
                                />
                              </div>
                            </div>

                            <div className="flex items-center mt-3 text-xs text-gray-500 space-x-4">
                              <span className="flex items-center">
                                <Clock className="h-3 w-3 mr-1" />
                                {formatTime(enrollment.totalTimeSpent || 0)} dedicado
                              </span>
                              <span className="flex items-center">
                                <Calendar className="h-3 w-3 mr-1" />
                                Último acceso: {new Date(enrollment.lastAccessedAt || '').toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          
                          <Button 
                            size="sm" 
                            className="ml-4"
                            onClick={() => navigate(`/courses/${enrollment.courseId}`)}
                          >
                            <Play className="h-4 w-4 mr-1" />
                            Continuar
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Completed Courses */}
          {enrollments.filter(e => e.status === 'completed').length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h2 className="text-lg font-semibold flex items-center mb-4">
                  <Trophy className="h-5 w-5 mr-2 text-yellow-600" />
                  Cursos Completados
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {enrollments.filter(e => e.status === 'completed').map(enrollment => {
                    const course = getCourse(enrollment.courseId);
                    if (!course) return null;

                    return (
                      <div key={enrollment.id} className="border rounded-lg p-3 bg-green-50 border-green-200">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center mr-3">
                            <CheckCircle className="h-5 w-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-medium text-sm">{course.title}</h3>
                            <p className="text-xs text-gray-500">
                              Completado el {new Date(enrollment.lastAccessedAt || '').toLocaleDateString()}
                            </p>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => navigate('/certificates')}
                          >
                            <Award className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Learning Streak */}
          <Card>
            <CardContent className="p-4">
              <h2 className="text-lg font-semibold flex items-center mb-4">
                <Flame className="h-5 w-5 mr-2 text-orange-500" />
                Racha de Aprendizaje
              </h2>

              <div className="text-center mb-4">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-orange-400 to-red-500 rounded-full">
                  <span className="text-3xl font-bold text-white">{streak.currentStreak}</span>
                </div>
                <p className="text-sm text-gray-600 mt-2">días consecutivos</p>
              </div>

              <div className="flex justify-between text-sm mb-3">
                <span className="text-gray-600">Mejor racha:</span>
                <span className="font-medium">{streak.longestStreak} días</span>
              </div>

              {/* Weekly Activity */}
              <div className="border-t pt-3">
                <p className="text-sm text-gray-600 mb-2">Actividad esta semana</p>
                <div className="flex justify-between">
                  {weekDays.map((day, index) => (
                    <div key={day} className="text-center">
                      <div 
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                          activityHeatmap[index] >= 3 ? 'bg-green-500 text-white' :
                          activityHeatmap[index] >= 1 ? 'bg-green-200 text-green-800' :
                          'bg-gray-100 text-gray-400'
                        }`}
                      >
                        {activityHeatmap[index] > 0 ? activityHeatmap[index] : '-'}
                      </div>
                      <span className="text-xs text-gray-500 mt-1">{day}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardContent className="p-4">
              <h2 className="text-lg font-semibold flex items-center mb-4">
                <BarChart3 className="h-5 w-5 mr-2 text-indigo-600" />
                Actividad Reciente
              </h2>

              {activities.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Sin actividad reciente</p>
              ) : (
                <div className="space-y-3">
                  {activities.slice(0, 5).map(activity => (
                    <div key={activity.id} className="flex items-start">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center mr-3">
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{getActivityLabel(activity.type)}</p>
                        <p className="text-xs text-gray-500">{activity.details}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(activity.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                      {activity.points && (
                        <span className="text-sm font-medium text-indigo-600">+{activity.points} XP</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <Button 
                variant="outline" 
                className="w-full mt-4"
                onClick={() => navigate('/gamification')}
              >
                Ver todos los logros
              </Button>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
            <CardContent className="p-4">
              <h2 className="font-semibold mb-3">Promedio General</h2>
              <div className="flex items-center justify-center">
                <div className="relative w-24 h-24">
                  <svg className="w-24 h-24 transform -rotate-90">
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      stroke="rgba(255,255,255,0.2)"
                      strokeWidth="8"
                      fill="none"
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      stroke="white"
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={`${stats.avgProgress * 2.51} 251`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold">{stats.avgProgress}%</span>
                  </div>
                </div>
              </div>
              <p className="text-center text-indigo-200 text-sm mt-2">
                de progreso en tus cursos
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
