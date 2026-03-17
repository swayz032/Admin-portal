import { useState, useEffect, useRef, useCallback } from 'react';
import { KPICard } from '@/components/shared/KPICard';
import { Panel } from '@/components/shared/Panel';
import { PageLoadingState } from '@/components/shared/PageLoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ModeText } from '@/components/shared/ModeText';
import { useSystem } from '@/contexts/SystemContext';
import {
  fetchOpsDashboardMetrics,
  type OpsDashboardMetrics,
  type OpsDashboardProviderBreakdown,
} from '@/services/opsFacadeClient';
import { formatNumber } from '@/lib/formatters';
import {
  Receipt,
  AlertCircle,
  TrendingUp,
  Activity,
  Server,
  Clock,
  CheckCircle,
  RefreshCw,
  BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

const REFRESH_INTERVAL_MS = 60_000;

function getSuccessRateColor(rate: number): string {
  if (rate >= 99) return 'hsl(142, 72%, 45%)';
  if (rate >= 95) return 'hsl(47, 95%, 55%)';
  return 'hsl(0, 72%, 51%)';
}

function getLatencyColor(ms: number): string {
  if (ms <= 200) return 'hsl(187, 82%, 53%)';
  if (ms <= 500) return 'hsl(47, 95%, 55%)';
  return 'hsl(0, 72%, 51%)';
}

export default function Metrics() {
  const { viewMode } = useSystem();
  const [metrics, setMetrics] = useState<OpsDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetchOpsDashboardMetrics();
      if (mountedRef.current) {
        setMetrics(response.metrics);
        setError(null);
        setLoading(false);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load metrics');
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchData();

    intervalRef.current = setInterval(() => {
      if (mountedRef.current) fetchData();
    }, REFRESH_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="page-header">
          <h1 className="page-title">Metrics</h1>
        </div>
        <PageLoadingState showKPIs kpiCount={4} rows={6} />
      </div>
    );
  }

  if (error && !metrics) {
    return (
      <div className="space-y-6">
        <div className="page-header">
          <h1 className="page-title">Metrics</h1>
        </div>
        <EmptyState
          variant="error"
          title="Failed to load metrics"
          description={error}
          actionLabel="Retry"
          onAction={() => { setLoading(true); fetchData(); }}
        />
      </div>
    );
  }

  if (!metrics) return null;

  const errorRate = metrics.receipts_total > 0
    ? ((metrics.receipts_failed_24h / metrics.receipts_24h) * 100)
    : 0;

  const providerBreakdown: OpsDashboardProviderBreakdown[] = metrics.provider_breakdown ?? [];

  // Chart data for provider latency
  const latencyChartData = providerBreakdown.map(p => ({
    name: p.provider.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    latency: p.avg_latency_ms,
  }));

  // Chart data for provider success rate
  const successRateChartData = providerBreakdown.map(p => ({
    name: p.provider.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    rate: p.success_rate,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">
            <ModeText operator="Metrics" engineer="Aggregated Metrics" />
          </h1>
          <p className="page-subtitle">
            <ModeText
              operator="Key numbers across your system"
              engineer="Receipt volume, error rates, and provider performance metrics"
            />
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchData()}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Refresh
        </Button>
      </div>

      {/* Top-Level KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title={viewMode === 'operator' ? 'Total Receipts' : 'Receipt Volume (Total)'}
          value={formatNumber(metrics.receipts_total)}
          subtitle={`${formatNumber(metrics.receipts_24h)} in last 24h`}
          icon={<Receipt className="h-4 w-4" />}
          status="info"
          linkTo="/receipts"
          linkLabel="View receipts"
        />
        <KPICard
          title={viewMode === 'operator' ? 'Error Rate (24h)' : 'Receipt Error Rate'}
          value={metrics.receipts_24h > 0 ? `${errorRate.toFixed(1)}%` : '0%'}
          subtitle={`${formatNumber(metrics.receipts_failed_24h)} failed of ${formatNumber(metrics.receipts_24h)}`}
          icon={<AlertCircle className="h-4 w-4" />}
          status={errorRate > 5 ? 'critical' : errorRate > 1 ? 'warning' : 'success'}
        />
        <KPICard
          title={viewMode === 'operator' ? 'Provider Calls (24h)' : 'Provider Calls Volume'}
          value={formatNumber(metrics.provider_calls_24h)}
          subtitle={`${metrics.provider_success_rate.toFixed(1)}% success rate`}
          icon={<Server className="h-4 w-4" />}
          status={metrics.provider_success_rate >= 99 ? 'success' : metrics.provider_success_rate >= 95 ? 'warning' : 'critical'}
          linkTo="/provider-call-log"
          linkLabel="View call log"
        />
        <KPICard
          title={viewMode === 'operator' ? 'Avg Response Time' : 'Avg Provider Latency'}
          value={`${metrics.provider_avg_latency_ms.toFixed(0)}ms`}
          icon={<Clock className="h-4 w-4" />}
          status={metrics.provider_avg_latency_ms <= 200 ? 'success' : metrics.provider_avg_latency_ms <= 500 ? 'warning' : 'critical'}
        />
      </div>

      {/* Provider Breakdown Table */}
      <Panel
        title={viewMode === 'operator' ? 'Provider Performance' : 'Provider Breakdown'}
        subtitle={`${providerBreakdown.length} providers active in last 24h`}
      >
        {providerBreakdown.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Provider</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Calls (24h)</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Success Rate</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Avg Latency</th>
                </tr>
              </thead>
              <tbody>
                {providerBreakdown.map((p) => (
                  <tr key={p.provider} className="border-b border-border/50 hover:bg-accent/30">
                    <td className="py-2.5 px-3 font-medium text-foreground">
                      {p.provider.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </td>
                    <td className="py-2.5 px-3 text-right text-muted-foreground">
                      {formatNumber(p.calls_24h)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span className={
                        p.success_rate >= 99 ? 'text-success' :
                        p.success_rate >= 95 ? 'text-warning' :
                        'text-destructive'
                      }>
                        {p.success_rate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span className={
                        p.avg_latency_ms <= 200 ? 'text-muted-foreground' :
                        p.avg_latency_ms <= 500 ? 'text-warning' :
                        'text-destructive'
                      }>
                        {p.avg_latency_ms.toFixed(0)}ms
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState variant="no-data" title="No provider data available" />
        )}
      </Panel>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Provider Success Rate Chart */}
        <Panel title={viewMode === 'operator' ? 'Success Rate by Service' : 'Provider Success Rate'}>
          {successRateChartData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={successRateChartData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} stroke="rgba(255,255,255,0.5)" fontSize={12} tickFormatter={(v: number) => `${v}%`} />
                  <YAxis type="category" dataKey="name" stroke="rgba(255,255,255,0.5)" fontSize={11} width={90} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(220 18% 11%)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '8px',
                      color: 'rgba(255,255,255,0.92)',
                    }}
                    formatter={(value: number) => [`${value.toFixed(1)}%`, 'Success Rate']}
                  />
                  <Bar dataKey="rate" radius={[0, 4, 4, 0]}>
                    {successRateChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getSuccessRateColor(entry.rate)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState variant="chart-empty" title="No success rate data" />
          )}
        </Panel>

        {/* Provider Latency Chart */}
        <Panel title={viewMode === 'operator' ? 'Response Time by Service' : 'Provider Avg Latency'}>
          {latencyChartData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={latencyChartData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" horizontal={false} />
                  <XAxis type="number" stroke="rgba(255,255,255,0.5)" fontSize={12} tickFormatter={(v: number) => `${v}ms`} />
                  <YAxis type="category" dataKey="name" stroke="rgba(255,255,255,0.5)" fontSize={11} width={90} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(220 18% 11%)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '8px',
                      color: 'rgba(255,255,255,0.92)',
                    }}
                    formatter={(value: number) => [`${value.toFixed(0)}ms`, 'Avg Latency']}
                  />
                  <Bar dataKey="latency" radius={[0, 4, 4, 0]}>
                    {latencyChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getLatencyColor(entry.latency)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState variant="chart-empty" title="No latency data" />
          )}
        </Panel>
      </div>
    </div>
  );
}
