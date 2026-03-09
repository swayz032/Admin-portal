/**
 * Meeting of the Minds panel — renders inline in chat when Ava dispatches a council.
 * Shows 3 advisor slots, timeline, and Ava's adjudication.
 */

import { useCouncilSession } from '@/hooks/useCouncilSession';
import { AdvisorCard } from './AdvisorCard';
import { CouncilTimeline } from './CouncilTimeline';
import { Brain, CheckCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CouncilPanelProps {
  sessionId: string;
}

export function CouncilPanel({ sessionId }: CouncilPanelProps) {
  const { session, loading, error } = useCouncilSession(sessionId);

  if (loading && !session) {
    return (
      <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading council session...
        </div>
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
        Council session unavailable: {error}
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="rounded-xl border border-purple-500/20 bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-purple-500/10 bg-purple-500/5">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-semibold">Meeting of the Minds</span>
        </div>
        <span className={cn(
          'text-xs px-2 py-0.5 rounded-full font-medium',
          session.status === 'decided' ? 'bg-green-500/10 text-green-400' :
          session.status === 'error' ? 'bg-destructive/10 text-destructive' :
          'bg-purple-500/10 text-purple-400',
        )}>
          {session.status}
        </span>
      </div>

      {/* Timeline */}
      <div className="px-4 py-2 border-b border-border/50">
        <CouncilTimeline status={session.status} />
      </div>

      {/* Advisor grid */}
      <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        {session.advisors.map((advisor) => (
          <AdvisorCard key={advisor.model} advisor={advisor} />
        ))}
      </div>

      {/* Adjudication */}
      {session.adjudication && (
        <div className="mx-4 mb-4 rounded-lg border border-green-500/20 bg-green-500/5 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span className="text-xs font-semibold text-green-400 uppercase tracking-wide">
              Ava's Decision
            </span>
            {session.adjudication.selectedAdvisor && (
              <span className="text-[10px] text-muted-foreground">
                (aligned with {session.adjudication.selectedAdvisor})
              </span>
            )}
          </div>
          <p className="text-sm leading-relaxed">{session.adjudication.decision}</p>
          {session.adjudication.reasoning && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer hover:text-foreground">Show reasoning</summary>
              <p className="mt-1 pl-3 border-l-2 border-green-500/20 whitespace-pre-wrap">
                {session.adjudication.reasoning}
              </p>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
