import { ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/auth-context';
import AdminSidebar from './AdminSidebar';
import { Loader2 } from 'lucide-react';

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();

  console.log('AdminLayout rendered - isLoading:', isLoading, 'isAdmin:', isAdmin);

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      console.log('AdminLayout: user not admin, redirecting to login');
      navigate('/admin/login');
    }
  }, [isAdmin, isLoading, navigate]);

  if (isLoading) {
    console.log('AdminLayout: showing loading spinner');
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    console.log('AdminLayout: not admin, returning null');
    return null;
  }

  console.log('AdminLayout: rendering main content');
  return (
    <div className="min-h-dvh flex">
      <AdminSidebar />
      <main className="flex-1 md:ml-64 pt-14 md:pt-0 px-2 py-2 md:p-6 overflow-auto">
        <div className="max-w-7xl mx-auto animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
