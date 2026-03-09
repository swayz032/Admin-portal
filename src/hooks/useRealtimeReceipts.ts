/**
 * Realtime receipts hook — drop-in replacement for useReceipts().
 *
 * Subscribes to `receipts` table via Supabase Realtime.
 * Returns the same { data, loading, error, count, refetch } interface.
 */

import { useRealtimeSubscription } from './useRealtimeSubscription';
import { fetchReceipts, type PaginatedResult } from '@/services/apiClient';
import type { Receipt } from '@/data/seed';

interface ReceiptFilters {
  status?: string;
  provider?: string;
  correlationId?: string;
  page?: number;
  pageSize?: number;
}

function mapReceiptRow(row: Record<string, unknown>): Receipt {
  const payload = (row.payload as Record<string, unknown>) ?? {};
  const status = (row.status as string) ?? 'success';

  return {
    id: row.id as string,
    timestamp: row.created_at as string,
    runId: (payload.run_id as string) ?? (row.correlation_id as string) ?? '',
    correlationId: (row.correlation_id as string) ?? '',
    actor: (payload.actor as string) ?? (row.domain as string) ?? 'System',
    actionType: (row.action_type as string) ?? '',
    outcome: status === 'success' ? 'Success' : status === 'failed' ? 'Failed' : 'Blocked',
    provider: (row.provider as string) ?? 'Internal',
    providerCallId: (payload.provider_call_id as string) ?? (row.request_id as string) ?? '',
    redactedRequest: JSON.stringify(payload.redacted_inputs ?? payload.request ?? {}),
    redactedResponse: JSON.stringify(payload.redacted_outputs ?? payload.response ?? {}),
    linkedIncidentId: (payload.linked_incident_id as string) ?? null,
    linkedApprovalId: (payload.linked_approval_id as string) ?? null,
    linkedCustomerId: (payload.linked_customer_id as string) ?? (row.suite_id as string) ?? null,
  };
}

export function useRealtimeReceipts(filters?: ReceiptFilters) {
  const fetcher = async (): Promise<PaginatedResult<Receipt>> => {
    return fetchReceipts(filters);
  };

  return useRealtimeSubscription<Receipt, Record<string, unknown>>({
    table: 'receipts',
    events: ['INSERT'],
    fetcher,
    mapRow: mapReceiptRow,
    getKey: (item) => item.id,
    deps: [filters?.status, filters?.provider, filters?.correlationId, filters?.page, filters?.pageSize],
  });
}
