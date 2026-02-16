import { useState, useMemo, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useSystem } from '@/contexts/SystemContext';
import type { StaffMember } from '@/contracts/ecosystem';
import {
  promptRegistry,
  compileSystemPrompt,
  estimateTokens,
  contentHash,
  getOrderedBlocks,
  type PromptBlock,
} from '@/ecosystem/snapshot/promptRegistry';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import {
  FileText,
  Globe,
  User,
  Save,
  Copy,
  Check,
  Hash,
  Layers,
  Eye,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface PromptTabProps {
  member: StaffMember;
}

const scopeConfig = {
  shared: { label: 'Shared', icon: Globe, color: 'bg-primary/10 text-primary border-primary/20' },
  agent: { label: 'Agent', icon: User, color: 'bg-warning/10 text-warning border-warning/20' },
  skillpack: { label: 'Skillpack', icon: Layers, color: 'bg-success/10 text-success border-success/20' },
};

export function PromptTab({ member }: PromptTabProps) {
  const { viewMode } = useSystem();
  const isOperator = viewMode === 'operator';

  const orderedBlocks = useMemo(() => getOrderedBlocks(member.staff_id), [member.staff_id]);

  // Local draft state for editing
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(
    orderedBlocks.length > 0 ? orderedBlocks[0].id : null
  );
  const [savedIndicator, setSavedIndicator] = useState(false);
  const [copied, setCopied] = useState(false);
  const [compiledExpanded, setCompiledExpanded] = useState(!isOperator);

  // Reset selection when staff changes
  useEffect(() => {
    const blocks = getOrderedBlocks(member.staff_id);
    setSelectedBlockId(blocks.length > 0 ? blocks[0].id : null);
    setDrafts({});
  }, [member.staff_id]);

  const selectedBlock = orderedBlocks.find(b => b.id === selectedBlockId);

  const getBlockContent = (block: PromptBlock) => {
    return drafts[block.id] ?? block.content;
  };

  const compiledPrompt = useMemo(() => {
    // Use drafts where available, else original content
    const sharedContent = promptRegistry.shared_blocks
      .map(b => drafts[b.id] ?? b.content)
      .join('\n\n---\n\n');
    const overlays = promptRegistry.agent_overlays[member.staff_id] || [];
    const overlayContent = overlays
      .map(b => drafts[b.id] ?? b.content)
      .join('\n\n---\n\n');

    if (!overlayContent) return sharedContent;
    return `${sharedContent}\n\n===== AGENT-SPECIFIC =====\n\n${overlayContent}`;
  }, [member.staff_id, drafts]);

  const tokens = estimateTokens(compiledPrompt);
  const hash = contentHash(compiledPrompt);
  const hasDrafts = Object.keys(drafts).length > 0;

  const handleSaveDraft = () => {
    setSavedIndicator(true);
    setTimeout(() => setSavedIndicator(false), 2000);
  };

  const handleCopyCompiled = () => {
    navigator.clipboard.writeText(compiledPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ─── Operator Mode: Read-only behavior summary ───
  if (isOperator) {
    return (
      <div className="p-6 xl:p-8 space-y-6 max-w-4xl mx-auto">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">Behavior Summary</h3>
          <p className="text-sm text-muted-foreground">
            How {member.name} is configured to behave and communicate.
          </p>
        </div>

        {/* Summary cards for each block */}
        <div className="space-y-3">
          {orderedBlocks.map(block => {
            const scope = scopeConfig[block.scope];
            const ScopeIcon = scope.icon;
            return (
              <Card key={block.id} className="p-4 bg-card border-border">
                <div className="flex items-center gap-2 mb-2">
                  <ScopeIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">{block.name}</span>
                  <Badge variant="outline" className={cn('text-[10px] ml-auto', scope.color)}>
                    {scope.label}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                  {getBlockContent(block).split('\n').filter(l => l.trim()).slice(0, 3).join(' ')}
                </p>
              </Card>
            );
          })}
        </div>

        {/* Compiled prompt (collapsed by default) */}
        <div className="border border-border rounded-xl overflow-hidden">
          <button
            onClick={() => setCompiledExpanded(!compiledExpanded)}
            className="w-full flex items-center justify-between p-4 bg-surface-1 hover:bg-surface-2 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">View Full Instructions</span>
            </div>
            {compiledExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          {compiledExpanded && (
            <div className="p-4 bg-surface-1/50 border-t border-border">
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed max-h-[400px] overflow-auto">
                {compiledPrompt}
              </pre>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Engineer Mode: Full 3-pane editing ───
  return (
    <div className="h-full flex">
      {/* Left: Block list */}
      <div className="w-[240px] xl:w-[260px] shrink-0 border-r border-border bg-surface-1">
        <div className="px-3 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Layers className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Prompt Blocks
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {orderedBlocks.length} blocks • compiled in order
          </p>
        </div>
        <ScrollArea className="h-[calc(100%-52px)]">
          <div className="p-1.5 space-y-0.5">
            {orderedBlocks.map((block, idx) => {
              const scope = scopeConfig[block.scope];
              const ScopeIcon = scope.icon;
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
                    <span className="text-[10px] font-mono text-muted-foreground w-4">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <ScopeIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-xs font-medium text-foreground truncate flex-1">
                      {block.name}
                    </span>
                    {isDirty && (
                      <div className="h-1.5 w-1.5 rounded-full bg-warning shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 ml-6">
                    <Badge variant="outline" className={cn('text-[9px] px-1 h-3.5', scope.color)}>
                      {scope.label}
                    </Badge>
                    {block.file_path && (
                      <span className="text-[9px] text-muted-foreground/60 truncate font-mono">
                        {block.file_path.split('/').pop()}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Center: Editor */}
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
              <div className="flex items-center gap-2">
                {drafts[selectedBlock.id] !== undefined && (
                  <Badge className="bg-warning/10 text-warning border-warning/20 text-[10px]">
                    unsaved
                  </Badge>
                )}
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
                placeholder="Enter prompt block content..."
              />
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Select a block to edit</p>
            </div>
          </div>
        )}
      </div>

      {/* Right: Compiled Preview */}
      <div className="w-[300px] xl:w-[340px] shrink-0 border-l border-border bg-surface-1 flex flex-col">
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Compiled Prompt
              </span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[10px] gap-1 px-2"
              onClick={handleCopyCompiled}
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-1">
              <FileText className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">
                ~{tokens.toLocaleString()} tokens
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Hash className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] font-mono text-muted-foreground">
                {hash}
              </span>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4">
            <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">
              {compiledPrompt}
            </pre>
          </div>
        </ScrollArea>

        {hasDrafts && (
          <div className="px-4 py-3 border-t border-border bg-warning/5">
            <p className="text-[10px] text-warning font-medium">
              ● Unsaved changes — compiled preview reflects drafts
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
