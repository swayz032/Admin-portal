/**
 * Realtime incidents hook — drop-in replacement for useIncidents().
 *
 * Subscribes to `receipts` table (status=failed/blocked) via Supabase Realtime.
 * Incidents are derived from failed/blocked receipts — not a separate table.
 * Returns the same { data, loading, error, count, refetch } interface.
 */

import { useRealtimeSubscription } from './useRealtimeSubscription';
import { fetchIncidents, type PaginatedResult } from '@/services/apiClient';
import type { Incident, IncidentNote } from '@/data/seed';

interface IncidentFilters {
  severity?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

function deriveSeverity(row: Record<string, unknown>): 'P0' | 'P1' | 'P2' | 'P3' {
  const payload = (row.payload as Record<string, unknown>) ?? {};
  if (payload.severity) return payload.severity as 'P0' | 'P1' | 'P2' | 'P3';

  const domain = (row.domain as string) ?? '';
  const status = (row.status as string) ?? '';

  if (domain === 'payments' && status === 'failed') return 'P1';
  if (domain === 'security') return 'P0';
  if (status === 'blocked') return 'P2';
  return 'P3';
}

function buildIncidentNotes(payload: Record<string, unknown>): IncidentNote[] {
  const notes: IncidentNote[] = [];
  if (payload.error_message) {
    notes.push({
      author: 'System',
      body: payload.error_message as string,
      timestamp: new Date().toISOString(),
    });
  }
  if (payload.stack_trace) {
    notes.push({
      author: 'System',
      body: `Stack trace:\n${payload.stack_trace as string}`,
      timestamp: new Date().toISOString(),
      isLLMAnalysis: false,
    });
  }
  return notes;
}

function mapIncidentRow(row: Record<string, unknown>): Incident {
  const payload = (row.payload as Record<string, unknown>) ?? {};
  const status = (row.status as string) ?? 'failed';

  return {
    id: row.id as string,
    severity: deriveSeverity(row),
    status: status === 'failed' || status === 'blocked' ? 'Open' : 'Resolved',
    summary: (payload.error_message as string) ?? (payload.reason as string) ?? `${row.action_type} ${status}`,
    customer: (payload.customer as string) ?? (row.suite_id as string) ?? '',
    provider: (row.provider as string) ?? 'Internal',
    createdAt: row.created_at as string,
    updatedAt: (row.updated_at as string) ?? (row.created_at as string),
    subscribed: false,
    timelineReceiptIds: [row.id as string],
    notes: buildIncidentNotes(payload),
    detectionSource: (payload.detection_source as Incident['detectionSource']) ?? 'rule',
    customerNotified: (payload.customer_notified as Incident['customerNotified']) ?? 'no',
    proofStatus: 'ok',
    recommendedAction: (payload.recommended_action as string) ?? undefined,
    correlationId: (row.correlation_id as string) ?? undefined,
  };
}

export function useRealtimeIncidents(filters?: IncidentFilters) {
  const fetcher = async (): Promise<PaginatedResult<Incident>> => {
    return fetchIncidents(filters);
  };

  // Subscribe to receipts table but only care about failed/blocked status
  // The filter ensures we only get INSERT events for incident-worthy receipts
  return useRealtimeSubscription<Incident, Record<string, unknown>>({
    table: 'receipts',
    events: ['INSERT', 'UPDATE'],
    filter: 'status=in.(failed,blocked)',
    fetcher,
    mapRow: (row) => {
      // Only map rows that are actual incidents (failed/blocked)
      const status = (row.status as string) ?? '';
      if (status !== 'failed' && status !== 'blocked') {
        // Return a dummy that will be filtered — shouldn't reach here due to filter
        return mapIncidentRow(row);
      }
      return mapIncidentRow(row);
    },
    getKey: (item) => item.id,
    deps: [filters?.severity, filters?.status, filters?.page, filters?.pageSize],
  });
}
