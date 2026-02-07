import { useState, useEffect } from 'react';
import { useAuthStore } from '@app/store/authStore';
import { userService, courseService, legacyEnrollmentService } from '@shared/services/dataService';
import type { DBUser, DBCourse, DBEnrollment } from '@shared/services/dataService';
import {
  Users,
  UserPlus,
  Edit,
  Trash2,
  Search,
  Shield,
  BookOpen,
  Award,
  CheckCircle,
  Download
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';

interface UserWithStats extends DBUser {
  enrollmentCount?: number;
  completedCourses?: number;
  averageScore?: number;
  lastActivity?: number;
}

interface UserFormData {
  name: string;
  email: string;
  role: 'student' | 'teacher' | 'admin' | 'support';
  password: string;
  phone: string;
  bio: string;
  avatar: string;
}

export default function UserManagementPage() {
  const { user: _user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserWithStats[]>([]);
  const [_courses, setCourses] = useState<DBCourse[]>([]);
  const [_enrollments, setEnrollments] = useState<DBEnrollment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, _setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'email' | 'role' | 'created' | 'lastActivity'>('created');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [_showCreateModal, setShowCreateModal] = useState(false);
  const [_showEditModal, setShowEditModal] = useState(false);
  const [, setEditingUser] = useState<UserWithStats | null>(null);
  const [, setFormData] = useState<UserFormData>({
    name: '',
    email: '',
    role: 'student',
    password: '',
    phone: '',
    bio: '',
    avatar: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersData, coursesData, enrollmentsData] = await Promise.all([
        userService.getAll(),
        courseService.getAll(),
        legacyEnrollmentService.getAll() || []
      ]);

      // Enrich users with statistics
      const enrichedUsers: UserWithStats[] = usersData.map(user => {
        const userEnrollments = enrollmentsData.filter(e => e.userId === user.id);
        const completedEnrollments = userEnrollments.filter(e => e.status === 'completed');
        
        return {
          ...user,
          enrollmentCount: userEnrollments.length,
          completedCourses: completedEnrollments.length,
          averageScore: completedEnrollments.length > 0 
            ? completedEnrollments.reduce((sum, e) => sum + (e.grade || 0), 0) / completedEnrollments.length
            : 0,
          lastActivity: Math.max(...userEnrollments.map(e => e.lastAccessedAt ? new Date(e.lastAccessedAt).getTime() : new Date(e.enrolledAt).getTime()), user.createdAt || Date.now())
        };
      });

      setUsers(enrichedUsers);
      setCourses(coursesData as any[]);
      setEnrollments(enrollmentsData as any[]);
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este usuario?')) {
      return;
    }

    try {
      await userService.delete(userId);
      await loadData();
      alert('Usuario eliminado exitosamente');
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Error al eliminar el usuario');
    }
  };

  const handleBulkAction = async (action: 'activate' | 'deactivate' | 'delete' | 'export') => {
    const selectedUserIds = Array.from(selectedUsers);
    
    if (selectedUserIds.length === 0) {
      alert('Por favor selecciona al menos un usuario');
      return;
    }

    try {
      switch (action) {
        case 'activate':
          await Promise.all(
            selectedUserIds.map(userId => {
              return userService.update(userId, { updatedAt: Date.now() });
            })
          );
          alert(`${selectedUserIds.length} usuarios activados`);
          break;
          
        case 'deactivate':
          await Promise.all(
            selectedUserIds.map(userId => {
              return userService.update(userId, { updatedAt: Date.now() });
            })
          );
          alert(`${selectedUserIds.length} usuarios desactivados`);
          break;
          
        case 'delete':
          if (!confirm(`¿Estás seguro de que quieres eliminar ${selectedUserIds.length} usuarios?`)) {
            return;
          }
          await Promise.all(selectedUserIds.map(userId => userService.delete(userId)));
          alert(`${selectedUserIds.length} usuarios eliminados`);
          break;
          
        case 'export':
          exportSelectedUsers(selectedUserIds);
          break;
      }
      
      if (action !== 'export') {
        await loadData();
      }
      
      setSelectedUsers(new Set());
    } catch (error) {
      console.error(`Error in bulk ${action}:`, error);
      alert(`Error en la operación masiva`);
    }
  };

  const exportSelectedUsers = (userIds: string[]) => {
    const selectedUserData = users.filter(u => userIds.includes(u.id));
    const csvData = selectedUserData.map(user => ({
      'ID': user.id,
      'Nombre': user.name,
      'Email': user.email,
      'Rol': user.role,
      'Teléfono': user.profile?.phone || '',
      'Estado': 'Activo', // Default since DBUser doesn't have isActive
      'Cursos Inscritos': user.enrollmentCount || 0,
      'Cursos Completados': user.completedCourses || 0,
      'Promedio': user.averageScore?.toFixed(1) || '0',
      'Fecha Creación': new Date(user.createdAt || Date.now()).toLocaleDateString('es-ES')
    }));

    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).map(v => `"${v}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `usuarios_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const openEditModal = (user: UserWithStats) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      password: '',
      phone: user.profile?.phone || '',
      bio: user.profile?.bio || '',
      avatar: user.profile?.avatar || ''
    });
    setShowEditModal(true);
  };

  // Filter and sort users
  const filteredUsers = users
    .filter(user => {
      const matchesSearch = 
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      const matchesStatus = statusFilter === 'all'; // Simplified since no isActive property
      
      return matchesSearch && matchesRole && matchesStatus;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'email':
          return a.email.localeCompare(b.email);
        case 'role':
          return a.role.localeCompare(b.role);
        case 'created':
          return (b.createdAt || 0) - (a.createdAt || 0);
        case 'lastActivity':
          return (b.lastActivity || 0) - (a.lastActivity || 0);
        default:
          return 0;
      }
    });

  // Calculate statistics
  const stats = {
    total: users.length,
    active: users.length, // All users considered active since no isActive property
    students: users.filter(u => u.role === 'student').length,
    teachers: users.filter(u => u.role === 'teacher').length,
    admins: users.filter(u => u.role === 'admin').length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Cargando usuarios...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Usuarios</h1>
          <p className="text-gray-600 mt-1">
            Administra usuarios, roles y permisos del sistema
          </p>
        </div>
        <Button 
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-2"
        >
          <UserPlus className="w-4 h-4" />
          <span>Nuevo Usuario</span>
        </Button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <Users className="w-4 h-4 text-blue-500 mr-2" />
              <span className="text-2xl font-bold">{stats.total}</span>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
              <span className="text-2xl font-bold">{stats.active}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Estudiantes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <BookOpen className="w-4 h-4 text-blue-500 mr-2" />
              <span className="text-2xl font-bold">{stats.students}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Profesores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <Award className="w-4 h-4 text-orange-500 mr-2" />
              <span className="text-2xl font-bold">{stats.teachers}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Admins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <Shield className="w-4 h-4 text-red-500 mr-2" />
              <span className="text-2xl font-bold">{stats.admins}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar usuarios..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Filters */}
            <div className="flex gap-4">
              <select
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="all">Todos los roles</option>
                <option value="student">Estudiantes</option>
                <option value="teacher">Profesores</option>
                <option value="admin">Administradores</option>
                <option value="support">Soporte</option>
              </select>

              <select
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
              >
                <option value="created">Fecha de creación</option>
                <option value="name">Nombre</option>
                <option value="email">Email</option>
                <option value="role">Rol</option>
                <option value="lastActivity">Última actividad</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedUsers.size > 0 && (
        <Card className="mb-6 bg-blue-50 border-blue-200">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-blue-700">
                {selectedUsers.size} usuarios seleccionados
              </span>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handleBulkAction('export')}
                >
                  <Download className="w-4 h-4 mr-1" />
                  Exportar
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handleBulkAction('delete')}
                  className="text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Eliminar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedUsers(new Set(filteredUsers.map(u => u.id)));
                        } else {
                          setSelectedUsers(new Set());
                        }
                      }}
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usuario
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rol
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cursos
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rendimiento
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedUsers.has(user.id)}
                        onChange={(e) => {
                          const newSelected = new Set(selectedUsers);
                          if (e.target.checked) {
                            newSelected.add(user.id);
                          } else {
                            newSelected.delete(user.id);
                          }
                          setSelectedUsers(newSelected);
                        }}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center mr-3">
                          <span className="text-sm font-medium text-gray-700">
                            {user.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{user.name}</div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                          {user.profile?.phone && (
                            <div className="text-xs text-gray-400">{user.profile.phone}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.role === 'admin' ? 'bg-red-100 text-red-800' :
                        user.role === 'teacher' ? 'bg-orange-100 text-orange-800' :
                        user.role === 'student' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {user.role === 'admin' && <Shield className="w-3 h-3 mr-1" />}
                        {user.role === 'teacher' && <Award className="w-3 h-3 mr-1" />}
                        {user.role === 'student' && <BookOpen className="w-3 h-3 mr-1" />}
                        {user.role === 'admin' ? 'Admin' :
                         user.role === 'teacher' ? 'Profesor' :
                         user.role === 'student' ? 'Estudiante' :
                         user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800`}>
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Activo
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">
                        <div className="text-gray-900">{user.enrollmentCount || 0} inscritos</div>
                        <div className="text-gray-500">{user.completedCourses || 0} completados</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">
                        <div className="text-gray-900">{user.averageScore?.toFixed(1) || '0'}%</div>
                        <div className="text-xs text-gray-500">
                          {user.lastActivity && new Date(user.lastActivity).toLocaleDateString('es-ES')}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => openEditModal(user)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create User Modal - Add your modal JSX here */}
      {/* Edit User Modal - Add your modal JSX here */}
    </div>
  );
}