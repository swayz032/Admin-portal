import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

interface QuickStat {
  label: string;
  value: string | number;
  status?: 'success' | 'warning' | 'critical' | 'neutral';
  linkTo?: string;
}

interface QuickStatsProps {
  stats: QuickStat[];
  className?: string;
}

export function QuickStats({ stats, className }: QuickStatsProps) {
  const getStatusColor = (status?: QuickStat['status']) => {
    switch (status) {
      case 'success': return 'text-success';
      case 'warning': return 'text-warning';
      case 'critical': return 'text-destructive';
      default: return 'text-foreground';
    }
  };

  return (
    <div className={cn(
      'flex flex-wrap items-center gap-3 sm:gap-6 p-3 sm:p-4 rounded-lg bg-card/50 border border-border/50',
      className
    )}>
      {stats.map((stat, index) => {
        const content = (
          <div className="flex items-center gap-2">
            <span className={cn(
              'text-lg sm:text-xl font-bold tabular-nums',
              getStatusColor(stat.status)
            )}>
              {stat.value}
            </span>
            <span className="text-xs sm:text-sm text-muted-foreground">
              {stat.label}
            </span>
          </div>
        );

        return (
          <div key={stat.label} className="flex items-center gap-3 sm:gap-6">
            {stat.linkTo ? (
              <Link 
                to={stat.linkTo} 
                className="hover:opacity-80 transition-opacity"
              >
                {content}
              </Link>
            ) : (
              content
            )}
            {index < stats.length - 1 && (
              <div className="hidden sm:block w-px h-6 bg-border" />
            )}
          </div>
        );
      })}
    </div>
  );
}
