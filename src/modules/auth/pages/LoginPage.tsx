import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuthStore } from '../../../app/store/authStore';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { Label } from '@shared/components/ui/Label';
import { AlertCircle, Loader2, ChevronDown, GraduationCap, BookOpen, Users } from 'lucide-react';
import { dataInit } from '@shared/services/dataInit';

const loginSchema = z.object({
  email: z.string().email('Email invalido'),
  password: z.string().min(6, 'La contrasena debe tener al menos 6 caracteres'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading, error, isAuthenticated, user } = useAuthStore();
  const [localError, setLocalError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [devOpen, setDevOpen] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, user, navigate]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const fillDemoCredentials = (email: string) => {
    setValue('email', email);
    setValue('password', 'password123');
  };

  const handleResetDB = async () => {
    if (!window.confirm('Estas seguro de que quieres resetear la base de datos? Se borraran todos los datos y se reinicializaran con datos de prueba.')) {
      return;
    }
    setResetting(true);
    try {
      await dataInit();
      window.location.reload();
    } catch (err) {
      console.error('Error resetting DB:', err);
      alert('Error al resetear la base de datos. Revisa la consola para mas detalles.');
      setResetting(false);
    }
  };

  const onSubmit = async (data: LoginFormValues) => {
    setLocalError(null);
    try {
      await login(data.email, data.password);
      navigate('/dashboard');
    } catch (err: any) {
      setLocalError(err.message || 'Error al iniciar sesion');
    }
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      {/* Mobile brand header */}
      <div className="lg:hidden relative overflow-hidden bg-gradient-to-br from-red-600 via-red-700 to-red-900 px-6 py-8 text-white text-center">
        <div className="absolute inset-0 opacity-[0.07]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
        <div className="relative z-10 flex flex-col items-center gap-3">
          <img
            src="/LaAuroraLogo.png"
            alt="La Aurora"
            className="h-16 w-16 rounded-2xl bg-white p-1.5 object-contain"
          />
          <div>
            <h1 className="text-xl font-bold tracking-tight">La Aurora</h1>
            <p className="text-red-200 text-xs font-medium mt-0.5">Sistema de Gestion Educativa</p>
          </div>
        </div>
      </div>

      {/* Desktop brand panel */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden bg-gradient-to-br from-red-600 via-red-700 to-red-900 flex-col justify-between p-12 text-white">
        <div className="absolute inset-0 opacity-[0.07]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />

        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-2">
            <img
              src="/LaAuroraLogo.png"
              alt="La Aurora"
              className="h-14 w-14 rounded-xl bg-white p-1 object-contain"
            />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">La Aurora</h1>
              <p className="text-red-200 text-sm font-medium">Sistema de Gestion Educativa</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 space-y-8">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Gestion Academica</h3>
              <p className="text-red-200 text-sm mt-0.5">Cursos, calificaciones y certificados en un solo lugar.</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Aprendizaje Interactivo</h3>
              <p className="text-red-200 text-sm mt-0.5">Lecciones en video, material descargable y evaluaciones.</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Seguimiento Estudiantil</h3>
              <p className="text-red-200 text-sm mt-0.5">Progreso en tiempo real para estudiantes y docentes.</p>
            </div>
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-red-300 text-xs">&copy; {new Date().getFullYear()} La Aurora. Todos los derechos reservados.</p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex flex-col justify-center px-6 py-8 sm:px-12 lg:py-12 lg:px-16 xl:px-24 bg-gray-50">
        <div className="w-full max-w-sm mx-auto">
          <div className="mb-6 lg:mb-8">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Iniciar Sesion</h2>
            <p className="text-muted-foreground text-sm mt-1">Ingresa tus credenciales para continuar</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {(error || localError) && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{localError || error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">Correo electronico</Label>
              <Input
                id="email"
                type="email"
                placeholder="nombre@ejemplo.com"
                {...register('email')}
                className={`h-11 ${errors.email ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                disabled={isLoading}
              />
              {errors.email && (
                <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">Contrasena</Label>
                <Link
                  to="/recovery"
                  className="text-xs text-red-600 hover:text-red-700 hover:underline font-medium"
                >
                  Olvidaste tu contrasena?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="--------"
                {...register('password')}
                className={`h-11 ${errors.password ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                disabled={isLoading}
              />
              {errors.password && (
                <p className="text-xs text-red-600 mt-1">{errors.password.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full h-11 text-sm font-semibold" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Iniciando sesion...
                </>
              ) : (
                'Iniciar Sesion'
              )}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-6">
            Necesitas acceso? Contacta al administrador.
          </p>

          {/* Dev tools — collapsible */}
          <div className="mt-10 border-t pt-4">
            <button
              type="button"
              onClick={() => setDevOpen(!devOpen)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-500 transition-colors mx-auto"
            >
              <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${devOpen ? 'rotate-180' : ''}`} />
              Dev Tools
            </button>

            {devOpen && (
              <div className="mt-3 rounded-lg bg-gray-100 border border-gray-200 p-3 space-y-3">
                <p className="text-[11px] text-gray-500 text-center font-medium uppercase tracking-wider">
                  Usuarios de prueba <span className="font-normal normal-case">(pass: password123)</span>
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { email: 'admin@lasaedu.com', label: 'Admin' },
                    { email: 'admin2@lasaedu.com', label: 'Admin 2' },
                    { email: 'teacher@lasaedu.com', label: 'Teacher' },
                    { email: 'teacher2@lasaedu.com', label: 'Teacher 2' },
                    { email: 'student@lasaedu.com', label: 'Student' },
                    { email: 'support@lasaedu.com', label: 'Support' },
                  ].map(({ email, label }) => (
                    <button
                      key={email}
                      type="button"
                      onClick={() => fillDemoCredentials(email)}
                      className="text-[11px] text-left px-2 py-1.5 rounded-md bg-white border border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-600 transition-colors truncate"
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleResetDB}
                  disabled={resetting}
                  className="w-full text-[11px] text-red-400 hover:text-red-600 transition-colors py-1"
                >
                  {resetting ? 'Reseteando...' : 'Resetear Base de Datos'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
