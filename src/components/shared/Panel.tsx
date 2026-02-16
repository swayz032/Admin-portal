import { ReactNode, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface PanelProps {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

export function Panel({ title, subtitle, action, children, className, noPadding, collapsible = false, defaultExpanded = true }: PanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  
  return (
    <div className={cn('panel', className)}>
      {(title || action) && (
        <div 
          className={cn('panel-header', collapsible && 'cursor-pointer select-none')}
          onClick={collapsible ? () => setExpanded(!expanded) : undefined}
        >
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              {collapsible && (
                expanded 
                  ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> 
                  : <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
              {title && <h3 className="panel-title">{title}</h3>}
            </div>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          {action && <div onClick={(e) => e.stopPropagation()}>{action}</div>}
        </div>
      )}
      {expanded && (
        <div className={cn(!noPadding && 'panel-content')}>
          {children}
        </div>
      )}
    </div>
  );
}
