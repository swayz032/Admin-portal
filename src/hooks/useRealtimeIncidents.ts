/**
 * Realtime incidents hook — aggregated pipeline incidents.
 *
 * Uses fetchIncidents() which aggregates receipts by category (idempotent).
 * Subscribes to receipts table for live refresh on new failures.
 * All failures (including n8n) trigger refresh.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchIncidents, type PaginatedResult } from '@/services/apiClient';
import type { Incident } from '@/data/seed';

interface IncidentFilters {
  severity?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  view?: 'grouped' | 'all';
}

export function useRealtimeIncidents(filters?: IncidentFilters) {
  const [data, setData] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const fetchIdRef = useRef(0);

  const load = useCallback(async () => {
    const id = ++fetchIdRef.current;
    try {
      setLoading(true);
      const result = await fetchIncidents(filters);
      // Stale request guard
      if (id !== fetchIdRef.current) return;
      setData(result.data);
      setCount(result.count);
      setError(null);
    } catch (err) {
      if (id !== fetchIdRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load incidents');
    } finally {
      if (id === fetchIdRef.current) setLoading(false);
    }
  }, [filters?.severity, filters?.status, filters?.page, filters?.pageSize, filters?.view]);

  // Initial load
  useEffect(() => { load(); }, [load]);

  // Realtime: refetch on receipt/incident inserts and updates (debounced).
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout>;
    const scheduleLoad = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => load(), 1000);
    };

    const channel = supabase
      .channel('pipeline-incidents-refresh')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'receipts',
        },
        scheduleLoad,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'incidents',
        },
        scheduleLoad,
      )
      .subscribe();

    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [load]);

  return { data, loading, error, count, refetch: load };
}
