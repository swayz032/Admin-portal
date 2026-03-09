/**
 * Inline chat card for robot run results.
 * Shows: run_id, status, environment, scenario count, summary.
 */

import { useRobotRun } from '@/hooks/useRobotRun';
import { cn } from '@/lib/utils';
import { Loader2, CheckCircle, XCircle, Zap } from 'lucide-react';

interface RobotResultsCardProps {
  runId: string;
}

export function RobotResultsCard({ runId }: RobotResultsCardProps) {
  const { run, loading } = useRobotRun(runId);

  if (loading && !run) {
    return (
      <div className="inline-flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
        <Loader2 className="w-3 h-3 animate-spin" />
        Loading robot run {runId.slice(0, 8)}...
      </div>
    );
  }

  if (!run) return null;

  const passed = run.scenarios.filter(s => s.status === 'passed').length;
  const failed = run.scenarios.filter(s => s.status === 'failed').length;
  const total = run.scenarios.length;

  return (
    <div className={cn(
      'rounded-lg border px-3 py-2 inline-flex items-center gap-3',
      run.status === 'passed' && 'border-green-500/20 bg-green-500/5',
      run.status === 'failed' && 'border-destructive/20 bg-destructive/5',
      (run.status === 'running' || run.status === 'pending') && 'border-blue-500/20 bg-blue-500/5',
    )}>
      <Zap className={cn(
        'w-4 h-4',
        run.status === 'passed' && 'text-green-400',
        run.status === 'failed' && 'text-destructive',
        run.status === 'running' && 'text-blue-400',
      )} />

      <div className="text-xs space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="font-medium">{run.environment}</span>
          <span className={cn(
            'px-1.5 py-0 rounded text-[10px] font-medium',
            run.status === 'passed' && 'bg-green-500/10 text-green-400',
            run.status === 'failed' && 'bg-destructive/10 text-destructive',
            run.status === 'running' && 'bg-blue-500/10 text-blue-400',
          )}>
            {run.status}
          </span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="flex items-center gap-0.5">
            <CheckCircle className="w-3 h-3 text-green-400" />{passed}
          </span>
          {failed > 0 && (
            <span className="flex items-center gap-0.5">
              <XCircle className="w-3 h-3 text-destructive" />{failed}
            </span>
          )}
          <span>/ {total}</span>
        </div>
      </div>

      {run.summary && (
        <span className="text-[10px] text-muted-foreground max-w-[200px] truncate">
          {run.summary}
        </span>
      )}
    </div>
  );
}
