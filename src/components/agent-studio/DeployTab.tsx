import { useState } from 'react';
import { useSystem } from '@/contexts/SystemContext';
import type { StaffRuntimeConfig } from '@/contracts/ecosystem';
import { staff } from '@/ecosystem/snapshot';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { StaffAvatar } from './StaffAvatar';
import { 
  Rocket, 
  Pause, 
  RotateCcw,
  Clock,
  User,
  ChevronRight,
  AlertTriangle,
  TrendingUp,
  CheckCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface DeployTabProps {
  configs: StaffRuntimeConfig[];
}

interface RolloutEntry {
  staff_id: string;
  environment: 'development' | 'staging' | 'production';
  percentage: number;
  status: 'active' | 'paused' | 'rolling_back';
  updated_at: string;
  updated_by: string;
  history: { timestamp: string; action: string; actor: string; percentage: number }[];
}

// Realistic mock data
const MOCK_ROLLOUTS: RolloutEntry[] = [
  {
    staff_id: 'sarah',
    environment: 'production',
    percentage: 100,
    status: 'active',
    updated_at: '2024-01-15T14:30:00Z',
    updated_by: 'admin@company.com',
    history: [
      { timestamp: '2024-01-15T14:30:00Z', action: 'Rolled out to 100%', actor: 'admin@company.com', percentage: 100 },
      { timestamp: '2024-01-14T10:00:00Z', action: 'Rolled out to 50%', actor: 'admin@company.com', percentage: 50 },
      { timestamp: '2024-01-13T09:00:00Z', action: 'Created rollout', actor: 'admin@company.com', percentage: 10 },
    ]
  },
  {
    staff_id: 'quinn',
    environment: 'production',
    percentage: 75,
    status: 'active',
    updated_at: '2024-01-14T11:00:00Z',
    updated_by: 'admin@company.com',
    history: [
      { timestamp: '2024-01-14T11:00:00Z', action: 'Rolled out to 75%', actor: 'admin@company.com', percentage: 75 },
      { timestamp: '2024-01-12T15:00:00Z', action: 'Created rollout', actor: 'admin@company.com', percentage: 25 },
    ]
  },
  {
    staff_id: 'eli',
    environment: 'staging',
    percentage: 100,
    status: 'active',
    updated_at: '2024-01-10T09:00:00Z',
    updated_by: 'admin@company.com',
    history: [
      { timestamp: '2024-01-10T09:00:00Z', action: 'Created rollout', actor: 'admin@company.com', percentage: 100 },
    ]
  },
];

const statusLabels = {
  active: { label: 'Active', color: 'bg-success/20 text-success border-success/30' },
  paused: { label: 'Paused', color: 'bg-warning/20 text-warning border-warning/30' },
  rolling_back: { label: 'Rolling Back', color: 'bg-destructive/20 text-destructive border-destructive/30' },
};

const envLabels = {
  development: { label: 'Dev', color: 'bg-muted text-muted-foreground border-muted', icon: '🔧' },
  staging: { label: 'Staging', color: 'bg-primary/20 text-primary border-primary/30', icon: '🧪' },
  production: { label: 'Production', color: 'bg-success/20 text-success border-success/30', icon: '🚀' },
};

export function DeployTab({ configs }: DeployTabProps) {
  const { viewMode, systemState } = useSystem();
  const isOperator = viewMode === 'operator';
  const safetyMode = systemState.safetyMode;
  
  const [rollouts] = useState<RolloutEntry[]>(MOCK_ROLLOUTS);
  const [selectedRollout, setSelectedRollout] = useState<RolloutEntry | null>(null);
  const [newPercentage, setNewPercentage] = useState<number>(0);

  const getStaffMember = (staffId: string) => staff.find(s => s.staff_id === staffId);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  const handleOpenDetail = (rollout: RolloutEntry) => {
    setSelectedRollout(rollout);
    setNewPercentage(rollout.percentage);
  };

  // Find staff that are not deployed yet
  const notDeployed = staff.filter(s => !rollouts.some(r => r.staff_id === s.staff_id));

  return (
    <div className="h-full flex flex-col">
      <ScrollArea className="flex-1">
        <div className="p-6 max-w-5xl mx-auto space-y-6">
          {/* Safety Mode Warning */}
          {safetyMode && (
            <Card className="border-warning/50 bg-gradient-to-r from-warning/10 to-warning/5 overflow-hidden">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-warning/20 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-6 w-6 text-warning" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {isOperator ? 'Safety Mode Active' : 'safety_mode: true'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isOperator 
                      ? 'Deploy controls are locked. Disable Safety Mode to make changes.'
                      : 'Rollout mutations disabled while safety_mode=true'
                    }
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Active Rollouts */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground">
                {isOperator ? 'Active Deployments' : 'Rollouts'}
              </h2>
              <Badge variant="outline" className="text-xs">
                {rollouts.length} active
              </Badge>
            </div>
            <div className="space-y-3">
              {rollouts.map((rollout, index) => {
                const member = getStaffMember(rollout.staff_id);
                if (!member) return null;
                const status = statusLabels[rollout.status];
                const env = envLabels[rollout.environment];

                return (
                  <Card 
                    key={`${rollout.staff_id}-${rollout.environment}`}
                    className={cn(
                      'border-border overflow-hidden cursor-pointer transition-all duration-200',
                      'hover:border-primary/30 hover:shadow-lg hover:-translate-y-0.5',
                      'animate-fade-in'
                    )}
                    style={{ animationDelay: `${index * 100}ms` }}
                    onClick={() => handleOpenDetail(rollout)}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-center gap-4">
                        {/* Premium Avatar */}
                        <StaffAvatar
                          staffId={member.staff_id}
                          name={member.name}
                          size="md"
                          status={rollout.status === 'active' ? 'active' : 'paused'}
                          showStatus
                        />
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-foreground">{member.name}</span>
                            <Badge variant="outline" className={cn('text-[10px] h-5', env.color)}>
                              {env.icon} {env.label}
                            </Badge>
                            <Badge variant="outline" className={cn('text-[10px] h-5', status.color)}>
                              {status.label}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {isOperator ? member.title : member.staff_id}
                          </p>
                          
                          {/* Progress bar */}
                          <div className="mt-3 space-y-1">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-muted-foreground">Rollout Progress</span>
                              <span className="font-medium text-foreground">{rollout.percentage}%</span>
                            </div>
                            <Progress value={rollout.percentage} className="h-1.5" />
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(rollout.updated_at)}
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground ml-auto" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {rollouts.length === 0 && (
                <Card className="border-dashed">
                  <CardContent className="p-12 text-center">
                    <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                      <Rocket className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-foreground mb-1">
                      {isOperator ? 'No active deployments' : 'No rollouts configured'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Configure an agent first, then deploy it here
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Not Yet Deployed */}
          {notDeployed.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-4">
                {isOperator ? 'Not Yet Deployed' : 'Pending Rollouts'}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {notDeployed.map((member, index) => (
                  <Card 
                    key={member.staff_id} 
                    className={cn(
                      'border-dashed opacity-60 hover:opacity-100 transition-all',
                      'animate-fade-in'
                    )}
                    style={{ animationDelay: `${(rollouts.length + index) * 100}ms` }}
                  >
                    <CardContent className="p-4 text-center">
                      <div className="flex justify-center mb-3">
                        <StaffAvatar
                          staffId={member.staff_id}
                          name={member.name}
                          size="sm"
                          status="draft"
                        />
                      </div>
                      <p className="text-sm font-medium text-foreground truncate">{member.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Not deployed</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Premium Rollout Detail Drawer */}
      <Sheet open={!!selectedRollout} onOpenChange={(open) => !open && setSelectedRollout(null)}>
        <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col">
          {selectedRollout && (
            <>
              <SheetHeader className="p-6 border-b border-border shrink-0 bg-gradient-to-r from-surface-2/50 to-transparent">
                <div className="flex items-center gap-4">
                  <StaffAvatar
                    staffId={selectedRollout.staff_id}
                    name={getStaffMember(selectedRollout.staff_id)?.name || ''}
                    size="lg"
                    status={selectedRollout.status === 'active' ? 'active' : 'paused'}
                    showStatus
                  />
                  <div>
                    <SheetTitle className="text-lg">
                      {getStaffMember(selectedRollout.staff_id)?.name}
                    </SheetTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {isOperator 
                        ? `${envLabels[selectedRollout.environment].label} deployment`
                        : `${selectedRollout.staff_id} • ${selectedRollout.environment}`
                      }
                    </p>
                  </div>
                </div>
              </SheetHeader>

              <ScrollArea className="flex-1">
                <div className="p-6 space-y-6">
                  {/* Status Cards */}
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="border-border bg-gradient-to-br from-card to-surface-2">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="h-4 w-4 text-primary" />
                          <span className="text-xs text-muted-foreground">Rollout</span>
                        </div>
                        <p className="text-3xl font-bold text-foreground">{selectedRollout.percentage}%</p>
                      </CardContent>
                    </Card>
                    <Card className="border-border bg-gradient-to-br from-card to-surface-2">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle className="h-4 w-4 text-success" />
                          <span className="text-xs text-muted-foreground">Status</span>
                        </div>
                        <Badge className={cn('text-sm mt-1', statusLabels[selectedRollout.status].color)}>
                          {statusLabels[selectedRollout.status].label}
                        </Badge>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Set Percentage */}
                  <Card className="border-border">
                    <CardHeader className="pb-2 bg-gradient-to-r from-surface-2/50 to-transparent">
                      <CardTitle className="text-sm">
                        {isOperator ? 'Adjust Rollout' : 'Set Percentage'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Target</span>
                          <span className="text-2xl font-bold text-primary">{newPercentage}%</span>
                        </div>
                        <Slider
                          value={[newPercentage]}
                          onValueChange={([val]) => setNewPercentage(val)}
                          max={100}
                          step={10}
                          disabled={safetyMode}
                          className="py-2"
                        />
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>0%</span>
                          <span>50%</span>
                          <span>100%</span>
                        </div>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="block">
                            <Button 
                              className={cn(
                                'w-full gap-2',
                                !safetyMode && newPercentage !== selectedRollout.percentage && 
                                'shadow-[0_0_20px_hsl(var(--primary)/0.2)]'
                              )}
                              disabled={safetyMode || newPercentage === selectedRollout.percentage}
                            >
                              <Rocket className="h-4 w-4" />
                              {isOperator ? 'Apply Changes' : 'Set Percentage'}
                            </Button>
                          </span>
                        </TooltipTrigger>
                        {safetyMode && (
                          <TooltipContent>
                            Disabled while Safety Mode is active
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </CardContent>
                  </Card>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="flex-1">
                          <Button variant="outline" className="w-full gap-2" disabled={safetyMode}>
                            <Pause className="h-4 w-4" />
                            Pause
                          </Button>
                        </span>
                      </TooltipTrigger>
                      {safetyMode && (
                        <TooltipContent>Disabled while Safety Mode is active</TooltipContent>
                      )}
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="flex-1">
                          <Button variant="outline" className="w-full gap-2" disabled={safetyMode}>
                            <RotateCcw className="h-4 w-4" />
                            Rollback
                          </Button>
                        </span>
                      </TooltipTrigger>
                      {safetyMode && (
                        <TooltipContent>Disabled while Safety Mode is active</TooltipContent>
                      )}
                    </Tooltip>
                  </div>

                  {/* History Timeline */}
                  <Card className="border-border">
                    <CardHeader className="pb-2 bg-gradient-to-r from-surface-2/50 to-transparent">
                      <CardTitle className="text-sm">
                        {isOperator ? 'Deployment History' : 'Rollout History'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="space-y-4">
                        {selectedRollout.history.map((entry, idx) => (
                          <div key={idx} className="flex gap-3">
                            <div className="flex flex-col items-center">
                              <div className={cn(
                                'h-3 w-3 rounded-full mt-1',
                                idx === 0 ? 'bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.5)]' : 'bg-muted'
                              )} />
                              {idx < selectedRollout.history.length - 1 && (
                                <div className="w-px flex-1 bg-border mt-1" />
                              )}
                            </div>
                            <div className="flex-1 pb-4">
                              <p className="text-sm font-medium text-foreground">{entry.action}</p>
                              <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1">
                                <User className="h-3 w-3" />
                                <span>{entry.actor}</span>
                                <span>•</span>
                                <Clock className="h-3 w-3" />
                                <span>{formatDate(entry.timestamp)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
