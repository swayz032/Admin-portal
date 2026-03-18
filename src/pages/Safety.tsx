import { useState } from 'react';
import { PageHero } from '@/components/shared/PageHero';
import { QuickStats } from '@/components/shared/QuickStats';
import { InsightPanel } from '@/components/shared/InsightPanel';
import { Panel } from '@/components/shared/Panel';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useSystem } from '@/contexts/SystemContext';
import { useReceipts } from '@/hooks/useAdminData';
import { PageLoadingState } from '@/components/shared/PageLoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatTimeAgo } from '@/lib/formatters';
import { Shield, AlertTriangle, Power, Activity, CheckCircle, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ModeText } from '@/components/shared/ModeText';
import { derivePremiumActionLabel } from '@/services/apiClient';

const autonomyDescriptions = {
  'Limited': 'Most actions require manual approval. Automations are paused or run in read-only mode.',
  'Standard': 'Normal operation mode. Risk-based approvals apply. Automations run as configured.',
  'Emergency Stop': 'All automations halted immediately. Only essential monitoring continues.',
};

export default function Safety() {
  const { systemState, toggleSafetyMode, setAutonomyLevel, viewMode } = useSystem();
  const { data: receipts, loading: receiptsLoading, error: receiptsError, refetch: refetchReceipts } = useReceipts();
  const [confirmDialog, setConfirmDialog] = useState<'toggle' | 'autonomy' | null>(null);
  const [pendingAutonomy, setPendingAutonomy] = useState<typeof systemState.autonomyLevel | null>(null);

  if (receiptsLoading) return <PageLoadingState showKPIs rows={5} />;
  if (receiptsError) return <EmptyState variant="error" title="Failed to load safety data" description={receiptsError} actionLabel="Retry" onAction={refetchReceipts} />;

  const safeReceipts = receipts ?? [];
  const recentSafetyActions = safeReceipts.filter(r =>
    r.outcome === 'Blocked' ||
    r.actionType.toLowerCase().includes('safety') ||
    r.actionType.toLowerCase().includes('disconnect')
  ).slice(0, 5);

  const blockedCount = safeReceipts.filter(r => r.outcome === 'Blocked').length;

  const handleToggleSafetyMode = () => {
    toggleSafetyMode();
    setConfirmDialog(null);
  };

  const handleAutonomyChange = (value: typeof systemState.autonomyLevel) => {
    setPendingAutonomy(value);
    setConfirmDialog('autonomy');
  };

  const confirmAutonomyChange = () => {
    if (pendingAutonomy) {
      setAutonomyLevel(pendingAutonomy);
    }
    setConfirmDialog(null);
    setPendingAutonomy(null);
  };

  const quickStats = [
    { 
      label: 'safety mode', 
      value: systemState.safetyMode ? 'ON' : 'OFF', 
      status: systemState.safetyMode ? 'warning' as const : 'success' as const 
    },
    { label: 'autonomy level', value: systemState.autonomyLevel },
    { label: 'blocked this week', value: blockedCount, status: blockedCount > 0 ? 'warning' as const : 'success' as const },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Hero Section */}
      <PageHero
        title={systemState.safetyMode 
          ? "Safety Mode is protecting your system" 
          : "Everything is running normally"}
        subtitle={viewMode === 'operator' 
          ? "Control how your system handles risky operations" 
          : "System safety controls and automation governance"}
        icon={<Shield className="h-6 w-6" />}
        status={systemState.safetyMode 
          ? { type: 'warning', label: 'Safety Mode ON' }
          : { type: 'success', label: 'Normal operation' }}
        action={
          <Button 
            size="lg"
            variant={systemState.safetyMode ? 'default' : 'outline'}
            className={!systemState.safetyMode ? 'border-warning text-warning hover:bg-warning/10' : ''}
            onClick={() => setConfirmDialog('toggle')}
          >
            <Power className="h-4 w-4 mr-2" />
            {systemState.safetyMode ? 'Disable Safety Mode' : 'Enable Safety Mode'}
          </Button>
        }
      />

      {/* Quick Stats */}
      <QuickStats stats={quickStats} />

      {/* Story Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <InsightPanel
          headline={systemState.safetyMode ? "Write operations restricted" : "All operations enabled"}
          subtext={systemState.safetyMode 
            ? "Risky automations are paused until you disable Safety Mode" 
            : "Your system is operating normally with standard approval rules"}
          trend={systemState.safetyMode ? 'neutral' : 'positive'}
          icon={systemState.safetyMode ? <Lock className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
        />
        <InsightPanel
          headline={`${blockedCount} risky actions blocked`}
          subtext="This week by safety rules"
          trend={blockedCount > 0 ? 'neutral' : 'positive'}
          icon={<AlertTriangle className="h-5 w-5" />}
          linkTo="/activity?outcome=Blocked"
          linkLabel="View blocked actions"
        />
        <InsightPanel
          headline={`Autonomy: ${systemState.autonomyLevel}`}
          subtext={autonomyDescriptions[systemState.autonomyLevel].slice(0, 50) + '...'}
          trend="neutral"
          icon={<Activity className="h-5 w-5" />}
        />
      </div>

      {/* Autonomy Level Control */}
      <Panel title={viewMode === 'operator' ? "System Autonomy" : "Autonomy Level"}>
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">
                {viewMode === 'operator' 
                  ? "Control how much the system can do on its own."
                  : "Control how much autonomy the system has for automated actions."}
              </p>
            </div>
            <Select value={systemState.autonomyLevel} onValueChange={handleAutonomyChange}>
              <SelectTrigger className="w-[200px] bg-muted border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="Limited">{viewMode === 'operator' ? 'Ask Me First' : 'Limited'}</SelectItem>
                <SelectItem value="Standard">{viewMode === 'operator' ? 'Normal' : 'Standard'}</SelectItem>
                <SelectItem value="Emergency Stop">{viewMode === 'operator' ? 'Stop Everything' : 'Emergency Stop'}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-border">
            {(['Limited', 'Standard', 'Emergency Stop'] as const).map((level) => (
              <div 
                key={level}
                className={`p-4 rounded-lg border transition-colors ${
                  systemState.autonomyLevel === level 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border bg-muted/30'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2 h-2 rounded-full ${
                    level === 'Emergency Stop' ? 'bg-destructive' :
                    level === 'Limited' ? 'bg-warning' : 'bg-success'
                  }`} />
                  <span className="font-medium text-sm">
                    {viewMode === 'operator' 
                      ? (level === 'Limited' ? 'Ask Me First' : level === 'Standard' ? 'Normal' : 'Stop Everything')
                      : level}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{autonomyDescriptions[level]}</p>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      {/* Recent Safety Actions */}
      <Panel 
        title={viewMode === 'operator' ? "Recent Safety Activity" : "Recent Safety Actions"}
        action={
          <Link to="/activity" className="text-xs text-primary hover:underline">
            View all activity
          </Link>
        }
      >
        {recentSafetyActions.length > 0 ? (
          <div className="space-y-3">
            {recentSafetyActions.map((action) => (
              <div key={action.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border">
                <div className={`p-2 rounded-md ${
                  action.outcome === 'Blocked' ? 'bg-warning/20' : 'bg-muted'
                }`}>
                  {action.outcome === 'Blocked' ? (
                    <AlertTriangle className="h-4 w-4 text-warning" />
                  ) : (
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{derivePremiumActionLabel(action.actionType, 'operator')}</span>
                    <span className="text-xs text-muted-foreground">{formatTimeAgo(action.timestamp)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {action.actor} • {action.provider}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-success mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground">No recent safety-related actions.</p>
          </div>
        )}
      </Panel>

      {/* Toggle Confirmation Dialog */}
      <Dialog open={confirmDialog === 'toggle'} onOpenChange={() => setConfirmDialog(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {systemState.safetyMode ? 'Disable Safety Mode?' : 'Enable Safety Mode?'}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {systemState.safetyMode 
                ? 'This will restore normal operation. Automated actions will resume based on configured rules.'
                : 'This will restrict write operations and require manual approval for risky actions.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>
              Cancel
            </Button>
            <Button 
              onClick={handleToggleSafetyMode}
              className={!systemState.safetyMode ? 'bg-warning text-warning-foreground hover:bg-warning/90' : ''}
            >
              {systemState.safetyMode ? 'Disable' : 'Enable'} Safety Mode
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Autonomy Confirmation Dialog */}
      <Dialog open={confirmDialog === 'autonomy'} onOpenChange={() => setConfirmDialog(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Change Autonomy Level?
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              You are about to change the autonomy level to <strong>{pendingAutonomy}</strong>.
              {pendingAutonomy && (
                <span className="block mt-2">{autonomyDescriptions[pendingAutonomy]}</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>
              Cancel
            </Button>
            <Button 
              onClick={confirmAutonomyChange}
              className={pendingAutonomy === 'Emergency Stop' ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              Confirm Change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
