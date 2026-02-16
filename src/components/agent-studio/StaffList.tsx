import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useSystem } from '@/contexts/SystemContext';
import type { StaffMember, StaffRuntimeConfig } from '@/contracts/ecosystem';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { StaffAvatar } from './StaffAvatar';
import { Search, CheckCircle } from 'lucide-react';

interface StaffListProps {
  staff: StaffMember[];
  configs: StaffRuntimeConfig[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const rolloutConfig: Record<string, { label: string; color: string }> = {
  active: { label: '● Live', color: 'text-success' },
  draft: { label: 'Draft', color: 'text-muted-foreground' },
  proposed: { label: 'Review', color: 'text-warning' },
  paused: { label: 'Paused', color: 'text-warning' },
  deprecated: { label: 'Retired', color: 'text-destructive' },
};

export function StaffList({ staff, configs, selectedId, onSelect }: StaffListProps) {
  const { viewMode } = useSystem();
  const isOperator = viewMode === 'operator';
  const [search, setSearch] = useState('');

  const getConfig = (staffId: string) => configs.find(c => c.staff_id === staffId);

  const filteredStaff = staff.filter(member => 
    member.name.toLowerCase().includes(search.toLowerCase()) ||
    member.title.toLowerCase().includes(search.toLowerCase()) ||
    member.staff_id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col bg-surface-1">
      {/* Search */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 bg-background border-border text-xs focus-visible:ring-primary/50"
          />
        </div>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-1.5 space-y-0.5">
          {filteredStaff.map((member, index) => {
            const config = getConfig(member.staff_id);
            const isSelected = selectedId === member.staff_id;
            const rolloutState = config?.rollout_state || 'draft';
            const rollout = rolloutConfig[rolloutState];

            return (
              <button
                key={member.staff_id}
                onClick={() => onSelect(member.staff_id)}
                className={cn(
                  'w-full text-left rounded-lg transition-all duration-150',
                  'focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50',
                  'group animate-fade-in',
                  isSelected 
                    ? 'bg-primary/[0.06] border border-primary/30 shadow-[0_0_16px_hsl(var(--primary)/0.08)]' 
                    : 'border border-transparent hover:bg-accent/30'
                )}
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <div className="p-2.5 flex items-center gap-2.5">
                  <StaffAvatar
                    staffId={member.staff_id}
                    name={member.name}
                    size="sm"
                    status={rolloutState}
                    showStatus
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-[13px] font-medium text-foreground truncate">
                        {member.name}
                      </span>
                      {config?.enabled && (
                        <CheckCircle className="h-3 w-3 text-success shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {isOperator ? member.title : member.staff_id}
                    </p>
                  </div>
                  
                  <span className={cn('text-[10px] font-medium shrink-0', rollout.color)}>
                    {isOperator ? rollout.label : rolloutState}
                  </span>
                </div>
              </button>
            );
          })}

          {filteredStaff.length === 0 && (
            <div className="p-6 text-center">
              <p className="text-xs text-muted-foreground">No staff found</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
