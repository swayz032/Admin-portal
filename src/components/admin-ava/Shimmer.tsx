/**
 * Shimmer — animated text sweep effect for streaming/loading states.
 * Matches AI Elements Shimmer component behavior.
 */

import { cn } from '@/lib/utils';

interface ShimmerProps {
  children: React.ReactNode;
  className?: string;
  /** Animation duration in seconds */
  duration?: number;
  /** Whether shimmer is active */
  active?: boolean;
}

export function Shimmer({ children, className, duration = 2, active = true }: ShimmerProps) {
  if (!active) return <>{children}</>;

  return (
    <span
      className={cn(
        'inline-block bg-clip-text',
        'shimmer-text',
        className,
      )}
      style={{
        '--shimmer-duration': `${duration}s`,
      } as React.CSSProperties}
    >
      {children}
    </span>
  );
}

/**
 * ShimmerBlock — block-level shimmer for placeholder content.
 */
export function ShimmerBlock({ className, lines = 3 }: { className?: string; lines?: number }) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 rounded-md shimmer-block"
          style={{
            width: i === lines - 1 ? '60%' : '100%',
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
    </div>
  );
}
