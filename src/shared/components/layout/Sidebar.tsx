import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '@app/store/authStore';
import {
  Home,
  BookOpen,
  Settings,
  HelpCircle,
  Menu,
  X,
  MessageCircle,
  Award,
  ClipboardList,
  MessageSquare,
  UserCog,
  UserPlus,
  Briefcase,
  ChevronsLeft,
  ChevronsRight,
  Layers,
  History,
  Activity,
  Sparkles,
} from 'lucide-react';
import { Button } from '../ui/Button';
import type { UserRole } from '@shared/types';

interface SidebarItem {
  icon: any;
  label: string;
  path: string;
  roles?: UserRole[];
}

interface SidebarSection {
  label: string;
  items: SidebarItem[];
  roles?: UserRole[]; // hide entire section for certain roles
}

const sidebarSections: SidebarSection[] = [
  {
    label: '',
    items: [
      { icon: Home, label: 'Dashboard', path: '/dashboard' },
    ],
  },
  // Student: "Aprendizaje" section
  {
    label: 'Aprendizaje',
    roles: ['student'],
    items: [
      { icon: BookOpen, label: 'Mis Cursos', path: '/my-sections', roles: ['student'] },
      { icon: ClipboardList, label: 'Calificaciones', path: '/grades', roles: ['student'] },
      { icon: Award, label: 'Certificados', path: '/certificates', roles: ['student'] },
    ],
  },
  // Teacher: "Docencia" section with their courses, grades, enrollments, certificates
  {
    label: 'Docencia',
    roles: ['teacher'],
    items: [
      { icon: BookOpen, label: 'Cursos', path: '/courses', roles: ['teacher'] },
      { icon: Layers, label: 'Secciones', path: '/my-sections', roles: ['teacher'] },
      { icon: UserPlus, label: 'Inscripciones', path: '/enrollments', roles: ['teacher'] },
      { icon: ClipboardList, label: 'Calificaciones', path: '/grades', roles: ['teacher'] },
      { icon: Award, label: 'Certificados', path: '/certificates', roles: ['teacher'] },
      { icon: History, label: 'Actividad Prof.', path: '/audit-logs', roles: ['teacher'] },
      { icon: Activity, label: 'Actividad Estu.', path: '/student-activity', roles: ['teacher'] },
    ],
  },
  // Admin-only: AI content assistant
  {
    label: 'Asistente',
    roles: ['admin'],
    items: [
      { icon: Sparkles, label: 'Asistente IA', path: '/ai-assistant', roles: ['admin'] },
    ],
  },
  // Admin: "Gestión" section - no duplicates, no reportes
  {
    label: 'Gestión',
    roles: ['admin', 'supervisor'],
    items: [
      { icon: UserCog, label: 'Gestión Usuarios', path: '/users', roles: ['admin'] },
      { icon: Briefcase, label: 'Organigrama', path: '/organization', roles: ['admin', 'supervisor'] },
      { icon: UserPlus, label: 'Inscripciones', path: '/enrollments', roles: ['admin', 'supervisor'] },
      { icon: BookOpen, label: 'Cursos', path: '/courses', roles: ['admin', 'supervisor'] },
      { icon: Layers, label: 'Secciones', path: '/my-sections', roles: ['admin', 'supervisor'] },
      { icon: ClipboardList, label: 'Calificaciones', path: '/grades', roles: ['admin', 'supervisor'] },
      { icon: Award, label: 'Certificados', path: '/certificates', roles: ['admin', 'supervisor'] },
      { icon: History, label: 'Actividad Prof.', path: '/audit-logs', roles: ['admin', 'supervisor'] },
      { icon: Activity, label: 'Actividad Estu.', path: '/student-activity', roles: ['admin', 'supervisor'] },
    ],
  },
  {
    label: 'Comunicación',
    roles: ['admin', 'supervisor', 'teacher', 'student'],
    items: [
      { icon: MessageCircle, label: 'Mensajes', path: '/communication', roles: ['admin', 'supervisor', 'teacher', 'student'] },
      { icon: MessageSquare, label: 'Foros', path: '/forums', roles: ['admin', 'supervisor', 'teacher', 'student'] },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { icon: HelpCircle, label: 'Soporte', path: '/support', roles: ['admin', 'supervisor', 'support', 'student', 'teacher'] },
      { icon: Settings, label: 'Configuración', path: '/settings' },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar = ({ collapsed, onToggleCollapse }: SidebarProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuthStore();
  const location = useLocation();

  const userRole = user?.role as UserRole;

  // Filter sections: check section-level roles, then item-level roles
  const visibleSections = sidebarSections
    .filter((section) => !section.roles || section.roles.includes(userRole))
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => !item.roles || item.roles.includes(userRole)
      ),
    }))
    .filter((section) => section.items.length > 0);

  const toggleSidebar = () => setIsOpen(!isOpen);

  const roleLabels: Record<string, string> = {
    admin: 'Administrador',
    supervisor: 'Supervisor',
    teacher: 'Profesor',
    student: 'Estudiante',
    support: 'Soporte',
  };

  return (
    <>
      {/* Mobile menu button */}
      <Button
        onClick={toggleSidebar}
        className="fixed top-[11px] left-3 z-50 md:hidden"
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
      <aside
        className={`
        fixed top-0 left-0 z-40 h-screen transition-all duration-300
        ${collapsed ? 'w-16' : 'w-52'}
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
        bg-white border-r border-gray-200 shadow-lg
      `}
      >
        <div className="h-full flex flex-col overflow-hidden pt-14 md:pt-0">
          {/* Fixed top: logo + collapse button */}
          <div className="flex-shrink-0">
            {collapsed ? (
              <>
                <div className="hidden md:flex justify-center px-1 pt-3 mb-2">
                  <button
                    onClick={onToggleCollapse}
                    className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100"
                    title="Expandir sidebar"
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex justify-center px-1 pb-4">
                  <img
                    src="/LaAuroraLogo.png"
                    alt="lasa EDU"
                    className="h-10 w-auto transition-all duration-300"
                  />
                </div>
              </>
            ) : (
              <div className="relative">
                <div className="flex justify-center pt-1 pb-1 px-1">
                  <img
                    src="/LaAuroraLogo.png"
                    alt="lasa EDU"
                    className="h-32 md:h-36 w-auto transition-all duration-300"
                  />
                </div>
                <button
                  onClick={onToggleCollapse}
                  className="hidden md:flex absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100"
                  title="Colapsar sidebar"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Scrollable navigation */}
          <nav
            className={`flex-1 overflow-y-auto pb-4 ${
              collapsed ? 'px-1' : 'px-3'
            }`}
          >
            {visibleSections.map((section, sectionIndex) => (
              <div key={sectionIndex} className="mb-1">
                {/* Section label */}
                {section.label && (
                  collapsed ? (
                    <div className="my-2 mx-2 border-t border-gray-200" />
                  ) : (
                    <div className="px-3 pt-4 pb-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                        {section.label}
                      </span>
                    </div>
                  )
                )}

                {/* Section items */}
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname.startsWith(item.path);

                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setIsOpen(false)}
                        title={collapsed ? item.label : undefined}
                        className={`
                          flex items-center ${
                            collapsed ? 'justify-center px-2' : 'px-3'
                          } py-2.5 text-sm font-medium rounded-lg transition-all duration-150
                          ${
                            isActive
                              ? 'bg-red-50 text-red-700 shadow-sm border-l-[3px] border-red-600'
                              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-[3px] border-transparent'
                          }
                        `}
                      >
                        <Icon
                          className={`h-5 w-5 flex-shrink-0 ${
                            collapsed ? '' : 'mr-3'
                          } ${isActive ? 'text-red-600' : ''}`}
                        />
                        {!collapsed && item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* User role badge at bottom */}
          {!collapsed && (
            <div className="flex-shrink-0 px-3 py-3 border-t border-gray-100">
              <div className="flex items-center px-3 py-2 rounded-lg bg-gray-50">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white text-xs font-bold">
                  {user?.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div className="ml-3 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user?.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {roleLabels[userRole] || userRole}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
