import { useState } from 'react';
import { PageHero } from '@/components/shared/PageHero';
import { QuickStats } from '@/components/shared/QuickStats';
import { InsightPanel } from '@/components/shared/InsightPanel';
import { Panel } from '@/components/shared/Panel';
import { DataTable } from '@/components/shared/DataTable';
import { StatusChip } from '@/components/shared/StatusChip';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useProviderRotationSummary } from '@/hooks/useAdminData';
import { useRealProviders, type RealProvider } from '@/hooks/useRealProviders';
import { PageLoadingState } from '@/components/shared/PageLoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatTimeAgo } from '@/lib/formatters';
import { Plug, Settings, RefreshCw, CheckCircle, Shield, Zap, AlertTriangle } from 'lucide-react';
import { useSystem } from '@/contexts/SystemContext';
import { ModeText } from '@/components/shared/ModeText';
import { ProviderHealthGrid } from '@/components/admin-ava/ProviderHealthGrid';
import { useProviderHealthStream } from '@/hooks/useProviderHealthStream';

const pendingConnections: Array<{ id: string; provider: string; requestedBy: string; requestedAt: string }> = [];

type PendingApprovalRequest = {
  id: string;
  provider: string;
  action: 'scope' | 'rotate' | 'disconnect';
  createdAt: string;
  status: 'pending';
};

