import { HelpCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useSystem } from '@/contexts/SystemContext';
import { getGlossaryEntry } from '@/lib/terminology';

interface GlossaryTooltipProps {
  glossaryKey: string;
  className?: string;
  size?: 'sm' | 'md';
}

export function GlossaryTooltip({ glossaryKey, className = '', size = 'sm' }: GlossaryTooltipProps) {
  const { viewMode } = useSystem();
  const entry = getGlossaryEntry(glossaryKey, viewMode);

  if (!entry) return null;

  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <button 
          type="button" 
          className={`inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors ${className}`}
        >
          <HelpCircle className={iconSize} />
        </button>
      </TooltipTrigger>
      <TooltipContent 
        side="top" 
        align="start"
        className="max-w-xs p-3 bg-popover border border-border shadow-lg"
      >
        <div className="space-y-1.5">
          <p className="font-medium text-sm text-foreground">{entry.term}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{entry.definition}</p>
          {entry.example && (
            <p className="text-xs text-muted-foreground/70 italic">
              Example: {entry.example}
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// Quick inline term with tooltip
interface InlineTermProps {
  glossaryKey: string;
  children: React.ReactNode;
  className?: string;
}

export function InlineTerm({ glossaryKey, children, className = '' }: InlineTermProps) {
  const { viewMode } = useSystem();
  const entry = getGlossaryEntry(glossaryKey, viewMode);

  if (!entry) return <span className={className}>{children}</span>;

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <span className={`underline decoration-dotted decoration-muted-foreground/50 cursor-help ${className}`}>
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent 
        side="top" 
        className="max-w-xs p-3 bg-popover border border-border shadow-lg"
      >
        <div className="space-y-1.5">
          <p className="font-medium text-sm text-foreground">{entry.term}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{entry.definition}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
