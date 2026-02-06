import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@app/store/authStore';
import { courseService, legacyEnrollmentService, gamificationService } from '@shared/services/dataService';
import type { DBCourse, DBEnrollment } from '@shared/services/dataService';
import { 
  BookOpen, 
  Search, 
  Users,
  Clock,
  Star,
  CheckCircle,
  Play,
  Grid,
  List as ListIcon,
  GraduationCap,
  Award,
  TrendingUp
} from 'lucide-react';
import { Card, CardContent } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';

interface Course extends DBCourse {}

interface Enrollment extends DBEnrollment {}

export default function CourseCatalogPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [enrolling, setEnrolling] = useState<string | null>(null);
  const [showEnrollSuccess, setShowEnrollSuccess] = useState(false);

  // Role checks
  const isStudent = user?.role === 'student';
  const isTeacher = user?.role === 'teacher';
  const isAdmin = user?.role === 'admin';
  const canEnroll = isStudent; // Only students can enroll in courses

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      // Load published courses from database
      const allCourses = await courseService.getAll();
      const publishedCourses = allCourses.filter(c => c.status === 'publicado');
      setCourses(publishedCourses);

      // Load user enrollments
      if (user) {
        const allEnrollments = await legacyEnrollmentService.getAll();
        const userEnrollments = allEnrollments.filter(e => e.userId === user.id);
        setEnrollments(userEnrollments);
      }
    } catch (error) {
      console.error('Error loading courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async (courseId: string) => {
    if (!user) {
      navigate('/login');
      return;
    }

    // Only students can enroll
    if (!canEnroll) {
      console.warn('Only students can enroll in courses');
      return;
    }

    setEnrolling(courseId);
    
    try {
      // Check if already enrolled
      const existing = enrollments.find(e => e.courseId === courseId);
      if (existing) {
        navigate(`/courses/${courseId}`);
        return;
      }

      // Create enrollment using Firebase service
      const now = Date.now();
      const newEnrollment = await legacyEnrollmentService.create({
        courseId,
        userId: user.id,
        enrolledAt: new Date().toISOString(),
        progress: 0,
        status: 'active',
        completedLessons: [],
        completedModules: [],
        totalTimeSpent: 0,
        lastAccessedAt: new Date().toISOString(),
        createdAt: now,
        updatedAt: now
      });

      setEnrollments([...enrollments, newEnrollment as Enrollment]);

      // Update course student count
      const course = courses.find(c => c.id === courseId);
      if (course) {
        await courseService.update(courseId, {
          studentsCount: (course.studentsCount || 0) + 1
        });
        setCourses(courses.map(c =>
          c.id === courseId ? { ...c, studentsCount: (c.studentsCount || 0) + 1 } : c
        ));
      }

      // Award points for enrollment (gamification)
      await gamificationService.addPoints(
        user.id,
        50,
        'course_enrollment',
        `Inscripción en: ${course?.title}`
      );

      setShowEnrollSuccess(true);
      setTimeout(() => {
        setShowEnrollSuccess(false);
        navigate(`/courses/${courseId}`);
      }, 2000);
    } catch (error) {
      console.error('Error enrolling:', error);
    } finally {
      setEnrolling(null);
    }
  };

  const isEnrolled = (courseId: string) => {
    return enrollments.some(e => e.courseId === courseId);
  };

  const getEnrollmentProgress = (courseId: string) => {
    const enrollment = enrollments.find(e => e.courseId === courseId);
    return enrollment?.progress || 0;
  };

  const filteredCourses = courses.filter(course => {
    const matchesSearch = course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         course.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         course.instructor.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || course.category === categoryFilter;
    const matchesLevel = levelFilter === 'all' || course.level === levelFilter;
    return matchesSearch && matchesCategory && matchesLevel;
  });

  const categories = [...new Set(courses.map(c => c.category))];

  const stats = {
    totalCourses: courses.length,
    enrolled: enrollments.length,
    completed: enrollments.filter(e => e.status === 'completed').length,
    inProgress: enrollments.filter(e => e.status === 'active').length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Success Message */}
      {showEnrollSuccess && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-4 rounded-lg shadow-lg flex items-center animate-fade-in">
          <CheckCircle className="h-6 w-6 mr-3" />
          <div>
            <p className="font-medium">¡Inscripción exitosa!</p>
            <p className="text-sm opacity-90">Redirigiendo al curso...</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Catálogo de Cursos</h1>
        <p className="text-gray-600">
          {canEnroll
            ? 'Explora y inscríbete en los cursos disponibles'
            : isTeacher
              ? 'Explora los cursos disponibles en la plataforma'
              : 'Vista general de todos los cursos publicados'
          }
        </p>
      </div>

      {/* Stats Cards - Only show enrollment stats for students */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">Cursos Disponibles</p>
                <p className="text-2xl font-bold">{stats.totalCourses}</p>
              </div>
              <BookOpen className="h-8 w-8 text-blue-200" />
            </div>
          </CardContent>
        </Card>

        {canEnroll ? (
          <>
            <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100 text-sm">Mis Cursos</p>
                    <p className="text-2xl font-bold">{stats.enrolled}</p>
                  </div>
                  <GraduationCap className="h-8 w-8 text-green-200" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-100 text-sm">En Progreso</p>
                    <p className="text-2xl font-bold">{stats.inProgress}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-purple-200" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-amber-100 text-sm">Completados</p>
                    <p className="text-2xl font-bold">{stats.completed}</p>
                  </div>
                  <Award className="h-8 w-8 text-amber-200" />
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100 text-sm">Categorías</p>
                    <p className="text-2xl font-bold">{categories.length}</p>
                  </div>
                  <GraduationCap className="h-8 w-8 text-green-200" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white md:col-span-2">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-100 text-sm">Vista de</p>
                    <p className="text-lg font-bold">{isTeacher ? 'Profesor' : 'Administrador'}</p>
                  </div>
                  <Users className="h-8 w-8 text-purple-200" />
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar cursos..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Todas las categorías</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
              ))}
            </select>
            
            <select
              value={levelFilter}
              onChange={e => setLevelFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Todos los niveles</option>
              <option value="principiante">Principiante</option>
              <option value="intermedio">Intermedio</option>
              <option value="avanzado">Avanzado</option>
            </select>

            <div className="flex border rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-2 ${viewMode === 'grid' ? 'bg-indigo-100 text-indigo-700' : 'bg-white'}`}
              >
                <Grid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 ${viewMode === 'list' ? 'bg-indigo-100 text-indigo-700' : 'bg-white'}`}
              >
                <ListIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Course Grid/List */}
      {filteredCourses.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No se encontraron cursos</h3>
            <p className="text-gray-500">Intenta con otros filtros de búsqueda</p>
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map(course => {
            const enrolled = isEnrolled(course.id);
            const progress = getEnrollmentProgress(course.id);
            
            return (
              <Card key={course.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                {/* Course Image */}
                <div className="h-40 bg-gradient-to-br from-indigo-500 to-purple-600 relative">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <BookOpen className="h-16 w-16 text-white/30" />
                  </div>
                  {enrolled && (
                    <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs flex items-center">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Inscrito
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      course.level === 'principiante' ? 'bg-blue-500' :
                      course.level === 'intermedio' ? 'bg-yellow-500' : 'bg-red-500'
                    } text-white`}>
                      {course.level.charAt(0).toUpperCase() + course.level.slice(1)}
                    </span>
                  </div>
                </div>

                <CardContent className="p-4">
                  <h3 className="font-bold text-lg mb-2 line-clamp-1">{course.title}</h3>
                  <p className="text-gray-600 text-sm mb-3 line-clamp-2">{course.description}</p>
                  
                  <div className="flex items-center text-sm text-gray-500 mb-3">
                    <Users className="h-4 w-4 mr-1" />
                    <span>{course.studentsCount} estudiantes</span>
                    <span className="mx-2">•</span>
                    <Clock className="h-4 w-4 mr-1" />
                    <span>{course.duration}</span>
                  </div>

                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-600">Por: {course.instructor}</span>
                    {course.rating && (
                      <div className="flex items-center">
                        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                        <span className="ml-1 text-sm font-medium">{course.rating}</span>
                      </div>
                    )}
                  </div>

                  {enrolled && progress > 0 && (
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Progreso</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {canEnroll ? (
                    <Button
                      className="w-full"
                      variant={enrolled ? 'outline' : 'default'}
                      onClick={() => enrolled ? navigate(`/courses/${course.id}`) : handleEnroll(course.id)}
                      disabled={enrolling === course.id}
                    >
                      {enrolling === course.id ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                          Inscribiendo...
                        </>
                      ) : enrolled ? (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Continuar
                        </>
                      ) : (
                        <>
                          <GraduationCap className="h-4 w-4 mr-2" />
                          Inscribirse
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => navigate(`/courses/${course.id}`)}
                    >
                      <BookOpen className="h-4 w-4 mr-2" />
                      Ver Curso
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCourses.map(course => {
            const enrolled = isEnrolled(course.id);
            const progress = getEnrollmentProgress(course.id);
            
            return (
              <Card key={course.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start">
                    {/* Course Image */}
                    <div className="w-48 h-28 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex-shrink-0 relative">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <BookOpen className="h-10 w-10 text-white/30" />
                      </div>
                      {enrolled && (
                        <div className="absolute top-2 right-2 bg-green-500 text-white p-1 rounded-full">
                          <CheckCircle className="h-3 w-3" />
                        </div>
                      )}
                    </div>

                    {/* Course Info */}
                    <div className="ml-4 flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-bold text-lg">{course.title}</h3>
                          <p className="text-sm text-gray-500">Por: {course.instructor}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            course.level === 'principiante' ? 'bg-blue-100 text-blue-700' :
                            course.level === 'intermedio' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {course.level.charAt(0).toUpperCase() + course.level.slice(1)}
                          </span>
                          {course.rating && (
                            <div className="flex items-center px-2 py-1 bg-yellow-50 rounded">
                              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                              <span className="ml-1 text-sm font-medium">{course.rating}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <p className="text-gray-600 text-sm mt-2 line-clamp-2">{course.description}</p>
                      
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center text-sm text-gray-500 space-x-4">
                          <span className="flex items-center">
                            <Users className="h-4 w-4 mr-1" />
                            {course.studentsCount} estudiantes
                          </span>
                          <span className="flex items-center">
                            <Clock className="h-4 w-4 mr-1" />
                            {course.duration}
                          </span>
                        </div>
                        
                        {canEnroll ? (
                          <Button
                            variant={enrolled ? 'outline' : 'default'}
                            onClick={() => enrolled ? navigate(`/courses/${course.id}`) : handleEnroll(course.id)}
                            disabled={enrolling === course.id}
                          >
                            {enrolling === course.id ? 'Inscribiendo...' : enrolled ? 'Continuar' : 'Inscribirse'}
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            onClick={() => navigate(`/courses/${course.id}`)}
                          >
                            Ver Curso
                          </Button>
                        )}
                      </div>

                      {enrolled && progress > 0 && (
                        <div className="mt-2">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-green-500 h-2 rounded-full"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">{progress}% completado</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
