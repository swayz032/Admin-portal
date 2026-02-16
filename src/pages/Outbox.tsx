import { useState, useEffect } from 'react';
import { useSystem } from '@/contexts/SystemContext';
import { Panel } from '@/components/shared/Panel';
import { DataTable } from '@/components/shared/DataTable';
import { StatusChip } from '@/components/shared/StatusChip';
import { PurposeStrip } from '@/components/shared/PurposeStrip';
import { SystemPipelineCard } from '@/components/shared/SystemPipelineCard';
import { ModeText } from '@/components/shared/ModeText';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { OutboxJob, OutboxJobStatus } from '@/contracts';
import { listOutboxJobs } from '@/services/apiClient';
import { formatTimeAgo } from '@/lib/formatters';
import { 
  Inbox, 
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react';

export default function Outbox() {
  const { viewMode } = useSystem();
  const [jobs, setJobs] = useState<OutboxJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<OutboxJob | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    setLoading(true);
    const data = await listOutboxJobs();
    setJobs(data);
    setLoading(false);
  };

  const filteredJobs = jobs.filter(j => {
    if (statusFilter !== 'all' && j.status !== statusFilter) return false;
    return true;
  });

  const getStatusColor = (status: OutboxJobStatus): 'success' | 'warning' | 'critical' | 'info' => {
    switch (status) {
      case 'completed': return 'success';
      case 'processing': return 'info';
      case 'queued': return 'warning';
      case 'retrying': return 'warning';
      case 'failed': return 'critical';
      default: return 'info';
    }
  };

  const getStatusIcon = (status: OutboxJobStatus) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-success" />;
      case 'processing': return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
      case 'queued': return <Clock className="h-4 w-4 text-warning" />;
      case 'retrying': return <RefreshCw className="h-4 w-4 text-warning" />;
      case 'failed': return <XCircle className="h-4 w-4 text-destructive" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const columns = viewMode === 'operator' ? [
    { 
      key: 'status', 
      header: 'Status', 
      render: (j: OutboxJob) => (
        <div className="flex items-center gap-2">
          {getStatusIcon(j.status)}
          <StatusChip 
            status={getStatusColor(j.status)} 
            label={j.status === 'queued' ? 'Waiting' : j.status === 'processing' ? 'Running' : j.status} 
          />
        </div>
      ) 
    },
    { key: 'action_type', header: 'Task' },
    { key: 'provider', header: 'Service', render: (j: OutboxJob) => j.provider || 'Internal' },
    { 
      key: 'queued_at', 
      header: 'Queued', 
      render: (j: OutboxJob) => <span className="text-muted-foreground">{formatTimeAgo(j.queued_at)}</span> 
    },
    { 
      key: 'attempts', 
      header: 'Attempts', 
      render: (j: OutboxJob) => (
        <span className={j.attempts > 1 ? 'text-warning' : 'text-muted-foreground'}>
          {j.attempts}
        </span>
      )
    },
  ] : [
    { 
      key: 'id', 
      header: 'Job ID', 
      render: (j: OutboxJob) => <span className="font-mono text-xs text-muted-foreground">{j.id}</span>
    },
    { 
      key: 'status', 
      header: 'Status', 
      render: (j: OutboxJob) => (
        <div className="flex items-center gap-2">
          {getStatusIcon(j.status)}
          <StatusChip status={getStatusColor(j.status)} label={j.status} />
        </div>
      ) 
    },
    { key: 'action_type', header: 'Action Type' },
    { key: 'provider', header: 'Provider' },
    { 
      key: 'correlation_id', 
      header: 'Correlation ID', 
      render: (j: OutboxJob) => (
        <span className="font-mono text-xs text-primary">{j.correlation_id.slice(0, 16)}...</span>
      )
    },
    { key: 'attempts', header: 'Attempts' },
    { 
      key: 'queued_at', 
      header: 'Queued At', 
      render: (j: OutboxJob) => <span className="text-xs text-muted-foreground">{new Date(j.queued_at).toLocaleString()}</span> 
    },
  ];

  const pendingCount = jobs.filter(j => j.status === 'queued' || j.status === 'processing').length;
  const failedCount = jobs.filter(j => j.status === 'failed').length;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">
          <ModeText operator="Task Queue" engineer="Outbox" />
        </h1>
        <p className="page-subtitle">
          <ModeText 
            operator="Actions waiting to run or currently running" 
            engineer="Transactional outbox for exactly-once execution" 
          />
        </p>
      </div>

      <PurposeStrip
        operatorPurpose="Tasks flow here after approval. Watch them execute and catch any that fail."
        engineerPurpose="Outbox pattern implementation. Each job executes exactly once with retry logic."
        operatorAction="Retry failed tasks or pause execution if needed"
        engineerObjects={['OutboxJob', 'Receipt']}
        variant="compact"
      />

      <SystemPipelineCard variant="compact" highlightStep={3} />

      {/* Quick Stats */}
      <div className="flex gap-4">
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-2 border border-border">
          <Loader2 className="h-4 w-4 text-primary" />
          <span className="text-sm">
            <span className="font-medium">{pendingCount}</span>
            <span className="text-muted-foreground ml-1">
              <ModeText operator="pending" engineer="in queue" />
            </span>
          </span>
        </div>
        {failedCount > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive/10 border border-destructive/20">
            <XCircle className="h-4 w-4 text-destructive" />
            <span className="text-sm">
              <span className="font-medium text-destructive">{failedCount}</span>
              <span className="text-muted-foreground ml-1">failed</span>
            </span>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="queued">Queued</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="retrying">Retrying</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={loadJobs}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Jobs Table */}
      <Panel>
        {loading ? (
          <div className="loading-state">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading queue...</span>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="empty-state">
            <Inbox className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-2">
              <ModeText operator="Queue is empty" engineer="No outbox jobs" />
            </h3>
            <p className="text-muted-foreground text-sm">
              <ModeText 
                operator="All tasks have been processed" 
                engineer="No jobs match current filters" 
              />
            </p>
          </div>
        ) : (
          <DataTable
            data={filteredJobs}
            columns={columns}
            keyExtractor={(j) => j.id}
            onRowClick={(job) => setSelectedJob(job)}
          />
        )}
      </Panel>

      {/* Job Detail Drawer */}
      <Sheet open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedJob && (
            <>
              <SheetHeader>
                <SheetTitle>
                  <ModeText operator="Task Details" engineer="Outbox Job Details" />
                </SheetTitle>
              </SheetHeader>
              
              <div className="mt-6 space-y-6">
                <div className="flex items-center gap-3">
                  {getStatusIcon(selectedJob.status)}
                  <StatusChip status={getStatusColor(selectedJob.status)} label={selectedJob.status} />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Action</span>
                    <span className="text-sm">{selectedJob.action_type}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      <ModeText operator="Service" engineer="Provider" />
                    </span>
                    <span className="text-sm">{selectedJob.provider || 'Internal'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Attempts</span>
                    <span className={`text-sm ${selectedJob.attempts > 1 ? 'text-warning' : ''}`}>
                      {selectedJob.attempts}
                    </span>
                  </div>
                </div>

                <div className="border-t border-border pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Queued</span>
                    <span className="text-sm">{new Date(selectedJob.queued_at).toLocaleString()}</span>
                  </div>
                  {selectedJob.started_at && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Started</span>
                      <span className="text-sm">{new Date(selectedJob.started_at).toLocaleString()}</span>
                    </div>
                  )}
                  {selectedJob.finished_at && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Finished</span>
                      <span className="text-sm">{new Date(selectedJob.finished_at).toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {selectedJob.error_message && (
                  <div className="border-t border-border pt-4">
                    <h4 className="text-sm font-medium text-destructive mb-2">Error</h4>
                    <p className="text-sm text-muted-foreground bg-destructive/10 p-3 rounded-lg">
                      {selectedJob.error_message}
                    </p>
                  </div>
                )}

                {viewMode === 'engineer' && (
                  <div className="border-t border-border pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Job ID</span>
                      <code className="text-xs bg-surface-2 px-2 py-1 rounded">{selectedJob.id}</code>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Suite ID</span>
                      <code className="text-xs bg-surface-2 px-2 py-1 rounded">{selectedJob.suite_id}</code>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Office ID</span>
                      <code className="text-xs bg-surface-2 px-2 py-1 rounded">{selectedJob.office_id}</code>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Correlation ID</span>
                      <code className="text-xs bg-surface-2 px-2 py-1 rounded text-primary">{selectedJob.correlation_id}</code>
                    </div>
                  </div>
                )}

                {selectedJob.status === 'failed' && (
                  <div className="pt-4">
                    <Button className="w-full" variant="outline">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      <ModeText operator="Request Retry" engineer="Retry Job" />
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
