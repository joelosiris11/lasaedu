import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuthStore } from '../../../app/store/authStore';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { Label } from '@shared/components/ui/Label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@shared/components/ui/Card';
import { AlertCircle, Loader2 } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading, error, isAuthenticated, user } = useAuthStore();
  const [localError, setLocalError] = useState<string | null>(null);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'admin') navigate('/admin');
      else if (user.role === 'teacher') navigate('/teacher');
      else if (user.role === 'student') navigate('/student');
      else if (user.role === 'support') navigate('/support');
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

  // Quick fill demo credentials
  const fillDemoCredentials = (email: string) => {
    setValue('email', email);
    setValue('password', 'password123');
  };

  const onSubmit = async (data: LoginFormValues) => {
    setLocalError(null);
    try {
      await login(data.email, data.password);
      
      // Get the user from the store state to check role
      const user = useAuthStore.getState().user;
      
      if (user?.role === 'admin') navigate('/admin');
      else if (user?.role === 'teacher') navigate('/teacher');
      else if (user?.role === 'student') navigate('/student');
      else if (user?.role === 'support') navigate('/support');
      else navigate('/'); // Fallback
      
    } catch (err: any) {
      setLocalError(err.message || 'Error al iniciar sesión');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center text-primary">LasaEdu LMS</CardTitle>
          <CardDescription className="text-center">
            Ingresa a tu cuenta para continuar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {(error || localError) && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>{localError || error}</span>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="nombre@ejemplo.com"
                {...register('email')}
                className={errors.email ? 'border-destructive' : ''}
                disabled={isLoading}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                {...register('password')}
                className={errors.password ? 'border-destructive' : ''}
                disabled={isLoading}
              />
               {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>
            
             <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Iniciando...
                </>
              ) : (
                'Iniciar Sesión'
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
            <div className="flex flex-col space-y-2 w-full text-center text-sm">
                <Link to="/recovery" className="text-muted-foreground hover:text-primary hover:underline">
                    ¿Olvidaste tu contraseña?
                </Link>
                <div className="text-muted-foreground">
                    ¿No tienes cuenta?{' '}
                    <Link to="/register" className="text-primary hover:underline">
                        Regístrate
                    </Link>
                </div>
            </div>
            
            <div className="text-xs text-center text-muted-foreground w-full border-t pt-4">
                <p>Usuarios de prueba (password: password123):</p>
                <div className="grid grid-cols-2 gap-2 mt-2">
                    <button type="button" className="underline hover:text-primary" onClick={() => fillDemoCredentials('admin@lasaedu.com')}>
                      admin@lasaedu.com
                    </button>
                    <button type="button" className="underline hover:text-primary" onClick={() => fillDemoCredentials('teacher@lasaedu.com')}>
                      teacher@lasaedu.com
                    </button>
                    <button type="button" className="underline hover:text-primary" onClick={() => fillDemoCredentials('student@lasaedu.com')}>
                      student@lasaedu.com
                    </button>
                    <button type="button" className="underline hover:text-primary" onClick={() => fillDemoCredentials('support@lasaedu.com')}>
                      support@lasaedu.com
                    </button>
                </div>
            </div>
        </CardFooter>
      </Card>
    </div>
  );
}
