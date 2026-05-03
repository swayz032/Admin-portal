/**
 * Realtime approvals hook — drop-in replacement for useApprovals().
 *
 * Subscribes to `approval_requests` table via Supabase Realtime.
 * Returns the same { data, loading, error, count, refetch } interface.
 */

import { useRealtimeSubscription } from './useRealtimeSubscription';
import { fetchApprovals, mapApprovalRow, type PaginatedResult } from '@/services/apiClient';
import type { Approval } from '@/data/seed';

interface ApprovalFilters {
  status?: string;
  risk?: string;
  page?: number;
  pageSize?: number;
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
