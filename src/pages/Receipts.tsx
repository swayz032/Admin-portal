import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSystem } from '@/contexts/SystemContext';
import { Panel } from '@/components/shared/Panel';
import { DataTable } from '@/components/shared/DataTable';
import { StatusChip } from '@/components/shared/StatusChip';
import { PurposeStrip } from '@/components/shared/PurposeStrip';
import { SystemPipelineCard } from '@/components/shared/SystemPipelineCard';
import { GlossaryTooltip } from '@/components/shared/GlossaryTooltip';
import { ModeText } from '@/components/shared/ModeText';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Receipt, ReceiptStatus } from '@/contracts';
import { listReceipts } from '@/services/apiClient';
import { formatTimeAgo } from '@/lib/formatters';
import { 
  FileText, 
  Search, 
  Filter, 
  ChevronRight, 
  ExternalLink,
  Copy,
  Check
} from 'lucide-react';

export default function Receipts() {
  const { viewMode } = useSystem();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [domainFilter, setDomainFilter] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadReceipts();
  }, []);

  const loadReceipts = async () => {
    setLoading(true);
    const data = await listReceipts();
    setReceipts(data);
    setLoading(false);
  };

  const filteredReceipts = receipts.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (providerFilter !== 'all' && r.provider !== providerFilter) return false;
    if (domainFilter !== 'all' && r.domain !== domainFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        r.id.toLowerCase().includes(term) ||
        r.correlation_id.toLowerCase().includes(term) ||
        r.action_type.toLowerCase().includes(term) ||
        r.domain.toLowerCase().includes(term)
      );
    }
    return true;
  });

  // Get unique domains from data for dynamic filtering
  const domains = [...new Set(receipts.map(r => r.domain))].sort();
  
  // Known domains for special styling
  const KNOWN_DOMAINS = ['payments', 'security', 'billing', 'integrations', 'webhooks', 'deploy', 'slo', 'alert', 'backup', 'restore', 'dr', 'entitlement', 'rbac'];
  
  // Domain counts for facets
  const domainCounts = domains.reduce((acc, domain) => {
    acc[domain] = receipts.filter(r => r.domain === domain).length;
    return acc;
  }, {} as Record<string, number>);

  // Group by correlation_id
  const groupedReceipts = filteredReceipts.reduce((acc, receipt) => {
    const key = receipt.correlation_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(receipt);
    return acc;
  }, {} as Record<string, Receipt[]>);

  const providers = [...new Set(receipts.map(r => r.provider).filter(Boolean))];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStatusColor = (status: ReceiptStatus): 'success' | 'warning' | 'critical' | 'info' => {
    switch (status) {
      case 'success': return 'success';
      case 'blocked': return 'warning';
      case 'failed': return 'critical';
      default: return 'info';
    }
  };

  const getDomainBadge = (domain: string) => {
    const isKnown = KNOWN_DOMAINS.includes(domain);
    const colors: Record<string, string> = {
      payments: 'bg-success/20 text-success',
      security: 'bg-destructive/20 text-destructive',
      deploy: 'bg-primary/20 text-primary',
      slo: 'bg-warning/20 text-warning',
      alert: 'bg-destructive/20 text-destructive',
      backup: 'bg-accent text-accent-foreground',
      restore: 'bg-accent text-accent-foreground',
      dr: 'bg-warning/20 text-warning',
      entitlement: 'bg-primary/20 text-primary',
      rbac: 'bg-primary/20 text-primary',
    };
    return {
      className: isKnown ? (colors[domain] || 'bg-muted text-muted-foreground') : 'bg-muted text-muted-foreground font-mono',
      label: isKnown ? domain : `custom: ${domain}`,
    };
  };

  const columns = viewMode === 'operator' ? [
    { 
      key: 'created_at', 
      header: 'When', 
      render: (r: Receipt) => <span className="text-muted-foreground">{formatTimeAgo(r.created_at)}</span> 
    },
    { 
      key: 'domain', 
      header: 'Type',
      render: (r: Receipt) => {
        const badge = getDomainBadge(r.domain);
        return (
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
            {badge.label}
          </span>
        );
      }
    },
    { key: 'action_type', header: 'What happened' },
    { key: 'provider', header: 'Service', render: (r: Receipt) => r.provider || 'Internal' },
    { 
      key: 'status', 
      header: 'Result', 
      render: (r: Receipt) => (
        <StatusChip 
          status={getStatusColor(r.status)} 
          label={r.status === 'success' ? 'Completed' : r.status === 'blocked' ? 'Stopped' : 'Failed'} 
        />
      ) 
    },
  ] : [
    { 
      key: 'id', 
      header: 'Receipt ID', 
      render: (r: Receipt) => (
        <span className="font-mono text-xs text-muted-foreground">{r.id}</span>
      )
    },
    { 
      key: 'created_at', 
      header: 'Timestamp', 
      render: (r: Receipt) => <span className="text-muted-foreground text-xs">{new Date(r.created_at).toLocaleString()}</span> 
    },
    { key: 'domain', header: 'Domain' },
    { key: 'action_type', header: 'Action Type' },
    { 
      key: 'status', 
      header: 'Status', 
      render: (r: Receipt) => (
        <StatusChip status={getStatusColor(r.status)} label={r.status} />
      ) 
    },
    { 
      key: 'correlation_id', 
      header: 'Correlation ID',
      render: (r: Receipt) => (
        <button 
          onClick={(e) => { e.stopPropagation(); copyToClipboard(r.correlation_id); }}
          className="font-mono text-xs text-primary hover:underline flex items-center gap-1"
        >
          {r.correlation_id.slice(0, 12)}...
          {copiedId === r.correlation_id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </button>
      )
    },
  ];

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">
          <ModeText operator="Proof Log" engineer="Receipts" />
        </h1>
        <p className="page-subtitle">
          <ModeText 
            operator="A record of everything that happened in your system" 
            engineer="Canonical Receipt objects with full audit trail" 
          />
        </p>
      </div>

      <PurposeStrip
        operatorPurpose="This page shows proof of every action taken. Use it to verify what happened and when."
        engineerPurpose="Immutable audit log entries. Each Receipt captures action execution with correlation linking."
        operatorAction="Search for specific actions or trace issues back to their source"
        engineerObjects={['Receipt', 'ProviderCallLog']}
        variant="compact"
      />

      <SystemPipelineCard variant="compact" highlightStep={6} />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={viewMode === 'operator' ? 'Search actions...' : 'Search by ID, correlation, action...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="blocked">Blocked</SelectItem>
          </SelectContent>
        </Select>
        <Select value={providerFilter} onValueChange={setProviderFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Provider" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Providers</SelectItem>
            {providers.map(p => (
              <SelectItem key={p} value={p!}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={domainFilter} onValueChange={setDomainFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {domains.map(d => (
              <SelectItem key={d} value={d}>
                {d} ({domainCounts[d]})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Receipts Table */}
      <Panel>
        {loading ? (
          <div className="loading-state">Loading receipts...</div>
        ) : filteredReceipts.length === 0 ? (
          <div className="empty-state">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-2">
              <ModeText operator="No proof records found" engineer="No receipts match filters" />
            </h3>
            <p className="text-muted-foreground text-sm">
              <ModeText 
                operator="Try adjusting your search or filters" 
                engineer="Adjust filters or clear search term" 
              />
            </p>
          </div>
        ) : (
          <DataTable
            data={filteredReceipts}
            columns={columns}
            keyExtractor={(r) => r.id}
            onRowClick={(receipt) => setSelectedReceipt(receipt)}
          />
        )}
      </Panel>

      {/* Receipt Detail Drawer */}
      <Sheet open={!!selectedReceipt} onOpenChange={() => setSelectedReceipt(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedReceipt && (
            <>
              <SheetHeader>
                <SheetTitle>
                  <ModeText operator="Proof Details" engineer="Receipt Details" />
                </SheetTitle>
              </SheetHeader>
              
              <div className="mt-6 space-y-6">
                {/* Status */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <StatusChip 
                    status={getStatusColor(selectedReceipt.status)} 
                    label={selectedReceipt.status} 
                  />
                </div>

                {/* Key Info */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      <ModeText operator="When" engineer="Timestamp" />
                    </span>
                    <span className="text-sm">{new Date(selectedReceipt.created_at).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      <ModeText operator="Action" engineer="Action Type" />
                    </span>
                    <span className="text-sm">{selectedReceipt.action_type}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      <ModeText operator="Service" engineer="Provider" />
                    </span>
                    <span className="text-sm">{selectedReceipt.provider || 'Internal'}</span>
                  </div>
                </div>

                {viewMode === 'engineer' && (
                  <>
                    <div className="border-t border-border pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Receipt ID</span>
                        <code className="text-xs bg-surface-2 px-2 py-1 rounded">{selectedReceipt.id}</code>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Suite ID</span>
                        <code className="text-xs bg-surface-2 px-2 py-1 rounded">{selectedReceipt.suite_id}</code>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Office ID</span>
                        <code className="text-xs bg-surface-2 px-2 py-1 rounded">{selectedReceipt.office_id}</code>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Correlation ID</span>
                        <button
                          onClick={() => copyToClipboard(selectedReceipt.correlation_id)}
                          className="text-xs bg-surface-2 px-2 py-1 rounded font-mono text-primary hover:bg-surface-3 flex items-center gap-1"
                        >
                          {selectedReceipt.correlation_id}
                          {copiedId === selectedReceipt.correlation_id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </button>
                      </div>
                      {selectedReceipt.request_id && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Request ID</span>
                          <code className="text-xs bg-surface-2 px-2 py-1 rounded">{selectedReceipt.request_id}</code>
                        </div>
                      )}
                    </div>

                    {/* Payload JSON */}
                    <div className="border-t border-border pt-4">
                      <h4 className="text-sm font-medium mb-2">Payload</h4>
                      <pre className="text-xs bg-surface-2 p-3 rounded-lg overflow-x-auto max-h-48">
                        {JSON.stringify(selectedReceipt.payload, null, 2)}
                      </pre>
                    </div>
                  </>
                )}

                {viewMode === 'operator' && (
                  <div className="border-t border-border pt-4">
                    <h4 className="text-sm font-medium mb-2">What this means</h4>
                    <p className="text-sm text-muted-foreground">
                      {selectedReceipt.status === 'success' 
                        ? 'This action completed successfully and is recorded as proof.'
                        : selectedReceipt.status === 'blocked'
                        ? 'This action was stopped by a safety rule before it could complete.'
                        : 'This action failed. Check the linked incident for more details.'}
                    </p>
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
