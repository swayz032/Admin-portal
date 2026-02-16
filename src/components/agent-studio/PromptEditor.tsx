import { useState, useMemo, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useSystem } from '@/contexts/SystemContext';
import type { StaffMember } from '@/contracts/ecosystem';
import {
  promptRegistry,
  estimateTokens,
  getOrderedBlocks,
} from '@/ecosystem/snapshot/promptRegistry';


const MAX_TOKENS = 120000;

interface PromptEditorProps {
  member: StaffMember;
}

export function PromptEditor({ member }: PromptEditorProps) {
  const { viewMode } = useSystem();
  const isOperator = viewMode === 'operator';

  const orderedBlocks = useMemo(
    () => getOrderedBlocks(member.staff_id),
    [member.staff_id]
  );

  // Compile all blocks into a single prompt string
  const defaultPrompt = useMemo(() => {
    return orderedBlocks.map(b => b.content).join('\n\n');
  }, [orderedBlocks]);

  const [draft, setDraft] = useState(defaultPrompt);

  // Reset when staff changes
  useEffect(() => {
    const blocks = getOrderedBlocks(member.staff_id);
    setDraft(blocks.map(b => b.content).join('\n\n'));
  }, [member.staff_id]);

  const tokens = estimateTokens(draft);
  const hasPrompt = draft.trim().length > 0;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-6 pt-6 pb-4">
        <h3 className="text-base font-semibold text-foreground">
          {isOperator ? 'Behavior Instructions' : 'System prompt'}
        </h3>
        {!hasPrompt && (
          <p className="text-sm text-muted-foreground mt-1">
            No prompt configured yet. Add instructions to define how {member.name} behaves.
          </p>
        )}
      </div>

      {/* Editor area — invisible premium scroll */}
      <div className="flex-1 min-h-0 px-6 pb-2 overflow-hidden">
        {isOperator ? (
          <div className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-border/40 scrollbar-track-transparent hover:scrollbar-thumb-border/60 transition-colors">
            {hasPrompt ? (
              <div className="pr-4">
                <pre className={cn(
                  'text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed',
                  'font-sans'
                )}>
                  {draft}
                </pre>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-muted-foreground">
                  No behavior instructions defined
                </p>
              </div>
            )}
          </div>
        ) : (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Enter system prompt for ${member.name}...`}
            className={cn(
              'w-full h-full resize-none rounded-xl p-4',
              'bg-surface-1 border border-border',
              'text-sm text-foreground leading-relaxed',
              'placeholder:text-muted-foreground/50',
              'focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/30',
              'transition-colors',
              'scrollbar-thin scrollbar-thumb-border/40 scrollbar-track-transparent hover:scrollbar-thumb-border/60'
            )}
          />
        )}
      </div>

      {/* Footer — token count */}
      <div className="shrink-0 px-6 py-3 flex items-center justify-end border-t border-border/50">
        <span className="text-xs text-muted-foreground tabular-nums">
          {tokens.toLocaleString()} / {MAX_TOKENS.toLocaleString()} Tokens
        </span>
      </div>
    </div>
  );
}
