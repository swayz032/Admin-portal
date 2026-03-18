import { useState } from 'react';
import { PageHero } from '@/components/shared/PageHero';
import { QuickStats } from '@/components/shared/QuickStats';
import { InsightPanel } from '@/components/shared/InsightPanel';
import { Panel } from '@/components/shared/Panel';
import { DataTable } from '@/components/shared/DataTable';
import { StatusChip } from '@/components/shared/StatusChip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { Receipt } from '@/data/seed';
import { useRealtimeReceipts } from '@/hooks/useRealtimeReceipts';
import { PageLoadingState } from '@/components/shared/PageLoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatDate, formatTimeAgo } from '@/lib/formatters';
import { useSystem } from '@/contexts/SystemContext';
import { Search, Filter, FileCheck, AlertTriangle, Link as LinkIcon, Activity, ChevronDown, CheckCircle, Zap } from 'lucide-react';
import { ModeText } from '@/components/shared/ModeText';
import { derivePremiumActionLabel } from '@/services/apiClient';
import { formatReceiptId, formatCorrelationId } from '@/lib/premiumIds';
import { CopyableId } from '@/components/shared/CopyableId';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';

export default function ActivityPage() {
  const { systemState, viewMode } = useSystem();
  const { data: receipts, loading: receiptsLoading, error: receiptsError, refetch: refetchReceipts } = useRealtimeReceipts();
  const [searchTerm, setSearchTerm] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState<string>('all');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const { copiedId, copyToClipboard } = useCopyToClipboard();

  if (receiptsLoading) return <PageLoadingState showKPIs rows={8} />;
  if (receiptsError) return <EmptyState variant="error" title="Failed to load activity" description={receiptsError} actionLabel="Retry" onAction={refetchReceipts} />;

  const filteredReceipts = receipts.filter(r => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = searchTerm === '' ||
      (r.id ?? '').toLowerCase().includes(term) ||
      (r.correlationId ?? '').toLowerCase().includes(term) ||
      (r.actor ?? '').toLowerCase().includes(term) ||
      (r.actionType ?? '').toLowerCase().includes(term);
    const matchesOutcome = outcomeFilter === 'all' || r.outcome === outcomeFilter;
    const matchesProvider = providerFilter === 'all' || r.provider === providerFilter;
    return matchesSearch && matchesOutcome && matchesProvider;
  });

  const providers = [...new Set(receipts.map(r => r.provider))];

  // Stats
  const successCount = receipts.filter(r => r.outcome === 'Success').length;
  const blockedCount = receipts.filter(r => r.outcome === 'Blocked').length;
  const failedCount = receipts.filter(r => r.outcome === 'Failed').length;

  // Get activity summary
  const todayCount = receipts.filter(r => {
    const today = new Date();
    const receiptDate = new Date(r.timestamp);
    return receiptDate.toDateString() === today.toDateString();
  }).length;

  const quickStats = [
    { label: 'total actions', value: receipts.length },
    { label: 'successful', value: successCount, status: 'success' as const },
    { label: 'blocked', value: blockedCount, status: blockedCount > 0 ? 'warning' as const : 'neutral' as const },
    { label: 'failed', value: failedCount, status: failedCount > 0 ? 'critical' as const : 'neutral' as const },
  ];

  // Operator-friendly columns
  const operatorColumns = [
    { key: 'actionType', header: 'What happened', render: (r: Receipt) => <span className="text-sm">{derivePremiumActionLabel(r.actionType, 'operator')}</span> },
    { key: 'actor', header: 'Who' },
    { 
      key: 'outcome', 
      header: 'Result', 
      render: (r: Receipt) => {
        const labels: Record<string, string> = {
          'Success': 'Completed',
          'Failed': 'Failed',
          'Blocked': 'Blocked',
        };
        return (
          <StatusChip 
            status={r.outcome === 'Success' ? 'success' : r.outcome === 'Blocked' ? 'warning' : 'critical'} 
            label={labels[r.outcome] || r.outcome} 
          />
        );
      }
    },
    { key: 'timestamp', header: 'When', render: (r: Receipt) => <span className="text-muted-foreground">{formatTimeAgo(r.timestamp)}</span> },
  ];

  // Engineer columns
  const engineerColumns = [
    { key: 'id', header: 'Receipt ID', render: (r: Receipt) => <CopyableId fullId={r.id} displayId={formatReceiptId(r.id)} isCopied={copiedId === r.id} onCopy={copyToClipboard} /> },
    { key: 'timestamp', header: 'Timestamp', render: (r: Receipt) => <span className="text-muted-foreground">{formatDate(r.timestamp)}</span> },
    { key: 'actor', header: 'Actor' },
    { key: 'actionType', header: 'Action Type', render: (r: Receipt) => <span className="text-sm" title={r.actionType}>{derivePremiumActionLabel(r.actionType, 'engineer')}</span> },
    { 
      key: 'outcome', 
      header: 'Outcome', 
      render: (r: Receipt) => (
        <StatusChip 
          status={r.outcome === 'Success' ? 'success' : r.outcome === 'Blocked' ? 'warning' : 'critical'} 
          label={r.outcome} 
        />
      ) 
    },
    { key: 'provider', header: 'Provider' },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Hero Section */}
      <PageHero
        title={viewMode === 'operator' 
          ? `Your team handled ${todayCount} tasks today`
          : `${receipts.length} actions logged`}
        subtitle={viewMode === 'operator' 
          ? "See what's been happening across your system" 
          : "Audit trail of all system actions and provider calls"}
        icon={<Activity className="h-6 w-6" />}
        status={{ type: 'success', label: 'All logged' }}
      />

      {/* Quick Stats */}
      <QuickStats stats={quickStats} />

      {/* Story Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <InsightPanel
          headline={`${successCount} successful actions`}
          subtext={`${receipts.length > 0 ? Math.round((successCount / receipts.length) * 100) : 0}% success rate`}
          trend="positive"
          icon={<CheckCircle className="h-5 w-5" />}
        />
        <InsightPanel
          headline={blockedCount > 0 ? `${blockedCount} blocked by safety` : "No blocked actions"}
          subtext={blockedCount > 0 ? "Safety rules protected your system" : "Everything ran smoothly"}
          trend={blockedCount > 0 ? 'neutral' : 'positive'}
          icon={<AlertTriangle className="h-5 w-5" />}
          linkTo="/safety"
          linkLabel="View safety settings"
        />
        <InsightPanel
          headline={(() => {
            const providerCounts = receipts.reduce((acc, r) => { acc[r.provider] = (acc[r.provider] || 0) + 1; return acc; }, {} as Record<string, number>);
            const top = Object.entries(providerCounts).sort((a, b) => b[1] - a[1])[0];
            return top ? `Most active: ${top[0]}` : 'No provider activity';
          })()}
          subtext={(() => {
            const providerCounts = receipts.reduce((acc, r) => { acc[r.provider] = (acc[r.provider] || 0) + 1; return acc; }, {} as Record<string, number>);
            const top = Object.entries(providerCounts).sort((a, b) => b[1] - a[1])[0];
            return top ? `${top[1]} actions recorded` : 'No data yet';
          })()}
          trend="neutral"
          icon={<Zap className="h-5 w-5" />}
        />
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={viewMode === 'operator' ? "Search activity..." : "Receipt ID, Correlation ID, Actor..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-card border-border"
          />
        </div>
        <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
          <Filter className="h-4 w-4 mr-2" />
          Filters
          {(outcomeFilter !== 'all' || providerFilter !== 'all') && (
            <span className="ml-2 px-1.5 py-0.5 rounded bg-primary text-primary-foreground text-xs">
              Active
            </span>
          )}
        </Button>
      </div>

      {/* Collapsible Filters */}
      <Collapsible open={showFilters} onOpenChange={setShowFilters}>
        <CollapsibleContent>
          <Panel className="mt-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">Outcome</Label>
                <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
                  <SelectTrigger className="bg-muted border-border">
                    <SelectValue placeholder="All outcomes" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="all">All Outcomes</SelectItem>
                    <SelectItem value="Success">{viewMode === 'operator' ? 'Completed' : 'Success'}</SelectItem>
                    <SelectItem value="Failed">Failed</SelectItem>
                    <SelectItem value="Blocked">Blocked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">Provider</Label>
                <Select value={providerFilter} onValueChange={setProviderFilter}>
                  <SelectTrigger className="bg-muted border-border">
                    <SelectValue placeholder="All providers" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="all">All Providers</SelectItem>
                    {providers.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button variant="outline" className="w-full" onClick={() => { setSearchTerm(''); setOutcomeFilter('all'); setProviderFilter('all'); }}>
                  Reset Filters
                </Button>
              </div>
            </div>
          </Panel>
        </CollapsibleContent>
      </Collapsible>

      {/* Activity Table */}
      <Panel title={viewMode === 'operator' ? "Recent Activity" : "Activity Log"} noPadding>
        <DataTable
          columns={viewMode === 'operator' ? operatorColumns : engineerColumns}
          data={filteredReceipts}
          keyExtractor={(r: Receipt) => r.id}
          onRowClick={(r) => setSelectedReceipt(r)}
          emptyMessage="No results found for the current filters."
        />
      </Panel>

      {/* Receipt Detail Dialog */}
      <Dialog open={!!selectedReceipt} onOpenChange={() => setSelectedReceipt(null)}>
        <DialogContent className="bg-card border-border max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {viewMode === 'operator' ? 'Activity Details' : `Receipt Details: ${selectedReceipt?.id}`}
            </DialogTitle>
          </DialogHeader>
          {selectedReceipt && (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">When</Label>
                  <p className="text-sm">{formatDate(selectedReceipt.timestamp)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Who</Label>
                  <p className="text-sm">{selectedReceipt.actor}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">What happened</Label>
                  <p className="text-sm" title={viewMode === 'engineer' ? selectedReceipt.actionType : undefined}>
                    {derivePremiumActionLabel(selectedReceipt.actionType, viewMode as 'operator' | 'engineer')}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Result</Label>
                  <div className="mt-1">
                    <StatusChip 
                      status={selectedReceipt.outcome === 'Success' ? 'success' : selectedReceipt.outcome === 'Blocked' ? 'warning' : 'critical'} 
                      label={selectedReceipt.outcome}
                    />
                  </div>
                </div>
              </div>

              {viewMode === 'engineer' && (
                <>
                  <div className="pt-4 border-t border-border">
                    <Label className="text-muted-foreground text-xs mb-2 block">Correlation IDs</Label>
                    <div className="flex flex-wrap gap-2">
                      <code className="px-2 py-1 rounded bg-muted text-xs">{selectedReceipt.runId}</code>
                      <CopyableId fullId={selectedReceipt.correlationId} displayId={formatCorrelationId(selectedReceipt.correlationId)} isCopied={copiedId === selectedReceipt.correlationId} onCopy={copyToClipboard} linkTo={`/trace/${selectedReceipt.correlationId}`} />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <Label className="text-muted-foreground text-xs mb-2 block">Provider Request (Redacted)</Label>
                    <pre className="p-3 rounded bg-muted border border-border text-xs overflow-x-auto">
                      {selectedReceipt.redactedRequest}
                    </pre>
                  </div>

                  <div>
                    <Label className="text-muted-foreground text-xs mb-2 block">Provider Response (Redacted)</Label>
                    <pre className="p-3 rounded bg-muted border border-border text-xs overflow-x-auto">
                      {selectedReceipt.redactedResponse}
                    </pre>
                  </div>
                </>
              )}

              {/* Linked Items */}
              {(selectedReceipt.linkedIncidentId || selectedReceipt.linkedApprovalId || selectedReceipt.linkedCustomerId) && (
                <div className="pt-4 border-t border-border">
                  <Label className="text-muted-foreground text-xs mb-2 block">Related Items</Label>
                  <div className="space-y-2">
                    {selectedReceipt.linkedIncidentId && (
                      <div className="flex items-center gap-2 p-2 rounded bg-muted border border-border">
                        <LinkIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs">Incident:</span>
                        <span className="text-xs font-mono text-primary">{selectedReceipt.linkedIncidentId}</span>
                      </div>
                    )}
                    {selectedReceipt.linkedApprovalId && (
                      <div className="flex items-center gap-2 p-2 rounded bg-muted border border-border">
                        <LinkIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs">Approval:</span>
                        <span className="text-xs font-mono text-primary">{selectedReceipt.linkedApprovalId}</span>
                      </div>
                    )}
                    {selectedReceipt.linkedCustomerId && (
                      <div className="flex items-center gap-2 p-2 rounded bg-muted border border-border">
                        <LinkIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs">Customer:</span>
                        <span className="text-xs font-mono text-primary">{selectedReceipt.linkedCustomerId}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedReceipt(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
