import { cn } from '@/lib/utils';

interface SeverityBadgeProps {
  severity: 'P0' | 'P1' | 'P2' | 'P3';
}

const severityStyles = {
  P0: 'severity-p0',
  P1: 'severity-p1',
  P2: 'severity-p2',
  P3: 'severity-p3',
};

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  return (
    <span className={cn('status-chip font-semibold', severityStyles[severity])}>
      {severity}
    </span>
  );
}
