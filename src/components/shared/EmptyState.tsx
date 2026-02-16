import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  Inbox, 
  PartyPopper, 
  BarChart3, 
  Search, 
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

type EmptyStateVariant = 'no-data' | 'all-done' | 'chart-empty' | 'search-empty' | 'error';

interface EmptyStateProps {
  variant?: EmptyStateVariant;
  title?: string;
  description?: string;
  actionLabel?: string;
  actionTo?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  secondaryActionTo?: string;
  onSecondaryAction?: () => void;
  icon?: ReactNode;
  className?: string;
}

const variantConfig: Record<EmptyStateVariant, { icon: typeof Inbox; title: string; description: string }> = {
  'no-data': {
    icon: Inbox,
    title: 'Nothing here yet',
    description: 'This section will populate as your data comes in.',
  },
  'all-done': {
    icon: PartyPopper,
    title: "You're all caught up!",
    description: 'No items require your attention right now.',
  },
  'chart-empty': {
    icon: BarChart3,
    title: 'No data to display',
    description: 'Charts will appear once there is enough data.',
  },
  'search-empty': {
    icon: Search,
    title: 'No results found',
    description: 'Try adjusting your search or filter criteria.',
  },
  'error': {
    icon: AlertCircle,
    title: 'Something went wrong',
    description: 'We encountered an issue. Please try again.',
  },
};

export function EmptyState({
  variant = 'no-data',
  title,
  description,
  actionLabel,
  actionTo,
  onAction,
  secondaryActionLabel,
  secondaryActionTo,
  onSecondaryAction,
  icon,
  className,
}: EmptyStateProps) {
  const config = variantConfig[variant];
  const Icon = icon ? null : config.icon;
  const displayTitle = title || config.title;
  const displayDescription = description || config.description;

  const isAllDone = variant === 'all-done';

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 px-6 text-center',
        className
      )}
    >
      {/* Illustration / Icon */}
      <div
        className={cn(
          'w-20 h-20 rounded-full flex items-center justify-center mb-6',
          'transition-transform duration-500',
          isAllDone 
            ? 'bg-gradient-to-br from-success/20 to-success/5' 
            : 'bg-gradient-to-br from-muted to-muted/50'
        )}
      >
        {icon || (
          Icon && (
            <Icon
              className={cn(
                'w-10 h-10',
                isAllDone ? 'text-success' : 'text-muted-foreground'
              )}
            />
          )
        )}
      </div>

      {/* Celebration effect for all-done */}
      {isAllDone && (
        <div className="absolute">
          <div className="w-32 h-32 rounded-full bg-success/10 animate-ping" />
        </div>
      )}

      {/* Title */}
      <h3 className="text-lg font-semibold text-foreground mb-2">
        {displayTitle}
      </h3>

      {/* Description */}
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        {displayDescription}
      </p>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {actionLabel && (actionTo || onAction) && (
          actionTo ? (
            <Button asChild>
              <Link to={actionTo}>{actionLabel}</Link>
            </Button>
          ) : (
            <Button onClick={onAction}>{actionLabel}</Button>
          )
        )}

        {secondaryActionLabel && (secondaryActionTo || onSecondaryAction) && (
          secondaryActionTo ? (
            <Button variant="outline" asChild>
              <Link to={secondaryActionTo}>{secondaryActionLabel}</Link>
            </Button>
          ) : (
            <Button variant="outline" onClick={onSecondaryAction}>
              {secondaryActionLabel}
            </Button>
          )
        )}
      </div>
    </div>
  );
}
