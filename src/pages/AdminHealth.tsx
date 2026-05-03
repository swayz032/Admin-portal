import { useMemo } from 'react';
import { AlertTriangle, Activity, DatabaseZap, ServerCog, ShieldCheck } from 'lucide-react';
import {
  StoryActionQueue,
  StoryBrief,
  StoryEvidencePanel,
  StoryMetricCard,
  TelemetryDrawer,
  type StoryActionItem,
} from '@/components/story/StoryPrimitives';
import { PageLoadingState } from '@/components/shared/PageLoadingState';
import { useUnifiedIncidents } from '@/hooks/useUnifiedIncidents';
import { useRealtimeReceipts } from '@/hooks/useRealtimeReceipts';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { useProviders } from '@/hooks/useAdminData';
import { listProviderCallLogs } from '@/services/apiClient';
import type { ProviderCallLog } from '@/contracts';
import { formatLatency, formatTimeAgo } from '@/lib/formatters';
import {
  buildSourceBreakdown,
  classifyIncident,
  customerLabel,
  explainIncident,
  incidentTimestamp,
  partitionIncidents,
  summarizeIncident,
} from '@/lib/storyTriage';

function isRecent(timestamp?: string, hours = 24): boolean {
  if (!timestamp) return false;
  const time = new Date(timestamp).getTime();
  if (Number.isNaN(time)) return false;
  return Date.now() - time <= hours * 60 * 60 * 1000;
}

function latestTimestamp(values: string[]): string | undefined {
  return values.filter(Boolean).sort().at(-1);
}

function severityTone(severity: string): StoryActionItem['tone'] {
  if (severity === 'P0' || severity === 'P1') return 'critical';
  if (severity === 'P2') return 'watch';
  return 'neutral';
}