export default function ConnectedApps() {
  const { viewMode, systemState } = useSystem();
  const { providers, loading: providersLoading, error: providersError, refetch: refetchProviders } = useRealProviders();
  const { data: rotationSummary } = useProviderRotationSummary();
  const { providers: liveProviders, isConnected: streamConnected } = useProviderHealthStream();
  const [selectedProvider, setSelectedProvider] = useState<RealProvider | null>(null);
  const [actionDialog, setActionDialog] = useState<{ provider: RealProvider; action: 'scope' | 'rotate' | 'disconnect' } | null>(null);
  const [createdApprovalRequests, setCreatedApprovalRequests] = useState<PendingApprovalRequest[]>([]);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const isSafetyModeOn = systemState.safetyMode;

  if (providersLoading) return <PageLoadingState showKPIs rows={5} />;
  if (providersError) return <EmptyState variant="error" title="Failed to load connected apps" description={providersError} actionLabel="Retry" onAction={refetchProviders} />;

  const providerList = providers;

  // Stats
  const activeProviders = providerList.filter(p => p.totalReceipts24h > 0).length;
  const connectedProviders = providerList.filter(p => p.status === 'connected').length;
  const degradedProviders = providerList.filter(p => p.status === 'degraded').length;
  const avgSuccessRate = providerList.length > 0
    ? Math.round(providerList.filter(p => p.totalReceipts24h > 0).reduce((sum, p) => sum + p.successRate, 0) / Math.max(activeProviders, 1))
    : 100;

  const quickStats = [
    { label: 'total integrations', value: providerList.length, status: 'success' as const },
    { label: 'active (24h)', value: activeProviders, status: 'success' as const },
    { label: 'healthy', value: connectedProviders, status: 'success' as const },
    { label: 'degraded', value: degradedProviders, status: degradedProviders > 0 ? 'warning' as const : 'success' as const },
    { label: 'avg success rate', value: `${avgSuccessRate}%` },
    ...(rotationSummary ? [{ label: 'auto-rotated', value: rotationSummary.automated_count }] : []),
    ...(rotationSummary?.manual_alerted_with_adapter_modules?.length
      ? [{ label: 'adapter-ready', value: rotationSummary.manual_alerted_with_adapter_modules.length }]
      : []),
  ];

  const getStatusType = (status: RealProvider['status']) => {
    switch (status) {
      case 'connected': return 'success';
      case 'degraded': return 'warning';
      case 'disconnected': return 'critical';
      default: return 'neutral';
    }
  };

  const getOperatorStatus = (status: RealProvider['status']) => {
    switch (status) {
      case 'connected': return 'Healthy';
      case 'degraded': return 'Slow';
      case 'disconnected': return 'Inactive';
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
      render: (p: RealProvider) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
            <Plug className="h-4 w-4 text-primary" />
          </div>
          <div>
            <span className="font-medium">{p.name}</span>
            <span className="ml-2 text-xs text-muted-foreground">{p.category}</span>
          </div>
        </div>
      )
    },
    {
      key: 'status',
      header: 'Status',
      render: (p: RealProvider) => <StatusChip status={getStatusType(p.status)} label={getOperatorStatus(p.status)} />
    },
    { key: 'lastActivity', header: 'Last Active', render: (p: RealProvider) => <span className="text-muted-foreground">{p.lastActivity ? formatTimeAgo(p.lastActivity) : 'No activity'}</span> },
  ] : [
    {
      key: 'name',
      header: 'Provider',
      render: (p: RealProvider) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
            <Plug className="h-4 w-4 text-primary" />
          </div>
          <div>
            <span className="font-medium">{p.name}</span>
            <span className="ml-2 text-xs text-muted-foreground">{p.category}</span>
          </div>
        </div>
      )
    },
    {
      key: 'status',
      header: 'Status',
      render: (p: RealProvider) => <StatusChip status={getStatusType(p.status)} label={getOperatorStatus(p.status)} />
    },
    {
      key: 'successRate',
      header: 'Success Rate',
      render: (p: RealProvider) => (
        <span className={p.successRate < 90 ? 'text-destructive' : p.successRate < 99 ? 'text-warning' : 'text-muted-foreground'}>
          {p.totalReceipts24h > 0 ? `${p.successRate.toFixed(1)}%` : '—'}
        </span>
      )
    },
    {
      key: 'totalReceipts24h',
      header: 'Receipts (24h)',
      render: (p: RealProvider) => <span className="text-muted-foreground font-mono">{p.totalReceipts24h}</span>
    },
    { key: 'lastActivity', header: 'Last Activity', render: (p: RealProvider) => <span className="text-muted-foreground">{p.lastActivity ? formatTimeAgo(p.lastActivity) : 'No activity'}</span> },
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
            ? `${providerList.length} provider integrations`
            : `${providerList.length} provider integrations — ${activeProviders} active`}
          subtitle={viewMode === 'operator'
            ? "View and manage your connected third-party services"
            : "Manage provider integrations and connection health"}
          icon={<Plug className="h-6 w-6" />}
          status={degradedProviders === 0
            ? { type: 'success', label: 'All healthy' }
            : { type: 'warning', label: `${degradedProviders} degraded` }}
        />

        {/* Provider Health (receipt-derived, with SSE fallback) */}
        <Panel title="Provider Health" noPadding={false}>
          <ProviderHealthGrid
            realProviders={providers.length > 0 ? providers : undefined}
            liveProviders={streamConnected ? liveProviders : undefined}
            sourceLabel="Health derived from receipt data"
          />
        </Panel>

        {/* Quick Stats */}
        <QuickStats stats={quickStats} />

        {/* Story Insights */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <InsightPanel
            headline={connectedProviders === activeProviders ? "All active providers healthy" : `${connectedProviders} of ${activeProviders} active providers healthy`}
            subtext={degradedProviders > 0 ? `${degradedProviders} running degraded` : "No connection issues"}
            trend={degradedProviders === 0 ? 'positive' : 'neutral'}
            icon={<CheckCircle className="h-5 w-5" />}
          />
          <InsightPanel
            headline={(() => {
              const top = [...providerList].sort((a, b) => b.totalReceipts24h - a.totalReceipts24h)[0];
              return top && top.totalReceipts24h > 0 ? `${top.name} most active` : 'No activity yet';
            })()}
            subtext={(() => {
              const top = [...providerList].sort((a, b) => b.totalReceipts24h - a.totalReceipts24h)[0];
              return top && top.totalReceipts24h > 0 ? `${top.totalReceipts24h} receipts in last 24h` : 'No provider data';
            })()}
            trend="positive"
            icon={<Zap className="h-5 w-5" />}
            linkTo="/activity"
            linkLabel="View activity"
          />
          <InsightPanel
            headline={`Average success rate: ${avgSuccessRate}%`}
            subtext={avgSuccessRate >= 99 ? "Excellent reliability" : avgSuccessRate >= 90 ? "Within normal range" : "Below target"}
            trend={avgSuccessRate >= 90 ? 'positive' : 'neutral'}
            icon={<Plug className="h-5 w-5" />}
          />
          {rotationSummary && (
            <InsightPanel
              headline={`${(rotationSummary.manual_alerted_with_adapter_modules ?? []).length} providers adapter-ready`}
              subtext={`${(rotationSummary.manual_alerted_without_adapter_modules ?? []).length} still have no automation adapter`}
              trend={(rotationSummary.manual_alerted_without_adapter_modules ?? []).length > 0 ? 'neutral' : 'positive'}
              icon={<AlertTriangle className="h-5 w-5" />}
            />
          )}
        </div>

        {/* Providers Table */}
        <Panel title={viewMode === 'operator' ? "Your Services" : "Connected Providers"} noPadding>
          <DataTable
            columns={columns}
            data={providerList}
            keyExtractor={(p: RealProvider) => p.id}
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
                  <span className="text-xs text-muted-foreground">{selectedProvider.category}</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-muted/50 border border-border">
                    <p className="text-xs text-muted-foreground">Last Activity</p>
                    <p className="text-sm">{selectedProvider.lastActivity ? formatTimeAgo(selectedProvider.lastActivity) : 'No activity'}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 border border-border">
                    <p className="text-xs text-muted-foreground">Success Rate</p>
                    <p className={`text-sm ${selectedProvider.successRate < 90 ? 'text-destructive' : selectedProvider.successRate < 99 ? 'text-warning' : ''}`}>
                      {selectedProvider.totalReceipts24h > 0 ? `${selectedProvider.successRate.toFixed(1)}%` : 'No data'}
                    </p>
                  </div>
                </div>

                {viewMode === 'engineer' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-muted/50 border border-border">
                      <p className="text-xs text-muted-foreground">Receipts (24h)</p>
                      <p className="text-sm font-mono">{selectedProvider.totalReceipts24h}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50 border border-border">
                      <p className="text-xs text-muted-foreground">Failed (24h)</p>
                      <p className={`text-sm font-mono ${selectedProvider.failedReceipts24h > 0 ? 'text-destructive' : ''}`}>{selectedProvider.failedReceipts24h}</p>
                    </div>
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
