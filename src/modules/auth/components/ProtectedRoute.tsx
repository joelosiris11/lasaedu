import { useEffect, type ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../../app/store/authStore';
import type { UserRole } from '@shared/types';
import { Loader2 } from 'lucide-react';
import { isLocalAuthMode, redirectToHubLogin } from '@shared/services/hubAuth';

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
  children?: ReactNode;
}

const ProtectedRoute = ({ allowedRoles, children }: ProtectedRouteProps) => {
  const { user, isAuthenticated, isLoading, initialized } = useAuthStore();
  const localAuth = isLocalAuthMode();

  useEffect(() => {
    if (initialized && !isLoading && !isAuthenticated && !localAuth) {
      redirectToHubLogin();
    }
  }, [initialized, isLoading, isAuthenticated, localAuth]);

  if (initialized && !isLoading && !isAuthenticated && localAuth) {
    return <Navigate to="/login" replace />;
  }

  if (isLoading || !initialized || !isAuthenticated) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

export default ProtectedRoute;