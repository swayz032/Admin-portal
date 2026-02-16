import { cn } from '@/lib/utils';

interface RiskBadgeProps {
  risk: 'Low' | 'Medium' | 'High' | 'None';
}

const riskStyles = {
  Low: 'risk-low',
  Medium: 'risk-medium',
  High: 'risk-high',
  None: 'text-text-secondary',
};

export function RiskBadge({ risk }: RiskBadgeProps) {
  if (risk === 'None') {
    return <span className="text-text-tertiary">—</span>;
  }
  
  return (
    <span className={cn('font-medium', riskStyles[risk])}>
      {risk}
    </span>
  );
}
