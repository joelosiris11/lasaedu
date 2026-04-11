import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@app/store/authStore';
import { courseService, type DBCourse } from '@shared/services/dataService';
import {
  BookOpen,
  Plus,
  Search,
  Edit3,
  Eye,
  Clock,
  Globe,
  Play,
  Pause,
  Archive,
  Trash2,
  Layers,
} from 'lucide-react';
import { Card, CardContent } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';

const CoursesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [courses, setCourses] = useState<DBCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const loadCourses = async () => {
    setLoading(true);
    try {
      const data = await courseService.getAll();
      setCourses(data);
    } catch (error) {
      console.error('Error loading courses:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, []);

  const filteredCourses = courses.filter(course => {
    const matchesSearch = course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         course.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || course.status === statusFilter;

    if (user?.role === 'teacher') {
      return course.instructorId === user.id && matchesSearch && matchesStatus;
    }

    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: user?.role === 'teacher' ? courses.filter(c => c.instructorId === user.id).length : courses.length,
    published: courses.filter(c => c.status === 'publicado' && (user?.role !== 'teacher' || c.instructorId === user.id)).length,
    draft: courses.filter(c => c.status === 'borrador' && (user?.role !== 'teacher' || c.instructorId === user.id)).length,
    archived: courses.filter(c => c.status === 'archivado' && (user?.role !== 'teacher' || c.instructorId === user.id)).length
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (confirm('Estas seguro de que quieres eliminar este curso?')) {
      try {
        const success = await courseService.delete(courseId);
        if (success) {
          setCourses(courses.filter(c => c.id !== courseId));
        }
      } catch (error) {
        console.error('Error deleting course:', error);
      }
    }
  };

  const handleChangeStatus = async (courseId: string, newStatus: DBCourse['status']) => {
    try {
      const updatedCourse = await courseService.update(courseId, { status: newStatus });
      if (updatedCourse) {
        setCourses(courses.map(c => c.id === courseId ? updatedCourse : c));
      }
    } catch (error) {
      console.error('Error updating course status:', error);
    }
  };

  const getStatusBadge = (status: DBCourse['status']) => {
    const badges = {
      borrador: { color: 'bg-gray-100 text-gray-800', icon: Edit3, text: 'Borrador' },
      publicado: { color: 'bg-red-100 text-red-800', icon: Globe, text: 'Publicado' },
      archivado: { color: 'bg-red-100 text-red-800', icon: Archive, text: 'Archivado' }
    };
    const badge = badges[status];
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="h-3 w-3 mr-1" />
        {badge.text}
      </span>
    );
  };

  const getLevelBadge = (level: DBCourse['level']) => {
    const colors = {
      principiante: 'bg-red-50 text-red-700',
      intermedio: 'bg-red-100 text-red-800',
      avanzado: 'bg-red-200 text-red-900'
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[level]}`}>
        {level.charAt(0).toUpperCase() + level.slice(1)}
      </span>
    );
  };

  const canEdit = (course: DBCourse) =>
    course.instructorId === user?.id || user?.role === 'admin';

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center">
              <div className="p-3 bg-red-100 rounded-lg">
                <BookOpen className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center">
              <div className="p-3 bg-red-100 rounded-lg">
                <Globe className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Publicados</p>
                <p className="text-2xl font-bold text-gray-900">{stats.published}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center">
              <div className="p-3 bg-red-50 rounded-lg">
                <Edit3 className="h-6 w-6 text-red-500" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Borradores</p>
                <p className="text-2xl font-bold text-gray-900">{stats.draft}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center">
              <div className="p-3 bg-red-100 rounded-lg">
                <Archive className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Archivados</p>
                <p className="text-2xl font-bold text-gray-900">{stats.archived}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters + New Course */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar cursos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
        >
          <option value="all">Todos los estados</option>
          <option value="publicado">Publicados</option>
          <option value="borrador">Borradores</option>
          <option value="archivado">Archivados</option>
        </select>
        <Button onClick={() => navigate('/courses/new')} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Nuevo Curso</span>
          <span className="sm:hidden">Nuevo</span>
        </Button>
      </div>

      {/* Courses Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </CardContent>
            </Card>
          ))
        ) : filteredCourses.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <BookOpen className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No se encontraron cursos</h3>
            <p className="text-gray-500 mb-6">
              {user?.role === 'teacher'
                ? 'Aun no has creado ningun curso. Crea tu primer curso!'
                : 'No hay cursos que coincidan con tu busqueda'
              }
            </p>
            <Button onClick={() => navigate('/courses/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Crear Curso
            </Button>
          </div>
        ) : (
          filteredCourses.map((course) => (
            <Card key={course.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="mb-4">
                  <h3 className="font-semibold text-lg text-gray-900 mb-2">{course.title}</h3>
                  <p className="text-gray-600 text-sm line-clamp-2">{course.description}</p>
                </div>

                <div className="flex items-center gap-2 mb-4">
                  {getStatusBadge(course.status)}
                  {getLevelBadge(course.level)}
                </div>

                <div className="space-y-1.5 text-sm text-gray-500 mb-4">
                  <div className="flex items-center">
                    <Layers className="h-4 w-4 mr-2" />
                    <span>{course.sectionsCount || 0} secciones</span>
                  </div>
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-2" />
                    <span>{course.duration}</span>
                  </div>
                </div>

                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => navigate(`/courses/${course.id}`)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Ver
                  </Button>
                  {canEdit(course) && (
                    <>
                      {course.status === 'borrador' && (
                        <Button
                          size="sm"
                          onClick={() => handleChangeStatus(course.id, 'publicado')}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                      {course.status === 'publicado' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleChangeStatus(course.id, 'archivado')}
                        >
                          <Pause className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => handleDeleteCourse(course.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default CoursesPage;
