import { useState, useEffect } from 'react';
import { useAuthStore } from '@app/store/authStore';
import { userService } from '@shared/services/dataService';
import type { DBUser } from '@shared/services/firebaseDataService';
import {
  adminCreateUser,
  adminResetPassword,
} from '@modules/users/services/userAdminService';
import {
  Users,
  Search,
  Edit3,
  Trash2,
  UserPlus,
  Shield,
  CheckCircle,
  XCircle,
  Loader2,
  GraduationCap,
  Headphones,
  BookOpen,
  KeyRound,
  Activity,
  Eye,
} from 'lucide-react';
import { Card, CardContent } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { Label } from '@shared/components/ui/Label';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<DBUser['role'], { label: string; color: string; icon: typeof Shield }> = {
  admin: { label: 'Administrador', color: 'bg-red-100 text-red-800', icon: Shield },
  supervisor: { label: 'Supervisor', color: 'bg-orange-100 text-orange-800', icon: Eye },
  teacher: { label: 'Profesor', color: 'bg-blue-100 text-blue-800', icon: BookOpen },
  student: { label: 'Estudiante', color: 'bg-green-100 text-green-800', icon: GraduationCap },
  support: { label: 'Soporte', color: 'bg-purple-100 text-purple-800', icon: Headphones },
};

function isRecentlyActive(lastActive: number | undefined): boolean {
  if (!lastActive) return false;
  return (Date.now() - lastActive) < 7 * 24 * 60 * 60 * 1000;
}

