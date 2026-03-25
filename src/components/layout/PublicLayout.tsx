import { ReactNode } from 'react';
import PublicNav from './PublicNav';

interface PublicLayoutProps {
  children: ReactNode;
}

export default function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div className="min-h-dvh">
      <PublicNav />
      <main className="pt-18 pb-6 px-3 md:pt-20 md:pb-8 md:px-6">
        <div className="container mx-auto max-w-7xl">
          {children}
        </div>
      </main>
    </div>
  );
}
