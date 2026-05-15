import { AlertTriangle, RefreshCw } from 'lucide-react';
import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import ErrorPageLayout from '../components/ErrorPageLayout';
import NotFoundPage from './NotFoundPage';
import UnauthorizedPage from './UnauthorizedPage';

// Router-level errorElement. Differentiates 404 / 403 that bubbled up from
// loaders, otherwise renders the generic "algo se rompió" 500 view with a
// reload action.
export default function ServerErrorPage() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) return <NotFoundPage />;
    if (error.status === 403) return <UnauthorizedPage />;
  }

  if (import.meta.env.DEV) {
    console.error('[ServerErrorPage] route error:', error);
  }

  return (
    <ErrorPageLayout
      code="500"
      title="Algo se rompió"
      description="Tuvimos un problema cargando esta página. Intenta recargar o vuelve al inicio."
      icon={<AlertTriangle className="h-7 w-7" aria-hidden="true" />}
      secondary={{
        label: 'Recargar',
        onClick: () => window.location.reload(),
        icon: <RefreshCw className="h-4 w-4" aria-hidden="true" />,
      }}
    />
  );
}
