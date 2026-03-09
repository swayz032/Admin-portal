/**
 * ChatMessage — AI Elements quality message renderer.
 *
 * User: clean bubble. Ava: markdown + chain of thought + shimmer + sources.
 * Council, robot results, patch diffs render inline.
 */

import { cn } from '@/lib/utils';
import { formatTimeAgo } from '@/lib/formatters';
import { Bot, User, AlertTriangle, FileCode, Sparkles } from 'lucide-react';
import type { ChatMessage as ChatMessageType } from '@/contexts/AdminAvaChatContext';
import { useAdminAvaChat } from '@/contexts/AdminAvaChatContext';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ChainOfThought, type ThoughtStep } from './ChainOfThought';
import { Shimmer, ShimmerBlock } from './Shimmer';
import { CouncilPanel } from './CouncilPanel';
import { RobotResultsCard } from './RobotResultsCard';
import { RobotStatusTracker } from './RobotStatusTracker';
import { PatchDiffCard } from './PatchDiffCard';
import { ReleasePipeline } from './ReleasePipeline';
import { IncidentAggregator } from './IncidentAggregator';

interface ChatMessageProps {
  message: ChatMessageType;
}

/** Convert tool calls from SSE into ChainOfThought steps */
function toolCallsToSteps(toolCalls?: ChatMessageType['meta']['toolCalls']): ThoughtStep[] {
  if (!toolCalls) return [];
  return toolCalls.map((tc) => ({
    id: tc.name,
    type: tc.name.includes('search') ? 'search' as const
      : tc.name.includes('analy') ? 'analysis' as const
      : 'tool_call' as const,
    label: tc.name,
    status: tc.status === 'running' ? 'running' as const
      : tc.status === 'done' ? 'done' as const
      : 'error' as const,
  }));
}

export function ChatMessage({ message }: ChatMessageProps) {
  const { sendMessage } = useAdminAvaChat();
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isThinking = message.type === 'thinking';
  const isError = message.type === 'error';

  // ── User message ──────────────────────────────────────────────────
  if (isUser) {
    return (
      <div className="flex justify-end animate-slide-up">
        <div className="max-w-[75%] flex items-start gap-2.5 flex-row-reverse">
          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center">
            <User className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <div className="rounded-2xl rounded-br-md bg-primary text-primary-foreground px-4 py-2.5 text-sm leading-relaxed">
              {message.content}
            </div>
            <div className="text-[10px] text-text-tertiary mt-1 text-right">
              {formatTimeAgo(message.timestamp)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── System message ────────────────────────────────────────────────
  if (isSystem) {
    return (
      <div className="flex justify-center animate-slide-up">
        <div className="flex items-center gap-2 text-xs text-text-tertiary bg-surface-2/50 px-3 py-1.5 rounded-full border border-border/30">
          <Sparkles className="w-3 h-3" />
          <span>{message.content}</span>
        </div>
      </div>
    );
  }

  // ── Thinking / Streaming ──────────────────────────────────────────
  if (isThinking) {
    const steps = toolCallsToSteps(message.meta?.toolCalls);

    return (
      <div className="flex items-start gap-2.5 animate-slide-up">
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
          <Bot className="w-3.5 h-3.5 text-primary" />
        </div>
        <div className="flex-1 max-w-[85%] space-y-2">
          <div className="text-[10px] font-medium text-text-tertiary">Ava</div>

          {/* Chain of thought steps */}
          {steps.length > 0 && (
            <ChainOfThought steps={steps} isExpanded />
          )}

          {/* Shimmer loading */}
          <div className="rounded-2xl rounded-bl-md bg-card border border-border/50 px-4 py-3">
            <Shimmer active>
              <span className="text-sm text-text-secondary">{message.content}</span>
            </Shimmer>
            <div className="mt-2">
              <ShimmerBlock lines={2} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Error message ─────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="flex items-start gap-2.5 animate-slide-up">
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
        </div>
        <div className="flex-1 max-w-[85%]">
          <div className="rounded-2xl rounded-bl-md bg-destructive/5 border border-destructive/20 px-4 py-3">
            <p className="text-sm text-destructive leading-relaxed">{message.content}</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Ava response (main) ───────────────────────────────────────────
  return (
    <div className="flex items-start gap-2.5 animate-slide-up">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
        <Bot className="w-3.5 h-3.5 text-primary" />
      </div>
      <div className="flex-1 max-w-[85%] space-y-2">
        {/* Header */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-text-tertiary">Ava</span>
          <span className="text-[10px] text-text-tertiary/50">
            {formatTimeAgo(message.timestamp)}
          </span>
        </div>

        {/* Reasoning (collapsible chain of thought) */}
        {message.meta?.reasoning && (
          <ChainOfThought
            steps={[{
              id: 'reasoning',
              type: 'thinking',
              label: 'Internal reasoning',
              status: 'done',
              detail: message.meta.reasoning,
            }]}
          />
        )}

        {/* Main content — rich markdown */}
        <div className="rounded-2xl rounded-bl-md bg-card border border-border/50 px-4 py-3">
          <MarkdownRenderer content={message.content} />
        </div>

        {/* Sources chips */}
        {message.meta?.sources && message.meta.sources.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {message.meta.sources.map((source, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 text-[10px] bg-surface-2 text-text-secondary px-2 py-0.5 rounded-full border border-border/30"
              >
                {source}
              </span>
            ))}
          </div>
        )}

        {/* Council panel — Meeting of the Minds */}
        {message.meta?.councilSessionId && (
          <CouncilPanel sessionId={message.meta.councilSessionId} />
        )}

        {/* Robot results (summary card) */}
        {message.meta?.robotRunId && (
          <RobotResultsCard runId={message.meta.robotRunId} />
        )}

        {/* Robot live tracker (detailed progress while running) */}
        {message.meta?.robotRunId && message.type === 'robot' && (
          <RobotStatusTracker runId={message.meta.robotRunId} />
        )}

        {/* Codex patch diff */}
        {message.meta?.patchJobId && message.type === 'patch' && (
          <PatchDiffCard
            description={message.content}
            changes={message.meta?.patchChanges || []}
            impactedAreas={message.meta?.patchImpact || ''}
            testPlan={message.meta?.patchTestPlan || ''}
            onApprove={() => sendMessage(`Approve patch ${message.meta?.patchJobId}`)}
            onReject={() => sendMessage(`Reject patch ${message.meta?.patchJobId}`)}
            onIterate={() => sendMessage(`Iterate on patch ${message.meta?.patchJobId}`)}
          />
        )}

        {/* Release pipeline */}
        {message.meta?.pipelineGates && (
          <ReleasePipeline gates={message.meta.pipelineGates} />
        )}

        {/* Incident aggregation (when Ava surfaces unified incidents) */}
        {message.type === 'incidents' && (
          <IncidentAggregator />
        )}

        {/* Receipt reference */}
        {message.meta?.receiptId && (
          <div className="flex items-center gap-1.5 text-[10px] text-text-tertiary">
            <FileCode className="w-3 h-3" />
            <span>Receipt:</span>
            <code className="text-primary/70 font-mono">{message.meta.receiptId.slice(0, 12)}...</code>
          </div>
        )}
      </div>
    </div>
  );
}
