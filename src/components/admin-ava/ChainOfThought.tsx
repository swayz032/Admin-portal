/**
 * ChainOfThought — collapsible reasoning steps visualization.
 * Shows AI thinking process: search queries, tool calls, intermediate results.
 * Matches AI Elements Chain of Thought component pattern.
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  Search,
  Loader2,
  CheckCircle2,
  XCircle,
  Brain,
  Wrench,
  Globe,
  Database,
  FileSearch,
  Sparkles,
} from 'lucide-react';

export interface ThoughtStep {
  id: string;
  type: 'search' | 'tool_call' | 'analysis' | 'result' | 'thinking';
  label: string;
  status: 'running' | 'done' | 'error';
  detail?: string;
  sources?: string[];
}

interface ChainOfThoughtProps {
  steps: ThoughtStep[];
  isExpanded?: boolean;
  className?: string;
}

const typeIcons: Record<ThoughtStep['type'], React.ElementType> = {
  search: Search,
  tool_call: Wrench,
  analysis: Brain,
  result: Sparkles,
  thinking: Brain,
};

const typeLabels: Record<ThoughtStep['type'], string> = {
  search: 'Searching',
  tool_call: 'Using tool',
  analysis: 'Analyzing',
  result: 'Result',
  thinking: 'Thinking',
};

function StepIcon({ type, status }: { type: ThoughtStep['type']; status: ThoughtStep['status'] }) {
  if (status === 'running') {
    return <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />;
  }
  if (status === 'error') {
    return <XCircle className="w-3.5 h-3.5 text-destructive" />;
  }
  const Icon = typeIcons[type];
  return <Icon className="w-3.5 h-3.5 text-primary/70" />;
}

function SourceChip({ source }: { source: string }) {
  // Detect if it's a URL-like source
  const isUrl = source.startsWith('http') || source.includes('.');
  const Icon = isUrl ? Globe : source.includes('db') || source.includes('table') ? Database : FileSearch;
  const label = isUrl ? new URL(source.startsWith('http') ? source : `https://${source}`).hostname : source;

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-surface-2 text-text-secondary border border-border/50">
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

export function ChainOfThought({ steps, isExpanded: defaultExpanded = false, className }: ChainOfThoughtProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (steps.length === 0) return null;

  const runningCount = steps.filter(s => s.status === 'running').length;
  const doneCount = steps.filter(s => s.status === 'done').length;
  const isActive = runningCount > 0;

  return (
    <div className={cn('rounded-xl border border-border/50 overflow-hidden', className)}>
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors',
          'hover:bg-surface-2/50',
          isActive ? 'text-primary' : 'text-text-secondary',
        )}
      >
        {isActive ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <CheckCircle2 className="w-3.5 h-3.5 text-primary/60" />
        )}
        <span className="font-medium">
          {isActive
            ? `Reasoning... (${doneCount}/${steps.length} steps)`
            : `Chain of Thought`}
        </span>
        <span className="text-text-tertiary ml-auto">
          {doneCount}/{steps.length} steps
        </span>
        <ChevronDown
          className={cn(
            'w-3.5 h-3.5 transition-transform duration-200',
            expanded && 'rotate-180',
          )}
        />
      </button>

      {/* Steps — collapsible */}
      {expanded && (
        <div className="border-t border-border/30">
          {steps.map((step, i) => (
            <div
              key={step.id}
              className={cn(
                'flex items-start gap-2.5 px-3 py-2 text-xs',
                i < steps.length - 1 && 'border-b border-border/20',
                step.status === 'running' && 'bg-primary/5',
              )}
            >
              {/* Step connector line */}
              <div className="flex flex-col items-center pt-0.5">
                <StepIcon type={step.type} status={step.status} />
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                {/* Step label */}
                <div className="flex items-center gap-1.5">
                  <span className="text-text-tertiary">{typeLabels[step.type]}</span>
                  <span className={cn(
                    'font-medium',
                    step.status === 'running' ? 'text-foreground' : 'text-text-secondary',
                  )}>
                    {step.label}
                  </span>
                </div>

                {/* Detail text */}
                {step.detail && (
                  <p className="text-text-tertiary leading-relaxed">{step.detail}</p>
                )}

                {/* Source chips */}
                {step.sources && step.sources.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {step.sources.map((src, j) => (
                      <SourceChip key={j} source={src} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
