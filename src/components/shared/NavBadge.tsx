import { cn } from '@/lib/utils';

interface NavBadgeProps {
  count?: number;
  variant?: 'count' | 'alert' | 'new';
  className?: string;
}

export function NavBadge({ count, variant = 'count', className }: NavBadgeProps) {
  if (variant === 'count' && (count === undefined || count === 0)) {
    return null;
  }

  if (variant === 'count') {
    return (
      <span
        className={cn(
          'min-w-[18px] h-[18px] px-1.5 rounded-full',
          'bg-destructive text-destructive-foreground',
          'text-[10px] font-bold',
          'flex items-center justify-center',
          className
        )}
      >
        {count! > 99 ? '99+' : count}
      </span>
    );
  }

  if (variant === 'alert') {
    return (
      <span
        className={cn(
          'w-2 h-2 rounded-full bg-warning animate-pulse',
          className
        )}
      />
    );
  }

  if (variant === 'new') {
    return (
      <span
        className={cn(
          'px-1.5 py-0.5 rounded text-[9px] font-bold uppercase',
          'bg-primary/20 text-primary',
          className
        )}
      >
        New
      </span>
    );
  }

  return null;
}
