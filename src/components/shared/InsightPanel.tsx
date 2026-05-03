import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, ChevronRight } from 'lucide-react';

interface InsightPanelProps {
  headline: string;
  subtext?: string;
  trend?: 'positive' | 'negative' | 'neutral';
  value?: string | number;
  chart?: ReactNode;
  icon?: ReactNode;
  linkTo?: string;
  linkLabel?: string;
  className?: string;
}

export function InsightPanel({
  headline,
  subtext,
  trend,
  value,
  chart,
  icon,
  linkTo,
  linkLabel = 'Learn more',
  className,
}: InsightPanelProps) {
  const getTrendIcon = () => {
    switch (trend) {
      case 'positive':
        return <TrendingUp className="h-4 w-4 text-success" />;
      case 'negative':
        return <TrendingDown className="h-4 w-4 text-destructive" />;
      case 'neutral':
        return <Minus className="h-4 w-4 text-muted-foreground" />;
      default:
        return null;
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case 'positive': return 'text-success';
      case 'negative': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className={cn(
      'canvas-card group relative overflow-hidden p-5',
      className
    )}>
      <div className="relative space-y-3">
        {/* Header with icon */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground text-base leading-tight">
              {headline}
            </h3>
            {subtext && (
              <p className="text-sm text-muted-foreground mt-1">
                {subtext}
              </p>
            )}
          </div>
          {icon && (
            <div className="canvas-tile flex h-10 w-10 flex-shrink-0 items-center justify-center text-primary">
              {icon}
            </div>
          )}
        </div>

        {/* Value with trend */}
        {value && (
          <div className="flex items-center gap-2">
            <span className={cn('text-2xl font-bold', getTrendColor())}>
              {value}
            </span>
            {getTrendIcon()}
          </div>
        )}

        {/* Chart area */}
        {chart && (
          <div className="h-16 mt-2">
            {chart}
          </div>
        )}

        {/* Link */}
        {linkTo && (
          <Link 
            to={linkTo}
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2 group-hover:gap-2 transition-all"
          >
            {linkLabel}
            <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </div>
  );
}
