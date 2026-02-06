import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuthStore } from '@app/store/authStore';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { Label } from '@shared/components/ui/Label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@shared/components/ui/Card';
import { Loader2, CheckCircle2 } from 'lucide-react';

const recoverySchema = z.object({
  email: z.string().email('Email inválido'),
});

type RecoveryFormValues = z.infer<typeof recoverySchema>;

export default function RecoveryPage() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const navigate = useNavigate();
  const { resetPassword, isLoading } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RecoveryFormValues>({
    resolver: zodResolver(recoverySchema),
  });

  const onSubmit = async (data: RecoveryFormValues) => {
    try {
      await resetPassword(data.email);
      setIsSubmitted(true);
    } catch {
      // Always show success message for security (don't reveal if email exists)
      setIsSubmitted(true);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center text-primary">Recuperar Contraseña</CardTitle>
          <CardDescription className="text-center">
            Ingresa tu email para recibir instrucciones
          </CardDescription>
        </CardHeader>
        <CardContent>
            {isSubmitted ? (
                <div className="text-center space-y-4">
                    <div className="flex justify-center">
                        <CheckCircle2 className="h-12 w-12 text-green-500" />
                    </div>
                    <p className="text-gray-600">
                        Si existe una cuenta asociada a ese email, recibirás un enlace para restablecer tu contraseña.
                    </p>
                    <Button className="w-full mt-4" variant="outline" onClick={() => navigate('/login')}>
                        Volver al inicio de sesión
                    </Button>
                </div>
            ) : (
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
                    
                    <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                        <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enviando...
                        </>
                    ) : (
                        'Enviar instrucciones'
                    )}
                    </Button>
                </form>
            )}
        </CardContent>
        {!isSubmitted && (
            <CardFooter className="flex justify-center">
                <Link to="/login" className="text-sm text-muted-foreground hover:text-primary hover:underline">
                    Volver al inicio de sesión
                </Link>
            </CardFooter>
        )}
      </Card>
    </div>
  );
}
