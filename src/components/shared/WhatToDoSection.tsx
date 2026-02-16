import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface ActionItem {
  id: string;
  title: string;
  description?: string;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  linkTo: string;
  linkLabel?: string;
  onAction?: () => void;
}

interface WhatToDoSectionProps {
  title?: string;
  subtitle?: string;
  actions: ActionItem[];
  maxItems?: number;
  emptyMessage?: string;
  className?: string;
}

export function WhatToDoSection({ 
  title = "What to do", 
  subtitle,
  actions, 
  maxItems = 5,
  emptyMessage = "You're all caught up! Nothing needs your attention.",
  className 
}: WhatToDoSectionProps) {
  const getUrgencyStyles = (urgency: ActionItem['urgency']) => {
    switch (urgency) {
      case 'critical':
        return 'bg-destructive';
      case 'high':
        return 'bg-warning';
      case 'medium':
        return 'bg-primary';
      case 'low':
        return 'bg-muted-foreground';
    }
  };

  const displayedActions = actions.slice(0, maxItems);

  if (actions.length === 0) {
    return (
      <div className={cn('p-6 rounded-xl border border-border/50 bg-card/50', className)}>
        <div className="text-center py-6">
          <div className="text-4xl mb-3">🎉</div>
          <p className="text-muted-foreground">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('rounded-xl border border-border/50 bg-card/50 overflow-hidden', className)}>
      <div className="px-4 py-3 border-b border-border/50 bg-card/30">
        <h3 className="font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      <div className="divide-y divide-border/50">
        {displayedActions.map((action, index) => (
          <Link
            key={action.id}
            to={action.linkTo}
            className="flex items-center gap-4 p-4 hover:bg-accent/30 transition-colors group"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted/50 text-sm font-medium text-muted-foreground">
              {index + 1}
            </div>
            <div className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', getUrgencyStyles(action.urgency))} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {action.title}
              </p>
              {action.description && (
                <p className="text-xs text-muted-foreground truncate">
                  {action.description}
                </p>
              )}
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              {action.linkLabel || 'View'}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        ))}
      </div>
      {actions.length > maxItems && (
        <div className="px-4 py-3 border-t border-border/50 bg-card/30 text-center">
          <span className="text-xs text-muted-foreground">
            +{actions.length - maxItems} more items
          </span>
        </div>
      )}
    </div>
  );
}
