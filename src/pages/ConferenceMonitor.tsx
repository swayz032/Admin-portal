import { useState, useMemo } from 'react';
import { useSystem } from '@/contexts/SystemContext';
import { Panel } from '@/components/shared/Panel';
import { DataTable } from '@/components/shared/DataTable';
import { StatusChip } from '@/components/shared/StatusChip';
import { PurposeStrip } from '@/components/shared/PurposeStrip';
import { ModeText } from '@/components/shared/ModeText';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Receipt as TrustReceipt, ReceiptStatus } from '@/contracts';
import { listReceipts } from '@/services/apiClient';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { formatTimeAgo } from '@/lib/formatters';
import {
  Video,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
  MonitorPlay,
} from 'lucide-react';

/** Action types that qualify as conference/meeting-related */
const CONFERENCE_KEYWORDS = ['conference', 'meeting', 'livekit', 'video', 'call', 'room', 'session'];

function isConferenceReceipt(receipt: TrustReceipt): boolean {
  const actionLower = receipt.action_type.toLowerCase();
  return CONFERENCE_KEYWORDS.some(kw => actionLower.includes(kw));
}

export default function ConferenceMonitor() {
  const { viewMode } = useSystem();
  const { data: allReceipts, loading, error, refetch } = useRealtimeSubscription<TrustReceipt>({
    table: 'receipts',
    events: ['INSERT', 'UPDATE'],
    fetcher: () => listReceipts(),
    getKey: (item) => item.id,
  });

  const [selectedReceipt, setSelectedReceipt] = useState<TrustReceipt | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const conferenceReceipts = useMemo(
    () => allReceipts.filter(isConferenceReceipt),
    [allReceipts],
  );

  const filteredReceipts = conferenceReceipts.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    return true;
  });

  const getStatusColor = (status: ReceiptStatus): 'success' | 'warning' | 'critical' | 'info' => {
    switch (status) {
      case 'success': return 'success';
      case 'pending': return 'warning';
      case 'failed': return 'critical';
      case 'blocked': return 'critical';
      default: return 'info';
    }
  };

  const getStatusIcon = (status: ReceiptStatus) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-4 w-4 text-success" />;
      case 'pending': return <Clock className="h-4 w-4 text-warning" />;
      case 'failed': return <XCircle className="h-4 w-4 text-destructive" />;
      case 'blocked': return <AlertTriangle className="h-4 w-4 text-destructive" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  // Stats
  const totalCount = conferenceReceipts.length;
  const activeCount = conferenceReceipts.filter(r => r.status === 'pending').length;
  const completedCount = conferenceReceipts.filter(r => r.status === 'success').length;
  const failedCount = conferenceReceipts.filter(r => r.status === 'failed' || r.status === 'blocked').length;

  const columns = viewMode === 'operator' ? [
    {
      key: 'status',
      header: 'Status',
      render: (r: TrustReceipt) => (
        <div className="flex items-center gap-2">
          {getStatusIcon(r.status)}
          <StatusChip
            status={getStatusColor(r.status)}
            label={r.status === 'pending' ? 'Active' : r.status === 'success' ? 'Completed' : r.status}
          />
        </div>
      ),
    },
    { key: 'action_type', header: 'Session Type' },
    {
      key: 'created_at',
      header: 'Started',
      render: (r: TrustReceipt) => (
        <span className="text-muted-foreground">{formatTimeAgo(r.created_at)}</span>
      ),
    },
  ] : [
    {
      key: 'id',
      header: 'Receipt ID',
      render: (r: TrustReceipt) => (
        <span className="font-mono text-xs text-muted-foreground">{r.id}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r: TrustReceipt) => (
        <div className="flex items-center gap-2">
          {getStatusIcon(r.status)}
          <StatusChip status={getStatusColor(r.status)} label={r.status} />
        </div>
      ),
    },
    { key: 'action_type', header: 'Action Type' },
    {
      key: 'correlation_id',
      header: 'Correlation ID',
      render: (r: TrustReceipt) => (
        <span className="font-mono text-xs text-primary">{(r.correlation_id ?? '').slice(0, 16) || '—'}...</span>
      ),
    },
    {
      key: 'created_at',
      header: 'Created At',
      render: (r: TrustReceipt) => (
        <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">
          <ModeText operator="Conferences" engineer="Conference Monitor" />
        </h1>
        <p className="page-subtitle">
          <ModeText
            operator="Video calls and meeting sessions"
            engineer="Receipts filtered by conference/meeting/video action types"
          />
        </p>
      </div>

      <PurposeStrip
        operatorPurpose="Monitor active and completed video conference sessions."
        engineerPurpose="Receipt audit trail filtered to conference-domain action types (conference, meeting, livekit, video)."
        operatorAction="Check for failed sessions or active meetings"
        engineerObjects={['Receipt']}
        variant="compact"
      />

      {/* Quick Stats */}
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-2 border border-border">
          <MonitorPlay className="h-4 w-4 text-primary" />
          <span className="text-sm">
            <span className="font-medium">{totalCount}</span>
            <span className="text-muted-foreground ml-1">total sessions</span>
          </span>
        </div>
        {activeCount > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 border border-primary/20">
            <Loader2 className="h-4 w-4 text-primary animate-spin" />
            <span className="text-sm">
              <span className="font-medium text-primary">{activeCount}</span>
              <span className="text-muted-foreground ml-1">active</span>
            </span>
          </div>
        )}
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-2 border border-border">
          <CheckCircle className="h-4 w-4 text-success" />
          <span className="text-sm">
            <span className="font-medium">{completedCount}</span>
            <span className="text-muted-foreground ml-1">completed</span>
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
            <SelectItem value="pending">Active</SelectItem>
            <SelectItem value="success">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="blocked">Blocked</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={refetch}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Table */}
      <Panel>
        {loading ? (
          <div className="loading-state">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading conference sessions...</span>
          </div>
        ) : error ? (
          <div className="empty-state">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-destructive/50" />
            <h3 className="text-lg font-medium mb-2">Failed to load conference data</h3>
            <p className="text-muted-foreground text-sm mb-4">{error}</p>
            <Button variant="outline" size="sm" onClick={refetch}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        ) : filteredReceipts.length === 0 ? (
          <div className="empty-state">
            <Video className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-2">
              <ModeText operator="No conferences found" engineer="No conference receipts" />
            </h3>
            <p className="text-muted-foreground text-sm">
              <ModeText
                operator="Conference and meeting activity will appear here"
                engineer="No receipts match conference-related action type filters"
              />
            </p>
          </div>
        ) : (
          <DataTable
            data={filteredReceipts}
            columns={columns}
            keyExtractor={(r) => r.id}
            onRowClick={(receipt) => setSelectedReceipt(receipt)}
          />
        )}
      </Panel>

      {/* Detail Drawer */}
      <Sheet open={!!selectedReceipt} onOpenChange={() => setSelectedReceipt(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedReceipt && (
            <>
              <SheetHeader>
                <SheetTitle>
                  <ModeText operator="Session Details" engineer="Conference Receipt Details" />
                </SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                <div className="flex items-center gap-3">
                  {getStatusIcon(selectedReceipt.status)}
                  <StatusChip status={getStatusColor(selectedReceipt.status)} label={selectedReceipt.status} />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      <ModeText operator="Session Type" engineer="Action Type" />
                    </span>
                    <span className="text-sm">{selectedReceipt.action_type}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Domain</span>
                    <span className="text-sm">{selectedReceipt.domain}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      <ModeText operator="Service" engineer="Provider" />
                    </span>
                    <span className="text-sm">{selectedReceipt.provider || 'Internal'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Started</span>
                    <span className="text-sm">{new Date(selectedReceipt.created_at).toLocaleString()}</span>
                  </div>
                </div>

                {viewMode === 'engineer' && (
                  <div className="border-t border-border pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Receipt ID</span>
                      <code className="text-xs bg-surface-2 px-2 py-1 rounded">{selectedReceipt.id}</code>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Suite ID</span>
                      <code className="text-xs bg-surface-2 px-2 py-1 rounded">{selectedReceipt.suite_id}</code>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Office ID</span>
                      <code className="text-xs bg-surface-2 px-2 py-1 rounded">{selectedReceipt.office_id}</code>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Correlation ID</span>
                      <code className="text-xs bg-surface-2 px-2 py-1 rounded text-primary">{selectedReceipt.correlation_id}</code>
                    </div>
                  </div>
                )}

                {viewMode === 'engineer' && selectedReceipt.payload && (
                  <div className="border-t border-border pt-4">
                    <h4 className="text-sm font-medium mb-2">Payload</h4>
                    <pre className="text-xs bg-surface-2 p-3 rounded-lg overflow-x-auto max-h-48">
                      {JSON.stringify(selectedReceipt.payload, null, 2)}
                    </pre>
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
