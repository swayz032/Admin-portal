/**
 * PatchDiffViewer — displays patch job lifecycle: phase, changes, impact, test plan, and test results.
 * Consumes usePatchJob hook backed by OpsDeskContext.
 */

import { usePatchJob, type PatchJobPhase } from '@/hooks/usePatchJob';
import { Panel } from '@/components/shared/Panel';
import { StatusChip } from '@/components/shared/StatusChip';
import { EmptyState } from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  FileCode2,
  TestTube2,
  AlertTriangle,
  Rocket,
  Timer,
  FileSearch,
  ArrowRight,
} from 'lucide-react';

interface PatchDiffViewerProps {
  /** patchJobId is accepted for route-level mounting but the hook reads from OpsDeskContext */
  patchJobId: string;
}

const PHASE_CONFIG: Record<PatchJobPhase, { chipStatus: 'success' | 'critical' | 'pending' | 'warning' | 'info' | 'neutral'; label: string; icon: typeof Loader2 }> = {
  idle: { chipStatus: 'neutral', label: 'Idle', icon: Clock },
  generating: { chipStatus: 'info', label: 'Generating', icon: Loader2 },
  review: { chipStatus: 'pending', label: 'In Review', icon: FileSearch },
  testing: { chipStatus: 'info', label: 'Testing', icon: TestTube2 },
  deploying: { chipStatus: 'warning', label: 'Deploying', icon: Rocket },
  deployed: { chipStatus: 'success', label: 'Deployed', icon: CheckCircle2 },
  failed: { chipStatus: 'critical', label: 'Failed', icon: XCircle },
};

const PHASE_ORDER: PatchJobPhase[] = ['generating', 'review', 'testing', 'deploying', 'deployed'];

const TEST_RESULT_ICON: Record<string, typeof CheckCircle2> = {
  pending: Clock,
  running: Play,
  passed: CheckCircle2,
  failed: XCircle,
};

