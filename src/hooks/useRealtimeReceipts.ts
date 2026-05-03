/**
 * Realtime receipts hook — drop-in replacement for useReceipts().
 *
 * Subscribes to `receipts` table via Supabase Realtime.
 * Returns the same { data, loading, error, count, refetch } interface.
 */

import { useRealtimeSubscription } from './useRealtimeSubscription';
import { deriveReceiptActionType, fetchReceipts, type PaginatedResult } from '@/services/apiClient';
import type { Receipt } from '@/data/seed';

interface ReceiptFilters {
  status?: string;
  provider?: string;
  correlationId?: string;
  page?: number;
  pageSize?: number;
}

function mapReceiptRow(row: Record<string, unknown>): Receipt {
  const action = (row.action as Record<string, unknown>) ?? {};
  const payload = (row.payload as Record<string, unknown>) ?? action;
  const result = (row.result as Record<string, unknown>) ?? {};
  const rawStatus = ((row.status as string) ?? 'SUCCEEDED').toUpperCase();
  const receiptType = (row.receipt_type as string) ?? (row.domain as string) ?? '';
  const toolUsed = (action.tool_used as string) ?? '';
  const actionType = deriveReceiptActionType(row);
  const outcome: Receipt['outcome'] = rawStatus === 'SUCCEEDED' || rawStatus === 'SUCCESS'
    ? 'Success'
    : rawStatus === 'FAILED'
      ? 'Failed'
      : 'Blocked';
  const provider = (row.provider as string)
    ?? (action.provider as string)
    ?? toolUsed
    ?? receiptType
    ?? 'Internal platform';

  return {
    id: (row.receipt_id as string) ?? (row.id as string),
    timestamp: row.created_at as string,
    runId: (payload.run_id as string) ?? (action.run_id as string) ?? (row.correlation_id as string) ?? '',
    correlationId: (row.correlation_id as string) ?? '',
    actor: (payload.actor as string) ?? (action.actor as string) ?? (row.actor_id as string) ?? 'System',
    actionType,
    outcome,
    provider,
    providerCallId: (payload.provider_call_id as string) ?? (action.provider_call_id as string) ?? (row.request_id as string) ?? '',
    redactedRequest: JSON.stringify(payload.redacted_inputs ?? payload.request ?? action ?? {}),
    redactedResponse: JSON.stringify(payload.redacted_outputs ?? payload.response ?? result ?? {}),
    linkedIncidentId: (payload.linked_incident_id as string) ?? (action.linked_incident_id as string) ?? null,
    linkedApprovalId: (payload.linked_approval_id as string) ?? (action.linked_approval_id as string) ?? null,
    linkedCustomerId: (payload.linked_customer_id as string) ?? (action.linked_customer_id as string) ?? (row.suite_id as string) ?? null,
  };
}

export function useRealtimeReceipts(filters?: ReceiptFilters) {
  const fetcher = async (): Promise<PaginatedResult<Receipt>> => {
    return fetchReceipts(filters);
  };

  return useRealtimeSubscription<Receipt, Record<string, unknown>>({
    table: 'receipts',
    events: ['INSERT', 'UPDATE', 'DELETE'],
    fetcher,
    mapRow: mapReceiptRow,
    getKey: (item) => item.id,
    deps: [filters?.status, filters?.provider, filters?.correlationId, filters?.page, filters?.pageSize],
  });
}
