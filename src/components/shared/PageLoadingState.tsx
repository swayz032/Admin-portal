import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface PageLoadingStateProps {
  /** Number of skeleton rows to show */
  rows?: number;
  /** Show KPI card skeletons at top */
  showKPIs?: boolean;
  /** Number of KPI cards */
  kpiCount?: number;
  className?: string;
}

/** Full-page loading skeleton for admin portal pages */
export function PageLoadingState({
  rows = 5,
  showKPIs = false,
  kpiCount = 4,
  className,
}: PageLoadingStateProps) {
  return (
    <div className={cn('space-y-6 animate-in fade-in duration-300', className)}>
      {/* KPI cards skeleton */}
      {showKPIs && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: kpiCount }).map((_, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-4 space-y-3">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-24" />
              <Skeleton className="h-2 w-16" />
            </div>
          ))}
        </div>
      )}

      {/* Table skeleton */}
      <div className="rounded-lg border border-border bg-card">
        {/* Header */}
        <div className="flex items-center gap-4 px-4 py-3 border-b border-border">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-16 ml-auto" />
        </div>

        {/* Rows */}
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-0"
          >
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-3 w-20 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Inline loading state for sections within a page */
export function SectionLoadingState({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3 py-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded" />
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-2 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
