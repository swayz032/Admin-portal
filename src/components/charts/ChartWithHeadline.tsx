import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ChartWithHeadlineProps {
  headline: string;
  subtext?: string;
  trend?: 'positive' | 'negative' | 'neutral';
  children: ReactNode;
  linkTo?: string;
  linkLabel?: string;
  className?: string;
}

export function ChartWithHeadline({
  headline,
  subtext,
  trend,
  children,
  linkTo,
  linkLabel = 'View details',
  className,
}: ChartWithHeadlineProps) {
  const TrendIcon = trend === 'positive' 
    ? TrendingUp 
    : trend === 'negative' 
      ? TrendingDown 
      : Minus;

  const trendColors = {
    positive: 'text-success bg-success/10',
    negative: 'text-destructive bg-destructive/10',
    neutral: 'text-muted-foreground bg-muted',
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Headline section */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="text-lg font-semibold text-foreground">
              {headline}
            </h3>
            {trend && (
              <div className={cn('p-1.5 rounded-lg', trendColors[trend])}>
                <TrendIcon className="h-4 w-4" />
              </div>
            )}
          </div>
          {subtext && (
            <p className="text-sm text-muted-foreground">
              {subtext}
            </p>
          )}
        </div>
        
        {linkTo && (
          <Link 
            to={linkTo}
            className="flex items-center gap-1 text-sm text-primary hover:underline flex-shrink-0"
          >
            {linkLabel}
            <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </div>

      {/* Chart */}
      <div className="relative">
        {children}
      </div>
    </div>
  );
}
