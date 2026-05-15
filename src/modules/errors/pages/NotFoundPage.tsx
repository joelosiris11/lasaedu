import { FileSearch } from 'lucide-react';
import ErrorPageLayout from '../components/ErrorPageLayout';

export default function NotFoundPage() {
  return (
    <ErrorPageLayout
      code="404"
      title="No encontramos esa página"
      description="La dirección puede estar mal escrita o el recurso ya no existe. Vuelve al inicio para seguir navegando."
      icon={<FileSearch className="h-7 w-7" aria-hidden="true" />}
    />
  );
}
