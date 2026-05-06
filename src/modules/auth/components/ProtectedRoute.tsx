import { useEffect, type ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../../app/store/authStore';
import type { UserRole } from '@shared/types';
import { Loader2 } from 'lucide-react';
import { redirectToHubLogin } from '@shared/services/hubAuth';

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
  children?: ReactNode;
}

const ProtectedRoute = ({ allowedRoles, children }: ProtectedRouteProps) => {
  const { user, isAuthenticated, isLoading, initialized } = useAuthStore();

  useEffect(() => {
    if (initialized && !isLoading && !isAuthenticated) {
      // No local fallback: any unauthenticated access goes back to lasaHUB.
      redirectToHubLogin();
    }
  }, [initialized, isLoading, isAuthenticated]);

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