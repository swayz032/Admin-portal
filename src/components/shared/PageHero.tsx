import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { StatusChip } from './StatusChip';

interface PageHeroProps {
  title: string;
  subtitle?: string;
  status?: {
    type: 'success' | 'warning' | 'critical' | 'pending' | 'neutral';
    label: string;
  };
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function PageHero({ title, subtitle, status, icon, action, className }: PageHeroProps) {
  return (
    <div className={cn(
      'canvas-card relative p-6',
      'before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:rounded-l-lg before:bg-primary before:pointer-events-none',
      className
    )}>
      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          {icon && (
            <div className="canvas-tile hidden h-14 w-14 items-center justify-center text-primary sm:flex">
              <div className="text-primary">{icon}</div>
            </div>
          )}
          <div className="space-y-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {title}
              </h1>
              {status && (
                <StatusChip status={status.type} label={status.label} />
              )}
            </div>
            {subtitle && (
              <p className="text-muted-foreground text-sm sm:text-base max-w-2xl">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {action && (
          <div className="flex-shrink-0">
            {action}
          </div>
        )}
      </div>
    </div>
  );
}
