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
    // Demographics
    gender: (row.gender as string) ?? undefined,
    dateOfBirth: (row.date_of_birth as string) ?? undefined,
    roleCategory: (row.role_category as string) ?? undefined,
    entityType: (row.entity_type as string) ?? undefined,
    yearsInBusiness: (row.years_in_business as string) ?? undefined,
    customerType: (row.customer_type as string) ?? undefined,
    salesChannel: (row.sales_channel as string) ?? undefined,
    annualRevenueBand: (row.annual_revenue_band as string) ?? undefined,
    incomeRange: (row.income_range as string) ?? undefined,
    industrySpecialty: (row.industry_specialty as string) ?? undefined,
    // Acquisition
    referralSource: (row.referral_source as string) ?? undefined,
    createdAt: (row.created_at as string) ?? undefined,
    // Location
    homeCity: (row.home_city as string) ?? undefined,
    homeState: (row.home_state as string) ?? undefined,
    homeCountry: (row.home_country as string) ?? undefined,
    businessCity: (row.business_city as string) ?? undefined,
    businessState: (row.business_state as string) ?? undefined,
    businessCountry: (row.business_country as string) ?? undefined,
    businessAddressSameAsHome: (row.business_address_same_as_home as boolean) ?? undefined,
    // Needs & Goals
    servicesNeeded: (row.services_needed as string[]) ?? undefined,
    servicesPriority: (row.services_priority as string[]) ?? undefined,
    currentTools: (row.current_tools as string[]) ?? undefined,
    toolsPlanning: (row.tools_planning as string[]) ?? undefined,
    businessGoals: (row.business_goals as string[]) ?? undefined,
    painPoint: (row.pain_point as string) ?? undefined,
    // Preferences
    preferredChannel: (row.preferred_channel as string) ?? undefined,
    timezone: (row.timezone as string) ?? undefined,
    currency: (row.currency as string) ?? undefined,
    // Onboarding
    onboardingCompletedAt: (row.onboarding_completed_at as string) ?? undefined,
    consentPersonalization: (row.consent_personalization as boolean) ?? undefined,
    consentCommunications: (row.consent_communications as boolean) ?? undefined,
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
