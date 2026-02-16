import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    label?: string;
  };
  status?: 'success' | 'warning' | 'critical' | 'info';
  icon?: ReactNode;
  linkTo?: string;
  linkLabel?: string;
}

export function KPICard({
  title,
  value,
  subtitle,
  trend,
  status,
  icon,
  linkTo,
  linkLabel,
}: KPICardProps) {
  const statusColors = {
    success: 'text-success',
    warning: 'text-warning',
    critical: 'text-destructive',
    info: 'text-primary',
  };

  return (
    <div className="kpi-card group">
      <div className="flex items-start justify-between mb-3">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </span>
        {icon && (
          <div className={cn(
            'p-2 rounded-lg bg-surface-2 transition-colors group-hover:bg-surface-3',
            status && statusColors[status]
          )}>
            {icon}
          </div>
        )}
      </div>
      
      <div className="flex items-baseline gap-2">
        <span className={cn(
          'text-2xl font-semibold tracking-tight',
          status ? statusColors[status] : 'text-foreground'
        )}>
          {value}
        </span>
        {trend && (
          <span className={cn(
            'flex items-center text-xs font-medium',
            trend.value >= 0 ? 'text-success' : 'text-destructive'
          )}>
            {trend.value >= 0 ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {Math.abs(trend.value)}%
            {trend.label && <span className="ml-1 text-muted-foreground">{trend.label}</span>}
          </span>
        )}
      </div>
      
      {subtitle && (
        <p className="text-xs text-muted-foreground mt-1.5">{subtitle}</p>
      )}
      
      {linkTo && (
        <Link
          to={linkTo}
          className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 mt-3 font-medium transition-colors"
        >
          {linkLabel || 'View details'}
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}
