import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '@app/store/authStore';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, ChevronDown, LogOut } from 'lucide-react';
import { Button } from '../ui/Button';
import { NotificationCenter } from './NotificationCenter';

const pageMeta: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Resumen general de tu actividad' },
  '/user-management': { title: 'Gestión de Usuarios', subtitle: 'Administra roles y permisos' },
  '/users': { title: 'Usuarios', subtitle: 'Listado de usuarios del sistema' },
  '/enrollments': { title: 'Inscripciones', subtitle: 'Gestiona las inscripciones a cursos' },
  '/my-sections': { title: 'Mis Secciones', subtitle: 'Tus secciones inscritas y activas' },
  '/sections': { title: 'Sección', subtitle: 'Detalle de la sección' },
  '/courses': { title: 'Cursos', subtitle: 'Gestiona y accede a tus cursos' },
  '/grades': { title: 'Calificaciones', subtitle: 'Consulta y gestiona calificaciones' },
  '/certificates': { title: 'Certificados', subtitle: 'Certificados obtenidos y disponibles' },
  '/communication': { title: 'Comunicación', subtitle: 'Mensajes y anuncios' },
  '/forums': { title: 'Foros', subtitle: 'Participa en las discusiones' },
  '/support': { title: 'Soporte', subtitle: 'Centro de ayuda y soporte técnico' },
  '/settings': { title: 'Configuración', subtitle: 'Ajustes de tu cuenta y preferencias' },
  '/audit-logs': { title: 'Trazabilidad', subtitle: 'Acciones del sistema y cambios en cursos' },
  '/student-activity': { title: 'Actividad de Estudiantes', subtitle: 'Entregas y completaciones' },
};

function getPageMeta(pathname: string) {
  const match = Object.keys(pageMeta).find(key => pathname.startsWith(key));
  return match ? pageMeta[match] : { title: 'lasa EDU', subtitle: '' };
}

export const Header = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [showProfile, setShowProfile] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { title, subtitle } = getPageMeta(location.pathname);

  useEffect(() => {
    if (!showProfile) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowProfile(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProfile]);

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-2.5 pl-[4.5rem] md:pl-6">
      <div className="flex items-center justify-between">
        {/* Page Title */}
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        </div>

        {/* Right Side: Notifications + Profile */}
        <div className="flex items-center space-x-2 md:space-x-4">
          {/* Notifications - Real-time component */}
          <NotificationCenter />

          {/* Profile Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowProfile(!showProfile)}
              className="flex items-center space-x-2"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-red-700 rounded-full flex items-center justify-center">
                <User className="h-4 w-4 text-white" />
              </div>
              <span className="hidden md:block text-sm font-medium text-gray-700">
                {user?.name}
              </span>
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </Button>

            {/* Profile Dropdown */}
            {showProfile && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                <div className="p-3 border-b border-gray-200">
                  <div className="text-sm font-medium text-gray-800">{user?.name}</div>
                  <div className="text-xs text-gray-500">{user?.email}</div>
                  <div className="text-xs text-red-600 capitalize">{user?.role}</div>
                </div>
                <div className="py-1">
                  <button onClick={() => { setShowProfile(false); navigate('/settings'); }} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">
                    Configuración
                  </button>
                  <button onClick={() => { setShowProfile(false); navigate('/support'); }} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">
                    Ayuda
                  </button>
                </div>
                <div className="border-t border-gray-200 py-1">
                  <button
                    onClick={() => { setShowProfile(false); logout(); }}
                    className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <LogOut className="h-4 w-4" />
                    Cerrar Sesión
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
