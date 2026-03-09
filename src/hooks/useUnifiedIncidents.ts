/**
 * Unified incidents hook — merges Supabase realtime + backend incidents.
 * Deduplicates by correlation_id. Source-tagged: Frontend/Backend/Both.
 */

import { useMemo } from 'react';
import { useRealtimeIncidents } from './useRealtimeIncidents';
import { useErrorStream, type LiveError } from './useErrorStream';
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
}): UseUnifiedIncidentsResult {
  const { data: realtimeIncidents, loading, error, count, refetch } = useRealtimeIncidents(filters);
  const { errors: backendErrors } = useErrorStream();

  const unified = useMemo(() => {
    // Start with realtime incidents (Supabase source)
    const byCorrelation = new Map<string, UnifiedIncident>();

    for (const incident of realtimeIncidents) {
      const key = incident.correlationId || incident.id;
      byCorrelation.set(key, {
        ...incident,
        source: 'frontend',
      });
    }

    // Merge backend errors
    for (const err of backendErrors) {
      const key = err.correlationId || err.id;
      const existing = byCorrelation.get(key);

      if (existing) {
        // Seen from both sources
        existing.source = 'both';
      } else {
        // Only from backend — create incident shape
        byCorrelation.set(key, {
          id: err.id,
          severity: err.severity,
          status: 'Open',
          summary: err.message,
          customer: '',
          provider: err.provider || 'Internal',
          createdAt: err.timestamp,
          updatedAt: err.timestamp,
          subscribed: false,
          timelineReceiptIds: [],
          notes: err.stackTrace
            ? [{ author: 'System', body: err.stackTrace, timestamp: err.timestamp }]
            : [],
          detectionSource: 'rule',
          customerNotified: 'no',
          proofStatus: 'pending',
          correlationId: err.correlationId,
          source: 'backend',
        });
      }
    }

    // Sort by severity (P0 first) then by timestamp (newest first)
    const severityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
    return Array.from(byCorrelation.values()).sort((a, b) => {
      const sevDiff = (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4);
      if (sevDiff !== 0) return sevDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [realtimeIncidents, backendErrors]);

  return {
    data: unified,
    loading,
    error,
    count: unified.length,
    refetch,
  };
}
