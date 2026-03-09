/**
 * Release pipeline tracker — horizontal: staging → canary → production.
 * Each gate shows robot status + approval requirement.
 */

import { cn } from '@/lib/utils';
import { CheckCircle, Loader2, Circle, Shield, ArrowRight } from 'lucide-react';

export type GateStatus = 'pending' | 'running' | 'passed' | 'failed' | 'awaiting_approval';

export interface PipelineGate {
  id: string;
  name: string;
  environment: string;
  status: GateStatus;
  robotRunId?: string;
  requiresApproval: boolean;
}

interface ReleasePipelineProps {
  gates: PipelineGate[];
}

const gateDefaults: PipelineGate[] = [
  { id: 'staging', name: 'Staging', environment: 'staging', status: 'pending', requiresApproval: false },
  { id: 'canary', name: 'Canary', environment: 'canary', status: 'pending', requiresApproval: true },
  { id: 'production', name: 'Production', environment: 'production', status: 'pending', requiresApproval: true },
];

function StatusIcon({ status }: { status: GateStatus }) {
  switch (status) {
    case 'passed': return <CheckCircle className="w-4 h-4 text-green-400" />;
    case 'running': return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
    case 'failed': return <Circle className="w-4 h-4 text-destructive" />;
    case 'awaiting_approval': return <Shield className="w-4 h-4 text-amber-400" />;
    default: return <Circle className="w-4 h-4 text-muted-foreground" />;
  }
}

export function ReleasePipeline({ gates = gateDefaults }: ReleasePipelineProps) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <span className="text-sm font-semibold">Release Pipeline</span>
      </div>
      <div className="flex items-center justify-center gap-2 p-4">
        {gates.map((gate, i) => (
          <div key={gate.id} className="flex items-center">
            {i > 0 && <ArrowRight className="w-4 h-4 text-muted-foreground mx-2" />}
            <div
              className={cn(
                'flex flex-col items-center gap-1 px-4 py-3 rounded-lg border min-w-[100px]',
                gate.status === 'passed' && 'border-green-500/30 bg-green-500/5',
                gate.status === 'running' && 'border-blue-500/30 bg-blue-500/5',
                gate.status === 'failed' && 'border-destructive/30 bg-destructive/5',
                gate.status === 'awaiting_approval' && 'border-amber-500/30 bg-amber-500/5',
                gate.status === 'pending' && 'border-border bg-muted/30',
              )}
            >
              <StatusIcon status={gate.status} />
              <span className="text-xs font-medium">{gate.name}</span>
              <span className="text-[10px] text-muted-foreground">{gate.environment}</span>
              {gate.requiresApproval && gate.status !== 'passed' && (
                <span className="text-[10px] text-amber-400 flex items-center gap-0.5">
                  <Shield className="w-2.5 h-2.5" /> Approval
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
