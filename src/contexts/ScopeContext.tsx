/**
 * ScopeContext — Enterprise suite/office scope selection
 *
 * Queries suite_profiles for ALL suites and offices visible to the admin user.
 * Provides selectedSuite, selectedOffice to all downstream components.
 * Persists selection in localStorage so it survives page reloads.
 *
 * Suite = Company (STE-XXX), Office = Team Member (OFF-XXX)
 */
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { devWarn } from '@/lib/devLog';

// ============================================================================
// TYPES
// ============================================================================

export interface ScopeSuite {
  /** suite_id (UUID) */
  id: string;
  /** Display label, e.g. "Suite 122" or "Rivera Plumbing LLC" */
  label: string;
  /** Premium display ID, e.g. "122" */
  displayId: string;
  /** Business name */
  businessName: string;
  /** Owner name */
  ownerName: string;
  /** Owner email */
  ownerEmail: string;
  /** Number of offices (team members) in this suite */
  officeCount: number;
  /** Industry */
  industry: string | null;
  /** Created at */
  createdAt: string;
}

export interface ScopeOffice {
  /** Synthetic key: suite_id + office_display_id */
  id: string;
  /** suite_id this office belongs to */
  suiteId: string;
  /** Display label, e.g. "Office A01" */
  label: string;
  /** Premium office display ID, e.g. "A01" */
  displayId: string;
  /** Owner name of this office seat */
  ownerName: string;
  /** Role (owner / member) */
  role: string;
}

interface ScopeContextType {
  /** All suites visible to admin */
  suites: ScopeSuite[];
  /** All offices for the selected suite */
  offices: ScopeOffice[];
  /** Currently selected suite (null = "All Suites" view) */
  selectedSuite: ScopeSuite | null;
  /** Currently selected office (null = all offices in suite) */
  selectedOffice: ScopeOffice | null;
  /** Select a suite (pass null for "All Suites") */
  selectSuite: (suite: ScopeSuite | null) => void;
  /** Select an office (pass null for "All Offices") */
  selectOffice: (office: ScopeOffice | null) => void;
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Force refresh */
  refresh: () => void;
}

interface SuiteProfileRow {
  suite_id: string;
  display_id: string;
  office_display_id: string;
  business_name: string;
  owner_name: string;
  email: string;
  industry: string | null;
  created_at: string;
  [key: string]: unknown;
}

const ScopeContext = createContext<ScopeContextType | undefined>(undefined);

const SCOPE_SUITE_KEY = 'aspire.admin.scope.suiteId';
const SCOPE_OFFICE_KEY = 'aspire.admin.scope.officeId';

// ============================================================================
// PROVIDER
// ============================================================================

