import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, ChevronRight } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface HeroMetricCardProps {
  title: string;
  value: string;
  trend?: {
    direction: 'up' | 'down' | 'flat';
    value: string;
    label?: string;
  };
  sparklineData?: number[];
  icon?: ReactNode;
  status?: 'success' | 'warning' | 'critical' | 'neutral';
  linkTo?: string;
  linkLabel?: string;
}

export function HeroMetricCard({
  title,
  value,
  trend,
  sparklineData,
  icon,
  status = 'neutral',
  linkTo,
  linkLabel = 'View details',
}: HeroMetricCardProps) {
  const statusColors = {
    success: 'from-success/20 to-success/5',
    warning: 'from-warning/20 to-warning/5',
    critical: 'from-destructive/20 to-destructive/5',
    neutral: 'from-primary/10 to-primary/5',
  };

  const trendColors = {
    up: 'text-success bg-success/15',
    down: 'text-destructive bg-destructive/15',
    flat: 'text-muted-foreground bg-muted',
  };

  const sparklineColors = {
    success: 'hsl(142, 71%, 45%)',
    warning: 'hsl(38, 92%, 50%)',
    critical: 'hsl(0, 72%, 51%)',
    neutral: 'hsl(187, 82%, 53%)',
  };

  const TrendIcon = trend?.direction === 'up' ? TrendingUp : trend?.direction === 'down' ? TrendingDown : Minus;

  const chartData = sparklineData?.map((value, index) => ({ value, index })) || [];

  const content = (
    <div
      className={cn(
        'relative rounded-2xl p-6 transition-all duration-300 group cursor-pointer',
        'bg-gradient-to-br',
        statusColors[status],
        'border border-white/[0.06]',
        'hover:translate-y-[-4px] hover:shadow-xl hover:shadow-black/30',
        'hover:border-white/[0.1]'
      )}
    >
      {/* Background glow effect */}
      <div 
        className={cn(
          'absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500',
          status === 'success' && 'bg-success/5',
          status === 'warning' && 'bg-warning/5',
          status === 'critical' && 'bg-destructive/5',
          status === 'neutral' && 'bg-primary/5'
        )}
      />

      {/* Header */}
      <div className="flex items-start justify-between mb-4 relative">
        <div className="flex items-center gap-2">
          {icon && (
            <div className="p-2 rounded-lg bg-white/[0.06] text-muted-foreground">
              {icon}
            </div>
          )}
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
        </div>
        
        {trend && (
          <div className={cn('flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium', trendColors[trend.direction])}>
            <TrendIcon className="h-3 w-3" />
            {trend.value}
          </div>
        )}
      </div>

      {/* Value */}
      <div className="relative">
        <p className="text-4xl font-bold tracking-tight text-foreground mb-2">
          {value}
        </p>
        {trend?.label && (
          <p className="text-sm text-muted-foreground">{trend.label}</p>
        )}
      </div>

      {/* Sparkline */}
      {sparklineData && sparklineData.length > 0 && (
        <div className="mt-4 h-12 relative">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <Line
                type="monotone"
                dataKey="value"
                stroke={sparklineColors[status]}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Link indicator */}
      {linkTo && (
        <div className="mt-4 flex items-center gap-1 text-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity">
          <span>{linkLabel}</span>
          <ChevronRight className="h-4 w-4" />
        </div>
      )}
    </div>
  );

  if (linkTo) {
    return <Link to={linkTo}>{content}</Link>;
  }

  return content;
}