export default function AdminHealth() {
  const { data: incidents, loading: incidentsLoading, error: incidentsError } = useUnifiedIncidents();
  const { data: receipts, loading: receiptsLoading, error: receiptsError } = useRealtimeReceipts({ pageSize: 500 });
  const { data: providers, loading: providersLoading, error: providersError } = useProviders();
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

  const loading = incidentsLoading && receiptsLoading && providersLoading && providerLogsLoading;
  const errors = [incidentsError, receiptsError, providersError, providerLogsError].filter(Boolean);

  const partitions = useMemo(() => partitionIncidents(incidents), [incidents]);
  const sourceBreakdown = useMemo(() => buildSourceBreakdown(incidents), [incidents]);

  const providerIssues = providers.filter((provider) => provider.status !== 'Healthy');
  const failedReceipts24h = receipts.filter((receipt) =>
    receipt.outcome !== 'Success' && isRecent(receipt.timestamp),
  );
  const failedProviderCalls24h = providerLogs.filter((call) =>
    call.status !== 'success' && isRecent(call.started_at),
  );

  const latest = latestTimestamp([
    ...incidents.map(incidentTimestamp),
    ...receipts.map((receipt) => receipt.timestamp),
    ...providerLogs.map((call) => call.started_at),
  ]);

  const actionItems: StoryActionItem[] = [
    ...partitions.realIncidents.map((incident) => {
      const classification = classifyIncident(incident);
      const story = explainIncident(incident);
      return {
        id: `incident-${incident.id}`,
        title: story.title,
        description: story.impact,
        cause: story.cause,
        fix: story.fix,
        meta: `${incident.severity} - ${classification.sourceLabel} - ${incident.occurrenceCount ?? 1} hit(s) - ${customerLabel(incident)}`,
        tone: severityTone(incident.severity),
        to: `/incidents?id=${incident.id}`,
        actionLabel: 'Investigate',
      };
    }),
    ...providerIssues.slice(0, 4).map((provider) => ({
      id: `provider-${provider.id}`,
      title: `${provider.name} is ${provider.status}`,
      description: `${provider.type} health is degraded by live provider checks.`,
      cause: `${provider.name} is reporting ${provider.status}; p95 latency is ${formatLatency(provider.p95Latency)} with ${provider.errorRate}% errors.`,
      fix: 'Open the provider record, verify current provider status, then pause writes or retry once the provider checks pass.',
      meta: 'Provider health',
      tone: provider.status === 'Writes Paused' ? 'critical' : 'watch',
      to: '/connected-apps',
      actionLabel: 'Open provider',
    } satisfies StoryActionItem)),
    ...partitions.warnings.slice(0, 4).map((incident) => {
      const classification = classifyIncident(incident);
      const story = explainIncident(incident);
      return {
        id: `warning-${incident.id}`,
        title: story.title,
        description: story.impact,
        cause: story.cause,
        fix: story.fix,
        meta: `${incident.severity} - ${classification.sourceLabel}`,
        tone: 'watch',
        to: `/incidents?id=${incident.id}`,
        actionLabel: 'Review',
      } satisfies StoryActionItem;
    }),
  ];

  const tone = partitions.realIncidents.some((incident) => incident.severity === 'P0' || incident.severity === 'P1')
    ? 'critical'
    : partitions.realIncidents.length > 0 || providerIssues.length > 0
      ? 'watch'
      : 'healthy';

  if (loading) {
    return <PageLoadingState showKPIs kpiCount={4} rows={4} />;
  }

  return (
    <div className="story-shell">
      <StoryBrief
        eyebrow="Admin Health"
        title={
          partitions.realIncidents.length > 0
            ? `${partitions.realIncidents.length} real problem${partitions.realIncidents.length === 1 ? '' : 's'} need attention`
            : 'No real admin incidents are promoted'
        }
        summary="This view separates signal from noise. P0 and P1 issues are promoted immediately, repeated P2/P3 patterns are escalated, and weak telemetry stays searchable in Admin Logs without crowding the queue."
        tone={tone}
        meta={[
          latest ? `Fresh ${formatTimeAgo(latest)}` : 'No recent events',
          `${partitions.noise.length} noise signal${partitions.noise.length === 1 ? '' : 's'} separated`,
          `${partitions.resolved.length} resolved in logs`,
        ]}
        primaryAction={{ label: 'Open Admin Logs', to: '/admin-logs' }}
        secondaryAction={{ label: 'Provider Calls', to: '/provider-call-log' }}
      />

      {errors.length > 0 && (
        <div className="story-surface border-destructive/35 bg-destructive/5 px-5 py-4 text-sm text-destructive">
          Some live sources could not load: {errors.join(' | ')}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StoryMetricCard
          label="Real Incidents"
          value={partitions.realIncidents.length}
          story="Only promoted incidents land here. Security, revenue, provider, automation, and core brain failures rise when severity or repetition says they matter."
          source="Receipts + incident triage"
          freshness={latest ? formatTimeAgo(latest) : 'No events'}
          tone={partitions.realIncidents.length > 0 ? 'critical' : 'healthy'}
          icon={AlertTriangle}
          action={{ label: 'Incidents', to: '/incidents' }}
        />
        <StoryMetricCard
          label="Provider Issues"
          value={providerIssues.length}
          story="Connected services are checked separately so provider trouble is not mixed with app, user, or receipt failures."
          source={`${providers.length} providers checked`}
          freshness={providerIssues[0]?.lastChecked ? formatTimeAgo(providerIssues[0].lastChecked) : 'Live checks'}
          tone={providerIssues.length > 0 ? 'watch' : 'healthy'}
          icon={ServerCog}
          action={{ label: 'Providers', to: '/connected-apps' }}
        />
        <StoryMetricCard
          label="Receipt Failures"
          value={failedReceipts24h.length}
          story="Failed and blocked proof receipts in the last 24 hours show what the platform actually attempted and where it broke."
          source={`${receipts.length} recent receipts`}
          freshness={receipts[0]?.timestamp ? formatTimeAgo(receipts[0].timestamp) : 'No receipts'}
          tone={failedReceipts24h.length > 0 ? 'watch' : 'healthy'}
          icon={DatabaseZap}
          action={{ label: 'Proof Log', to: '/receipts' }}
        />
        <StoryMetricCard
          label="Failed Calls"
          value={failedProviderCalls24h.length}
          story="Provider call failures are tracked from request logs, so an external API outage does not look like a generic admin bug."
          source={`${providerLogs.length} provider calls`}
          freshness={providerLogs[0]?.started_at ? formatTimeAgo(providerLogs[0].started_at) : 'No calls'}
          tone={failedProviderCalls24h.length > 0 ? 'watch' : 'healthy'}
          icon={Activity}
          action={{ label: 'Call Log', to: '/provider-call-log' }}
        />
      </div>

      <StoryActionQueue
        title="What needs action"
        subtitle={`${actionItems.length} promoted item${actionItems.length === 1 ? '' : 's'} from live admin data`}
        items={actionItems}
        emptyTitle="Admin signal is clean"
        emptyText="No promoted incidents, provider degradations, or repeated warnings are active right now. Telemetry remains available below for audit."
      />

      <StoryEvidencePanel
        title="Where the problems are coming from"
        description="Sources stay separated so provider calls, user onboarding, admin frontend, automation, and core platform failures keep a visible lane."
        action={{ label: 'System Health', to: '/system-health' }}
      >
        {sourceBreakdown.length === 0 ? (
          <p className="text-sm text-muted-foreground">No incident sources are currently present.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sourceBreakdown.map((source) => (
              <div key={source.category} className="premium-mini-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-foreground">{source.label}</p>
                  <span className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">
                    {source.total} total
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                  <div>
                    <p className="text-lg font-semibold text-destructive">{source.realIncidents}</p>
                    <p className="text-[11px] text-muted-foreground">Real</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-warning">{source.warnings}</p>
                    <p className="text-[11px] text-muted-foreground">Watch</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-muted-foreground">{source.noise}</p>
                    <p className="text-[11px] text-muted-foreground">Noise</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-success">{source.resolved}</p>
                    <p className="text-[11px] text-muted-foreground">Done</p>
                  </div>
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  Last seen {source.lastSeen ? formatTimeAgo(source.lastSeen) : 'not recorded'}
                </p>
              </div>
            ))}
          </div>
        )}
      </StoryEvidencePanel>

      <StoryEvidencePanel
        title="Admin proof trail"
        description="Resolved incidents and lower-confidence telemetry are retained for audit instead of disappearing from the portal."
        action={{ label: 'Metrics', to: '/metrics' }}
      >
        <div className="grid gap-3 md:grid-cols-3">
          <div className="premium-mini-card p-4">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <p className="mt-3 text-2xl font-semibold">{partitions.resolved.length}</p>
            <p className="text-sm text-muted-foreground">resolved incidents retained</p>
          </div>
          <div className="premium-mini-card p-4">
            <DatabaseZap className="h-5 w-5 text-primary" />
            <p className="mt-3 text-2xl font-semibold">{receipts.length}</p>
            <p className="text-sm text-muted-foreground">receipts in current live window</p>
          </div>
          <div className="premium-mini-card p-4">
            <ServerCog className="h-5 w-5 text-primary" />
            <p className="mt-3 text-2xl font-semibold">{providerLogs.length}</p>
            <p className="text-sm text-muted-foreground">provider calls in current log</p>
          </div>
        </div>
      </StoryEvidencePanel>

      <TelemetryDrawer
        title="Noise and resolved history"
        summary={`${partitions.noise.length} noise signal${partitions.noise.length === 1 ? '' : 's'} and ${partitions.resolved.length} resolved incident${partitions.resolved.length === 1 ? '' : 's'} kept out of the priority queue`}
        emptyText="No noise or resolved history is present in the current incident set."
        items={[...partitions.noise, ...partitions.resolved].map((incident) => ({
          id: incident.id,
          title: summarizeIncident(incident),
          meta: `${incident.status} - ${incident.severity} - ${classifyIncident(incident).sourceLabel}`,
          to: `/incidents?id=${incident.id}`,
        }))}
      />
    </div>
  );
}
