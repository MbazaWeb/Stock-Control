import { ReactNode } from 'react';
import PublicNav from './PublicNav';

interface PublicLayoutProps {
  children: ReactNode;
}

export default function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div className="min-h-screen">
      <PublicNav />
      <main className="pt-20 pb-8 px-4 md:px-6">
        <div className="container mx-auto max-w-7xl">
          {children}
        </div>
      </main>
    </div>
  );
}
