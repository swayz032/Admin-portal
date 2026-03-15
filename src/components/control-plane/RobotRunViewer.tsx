/**
 * RobotRunViewer — displays live robot run status, execution timeline, and scenario results.
 * Consumes useRobotRun hook for polling-based real-time updates.
 */

import { useRobotRun, type RobotRunStatus, type RobotScenario } from '@/hooks/useRobotRun';
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
  AlertTriangle,
  Timer,
} from 'lucide-react';

interface RobotRunViewerProps {
  robotRunId: string;
}

const STATUS_MAP: Record<RobotRunStatus, { chipStatus: 'success' | 'critical' | 'pending' | 'warning' | 'info'; label: string }> = {
  pending: { chipStatus: 'pending', label: 'Pending' },
  running: { chipStatus: 'info', label: 'Running' },
  passed: { chipStatus: 'success', label: 'Passed' },
  failed: { chipStatus: 'critical', label: 'Failed' },
  error: { chipStatus: 'warning', label: 'Error' },
};

const SCENARIO_ICON: Record<RobotScenario['status'], typeof CheckCircle2> = {
  pending: Clock,
  running: Play,
  passed: CheckCircle2,
  failed: XCircle,
};

const SCENARIO_COLOR: Record<RobotScenario['status'], string> = {
  pending: 'text-muted-foreground',
  running: 'text-primary animate-pulse',
  passed: 'text-success',
  failed: 'text-destructive',
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function RobotRunViewer({ robotRunId }: RobotRunViewerProps) {
  const { run, loading, error } = useRobotRun(robotRunId);

  if (loading && !run) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !run) {
    return (
      <EmptyState
        variant="error"
        title="Failed to load robot run"
        description={error}
      />
    );
  }

  if (!run) {
    return (
      <EmptyState
        variant="no-data"
        title="Robot run not found"
        description="The requested robot run does not exist or has been removed."
      />
    );
  }

  const statusConfig = STATUS_MAP[run.status];
  const passedCount = run.scenarios.filter(s => s.status === 'passed').length;
  const failedCount = run.scenarios.filter(s => s.status === 'failed').length;
  const totalCount = run.scenarios.length;

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <Panel
        title="Robot Run"
        action={<StatusChip status={statusConfig.chipStatus} label={statusConfig.label} size="md" />}
      >
        <div className="space-y-4">
          {/* Meta row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Run ID</p>
              <p className="text-sm font-mono text-foreground truncate">{run.runId}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Environment</p>
              <Badge variant="outline" className="mt-1">{run.environment}</Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Started</p>
              <p className="text-sm text-foreground">{formatTimestamp(run.startedAt)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Completed</p>
              <p className="text-sm text-foreground">
                {run.completedAt ? formatTimestamp(run.completedAt) : '---'}
              </p>
            </div>
          </div>

          {/* Summary */}
          {run.summary && (
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-sm text-foreground">{run.summary}</p>
            </div>
          )}

          {/* Progress bar */}
          {totalCount > 0 && (
            <div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                <span>{passedCount + failedCount} of {totalCount} scenarios complete</span>
                <span>
                  {passedCount > 0 && <span className="text-success">{passedCount} passed</span>}
                  {passedCount > 0 && failedCount > 0 && ' / '}
                  {failedCount > 0 && <span className="text-destructive">{failedCount} failed</span>}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                {passedCount > 0 && (
                  <div
                    className="h-full bg-success transition-all duration-300"
                    style={{ width: `${(passedCount / totalCount) * 100}%` }}
                  />
                )}
                {failedCount > 0 && (
                  <div
                    className="h-full bg-destructive transition-all duration-300"
                    style={{ width: `${(failedCount / totalCount) * 100}%` }}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </Panel>

      {/* Scenarios Panel */}
      <Panel title="Scenarios" subtitle={`${totalCount} scenario${totalCount !== 1 ? 's' : ''}`}>
        {totalCount === 0 ? (
          <EmptyState
            variant="no-data"
            title="No scenarios"
            description="This run has no scenarios to display."
            className="py-8"
          />
        ) : (
          <div className="divide-y divide-border">
            {run.scenarios.map((scenario, index) => {
              const Icon = SCENARIO_ICON[scenario.status];
              const color = SCENARIO_COLOR[scenario.status];

              return (
                <div
                  key={`${scenario.name}-${index}`}
                  className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <Icon className={cn('h-5 w-5 flex-shrink-0', color)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {scenario.name}
                    </p>
                    {scenario.error && (
                      <div className="flex items-start gap-1.5 mt-1">
                        <AlertTriangle className="h-3.5 w-3.5 text-destructive flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-destructive">{scenario.error}</p>
                      </div>
                    )}
                  </div>
                  {scenario.duration !== undefined && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                      <Timer className="h-3.5 w-3.5" />
                      {formatDuration(scenario.duration)}
                    </div>
                  )}
                  <Badge
                    variant={scenario.status === 'failed' ? 'destructive' : 'outline'}
                    className="flex-shrink-0 capitalize"
                  >
                    {scenario.status}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {/* Live indicator */}
      {(run.status === 'pending' || run.status === 'running') && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Polling for updates every 2 seconds</span>
        </div>
      )}
    </div>
  );
}
