import { cn } from '@/lib/utils';
import { User, Code } from 'lucide-react';
import { useSystem } from '@/contexts/SystemContext';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface OperatorEngineerToggleProps {
  compact?: boolean;
}

export function OperatorEngineerToggle({ compact = false }: OperatorEngineerToggleProps) {
  const { viewMode, setViewMode } = useSystem();
  
  return (
    <div className="flex items-center gap-1 p-1 bg-surface-1 rounded-lg border border-border">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setViewMode('operator')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all',
              viewMode === 'operator' 
                ? 'bg-primary text-primary-foreground' 
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-2'
            )}
          >
            <User className="h-4 w-4" />
            {!compact && 'Operator'}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Simplified view (plain language)</p>
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setViewMode('engineer')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all',
              viewMode === 'engineer' 
                ? 'bg-primary text-primary-foreground' 
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-2'
            )}
          >
            <Code className="h-4 w-4" />
            {!compact && 'Engineer'}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Technical view (full detail)</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
