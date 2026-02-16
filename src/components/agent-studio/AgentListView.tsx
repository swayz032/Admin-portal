import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useSystem } from '@/contexts/SystemContext';
import type { StaffMember, StaffRuntimeConfig } from '@/contracts/ecosystem';
import { StaffAvatar } from './StaffAvatar';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, MoreHorizontal, Copy } from 'lucide-react';

interface AgentListViewProps {
  staff: StaffMember[];
  configs: StaffRuntimeConfig[];
  onSelect: (id: string) => void;
}

const rolloutDisplay: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-success/10 text-success border-success/20' },
  draft: { label: 'Draft', className: 'bg-muted/50 text-muted-foreground border-border' },
  proposed: { label: 'Review', className: 'bg-warning/10 text-warning border-warning/20' },
  paused: { label: 'Paused', className: 'bg-warning/10 text-warning border-warning/20' },
  deprecated: { label: 'Retired', className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

export function AgentListView({ staff, configs, onSelect }: AgentListViewProps) {
  const { viewMode } = useSystem();
  const isOperator = viewMode === 'operator';
  const [search, setSearch] = useState('');

  const getConfig = (staffId: string) => configs.find(c => c.staff_id === staffId);

  const filtered = staff.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.title.toLowerCase().includes(search.toLowerCase()) ||
    m.staff_id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col">
      {/* Page header — matches Anam: title left, search right */}
      <div className="shrink-0 pb-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-foreground tracking-tight">
                Agent Studio
              </h1>
              <Badge variant="outline" className="text-xs text-muted-foreground border-border font-normal">
                {staff.length} {isOperator ? 'agents' : 'registered'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {isOperator 
                ? 'Create and manage AI agents for your operations'
                : 'staff[] → runtime_config registry'}
            </p>
          </div>

          {/* Search — aligned right like Anam */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={isOperator ? 'Search agents...' : 'Search staff...'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 w-[240px] bg-background border-border text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table — clean Anam-style */}
      <div className="flex-1 min-h-0">
        <div className="border border-border rounded-xl overflow-hidden bg-card">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3" colSpan={2}>
                  {isOperator ? 'Agent Name' : 'Persona Name'}
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">
                  Description
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">
                  {isOperator ? 'Type' : 'Role'}
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">
                  Channel
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">
                  Status
                </th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((member) => {
                const config = getConfig(member.staff_id);
                const rolloutState = config?.rollout_state || 'draft';
                const rollout = rolloutDisplay[rolloutState] || rolloutDisplay.draft;

                return (
                  <tr
                    key={member.staff_id}
                    onClick={() => onSelect(member.staff_id)}
                    className={cn(
                      'border-b border-border/40 cursor-pointer',
                      'transition-colors duration-150',
                      'hover:bg-accent/30'
                    )}
                  >
                    {/* Avatar */}
                    <td className="pl-5 py-3 w-16">
                      <StaffAvatar
                        staffId={member.staff_id}
                        name={member.name}
                        size="md"
                      />
                    </td>
                    {/* Name */}
                    <td className="px-3 py-3">
                      <span className="text-sm font-medium text-foreground">
                        {member.name}
                      </span>
                    </td>
                    {/* Description */}
                    <td className="px-4 py-3">
                      <span className="text-sm text-muted-foreground line-clamp-1 max-w-xs">
                        {isOperator ? member.title : member.description}
                      </span>
                    </td>
                    {/* Type/Role */}
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-[11px] font-normal border-border text-muted-foreground">
                        {isOperator ? 'Custom' : member.role}
                      </Badge>
                    </td>
                    {/* Channel */}
                    <td className="px-4 py-3">
                      <span className="text-sm text-muted-foreground capitalize">
                        {member.channel}
                      </span>
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={cn('text-[11px]', rollout.className)}>
                        {rollout.label}
                      </Badge>
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); }}
                          className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); }}
                          className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No agents found
            </div>
          )}

          {/* Footer — row count like Anam */}
          {filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
              <span>1 – {filtered.length} of {staff.length}.</span>
              <span>Page 1 of 1</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
