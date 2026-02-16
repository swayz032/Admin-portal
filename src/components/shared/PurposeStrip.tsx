import { useSystem } from '@/contexts/SystemContext';
import { cn } from '@/lib/utils';

interface PurposeStripProps {
  operatorPurpose: string;
  engineerPurpose: string;
  operatorAction?: string;
  engineerObjects?: string[];
  className?: string;
  variant?: 'default' | 'compact';
}

export function PurposeStrip({
  operatorPurpose,
  engineerPurpose,
  operatorAction,
  engineerObjects,
  className = '',
  variant = 'default',
}: PurposeStripProps) {
  const { viewMode } = useSystem();
  const isOperator = viewMode === 'operator';

  if (variant === 'compact') {
    return (
      <div className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg text-xs',
        'bg-surface-2 border border-border/50',
        className
      )}>
        <span className="text-muted-foreground">
          {isOperator ? operatorPurpose : engineerPurpose}
        </span>
        {!isOperator && engineerObjects && engineerObjects.length > 0 && (
          <>
            <span className="text-border">•</span>
            <span className="font-mono text-primary/80">
              {engineerObjects.join(', ')}
            </span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={cn(
      'p-4 rounded-xl',
      'bg-gradient-to-r from-surface-2 to-surface-1',
      'border border-border/50',
      className
    )}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 flex-1">
          <p className="text-sm text-foreground">
            {isOperator ? operatorPurpose : engineerPurpose}
          </p>
          {isOperator && operatorAction && (
            <p className="text-xs text-primary">
              → {operatorAction}
            </p>
          )}
          {!isOperator && engineerObjects && engineerObjects.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-muted-foreground">Objects:</span>
              <div className="flex flex-wrap gap-1">
                {engineerObjects.map((obj) => (
                  <span
                    key={obj}
                    className="px-2 py-0.5 rounded text-xs font-mono bg-primary/10 text-primary border border-primary/20"
                  >
                    {obj}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
