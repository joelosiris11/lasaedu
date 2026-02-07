import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuthStore } from '@app/store/authStore';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ToastContainer } from '@shared/components/ui/Toast';

interface MainLayoutProps {
  children?: ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />

      {/* Main content area */}
      <div className="md:ml-64">
        <Header />
        <main className="p-4 md:p-6">
          <div className="max-w-7xl mx-auto">
            {children || <Outlet />}
          </div>
        </main>
      </div>

      {/* Toast notifications */}
      <ToastContainer />
    </div>
  );
};

export default MainLayout;