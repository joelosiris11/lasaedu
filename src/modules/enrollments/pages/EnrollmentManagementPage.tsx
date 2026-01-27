import { useState, useEffect } from 'react';
import { useAuthStore } from '@app/store/authStore';
import { dataService } from '@shared/services/dataService';
import type { DBUser, DBCourse, DBEnrollment } from '@shared/services/dataService';
import { 
  Users, 
  UserPlus, 
  Search, 
  Mail,
  Clock,
  Award,
  Book,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';

interface EnrollmentData extends Omit<DBEnrollment, 'progress'> {
  user?: DBUser;
  course?: DBCourse;
  progress: number; // Simple number for display
}

interface EnrollmentStats {
  total: number;
  pending: number;
  active: number;
  completed: number;
  dropped: number;
}

export default function EnrollmentManagementPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [enrollments, setEnrollments] = useState<EnrollmentData[]>([]);
  const [users, setUsers] = useState<DBUser[]>([]);
  const [courses, setCourses] = useState<DBCourse[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [selectedEnrollments, setSelectedEnrollments] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load all data in parallel
      const [enrollmentsData, usersData, coursesData] = await Promise.all([
        dataService.enrollments.getAll(),
        dataService.users.getAll(),
        dataService.courses.getAll()
      ]);

      // Create lookup maps for faster access
      const usersMap = new Map(usersData.map(u => [u.id, u]));
      const coursesMap = new Map(coursesData.map(c => [c.id, c]));

      // Enrich enrollments with user and course data
      const enrichedEnrollments: EnrollmentData[] = enrollmentsData.map(enrollment => ({
        ...enrollment,
        user: usersMap.get(enrollment.userId),
        course: coursesMap.get(enrollment.courseId)
      }));

      setEnrollments(enrichedEnrollments);
      setUsers(usersData);
      setCourses(coursesData);
    } catch (error) {
      console.error('Error loading enrollment data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateEnrollmentStatus = async (enrollmentId: string, status: string) => {
    try {
      const enrollment = enrollments.find(e => e.id === enrollmentId);
      if (!enrollment) return;

      const updatedEnrollment = {
        ...enrollment,
        status,
        lastUpdated: Date.now()
      };

      await dataService.enrollments.update(enrollmentId, {
        ...updatedEnrollment,
        status: status as 'active' | 'completed' | 'paused' | 'cancelled'
      });
      
      // Update local state
      setEnrollments(prev =>
        prev.map(e => e.id === enrollmentId ? { ...e, status: status as 'active' | 'completed' | 'paused' | 'cancelled' } : e)
      );

      // TODO: Send notification to student
      console.log(`Enrollment ${enrollmentId} status changed to ${status}`);
    } catch (error) {
      console.error('Error updating enrollment:', error);
      alert('Error al actualizar la inscripción');
    }
  };

  const bulkUpdateStatus = async (status: string) => {
    if (selectedEnrollments.size === 0) return;

    try {
      const updates = Array.from(selectedEnrollments).map(id =>
        updateEnrollmentStatus(id, status)
      );
      
      await Promise.all(updates);
      setSelectedEnrollments(new Set());
      alert(`Se actualizaron ${selectedEnrollments.size} inscripciones`);
    } catch (error) {
      console.error('Error in bulk update:', error);
      alert('Error en la actualización masiva');
    }
  };

  const createManualEnrollment = async (userId: string, courseId: string) => {
    try {
      const newEnrollment = {
        id: `enrollment_${Date.now()}`,
        userId,
        courseId,
        status: 'active',
        enrolledAt: Date.now(),
        lastUpdated: Date.now(),
        progress: 0,
        source: 'manual'
      };

      await dataService.enrollments.create(newEnrollment);
      await loadData(); // Reload to get enriched data
      
      alert('Inscripción creada exitosamente');
    } catch (error) {
      console.error('Error creating manual enrollment:', error);
      alert('Error al crear la inscripción');
    }
  };

  const exportEnrollmentData = () => {
    const csvData = filteredEnrollments.map(enrollment => ({
      'ID': enrollment.id,
      'Estudiante': enrollment.user?.name || 'N/A',
      'Email': enrollment.user?.email || 'N/A',
      'Curso': enrollment.course?.title || 'N/A',
      'Estado': enrollment.status,
      'Progreso': `${enrollment.progress || 0}%`,
      'Fecha Inscripción': new Date(enrollment.enrolledAt).toLocaleDateString('es-ES'),
      'Última Actualización': new Date(enrollment.lastUpdated || enrollment.enrolledAt).toLocaleDateString('es-ES')
    }));

    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inscripciones_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Filter logic
  const filteredEnrollments = enrollments.filter(enrollment => {
    const matchesSearch = 
      enrollment.user?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      enrollment.user?.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      enrollment.course?.title.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || enrollment.status === statusFilter;
    const matchesCourse = courseFilter === 'all' || enrollment.courseId === courseFilter;

    return matchesSearch && matchesStatus && matchesCourse;
  });

  // Calculate stats
  const stats: EnrollmentStats = enrollments.reduce(
    (acc, enrollment) => {
      acc.total++;
      acc[enrollment.status as keyof Omit<EnrollmentStats, 'total'>]++;
      return acc;
    },
    { total: 0, pending: 0, active: 0, completed: 0, dropped: 0 }
  );

  const handleSelectAll = () => {
    if (selectedEnrollments.size === filteredEnrollments.length) {
      setSelectedEnrollments(new Set());
    } else {
      setSelectedEnrollments(new Set(filteredEnrollments.map(e => e.id)));
    }
  };

  const handleSelectEnrollment = (enrollmentId: string) => {
    const newSelected = new Set(selectedEnrollments);
    if (newSelected.has(enrollmentId)) {
      newSelected.delete(enrollmentId);
    } else {
      newSelected.add(enrollmentId);
    }
    setSelectedEnrollments(newSelected);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Gestión de Inscripciones</h1>
        <p className="text-gray-600">
          Administra las inscripciones de estudiantes a cursos
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Users className="w-8 h-8 text-blue-500 mr-3" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-gray-600">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Clock className="w-8 h-8 text-yellow-500 mr-3" />
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-sm text-gray-600">Pendientes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <CheckCircle className="w-8 h-8 text-green-500 mr-3" />
              <div>
                <p className="text-2xl font-bold">{stats.active}</p>
                <p className="text-sm text-gray-600">Activas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Award className="w-8 h-8 text-purple-500 mr-3" />
              <div>
                <p className="text-2xl font-bold">{stats.completed}</p>
                <p className="text-sm text-gray-600">Completadas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <XCircle className="w-8 h-8 text-red-500 mr-3" />
              <div>
                <p className="text-2xl font-bold">{stats.dropped}</p>
                <p className="text-sm text-gray-600">Abandonadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Buscar por estudiante, email o curso..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="all">Todos los estados</option>
            <option value="pending">Pendientes</option>
            <option value="active">Activas</option>
            <option value="completed">Completadas</option>
            <option value="dropped">Abandonadas</option>
          </select>

          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="all">Todos los cursos</option>
            {courses.map(course => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>

          <Button onClick={exportEnrollmentData} variant="outline">
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedEnrollments.size > 0 && (
        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-blue-800">
                {selectedEnrollments.size} inscripciones seleccionadas
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => bulkUpdateStatus('active')}
                  variant="outline"
                >
                  Activar
                </Button>
                <Button
                  size="sm"
                  onClick={() => bulkUpdateStatus('dropped')}
                  variant="outline"
                >
                  Suspender
                </Button>
                <Button
                  size="sm"
                  onClick={() => setSelectedEnrollments(new Set())}
                  variant="ghost"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Enrollments Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedEnrollments.size === filteredEnrollments.length && filteredEnrollments.length > 0}
                      onChange={handleSelectAll}
                      className="rounded"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Estudiante</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Curso</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Estado</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Progreso</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Inscripción</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-500">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredEnrollments.map((enrollment) => (
                  <tr key={enrollment.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedEnrollments.has(enrollment.id)}
                        onChange={() => handleSelectEnrollment(enrollment.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                          <span className="text-sm font-medium text-blue-600">
                            {enrollment.user?.name.charAt(0).toUpperCase() || '?'}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {enrollment.user?.name || 'Usuario desconocido'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {enrollment.user?.email || 'Email no disponible'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">
                        <div className="font-medium text-gray-900">
                          {enrollment.course?.title || 'Curso eliminado'}
                        </div>
                        <div className="text-gray-500">
                          {enrollment.course?.category || 'Categoría N/A'}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        enrollment.status === 'completed' ? 'bg-green-100 text-green-800' :
                        enrollment.status === 'active' ? 'bg-blue-100 text-blue-800' :
                        enrollment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        enrollment.status === 'dropped' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {enrollment.status === 'completed' && <CheckCircle className="w-3 h-3 mr-1" />}
                        {enrollment.status === 'active' && <Clock className="w-3 h-3 mr-1" />}
                        {enrollment.status === 'pending' && <AlertTriangle className="w-3 h-3 mr-1" />}
                        {enrollment.status === 'dropped' && <XCircle className="w-3 h-3 mr-1" />}
                        {enrollment.status === 'completed' ? 'Completada' :
                         enrollment.status === 'active' ? 'Activa' :
                         enrollment.status === 'pending' ? 'Pendiente' :
                         enrollment.status === 'dropped' ? 'Abandonada' :
                         enrollment.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${enrollment.progress || 0}%` }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-600">{enrollment.progress || 0}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(enrollment.enrolledAt).toLocaleDateString('es-ES')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <select
                          value={enrollment.status}
                          onChange={(e) => updateEnrollmentStatus(enrollment.id, e.target.value)}
                          className="text-xs border border-gray-300 rounded px-2 py-1"
                        >
                          <option value="pending">Pendiente</option>
                          <option value="active">Activa</option>
                          <option value="completed">Completada</option>
                          <option value="dropped">Abandonada</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredEnrollments.length === 0 && (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No se encontraron inscripciones
              </h3>
              <p className="text-gray-600">
                No hay inscripciones que coincidan con los filtros aplicados.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions Card */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Acciones Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <UserPlus className="w-8 h-8 text-blue-500 mx-auto mb-2" />
              <h4 className="font-medium mb-2">Inscripción Manual</h4>
              <p className="text-sm text-gray-600 mb-3">
                Inscribe manualmente a un estudiante en un curso
              </p>
              <Button size="sm" variant="outline">
                Inscribir Estudiante
              </Button>
            </div>

            <div className="text-center p-4 border rounded-lg">
              <Mail className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <h4 className="font-medium mb-2">Enviar Recordatorios</h4>
              <p className="text-sm text-gray-600 mb-3">
                Envía recordatorios a estudiantes inactivos
              </p>
              <Button size="sm" variant="outline">
                Enviar Notificaciones
              </Button>
            </div>

            <div className="text-center p-4 border rounded-lg">
              <Book className="w-8 h-8 text-purple-500 mx-auto mb-2" />
              <h4 className="font-medium mb-2">Generar Reportes</h4>
              <p className="text-sm text-gray-600 mb-3">
                Genera reportes de inscripciones y progreso
              </p>
              <Button size="sm" variant="outline">
                Ver Reportes
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}