import { useState } from 'react';
import type { ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@app/store/authStore';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ToastContainer } from '@shared/components/ui/Toast';

interface MainLayoutProps {
  children?: ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  const { isAuthenticated } = useAuthStore();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  const isLessonView = /\/courses\/[^/]+\/lesson\//.test(location.pathname);

  // In lesson view: sidebar always collapsed, no header
  const effectiveCollapsed = isLessonView ? true : sidebarCollapsed;

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar collapsed={effectiveCollapsed} onToggleCollapse={() => !isLessonView && setSidebarCollapsed(!sidebarCollapsed)} />

      {/* Main content area */}
      <div className={`flex flex-col h-[100dvh] transition-all duration-300 ${effectiveCollapsed ? 'md:ml-16' : 'md:ml-64'}`}>
        {!isLessonView && <Header />}
        <main className={`flex-1 overflow-y-auto ${isLessonView ? '' : 'p-4 md:p-6'}`}>
          {isLessonView ? (
            children || <Outlet />
          ) : (
            <div className="max-w-7xl mx-auto">
              {children || <Outlet />}
            </div>
          )}
        </main>
      </div>

      {/* Toast notifications */}
      <ToastContainer />
    </div>
  );
};

export default MainLayout;
