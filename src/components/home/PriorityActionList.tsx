import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ChevronRight, CheckCircle2, AlertCircle, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface PriorityAction {
  id: string;
  title: string;
  description: string;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  type: 'approval' | 'incident' | 'review' | 'action';
  linkTo: string;
  linkLabel: string;
}

interface PriorityActionListProps {
  actions: PriorityAction[];
  onComplete?: (id: string) => void;
  maxItems?: number;
}

export function PriorityActionList({ actions, onComplete, maxItems = 5 }: PriorityActionListProps) {
  const urgencyConfig = {
    critical: {
      dot: 'bg-destructive animate-pulse',
      border: 'border-l-destructive',
      icon: AlertCircle,
      label: 'Critical',
    },
    high: {
      dot: 'bg-warning',
      border: 'border-l-warning',
      icon: AlertTriangle,
      label: 'High',
    },
    medium: {
      dot: 'bg-primary',
      border: 'border-l-primary',
      icon: Clock,
      label: 'Medium',
    },
    low: {
      dot: 'bg-muted-foreground',
      border: 'border-l-muted',
      icon: CheckCircle2,
      label: 'Low',
    },
  };

  const displayedActions = actions.slice(0, maxItems);

  if (displayedActions.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success/10 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-success" />
        </div>
        <h3 className="text-lg font-semibold mb-2">You're all caught up!</h3>
        <p className="text-muted-foreground text-sm">
          No actions require your attention right now.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {displayedActions.map((action, index) => {
        const config = urgencyConfig[action.urgency];
        const Icon = config.icon;

        return (
          <Link
            key={action.id}
            to={action.linkTo}
            className={cn(
              'group flex items-center gap-4 p-4 rounded-xl',
              'bg-surface-1 border border-border',
              'border-l-4',
              config.border,
              'hover:bg-surface-2 transition-all duration-200',
              'hover:translate-x-1'
            )}
          >
            {/* Rank number */}
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <span className="text-sm font-medium text-muted-foreground">{index + 1}</span>
            </div>

            {/* Urgency indicator */}
            <div className="flex-shrink-0">
              <div className={cn('w-2.5 h-2.5 rounded-full', config.dot)} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-foreground truncate">
                {action.title}
              </h4>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {action.description}
              </p>
            </div>

            {/* Action */}
            <Button
              variant="ghost"
              size="sm"
              className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              {action.linkLabel}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        );
      })}

      {actions.length > maxItems && (
        <div className="pt-2 text-center">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/approvals">
              View all {actions.length} actions
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
