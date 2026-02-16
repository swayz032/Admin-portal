import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ChevronRight, TrendingUp, TrendingDown, Sparkles } from 'lucide-react';
import { 
  LineChart, 
  Line, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  PieChart,
  Pie,
  Cell 
} from 'recharts';

interface StoryInsightCardProps {
  headline: string;
  subtext?: string;
  value?: string;
  trend?: 'positive' | 'negative' | 'neutral';
  chartType?: 'sparkline' | 'area' | 'progress-ring';
  chartData?: number[];
  progressValue?: number; // 0-100 for progress ring
  linkTo?: string;
  linkLabel?: string;
  icon?: ReactNode;
}

export function StoryInsightCard({
  headline,
  subtext,
  value,
  trend = 'neutral',
  chartType = 'sparkline',
  chartData,
  progressValue,
  linkTo,
  linkLabel = 'Learn more',
  icon,
}: StoryInsightCardProps) {
  const trendColors = {
    positive: 'hsl(142, 71%, 45%)',
    negative: 'hsl(0, 72%, 51%)',
    neutral: 'hsl(187, 82%, 53%)',
  };

  const TrendIcon = trend === 'positive' ? TrendingUp : trend === 'negative' ? TrendingDown : Sparkles;

  const lineChartData = chartData?.map((value, index) => ({ value, index })) || [];

  const renderChart = () => {
    if (chartType === 'progress-ring' && progressValue !== undefined) {
      const data = [
        { value: progressValue },
        { value: 100 - progressValue },
      ];
      
      return (
        <div className="w-20 h-20">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={28}
                outerRadius={36}
                startAngle={90}
                endAngle={-270}
                dataKey="value"
                stroke="none"
              >
                <Cell fill={trendColors[trend]} />
                <Cell fill="hsl(var(--muted))" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-bold">{progressValue}%</span>
          </div>
        </div>
      );
    }

    if (chartType === 'area' && chartData && chartData.length > 0) {
      return (
        <div className="h-16 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={lineChartData}>
              <defs>
                <linearGradient id={`gradient-${trend}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={trendColors[trend]} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={trendColors[trend]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={trendColors[trend]}
                strokeWidth={2}
                fill={`url(#gradient-${trend})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (chartData && chartData.length > 0) {
      return (
        <div className="h-12 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineChartData}>
              <Line
                type="monotone"
                dataKey="value"
                stroke={trendColors[trend]}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    }

    return null;
  };

  const content = (
    <div
      className={cn(
        'group relative rounded-xl p-5 transition-all duration-300',
        'bg-gradient-to-br from-card to-surface-1',
        'border border-white/[0.06]',
        'hover:border-white/[0.1] hover:shadow-lg hover:shadow-black/20',
        linkTo && 'cursor-pointer hover:translate-y-[-2px]'
      )}
    >
      {/* Icon */}
      <div className="flex items-start justify-between mb-3">
        <div className={cn(
          'p-2 rounded-lg',
          trend === 'positive' && 'bg-success/10 text-success',
          trend === 'negative' && 'bg-destructive/10 text-destructive',
          trend === 'neutral' && 'bg-primary/10 text-primary'
        )}>
          {icon || <TrendIcon className="h-5 w-5" />}
        </div>
        
        {value && (
          <span className="text-2xl font-bold tracking-tight">{value}</span>
        )}
      </div>

      {/* Headline */}
      <h3 className="text-base font-semibold text-foreground mb-1">
        {headline}
      </h3>
      
      {subtext && (
        <p className="text-sm text-muted-foreground mb-4">
          {subtext}
        </p>
      )}

      {/* Chart */}
      <div className="relative mt-4">
        {renderChart()}
      </div>

      {/* Link */}
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
