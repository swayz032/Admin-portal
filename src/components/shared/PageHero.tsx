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
      'relative p-6 rounded-xl border border-border/50 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm',
      'before:absolute before:inset-0 before:rounded-xl before:bg-gradient-to-r before:from-primary/5 before:to-transparent before:pointer-events-none',
      className
    )}>
      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          {icon && (
            <div className="hidden sm:flex w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 items-center justify-center ring-1 ring-primary/20 flex-shrink-0">
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