function formatDate(timestamp: number | undefined): string {
  if (!timestamp) return 'Nunca';
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} días`;
  return date.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Generate credential from birthDate string (YYYY-MM-DD -> DDMMYYYY) */
function birthDateToCredential(birthDate: string): string {
  if (!birthDate) return '';
  const [y, m, d] = birthDate.split('-');
  return `${d}${m}${y}`;
}

function displayName(user: DBUser): string {
  if (user.firstName || user.lastName) {
    return `${user.firstName || ''} ${user.lastName || ''}`.trim();
  }
  return user.name;
}

// ─── KPI Card (same style as CoursesPage) ────────────────────────────────────

function KpiCard({
  label,
  value,
  icon: Icon,
  tooltip,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  tooltip?: string;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow" title={tooltip}>
      <CardContent className="px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-gray-500 truncate">{label}</p>
            <p className="text-xl font-bold text-gray-900 leading-tight">{value}</p>
          </div>
          <div className="p-1.5 rounded-md bg-red-50 shrink-0">
            <Icon className="h-4 w-4 text-red-600" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

const UsersPage = () => {
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<DBUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<DBUser['role'] | 'all'>('all');

  // Modals
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<DBUser | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetTarget, setResetTarget] = useState<DBUser | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    try {
      setUsers(await userService.getAll());
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  // ── Filter ──
  const filteredUsers = users.filter(user => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      displayName(user).toLowerCase().includes(q) ||
      user.email.toLowerCase().includes(q) ||
      (user.profile?.phone || '').includes(q);
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // ── Stats ──
  const stats = {
    total: users.length,
    students: users.filter(u => u.role === 'student').length,
    teachers: users.filter(u => u.role === 'teacher').length,
    admins: users.filter(u => u.role === 'admin').length,
    active: users.filter(u => isRecentlyActive(u.lastActive)).length,
  };

  // ── Actions ──
  const handleDeleteUser = async (userId: string) => {
    if (userId === currentUser?.id) {
      alert('No puedes eliminar tu propio usuario');
      return;
    }
    if (!confirm('¿Estás seguro de que quieres eliminar este usuario?')) return;
    try {
      await userService.delete(userId);
      setUsers(prev => prev.filter(u => u.id !== userId));
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Error al eliminar usuario');
    }
  };

  const openCreate = () => { setSelectedUser(null); setShowUserModal(true); };
  const openEdit = (u: DBUser) => { setSelectedUser(u); setShowUserModal(true); };
  const openReset = (u: DBUser) => { setResetTarget(u); setShowResetModal(true); };

  const isAdmin = currentUser?.role === 'admin';
  const isSupervisor = currentUser?.role === 'supervisor';

  // ── Guard ──
  if (!isAdmin && !isSupervisor) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Shield className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">Acceso Restringido</h3>
          <p className="text-gray-500">Solo los administradores pueden gestionar usuarios</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      {isAdmin && (
        <div className="flex justify-end">
          <Button onClick={openCreate} className="flex items-center">
            <UserPlus className="h-4 w-4 mr-2" />
            Nuevo Usuario
          </Button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard label="Total usuarios" value={stats.total} icon={Users} />
        <KpiCard label="Estudiantes" value={stats.students} icon={GraduationCap} />
        <KpiCard label="Profesores" value={stats.teachers} icon={BookOpen} />
        <KpiCard label="Administradores" value={stats.admins} icon={Shield} />
        <KpiCard label="Activos" value={stats.active} icon={Activity} tooltip="Usuarios con actividad en los últimos 7 días" />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nombre, email o teléfono..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value as DBUser['role'] | 'all')}
              className="w-full md:w-44 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
            >
              <option value="all">Todos los roles</option>
              <option value="admin">Administradores</option>
              <option value="supervisor">Supervisores</option>
              <option value="teacher">Profesores</option>
              <option value="student">Estudiantes</option>
              <option value="support">Soporte</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-red-600 mx-auto mb-2" />
              <div className="text-gray-500 text-sm">Cargando usuarios...</div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No se encontraron usuarios</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">Usuario</th>
                    <th className="px-5 py-3 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">Rol</th>
                    <th className="px-5 py-3 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Teléfono</th>
                    <th className="px-5 py-3 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Estado</th>
                    <th className="px-5 py-3 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Última actividad</th>
                    {isAdmin && <th className="px-5 py-3 text-right text-[11px] font-medium text-gray-500 uppercase tracking-wider">Acciones</th>}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {filteredUsers.map(user => {
                    const role = ROLE_CONFIG[user.role];
                    const RoleIcon = role.icon;
                    const active = isRecentlyActive(user.lastActive);

                    return (
                      <tr key={user.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shrink-0">
                              <span className="text-white text-sm font-medium">
                                {displayName(user).charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-gray-900 truncate">{displayName(user)}</div>
                              <div className="text-xs text-gray-500 truncate">{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${role.color}`}>
                            <RoleIcon className="h-3 w-3" />
                            {role.label}
                          </span>
                        </td>
                        <td className="px-5 py-3 hidden md:table-cell text-sm text-gray-600">
                          {user.profile?.phone || '\u2014'}
                        </td>
                        <td className="px-5 py-3 hidden lg:table-cell">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                            active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {active ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                            {active ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="px-5 py-3 hidden lg:table-cell text-sm text-gray-500">
                          {formatDate(user.lastActive)}
                        </td>
                        {isAdmin && (
                          <td className="px-5 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <Button size="sm" variant="ghost" onClick={() => openEdit(user)} title="Editar">
                                <Edit3 className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => openReset(user)} title="Resetear credenciales">
                                <KeyRound className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteUser(user.id)}
                                className="text-red-600 hover:text-red-700"
                                title="Eliminar"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Modal */}
      {showUserModal && (
        <UserFormModal
          user={selectedUser}
          onSaved={(u) => {
            if (selectedUser) {
              setUsers(prev => prev.map(x => x.id === u.id ? u : x));
            } else {
              setUsers(prev => [...prev, u]);
            }
            setShowUserModal(false);
            setSelectedUser(null);
          }}
          onClose={() => { setShowUserModal(false); setSelectedUser(null); }}
        />
      )}

      {/* Reset Credentials Modal */}
      {showResetModal && resetTarget && (
        <ResetCredentialModal
          user={resetTarget}
          onDone={() => { setShowResetModal(false); setResetTarget(null); }}
          onClose={() => { setShowResetModal(false); setResetTarget(null); }}
        />
      )}
    </div>
  );
};

// ─── User Form Modal ─────────────────────────────────────────────────────────

