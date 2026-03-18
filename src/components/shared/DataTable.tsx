import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T, index: number) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  resultLabel?: string;
  maxHeight?: string;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
  };
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  isLoading,
  emptyMessage = 'No results found for the current filters.',
  resultLabel,
  maxHeight = '600px',
  pagination,
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="loading-state">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading...</span>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="empty-state">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  const totalPages = pagination ? Math.ceil(pagination.total / pagination.pageSize) : 1;
  const displayCount = pagination ? pagination.total : data.length;

  return (
    <div className="rounded-xl border border-border/50 overflow-hidden">
      {/* Result count badge */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-surface-2/50 border-b border-border/50">
        <span className="text-xs font-medium text-muted-foreground">
          {displayCount.toLocaleString()} {resultLabel || 'results'}
        </span>
      </div>

      {/* Scrollable table */}
      <div className="overflow-y-auto scrollbar-thin" style={{ maxHeight }}>
        <table className="data-table">
          <thead className="sticky top-0 z-10">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={col.className}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr
                key={keyExtractor(item)}
                onClick={() => onRowClick?.(item)}
                className={cn(
                  onRowClick && 'cursor-pointer',
                  index % 2 === 1 && 'bg-muted/10'
                )}
              >
                {columns.map((col) => (
                  <td key={col.key} className={col.className}>
                    {col.render ? col.render(item, index) : String((item as Record<string, unknown>)[col.key] ?? '-')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <span className="text-sm text-text-secondary">
            Showing {((pagination.page - 1) * pagination.pageSize) + 1} to{' '}
            {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{' '}
            {pagination.total.toLocaleString()} results
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-text-secondary">
              Page {pagination.page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
