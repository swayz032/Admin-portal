import { useState } from 'react';
import { PageHero } from '@/components/shared/PageHero';
import { QuickStats } from '@/components/shared/QuickStats';
import { InsightPanel } from '@/components/shared/InsightPanel';
import { Panel } from '@/components/shared/Panel';
import { DataTable } from '@/components/shared/DataTable';
import { StatusChip } from '@/components/shared/StatusChip';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import type { Provider } from '@/data/seed';
import { useProviders } from '@/hooks/useAdminData';
import { PageLoadingState } from '@/components/shared/PageLoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatTimeAgo, formatLatency } from '@/lib/formatters';
import { Plug, Settings, RefreshCw, Unlink, ChevronRight, CheckCircle, Shield, Zap, AlertTriangle } from 'lucide-react';
import { useSystem } from '@/contexts/SystemContext';
import { ModeText } from '@/components/shared/ModeText';
import { ProviderHealthGrid } from '@/components/admin-ava/ProviderHealthGrid';
import { useProviderHealthStream } from '@/hooks/useProviderHealthStream';

const pendingConnections = [
  { id: 'CONN-001', provider: 'GitHub', requestedBy: 'dev-team@zenith.io', requestedAt: '2026-01-08T08:00:00Z' },
  { id: 'CONN-002', provider: 'PagerDuty', requestedBy: 'ops@zenith.io', requestedAt: '2026-01-07T16:30:00Z' },
];

type PendingApprovalRequest = {
  id: string;
  provider: string;
  action: 'scope' | 'rotate' | 'disconnect';
  createdAt: string;
  status: 'pending';
};

