/**
 * Generic Supabase Realtime subscription hook.
 *
 * Dual-path: Supabase Realtime (primary) + polling fallback (30s).
 * Returns the same { data, loading, error, count, refetch } interface as
 * useQuery so pages can swap with zero UI changes.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

const POLLING_INTERVAL_MS = 30_000;

interface RealtimeQueryResult<T> {
  data: T[];
  count: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  /** true when receiving live updates */
  isRealtime: boolean;
}

interface UseRealtimeSubscriptionOptions<T, R> {
  /** Supabase table name */
  table: string;
  /** Event types to subscribe to */
  events?: Array<'INSERT' | 'UPDATE' | 'DELETE'>;
  /** Optional RLS filter (e.g. `tenant_id=eq.xxx`) */
  filter?: string;
  /** Initial data fetcher (same as existing apiClient functions) */
  fetcher: () => Promise<{ data: T[]; count: number }>;
  /** Map raw Supabase row to UI type (optional — identity if same shape) */
  mapRow?: (row: R) => T;
  /** Unique key extractor for dedup/merge */
  getKey?: (item: T) => string;
  /** Dependencies for re-fetching */
  deps?: unknown[];
}

export function useRealtimeSubscription<T, R = Record<string, unknown>>({
  table,
  events = ['INSERT', 'UPDATE', 'DELETE'],
  filter,
  fetcher,
  mapRow,
  getKey = (item: T) => (item as Record<string, unknown>).id as string,
  deps = [],
}: UseRealtimeSubscriptionOptions<T, R>): RealtimeQueryResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRealtime, setIsRealtime] = useState(false);

  const mountedRef = useRef(true);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Initial fetch + polling fallback ─────────────────────────────
  const refetch = useCallback(async () => {
    if (!mountedRef.current) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      if (mountedRef.current) {
        const rows = Array.isArray(result?.data) ? result.data : [];
        const total = typeof result?.count === 'number' ? result.count : rows.length;
        setData(rows);
        setCount(total);
        setLoading(false);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Fetch failed');
        setLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // ── Realtime handler ──────────────────────────────────────────────
  const handleRealtimeEvent = useCallback(
    (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      if (!mountedRef.current) return;
      setIsRealtime(true);

      const newRow = payload.new as R | undefined;
      const oldRow = payload.old as Record<string, unknown> | undefined;

      if (payload.eventType === 'INSERT' && newRow) {
        const mapped = mapRow ? mapRow(newRow) : (newRow as unknown as T);
        setData(prev => {
          // Dedup — don't add if already exists
          const key = getKey(mapped);
          if (prev.some(item => getKey(item) === key)) return prev;
          return [mapped, ...prev];
        });
        setCount(prev => prev + 1);
      }

      if (payload.eventType === 'UPDATE' && newRow) {
        const mapped = mapRow ? mapRow(newRow) : (newRow as unknown as T);
        const key = getKey(mapped);
        setData(prev =>
          prev.map(item => (getKey(item) === key ? mapped : item)),
        );
      }

      if (payload.eventType === 'DELETE' && oldRow) {
        const oldKey = oldRow.id as string;
        setData(prev => prev.filter(item => getKey(item) !== oldKey));
        setCount(prev => Math.max(0, prev - 1));
      }
    },
    [mapRow, getKey],
  );

  // ── Lifecycle: subscribe + poll ───────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;

    // 1. Initial fetch
    refetch();

    // 2. Supabase Realtime subscription
    const channelName = `realtime-${table}-${Date.now()}`;
    const channelConfig: Record<string, unknown> = {
      event: '*',
      schema: 'public',
      table,
    };
    if (filter) {
      channelConfig.filter = filter;
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes' as 'system',
        channelConfig as { event: string; schema: string },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          // Only process events we care about
          if (events.includes(payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE')) {
            handleRealtimeEvent(payload);
          }
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsRealtime(true);
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setIsRealtime(false);
        }
      });

    channelRef.current = channel;

    // 3. Polling fallback (runs regardless — catches missed events)
    pollingRef.current = setInterval(() => {
      if (mountedRef.current) refetch();
    }, POLLING_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, filter, ...deps]);

  return { data, count, loading, error, refetch, isRealtime };
}
