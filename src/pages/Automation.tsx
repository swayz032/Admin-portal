import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { KPICard } from '@/components/shared/KPICard';
import { Panel } from '@/components/shared/Panel';
import { DataTable } from '@/components/shared/DataTable';
import { StatusChip } from '@/components/shared/StatusChip';
import { ModeText } from '@/components/shared/ModeText';
import { ExplainTooltip, explainContent } from '@/components/shared/ExplainTooltip';
import { TraceDrawer } from '@/components/automation/TraceDrawer';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSystem } from '@/contexts/SystemContext';
import type {
  AutomationJob,
  Automation,
  Schedule,
  AutomationFailure
} from '@/data/automationSeed'; // TODO: Move types to @/contracts when seed is deleted
import { useAutomationJobs, useAutomationFailures, useAutomationMetrics } from '@/hooks/useAdminData';
import { PageLoadingState } from '@/components/shared/PageLoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatTimeAgo } from '@/lib/formatters';
import { 
  Inbox, 
  Clock, 
  CheckCircle, 
  RefreshCw, 
  XCircle, 
  Shield,
  Play,
  Pause,
  RotateCcw,
  Ban,
  Eye,
  Zap,
  Calendar,
  AlertTriangle,
  Settings
} from 'lucide-react';

export default function AutomationPage() {
  const { viewMode, systemState } = useSystem();
  const [activeTab, setActiveTab] = useState('queue');
  const [selectedJob, setSelectedJob] = useState<AutomationJob | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Production data hooks
  const { data: automationJobs, loading: jobsLoading, error: jobsError, refetch: refetchJobs } = useAutomationJobs();
  const { data: automationFailures, loading: failuresLoading, error: failuresError, refetch: refetchFailures } = useAutomationFailures();
  const { data: automationMetrics, loading: metricsLoading, error: metricsError, refetch: refetchMetrics } = useAutomationMetrics();

  // Show loading state while primary data loads
  if (jobsLoading && metricsLoading) return <PageLoadingState showKPIs kpiCount={6} rows={6} />;
  if (jobsError) return <EmptyState variant="error" title="Failed to load automation data" description={jobsError} actionLabel="Retry" onAction={refetchJobs} />;

  const handleOpenTrace = (job: AutomationJob) => {
    setSelectedJob(job);
    setDrawerOpen(true);
  };

  const getJobStatusChip = (status: AutomationJob['status']) => {
    const statusMap = {
      queued: { status: 'pending' as const, operator: 'Waiting', engineer: 'queued' },
      running: { status: 'info' as const, operator: 'Running', engineer: 'running' },
      completed: { status: 'success' as const, operator: 'Done', engineer: 'completed' },
      failed: { status: 'critical' as const, operator: 'Failed', engineer: 'failed' },
      blocked: { status: 'warning' as const, operator: 'Blocked', engineer: 'blocked' },
      retrying: { status: 'warning' as const, operator: 'Retrying', engineer: 'retrying' },
    };
    const s = statusMap[status];
    return <StatusChip status={s.status} label={viewMode === 'operator' ? s.operator : s.engineer} />;
  };

  const getProofStatusChip = (proofStatus: AutomationJob['proofStatus']) => {
    const map = {
      ok: { status: 'success' as const, label: viewMode === 'operator' ? 'Recorded' : 'ok' },
      missing: { status: 'critical' as const, label: viewMode === 'operator' ? 'Missing' : 'missing' },
      pending: { status: 'pending' as const, label: viewMode === 'operator' ? 'Pending' : 'pending' },
    };
    const s = map[proofStatus];
    return <StatusChip status={s.status} label={s.label} />;
  };

  // Work Queue columns
  const queueColumnsOperator = [
    { 
      key: 'description', 
      header: "What it's trying to do", 
      render: (j: AutomationJob) => <span className="text-sm">{j.jobDescription}</span> 
    },
    { 
      key: 'scope', 
      header: "Who it's for", 
      render: (j: AutomationJob) => (
        <span className="text-sm text-text-secondary">{j.suiteName} • {j.officeName}</span>
      ) 
    },
    { 
      key: 'waiting', 
      header: "Why it's waiting", 
      render: (j: AutomationJob) => (
        <span className="text-sm text-text-secondary">{j.waitingReason || '—'}</span>
      ) 
    },
    { key: 'status', header: 'Status', render: (j: AutomationJob) => getJobStatusChip(j.status) },
    { 
      key: 'tries', 
      header: 'Tries', 
      render: (j: AutomationJob) => <span className="text-sm">{j.attempts}/{j.maxAttempts}</span> 
    },
    { 
      key: 'actions', 
      header: '', 
      render: (j: AutomationJob) => (
        <div className="flex gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={(e) => { e.stopPropagation(); handleOpenTrace(j); }}
              >
                <Eye className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>View trace</TooltipContent>
          </Tooltip>
        </div>
      ) 
    },
  ];

  const queueColumnsEngineer = [
    { key: 'id', header: 'Job ID', render: (j: AutomationJob) => <span className="font-mono text-xs">{j.id}</span> },
    { key: 'type', header: 'Type', render: (j: AutomationJob) => <span className="font-mono text-xs">{j.jobType}</span> },
    { 
      key: 'scope', 
      header: 'Tenant/Suite/Office', 
      render: (j: AutomationJob) => (
        <span className="font-mono text-xs">{j.tenantId}/{j.suiteId}/{j.officeId}</span>
      ) 
    },
    { key: 'status', header: 'Status', render: (j: AutomationJob) => getJobStatusChip(j.status) },
    { 
      key: 'attempts', 
      header: 'Attempts', 
      render: (j: AutomationJob) => <span className="font-mono text-xs">{j.attempts}/{j.maxAttempts}</span> 
    },
    { 
      key: 'nextRun', 
      header: 'Next Run', 
      render: (j: AutomationJob) => <span className="text-xs text-text-secondary">{formatTimeAgo(j.nextRunAt)}</span> 
    },
    { 
      key: 'idempotency', 
      header: 'Idempotency', 
      render: (j: AutomationJob) => <span className="font-mono text-xs truncate max-w-[100px]">{j.idempotencyKey}</span> 
    },
    { key: 'proof', header: 'Proof', render: (j: AutomationJob) => getProofStatusChip(j.proofStatus) },
    { 
      key: 'correlationId', 
      header: 'Correlation', 
      render: (j: AutomationJob) => <span className="font-mono text-xs truncate max-w-[80px]">{j.correlationId}</span> 
    },
    { 
      key: 'actions', 
      header: '', 
      render: (j: AutomationJob) => (
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleOpenTrace(j); }}>
          <Eye className="h-3 w-3" />
        </Button>
      ) 
    },
  ];

  // Automations table columns
  const automationColumns = viewMode === 'operator' ? [
    { key: 'name', header: 'Automation', render: (a: Automation) => <span className="font-medium">{a.name}</span> },
    { key: 'category', header: 'Category', render: (a: Automation) => <span className="text-text-secondary">{a.category}</span> },
    { 
      key: 'status', 
      header: 'Status', 
      render: (a: Automation) => (
        <StatusChip 
          status={a.status === 'active' ? 'success' : a.status === 'paused' ? 'warning' : 'critical'}
          label={a.status === 'active' ? 'Running' : a.status === 'paused' ? 'Paused' : 'Off'}
        />
      )
    },
    { 
      key: 'lastRun', 
      header: 'Last run', 
      render: (a: Automation) => <span className="text-text-secondary">{a.lastRun ? formatTimeAgo(a.lastRun) : '—'}</span> 
    },
    { 
      key: 'success', 
      header: 'Success rate', 
      render: (a: Automation) => <span className="text-text-secondary">{a.successRate}%</span> 
    },
  ] : [
    { key: 'id', header: 'ID', render: (a: Automation) => <span className="font-mono text-xs">{a.id}</span> },
    { key: 'name', header: 'Name', render: (a: Automation) => <span className="font-medium">{a.name}</span> },
    { key: 'trigger', header: 'Trigger', render: (a: Automation) => <span className="font-mono text-xs">{a.triggeredBy}</span> },
    { 
      key: 'status', 
      header: 'Status', 
      render: (a: Automation) => (
        <StatusChip 
          status={a.status === 'active' ? 'success' : a.status === 'paused' ? 'warning' : 'critical'}
          label={a.status}
        />
      )
    },
    { key: 'runs', header: 'Total Runs', render: (a: Automation) => <span className="font-mono">{a.runsTotal}</span> },
    { key: 'success', header: 'Success %', render: (a: Automation) => <span>{a.successRate}%</span> },
  ];

  // Schedules table columns
  const scheduleColumns = viewMode === 'operator' ? [
    { key: 'name', header: 'Automation', render: (s: Schedule) => <span className="font-medium">{s.automationName}</span> },
    { key: 'schedule', header: 'Schedule', render: (s: Schedule) => <span className="text-text-secondary">{s.cronReadable}</span> },
    { 
      key: 'status', 
      header: 'Status', 
      render: (s: Schedule) => (
        <StatusChip status={s.status === 'active' ? 'success' : 'warning'} label={s.status === 'active' ? 'Active' : 'Paused'} />
      )
    },
    { key: 'nextRun', header: 'Next run', render: (s: Schedule) => <span className="text-text-secondary">{formatTimeAgo(s.nextRun)}</span> },
  ] : [
    { key: 'id', header: 'ID', render: (s: Schedule) => <span className="font-mono text-xs">{s.id}</span> },
    { key: 'automation', header: 'Automation', render: (s: Schedule) => <span className="font-mono text-xs">{s.automationId}</span> },
    { key: 'cron', header: 'Cron', render: (s: Schedule) => <span className="font-mono text-xs">{s.cronExpression}</span> },
    { key: 'tz', header: 'Timezone', render: (s: Schedule) => <span className="text-xs">{s.timezone}</span> },
    { key: 'status', header: 'Status', render: (s: Schedule) => <StatusChip status={s.status === 'active' ? 'success' : 'warning'} label={s.status} /> },
    { key: 'nextRun', header: 'Next Run', render: (s: Schedule) => <span className="text-xs">{formatTimeAgo(s.nextRun)}</span> },
  ];

  // Failures table columns
  const failureColumns = viewMode === 'operator' ? [
    { key: 'automation', header: 'Automation', render: (f: AutomationFailure) => <span className="font-medium">{f.automationName}</span> },
    { key: 'error', header: 'What went wrong', render: (f: AutomationFailure) => <span className="text-text-secondary">{f.errorMessageOperator}</span> },
    { key: 'scope', header: 'For', render: (f: AutomationFailure) => <span className="text-text-secondary">{f.suiteName} • {f.officeName}</span> },
    { key: 'when', header: 'When', render: (f: AutomationFailure) => <span className="text-text-secondary">{formatTimeAgo(f.failedAt)}</span> },
    { 
      key: 'actions', 
      header: '', 
      render: (f: AutomationFailure) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button 
                size="sm" 
                variant="outline" 
                disabled={!f.canRetry || systemState.safetyMode}
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Request retry
              </Button>
            </span>
          </TooltipTrigger>
          {systemState.safetyMode && (
            <TooltipContent>Restricted when Safety Mode is ON</TooltipContent>
          )}
        </Tooltip>
      )
    },
  ] : [
    { key: 'id', header: 'ID', render: (f: AutomationFailure) => <span className="font-mono text-xs">{f.id}</span> },
    { key: 'jobId', header: 'Job ID', render: (f: AutomationFailure) => <span className="font-mono text-xs">{f.jobId}</span> },
    { key: 'errorCode', header: 'Error Code', render: (f: AutomationFailure) => <span className="font-mono text-xs">{f.errorCode}</span> },
    { key: 'attempts', header: 'Attempts', render: (f: AutomationFailure) => <span>{f.attempts}</span> },
    { key: 'correlation', header: 'Correlation', render: (f: AutomationFailure) => <span className="font-mono text-xs truncate max-w-[80px]">{f.correlationId}</span> },
    { key: 'when', header: 'Failed At', render: (f: AutomationFailure) => <span className="text-xs">{formatTimeAgo(f.failedAt)}</span> },
    { 
      key: 'actions', 
      header: '', 
      render: (f: AutomationFailure) => (
        <Button size="sm" variant="outline" disabled={!f.canRetry || systemState.safetyMode}>
          <RotateCcw className="h-3 w-3 mr-1" />
          Retry
        </Button>
      )
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">
          <ModeText operator="Automation" engineer="Automation" />
        </h1>
        <p className="page-subtitle">
          <ModeText 
            operator="See what the system is working on and manage scheduled tasks" 
            engineer="Job queue, automations, schedules, and failure management" 
          />
        </p>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard
          title={viewMode === 'operator' ? 'Work waiting to run' : 'Outbox queue depth'}
          value={automationMetrics?.queueDepth ?? 0}
          icon={<Inbox className="h-4 w-4" />}
          status={(automationMetrics?.queueDepth ?? 0) > 20 ? 'warning' : 'success'}
        />
        <KPICard
          title={viewMode === 'operator' ? 'Oldest work waiting' : 'Worker lag (oldest job)'}
          value={automationMetrics?.avgDuration ?? '—'}
          icon={<Clock className="h-4 w-4" />}
          status="info"
        />
        <KPICard
          title={viewMode === 'operator' ? 'Total jobs' : 'Total jobs'}
          value={automationMetrics?.totalJobs ?? 0}
          icon={<CheckCircle className="h-4 w-4" />}
          status="success"
        />
        <KPICard
          title={viewMode === 'operator' ? 'Retry rate' : 'Retry rate'}
          value={`${automationMetrics?.retryRate ?? 0}%`}
          icon={<RefreshCw className="h-4 w-4" />}
          status={(automationMetrics?.retryRate ?? 0) > 30 ? 'warning' : 'info'}
        />
        <KPICard
          title={viewMode === 'operator' ? 'Failed jobs' : 'Failed jobs'}
          value={automationMetrics?.failedJobs ?? 0}
          icon={<XCircle className="h-4 w-4" />}
          status={(automationMetrics?.failedJobs ?? 0) > 0 ? 'critical' : 'success'}
        />
        <KPICard
          title={viewMode === 'operator' ? 'Success rate' : 'Success rate'}
          value={`${automationMetrics?.successRate ?? 0}%`}
          icon={<Shield className="h-4 w-4" />}
          status={(automationMetrics?.successRate ?? 0) < 90 ? 'warning' : 'success'}
        />
      </div>

      {/* Tabs */}
      <Panel noPadding>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="p-4 border-b border-border">
            <TabsList className="bg-surface-1">
              <TabsTrigger value="queue" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Inbox className="h-4 w-4 mr-2" />
                <ModeText operator="Work Queue" engineer="Work Queue" />
              </TabsTrigger>
              <TabsTrigger value="automations" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Zap className="h-4 w-4 mr-2" />
                <ModeText operator="Automations" engineer="Automations" />
              </TabsTrigger>
              <TabsTrigger value="schedules" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Calendar className="h-4 w-4 mr-2" />
                <ModeText operator="Schedules" engineer="Schedules" />
              </TabsTrigger>
              <TabsTrigger value="failures" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <AlertTriangle className="h-4 w-4 mr-2" />
                <ModeText operator="Failures" engineer="Failures" />
              </TabsTrigger>
              <TabsTrigger value="controls" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Settings className="h-4 w-4 mr-2" />
                <ModeText operator="Controls" engineer="Controls" />
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="queue" className="m-0">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium">
                  <ModeText operator="Work Queue" engineer="Job Queue" />
                </h3>
                <ExplainTooltip content={explainContent.queueDepth} />
              </div>
              <div className="flex gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button size="sm" variant="outline" disabled={systemState.safetyMode}>
                        <Pause className="h-3 w-3 mr-1" />
                        <ModeText operator="Request pause all" engineer="Request pause" />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {systemState.safetyMode && (
                    <TooltipContent>Restricted when Safety Mode is ON</TooltipContent>
                  )}
                </Tooltip>
              </div>
            </div>
            <DataTable
              columns={viewMode === 'operator' ? queueColumnsOperator : queueColumnsEngineer}
              data={automationJobs}
              keyExtractor={(j) => j.id}
              onRowClick={handleOpenTrace}
              emptyMessage={viewMode === 'operator' ? 'No work waiting' : 'Queue empty'}
            />
          </TabsContent>

          <TabsContent value="automations" className="m-0">
            <DataTable
              columns={automationColumns}
              data={[] as Automation[]}
              keyExtractor={(a) => a.id}
              emptyMessage="No automations configured — automation definitions will appear once connected"
            />
          </TabsContent>

          <TabsContent value="schedules" className="m-0">
            <DataTable
              columns={scheduleColumns}
              data={[] as Schedule[]}
              keyExtractor={(s) => s.id}
              emptyMessage="No schedules configured — schedules will appear once connected"
            />
          </TabsContent>

          <TabsContent value="failures" className="m-0">
            {failuresLoading ? (
              <PageLoadingState rows={3} />
            ) : failuresError ? (
              <EmptyState variant="error" title="Failed to load failures" description={failuresError} actionLabel="Retry" onAction={refetchFailures} />
            ) : automationFailures.length === 0 ? (
              <EmptyState variant="all-done" title={viewMode === 'operator' ? 'No recent failures' : 'No failures in window'} description="No automation failures to display." />
            ) : (
              <DataTable
                columns={failureColumns}
                data={automationFailures}
                keyExtractor={(f) => f.id}
                emptyMessage={viewMode === 'operator' ? 'No recent failures' : 'No failures in window'}
              />
            )}
          </TabsContent>

          <TabsContent value="controls" className="m-0 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 rounded-lg border border-border bg-surface-1 space-y-4">
                <h4 className="font-medium">
                  <ModeText operator="Pause Controls" engineer="Worker Controls" />
                </h4>
                <p className="text-sm text-text-secondary">
                  {viewMode === 'operator' 
                    ? 'Stop work for a specific office or the whole system.'
                    : 'Pause job processing at various scopes.'}
                </p>
                <div className="flex gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button variant="outline" disabled={systemState.safetyMode}>
                          <Pause className="h-4 w-4 mr-2" />
                          <ModeText operator="Request pause office" engineer="Request pause office" />
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {systemState.safetyMode && (
                      <TooltipContent>Restricted when Safety Mode is ON</TooltipContent>
                    )}
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button variant="outline" disabled={systemState.safetyMode}>
                          <Ban className="h-4 w-4 mr-2" />
                          <ModeText operator="Request pause tenant" engineer="Request pause tenant" />
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {systemState.safetyMode && (
                      <TooltipContent>Restricted when Safety Mode is ON</TooltipContent>
                    )}
                  </Tooltip>
                </div>
              </div>
              
              <div className="p-4 rounded-lg border border-border bg-surface-1 space-y-4">
                <h4 className="font-medium">
                  <ModeText operator="Resume Controls" engineer="Resume Controls" />
                </h4>
                <p className="text-sm text-text-secondary">
                  {viewMode === 'operator' 
                    ? 'Resume paused work after issues are resolved.'
                    : 'Resume paused workers at various scopes.'}
                </p>
                <div className="flex gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button variant="outline" disabled={systemState.safetyMode}>
                          <Play className="h-4 w-4 mr-2" />
                          <ModeText operator="Request resume" engineer="Request resume" />
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {systemState.safetyMode && (
                      <TooltipContent>Restricted when Safety Mode is ON</TooltipContent>
                    )}
                  </Tooltip>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </Panel>

      {/* Trace Drawer */}
      <TraceDrawer 
        job={selectedJob} 
        open={drawerOpen} 
        onOpenChange={setDrawerOpen} 
      />
    </div>
  );
}
