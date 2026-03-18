import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSystem } from '@/contexts/SystemContext';
import { Panel } from '@/components/shared/Panel';
import { DataTable } from '@/components/shared/DataTable';
import { StatusChip } from '@/components/shared/StatusChip';
import { PurposeStrip } from '@/components/shared/PurposeStrip';
import { SystemPipelineCard } from '@/components/shared/SystemPipelineCard';
import { ModeText } from '@/components/shared/ModeText';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ProviderCallLog, ProviderCallStatus } from '@/contracts';
import { listProviderCallLogs } from '@/services/apiClient';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { formatTimeAgo } from '@/lib/formatters';
import { formatProviderCallId, formatCorrelationId } from '@/lib/premiumIds';
import { redactPayload } from '@/lib/redactPayload';
import { CopyableId } from '@/components/shared/CopyableId';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import {
  Server,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Timer,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';

// Provider badge colors
const PROVIDER_COLORS: Record<string, string> = {
  stripe: 'bg-purple-500/15 text-purple-400',
  openai: 'bg-green-500/15 text-green-400',
  twilio: 'bg-red-500/15 text-red-400',
  supabase: 'bg-emerald-500/15 text-emerald-400',
  livekit: 'bg-blue-500/15 text-blue-400',
  deepgram: 'bg-cyan-500/15 text-cyan-400',
  elevenlabs: 'bg-pink-500/15 text-pink-400',
  pandadoc: 'bg-orange-500/15 text-orange-400',
  gusto: 'bg-amber-500/15 text-amber-400',
  quickbooks: 'bg-lime-500/15 text-lime-400',
};

function ProviderBadge({ provider }: { provider: string }) {
  const key = provider.toLowerCase();
  const colorClass = PROVIDER_COLORS[key] || 'bg-muted text-muted-foreground';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {provider}
    </span>
  );
}

