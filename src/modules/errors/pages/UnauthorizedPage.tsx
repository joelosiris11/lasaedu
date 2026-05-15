import { ShieldOff } from 'lucide-react';
import ErrorPageLayout from '../components/ErrorPageLayout';

export default function UnauthorizedPage() {
  return (
    <ErrorPageLayout
      code="403"
      title="Acceso restringido"
      description="No tienes permiso para acceder a esta sección. Si crees que es un error, contacta a un administrador."
      icon={<ShieldOff className="h-7 w-7" aria-hidden="true" />}
    />
  );
}
