import { useMemo, useState } from 'react';
import { AlertTriangle, DatabaseZap, Search, ServerCog } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  StoryBrief,
  StoryEvidencePanel,
  StoryMetricCard,
} from '@/components/story/StoryPrimitives';
import { PageLoadingState } from '@/components/shared/PageLoadingState';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUnifiedIncidents } from '@/hooks/useUnifiedIncidents';
import { useRealtimeReceipts } from '@/hooks/useRealtimeReceipts';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { listProviderCallLogs, derivePremiumActionLabel } from '@/services/apiClient';
import type { ProviderCallLog } from '@/contracts';
import { formatLatency, formatTimeAgo } from '@/lib/formatters';
import {
  classifyIncident,
  explainIncident,
  incidentTimestamp,
  type SignalClass,
} from '@/lib/storyTriage';

type LogType = 'incident' | 'receipt' | 'provider_call';

interface LogRow {
  id: string;
  type: LogType;
  title: string;
  source: string;
  status: string;
  signal: SignalClass;
  when: string;
  detail: string;
  cause: string;
  fix: string;
  evidence: string;
  to: string;
}

const signalLabels: Record<SignalClass, string> = {
  real_incident: 'Real incident',
  warning: 'Watch',
  noise: 'Noise',
  resolved: 'Resolved',
};

const signalClasses: Record<SignalClass, string> = {
  real_incident: 'border-destructive/30 bg-destructive/10 text-destructive',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  noise: 'border-border bg-surface-2 text-muted-foreground',
  resolved: 'border-success/30 bg-success/10 text-success',
};

