/**
 * OPS FACADE HOOKS — React hooks wrapping the Ops Telemetry Facade backend.
 *
 * These hooks connect admin portal pages to the Python FastAPI backend at /admin/ops/*.
 * Each hook provides: { data, loading, error, refetch }
 *
 * The facade provides:
 *  - JWT-authenticated access (Law #3)
 *  - Server-side PII redaction (Law #9)
 *  - Access receipt generation for every call (Law #2)
 *  - Cursor-based pagination (max 200 per page)
 *
 * Falls back gracefully: if the facade is unreachable, pages should
 * continue using their existing Supabase-direct hooks (useAdminData).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchOpsHealth,
  fetchOpsIncidents,
  fetchOpsIncidentDetail,
  fetchOpsReceipts,
  fetchOpsProviderCalls,
  fetchOpsOutbox,
  fetchOpsRollouts,
  type OpsHealthResponse,
  type OpsIncidentSummary,
  type OpsIncidentDetail,
  type OpsReceiptSummary,
  type OpsProviderCallSummary,
  type OpsOutboxStatus,
  type OpsRolloutSummary,
  type OpsPageInfo,
} from '@/services/opsFacadeClient';

// ============================================================================
// GENERIC HOOK
// ============================================================================
interface FacadeQueryState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface FacadeQueryResult<T> extends FacadeQueryState<T> {
  refetch: () => void;
}

function useFacadeQuery<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
): FacadeQueryResult<T> {
  const [state, setState] = useState<FacadeQueryState<T>>({
    data: null,
    loading: true,
    error: null,
  });
  const mountedRef = useRef(true);

  const refetch = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const result = await fetcher();
      if (mountedRef.current) {
        setState({ data: result, loading: false, error: null });
      }
    } catch (err) {
      if (mountedRef.current) {
        const message = err instanceof Error ? err.message : 'Ops facade unavailable';
        setState(s => ({ ...s, loading: false, error: message }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mountedRef.current = true;
    refetch();
    return () => { mountedRef.current = false; };
  }, [refetch]);

  return { ...state, refetch };
}

// ============================================================================
// PAGINATED RESULT WRAPPER
// ============================================================================
interface PaginatedFacadeResult<T> {
  items: T[];
  page: OpsPageInfo;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// ============================================================================
// DOMAIN HOOKS
// ============================================================================

/** Backend health check — no auth required */
export function useOpsHealth(): FacadeQueryResult<OpsHealthResponse> {
  return useFacadeQuery(() => fetchOpsHealth(), []);
}

/** Incidents from the ops facade (filtered, paginated) */
export function useOpsIncidents(filters?: {
  state?: string;
  severity?: string;
  cursor?: string;
  limit?: number;
}): PaginatedFacadeResult<OpsIncidentSummary> {
  const result = useFacadeQuery(
    () => fetchOpsIncidents(filters),
    [filters?.state, filters?.severity, filters?.cursor, filters?.limit],
  );

  return {
    items: result.data?.items ?? [],
    page: result.data?.page ?? { has_more: false, next_cursor: null },
    loading: result.loading,
    error: result.error,
    refetch: result.refetch,
  };
}

/** Single incident detail */
export function useOpsIncidentDetail(incidentId: string | null): FacadeQueryResult<OpsIncidentDetail> {
  return useFacadeQuery(
    () => {
      if (!incidentId) return Promise.reject(new Error('No incident ID'));
      return fetchOpsIncidentDetail(incidentId);
    },
    [incidentId],
  );
}

/** Receipts from the ops facade (PII-redacted by backend) */
export function useOpsReceipts(filters?: {
  suite_id: string;
  correlation_id?: string;
  office_id?: string;
  action_type?: string;
  since?: string;
  until?: string;
  cursor?: string;
  limit?: number;
}): PaginatedFacadeResult<OpsReceiptSummary> {
  const result = useFacadeQuery(
    () => {
      if (!filters?.suite_id) return Promise.reject(new Error('suite_id required'));
      return fetchOpsReceipts(filters);
    },
    [filters?.suite_id, filters?.correlation_id, filters?.action_type, filters?.cursor, filters?.limit],
  );

  return {
    items: result.data?.items ?? [],
    page: result.data?.page ?? { has_more: false, next_cursor: null },
    loading: result.loading,
    error: result.error,
    refetch: result.refetch,
  };
}

/** Provider calls from the ops facade (payloads pre-redacted) */
export function useOpsProviderCalls(filters?: {
  provider?: string;
  status?: string;
  correlation_id?: string;
  cursor?: string;
  limit?: number;
}): PaginatedFacadeResult<OpsProviderCallSummary> {
  const result = useFacadeQuery(
    () => fetchOpsProviderCalls(filters),
    [filters?.provider, filters?.status, filters?.correlation_id, filters?.cursor, filters?.limit],
  );

  return {
    items: result.data?.items ?? [],
    page: result.data?.page ?? { has_more: false, next_cursor: null },
    loading: result.loading,
    error: result.error,
    refetch: result.refetch,
  };
}

/** Outbox queue status */
export function useOpsOutbox(): FacadeQueryResult<OpsOutboxStatus> {
  return useFacadeQuery(() => fetchOpsOutbox(), []);
}

/** Rollouts from the ops facade */
export function useOpsRollouts(filters?: {
  cursor?: string;
  limit?: number;
}): PaginatedFacadeResult<OpsRolloutSummary> {
  const result = useFacadeQuery(
    () => fetchOpsRollouts(filters),
    [filters?.cursor, filters?.limit],
  );

  return {
    items: result.data?.items ?? [],
    page: result.data?.page ?? { has_more: false, next_cursor: null },
    loading: result.loading,
    error: result.error,
    refetch: result.refetch,
  };
}
