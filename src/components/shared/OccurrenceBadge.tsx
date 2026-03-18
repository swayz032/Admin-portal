import { cn } from '@/lib/utils';

interface OccurrenceBadgeProps {
  count: number;
  className?: string;
}

export function OccurrenceBadge({ count, className }: OccurrenceBadgeProps) {
  if (count <= 1) return null;
  return (
    <span className={cn(
      'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tabular-nums',
      count >= 100 ? 'bg-destructive/15 text-destructive' :
      count >= 10 ? 'bg-warning/15 text-warning' :
      'bg-muted text-muted-foreground',
      className
    )}>
      x{count.toLocaleString()}
    </span>
  );
}