function typeLabel(type: LogType): string {
  if (type === 'provider_call') return 'Provider Call';
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function receiptCause(outcome: string, provider: string, action: string): string {
  if (outcome === 'Success') {
    return `${provider || 'Internal'} completed ${action}; this is retained as proof, not promoted as a problem.`;
  }
  return `${provider || 'Internal'} returned ${outcome.toLowerCase()} while the system attempted ${action}.`;
}

function receiptFix(outcome: string, trace?: string): string {
  if (outcome === 'Success') return 'No fix needed; keep this receipt as evidence for the completed action.';
  return trace
    ? 'Open the trace, inspect the failed provider response, then retry after the provider or payload issue is corrected.'
    : 'Link this receipt to a trace or user company, then retry once the failing provider response is understood.';
}

function providerCause(status: string, provider: string, action: string, duration?: number | null): string {
  if (status === 'success') {
    return `${provider || 'Provider'} completed ${action}${duration ? ` in ${formatLatency(duration)}` : ''}; this is proof telemetry.`;
  }
  return `${provider || 'Provider'} returned ${status} during ${action}${duration ? ` after ${formatLatency(duration)}` : ''}.`;
}

export default function AdminLogs() {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | LogType>('all');
  const [signalFilter, setSignalFilter] = useState<'all' | SignalClass>('all');

  const { data: incidents, loading: incidentsLoading, error: incidentsError } = useUnifiedIncidents();
  const { data: receipts, loading: receiptsLoading, error: receiptsError } = useRealtimeReceipts({ pageSize: 500 });
  const {
    data: providerLogs,
    loading: providerLogsLoading,
    error: providerLogsError,
  } = useRealtimeSubscription<ProviderCallLog>({
    table: 'provider_call_log',
    events: ['INSERT', 'UPDATE'],
    fetcher: () => listProviderCallLogs(),
    getKey: (item) => item.id,
  });

  const loading = incidentsLoading && receiptsLoading && providerLogsLoading;
  const errors = [incidentsError, receiptsError, providerLogsError].filter(Boolean);

  const rows = useMemo<LogRow[]>(() => {
    const incidentRows = incidents.map((incident): LogRow => {
      const classification = classifyIncident(incident);
      const story = explainIncident(incident);
      return {
        id: `incident-${incident.id}`,
        type: 'incident',
        title: story.title,
        source: classification.sourceLabel,
        status: incident.status,
        signal: classification.signalClass,
        when: incidentTimestamp(incident),
        detail: story.impact,
        cause: story.cause,
        fix: story.fix,
        evidence: story.evidence,
        to: `/incidents?id=${incident.id}`,
      };
    });

    const receiptRows = receipts.map((receipt): LogRow => {
      const title = derivePremiumActionLabel(receipt.actionType || receipt.provider, 'engineer');
      return {
        id: `receipt-${receipt.id}`,
        type: 'receipt',
        title,
        source: receipt.provider || 'Internal',
        status: receipt.outcome,
        signal: receipt.outcome === 'Success' ? 'noise' : 'warning',
        when: receipt.timestamp,
        detail: receipt.outcome === 'Success' ? 'Completed proof receipt' : 'Receipt needs review',
        cause: receiptCause(receipt.outcome, receipt.provider, title),
        fix: receiptFix(receipt.outcome, receipt.correlationId),
        evidence: receipt.correlationId ? `Trace ${receipt.correlationId}` : 'Receipt has no trace linked',
        to: receipt.correlationId ? `/trace/${receipt.correlationId}` : '/receipts',
      };
    });

    const providerRows = providerLogs.map((log): LogRow => {
      const title = derivePremiumActionLabel(log.action_type, 'engineer');
      return {
        id: `provider-${log.id}`,
        type: 'provider_call',
        title,
        source: log.provider || 'Provider',
        status: log.status,
        signal: log.status === 'success' ? 'noise' : 'warning',
        when: log.started_at,
        detail: log.status === 'success' ? 'Provider call completed' : 'Provider call needs review',
        cause: providerCause(log.status, log.provider, title, log.duration_ms),
        fix: log.status === 'success'
          ? 'No fix needed; keep this call as evidence.'
          : 'Open the provider call, verify request and response, then retry or pause writes until the provider recovers.',
        evidence: log.correlation_id ? `Trace ${log.correlation_id}` : 'Provider call has no trace linked',
        to: log.correlation_id ? `/trace/${log.correlation_id}` : '/provider-call-log',
      };
    });

    return [...incidentRows, ...receiptRows, ...providerRows].sort((a, b) =>
      new Date(b.when || 0).getTime() - new Date(a.when || 0).getTime(),
    );
  }, [incidents, receipts, providerLogs]);

  const filteredRows = rows.filter((row) => {
    if (typeFilter !== 'all' && row.type !== typeFilter) return false;
    if (signalFilter !== 'all' && row.signal !== signalFilter) return false;
    if (!query.trim()) return true;
    const haystack = `${row.title} ${row.source} ${row.status} ${row.detail} ${row.cause} ${row.fix} ${row.evidence} ${row.id}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  const realCount = rows.filter((row) => row.signal === 'real_incident').length;
  const warningCount = rows.filter((row) => row.signal === 'warning').length;
  const resolvedCount = rows.filter((row) => row.signal === 'resolved').length;
  const noiseCount = rows.filter((row) => row.signal === 'noise').length;
  const latest = rows[0]?.when;

  if (loading) {
    return <PageLoadingState showKPIs kpiCount={4} rows={8} />;
  }

  return (
    <div className="story-shell">
      <StoryBrief
        eyebrow="Admin Logs"
        title="Every incident, receipt, and provider call stays searchable"
        summary="Resolved incidents do not disappear. Low-confidence telemetry is retained as noise, real incidents remain promoted, and every row keeps its source so problems can be traced back to where they came from."
        tone={realCount > 0 ? 'critical' : warningCount > 0 ? 'watch' : 'healthy'}
        meta={[
          `${rows.length} total log rows`,
          `${resolvedCount} resolved retained`,
          latest ? `Latest ${formatTimeAgo(latest)}` : 'No logs loaded',
        ]}
        primaryAction={{ label: 'Admin Health', to: '/admin-health' }}
        secondaryAction={{ label: 'Proof Log', to: '/receipts' }}
      />

      {errors.length > 0 && (
        <div className="story-surface border-destructive/35 bg-destructive/5 px-5 py-4 text-sm text-destructive">
          Some live sources could not load: {errors.join(' | ')}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StoryMetricCard
          label="Real Incidents"
          value={realCount}
          story="Promoted incident groups that require action before they become hidden in raw telemetry."
          source="Incident triage"
          freshness={latest ? formatTimeAgo(latest) : 'No logs'}
          tone={realCount > 0 ? 'critical' : 'healthy'}
          icon={AlertTriangle}
          action={{ label: 'Incidents', to: '/incidents' }}
        />
        <StoryMetricCard
          label="Warnings"
          value={warningCount}
          story="Provider failures, failed receipts, or repeated low-priority patterns that should be watched."
          source="Receipts + calls"
          freshness={latest ? formatTimeAgo(latest) : 'No logs'}
          tone={warningCount > 0 ? 'watch' : 'healthy'}
          icon={ServerCog}
        />
        <StoryMetricCard
          label="Resolved"
          value={resolvedCount}
          story="Closed incident groups remain available for audit and repeat-pattern detection."
          source="Incident history"
          freshness={latest ? formatTimeAgo(latest) : 'No logs'}
          tone="healthy"
          icon={DatabaseZap}
        />
        <StoryMetricCard
          label="Noise"
          value={noiseCount}
          story="Successful receipts, successful calls, and weak signals stay here without crowding the action queue."
          source="Telemetry"
          freshness={latest ? formatTimeAgo(latest) : 'No logs'}
          tone="neutral"
          icon={Search}
        />
      </div>

      <StoryEvidencePanel
        title="Searchable proof trail"
        description="Filter by source type or signal class. Rows show the story, cause, fix, and evidence instead of raw event labels."
      >
        <div className="mb-4 flex flex-col gap-3 lg:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, source, status, trace, or id..."
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as typeof typeFilter)}>
            <SelectTrigger className="w-full lg:w-[180px]">
              <SelectValue placeholder="Source type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="incident">Incidents</SelectItem>
              <SelectItem value="receipt">Receipts</SelectItem>
              <SelectItem value="provider_call">Provider Calls</SelectItem>
            </SelectContent>
          </Select>
          <Select value={signalFilter} onValueChange={(value) => setSignalFilter(value as typeof signalFilter)}>
            <SelectTrigger className="w-full lg:w-[180px]">
              <SelectValue placeholder="Signal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Signals</SelectItem>
              <SelectItem value="real_incident">Real Incidents</SelectItem>
              <SelectItem value="warning">Warnings</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="noise">Noise</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-hidden rounded-lg border border-border">
          <div className="grid grid-cols-[110px_1fr_130px_130px] gap-3 border-b border-border bg-surface-2 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground max-lg:hidden">
            <span>Type</span>
            <span>Story</span>
            <span>Signal</span>
            <span>When</span>
          </div>
          {filteredRows.length === 0 ? (
            <p className="px-4 py-8 text-sm text-muted-foreground">No log rows match the current filters.</p>
          ) : (
            <div className="story-list-scroll divide-y divide-border">
              {filteredRows.slice(0, 80).map((row) => (
                <Link
                  key={row.id}
                  to={row.to}
                  className="grid gap-3 px-4 py-3 transition-colors hover:bg-surface-2 lg:grid-cols-[110px_1fr_130px_130px] lg:items-center"
                >
                  <div>
                    <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-xs text-muted-foreground">
                      {typeLabel(row.type)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{row.title}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {row.source} - {row.status} - {row.evidence}
                    </p>
                    <p className="mt-1 truncate text-xs text-foreground">
                      Cause: {row.cause}
                    </p>
                    <p className="mt-1 truncate text-xs text-primary">
                      Fix: {row.fix}
                    </p>
                  </div>
                  <div>
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${signalClasses[row.signal]}`}>
                      {signalLabels[row.signal]}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {row.when ? formatTimeAgo(row.when) : 'No time'}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </StoryEvidencePanel>
    </div>
  );
}
