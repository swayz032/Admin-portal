import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';
import { fetchOpsDashboardMetrics, type OpsDashboardMetrics } from '@/services/opsFacadeClient';

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

export function SystemStatusBanner() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetchOpsDashboardMetrics();
      if (mountedRef.current) {
        setStatus(response.metrics.system_status);
        setError(null);
        setLoading(false);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch system status');
        setLoading(false);
      }
    }
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

  // Show error state if fetch failed
  if (error || !status) {
    return (
      <div className="flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium bg-muted/50 border-b border-border text-muted-foreground">
        <RefreshCw className="h-3 w-3" />
        <span>System status unavailable</span>
      </div>
    );
  }

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
