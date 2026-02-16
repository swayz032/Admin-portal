import { cn } from '@/lib/utils';
import { useSystem } from '@/contexts/SystemContext';
import type { StaffMember, StaffRuntimeConfig } from '@/contracts/ecosystem';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface StaffListProps {
  staff: StaffMember[];
  configs: StaffRuntimeConfig[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const channelLabels: Record<string, { operator: string; engineer: string }> = {
  voice: { operator: 'Phone', engineer: 'voice' },
  email: { operator: 'Email', engineer: 'email' },
  text: { operator: 'Chat', engineer: 'text' },
  internal: { operator: 'Internal', engineer: 'internal' },
  multi: { operator: 'All Channels', engineer: 'multi' },
};

const rolloutLabels: Record<string, { operator: string; engineer: string; color: string }> = {
  active: { operator: 'Live', engineer: 'active', color: 'bg-success/20 text-success' },
  draft: { operator: 'Draft', engineer: 'draft', color: 'bg-muted text-muted-foreground' },
  proposed: { operator: 'Pending', engineer: 'proposed', color: 'bg-warning/20 text-warning' },
  paused: { operator: 'Paused', engineer: 'paused', color: 'bg-warning/20 text-warning' },
  deprecated: { operator: 'Retired', engineer: 'deprecated', color: 'bg-destructive/20 text-destructive' },
};

export function StaffList({ staff, configs, selectedId, onSelect }: StaffListProps) {
  const { viewMode } = useSystem();
  const isOperator = viewMode === 'operator';

  const getConfig = (staffId: string) => configs.find(c => c.staff_id === staffId);

  return (
    <div className="h-full flex flex-col bg-surface-1 border-r border-border">
      <div className="p-4 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">
          {isOperator ? 'Your Team' : 'Staff Registry'}
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          {isOperator ? 'Configure how each team member works' : 'staff_id → runtime_config'}
        </p>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {staff.map((member) => {
            const config = getConfig(member.staff_id);
            const isSelected = selectedId === member.staff_id;
            const rollout = rolloutLabels[config?.rollout_state || 'draft'];
            const channel = channelLabels[member.channel];

            return (
              <button
                key={member.staff_id}
                onClick={() => onSelect(member.staff_id)}
                className={cn(
                  'w-full text-left p-3 rounded-lg transition-all duration-200',
                  'hover:bg-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                  isSelected && 'bg-accent border border-primary/30'
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{member.avatar_emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground truncate">
                        {member.name}
                      </span>
                      {!isOperator && (
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {member.staff_id}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {isOperator ? member.title : member.role}
                    </p>
                    <div className="flex items-center gap-1.5 mt-2">
                      <Badge 
                        variant="outline" 
                        className={cn('text-[10px] px-1.5 py-0', rollout.color)}
                      >
                        {isOperator ? rollout.operator : rollout.engineer}
                      </Badge>
                      <Badge 
                        variant="outline" 
                        className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary"
                      >
                        {isOperator ? channel.operator : channel.engineer}
                      </Badge>
                      {member.visibility === 'external' && (
                        <Badge 
                          variant="outline" 
                          className="text-[10px] px-1.5 py-0 bg-accent text-accent-foreground"
                        >
                          {isOperator ? 'Public' : 'external'}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
