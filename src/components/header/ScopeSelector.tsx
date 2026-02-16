import { useState } from 'react';
import { ChevronDown, Building2, Briefcase } from 'lucide-react';
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

interface Suite {
  id: string;
  name: string;
}

interface Office {
  id: string;
  name: string;
  suiteId: string;
}

// Mock data - will be wired to real data later
const suites: Suite[] = [
  { id: 'SUITE-001', name: 'Suite 120' },
  { id: 'SUITE-002', name: 'Suite 240' },
  { id: 'SUITE-003', name: 'Suite 360' },
];

const offices: Office[] = [
  { id: 'OFF-001', name: 'Office 14', suiteId: 'SUITE-001' },
  { id: 'OFF-002', name: 'Office 22', suiteId: 'SUITE-001' },
  { id: 'OFF-003', name: 'Office 8', suiteId: 'SUITE-002' },
  { id: 'OFF-004', name: 'Office 31', suiteId: 'SUITE-001' },
  { id: 'OFF-005', name: 'Office 12', suiteId: 'SUITE-002' },
];

export function ScopeSelector() {
  const { viewMode } = useSystem();
  const [selectedSuite, setSelectedSuite] = useState<Suite>(suites[0]);
  const [selectedOffice, setSelectedOffice] = useState<Office>(offices[0]);

  const filteredOffices = offices.filter(o => o.suiteId === selectedSuite.id);

  return (
    <div className="flex items-center gap-1">
      {/* Suite Selector */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 gap-1 px-2">
            <Building2 className="h-3.5 w-3.5 text-text-tertiary" />
            <span className="text-sm">{selectedSuite.name}</span>
            <ChevronDown className="h-3 w-3 text-text-tertiary" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuLabel className="text-xs">
            {viewMode === 'operator' ? 'Select Suite' : 'Suite Scope'}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {suites.map((suite) => (
            <DropdownMenuItem
              key={suite.id}
              onClick={() => {
                setSelectedSuite(suite);
                // Reset office to first in new suite
                const firstOffice = offices.find(o => o.suiteId === suite.id);
                if (firstOffice) setSelectedOffice(firstOffice);
              }}
              className={selectedSuite.id === suite.id ? 'bg-surface-2' : ''}
            >
              <span>{suite.name}</span>
              {viewMode === 'engineer' && (
                <span className="ml-auto text-xs text-text-tertiary font-mono">{suite.id}</span>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <span className="text-text-tertiary">•</span>

      {/* Office Selector */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 gap-1 px-2">
            <Briefcase className="h-3.5 w-3.5 text-text-tertiary" />
            <span className="text-sm">{selectedOffice.name}</span>
            <ChevronDown className="h-3 w-3 text-text-tertiary" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuLabel className="text-xs">
            {viewMode === 'operator' ? 'Select Office' : 'Office Scope'}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {filteredOffices.map((office) => (
            <DropdownMenuItem
              key={office.id}
              onClick={() => setSelectedOffice(office)}
              className={selectedOffice.id === office.id ? 'bg-surface-2' : ''}
            >
              <span>{office.name}</span>
              {viewMode === 'engineer' && (
                <span className="ml-auto text-xs text-text-tertiary font-mono">{office.id}</span>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
