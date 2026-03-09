/**
 * Individual advisor card within Meeting of the Minds panel.
 * Shows: model icon, role label, proposal text, confidence badge.
 * Animated "thinking" state when advisor hasn't proposed yet.
 */

import { cn } from '@/lib/utils';
import { Loader2, Brain, Sparkles, Cpu } from 'lucide-react';
import type { AdvisorProposal } from '@/hooks/useCouncilSession';

interface AdvisorCardProps {
  advisor: AdvisorProposal;
}

const modelIcons: Record<string, typeof Brain> = {
  'gpt-5.2': Brain,
  'gemini-3.1': Sparkles,
  'sonnet-4.6': Cpu,
};

const modelColors: Record<string, string> = {
  'gpt-5.2': 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  'gemini-3.1': 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  'sonnet-4.6': 'text-purple-400 bg-purple-500/10 border-purple-500/20',
};

function confidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'text-green-400 bg-green-500/10';
  if (confidence >= 0.5) return 'text-amber-400 bg-amber-500/10';
  return 'text-red-400 bg-red-500/10';
}

export function AdvisorCard({ advisor }: AdvisorCardProps) {
  const Icon = modelIcons[advisor.model] || Brain;
  const colorClass = modelColors[advisor.model] || 'text-muted-foreground bg-muted border-border';
  const isThinking = advisor.status === 'thinking';

  return (
    <div
      className={cn(
        'rounded-lg border p-3 space-y-2 transition-all',
        colorClass,
        isThinking && 'animate-pulse',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" />
          <span className="text-xs font-semibold uppercase tracking-wide">{advisor.role}</span>
        </div>
        <span className="text-[10px] text-muted-foreground">{advisor.model}</span>
      </div>

      {/* Proposal */}
      {isThinking ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" />
          Deliberating...
        </div>
      ) : (
        <>
          <p className="text-xs leading-relaxed whitespace-pre-wrap">{advisor.proposal}</p>
          <div className="flex items-center justify-between">
            <span
              className={cn(
                'text-[10px] px-2 py-0.5 rounded-full font-medium',
                confidenceColor(advisor.confidence),
              )}
            >
              {Math.round(advisor.confidence * 100)}% confidence
            </span>
            {advisor.status === 'critiqued' && (
              <span className="text-[10px] text-muted-foreground">Critiqued</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
