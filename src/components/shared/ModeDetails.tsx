import { useState, useEffect, ReactNode } from 'react';
import { useSystem } from '@/contexts/SystemContext';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModeDetailsProps {
  /** Always visible summary content */
  summary: ReactNode;
  /** Expandable details content */
  details: ReactNode;
  /** Override default open state (Operator: false, Engineer: true) */
  defaultOpen?: boolean;
  /** Optional className for container */
  className?: string;
  /** Label for expand/collapse button */
  expandLabel?: string;
  collapseLabel?: string;
}

/**
 * Wraps content with expandable details.
 * - Operator mode: collapsed by default
 * - Engineer mode: expanded by default
 */
export function ModeDetails({ 
  summary, 
  details, 
  defaultOpen,
  className,
  expandLabel = "Show details",
  collapseLabel = "Hide details"
}: ModeDetailsProps) {
  const { viewMode } = useSystem();
  
  // Determine initial open state based on mode
  const getDefaultOpen = () => {
    if (defaultOpen !== undefined) return defaultOpen;
    return viewMode === 'engineer';
  };
  
  const [isOpen, setIsOpen] = useState(getDefaultOpen);
  
  // Update open state when viewMode changes
  useEffect(() => {
    if (defaultOpen === undefined) {
      setIsOpen(viewMode === 'engineer');
    }
  }, [viewMode, defaultOpen]);
  
  return (
    <div className={cn("space-y-2", className)}>
      {/* Summary - always visible */}
      <div>{summary}</div>
      
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
      >
        {isOpen ? (
          <>
            <ChevronUp className="h-3 w-3" />
            {collapseLabel}
          </>
        ) : (
          <>
            <ChevronDown className="h-3 w-3" />
            {expandLabel}
          </>
        )}
      </button>
      
      {/* Details - conditionally shown */}
      {isOpen && (
        <div className="pt-2 border-t border-border/50">
          {details}
        </div>
      )}
    </div>
  );
}
