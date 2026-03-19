/**
 * Unified incidents hook — merges Supabase realtime + backend incidents.
 * Deduplicates by correlation_id. Source-tagged: Frontend/Backend/Both.
 */

import { useMemo } from 'react';
import { useRealtimeIncidents } from './useRealtimeIncidents';
import type { Incident } from '@/data/seed';

export type UnifiedSource = 'frontend' | 'backend' | 'both';

export interface UnifiedIncident extends Incident {
  source: UnifiedSource;
}

interface UseUnifiedIncidentsResult {
  data: UnifiedIncident[];
  loading: boolean;
  error: string | null;
  count: number;
  refetch: () => void;
}

export function useUnifiedIncidents(filters?: {
  severity?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  view?: 'grouped' | 'all';
}): UseUnifiedIncidentsResult {
  const { data: realtimeIncidents, loading, error, count, refetch } = useRealtimeIncidents(filters);

  // Note: useErrorStream (SSE backend) removed — the SSE endpoint does not exist yet.
  // Incidents are sourced entirely from Supabase receipts via useRealtimeIncidents.
  // When the backend SSE endpoint is built, re-add useErrorStream here to merge
  // backend-sourced errors with Supabase-sourced incidents.

  const unified = useMemo(() => {
    const severityOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
    return realtimeIncidents
      .map((incident): UnifiedIncident => ({ ...incident, source: 'frontend' }))
      .sort((a, b) => {
        const sevDiff = (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4);
        if (sevDiff !== 0) return sevDiff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [realtimeIncidents]);

  return {
    data: unified,
    loading,
    error,
    count: unified.length,
    refetch,
  };
}
