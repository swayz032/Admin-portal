/**
 * Realtime customers hook — drop-in replacement for useCustomers().
 *
 * Subscribes to `suite_profiles` table via Supabase Realtime.
 * Returns the same { data, loading, error, count, refetch } interface.
 */

import { useRealtimeSubscription } from './useRealtimeSubscription';
import { fetchCustomers, type PaginatedResult } from '@/services/apiClient';
import type { Customer } from '@/data/seed';

interface CustomerFilters {
  status?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Map raw Supabase suite_profiles row to Customer UI type.
 * Mirrors the mapCustomerRow() logic in apiClient.ts.
 */
function mapCustomerRow(row: Record<string, unknown>): Customer {
  const hasOnboarding = !!row.onboarding_completed_at;
  const derivedStatus = hasOnboarding ? 'Active' : 'Trial';

  const teamSizeStr = row.team_size as string | null;
  let teamSize: number | undefined;
  if (teamSizeStr) {
    const parts = teamSizeStr.split('-');
    teamSize = parts.length === 2
      ? Math.round((parseInt(parts[0]) + parseInt(parts[1])) / 2)
      : parseInt(parts[0]) || undefined;
  }

  return {
    id: (row.suite_id as string) ?? (row.id as string),
    name: (row.business_name as string) ?? (row.name as string) ?? 'Unknown',
    status: derivedStatus as Customer['status'],
    plan: 'Aspire Suite',
    mrr: 0,
    riskFlag: 'None',
    openIncidents: 0,
    openApprovals: 0,
    lastActivity: (row.updated_at as string) ?? (row.created_at as string) ?? '',
    integrations: [],
    displayId: (row.display_id as string) ?? undefined,
    officeDisplayId: (row.office_display_id as string) ?? undefined,
    ownerName: (row.owner_name as string) ?? (row.name as string) ?? undefined,
    ownerEmail: (row.email as string) ?? undefined,
    industry: (row.industry as string) ?? null,
    teamSize,
  };
}

export function useRealtimeCustomers(filters?: CustomerFilters) {
  const fetcher = async (): Promise<PaginatedResult<Customer>> => {
    return fetchCustomers(filters);
  };

  return useRealtimeSubscription<Customer, Record<string, unknown>>({
    table: 'suite_profiles',
    events: ['INSERT', 'UPDATE', 'DELETE'],
    fetcher,
    mapRow: mapCustomerRow,
    getKey: (item) => item.id,
    deps: [filters?.status, filters?.page, filters?.pageSize],
  });
}
