/**
 * Real-time error count badge — shows on header + sidebar.
 * Pulses red on P0/P1 errors.
 */

import { cn } from '@/lib/utils';
import { useErrorStream } from '@/hooks/useErrorStream';

interface ErrorNotificationBadgeProps {
  className?: string;
  /** Show only critical (P0+P1) count */
  criticalOnly?: boolean;
}

export function ErrorNotificationBadge({ className, criticalOnly = false }: ErrorNotificationBadgeProps) {
  const { counts, hasNewErrors, clearNewFlag } = useErrorStream();

  const count = criticalOnly ? counts.p0 + counts.p1 : counts.total;
  if (count === 0) return null;

  const hasCritical = counts.p0 > 0 || counts.p1 > 0;

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold',
        hasCritical
          ? 'bg-red-500 text-white animate-pulse'
          : 'bg-amber-500 text-white',
        hasNewErrors && 'ring-2 ring-red-500/50',
        className,
      )}
      onClick={clearNewFlag}
      title={`${counts.p0} P0, ${counts.p1} P1, ${counts.p2} P2, ${counts.p3} P3`}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