const TEST_RESULT_COLOR: Record<string, string> = {
  pending: 'text-muted-foreground',
  running: 'text-primary animate-pulse',
  passed: 'text-success',
  failed: 'text-destructive',
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function PatchDiffViewer({ patchJobId }: PatchDiffViewerProps) {
  const patchJob = usePatchJob();

  // Idle state — no active patch job in context
  if (patchJob.phase === 'idle' || !patchJob.jobId) {
    return (
      <EmptyState
        variant="no-data"
        title="No active patch job"
        description={`Patch job ${patchJobId} is not currently active in the Ops Desk context. Navigate to the Ops Desk to initiate a patch.`}
        actionLabel="Go to Ops Desk"
        actionTo="/llm-ops-desk"
      />
    );
  }

  const phaseConfig = PHASE_CONFIG[patchJob.phase];
  const PhaseIcon = phaseConfig.icon;
  const isActive = patchJob.phase === 'generating' || patchJob.phase === 'testing' || patchJob.phase === 'deploying';
  const passedTests = patchJob.testResults.filter(t => t.status === 'passed').length;
  const failedTests = patchJob.testResults.filter(t => t.status === 'failed').length;

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <Panel
        title="Patch Job"
        action={<StatusChip status={phaseConfig.chipStatus} label={phaseConfig.label} size="md" />}
      >
        <div className="space-y-4">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Job ID</p>
              <p className="text-sm font-mono text-foreground truncate">{patchJob.jobId}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Phase</p>
              <div className="flex items-center gap-1.5 mt-1">
                <PhaseIcon className={cn('h-4 w-4', isActive && 'animate-spin text-primary')} />
                <span className="text-sm font-medium text-foreground capitalize">{patchJob.phase}</span>
              </div>
            </div>
          </div>

          {/* Phase Timeline */}
          <div className="flex items-center gap-1 overflow-x-auto py-2">
            {PHASE_ORDER.map((phase, index) => {
              const currentIndex = PHASE_ORDER.indexOf(patchJob.phase);
              const isCurrent = phase === patchJob.phase;
              const isComplete = currentIndex > index || patchJob.phase === 'deployed';
              const isFailed = patchJob.phase === 'failed' && index === currentIndex;

              return (
                <div key={phase} className="flex items-center">
                  {index > 0 && (
                    <ArrowRight className={cn(
                      'h-3.5 w-3.5 mx-1 flex-shrink-0',
                      isComplete ? 'text-success' : 'text-muted-foreground/30'
                    )} />
                  )}
                  <span className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                    isCurrent && !isFailed && 'bg-primary/20 text-primary',
                    isFailed && 'bg-destructive/20 text-destructive',
                    isComplete && !isCurrent && 'bg-success/20 text-success',
                    !isCurrent && !isComplete && !isFailed && 'bg-muted text-muted-foreground/50',
                  )}>
                    {phase}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Description */}
          {patchJob.description && (
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
              <p className="text-sm text-foreground">{patchJob.description}</p>
            </div>
          )}
        </div>
      </Panel>

      {/* Changes Panel (Diff) */}
      <Panel
        title="Changes"
        subtitle={`${patchJob.changes.length} change${patchJob.changes.length !== 1 ? 's' : ''}`}
        collapsible
      >
        {patchJob.changes.length === 0 ? (
          <EmptyState
            variant="no-data"
            title="No changes yet"
            description="Changes will appear once the patch draft is generated."
            className="py-8"
          />
        ) : (
          <div className="space-y-2">
            {patchJob.changes.map((change, index) => (
              <div
                key={index}
                className="flex items-start gap-2.5 rounded-lg bg-muted/30 px-3 py-2.5"
              >
                <FileCode2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-sm text-foreground font-mono">{change}</p>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Impact Assessment */}
      {patchJob.impactedAreas && (
        <Panel title="Impact Assessment">
          <div className="rounded-lg bg-warning/5 border border-warning/20 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-warning mb-1">Impacted Areas</p>
                <p className="text-sm text-foreground">{patchJob.impactedAreas}</p>
              </div>
            </div>
          </div>
        </Panel>
      )}

      {/* Test Plan */}
      {patchJob.testPlan && (
        <Panel title="Test Plan">
          <div className="rounded-lg bg-muted/30 p-3">
            <p className="text-sm text-foreground whitespace-pre-wrap">{patchJob.testPlan}</p>
          </div>
        </Panel>
      )}

      {/* Test Results */}
      <Panel
        title="Test Results"
        subtitle={patchJob.testResults.length > 0
          ? `${passedTests} passed, ${failedTests} failed of ${patchJob.testResults.length}`
          : 'No test results yet'
        }
        collapsible
      >
        {patchJob.testResults.length === 0 ? (
          <EmptyState
            variant="no-data"
            title="No test results"
            description="Test results will appear once the testing phase begins."
            className="py-8"
          />
        ) : (
          <div className="divide-y divide-border">
            {patchJob.testResults.map((test, index) => {
              const Icon = TEST_RESULT_ICON[test.status] ?? Clock;
              const color = TEST_RESULT_COLOR[test.status] ?? 'text-muted-foreground';

              return (
                <div
                  key={`${test.name}-${index}`}
                  className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <Icon className={cn('h-5 w-5 flex-shrink-0', color)} />
                  <p className="text-sm font-medium text-foreground flex-1 min-w-0 truncate">
                    {test.name}
                  </p>
                  {test.duration !== undefined && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                      <Timer className="h-3.5 w-3.5" />
                      {formatDuration(test.duration)}
                    </div>
                  )}
                  <Badge
                    variant={test.status === 'failed' ? 'destructive' : 'outline'}
                    className="flex-shrink-0 capitalize"
                  >
                    {test.status}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {/* Active indicator */}
      {isActive && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Patch job is active — updates from Ops Desk context</span>
        </div>
      )}
    </div>
  );
}
