import { useState, useMemo, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useSystem } from '@/contexts/SystemContext';
import type { StaffMember, SkillpackRef } from '@/contracts/ecosystem';
import {
  getSkillpackPrompts,
  estimateTokens,
  contentHash,
  type PromptBlock,
} from '@/ecosystem/snapshot/promptRegistry';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import {
  FileText,
  Layers,
  Save,
  Check,
  Hash,
  Package,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface SkillpackPromptsTabProps {
  member: StaffMember;
  skillpack: SkillpackRef | null;
}

export function SkillpackPromptsTab({ member, skillpack }: SkillpackPromptsTabProps) {
  const { viewMode } = useSystem();
  const isOperator = viewMode === 'operator';

  const skillpackId = member.default_skillpack_id;
  const prompts = useMemo(
    () => (skillpackId ? getSkillpackPrompts(skillpackId) : []),
    [skillpackId]
  );

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(
    prompts.length > 0 ? prompts[0].id : null
  );
  const [savedIndicator, setSavedIndicator] = useState(false);

  // Reset on staff change
  useEffect(() => {
    const newPrompts = skillpackId ? getSkillpackPrompts(skillpackId) : [];
    setSelectedBlockId(newPrompts.length > 0 ? newPrompts[0].id : null);
    setDrafts({});
  }, [skillpackId]);

  const selectedBlock = prompts.find(b => b.id === selectedBlockId);

  const getBlockContent = (block: PromptBlock) => drafts[block.id] ?? block.content;

  const handleSaveDraft = () => {
    setSavedIndicator(true);
    setTimeout(() => setSavedIndicator(false), 2000);
  };

  // No skillpack assigned
  if (!skillpackId || !skillpack) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <div className={cn(
            'h-14 w-14 rounded-2xl mx-auto mb-4',
            'bg-muted flex items-center justify-center'
          )}>
            <Package className="h-7 w-7 text-muted-foreground/40" />
          </div>
          <h3 className="text-sm font-semibold text-foreground mb-1">
            {isOperator ? 'No Skill Set Assigned' : 'No skillpack linked'}
          </h3>
          <p className="text-xs text-muted-foreground">
            {isOperator
              ? `${member.name} doesn't have a skill set yet. Assign one in the Overview tab.`
              : `${member.staff_id} has no default_skillpack_id set.`}
          </p>
        </div>
      </div>
    );
  }

  // No prompts for this skillpack
  if (prompts.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <div className={cn(
            'h-14 w-14 rounded-2xl mx-auto mb-4',
            'bg-primary/10 flex items-center justify-center'
          )}>
            <FileText className="h-7 w-7 text-primary/40" />
          </div>
          <h3 className="text-sm font-semibold text-foreground mb-1">
            No Prompts Found
          </h3>
          <p className="text-xs text-muted-foreground">
            {isOperator
              ? `The ${skillpack.name} skill set doesn't have custom prompts yet.`
              : `No entries in skillpack_prompts["${skillpackId}"]`}
          </p>
        </div>
      </div>
    );
  }

  // ─── Operator: Read-only summary ───
  if (isOperator) {
    return (
      <div className="p-6 xl:p-8 space-y-4 max-w-4xl mx-auto">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-foreground">
            {skillpack.name} — Operational Prompts
          </h3>
          <p className="text-sm text-muted-foreground">
            Templates and rules specific to {member.name}'s skill set.
          </p>
        </div>

        <div className="space-y-3">
          {prompts.map(block => (
            <Card key={block.id} className="p-4 bg-card border-border">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{block.name}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">
                {getBlockContent(block).split('\n').filter(l => l.trim()).slice(0, 4).join(' ')}
              </p>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // ─── Engineer: 2-pane editor ───
  return (
    <div className="h-full flex">
      {/* Left: Prompt list */}
      <div className="w-[240px] xl:w-[260px] shrink-0 border-r border-border bg-surface-1">
        <div className="px-3 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Package className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
              {skillpackId}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {prompts.length} prompt files
          </p>
        </div>
        <ScrollArea className="h-[calc(100%-52px)]">
          <div className="p-1.5 space-y-0.5">
            {prompts.map((block, idx) => {
              const isSelected = selectedBlockId === block.id;
              const isDirty = drafts[block.id] !== undefined;

              return (
                <button
                  key={block.id}
                  onClick={() => setSelectedBlockId(block.id)}
                  className={cn(
                    'w-full text-left rounded-lg p-2.5 transition-all duration-150',
                    'focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50',
                    isSelected
                      ? 'bg-primary/[0.08] border border-primary/30'
                      : 'border border-transparent hover:bg-accent/30'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-xs font-medium text-foreground truncate flex-1">
                      {block.name}
                    </span>
                    {isDirty && (
                      <div className="h-1.5 w-1.5 rounded-full bg-warning shrink-0" />
                    )}
                  </div>
                  {block.file_path && (
                    <p className="text-[9px] text-muted-foreground/60 truncate font-mono mt-1 ml-5">
                      {block.file_path.split('/').pop()}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Right: Editor */}
      <div className="flex-1 min-w-0 flex flex-col bg-background">
        {selectedBlock ? (
          <>
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">{selectedBlock.name}</h3>
                {selectedBlock.file_path && (
                  <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                    {selectedBlock.file_path}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <FileText className="h-3 w-3" />
                  <span>~{estimateTokens(getBlockContent(selectedBlock)).toLocaleString()} tok</span>
                  <Hash className="h-3 w-3 ml-1" />
                  <span className="font-mono">{contentHash(getBlockContent(selectedBlock))}</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1.5"
                  onClick={handleSaveDraft}
                  disabled={!drafts[selectedBlock.id]}
                >
                  {savedIndicator ? <Check className="h-3 w-3" /> : <Save className="h-3 w-3" />}
                  {savedIndicator ? 'Saved' : 'Save Draft'}
                </Button>
              </div>
            </div>
            <div className="flex-1 p-4">
              <Textarea
                value={getBlockContent(selectedBlock)}
                onChange={(e) =>
                  setDrafts(prev => ({ ...prev, [selectedBlock.id]: e.target.value }))
                }
                className={cn(
                  'h-full w-full resize-none font-mono text-xs',
                  'bg-surface-1 border-border',
                  'focus-visible:ring-primary/30',
                  'leading-relaxed'
                )}
              />
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Select a prompt to edit</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
