import { useState, useEffect, useRef, useCallback } from 'react';
import { KPICard } from '@/components/shared/KPICard';
import { Panel } from '@/components/shared/Panel';
import { StatusChip } from '@/components/shared/StatusChip';
import { SeverityBadge } from '@/components/shared/SeverityBadge';
import { PageLoadingState } from '@/components/shared/PageLoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ModeText } from '@/components/shared/ModeText';
import { useSystem } from '@/contexts/SystemContext';
import {
  fetchOpsDeepHealth,
  fetchOpsDashboardMetrics,
  fetchOpsProviders,
  fetchOpsIncidents,
  type OpsDeepHealthResponse,
  type OpsDashboardMetrics,
  type OpsProviderStatus,
  type OpsIncidentSummary,
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
  Shield,
  Clock,
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

export default function SystemHealth() {
  const { viewMode } = useSystem();
  const [deepHealth, setDeepHealth] = useState<OpsDeepHealthResponse | null>(null);
  const [dashMetrics, setDashMetrics] = useState<OpsDashboardMetrics | null>(null);
  const [providers, setProviders] = useState<OpsProviderStatus[]>([]);
  const [incidents, setIncidents] = useState<OpsIncidentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [healthRes, metricsRes, providersRes, incidentsRes] = await Promise.allSettled([
        fetchOpsDeepHealth(),
        fetchOpsDashboardMetrics(),
        fetchOpsProviders(),
        fetchOpsIncidents({ state: 'open', limit: 50 }),
      ]);

      if (!mountedRef.current) return;

      if (healthRes.status === 'fulfilled') setDeepHealth(healthRes.value);
      if (metricsRes.status === 'fulfilled') setDashMetrics(metricsRes.value.metrics);
      if (providersRes.status === 'fulfilled') setProviders(providersRes.value.items);
      if (incidentsRes.status === 'fulfilled') setIncidents(incidentsRes.value.items);

      const allFailed = [healthRes, metricsRes, providersRes, incidentsRes].every(r => r.status === 'rejected');
      if (allFailed) {
        const firstErr = healthRes.status === 'rejected' ? healthRes.reason : null;
        setError(firstErr instanceof Error ? firstErr.message : 'All health checks failed');
      } else {
        setError(null);
      }

      setLoading(false);
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load system health');
        setLoading(false);
      }
    }
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

  if (error && !deepHealth && !dashMetrics) {
    return (
      <div className="space-y-6">
        <div className="page-header">
          <h1 className="page-title">System Health</h1>
        </div>
        <EmptyState
          variant="error"
          title="Failed to load system health"
          description={error}
          actionLabel="Retry"
          onAction={() => { setLoading(true); fetchAll(); }}
        />
      </div>
    );
  }

  const overallStatus = deepHealth?.status ?? 'healthy';
  const checks = deepHealth?.checks ?? {};
  const healthyCount = Object.values(checks).filter(c => c.status === 'ok').length;
  const totalChecks = Object.keys(checks).length;
  const severityBreakdown = dashMetrics?.incidents_by_severity;

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
        <Button variant="outline" size="sm" onClick={() => fetchAll()}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Refresh
        </Button>
      </div>

      {/* Overall Status KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
          value={`${healthyCount}/${totalChecks}`}
          subtitle={healthyCount === totalChecks ? 'All passing' : `${totalChecks - healthyCount} need attention`}
          icon={<Server className="h-4 w-4" />}
          status={healthyCount === totalChecks ? 'success' : 'warning'}
        />
        <KPICard
          title={viewMode === 'operator' ? 'Open Issues' : 'Open Incidents'}
          value={dashMetrics?.incidents_open ?? 0}
          subtitle={severityBreakdown
            ? `${severityBreakdown.p0} P0, ${severityBreakdown.p1} P1`
            : undefined}
          icon={<AlertTriangle className="h-4 w-4" />}
          status={
            (severityBreakdown?.p0 ?? 0) > 0
              ? 'critical'
              : (dashMetrics?.incidents_open ?? 0) > 0
                ? 'warning'
                : 'success'
          }
          linkTo="/incidents"
          linkLabel="View incidents"
        />
        <KPICard
          title={viewMode === 'operator' ? 'Provider Success' : 'Provider Success Rate'}
          value={dashMetrics ? `${dashMetrics.provider_success_rate.toFixed(1)}%` : 'N/A'}
          subtitle={dashMetrics ? `Avg ${dashMetrics.provider_avg_latency_ms.toFixed(0)}ms latency` : undefined}
          icon={<Activity className="h-4 w-4" />}
          status={
            (dashMetrics?.provider_success_rate ?? 100) >= 99
              ? 'success'
              : (dashMetrics?.provider_success_rate ?? 100) >= 95
                ? 'warning'
                : 'critical'
          }
        />
      </div>

      {/* Backend Dependencies */}
      <Panel title={viewMode === 'operator' ? 'Infrastructure Health' : 'Backend Dependencies'}>
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
