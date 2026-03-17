/**
 * COMMAND CENTER METRICS HOOK
 *
 * Fetches aggregated dashboard metrics from /admin/ops/dashboard/metrics
 * with 60-second auto-refresh.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  fetchOpsDashboardMetrics,
  type OpsDashboardMetrics,
} from '@/services/opsFacadeClient';

const REFRESH_INTERVAL_MS = 60_000;

interface CommandCenterMetricsResult {
  data: OpsDashboardMetrics | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useCommandCenterMetrics(): CommandCenterMetricsResult {
  const [data, setData] = useState<OpsDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refetch = useCallback(async () => {
    try {
      const response = await fetchOpsDashboardMetrics();
      if (mountedRef.current) {
        setData(response.metrics);
        setError(null);
        setLoading(false);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch command center metrics');
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    refetch();

    intervalRef.current = setInterval(() => {
      if (mountedRef.current) refetch();
    }, REFRESH_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [refetch]);

  return { data, loading, error, refetch };
}
