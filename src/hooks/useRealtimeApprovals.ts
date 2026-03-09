/**
 * Realtime approvals hook — drop-in replacement for useApprovals().
 *
 * Subscribes to `approval_requests` table via Supabase Realtime.
 * Returns the same { data, loading, error, count, refetch } interface.
 */

import { useRealtimeSubscription } from './useRealtimeSubscription';
import { fetchApprovals, type PaginatedResult } from '@/services/apiClient';
import type { Approval } from '@/data/seed';

interface ApprovalFilters {
  status?: string;
  risk?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Map raw Supabase row to Approval UI type.
 * Mirrors the mapApprovalRow() logic in apiClient.ts.
 */
function mapApprovalRow(row: Record<string, unknown>): Approval {
  const riskMap: Record<string, Approval['risk']> = {
    red: 'High',
    yellow: 'Medium',
    green: 'Low',
  };

  return {
    id: (row.id as string) || '',
    type: (row.action_type as string) || (row.domain as string) || 'Unknown',
    risk: riskMap[(row.risk_tier as string)?.toLowerCase()] || 'None',
    customer: (row.requested_by as string) || 'Unknown',
    summary: (row.reason as string) || (row.action_type as string) || 'No summary',
    requestedBy: (row.requested_by as string) || 'System',
    requestedAt: (row.created_at as string) || new Date().toISOString(),
    status: capitalizeStatus((row.status as string) || 'pending') as Approval['status'],
    decisionReason: (row.decision_reason as string) || undefined,
    evidenceReceiptIds: Array.isArray(row.evidence_receipt_ids)
      ? (row.evidence_receipt_ids as string[])
      : [],
    linkedIncidentId: (row.linked_incident_id as string) || undefined,
  };
}

function capitalizeStatus(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export function useRealtimeApprovals(filters?: ApprovalFilters) {
  const fetcher = async (): Promise<PaginatedResult<Approval>> => {
    return fetchApprovals(filters);
  };

  return useRealtimeSubscription<Approval, Record<string, unknown>>({
    table: 'approval_requests',
    events: ['INSERT', 'UPDATE', 'DELETE'],
    fetcher,
    mapRow: mapApprovalRow,
    getKey: (item) => item.id,
    deps: [filters?.status, filters?.risk, filters?.page, filters?.pageSize],
  });
}
