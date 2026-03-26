import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'gold' | 'blue' | 'success' | 'warning' | 'destructive';
  className?: string;
}

const variantStyles = {
  default: 'icon-container-glass',
  gold: 'icon-container-gold',
  blue: 'icon-container-blue',
  success: 'bg-success p-3 rounded-2xl shadow-lg',
  warning: 'bg-warning p-3 rounded-2xl shadow-lg',
  destructive: 'bg-destructive p-3 rounded-2xl shadow-lg',
};

const iconColors = {
  default: 'text-foreground',
  gold: 'text-foreground',
  blue: 'text-white',
  success: 'text-white',
  warning: 'text-foreground',
  destructive: 'text-white',
};

export default function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = 'default',
  className,
}: StatsCardProps) {
  return (
    <div className={cn("stats-card", className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs md:text-sm text-muted-foreground font-medium">{title}</p>
          <p className="text-xl md:text-3xl font-bold mt-1 md:mt-2 font-display">{value}</p>
          {subtitle && (
            <p className="text-[11px] md:text-sm text-muted-foreground mt-0.5 md:mt-1 leading-tight">{subtitle}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              <span
                className={cn(
                  "text-sm font-medium",
                  trend.isPositive ? "text-success" : "text-destructive"
                )}
              >
                {trend.isPositive ? '+' : ''}{trend.value}%
              </span>
              <span className="text-xs text-muted-foreground">vs last month</span>
            </div>
          )}
        </div>
        <div className={cn(variantStyles[variant])}>
          <Icon className={cn("h-5 w-5 md:h-6 md:w-6", iconColors[variant])} />
        </div>
      </div>
    </div>
  );
}
