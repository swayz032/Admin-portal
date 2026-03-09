/**
 * Fast polling hook — interval-based data fetcher for endpoints
 * that don't support SSE/Realtime yet.
 *
 * Provides { data, loading, error, refetch } with automatic
 * cleanup on unmount.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseFastPollingOptions<T> {
  /** Async function to fetch data */
  fetcher: () => Promise<T>;
  /** Polling interval in milliseconds */
  intervalMs: number;
  /** Whether polling is active (default: true) */
  enabled?: boolean;
}

export function useFastPolling<T>({ fetcher, intervalMs, enabled = true }: UseFastPollingOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    try {
      const result = await fetcher();
      if (mountedRef.current) {
        setData(result);
        setError(null);
      }
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : 'Fetch failed');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [fetcher]);

  useEffect(() => {
    mountedRef.current = true;

    if (!enabled) {
      setLoading(false);
      return;
    }

    fetchData();
    intervalRef.current = setInterval(fetchData, intervalMs);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchData, intervalMs, enabled]);

  const refetch = useCallback(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch };
}
