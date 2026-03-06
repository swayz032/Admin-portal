/**
 * ScopeSelector — Enterprise suite/office scope picker
 *
 * Wired to real Supabase data via ScopeContext.
 * Shows STE-XXX display IDs and business names for suites.
 * Shows OFF-XXX display IDs and owner names for offices.
 * Supports "All Suites" platform-wide view.
 */
import { ChevronDown, Building2, Briefcase, Globe, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSystem } from '@/contexts/SystemContext';
import { useScope } from '@/contexts/ScopeContext';

export function ScopeSelector() {
  const { viewMode } = useSystem();
  const {
    suites,
    offices,
    selectedSuite,
    selectedOffice,
    selectSuite,
    selectOffice,
    isLoading,
  } = useScope();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-2 h-8">
        <Loader2 className="h-3.5 w-3.5 text-text-tertiary animate-spin" />
        <span className="text-sm text-text-tertiary">Loading scopes...</span>
      </div>
    );
  }

  const suiteLabel = selectedSuite
    ? viewMode === 'engineer'
      ? `STE-${selectedSuite.displayId}`
      : selectedSuite.businessName
    : 'All Suites';

  const officeLabel = selectedOffice
    ? viewMode === 'engineer'
      ? `OFF-${selectedOffice.displayId}`
      : selectedOffice.ownerName || `Office ${selectedOffice.displayId}`
    : selectedSuite
      ? `All Offices (${offices.length})`
      : 'All Offices';

  return (
    <div className="flex items-center gap-1">
      {/* Suite Selector */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 gap-1 px-2">
            {selectedSuite ? (
              <Building2 className="h-3.5 w-3.5 text-text-tertiary" />
            ) : (
              <Globe className="h-3.5 w-3.5 text-text-tertiary" />
            )}
            <span className="text-sm max-w-[180px] truncate">{suiteLabel}</span>
            <ChevronDown className="h-3 w-3 text-text-tertiary" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuLabel className="text-xs">
            {viewMode === 'operator' ? 'Select Company' : 'Suite Scope'}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {/* All Suites option */}
          <DropdownMenuItem
            onClick={() => selectSuite(null)}
            className={!selectedSuite ? 'bg-surface-2' : ''}
          >
            <Globe className="h-3.5 w-3.5 mr-2 text-text-tertiary" />
            <span>All Suites</span>
            <span className="ml-auto text-xs text-text-tertiary">{suites.length}</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {suites.length === 0 ? (
            <DropdownMenuItem disabled>
              <span className="text-text-tertiary">No suites found</span>
            </DropdownMenuItem>
          ) : (
            suites.map((suite) => (
              <DropdownMenuItem
                key={suite.id}
                onClick={() => selectSuite(suite)}
                className={selectedSuite?.id === suite.id ? 'bg-surface-2' : ''}
              >
                <div className="flex flex-col flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate">{suite.businessName}</span>
                    {suite.officeCount > 1 && (
                      <span className="text-xs text-text-tertiary shrink-0">
                        {suite.officeCount} members
                      </span>
                    )}
                  </div>
                  {viewMode === 'engineer' && (
                    <span className="text-xs text-text-tertiary font-mono">
                      STE-{suite.displayId} | {suite.ownerEmail}
                    </span>
                  )}
                </div>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {selectedSuite && (
        <>
          <span className="text-text-tertiary">|</span>

          {/* Office Selector — only shown when a suite is selected */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1 px-2">
                <Briefcase className="h-3.5 w-3.5 text-text-tertiary" />
                <span className="text-sm max-w-[160px] truncate">{officeLabel}</span>
                <ChevronDown className="h-3 w-3 text-text-tertiary" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel className="text-xs">
                {viewMode === 'operator' ? 'Select Team Member' : 'Office Scope'}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />

              {/* All Offices option */}
              <DropdownMenuItem
                onClick={() => selectOffice(null)}
                className={!selectedOffice ? 'bg-surface-2' : ''}
              >
                <span>All Offices</span>
                <span className="ml-auto text-xs text-text-tertiary">{offices.length}</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {offices.length === 0 ? (
                <DropdownMenuItem disabled>
                  <span className="text-text-tertiary">No offices found</span>
                </DropdownMenuItem>
              ) : (
                offices.map((office) => (
                  <DropdownMenuItem
                    key={office.id}
                    onClick={() => selectOffice(office)}
                    className={selectedOffice?.id === office.id ? 'bg-surface-2' : ''}
                  >
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate">
                          {office.ownerName || `Office ${office.displayId}`}
                        </span>
                        {office.role === 'owner' && (
                          <span className="text-xs text-primary font-medium shrink-0">Owner</span>
                        )}
                      </div>
                      {viewMode === 'engineer' && (
                        <span className="text-xs text-text-tertiary font-mono">
                          OFF-{office.displayId}
                        </span>
                      )}
                    </div>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </div>
  );
}