export function ScopeProvider({ children }: { children: ReactNode }) {
  const [suites, setSuites] = useState<ScopeSuite[]>([]);
  const [offices, setOffices] = useState<ScopeOffice[]>([]);
  const [selectedSuite, setSelectedSuite] = useState<ScopeSuite | null>(null);
  const [selectedOffice, setSelectedOffice] = useState<ScopeOffice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch all suites ──────────────────────────────────────────────────
  const fetchSuites = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from('suite_profiles')
        .select('suite_id, display_id, office_display_id, business_name, owner_name, email, industry, created_at')
        .order('display_id', { ascending: true });

      if (queryError) {
        devWarn('ScopeContext: suite_profiles query failed:', queryError.message);
        setError(`Failed to load suites: ${queryError.message}`);
        setSuites([]);
        return;
      }

      if (!data || data.length === 0) {
        setSuites([]);
        return;
      }

      // Group by suite_id to get unique suites + office counts
      const suiteMap = new Map<string, {
        suiteId: string;
        displayId: string;
        businessName: string;
        ownerName: string;
        ownerEmail: string;
        industry: string | null;
        createdAt: string;
        officeCount: number;
        offices: ScopeOffice[];
      }>();

      for (const rawRow of data) {
        const row = rawRow as SuiteProfileRow;
        const suiteId = row.suite_id;
        const displayId = row.display_id || '';
        const officeDisplayId = row.office_display_id || '';

        if (!suiteMap.has(suiteId)) {
          suiteMap.set(suiteId, {
            suiteId,
            displayId,
            businessName: row.business_name || 'Unknown',
            ownerName: row.owner_name || '',
            ownerEmail: row.email || '',
            industry: row.industry,
            createdAt: row.created_at || '',
            officeCount: 0,
            offices: [],
          });
        }

        const suite = suiteMap.get(suiteId)!;
        suite.officeCount += 1;
        suite.offices.push({
          id: `${suiteId}:${officeDisplayId}`,
          suiteId,
          label: `Office ${officeDisplayId || suite.officeCount}`,
          displayId: officeDisplayId,
          ownerName: row.owner_name || '',
          role: 'owner', // suite_profiles has one row per suite — always the owner
        });
      }

      const mappedSuites: ScopeSuite[] = Array.from(suiteMap.values()).map(s => ({
        id: s.suiteId,
        label: `Suite ${s.displayId || '???'}`,
        displayId: s.displayId,
        businessName: s.businessName,
        ownerName: s.ownerName,
        ownerEmail: s.ownerEmail,
        officeCount: s.officeCount,
        industry: s.industry,
        createdAt: s.createdAt,
      }));

      setSuites(mappedSuites);

      // Restore persisted selection
      const persistedSuiteId = localStorage.getItem(SCOPE_SUITE_KEY);
      if (persistedSuiteId) {
        const restored = mappedSuites.find(s => s.id === persistedSuiteId);
        if (restored) {
          setSelectedSuite(restored);
          // Set offices for this suite
          const suiteData = suiteMap.get(persistedSuiteId);
          if (suiteData) {
            setOffices(suiteData.offices);
            // Restore office selection
            const persistedOfficeId = localStorage.getItem(SCOPE_OFFICE_KEY);
            if (persistedOfficeId) {
              const restoredOffice = suiteData.offices.find(o => o.id === persistedOfficeId);
              if (restoredOffice) setSelectedOffice(restoredOffice);
            }
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to load suites: ${msg}`);
      devWarn('ScopeContext: fetchSuites error:', msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSuites();
  }, [fetchSuites]);

  // ── Select a suite ────────────────────────────────────────────────────
  const selectSuite = useCallback((suite: ScopeSuite | null) => {
    setSelectedSuite(suite);
    setSelectedOffice(null);
    localStorage.removeItem(SCOPE_OFFICE_KEY);

    if (suite) {
      localStorage.setItem(SCOPE_SUITE_KEY, suite.id);
      // Fetch offices for this suite from our cached data
      // Re-query to get fresh office list
      supabase
        .from('suite_profiles')
        .select('suite_id, display_id, office_display_id, owner_name')
        .eq('suite_id', suite.id)
        .order('office_display_id', { ascending: true })
        .then(({ data }) => {
          if (data) {
            setOffices(data.map((rawRow: unknown, idx: number) => {
              const row = rawRow as SuiteProfileRow;
              return {
                id: `${row.suite_id}:${row.office_display_id || idx}`,
                suiteId: row.suite_id,
                label: `Office ${row.office_display_id || idx + 1}`,
                displayId: row.office_display_id || '',
                ownerName: row.owner_name || '',
                role: 'owner',
              };
            }));
          }
        });
    } else {
      localStorage.removeItem(SCOPE_SUITE_KEY);
      setOffices([]);
    }
  }, []);

  // ── Select an office ──────────────────────────────────────────────────
  const selectOffice = useCallback((office: ScopeOffice | null) => {
    setSelectedOffice(office);
    if (office) {
      localStorage.setItem(SCOPE_OFFICE_KEY, office.id);
    } else {
      localStorage.removeItem(SCOPE_OFFICE_KEY);
    }
  }, []);

  return (
    <ScopeContext.Provider
      value={{
        suites,
        offices,
        selectedSuite,
        selectedOffice,
        selectSuite,
        selectOffice,
        isLoading,
        error,
        refresh: fetchSuites,
      }}
    >
      {children}
    </ScopeContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useScope(): ScopeContextType {
  const context = useContext(ScopeContext);
  if (context === undefined) {
    throw new Error('useScope must be used within a ScopeProvider');
  }
  return context;
}
