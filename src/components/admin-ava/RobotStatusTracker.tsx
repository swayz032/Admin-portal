/**
 * Live robot run status — shows environment, scenario progress, pass/fail.
 * Subscribes to /admin/ops/robots/{run_id} via polling (2s while running).
 */

import { useRobotRun, type RobotScenario } from '@/hooks/useRobotRun';
import { cn } from '@/lib/utils';
import { Loader2, CheckCircle, XCircle, Circle, Zap } from 'lucide-react';

interface RobotStatusTrackerProps {
  runId: string;
}

function ScenarioRow({ scenario }: { scenario: RobotScenario }) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2">
        {scenario.status === 'running' && <Loader2 className="w-3 h-3 animate-spin text-blue-400" />}
        {scenario.status === 'passed' && <CheckCircle className="w-3 h-3 text-green-400" />}
        {scenario.status === 'failed' && <XCircle className="w-3 h-3 text-destructive" />}
        {scenario.status === 'pending' && <Circle className="w-3 h-3 text-muted-foreground" />}
        <span className="text-xs">{scenario.name}</span>
      </div>
      {scenario.duration != null && (
        <span className="text-[10px] text-muted-foreground">{scenario.duration}ms</span>
      )}
    </div>
  );
}

export function RobotStatusTracker({ runId }: RobotStatusTrackerProps) {
  const { run, loading, error } = useRobotRun(runId);

  if (loading && !run) {
    return (
      <div className="rounded-xl border border-amber-500/20 bg-card p-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading robot run...
      </div>
    );
  }

  if (error && !run) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
        Robot run unavailable: {error}
      </div>
    );
  }

  if (!run) return null;

  const passed = run.scenarios.filter(s => s.status === 'passed').length;
  const total = run.scenarios.length;
  const progressPct = total > 0 ? Math.round((passed / total) * 100) : 0;

  return (
    <div className="rounded-xl border border-amber-500/20 bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-amber-500/10 bg-amber-500/5">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-semibold">Robot Verification</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            'text-xs px-2 py-0.5 rounded-full font-medium',
            run.status === 'passed' && 'bg-green-500/10 text-green-400',
            run.status === 'failed' && 'bg-destructive/10 text-destructive',
            run.status === 'running' && 'bg-blue-500/10 text-blue-400',
            run.status === 'pending' && 'bg-muted text-muted-foreground',
          )}>
            {run.status}
          </span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {run.environment}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 pt-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">{passed}/{total} scenarios</span>
          <span className="text-xs text-muted-foreground">{progressPct}%</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              run.status === 'passed' ? 'bg-green-500' :
              run.status === 'failed' ? 'bg-destructive' :
              'bg-blue-500',
            )}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Scenarios */}
      <div className="px-4 py-3 space-y-0.5">
        {run.scenarios.map((s) => (
          <ScenarioRow key={s.name} scenario={s} />
        ))}
      </div>

      {/* Summary */}
      {run.summary && (
        <div className="px-4 pb-3 text-xs text-muted-foreground border-t border-border/50 pt-2">
          {run.summary}
        </div>
      )}
    </div>
  );
}
