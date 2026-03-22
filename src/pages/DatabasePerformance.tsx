import { useState, useEffect, useRef, useCallback } from 'react';
import { KPICard } from '@/components/shared/KPICard';
import { Panel } from '@/components/shared/Panel';
import { PageLoadingState } from '@/components/shared/PageLoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ModeText } from '@/components/shared/ModeText';
import { StatusChip } from '@/components/shared/StatusChip';
import { useSystem } from '@/contexts/SystemContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Database,
  Zap,
  Clock,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  XCircle,
  BarChart3,
} from 'lucide-react';
import { formatTimeAgo } from '@/lib/formatters';

const REFRESH_INTERVAL_MS = 60_000;

interface SlowQuery {
  query_preview: string;
  calls: number;
  avg_ms: number;
  total_ms: number;
  rows_returned: number;
}

interface CronJob {
  job_id: number;
  job_name: string;
  schedule: string;
  active: boolean;
}

interface CronRun {
  job_name: string;
  status: string;
  start_time: string;
  end_time: string | null;
  return_message: string | null;
}

interface ReceiptDailyStat {
  day: string;
  status: string;
  receipt_type: string;
  cnt: number;
}

export default function DatabasePerformance() {
  const { viewMode } = useSystem();
  const [cacheHitPct, setCacheHitPct] = useState<number | null>(null);
  const [slowQueries, setSlowQueries] = useState<SlowQuery[]>([]);
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [cronHistory, setCronHistory] = useState<CronRun[]>([]);
  const [receiptStats, setReceiptStats] = useState<ReceiptDailyStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [partialErrors, setPartialErrors] = useState<string[]>([]);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    try {
      const [cacheRes, queriesRes, jobsRes, historyRes, statsRes] = await Promise.allSettled([
        supabase.rpc('get_cache_hit_rate'),
        supabase.rpc('get_slow_queries', { query_limit: 20 }),
        supabase.rpc('get_cron_jobs'),
        supabase.rpc('get_cron_job_history', { hours_back: 24 }),
        supabase.from('receipt_daily_stats').select('*').order('day', { ascending: false }).limit(50),
      ]);

      if (!mountedRef.current) return;

      const errors: string[] = [];

      if (cacheRes.status === 'fulfilled' && !cacheRes.value.error) {
        const rows = cacheRes.value.data as Array<{ cache_hit_pct: number }>;
        setCacheHitPct(rows?.[0]?.cache_hit_pct ?? null);
      } else {
        errors.push('Cache hit rate');
      }

      if (queriesRes.status === 'fulfilled' && !queriesRes.value.error) {
        setSlowQueries((queriesRes.value.data as SlowQuery[]) ?? []);
      } else {
        errors.push('Slow queries');
      }

      if (jobsRes.status === 'fulfilled' && !jobsRes.value.error) {
        setCronJobs((jobsRes.value.data as CronJob[]) ?? []);
      } else {
        errors.push('Cron jobs');
      }

      if (historyRes.status === 'fulfilled' && !historyRes.value.error) {
        setCronHistory((historyRes.value.data as CronRun[]) ?? []);
      } else {
        errors.push('Cron history');
      }

      if (statsRes.status === 'fulfilled' && !statsRes.value.error) {
        setReceiptStats((statsRes.value.data as ReceiptDailyStat[]) ?? []);
      } else {
        errors.push('Receipt stats');
      }

      setPartialErrors(errors);
      setError(null);
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load database performance data');
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchData();
    const interval = setInterval(() => {
      if (mountedRef.current) fetchData();
    }, REFRESH_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="page-header">
          <h1 className="page-title">Database Performance</h1>
        </div>
        <PageLoadingState showKPIs kpiCount={4} rows={6} />
      </div>
    );
  }

  if (error && slowQueries.length === 0) {
    return (
      <div className="space-y-6">
        <div className="page-header">
          <h1 className="page-title">Database Performance</h1>
        </div>
        <EmptyState
          variant="error"
          title="Failed to load performance data"
          description={error}
          actionLabel="Retry"
          onAction={() => { setLoading(true); fetchData(); }}
        />
      </div>
    );
  }

  const cacheStatus: 'success' | 'warning' | 'critical' =
    cacheHitPct === null ? 'warning' :
    cacheHitPct >= 99 ? 'success' :
    cacheHitPct >= 90 ? 'warning' : 'critical';

  const activeJobs = cronJobs.filter(j => j.active).length;
  const failedRuns = cronHistory.filter(r => r.status === 'failed').length;
  const worstQueryMs = slowQueries.length > 0 ? slowQueries[0].avg_ms : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">
            <ModeText operator="Database Performance" engineer="DB Performance (pg_stat_statements)" />
          </h1>
          <p className="page-subtitle">
            <ModeText
              operator="How your database is performing"
              engineer="Query performance, cache efficiency, cron jobs, and receipt throughput"
            />
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchData()}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Refresh
        </Button>
      </div>

      {/* Partial failure banner */}
      {partialErrors.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-2.5 text-sm text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Failed to load: {partialErrors.join(', ')}. Other data shown below.</span>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard
          title="Cache Hit Rate"
          value={cacheHitPct !== null ? `${cacheHitPct}%` : 'N/A'}
          subtitle={cacheHitPct !== null && cacheHitPct >= 99 ? 'Excellent' : cacheHitPct !== null && cacheHitPct >= 90 ? 'Acceptable' : 'Needs attention'}
          icon={<Zap className="h-4 w-4" />}
          status={cacheStatus}
        />
        <KPICard
          title="Slowest Query"
          value={worstQueryMs > 0 ? `${worstQueryMs.toFixed(0)}ms` : 'N/A'}
          subtitle={slowQueries.length > 0 ? `${slowQueries.length} queries tracked` : undefined}
          icon={<Clock className="h-4 w-4" />}
          status={worstQueryMs > 500 ? 'critical' : worstQueryMs > 100 ? 'warning' : 'success'}
        />
        <KPICard
          title="Cron Jobs"
          value={`${activeJobs}/${cronJobs.length}`}
          subtitle={`${activeJobs} active`}
          icon={<Database className="h-4 w-4" />}
          status={activeJobs === cronJobs.length ? 'success' : 'warning'}
        />
        <KPICard
          title="Cron Failures (24h)"
          value={failedRuns}
          subtitle={cronHistory.length > 0 ? `${cronHistory.length} total runs` : 'No runs in 24h'}
          icon={failedRuns > 0 ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
          status={failedRuns > 0 ? 'critical' : 'success'}
        />
      </div>

      {/* Slow Queries Table */}
      <Panel
        title={viewMode === 'operator' ? 'Slowest Database Queries' : 'Top 20 Slowest Queries (pg_stat_statements)'}
        subtitle="Ordered by average execution time"
      >
        {slowQueries.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Query</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Calls</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Avg (ms)</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Total (ms)</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Rows</th>
                </tr>
              </thead>
              <tbody>
                {slowQueries.map((q, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-accent/30">
                    <td className="py-2.5 px-3 font-mono text-xs text-muted-foreground max-w-[400px] truncate" title={q.query_preview}>
                      {q.query_preview}
                    </td>
                    <td className="py-2.5 px-3 text-right text-muted-foreground">{q.calls.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right">
                      <span className={
                        q.avg_ms > 500 ? 'text-destructive font-medium' :
                        q.avg_ms > 100 ? 'text-warning' :
                        'text-muted-foreground'
                      }>
                        {q.avg_ms.toFixed(2)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-muted-foreground">{q.total_ms.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right text-muted-foreground">{q.rows_returned.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState variant="no-data" title="No query statistics available" description="pg_stat_statements may need to accumulate data." />
        )}
      </Panel>

      {/* Cron Jobs + Receipt Stats */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Cron Job History */}
        <Panel
          title={viewMode === 'operator' ? 'Scheduled Tasks (24h)' : 'pg_cron Job History (24h)'}
          subtitle={`${cronHistory.length} runs`}
        >
          {cronHistory.length > 0 ? (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {cronHistory.map((run, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border/50">
                  {run.status === 'succeeded' ? (
                    <CheckCircle className="h-4 w-4 text-success shrink-0" />
                  ) : run.status === 'failed' ? (
                    <XCircle className="h-4 w-4 text-destructive shrink-0" />
                  ) : (
                    <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{run.job_name}</p>
                    {run.return_message && (
                      <p className="text-xs text-muted-foreground truncate" title={run.return_message}>
                        {run.return_message}
                      </p>
                    )}
                  </div>
                  <StatusChip
                    status={run.status === 'succeeded' ? 'success' : run.status === 'failed' ? 'critical' : 'warning'}
                    label={run.status}
                  />
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatTimeAgo(run.start_time)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState variant="no-data" title="No cron runs in last 24h" />
          )}
        </Panel>

        {/* Receipt Daily Stats */}
        <Panel
          title={viewMode === 'operator' ? 'Receipt Volume (7 days)' : 'Receipt Daily Stats (Materialized View)'}
          subtitle="Aggregated from receipt_daily_stats"
        >
          {receiptStats.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Day</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Status</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Type</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {receiptStats.map((s, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-accent/30">
                      <td className="py-2 px-3 text-muted-foreground">{new Date(s.day).toLocaleDateString()}</td>
                      <td className="py-2 px-3">
                        <StatusChip
                          status={s.status === 'FAILED' || s.status === 'DENIED' ? 'critical' : 'success'}
                          label={s.status}
                        />
                      </td>
                      <td className="py-2 px-3 text-muted-foreground text-xs">{s.receipt_type}</td>
                      <td className="py-2 px-3 text-right font-medium text-foreground">{s.cnt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState variant="no-data" title="No receipt stats yet" description="The materialized view refreshes hourly via pg_cron." />
          )}
        </Panel>
      </div>

      {/* Active Cron Jobs */}
      <Panel
        title={viewMode === 'operator' ? 'Scheduled Maintenance Tasks' : 'Active pg_cron Jobs'}
        subtitle={`${cronJobs.length} jobs configured`}
      >
        {cronJobs.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {cronJobs.map((job) => (
              <div key={job.job_id} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-surface-1">
                <div className={`p-1.5 rounded-md ${job.active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                  <BarChart3 className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{job.job_name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{job.schedule}</p>
                </div>
                <StatusChip
                  status={job.active ? 'success' : 'warning'}
                  label={job.active ? 'Active' : 'Inactive'}
                />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState variant="no-data" title="No cron jobs configured" />
        )}
      </Panel>
    </div>
  );
}
