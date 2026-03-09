/**
 * Council decision timeline — visual sequence of council phases.
 * Evidence -> Deliberating -> Proposals -> Adjudicating -> Decision
 */

import { cn } from '@/lib/utils';
import { CheckCircle, Loader2, Circle } from 'lucide-react';
import type { CouncilStatus } from '@/hooks/useCouncilSession';

interface CouncilTimelineProps {
  status: CouncilStatus;
}

interface TimelineStep {
  id: string;
  label: string;
  activeOn: CouncilStatus[];
  doneOn: CouncilStatus[];
}

const steps: TimelineStep[] = [
  { id: 'evidence', label: 'Evidence', activeOn: ['deliberating'], doneOn: ['proposed', 'adjudicating', 'decided'] },
  { id: 'deliberating', label: 'Deliberating', activeOn: ['deliberating'], doneOn: ['proposed', 'adjudicating', 'decided'] },
  { id: 'proposals', label: 'Proposals', activeOn: ['proposed'], doneOn: ['adjudicating', 'decided'] },
  { id: 'adjudicating', label: 'Adjudicating', activeOn: ['adjudicating'], doneOn: ['decided'] },
  { id: 'decision', label: 'Decision', activeOn: ['decided'], doneOn: [] },
];

export function CouncilTimeline({ status }: CouncilTimelineProps) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {steps.map((step, i) => {
        const isDone = step.doneOn.includes(status);
        const isActive = step.activeOn.includes(status);
        const isPending = !isDone && !isActive;

        return (
          <div key={step.id} className="flex items-center">
            {i > 0 && (
              <div
                className={cn(
                  'w-6 h-px mx-0.5',
                  isDone ? 'bg-green-500/50' : isActive ? 'bg-purple-500/50' : 'bg-border',
                )}
              />
            )}
            <div
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium whitespace-nowrap',
                isDone && 'bg-green-500/10 text-green-400',
                isActive && 'bg-purple-500/10 text-purple-400',
                isPending && 'bg-muted text-muted-foreground',
              )}
            >
              {isDone ? (
                <CheckCircle className="w-3 h-3" />
              ) : isActive ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Circle className="w-3 h-3" />
              )}
              {step.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
