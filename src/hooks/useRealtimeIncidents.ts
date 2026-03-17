/**
 * Realtime incidents hook — aggregated pipeline incidents.
 *
 * Uses fetchIncidents() which aggregates receipts by category (idempotent).
 * Subscribes to receipts table for live refresh on new failures.
 * n8n receipts excluded — they go to /n8n-operations.
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
  }, [filters?.severity, filters?.status, filters?.page, filters?.pageSize]);

  // Initial load
  useEffect(() => { load(); }, [load]);

  // Realtime: refetch on new pipeline failures (debounced)
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout>;

    const channel = supabase
      .channel('pipeline-incidents-refresh')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'receipts',
          filter: 'status=in.(FAILED,BLOCKED,DENIED)',
        },
        (payload) => {
          // Skip n8n receipts
          const receiptType = ((payload.new as Record<string, unknown>)?.receipt_type as string) ?? '';
          if (receiptType.startsWith('n8n_')) return;

          // Debounce: batch rapid inserts into 1 refetch
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => load(), 2000);
        },
      )
      .subscribe();

    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [load]);

  return { data, loading, error, count, refetch: load };
}
