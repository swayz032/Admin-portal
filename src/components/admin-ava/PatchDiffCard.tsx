/**
 * Renders a Codex-generated patch as a diff card in chat.
 * Actions: approve, reject, iterate.
 */

import { Button } from '@/components/ui/button';
import { Check, X, RotateCcw, FileCode } from 'lucide-react';

interface PatchDiffCardProps {
  description: string;
  changes: string[];
  impactedAreas: string;
  testPlan: string;
  onApprove?: () => void;
  onReject?: () => void;
  onIterate?: () => void;
}

export function PatchDiffCard({
  description,
  changes,
  impactedAreas,
  testPlan,
  onApprove,
  onReject,
  onIterate,
}: PatchDiffCardProps) {
  return (
    <div className="rounded-xl border border-blue-500/20 bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-blue-500/10 bg-blue-500/5">
        <FileCode className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-semibold">Codex Patch</span>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        <p className="text-sm">{description}</p>

        {/* Changes */}
        <div className="rounded-md bg-muted/50 border border-border p-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Changes</p>
          <ul className="space-y-1">
            {changes.map((change, i) => (
              <li key={i} className="text-xs flex items-start gap-2">
                <span className="text-green-400 font-mono mt-0.5">+</span>
                <span>{change}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Impact */}
        <div className="flex gap-4 text-xs text-muted-foreground">
          <div>
            <span className="font-medium">Impact: </span>
            {impactedAreas}
          </div>
          <div>
            <span className="font-medium">Test plan: </span>
            {testPlan}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-border bg-muted/30">
        <Button size="sm" variant="outline" onClick={onApprove} className="gap-1 text-green-400 hover:bg-green-500/10">
          <Check className="w-3 h-3" /> Approve
        </Button>
        <Button size="sm" variant="outline" onClick={onReject} className="gap-1 text-destructive hover:bg-destructive/10">
          <X className="w-3 h-3" /> Reject
        </Button>
        <Button size="sm" variant="outline" onClick={onIterate} className="gap-1">
          <RotateCcw className="w-3 h-3" /> Iterate
        </Button>
      </div>
    </div>
  );
}
