/**
 * ADMIN DATA HOOKS — React hooks wrapping production Supabase queries
 *
 * Each hook provides: { data, loading, error, count, refetch }
 * Pages use these instead of importing seed data arrays.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchApprovals,
  fetchIncidents,
  fetchReceipts,
  fetchCustomers,
  fetchSubscriptions,
  fetchProviders,
  fetchBusinessMetrics,
  fetchOpsMetrics,
  fetchAutomationJobs,
  fetchAutomationFailures,
  fetchAutomationMetrics,
  fetchTrustSpineMetrics,
  fetchRunwayBurn,
  fetchCostsUsage,
  fetchRevenueAddons,
  fetchSkillPackRegistry,
  fetchSkillPackAnalytics,
  fetchAcquisitionAnalytics,
  type PaginatedResult,
  type BusinessMetrics,
  type OpsMetrics,
  type AutomationMetricsData,
  type TrustSpineMetricsData,
  type RunwayBurnData,
  type CostsUsageData,
  type RevenueData,
  type SkillPackData,
  type AcquisitionData,
} from '@/services/apiClient';
import { fetchOpsProviders } from '@/services/opsFacadeClient';

import type { Approval, Incident, Receipt, Customer, Subscription, Provider } from '@/data/seed';
import type { AutomationJob, AutomationFailure } from '@/data/automationSeed';

// ============================================================================
// GENERIC QUERY HOOK
// ============================================================================
interface QueryState<T> {
  data: T[];
  count: number;
  loading: boolean;
  error: string | null;
}

interface QueryResult<T> extends QueryState<T> {
  refetch: () => void;
}

function useQuery<T>(
  fetcher: () => Promise<PaginatedResult<T>>,
  deps: unknown[] = [],
): QueryResult<T> {
  const [state, setState] = useState<QueryState<T>>({
    data: [],
    count: 0,
    loading: true,
    error: null,
  });
  const mountedRef = useRef(true);

  const refetch = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const result = await fetcher();
      if (mountedRef.current) {
        setState({ data: result.data, count: result.count, loading: false, error: null });
      }
    } catch (err) {
      if (mountedRef.current) {
        const message = err instanceof Error ? err.message : 'An unexpected error occurred';
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

// Generic hook for single-object queries (not paginated)
interface SingleQueryResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function useSingleQuery<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
): SingleQueryResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      if (mountedRef.current) {
        setData(result);
        setLoading(false);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        setLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mountedRef.current = true;
    refetch();
    return () => { mountedRef.current = false; };
  }, [refetch]);

  return { data, loading, error, refetch };
}

// ============================================================================
// DOMAIN HOOKS
// ============================================================================

/** Approvals from approval_requests table */
export function useApprovals(filters?: { status?: string; risk?: string; page?: number; pageSize?: number }) {
  return useQuery<Approval>(
    () => fetchApprovals(filters),
    [filters?.status, filters?.risk, filters?.page, filters?.pageSize],
  );
}

/** Incidents derived from failed/blocked receipts */
export function useIncidents(filters?: { severity?: string; status?: string; page?: number; pageSize?: number }) {
  return useQuery<Incident>(
    () => fetchIncidents(filters),
    [filters?.severity, filters?.status, filters?.page, filters?.pageSize],
  );
}

/** Receipts in admin-friendly format */
export function useReceipts(filters?: { status?: string; provider?: string; correlationId?: string; page?: number; pageSize?: number }) {
  return useQuery<Receipt>(
    () => fetchReceipts(filters),
    [filters?.status, filters?.provider, filters?.correlationId, filters?.page, filters?.pageSize],
  );
}

/** Customers from suite_profiles */
export function useCustomers(filters?: { status?: string; page?: number; pageSize?: number }) {
  return useQuery<Customer>(
    () => fetchCustomers(filters),
    [filters?.status, filters?.page, filters?.pageSize],
  );
}

/** Subscriptions from suite_profiles */
export function useSubscriptions(filters?: { status?: string; page?: number; pageSize?: number }) {
  return useQuery<Subscription>(
    () => fetchSubscriptions(filters),
    [filters?.status, filters?.page, filters?.pageSize],
  );
}

/** Providers from finance_connections + call log stats */
export function useProviders() {
  return useQuery<Provider>(
    async () => {
      try {
        const facade = await fetchOpsProviders();
        const mapped: Provider[] = (facade.items ?? []).map((p) => ({
          id: p.provider,
          name: p.provider,
          type: p.lane || 'Unknown',
          status: p.status === 'connected' ? 'Healthy' : p.status === 'degraded' ? 'At Risk' : 'Read-only Allowed',
          lastChecked: p.last_checked ?? '',
          latency: p.latency_ms ?? 0,
          p95Latency: p.p95_latency_ms ?? p.latency_ms ?? 0,
          errorRate: p.error_rate ?? 0,
          scopes: p.scopes ?? [],
          lastSyncTime: p.last_checked ?? '',
          recentReceiptsCount: 0,
          permissionsSummary: (p.scopes ?? []).length > 0 ? `${(p.scopes ?? []).length} scopes connected` : 'No scopes configured',
        }));
        return {
          data: mapped,
          count: mapped.length,
          page: 1,
          pageSize: Math.max(mapped.length, 1),
        };
      } catch {
        return fetchProviders();
      }
    },
    [],
  );
}

/** Business metrics aggregated from suite_profiles + receipts */
export function useBusinessMetrics() {
  return useSingleQuery<BusinessMetrics>(fetchBusinessMetrics, []);
}

/** Ops metrics aggregated from receipts + approvals + outbox */
export function useOpsMetrics() {
  return useSingleQuery<OpsMetrics>(fetchOpsMetrics, []);
}

/** Automation jobs from outbox_jobs */
export function useAutomationJobs(filters?: { status?: string; page?: number; pageSize?: number }) {
  return useQuery<AutomationJob>(
    () => fetchAutomationJobs(filters),
    [filters?.status, filters?.page, filters?.pageSize],
  );
}

/** Automation failures from outbox_dead_letters */
export function useAutomationFailures(filters?: { page?: number; pageSize?: number }) {
  return useQuery<AutomationFailure>(
    () => fetchAutomationFailures(filters),
    [filters?.page, filters?.pageSize],
  );
}

/** Automation metrics from outbox_jobs */
export function useAutomationMetrics() {
  return useSingleQuery<AutomationMetricsData>(fetchAutomationMetrics, []);
}

/** Trust Spine metrics from receipts (24h window) */
export function useTrustSpineMetrics() {
  return useSingleQuery<TrustSpineMetricsData>(fetchTrustSpineMetrics, []);
}

/** Runway & burn from finance_events */
export function useRunwayBurn() {
  return useSingleQuery<RunwayBurnData>(fetchRunwayBurn, []);
}

/** Costs & usage from provider_call_log */
export function useCostsUsage() {
  return useSingleQuery<CostsUsageData>(fetchCostsUsage, []);
}

/** Revenue & add-ons from finance_events */
export function useRevenueAddons() {
  return useSingleQuery<RevenueData>(fetchRevenueAddons, []);
}

/** Skill pack registry from receipts */
export function useSkillPackRegistry() {
  return useQuery<SkillPackData>(
    () => fetchSkillPackRegistry(),
    [],
  );
}

/** Skill pack analytics from receipts */
export function useSkillPackAnalytics() {
  return useSingleQuery(fetchSkillPackAnalytics, []);
}

/** Acquisition analytics from suite_profiles */
export function useAcquisitionAnalytics() {
  return useSingleQuery<AcquisitionData>(fetchAcquisitionAnalytics, []);
}
