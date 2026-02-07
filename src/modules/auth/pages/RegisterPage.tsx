import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@shared/components/ui/Card';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '@shared/components/ui/Button';

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-amber-100 rounded-full">
              <ShieldAlert className="h-8 w-8 text-amber-600" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center text-gray-800">
            Registro Restringido
          </CardTitle>
          <CardDescription className="text-center text-gray-600">
            El registro en esta plataforma es solo por invitación
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-gray-600 mb-4">
            LasaEdu es una plataforma educativa empresarial. Los usuarios son creados
            exclusivamente por el administrador del sistema.
          </p>
          <p className="text-sm text-gray-500">
            Si necesitas acceso, contacta al administrador de tu organización.
          </p>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Link to="/login">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Volver al inicio de sesión
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
