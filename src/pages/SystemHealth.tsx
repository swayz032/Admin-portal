import { useState, useEffect, useRef, useCallback } from 'react';
import { KPICard } from '@/components/shared/KPICard';
import { Panel } from '@/components/shared/Panel';
import { StatusChip } from '@/components/shared/StatusChip';
import { SeverityBadge } from '@/components/shared/SeverityBadge';
import { PageLoadingState } from '@/components/shared/PageLoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ModeText } from '@/components/shared/ModeText';
import { useSystem } from '@/contexts/SystemContext';
import { supabase } from '@/integrations/supabase/client';
import {
  fetchOpsDeepHealth,
  fetchOpsDashboardMetrics,
  fetchOpsProviders,
  fetchOpsIncidents,
  fetchOpsSentrySummary,
  fetchOpsSentryIssues,
  type OpsDeepHealthResponse,
  type OpsDashboardMetrics,
  type OpsProviderStatus,
  type OpsIncidentSummary,
  type OpsSentrySummary,
  type OpsSentryIssue,
} from '@/services/opsFacadeClient';
import {
  Server,
  Database,
  Cpu,
  Brain,
  Zap,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Activity,
  Clock,
  WifiOff,
  Bug,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatTimeAgo } from '@/lib/formatters';

const REFRESH_INTERVAL_MS = 30_000;

const DEPENDENCY_ICONS: Record<string, typeof Server> = {
  postgres: Database,
  redis: Cpu,
  openai: Brain,
  n8n: Zap,
};