export default function ProviderCallLogPage() {
  const { viewMode } = useSystem();
  const { data: logs, loading } = useRealtimeSubscription<ProviderCallLog>({
    table: 'provider_call_log',
    events: ['INSERT', 'UPDATE'],
    fetcher: () => listProviderCallLogs(),
    getKey: (item) => item.id,
  });
  const [selectedLog, setSelectedLog] = useState<ProviderCallLog | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const { copiedId, copyToClipboard } = useCopyToClipboard();

  const filteredLogs = logs.filter(l => {
    if (statusFilter !== 'all' && l.status !== statusFilter) return false;
    if (providerFilter !== 'all' && l.provider !== providerFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        l.id.toLowerCase().includes(term) ||
        l.correlation_id.toLowerCase().includes(term) ||
        l.action_type.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const providers = [...new Set(logs.map(l => l.provider))];

  const getStatusColor = (status: ProviderCallStatus): 'success' | 'warning' | 'critical' | 'info' => {
    switch (status) {
      case 'success': return 'success';
      case 'failed': return 'critical';
      case 'timeout': return 'warning';
      case 'rate_limited': return 'warning';
      default: return 'info';
    }
  };

  const getStatusIcon = (status: ProviderCallStatus) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-4 w-4 text-success" />;
      case 'failed': return <XCircle className="h-4 w-4 text-destructive" />;
      case 'timeout': return <Timer className="h-4 w-4 text-warning" />;
      case 'rate_limited': return <AlertTriangle className="h-4 w-4 text-warning" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const columns = viewMode === 'operator' ? [
    {
      key: 'status',
      header: 'Result',
      render: (l: ProviderCallLog) => (
        <div className="flex items-center gap-2">
          {getStatusIcon(l.status)}
          <StatusChip
            status={getStatusColor(l.status)}
            label={l.status === 'success' ? 'OK' : l.status === 'rate_limited' ? 'Rate limited' : l.status}
          />
        </div>
      )
    },
    {
      key: 'provider',
      header: 'Service',
      render: (l: ProviderCallLog) => <ProviderBadge provider={l.provider} />,
    },
    { key: 'action_type', header: 'Action' },
    {
      key: 'duration',
      header: 'Time',
      render: (l: ProviderCallLog) => (
        <span className={l.duration_ms && l.duration_ms > 5000 ? 'text-warning' : 'text-muted-foreground'}>
          {formatDuration(l.duration_ms)}
        </span>
      )
    },
    {
      key: 'started_at',
      header: 'When',
      render: (l: ProviderCallLog) => <span className="text-muted-foreground">{formatTimeAgo(l.started_at)}</span>
    },
  ] : [
    {
      key: 'id',
      header: 'Call ID',
      render: (l: ProviderCallLog) => <CopyableId fullId={l.id} displayId={formatProviderCallId(l.id)} isCopied={copiedId === l.id} onCopy={copyToClipboard} />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (l: ProviderCallLog) => (
        <div className="flex items-center gap-2">
          {getStatusIcon(l.status)}
          <StatusChip status={getStatusColor(l.status)} label={l.status} />
        </div>
      )
    },
    {
      key: 'provider',
      header: 'Provider',
      render: (l: ProviderCallLog) => <ProviderBadge provider={l.provider} />,
    },
    { key: 'action_type', header: 'Action Type' },
    {
      key: 'duration',
      header: 'Duration',
      render: (l: ProviderCallLog) => (
        <span className={l.duration_ms && l.duration_ms > 5000 ? 'text-warning font-medium' : ''}>
          {formatDuration(l.duration_ms)}
        </span>
      )
    },
    {
      key: 'correlation_id',
      header: 'Trace',
      render: (l: ProviderCallLog) => l.correlation_id
        ? <CopyableId fullId={l.correlation_id} displayId={formatCorrelationId(l.correlation_id)} isCopied={copiedId === l.correlation_id} onCopy={copyToClipboard} linkTo={`/trace/${l.correlation_id}`} />
        : <span className="text-muted-foreground text-xs">-</span>
    },
  ];

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">
          <ModeText operator="Service Calls" engineer="Provider Call Log" />
        </h1>
        <p className="page-subtitle">
          <ModeText
            operator="Communication with connected services"
            engineer="Request/response log for external API calls"
          />
        </p>
      </div>

      <PurposeStrip
        operatorPurpose="See every call made to connected services like Stripe, Salesforce, etc."
        engineerPurpose="Full request/response log with timing and correlation for provider API calls."
        operatorAction="Identify slow or failing service calls"
        engineerObjects={['ProviderCallLog', 'Receipt']}
        variant="compact"
      />

      <SystemPipelineCard variant="compact" highlightStep={5} />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search calls..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="timeout">Timeout</SelectItem>
            <SelectItem value="rate_limited">Rate Limited</SelectItem>
          </SelectContent>
        </Select>
        <Select value={providerFilter} onValueChange={setProviderFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Provider" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Providers</SelectItem>
            {providers.map(p => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Logs Table */}
      <Panel noPadding>
        {loading ? (
          <div className="loading-state">Loading call logs...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="empty-state">
            <Server className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-2">
              <ModeText operator="No service calls found" engineer="No provider calls match filters" />
            </h3>
            <p className="text-muted-foreground text-sm">
              <ModeText
                operator="Calls to connected services will appear here"
                engineer="Adjust filters or search term"
              />
            </p>
          </div>
        ) : (
          <DataTable
            data={filteredLogs}
            columns={columns}
            keyExtractor={(l) => l.id}
            onRowClick={(log) => setSelectedLog(log)}
            resultLabel="provider calls"
          />
        )}
      </Panel>

      {/* Log Detail Drawer */}
      <Sheet open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedLog && (
            <>
              <SheetHeader>
                <SheetTitle>
                  <ModeText operator="Call Details" engineer="Provider Call Details" />
                </SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                <div className="flex items-center gap-3">
                  {getStatusIcon(selectedLog.status)}
                  <StatusChip status={getStatusColor(selectedLog.status)} label={selectedLog.status} />
                  <span className="text-muted-foreground">-</span>
                  <span className="text-sm">{formatDuration(selectedLog.duration_ms)}</span>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      <ModeText operator="Service" engineer="Provider" />
                    </span>
                    <ProviderBadge provider={selectedLog.provider} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Action</span>
                    <span className="text-sm">{selectedLog.action_type}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Started</span>
                    <span className="text-sm">{new Date(selectedLog.started_at).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Finished</span>
                    <span className="text-sm">{new Date(selectedLog.finished_at).toLocaleString()}</span>
                  </div>
                </div>

                {viewMode === 'engineer' && (
                  <>
                    <div className="border-t border-border pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Call ID</span>
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-bold text-primary">{formatProviderCallId(selectedLog.id)}</code>
                          <button onClick={() => copyToClipboard(selectedLog.id)} className="text-muted-foreground hover:text-foreground">
                            {copiedId === selectedLog.id ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Suite ID</span>
                        <code className="text-xs bg-surface-2 px-2 py-1 rounded">{selectedLog.suite_id}</code>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Trace</span>
                        <Link
                          to={`/trace/${selectedLog.correlation_id}`}
                          className="text-xs bg-surface-2 px-2 py-1 rounded font-mono text-primary hover:bg-surface-3 flex items-center gap-1"
                        >
                          {formatCorrelationId(selectedLog.correlation_id)}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>

                    <div className="border-t border-border pt-4">
                      <h4 className="text-sm font-medium mb-2">Request Meta</h4>
                      <pre className="text-xs bg-surface-2 p-3 rounded-lg overflow-x-auto max-h-32">
                        {JSON.stringify(redactPayload(selectedLog.request_meta), null, 2)}
                      </pre>
                    </div>

                    <div className="border-t border-border pt-4">
                      <h4 className="text-sm font-medium mb-2">Response Meta</h4>
                      <pre className="text-xs bg-surface-2 p-3 rounded-lg overflow-x-auto max-h-32">
                        {JSON.stringify(redactPayload(selectedLog.response_meta), null, 2)}
                      </pre>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
