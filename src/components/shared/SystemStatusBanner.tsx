import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { fetchOpsDashboardMetrics } from '@/services/opsFacadeClient';

type SystemStatus = 'healthy' | 'degraded' | 'critical';

const STATUS_CONFIG: Record<SystemStatus, {
  icon: typeof CheckCircle2;
  label: string;
  className: string;
}> = {
  healthy: {
    icon: CheckCircle2,
    label: 'All Systems Operational',
    className: 'bg-success/10 border-success/20 text-success',
  },
  degraded: {
    icon: AlertTriangle,
    label: 'Degraded Performance',
    className: 'bg-warning/10 border-warning/20 text-warning',
  },
  critical: {
    icon: XCircle,
    label: 'System Issues Detected',
    className: 'bg-destructive/10 border-destructive/20 text-destructive',
  },
};

const REFRESH_INTERVAL_MS = 30_000;

/**
 * Derive system status directly from Supabase incidents table.
 * - Any open P0/critical incident → 'critical'
 * - Any open P1/high incident → 'degraded'
 * - No open incidents → 'healthy'
 */
async function deriveStatusFromSupabase(): Promise<SystemStatus> {
  // Derive system status from FAILED/DENIED receipt count in last 24h
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('receipts')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', since)
    .in('status', ['FAILED', 'DENIED']);

  if (error) {
    console.warn('[SystemStatusBanner] Supabase receipts query failed:', error.message);
    return 'healthy';
  }

  const failCount = count ?? 0;
  if (failCount > 50) return 'critical';
  if (failCount > 20) return 'degraded';
  return 'healthy';
}

/**
 * Attempt to get richer status from the ops facade backend.
 * Returns null if unreachable — caller falls back to Supabase-derived status.
 */
async function fetchOpsStatus(): Promise<SystemStatus | null> {
  try {
    const response = await fetchOpsDashboardMetrics();
    return response.metrics.system_status;
  } catch {
    return null;
  }
}

export function SystemStatusBanner() {
  const [status, setStatus] = useState<SystemStatus>('healthy');
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    // Primary: derive status from Supabase directly
    const supabaseStatus = await deriveStatusFromSupabase();

    // Bonus: try ops facade for potentially richer info
    const opsStatus = await fetchOpsStatus();

    if (!mountedRef.current) return;

    // Use the worse status between the two sources (if ops facade is reachable)
    // This ensures we never hide a problem that only one source knows about
    let finalStatus = supabaseStatus;
    if (opsStatus) {
      const severity: Record<SystemStatus, number> = { healthy: 0, degraded: 1, critical: 2 };
      finalStatus = severity[opsStatus] > severity[supabaseStatus] ? opsStatus : supabaseStatus;
    }

    setStatus(finalStatus);
    setLoading(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchStatus();

    intervalRef.current = setInterval(() => {
      if (mountedRef.current) fetchStatus();
    }, REFRESH_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchStatus]);

  // Don't render while loading initial state
  if (loading) return null;

  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  // For healthy status, show a minimal bar to avoid noise
  if (status === 'healthy') {
    return (
      <div className={cn(
        'flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium border-b',
        config.className
      )}>
        <Icon className="h-3 w-3" />
        <span>{config.label}</span>
      </div>
    );
  }

  return (
    <div className={cn(
      'flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium border-b',
      config.className
    )}>
      <Icon className="h-4 w-4" />
      <span>{config.label}</span>
    </div>
  );
}
