import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useSystem } from '@/contexts/SystemContext';
import { Rollout, RolloutStatus, RolloutEnvironment } from '@/contracts/control-plane';
import { 
  listRollouts, 
  setRolloutPercentage, 
  pauseRollout, 
  rollbackRollout 
} from '@/services/controlPlaneClient';
import { Panel } from '@/components/shared/Panel';
import { DataTable } from '@/components/shared/DataTable';
import { StatusChip } from '@/components/shared/StatusChip';
import { PurposeStrip } from '@/components/shared/PurposeStrip';
import { QuickStats } from '@/components/shared/QuickStats';
import { ModeText } from '@/components/shared/ModeText';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { formatTimeAgo } from '@/lib/formatters';
import {
  Search,
  Play,
  Pause,
  RotateCcw,
  Clock,
  CheckCircle,
  AlertTriangle,
  ArrowUpCircle,
  User,
} from 'lucide-react';
import { toast } from 'sonner';

export default function Rollouts() {
  const { viewMode, systemState } = useSystem();
  const safetyMode = systemState.safetyMode;
  
  const [rollouts, setRollouts] = useState<Rollout[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRollout, setSelectedRollout] = useState<Rollout | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [envFilter, setEnvFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [newPercentage, setNewPercentage] = useState<number>(0);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadRollouts();
  }, []);

  useEffect(() => {
    if (selectedRollout) {
      setNewPercentage(selectedRollout.percentage);
    }
  }, [selectedRollout]);

  const loadRollouts = async () => {
    setLoading(true);
    const data = await listRollouts();
    setRollouts(data);
    setLoading(false);
  };

  const filteredRollouts = rollouts.filter(r => {
    if (envFilter !== 'all' && r.environment !== envFilter) return false;
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return r.registry_item_name.toLowerCase().includes(term);
    }
    return true;
  });

  const stats = [
    { 
      label: 'Active', 
      value: rollouts.filter(r => r.status === 'active').length, 
      icon: Play,
      variant: 'success' as const
    },
    { 
      label: 'Paused', 
      value: rollouts.filter(r => r.status === 'paused').length, 
      icon: Pause,
      variant: 'warning' as const
    },
    { 
      label: 'Rolling Back', 
      value: rollouts.filter(r => r.status === 'rolling_back').length, 
      icon: RotateCcw,
      variant: 'warning' as const
    },
  ];

  const getStatusVariant = (status: RolloutStatus): 'success' | 'warning' | 'pending' | 'neutral' => {
    switch (status) {
      case 'active': return 'success';
      case 'completed': return 'success';
      case 'paused': return 'warning';
      case 'rolling_back': return 'warning';
      default: return 'neutral';
    }
  };

  const getEnvColor = (env: RolloutEnvironment) => {
    switch (env) {
      case 'production': return 'text-destructive';
      case 'staging': return 'text-warning';
      case 'development': return 'text-muted-foreground';
    }
  };

  const handleSetPercentage = async () => {
    if (!selectedRollout) return;
    setUpdating(true);
    try {
      const updated = await setRolloutPercentage(selectedRollout.id, newPercentage);
      setRollouts(prev => prev.map(r => r.id === updated.id ? updated : r));
      setSelectedRollout(updated);
      toast.success(viewMode === 'operator' ? 'Deployment updated!' : 'Rollout percentage set');
    } catch (error) {
      toast.error('Failed to update');
    } finally {
      setUpdating(false);
    }
  };

  const handlePause = async () => {
    if (!selectedRollout) return;
    setUpdating(true);
    try {
      const updated = await pauseRollout(selectedRollout.id);
      setRollouts(prev => prev.map(r => r.id === updated.id ? updated : r));
      setSelectedRollout(updated);
      toast.success(viewMode === 'operator' ? 'Deployment paused' : 'Rollout paused');
    } catch (error) {
      toast.error('Failed to pause');
    } finally {
      setUpdating(false);
    }
  };

  const handleRollback = async () => {
    if (!selectedRollout) return;
    setUpdating(true);
    try {
      await rollbackRollout(selectedRollout.id);
      toast.success(viewMode === 'operator' ? 'Rollback requested' : 'Rollback proposal created');
      loadRollouts();
    } catch (error) {
      toast.error('Failed to rollback');
    } finally {
      setUpdating(false);
    }
  };

  const columns = viewMode === 'operator' ? [
    { 
      key: 'registry_item_name', 
      header: 'Agent',
      render: (r: Rollout) => (
        <span className="font-medium">{r.registry_item_name}</span>
      )
    },
    { 
      key: 'environment', 
      header: 'Environment',
      render: (r: Rollout) => (
        <span className={cn('capitalize font-medium', getEnvColor(r.environment))}>
          {r.environment}
        </span>
      )
    },
    { 
      key: 'percentage', 
      header: 'Progress',
      render: (r: Rollout) => (
        <div className="flex items-center gap-3 min-w-[120px]">
          <Progress value={r.percentage} className="h-2 flex-1" />
          <span className="text-sm text-muted-foreground w-10">{r.percentage}%</span>
        </div>
      )
    },
    { 
      key: 'status', 
      header: 'Status',
      render: (r: Rollout) => (
        <StatusChip status={getStatusVariant(r.status)} label={r.status} />
      )
    },
    { 
      key: 'updated_at', 
      header: 'Updated',
      render: (r: Rollout) => (
        <span className="text-muted-foreground">{formatTimeAgo(r.updated_at)}</span>
      )
    },
  ] : [
    { 
      key: 'id', 
      header: 'Rollout ID',
      render: (r: Rollout) => (
        <code className="text-xs text-muted-foreground">{r.id}</code>
      )
    },
    { 
      key: 'registry_item_name', 
      header: 'Registry Item',
      render: (r: Rollout) => (
        <span className="font-medium">{r.registry_item_name}</span>
      )
    },
    { key: 'environment', header: 'Env' },
    { 
      key: 'percentage', 
      header: '%',
      render: (r: Rollout) => <span>{r.percentage}%</span>
    },
    { 
      key: 'status', 
      header: 'Status',
      render: (r: Rollout) => (
        <StatusChip status={getStatusVariant(r.status)} label={r.status} />
      )
    },
    { 
      key: 'updated_at', 
      header: 'Updated',
      render: (r: Rollout) => (
        <span className="text-xs">{new Date(r.updated_at).toLocaleDateString()}</span>
      )
    },
  ];

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'created': return <ArrowUpCircle className="h-4 w-4 text-primary" />;
      case 'percentage_changed': return <ArrowUpCircle className="h-4 w-4 text-success" />;
      case 'paused': return <Pause className="h-4 w-4 text-warning" />;
      case 'resumed': return <Play className="h-4 w-4 text-success" />;
      case 'rollback_initiated': return <RotateCcw className="h-4 w-4 text-destructive" />;
      case 'completed': return <CheckCircle className="h-4 w-4 text-success" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">
          <ModeText operator="Deploy Controls" engineer="Rollouts" />
        </h1>
        <p className="page-subtitle">
          <ModeText 
            operator="Control how your agents are deployed across environments" 
            engineer="Manage rollout configurations and percentage-based deployments"
          />
        </p>
      </div>

      <PurposeStrip
        operatorPurpose="Control the rollout of agents to different environments. Gradually increase deployment or pause if issues arise."
        engineerPurpose="Percentage-based rollout management with history tracking and rollback capabilities."
        operatorAction="Adjust deployment percentages or pause rollouts"
        engineerObjects={['Rollout', 'RolloutHistoryEntry', 'ConfigChangeProposal']}
        variant="compact"
      />

      {safetyMode && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-warning/10 border border-warning/30">
          <AlertTriangle className="h-5 w-5 text-warning" />
          <div>
            <div className="font-medium text-warning">
              <ModeText operator="Safety Mode is ON" engineer="Safety Mode Active" />
            </div>
            <div className="text-sm text-muted-foreground">
              <ModeText 
                operator="Rollout changes are restricted until Safety Mode is turned off" 
                engineer="Rollout mutations disabled while safetyMode === true"
              />
            </div>
          </div>
        </div>
      )}

      <QuickStats stats={stats} />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={viewMode === 'operator' ? 'Search agents...' : 'Search rollouts...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={envFilter} onValueChange={setEnvFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Environment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Environments</SelectItem>
            <SelectItem value="production">Production</SelectItem>
            <SelectItem value="staging">Staging</SelectItem>
            <SelectItem value="development">Development</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="rolling_back">Rolling Back</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Panel>
        {loading ? (
          <div className="loading-state">Loading rollouts...</div>
        ) : filteredRollouts.length === 0 ? (
          <div className="empty-state">
            <ArrowUpCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-2">
              <ModeText operator="No deployments yet" engineer="No rollouts found" />
            </h3>
            <p className="text-muted-foreground text-sm">
              <ModeText 
                operator="Deploy an agent from the registry to see it here" 
                engineer="Create rollouts from Registry Items"
              />
            </p>
          </div>
        ) : (
          <DataTable
            data={filteredRollouts}
            columns={columns}
            keyExtractor={(r) => r.id}
            onRowClick={(r) => setSelectedRollout(r)}
          />
        )}
      </Panel>

      {/* Detail Drawer */}
      <Sheet open={!!selectedRollout} onOpenChange={() => setSelectedRollout(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedRollout && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedRollout.registry_item_name}</SheetTitle>
                <div className="flex items-center gap-2 mt-1">
                  <span className={cn('capitalize font-medium text-sm', getEnvColor(selectedRollout.environment))}>
                    {selectedRollout.environment}
                  </span>
                  <StatusChip status={getStatusVariant(selectedRollout.status)} label={selectedRollout.status} />
                </div>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Current Percentage */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">
                      <ModeText operator="Deployment Progress" engineer="Current Percentage" />
                    </h4>
                    <span className="text-2xl font-bold">{selectedRollout.percentage}%</span>
                  </div>
                  <Progress value={selectedRollout.percentage} className="h-3" />
                </div>

                {/* Set Percentage */}
                <div className="space-y-4 pt-4 border-t border-border">
                  <h4 className="font-medium">
                    <ModeText operator="Adjust Deployment" engineer="Set Percentage" />
                  </h4>
                  <div className="space-y-4">
                    <Slider
                      value={[newPercentage]}
                      onValueChange={([v]) => setNewPercentage(v)}
                      max={100}
                      step={10}
                      disabled={safetyMode}
                    />
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">0%</span>
                      <span className="font-medium">{newPercentage}%</span>
                      <span className="text-muted-foreground">100%</span>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <Button
                            onClick={handleSetPercentage}
                            disabled={safetyMode || updating || newPercentage === selectedRollout.percentage}
                            className="w-full"
                          >
                            <ModeText operator="Update Deployment" engineer="Set Percentage" />
                          </Button>
                        </div>
                      </TooltipTrigger>
                      {safetyMode && (
                        <TooltipContent>
                          <ModeText 
                            operator="Restricted when Safety Mode is ON" 
                            engineer="Disabled: safetyMode === true"
                          />
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t border-border">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex-1">
                        <Button
                          variant="outline"
                          onClick={handlePause}
                          disabled={safetyMode || updating || selectedRollout.status === 'paused'}
                          className="w-full gap-2"
                        >
                          <Pause className="h-4 w-4" />
                          Pause
                        </Button>
                      </div>
                    </TooltipTrigger>
                    {safetyMode && (
                      <TooltipContent>Restricted when Safety Mode is ON</TooltipContent>
                    )}
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex-1">
                        <Button
                          variant="outline"
                          onClick={handleRollback}
                          disabled={safetyMode || updating}
                          className="w-full gap-2 text-destructive hover:text-destructive"
                        >
                          <RotateCcw className="h-4 w-4" />
                          Rollback
                        </Button>
                      </div>
                    </TooltipTrigger>
                    {safetyMode && (
                      <TooltipContent>Restricted when Safety Mode is ON</TooltipContent>
                    )}
                  </Tooltip>
                </div>

                {/* History Timeline */}
                <div className="pt-4 border-t border-border">
                  <h4 className="font-medium mb-4">
                    <ModeText operator="History" engineer="Rollout History" />
                  </h4>
                  <div className="space-y-3">
                    {selectedRollout.history.slice().reverse().map((entry, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <div className="mt-0.5">
                          {getActionIcon(entry.action)}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium capitalize">
                            {entry.action.replace(/_/g, ' ')}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            <span>{entry.percentage}%</span>
                            <span>•</span>
                            <span>{formatTimeAgo(entry.timestamp)}</span>
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <User className="h-3 w-3" />
                            {entry.actor}
                          </div>
                          {entry.notes && (
                            <div className="text-xs text-muted-foreground mt-1 italic">
                              "{entry.notes}"
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {viewMode === 'engineer' && (
                  <div className="pt-4 border-t border-border space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Rollout ID</span>
                      <code className="text-xs">{selectedRollout.id}</code>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Registry Item ID</span>
                      <code className="text-xs">{selectedRollout.registry_item_id}</code>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Created By</span>
                      <span className="text-xs">{selectedRollout.created_by}</span>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