function getDependencyLabel(key: string): string {
  const labels: Record<string, string> = {
    postgres: 'PostgreSQL',
    redis: 'Redis',
    openai: 'OpenAI',
    n8n: 'n8n Workflows',
  };
  return labels[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getStatusChipProps(status: string): { status: 'success' | 'warning' | 'critical'; label: string } {
  switch (status) {
    case 'ok':
      return { status: 'success', label: 'Healthy' };
    case 'degraded':
      return { status: 'warning', label: 'Degraded' };
    case 'down':
      return { status: 'critical', label: 'Down' };
    default:
      return { status: 'warning', label: status };
  }
}

function getProviderStatusChip(status: string): { status: 'success' | 'warning' | 'critical'; label: string } {
  switch (status) {
    case 'connected':
      return { status: 'success', label: 'Connected' };
    case 'degraded':
      return { status: 'warning', label: 'Degraded' };
    case 'disconnected':
      return { status: 'critical', label: 'Disconnected' };
    default:
      return { status: 'warning', label: status };
  }
}

function worstStatus(...statuses: Array<'healthy' | 'degraded' | 'critical' | null | undefined>): 'healthy' | 'degraded' | 'critical' {
  const severity = { healthy: 0, degraded: 1, critical: 2 };
  return statuses.reduce<'healthy' | 'degraded' | 'critical'>((worst, candidate) => {
    if (!candidate) return worst;
    return severity[candidate] > severity[worst] ? candidate : worst;
  }, 'healthy');
}

function coerceSentryStatus(status: OpsSentrySummary['status'] | undefined): 'healthy' | 'degraded' | 'critical' | null {
  if (status === 'healthy' || status === 'degraded' || status === 'critical') {
    return status;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Supabase direct queries (primary data source)
// ---------------------------------------------------------------------------

interface SupabaseIncidentCount {
  severity: string;
  count: number;
}

interface SupabaseProviderRow {
  provider: string;
  calls: number;
  avg_latency: number;
  failures: number;
}

interface SupabaseIncidentRow {
  id: string;
  status: string;
  severity: string;
  title: string;
  correlation_id: string;
  suite_id: string | null;
  created_at: string;
  updated_at: string;
}

async function fetchSupabaseIncidentCounts(): Promise<SupabaseIncidentCount[]> {
  // Derive incident counts from FAILED/DENIED receipts in last 24h
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: rows, error } = await supabase
    .from('receipts')
    .select('status')
    .gte('created_at', since)
    .in('status', ['FAILED', 'DENIED']);
  if (error || !rows) return [];

  // Map failure count to severity: >50 failures = P0, >20 = P1, >5 = P2, else P3
  const failCount = rows.length;
  if (failCount === 0) return [];
  if (failCount > 50) return [{ severity: 'P0', count: failCount }];
  if (failCount > 20) return [{ severity: 'P1', count: failCount }];
  if (failCount > 5) return [{ severity: 'P2', count: failCount }];
  return [{ severity: 'P3', count: failCount }];
}

async function fetchSupabaseProviderHealth(): Promise<SupabaseProviderRow[]> {
  // Derive provider health from receipts (receipt_type prefix → provider name)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: rows, error } = await supabase
    .from('receipts')
    .select('receipt_type, status')
    .gte('created_at', since);
  if (error || !rows) return [];

  // Map receipt_type prefix to provider name
  const providerMap: Record<string, string> = {
    stripe: 'Stripe', mail: 'PolarisM', calendar: 'Google Calendar',
    pandadoc: 'PandaDoc', quickbooks: 'QuickBooks', twilio: 'Twilio',
    livekit: 'LiveKit', elevenlabs: 'ElevenLabs', deepgram: 'Deepgram',
    gusto: 'Gusto', moov: 'Moov', plaid: 'Plaid', exa: 'Exa',
    n8n: 'n8n', orchestrator: 'Orchestrator',
  };

  const agg: Record<string, { calls: number; failures: number }> = {};
  for (const r of rows) {
    const rt = (r.receipt_type ?? '').toLowerCase();
    const prefix = Object.keys(providerMap).find(p => rt.startsWith(p));
    const provider = prefix ? providerMap[prefix] : 'Internal';
    if (!agg[provider]) agg[provider] = { calls: 0, failures: 0 };
    agg[provider].calls++;
    if (r.status === 'FAILED' || r.status === 'DENIED') agg[provider].failures++;
  }
  return Object.entries(agg).map(([provider, v]) => ({
    provider,
    calls: v.calls,
    avg_latency: 0, // receipts don't have latency data
    failures: v.failures,
  }));
}

async function fetchSupabaseOpenIncidents(): Promise<SupabaseIncidentRow[]> {
  // Derive "open incidents" from recent FAILED/DENIED receipts
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('receipts')
    .select('receipt_id, status, receipt_type, action, correlation_id, suite_id, created_at')
    .gte('created_at', since)
    .in('status', ['FAILED', 'DENIED'])
    .order('created_at', { ascending: false })
    .limit(50);
  if (error || !data) return [];

  return data.map(r => {
    const action = (r.action ?? {}) as Record<string, unknown>;
    const actionType = (action.action_type as string) ?? (r.receipt_type ?? 'unknown');
    return {
      id: r.receipt_id,
      status: 'open',
      severity: 'P2', // All receipt-derived incidents default to P2
      title: `${actionType} — ${r.status}`,
      correlation_id: r.correlation_id ?? '',
      suite_id: r.suite_id,
      created_at: r.created_at,
      updated_at: r.created_at,
    };
  });
}

// ---------------------------------------------------------------------------
// Derive overall status from Supabase incident counts
// ---------------------------------------------------------------------------
function deriveOverallStatus(counts: SupabaseIncidentCount[]): 'healthy' | 'degraded' | 'critical' {
  const hasCritical = counts.some(c => (c.severity === 'critical' || c.severity === 'P0') && c.count > 0);
  if (hasCritical) return 'critical';
  const hasHigh = counts.some(c => (c.severity === 'high' || c.severity === 'P1') && c.count > 0);
  if (hasHigh) return 'degraded';
  return 'healthy';
}

// Maps both naming conventions: critical/high/medium/low AND P0/P1/P2/P3
const SEVERITY_TO_SLOT: Record<string, 'p0' | 'p1' | 'p2' | 'p3'> = {
  critical: 'p0', P0: 'p0',
  high: 'p1', P1: 'p1',
  medium: 'p2', P2: 'p2',
  low: 'p3', P3: 'p3',
};

function deriveSeverityBreakdown(counts: SupabaseIncidentCount[]): { p0: number; p1: number; p2: number; p3: number } {
  const breakdown = { p0: 0, p1: 0, p2: 0, p3: 0 };
  for (const c of counts) {
    const slot = SEVERITY_TO_SLOT[c.severity];
    if (slot) breakdown[slot] += c.count;
  }
  return breakdown;
}

// Convert Supabase provider rows to OpsProviderStatus shape for the UI
function toProviderStatus(rows: SupabaseProviderRow[]): OpsProviderStatus[] {
  return rows.map(r => {
    const errorRate = r.calls > 0 ? (r.failures / r.calls) * 100 : 0;
    let status: 'connected' | 'degraded' | 'disconnected' = 'connected';
    if (errorRate > 50) status = 'disconnected';
    else if (errorRate > 5) status = 'degraded';
    return {
      provider: r.provider,
      lane: '',
      status,
      connection_status: status,
      scopes: [],
      last_checked: new Date().toISOString(),
      latency_ms: r.avg_latency,
      p95_latency_ms: 0,
      error_rate: errorRate,
      webhook_error_rate: 0,
    };
  });
}

// Convert Supabase incident rows to OpsIncidentSummary shape for the UI
function toIncidentSummary(rows: SupabaseIncidentRow[]): OpsIncidentSummary[] {
  return rows.map(r => ({
    incident_id: r.id,
    state: r.status,
    severity: r.severity,
    title: r.title,
    correlation_id: r.correlation_id ?? '',
    suite_id: r.suite_id,
    first_seen: r.created_at,
    last_seen: r.updated_at,
  }));
}

export default function SystemHealth() {
  const { viewMode } = useSystem();
  const [deepHealth, setDeepHealth] = useState<OpsDeepHealthResponse | null>(null);
  const [dashMetrics, setDashMetrics] = useState<OpsDashboardMetrics | null>(null);
  const [providers, setProviders] = useState<OpsProviderStatus[]>([]);
  const [incidents, setIncidents] = useState<OpsIncidentSummary[]>([]);
  const [sentrySummary, setSentrySummary] = useState<OpsSentrySummary | null>(null);
  const [sentryIssues, setSentryIssues] = useState<OpsSentryIssue[]>([]);
  const [sentrySource, setSentrySource] = useState<string>('disabled');
  const [sentryWarnings, setSentryWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [backendOffline, setBackendOffline] = useState(false);

  // Supabase-derived state
  const [sbOverallStatus, setSbOverallStatus] = useState<'healthy' | 'degraded' | 'critical'>('healthy');
  const [sbSeverityBreakdown, setSbSeverityBreakdown] = useState<{ p0: number; p1: number; p2: number; p3: number }>({ p0: 0, p1: 0, p2: 0, p3: 0 });
  const [sbIncidentsOpen, setSbIncidentsOpen] = useState(0);
  const [supabaseLoaded, setSupabaseLoaded] = useState(false);

  const mountedRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async () => {
    // -----------------------------------------------------------------------
    // PRIMARY: Supabase direct queries (always succeed if Supabase is up)
    // -----------------------------------------------------------------------
    const [sbCountsRes, sbProvidersRes, sbIncidentsRes] = await Promise.allSettled([
      fetchSupabaseIncidentCounts(),
      fetchSupabaseProviderHealth(),
      fetchSupabaseOpenIncidents(),
    ]);

    if (!mountedRef.current) return;

    let sbLoaded = false;

    if (sbCountsRes.status === 'fulfilled') {
      const counts = sbCountsRes.value;
      setSbOverallStatus(deriveOverallStatus(counts));
      const breakdown = deriveSeverityBreakdown(counts);
      setSbSeverityBreakdown(breakdown);
      setSbIncidentsOpen(breakdown.p0 + breakdown.p1 + breakdown.p2 + breakdown.p3);
      sbLoaded = true;
    }

    if (sbProvidersRes.status === 'fulfilled' && sbProvidersRes.value.length > 0) {
      setProviders(toProviderStatus(sbProvidersRes.value));
      sbLoaded = true;
    }

    if (sbIncidentsRes.status === 'fulfilled') {
      setIncidents(toIncidentSummary(sbIncidentsRes.value));
      sbLoaded = true;
    }

    if (sbLoaded) {
      setSupabaseLoaded(true);
    }

    // -----------------------------------------------------------------------
    // OPTIONAL: Ops facade (enhances data if backend is reachable)
    // -----------------------------------------------------------------------
    try {
      const [healthRes, metricsRes, providersRes, incidentsRes, sentrySummaryRes, sentryIssuesRes] = await Promise.allSettled([
        fetchOpsDeepHealth(),
        fetchOpsDashboardMetrics(),
        fetchOpsProviders(),
        fetchOpsIncidents({ state: 'open', limit: 50 }),
        fetchOpsSentrySummary(),
        fetchOpsSentryIssues({ limit: 10 }),
      ]);

      if (!mountedRef.current) return;

      const allFailed = [healthRes, metricsRes, providersRes, incidentsRes, sentrySummaryRes, sentryIssuesRes].every(r => r.status === 'rejected');

      if (allFailed) {
        // Backend unreachable — Supabase data is still displayed
        setBackendOffline(true);
      } else {
        setBackendOffline(false);

        // Merge ops facade data (overrides Supabase where available)
        if (healthRes.status === 'fulfilled') setDeepHealth(healthRes.value);
        if (metricsRes.status === 'fulfilled') setDashMetrics(metricsRes.value.metrics);
        if (providersRes.status === 'fulfilled' && providersRes.value.items.length > 0) {
          setProviders(providersRes.value.items);
        }
        if (incidentsRes.status === 'fulfilled' && incidentsRes.value.items.length > 0) {
          setIncidents(incidentsRes.value.items);
        }
        if (sentrySummaryRes.status === 'fulfilled') {
          setSentrySummary(sentrySummaryRes.value.summary);
          setSentrySource(sentrySummaryRes.value.summary.source);
          setSentryWarnings(sentrySummaryRes.value.summary.warnings ?? []);
        }
        if (sentryIssuesRes.status === 'fulfilled') {
          setSentryIssues(sentryIssuesRes.value.items);
        }
      }
    } catch {
      if (mountedRef.current) setBackendOffline(true);
    }

    if (mountedRef.current) setLoading(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchAll();

    intervalRef.current = setInterval(() => {
      if (mountedRef.current) fetchAll();
    }, REFRESH_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchAll]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="page-header">
          <h1 className="page-title">System Health</h1>
        </div>
        <PageLoadingState showKPIs kpiCount={4} rows={6} />
      </div>
    );
  }

  // Only show full error if BOTH Supabase and backend failed
  if (!supabaseLoaded && !deepHealth && !dashMetrics) {
    return (
      <div className="space-y-6">
        <div className="page-header">
          <h1 className="page-title">System Health</h1>
        </div>
        <EmptyState
          variant="error"
          title="Failed to load system health"
          description="Both Supabase and backend are unreachable. Check your network connection."
          actionLabel="Retry"
          onAction={() => { setLoading(true); fetchAll(); }}
        />
      </div>
    );
  }

  // Prefer ops facade status, fall back to Supabase-derived
  const overallStatus = worstStatus(
    deepHealth?.status ?? sbOverallStatus,
    sentrySummary?.configured ? coerceSentryStatus(sentrySummary.status) : null,
  );
  const checks = deepHealth?.checks ?? {};
  const healthyCount = Object.values(checks).filter(c => c.status === 'ok').length;
  const totalChecks = Object.keys(checks).length;

  // Prefer ops facade metrics, fall back to Supabase-derived
  const incidentsOpen = dashMetrics?.incidents_open ?? sbIncidentsOpen;
  const severityBreakdown = dashMetrics?.incidents_by_severity ?? sbSeverityBreakdown;
  const providerSuccessRate = dashMetrics?.provider_success_rate;
  const providerAvgLatency = dashMetrics?.provider_avg_latency_ms;

  // Compute provider success rate from Supabase data if ops facade is offline
  let displaySuccessRate: string;
  let displayLatency: string | undefined;
  if (providerSuccessRate !== undefined) {
    displaySuccessRate = `${providerSuccessRate.toFixed(1)}%`;
    displayLatency = providerAvgLatency !== undefined ? `Avg ${providerAvgLatency.toFixed(0)}ms latency` : undefined;
  } else if (providers.length > 0) {
    const totalCalls = providers.reduce((s, p) => s + (p.error_rate !== undefined ? 1 : 0), 0);
    const avgErrorRate = totalCalls > 0 ? providers.reduce((s, p) => s + p.error_rate, 0) / totalCalls : 0;
    displaySuccessRate = `${(100 - avgErrorRate).toFixed(1)}%`;
    const avgLat = providers.reduce((s, p) => s + p.latency_ms, 0) / (providers.length || 1);
    displayLatency = `Avg ${avgLat.toFixed(0)}ms latency`;
  } else {
    displaySuccessRate = 'N/A';
    displayLatency = undefined;
  }

  const successRateNum = providerSuccessRate ?? (providers.length > 0 ? 100 - providers.reduce((s, p) => s + p.error_rate, 0) / providers.length : 100);
  const sentryOpenCount = sentrySummary?.open_issue_count ?? 0;
  const sentryCriticalCount = sentrySummary?.critical_count ?? 0;
  const sentryStatus = coerceSentryStatus(sentrySummary?.status) ?? 'healthy';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">
            <ModeText operator="System Health" engineer="System Health Monitor" />
          </h1>
          <p className="page-subtitle">
            <ModeText
              operator="How your infrastructure is performing"
              engineer="Backend dependency health, provider status, and open incidents"
            />
          </p>
        </div>
        <div className="flex items-center gap-2">
          {backendOffline && (
            <span className="flex items-center gap-1.5 text-xs text-warning bg-warning/10 px-2.5 py-1 rounded-full border border-warning/20">
              <WifiOff className="h-3 w-3" />
              Backend offline
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => fetchAll()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overall Status KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <KPICard
          title={viewMode === 'operator' ? 'System Status' : 'Overall Health'}
          value={overallStatus === 'healthy' ? 'Healthy' : overallStatus === 'degraded' ? 'Degraded' : 'Critical'}
          icon={overallStatus === 'healthy'
            ? <CheckCircle className="h-4 w-4" />
            : overallStatus === 'degraded'
              ? <AlertTriangle className="h-4 w-4" />
              : <XCircle className="h-4 w-4" />}
          status={overallStatus === 'healthy' ? 'success' : overallStatus === 'degraded' ? 'warning' : 'critical'}
        />
        <KPICard
          title={viewMode === 'operator' ? 'Services OK' : 'Dependencies Healthy'}
          value={totalChecks > 0 ? `${healthyCount}/${totalChecks}` : (backendOffline ? 'Backend offline' : '0/0')}
          subtitle={totalChecks > 0
            ? (healthyCount === totalChecks ? 'All passing' : `${totalChecks - healthyCount} need attention`)
            : (backendOffline ? 'Requires backend connection' : undefined)}
          icon={<Server className="h-4 w-4" />}
          status={totalChecks > 0 ? (healthyCount === totalChecks ? 'success' : 'warning') : (backendOffline ? 'warning' : 'success')}
        />
        <KPICard
          title={viewMode === 'operator' ? 'Open Issues' : 'Open Incidents'}
          value={incidentsOpen}
          subtitle={`${severityBreakdown.p0} P0, ${severityBreakdown.p1} P1`}
          icon={<AlertTriangle className="h-4 w-4" />}
          status={
            severityBreakdown.p0 > 0
              ? 'critical'
              : incidentsOpen > 0
                ? 'warning'
                : 'success'
          }
          linkTo="/incidents"
          linkLabel="View incidents"
        />
        <KPICard
          title={viewMode === 'operator' ? 'Provider Success' : 'Provider Success Rate'}
          value={displaySuccessRate}
          subtitle={displayLatency}
          icon={<Activity className="h-4 w-4" />}
          status={
            successRateNum >= 99
              ? 'success'
              : successRateNum >= 95
                ? 'warning'
                : 'critical'
          }
        />
        <KPICard
          title="Sentry Issues"
          value={sentryOpenCount}
          subtitle={sentrySource === 'disabled'
            ? 'Sentry not configured'
            : sentrySource === 'unavailable'
              ? 'Sentry API unavailable'
              : sentrySummary?.regression_count
                ? `${sentrySummary.regression_count} regressions`
                : sentryOpenCount > 0
                  ? `${sentryCriticalCount} high severity`
                  : 'No active issues'}
          icon={<Bug className="h-4 w-4" />}
          status={
            sentrySource === 'disabled' || sentrySource === 'unavailable'
              ? 'warning'
              : sentryStatus === 'critical'
                ? 'critical'
                : sentryStatus === 'degraded'
                  ? 'warning'
                  : 'success'
          }
        />
      </div>

      {/* Backend Dependencies */}
      <Panel title={viewMode === 'operator' ? 'Infrastructure Health' : 'Backend Dependencies'}>
        {backendOffline && Object.keys(checks).length === 0 ? (
          <div className="flex items-center gap-3 p-4 rounded-lg border border-warning/30 bg-warning/5">
            <WifiOff className="h-5 w-5 text-warning" />
            <div>
              <p className="text-sm font-medium text-foreground">Backend offline</p>
              <p className="text-xs text-muted-foreground">
                Dependency checks (PostgreSQL, Redis, OpenAI, n8n) require the backend to be reachable.
                Supabase data is still displayed in other panels.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(checks).map(([key, check]) => {
                const Icon = DEPENDENCY_ICONS[key] ?? Server;
                const chipProps = getStatusChipProps(check.status);
                return (
                  <div
                    key={key}
                    className="flex items-start gap-3 p-4 rounded-lg border border-border bg-surface-1"
                  >
                    <div className={`p-2 rounded-lg ${
                      check.status === 'ok' ? 'bg-success/10 text-success' :
                      check.status === 'degraded' ? 'bg-warning/10 text-warning' :
                      'bg-destructive/10 text-destructive'
                    }`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-sm font-medium text-foreground">
                          {getDependencyLabel(key)}
                        </span>
                        <StatusChip status={chipProps.status} label={chipProps.label} />
                      </div>
                      {check.latency_ms !== undefined && (
                        <p className="text-xs text-muted-foreground">
                          Latency: {check.latency_ms.toFixed(0)}ms
                        </p>
                      )}
                      {check.error && (
                        <p className="text-xs text-destructive mt-1 truncate" title={check.error}>
                          {check.error}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {Object.keys(checks).length === 0 && (
              <EmptyState variant="no-data" title="No dependency checks available" />
            )}
          </>
        )}
      </Panel>

      {/* Sentry Health */}
      <Panel
        title="Sentry"
        subtitle={sentrySummary?.issues_url ? 'Linked to live Sentry issue data' : 'Operational error and regression summary'}
        action={
          sentrySummary?.issues_url ? (
            <a
              href={sentrySummary.issues_url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              Open Sentry
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : undefined
        }
      >
        {sentrySource === 'disabled' ? (
          <EmptyState
            variant="no-data"
            title="Sentry is not configured"
            description="Add Sentry credentials to enable issue sync and release tracking."
          />
        ) : sentrySource === 'unavailable' ? (
          <EmptyState
            variant="error"
            title="Sentry sync unavailable"
            description={sentryWarnings[0] ?? 'The Sentry API could not be reached.'}
          />
        ) : sentryIssues.length > 0 ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <StatusChip
                status={sentryStatus === 'critical' ? 'critical' : sentryStatus === 'degraded' ? 'warning' : 'success'}
                label={sentryStatus === 'critical' ? 'Action required' : sentryStatus === 'degraded' ? 'Issues open' : 'Healthy'}
              />
              {typeof sentrySummary?.project_count === 'number' && sentrySummary.project_count > 0 ? (
                <span>{sentrySummary.project_count} projects affected</span>
              ) : null}
              {sentrySummary?.last_seen ? (
                <span>Last seen {formatTimeAgo(sentrySummary.last_seen)}</span>
              ) : null}
            </div>
            <div className="space-y-2">
              {sentryIssues.map((issue) => (
                <a
                  key={issue.id}
                  href={issue.permalink ?? sentrySummary?.issues_url ?? '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-accent/30 transition-colors"
                >
                  <SeverityBadge severity={issue.level === 'fatal' || issue.level === 'error' ? 'P1' : 'P3'} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{issue.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {issue.project_name} - {issue.count} events - {issue.user_count} users
                      {issue.is_regression ? ' - regression' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {issue.last_seen ? formatTimeAgo(issue.last_seen) : 'Unknown'}
                  </div>
                </a>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState
            variant="all-done"
            title="No active Sentry issues"
            description="No unresolved Sentry issues are currently affecting tracked surfaces."
          />
        )}
      </Panel>

      {/* Provider Health Matrix */}
      <Panel
        title={viewMode === 'operator' ? 'Connected Services' : 'Provider Health Matrix'}
        subtitle={`${providers.length} providers monitored`}
      >
        {providers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Provider</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Status</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Latency</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Error Rate</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Last Checked</th>
                </tr>
              </thead>
              <tbody>
                {providers.map((p) => {
                  const chipProps = getProviderStatusChip(p.status);
                  return (
                    <tr key={`${p.provider}-${p.lane}`} className="border-b border-border/50 hover:bg-accent/30">
                      <td className="py-2.5 px-3 font-medium text-foreground">
                        {p.provider.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        {p.lane && (
                          <span className="text-xs text-muted-foreground ml-1.5">({p.lane})</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <StatusChip status={chipProps.status} label={chipProps.label} />
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {p.latency_ms > 0 ? `${p.latency_ms.toFixed(0)}ms` : '--'}
                        {viewMode === 'engineer' && p.p95_latency_ms > 0 && (
                          <span className="text-xs text-muted-foreground/60 ml-1">
                            (p95: {p.p95_latency_ms.toFixed(0)}ms)
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={p.error_rate > 5 ? 'text-destructive' : p.error_rate > 1 ? 'text-warning' : 'text-muted-foreground'}>
                          {p.error_rate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground text-xs">
                        {p.last_checked ? formatTimeAgo(p.last_checked) : 'Never'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState variant="no-data" title="No provider data available" />
        )}
      </Panel>

      {/* Open Incidents by Severity */}
      <Panel
        title={viewMode === 'operator' ? 'Current Issues' : 'Open Incidents by Severity'}
        action={
          <a href="/incidents" className="text-xs text-primary hover:underline">
            View all
          </a>
        }
      >
        {incidents.length > 0 ? (
          <div className="space-y-2">
            {incidents.map((incident) => (
              <div
                key={incident.incident_id}
                className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-accent/30 transition-colors"
              >
                <SeverityBadge severity={incident.severity as 'P0' | 'P1' | 'P2' | 'P3'} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{incident.title}</p>
                  {viewMode === 'engineer' && (
                    <p className="text-xs text-muted-foreground font-mono">{incident.correlation_id}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {formatTimeAgo(incident.first_seen)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            variant="all-done"
            title={viewMode === 'operator' ? 'No current issues' : 'No open incidents'}
            description="All systems are running without issues."
          />
        )}
      </Panel>
    </div>
  );
}