export default function ConnectedApps() {
  const { viewMode, systemState } = useSystem();
  const { data: providers, loading: providersLoading, error: providersError, refetch: refetchProviders } = useProviders();
  const { providers: liveProviders, isConnected: streamConnected, hasIssues: liveHasIssues } = useProviderHealthStream();
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [actionDialog, setActionDialog] = useState<{ provider: Provider; action: 'scope' | 'rotate' | 'disconnect' } | null>(null);
  const [createdApprovalRequests, setCreatedApprovalRequests] = useState<PendingApprovalRequest[]>([]);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const isSafetyModeOn = systemState.safetyMode;

  if (providersLoading) return <PageLoadingState showKPIs rows={5} />;
  if (providersError) return <EmptyState variant="error" title="Failed to load connected apps" description={providersError} actionLabel="Retry" onAction={refetchProviders} />;

  // Stats
  const healthyProviders = providers.filter(p => p.status === 'Healthy').length;
  const atRiskProviders = providers.filter(p => p.status === 'At Risk').length;
  const avgLatency = Math.round(providers.reduce((sum, p) => sum + p.p95Latency, 0) / providers.length);

  const quickStats = [
    { label: 'connected', value: providers.length, status: 'success' as const },
    { label: 'healthy', value: healthyProviders, status: 'success' as const },
    { label: 'slow', value: atRiskProviders, status: atRiskProviders > 0 ? 'warning' as const : 'success' as const },
    { label: 'avg latency', value: `${avgLatency}ms` },
  ];

  const getStatusType = (status: Provider['status']) => {
    switch (status) {
      case 'Healthy': return 'success';
      case 'At Risk': return 'warning';
      case 'Writes Paused': return 'pending';
      case 'Read-only Allowed': return 'neutral';
      default: return 'neutral';
    }
  };

  const getOperatorStatus = (status: Provider['status']) => {
    switch (status) {
      case 'Healthy': return 'Connected';
      case 'At Risk': return 'Slow';
      case 'Writes Paused': return 'Limited';
      case 'Read-only Allowed': return 'Read Only';
      default: return status;
    }
  };

  const handleAction = () => {
    if (!actionDialog) return;
    
    const newRequest: PendingApprovalRequest = {
      id: `APR-${Date.now()}`,
      provider: actionDialog.provider.name,
      action: actionDialog.action,
      createdAt: new Date().toISOString(),
      status: 'pending',
    };
    
    setCreatedApprovalRequests(prev => [...prev, newRequest]);
    setSuccessToast(`Approval request created: ${newRequest.id}`);
    setTimeout(() => setSuccessToast(null), 3000);
    
    setActionDialog(null);
  };

  const columns = viewMode === 'operator' ? [
    { 
      key: 'name', 
      header: 'Service', 
      render: (p: Provider) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
            <Plug className="h-4 w-4 text-primary" />
          </div>
          <span className="font-medium">{p.name}</span>
        </div>
      ) 
    },
    { 
      key: 'status', 
      header: 'Status', 
      render: (p: Provider) => <StatusChip status={getStatusType(p.status)} label={getOperatorStatus(p.status)} /> 
    },
    { key: 'lastSyncTime', header: 'Last Active', render: (p: Provider) => <span className="text-muted-foreground">{formatTimeAgo(p.lastSyncTime)}</span> },
  ] : [
    { 
      key: 'name', 
      header: 'Provider', 
      render: (p: Provider) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
            <Plug className="h-4 w-4 text-primary" />
          </div>
          <span className="font-medium">{p.name}</span>
        </div>
      ) 
    },
    { 
      key: 'status', 
      header: 'Status', 
      render: (p: Provider) => <StatusChip status={getStatusType(p.status)} label={p.status} /> 
    },
    { key: 'permissionsSummary', header: 'Permissions', className: 'max-w-xs truncate' },
    { key: 'lastSyncTime', header: 'Last Sync', render: (p: Provider) => <span className="text-muted-foreground">{formatTimeAgo(p.lastSyncTime)}</span> },
    { 
      key: 'p95Latency', 
      header: 'p95 Latency', 
      render: (p: Provider) => (
        <span className={p.p95Latency > 300 ? 'text-warning' : 'text-muted-foreground'}>
          {formatLatency(p.p95Latency)}
        </span>
      ) 
    },
  ];

  return (
    <TooltipProvider>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Success toast */}
        {successToast && (
          <div className="fixed top-4 right-4 z-50 p-4 bg-success/20 border border-success/30 rounded-lg flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-success" />
            <span className="text-sm text-success">{successToast}</span>
          </div>
        )}
        
        {/* Hero Section */}
        <PageHero
          title={viewMode === 'operator' 
            ? `All ${providers.length} services connected and healthy`
            : `${providers.length} providers connected`}
          subtitle={viewMode === 'operator' 
            ? "View and manage your connected third-party services" 
            : "Manage provider integrations and connection health"}
          icon={<Plug className="h-6 w-6" />}
          status={atRiskProviders === 0 
            ? { type: 'success', label: 'All healthy' }
            : { type: 'warning', label: `${atRiskProviders} slow` }}
        />

        {/* Live Provider Health (SSE) */}
        <Panel title="Live Provider Health" noPadding={false}>
          <ProviderHealthGrid liveProviders={streamConnected ? liveProviders : undefined} />
        </Panel>

        {/* Quick Stats */}
        <QuickStats stats={quickStats} />

        {/* Story Insights */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <InsightPanel
            headline={healthyProviders === providers.length ? "All services healthy" : `${healthyProviders} of ${providers.length} healthy`}
            subtext={atRiskProviders > 0 ? `${atRiskProviders} running slow` : "No connection issues"}
            trend={atRiskProviders === 0 ? 'positive' : 'neutral'}
            icon={<CheckCircle className="h-5 w-5" />}
          />
          <InsightPanel
            headline="Stripe most active"
            subtext={`${providers.find(p => p.name === 'Stripe')?.recentReceiptsCount || 0} actions this week`}
            trend="positive"
            icon={<Zap className="h-5 w-5" />}
            linkTo="/activity?provider=Stripe"
            linkLabel="View activity"
          />
          <InsightPanel
            headline={`Average latency: ${avgLatency}ms`}
            subtext={avgLatency < 200 ? "Within normal range" : "Slightly elevated"}
            trend={avgLatency < 200 ? 'positive' : 'neutral'}
            icon={<Plug className="h-5 w-5" />}
          />
        </div>

        {/* Providers Table */}
        <Panel title={viewMode === 'operator' ? "Your Services" : "Connected Providers"} noPadding>
          <DataTable
            columns={columns}
            data={providers}
            keyExtractor={(p: Provider) => p.id}
            onRowClick={(p) => setSelectedProvider(p)}
          />
        </Panel>

        {/* Pending Connection Requests */}
        {(pendingConnections.length > 0 || createdApprovalRequests.length > 0) && (
          <Panel title={viewMode === 'operator' ? "Waiting for Approval" : "Pending Connection Requests"}>
            <div className="space-y-3">
              {createdApprovalRequests.map((req) => (
                <div key={req.id} className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/30">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-primary/20 flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{req.provider} - {req.action}</p>
                      <p className="text-xs text-muted-foreground">Approval Request: {req.id}</p>
                    </div>
                  </div>
                  <StatusChip status="pending" label="Pending Approval" />
                </div>
              ))}
              {pendingConnections.map((conn) => (
                <div key={conn.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                      <Plug className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{conn.provider}</p>
                      <p className="text-xs text-muted-foreground">
                        {viewMode === 'operator' 
                          ? `Requested ${formatTimeAgo(conn.requestedAt)}`
                          : `Requested by ${conn.requestedBy}`
                        }
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <a href="/approvals">Review</a>
                  </Button>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {/* Provider Detail Dialog */}
        <Dialog open={!!selectedProvider} onOpenChange={() => setSelectedProvider(null)}>
          <DialogContent className="bg-card border-border max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-foreground flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Plug className="h-5 w-5 text-primary" />
                </div>
                {selectedProvider?.name}
              </DialogTitle>
            </DialogHeader>
            {selectedProvider && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <StatusChip 
                    status={getStatusType(selectedProvider.status)} 
                    label={viewMode === 'operator' ? getOperatorStatus(selectedProvider.status) : selectedProvider.status} 
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-muted/50 border border-border">
                    <p className="text-xs text-muted-foreground">Last Active</p>
                    <p className="text-sm">{formatTimeAgo(selectedProvider.lastSyncTime)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 border border-border">
                    <p className="text-xs text-muted-foreground">Latency</p>
                    <p className={`text-sm ${selectedProvider.p95Latency > 300 ? 'text-warning' : ''}`}>
                      {formatLatency(selectedProvider.p95Latency)}
                    </p>
                  </div>
                </div>

                {viewMode === 'engineer' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-muted/50 border border-border">
                      <p className="text-xs text-muted-foreground">Rotation Mode</p>
                      <p className="text-sm">{selectedProvider.rotationMode?.replace(/_/g, ' ') || 'unknown'}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50 border border-border">
                      <p className="text-xs text-muted-foreground">Secret Source</p>
                      <p className="text-sm">{selectedProvider.secretSource?.replace(/_/g, ' ') || 'unknown'}</p>
                    </div>
                  </div>
                )}

                {viewMode === 'engineer' && (
                  <div className="p-3 rounded-lg bg-muted/50 border border-border">
                    <p className="text-xs text-muted-foreground mb-1">Permissions</p>
                    <p className="text-sm">{selectedProvider.permissionsSummary}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="pt-4 border-t border-border">
                  {isSafetyModeOn && (
                    <div className="p-2 rounded bg-warning/10 border border-warning/30 flex items-center gap-2 mb-3">
                      <Shield className="h-4 w-4 text-warning" />
                      <span className="text-xs text-warning">Safety Mode is ON - actions restricted</span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          className="flex-1"
                          onClick={() => setActionDialog({ provider: selectedProvider, action: 'scope' })}
                          disabled={isSafetyModeOn}
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          {viewMode === 'operator' ? 'Settings' : 'Scope'}
                        </Button>
                      </TooltipTrigger>
                      {isSafetyModeOn && (
                        <TooltipContent>Restricted when Safety Mode is ON</TooltipContent>
                      )}
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline"
                          className="flex-1"
                          onClick={() => setActionDialog({ provider: selectedProvider, action: 'rotate' })}
                          disabled={isSafetyModeOn}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Rotate Key
                        </Button>
                      </TooltipTrigger>
                      {isSafetyModeOn && (
                        <TooltipContent>Restricted when Safety Mode is ON</TooltipContent>
                      )}
                    </Tooltip>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Action Confirmation Dialog */}
        <Dialog open={!!actionDialog} onOpenChange={() => setActionDialog(null)}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">
                {actionDialog?.action === 'scope' && (viewMode === 'operator' ? 'Change Settings' : 'Request Scope Change')}
                {actionDialog?.action === 'rotate' && 'Rotate API Key'}
                {actionDialog?.action === 'disconnect' && 'Disconnect Service'}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {viewMode === 'operator' 
                  ? `This will create a request to ${actionDialog?.action} for ${actionDialog?.provider.name}. You'll need to approve it before it takes effect.`
                  : `Create approval request for ${actionDialog?.action} on ${actionDialog?.provider.name}.`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setActionDialog(null)}>
                Cancel
              </Button>
              <Button onClick={handleAction}>
                {viewMode === 'operator' ? 'Create Request' : 'Submit Request'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
