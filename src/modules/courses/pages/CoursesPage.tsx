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
  Users,
  Clock,
  Star,
  Globe,
  Play,
  Pause,
  Archive,
  MoreHorizontal,
  Trash2
} from 'lucide-react';
import { Card, CardContent } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { Label } from '@shared/components/ui/Label';

const CoursesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [courses, setCourses] = useState<DBCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<DBCourse | null>(null);

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

  // Filtrar cursos según rol y filtros
  const filteredCourses = courses.filter(course => {
    const matchesSearch = course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         course.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || course.status === statusFilter;
    
    // Si es profesor, solo ver sus cursos
    if (user?.role === 'teacher') {
      return course.instructorId === user.id && matchesSearch && matchesStatus;
    }
    
    return matchesSearch && matchesStatus;
  });

  // Estadísticas
  const stats = {
    total: user?.role === 'teacher' ? courses.filter(c => c.instructorId === user.id).length : courses.length,
    published: courses.filter(c => c.status === 'publicado' && (user?.role !== 'teacher' || c.instructorId === user.id)).length,
    draft: courses.filter(c => c.status === 'borrador' && (user?.role !== 'teacher' || c.instructorId === user.id)).length,
    archived: courses.filter(c => c.status === 'archivado' && (user?.role !== 'teacher' || c.instructorId === user.id)).length
  };

  const handleCreateCourse = async (courseData: Partial<DBCourse>) => {
    try {
      const now = Date.now();
      const newCourse = await courseService.create({
        ...courseData,
        instructorId: user?.id || '',
        instructor: user?.name || '',
        studentsCount: 0,
        status: 'borrador',
        createdAt: now,
        updatedAt: now,
      } as Omit<DBCourse, 'id'>);
      
      setCourses([...courses, newCourse]);
      setShowCreateModal(false);
    } catch (error) {
      console.error('Error creating course:', error);
    }
  };

  const handleEditCourse = async (courseData: Partial<DBCourse>) => {
    if (!selectedCourse) return;
    
    try {
      const updatedCourse = await courseService.update(selectedCourse.id, courseData);
      if (updatedCourse) {
        setCourses(courses.map(c => c.id === selectedCourse.id ? updatedCourse : c));
        setShowEditModal(false);
        setSelectedCourse(null);
      }
    } catch (error) {
      console.error('Error updating course:', error);
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (confirm('¿Estás seguro de que quieres eliminar este curso?')) {
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
      publicado: { color: 'bg-green-100 text-green-800', icon: Globe, text: 'Publicado' },
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
      principiante: 'bg-blue-100 text-blue-800',
      intermedio: 'bg-yellow-100 text-yellow-800',
      avanzado: 'bg-red-100 text-red-800'
    };
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[level]}`}>
        {level.charAt(0).toUpperCase() + level.slice(1)}
      </span>
    );
  };

  const canManageCourses = user?.role === 'admin' || user?.role === 'teacher';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {user?.role === 'teacher' ? 'Mis Cursos' : 'Gestión de Cursos'}
          </h1>
          <p className="text-gray-600">
            {user?.role === 'teacher' 
              ? 'Crea y gestiona tus cursos' 
              : 'Administra todos los cursos de la plataforma'
            }
          </p>
        </div>
        {canManageCourses && (
          <Button onClick={() => navigate('/courses/new')} className="flex items-center">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Curso
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <BookOpen className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Cursos</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <Globe className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Publicados</p>
                <p className="text-2xl font-bold text-gray-900">{stats.published}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Edit3 className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Borradores</p>
                <p className="text-2xl font-bold text-gray-900">{stats.draft}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
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

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar cursos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-full md:w-48">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Todos los estados</option>
                <option value="publicado">Publicados</option>
                <option value="borrador">Borradores</option>
                <option value="archivado">Archivados</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

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
                ? 'Aún no has creado ningún curso. ¡Crea tu primer curso!'
                : 'No hay cursos que coincidan con tu búsqueda'
              }
            </p>
            {canManageCourses && (
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Crear Primer Curso
              </Button>
            )}
          </div>
        ) : (
          filteredCourses.map((course) => (
            <Card key={course.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-gray-900 mb-2">{course.title}</h3>
                    <p className="text-gray-600 text-sm line-clamp-2 mb-3">{course.description}</p>
                  </div>
                  {canManageCourses && (
                    <div className="relative">
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between mb-4">
                  {getStatusBadge(course.status)}
                  {getLevelBadge(course.level)}
                </div>

                <div className="space-y-2 text-sm text-gray-600 mb-4">
                  <div className="flex items-center">
                    <Users className="h-4 w-4 mr-2" />
                    <span>{course.studentsCount} estudiantes</span>
                  </div>
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-2" />
                    <span>{course.duration}</span>
                  </div>
                  <div className="flex items-center">
                    <Star className="h-4 w-4 mr-2" />
                    <span>por {course.instructor}</span>
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
                  {canManageCourses && (course.instructorId === user?.id || user?.role === 'admin') && (
                    <>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          setSelectedCourse(course);
                          setShowEditModal(true);
                        }}
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
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

      {/* Create Course Modal */}
      {showCreateModal && (
        <CourseModal
          title="Crear Curso"
          course={null}
          onSave={handleCreateCourse}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {/* Edit Course Modal */}
      {showEditModal && selectedCourse && (
        <CourseModal
          title="Editar Curso"
          course={selectedCourse}
          onSave={handleEditCourse}
          onClose={() => {
            setShowEditModal(false);
            setSelectedCourse(null);
          }}
        />
      )}
    </div>
  );
};

// Modal Component para crear/editar cursos
const CourseModal = ({ 
  title, 
  course, 
  onSave, 
  onClose 
}: { 
  title: string;
  course: DBCourse | null;
  onSave: (data: Partial<DBCourse>) => void;
  onClose: () => void;
}) => {
  const [formData, setFormData] = useState({
    title: course?.title || '',
    description: course?.description || '',
    category: course?.category || '',
    level: course?.level || 'principiante' as DBCourse['level'],
    duration: course?.duration || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            ×
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="title">Título del curso</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="ej. React Fundamentals"
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Descripción</Label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe de qué trata el curso..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-24"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="category">Categoría</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="ej. Programación"
                required
              />
            </div>

            <div>
              <Label htmlFor="duration">Duración</Label>
              <Input
                id="duration"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                placeholder="ej. 8 semanas"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="level">Nivel</Label>
            <select
              id="level"
              value={formData.level}
              onChange={(e) => setFormData({ ...formData, level: e.target.value as DBCourse['level'] })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="principiante">Principiante</option>
              <option value="intermedio">Intermedio</option>
              <option value="avanzado">Avanzado</option>
            </select>
          </div>

          <div className="flex space-x-3 pt-6 border-t">
            <Button type="submit" className="flex-1">
              {course ? 'Guardar cambios' : 'Crear curso'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CoursesPage;