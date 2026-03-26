import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export default function GlassCard({ children, className, hover = true }: GlassCardProps) {
  return (
    <div
      className={cn(
        "glass-card p-3 md:p-6 animate-fade-in",
        hover && "transition-all duration-300 hover:scale-[1.01] hover:shadow-elevated",
        className
      )}
    >
      {children}
    </div>
  );
}
