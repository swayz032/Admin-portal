import { cn } from '@/lib/utils';

type StatusType = 
  | 'success' 
  | 'warning' 
  | 'critical' 
  | 'pending' 
  | 'neutral'
  | 'info'
  | 'healthy'
  | 'at-risk'
  | 'writes-paused'
  | 'read-only';

interface StatusChipProps {
  status: StatusType;
  label: string;
  size?: 'sm' | 'md';
}

const statusStyles: Record<StatusType, string> = {
  success: 'bg-success/20 text-success',
  healthy: 'bg-success/20 text-success',
  warning: 'bg-warning/20 text-warning',
  'at-risk': 'bg-warning/20 text-warning',
  critical: 'bg-destructive/20 text-destructive',
  pending: 'bg-primary/20 text-primary',
  info: 'bg-primary/20 text-primary',
  'writes-paused': 'bg-warning/20 text-warning',
  'read-only': 'bg-muted text-muted-foreground',
  neutral: 'bg-muted text-muted-foreground',
};

export function StatusChip({ status, label, size = 'sm' }: StatusChipProps) {
  return (
    <span
      className={cn(
        'status-chip',
        statusStyles[status],
        size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'
      )}
    >
      {label}
    </span>
  );
}