function UserFormModal({
  user,
  onSaved,
  onClose,
}: {
  user: DBUser | null;
  onSaved: (user: DBUser) => void;
  onClose: () => void;
}) {
  const isEdit = !!user;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    firstName: user?.firstName || user?.name?.split(' ')[0] || '',
    lastName: user?.lastName || user?.name?.split(' ').slice(1).join(' ') || '',
    email: user?.email || '',
    role: user?.role || ('student' as DBUser['role']),
    phone: user?.profile?.phone || '',
    address: user?.profile?.address || '',
    birthDate: user?.profile?.birthDate || '',
  });

  const generatedCred = birthDateToCredential(form.birthDate);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      if (isEdit) {
        const updated = await userService.update(user.id, {
          firstName: form.firstName,
          lastName: form.lastName,
          name: `${form.firstName} ${form.lastName}`.trim(),
          role: form.role,
          profile: {
            ...user.profile,
            phone: form.phone,
            address: form.address,
            birthDate: form.birthDate,
          },
        });
        if (updated) onSaved(updated);
      } else {
        if (!form.birthDate) {
          setError('La fecha de nacimiento es requerida (se usa como clave inicial)');
          setSaving(false);
          return;
        }
        if (generatedCred.length !== 8) {
          setError('Fecha de nacimiento inválida');
          setSaving(false);
          return;
        }

        const created = await adminCreateUser({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          role: form.role,
          phone: form.phone,
          address: form.address,
          birthDate: form.birthDate,
          password: generatedCred,
        });
        onSaved(created);
      }
    } catch (err: any) {
      console.error('Error saving user:', err);
      const msg = err?.message || '';
      if (msg.includes('email-already-in-use') || msg.includes('EMAIL_EXISTS')) {
        setError('Ya existe un usuario con este correo');
      } else {
        setError(msg || 'Error al guardar usuario');
      }
    } finally {
      setSaving(false);
    }
  };

  const set = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-xl">
          <h2 className="text-lg font-semibold">{isEdit ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Nombre / Apellido */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">Nombre</Label>
              <Input id="firstName" value={form.firstName} onChange={e => set('firstName', e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="lastName">Apellido</Label>
              <Input id="lastName" value={form.lastName} onChange={e => set('lastName', e.target.value)} required />
            </div>
          </div>

          {/* Email */}
          <div>
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              required
              disabled={isEdit}
              className={isEdit ? 'bg-gray-50 text-gray-500' : ''}
            />
          </div>

          {/* Teléfono */}
          <div>
            <Label htmlFor="phone">Teléfono</Label>
            <Input id="phone" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="809-000-0000" />
          </div>

          {/* Dirección */}
          <div>
            <Label htmlFor="address">Dirección</Label>
            <Input id="address" value={form.address} onChange={e => set('address', e.target.value)} placeholder="Calle, sector, ciudad" />
          </div>

          {/* Fecha de nacimiento */}
          <div>
            <Label htmlFor="birthDate">
              Fecha de nacimiento
              {!isEdit && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id="birthDate"
              type="date"
              value={form.birthDate}
              onChange={e => set('birthDate', e.target.value)}
              required={!isEdit}
            />
            {!isEdit && form.birthDate && (
              <p className="text-xs text-gray-500 mt-1">
                Clave inicial: <span className="font-mono font-medium text-gray-700">{generatedCred}</span>
                <span className="text-gray-400 ml-1">(DDMMAAAA)</span>
              </p>
            )}
          </div>

          {/* Rol */}
          <div>
            <Label htmlFor="role">Rol</Label>
            <select
              id="role"
              value={form.role}
              onChange={e => set('role', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
              required
            >
              <option value="student">Estudiante</option>
              <option value="teacher">Profesor</option>
              <option value="support">Soporte</option>
              <option value="supervisor">Supervisor</option>
              <option value="admin">Administrador</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {isEdit ? 'Guardar cambios' : 'Crear usuario'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Reset Credential Modal ──────────────────────────────────────────────────

function ResetCredentialModal({
  user,
  onDone,
  onClose,
}: {
  user: DBUser;
  onDone: () => void;
  onClose: () => void;
}) {
  const defaultCred = user.profile?.birthDate
    ? birthDateToCredential(user.profile.birthDate)
    : '';
  const [newCred, setNewCred] = useState(defaultCred);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newCred.length < 6) {
      setError('Debe tener al menos 6 caracteres');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const result = await adminResetPassword(user, newCred);
      if (result.method === 'email') {
        alert(`Se envió un correo de recuperación a ${user.email}`);
      } else {
        alert('Credenciales reseteadas. El usuario deberá cambiarlas al iniciar sesión.');
      }
      onDone();
    } catch (err: any) {
      console.error('Error resetting:', err);
      setError(err.message || 'Error al resetear');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-sm w-full" onClick={e => e.stopPropagation()}>
        <div className="border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Resetear Acceso</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            Resetear acceso de <span className="font-medium text-gray-900">{displayName(user)}</span>
          </p>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
          )}

          <div>
            <Label htmlFor="newCred">Nueva clave temporal</Label>
            <Input
              id="newCred"
              type="text"
              value={newCred}
              onChange={e => setNewCred(e.target.value)}
              required
              minLength={6}
            />
            {defaultCred && (
              <button
                type="button"
                onClick={() => setNewCred(defaultCred)}
                className="text-xs text-red-600 hover:underline mt-1"
              >
                Usar fecha de nacimiento ({defaultCred})
              </button>
            )}
          </div>

          <p className="text-xs text-gray-500">
            El usuario deberá actualizar su clave la próxima vez que inicie sesión.
          </p>

          <div className="flex gap-3">
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Resetear
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default UsersPage;
