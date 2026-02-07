import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@app/store/authStore';
import {
  Home,
  BookOpen,
  Users,
  Settings,
  HelpCircle,
  LogOut,
  Menu,
  X,
  FileText,
  BarChart3,
  MessageCircle,
  GraduationCap,
  Award,
  Trophy,
  ClipboardList,
  Compass,
  TrendingUp,
  MessageSquare,
  UserCog,
  Bell,
  UserPlus
} from 'lucide-react';
import { Button } from '../ui/Button';
import type { UserRole } from '@shared/types';

interface SidebarItem {
  icon: any;
  label: string;
  path: string;
  roles?: UserRole[];
}

const sidebarItems: SidebarItem[] = [
  // Todos los roles
  { icon: Home, label: 'Dashboard', path: '/dashboard' },

  // Admin: gestión completa
  { icon: UserCog, label: 'Gestión Usuarios', path: '/user-management', roles: ['admin'] },
  { icon: Users, label: 'Usuarios', path: '/users', roles: ['admin'] },
  { icon: UserPlus, label: 'Inscripciones', path: '/enrollments', roles: ['admin', 'teacher'] },
  { icon: Bell, label: 'Notificaciones', path: '/notifications', roles: ['admin', 'teacher'] },

  // Cursos y catálogo
  { icon: Compass, label: 'Catálogo', path: '/catalog', roles: ['admin', 'teacher', 'student'] },
  { icon: BookOpen, label: 'Cursos', path: '/courses', roles: ['admin', 'teacher', 'student'] },

  // Solo estudiantes
  { icon: TrendingUp, label: 'Mi Progreso', path: '/progress', roles: ['student'] },

  // Evaluaciones y calificaciones
  { icon: FileText, label: 'Evaluaciones', path: '/evaluations', roles: ['admin', 'teacher', 'student'] },
  { icon: ClipboardList, label: 'Calificaciones', path: '/grades', roles: ['admin', 'teacher', 'student'] },

  // Certificados y gamificación
  { icon: Award, label: 'Certificados', path: '/certificates', roles: ['admin', 'teacher', 'student'] },
  { icon: Trophy, label: 'Gamificación', path: '/gamification', roles: ['admin', 'teacher', 'student'] },

  // Reportes (solo admin y teacher)
  { icon: BarChart3, label: 'Reportes', path: '/reports', roles: ['admin', 'teacher'] },

  // Comunicación
  { icon: MessageCircle, label: 'Comunicación', path: '/communication', roles: ['admin', 'teacher', 'student'] },
  { icon: MessageSquare, label: 'Foros', path: '/forums', roles: ['admin', 'teacher', 'student'] },

  // Soporte
  { icon: HelpCircle, label: 'Soporte', path: '/support', roles: ['admin', 'support', 'student', 'teacher'] },

  // Configuración (todos)
  { icon: Settings, label: 'Configuración', path: '/settings' },
];

export const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const filteredItems = sidebarItems.filter(item => 
    !item.roles || item.roles.includes(user?.role as UserRole)
  );

  const toggleSidebar = () => setIsOpen(!isOpen);

  return (
    <>
      {/* Mobile menu button */}
      <Button
        onClick={toggleSidebar}
        className="fixed top-4 left-4 z-50 md:hidden"
        size="sm"
        variant="outline"
      >
        {isOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </Button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-40 w-64 h-screen transition-transform
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
        bg-white border-r border-gray-200 shadow-lg
      `}>
        <div className="h-full px-3 py-4 overflow-y-auto">
          {/* Logo/Header */}
          <div className="flex items-center mb-5 px-2">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center">
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
              <span className="ml-2 text-xl font-bold text-gray-800">LasaEdu</span>
            </div>
          </div>

          {/* User Info */}
          <div className="mb-5 px-2">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-sm font-medium text-gray-800 truncate">
                {user?.name}
              </div>
              <div className="text-xs text-gray-500 capitalize">
                {user?.role}
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="space-y-1">
            {filteredItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname.startsWith(item.path);
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsOpen(false)}
                  className={`
                    flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors
                    ${isActive 
                      ? 'bg-blue-100 text-blue-800 border-r-2 border-blue-600' 
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }
                  `}
                >
                  <Icon className="h-5 w-5 mr-3" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Logout Button */}
          <div className="absolute bottom-4 left-3 right-3">
            <Button
              onClick={handleLogout}
              variant="outline"
              className="w-full justify-start text-gray-600 hover:text-gray-900"
            >
              <LogOut className="h-4 w-4 mr-3" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
};