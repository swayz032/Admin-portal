import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useSystem } from '@/contexts/SystemContext';
import { 
  RegistryItem, 
  RegistryItemStatus, 
  RegistryItemType, 
  RiskTier 
} from '@/contracts/control-plane';
import { listRegistryItems } from '@/services/controlPlaneClient';
import { Panel } from '@/components/shared/Panel';
import { DataTable } from '@/components/shared/DataTable';
import { StatusChip } from '@/components/shared/StatusChip';
import { PurposeStrip } from '@/components/shared/PurposeStrip';
import { QuickStats } from '@/components/shared/QuickStats';
import { ModeText } from '@/components/shared/ModeText';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { formatTimeAgo } from '@/lib/formatters';
import {
  Plus,
  Search,
  Bot,
  Package,
  Shield,
  Wrench,
  Clock,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';

export default function Registry() {
  const { viewMode } = useSystem();
  const navigate = useNavigate();
  
  const [items, setItems] = useState<RegistryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<RegistryItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    setLoading(true);
    const data = await listRegistryItems();
    setItems(data);
    setLoading(false);
  };

  const filteredItems = items.filter(item => {
    if (typeFilter !== 'all' && item.type !== typeFilter) return false;
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    if (riskFilter !== 'all' && item.risk_tier !== riskFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        item.name.toLowerCase().includes(term) ||
        item.description.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const stats = [
    { 
      label: 'Total', 
      value: items.length, 
      icon: Package 
    },
    { 
      label: 'Active', 
      value: items.filter(i => i.status === 'active').length, 
      icon: Check,
      variant: 'success' as const
    },
    { 
      label: 'Draft', 
      value: items.filter(i => i.status === 'draft').length, 
      icon: Clock 
    },
    { 
      label: 'High Risk', 
      value: items.filter(i => i.risk_tier === 'high').length, 
      icon: Shield,
      variant: 'warning' as const
    },
  ];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStatusVariant = (status: RegistryItemStatus): 'success' | 'warning' | 'pending' | 'neutral' => {
    switch (status) {
      case 'active': return 'success';
      case 'pending_review': return 'pending';
      case 'draft': return 'neutral';
      case 'deprecated': return 'warning';
      case 'disabled': return 'warning';
      default: return 'neutral';
    }
  };

  const getRiskColor = (tier: RiskTier) => {
    switch (tier) {
      case 'low': return 'text-success';
      case 'medium': return 'text-warning';
      case 'high': return 'text-destructive';
    }
  };

  const columns = viewMode === 'operator' ? [
    { 
      key: 'name', 
      header: 'Name',
      render: (item: RegistryItem) => (
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center',
            item.type === 'agent' ? 'bg-primary/20 text-primary' : 'bg-accent text-accent-foreground'
          )}>
            {item.type === 'agent' ? <Bot className="h-4 w-4" /> : <Package className="h-4 w-4" />}
          </div>
          <div>
            <div className="font-medium">{item.name}</div>
            <div className="text-xs text-muted-foreground truncate max-w-[200px]">
              {item.description}
            </div>
          </div>
        </div>
      )
    },
    { 
      key: 'status', 
      header: 'Status',
      render: (item: RegistryItem) => (
        <StatusChip 
          status={getStatusVariant(item.status)} 
          label={item.status === 'pending_review' ? 'In Review' : item.status} 
        />
      )
    },
    { 
      key: 'risk_tier', 
      header: 'Safety',
      render: (item: RegistryItem) => (
        <span className={cn('font-medium capitalize', getRiskColor(item.risk_tier))}>
          {item.risk_tier}
        </span>
      )
    },
    { 
      key: 'updated_at', 
      header: 'Updated',
      render: (item: RegistryItem) => (
        <span className="text-muted-foreground">{formatTimeAgo(item.updated_at)}</span>
      )
    },
  ] : [
    { 
      key: 'id', 
      header: 'ID',
      render: (item: RegistryItem) => (
        <code className="text-xs text-muted-foreground">{item.id}</code>
      )
    },
    { 
      key: 'name', 
      header: 'Name',
      render: (item: RegistryItem) => (
        <div className="flex items-center gap-2">
          {item.type === 'agent' ? <Bot className="h-4 w-4" /> : <Package className="h-4 w-4" />}
          <span>{item.name}</span>
        </div>
      )
    },
    { key: 'type', header: 'Type' },
    { 
      key: 'status', 
      header: 'Status',
      render: (item: RegistryItem) => (
        <StatusChip status={getStatusVariant(item.status)} label={item.status} />
      )
    },
    { key: 'version', header: 'Version' },
    { 
      key: 'risk_tier', 
      header: 'Risk',
      render: (item: RegistryItem) => (
        <span className={cn('uppercase text-xs font-medium', getRiskColor(item.risk_tier))}>
          {item.risk_tier}
        </span>
      )
    },
    { 
      key: 'updated_at', 
      header: 'Updated',
      render: (item: RegistryItem) => (
        <span className="text-xs text-muted-foreground">
          {new Date(item.updated_at).toLocaleDateString()}
        </span>
      )
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="page-header">
          <h1 className="page-title">
            <ModeText operator="Your Agents" engineer="Registry Items" />
          </h1>
          <p className="page-subtitle">
            <ModeText 
              operator="Manage your automated team members" 
              engineer="View and manage registry items with governance controls"
            />
          </p>
        </div>
        <Button onClick={() => navigate('/control-plane/builder')} className="gap-2">
          <Plus className="h-4 w-4" />
          <ModeText operator="Create Agent" engineer="New Registry Item" />
        </Button>
      </div>

      <PurposeStrip
        operatorPurpose="This is where you see all your agents and skill packs. Click any to view details or edit."
        engineerPurpose="Registry of all RegistryItem objects. Shows status, governance, and capability metadata."
        operatorAction="Create new agents or review existing ones"
        engineerObjects={['RegistryItem', 'GovernanceConfig']}
        variant="compact"
      />

      <QuickStats stats={stats} />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={viewMode === 'operator' ? 'Search agents...' : 'Search registry...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="agent">Agent</SelectItem>
            <SelectItem value="skill_pack">Skill Pack</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="pending_review">In Review</SelectItem>
            <SelectItem value="deprecated">Deprecated</SelectItem>
          </SelectContent>
        </Select>
        <Select value={riskFilter} onValueChange={setRiskFilter}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Risk" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Risk</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Panel>
        {loading ? (
          <div className="loading-state">Loading registry...</div>
        ) : filteredItems.length === 0 ? (
          <div className="empty-state">
            <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-2">
              <ModeText operator="No agents yet" engineer="No registry items found" />
            </h3>
            <p className="text-muted-foreground text-sm mb-4">
              <ModeText 
                operator="Create your first agent to start automating tasks" 
                engineer="Create a registry item or adjust filters"
              />
            </p>
            <Button onClick={() => navigate('/control-plane/builder')} className="gap-2">
              <Plus className="h-4 w-4" />
              <ModeText operator="Create Agent" engineer="New Registry Item" />
            </Button>
          </div>
        ) : (
          <DataTable
            data={filteredItems}
            columns={columns}
            keyExtractor={(item) => item.id}
            onRowClick={(item) => setSelectedItem(item)}
          />
        )}
      </Panel>

      {/* Detail Drawer */}
      <Sheet open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedItem && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center',
                    selectedItem.type === 'agent' ? 'bg-primary/20 text-primary' : 'bg-accent text-accent-foreground'
                  )}>
                    {selectedItem.type === 'agent' ? <Bot className="h-5 w-5" /> : <Package className="h-5 w-5" />}
                  </div>
                  <div>
                    <SheetTitle>{selectedItem.name}</SheetTitle>
                    <p className="text-sm text-muted-foreground">{selectedItem.description}</p>
                  </div>
                </div>
              </SheetHeader>

              <Tabs defaultValue="overview" className="mt-6">
                <TabsList className="w-full grid grid-cols-4">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="capabilities">
                    <ModeText operator="Tools" engineer="Caps" />
                  </TabsTrigger>
                  <TabsTrigger value="governance">
                    <ModeText operator="Safety" engineer="Gov" />
                  </TabsTrigger>
                  <TabsTrigger value="versions">Versions</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Status</div>
                      <StatusChip status={getStatusVariant(selectedItem.status)} label={selectedItem.status} />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Version</div>
                      <div className="font-medium">{selectedItem.version}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">
                        <ModeText operator="Safety Level" engineer="Risk Tier" />
                      </div>
                      <div className={cn('font-medium capitalize', getRiskColor(selectedItem.risk_tier))}>
                        {selectedItem.risk_tier}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Owner</div>
                      <div className="font-medium">{selectedItem.owner}</div>
                    </div>
                  </div>

                  {viewMode === 'engineer' && (
                    <div className="pt-4 border-t border-border space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Registry ID</span>
                        <button
                          onClick={() => copyToClipboard(selectedItem.id)}
                          className="text-xs bg-surface-2 px-2 py-1 rounded font-mono flex items-center gap-1"
                        >
                          {selectedItem.id}
                          {copiedId === selectedItem.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Type</span>
                        <code className="text-xs">{selectedItem.type}</code>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Internal</span>
                        <code className="text-xs">{String(selectedItem.internal)}</code>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="capabilities" className="mt-4 space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2">
                      <ModeText operator="What it can do" engineer="Enabled Capabilities" />
                    </h4>
                    <div className="space-y-2">
                      {selectedItem.capabilities.filter(c => c.enabled).map(cap => (
                        <div key={cap.id} className="flex items-center gap-2 p-2 rounded-lg bg-surface-2">
                          <Wrench className="h-4 w-4 text-primary" />
                          <span className="text-sm">{cap.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-2">
                      <ModeText operator="Allowed Tools" engineer="Tool Allowlist" />
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedItem.tool_allowlist.map(tool => (
                        <Badge key={tool} variant="outline" className="text-xs">
                          {tool}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="governance" className="mt-4 space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        <ModeText operator="Needs Approval" engineer="Approval Required" />
                      </span>
                      <Badge variant={selectedItem.approval_required ? 'default' : 'secondary'}>
                        {selectedItem.approval_required ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        <ModeText operator="Presence Required" engineer="Required Presence" />
                      </span>
                      <span className="text-sm capitalize">{selectedItem.governance.required_presence}</span>
                    </div>
                  </div>
                  {selectedItem.governance.constraints.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">
                        <ModeText operator="Rules" engineer="Constraints" />
                      </h4>
                      <ul className="space-y-1.5">
                        {selectedItem.governance.constraints.map((c, i) => (
                          <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                            <Shield className="h-4 w-4 mt-0.5 text-warning" />
                            {c}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="versions" className="mt-4 space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-surface-2">
                      <div>
                        <div className="font-medium">v{selectedItem.version}</div>
                        <div className="text-xs text-muted-foreground">Current version</div>
                      </div>
                      <Badge>Active</Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Version history coming soon...
                  </p>
                </TabsContent>
              </Tabs>

              <div className="mt-6 pt-4 border-t border-border flex gap-3">
                <Button variant="outline" className="flex-1" asChild>
                  <Link to={`/control-plane/builder?edit=${selectedItem.id}`}>
                    <ModeText operator="Edit Agent" engineer="Edit" />
                  </Link>
                </Button>
                <Button variant="outline" className="flex-1">
                  <ModeText operator="Deploy" engineer="Create Rollout" />
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
