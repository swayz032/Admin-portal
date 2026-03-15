import { useState } from 'react';
import { PageHero } from '@/components/shared/PageHero';
import { QuickStats } from '@/components/shared/QuickStats';
import { InsightPanel } from '@/components/shared/InsightPanel';
import { Panel } from '@/components/shared/Panel';
import { DataTable } from '@/components/shared/DataTable';
import { StatusChip } from '@/components/shared/StatusChip';
import { RiskBadge } from '@/components/shared/RiskBadge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import type { Customer } from '@/data/seed';
import { useRealtimeCustomers } from '@/hooks/useRealtimeCustomers';
import { PageLoadingState } from '@/components/shared/PageLoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatCurrency, formatTimeAgo, formatDateShort } from '@/lib/formatters';
import {
  Search, Users, TrendingUp, Heart, Building2, Briefcase, Mail,
  MapPin, Target, Globe, Clock, CheckCircle, XCircle, Calendar
} from 'lucide-react';
import { useSystem } from '@/contexts/SystemContext';

function calculateAge(dob: string | undefined): string {
  if (!dob) return '--';
  try {
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age + ' years old';
  } catch {
    return '--';
  }
}

function formatEntityType(type: string | undefined): string {
  if (!type) return '--';
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function DetailField({ label, value, icon }: { label: string; value: string | undefined | null; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2">
      {icon && <div className="mt-0.5 text-muted-foreground">{icon}</div>}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground truncate">{value || '--'}</p>
      </div>
    </div>
  );
}

function TagList({ items, emptyText = 'None' }: { items: string[] | undefined; emptyText?: string }) {
  if (!items || items.length === 0) {
    return <span className="text-sm text-muted-foreground">{emptyText}</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, i) => (
        <Badge key={item + '-' + i} variant="secondary" className="text-xs">
          {item}
        </Badge>
      ))}
    </div>
  );
}


export default function Customers() {
  const { viewMode } = useSystem();
  const { data: customers, loading: customersLoading, error: customersError, refetch: refetchCustomers } = useRealtimeCustomers();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  if (customersLoading) return <PageLoadingState showKPIs rows={5} />;
  if (customersError) return <EmptyState variant="error" title="Failed to load customers" description={customersError} actionLabel="Retry" onAction={refetchCustomers} />;

  const filteredCustomers = customers.filter(c => {
    const matchesSearch = searchTerm === '' ||
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.displayId && `STE-${c.displayId}`.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.ownerName && c.ownerName.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Stats
  const activeCustomers = customers.filter(c => c.status === 'Active').length;
  const atRiskCustomers = customers.filter(c => c.status === 'At Risk').length;
  const totalMRR = customers.reduce((sum, c) => sum + c.mrr, 0);
  const totalMembers = customers.reduce((sum, c) => sum + (c.teamSize || 1), 0);

  const quickStats = [
    { label: 'active', value: activeCustomers, status: 'success' as const },
    { label: 'at risk', value: atRiskCustomers, status: atRiskCustomers > 0 ? 'warning' as const : 'success' as const },
    { label: 'total MRR', value: formatCurrency(totalMRR) },
    { label: 'team members', value: totalMembers },
  ];

  const getStatusType = (status: Customer['status']) => {
    switch (status) {
      case 'Active': return 'success';
      case 'Trial': return 'pending';
      case 'Paused': return 'neutral';
      case 'At Risk': return 'critical';
      default: return 'neutral';
    }
  };

  const getOperatorStatus = (status: Customer['status']) => {
    switch (status) {
      case 'Active': return 'Active';
      case 'Trial': return 'Trying Out';
      case 'Paused': return 'On Hold';
      case 'At Risk': return 'Needs Attention';
      default: return status;
    }
  };

  // Enterprise columns with Suite ID, Owner, Office count
  const columns = viewMode === 'operator' ? [
    {
      key: 'name',
      header: 'Company',
      render: (c: Customer) => (
        <div className="flex flex-col">
          <span className="font-medium">{c.name}</span>
          {c.ownerName && (
            <span className="text-xs text-muted-foreground">{c.ownerName}</span>
          )}
        </div>
      ),
    },
    {
      key: 'displayId',
      header: 'Suite ID',
      render: (c: Customer) => (
        <span className="font-mono text-xs text-muted-foreground">
          {c.displayId ? `STE-${c.displayId}` : '--'}
        </span>
      ),
    },
    {
      key: 'officeDisplayId',
      header: 'Office',
      render: (c: Customer) => (
        <span className="font-mono text-xs text-muted-foreground">
          {c.officeDisplayId ? `OFF-${c.officeDisplayId}` : '--'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (c: Customer) => <StatusChip status={getStatusType(c.status)} label={getOperatorStatus(c.status)} />,
    },
    { key: 'plan', header: 'Plan' },
    { key: 'mrr', header: 'Monthly Revenue', render: (c: Customer) => formatCurrency(c.mrr) },
    {
      key: 'riskFlag',
      header: 'Health',
      render: (c: Customer) => {
        if (c.riskFlag === 'None') return <span className="text-success text-sm">Good</span>;
        if (c.riskFlag === 'Low') return <span className="text-warning text-sm">Fair</span>;
        return <span className="text-destructive text-sm">Attention</span>;
      },
    },
  ] : [
    {
      key: 'name',
      header: 'Customer',
      render: (c: Customer) => (
        <div className="flex flex-col">
          <span className="font-medium">{c.name}</span>
          {c.ownerEmail && (
            <span className="text-xs text-muted-foreground font-mono">{c.ownerEmail}</span>
          )}
        </div>
      ),
    },
    {
      key: 'displayId',
      header: 'Suite',
      render: (c: Customer) => (
        <span className="font-mono text-xs">
          {c.displayId ? `STE-${c.displayId}` : c.id.slice(0, 8)}
        </span>
      ),
    },
    {
      key: 'officeDisplayId',
      header: 'Office',
      render: (c: Customer) => (
        <span className="font-mono text-xs">
          {c.officeDisplayId ? `OFF-${c.officeDisplayId}` : '--'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (c: Customer) => <StatusChip status={getStatusType(c.status)} label={c.status} />,
    },
    { key: 'plan', header: 'Plan' },
    { key: 'mrr', header: 'MRR', render: (c: Customer) => formatCurrency(c.mrr) },
    { key: 'riskFlag', header: 'Risk', render: (c: Customer) => <RiskBadge risk={c.riskFlag} /> },
    {
      key: 'industry',
      header: 'Industry',
      render: (c: Customer) => (
        <span className="text-sm text-muted-foreground">{c.industry || '--'}</span>
      ),
    },
    { key: 'lastActivity', header: 'Last Activity', render: (c: Customer) => <span className="text-muted-foreground">{formatTimeAgo(c.lastActivity)}</span> },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Hero Section */}
      <PageHero
        title={viewMode === 'operator'
          ? `${activeCustomers} active companies generating ${formatCurrency(totalMRR)}/month`
          : `${customers.length} suites tracked | ${totalMembers} offices`}
        subtitle={viewMode === 'operator'
          ? "View company accounts, team members, and health"
          : "Manage suite accounts, office seats, and monitor health"}
        icon={<Users className="h-6 w-6" />}
        status={atRiskCustomers === 0
          ? { type: 'success', label: 'All healthy' }
          : { type: 'warning', label: `${atRiskCustomers} at risk` }}
      />

      {/* Quick Stats */}
      <QuickStats stats={quickStats} />

      {/* Story Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <InsightPanel
          headline={atRiskCustomers === 0 ? "All companies healthy" : `${atRiskCustomers} need attention`}
          subtext={atRiskCustomers === 0 ? "No companies at risk" : "Review at-risk companies below"}
          trend={atRiskCustomers === 0 ? 'positive' : 'negative'}
          icon={<Heart className="h-5 w-5" />}
        />
        <InsightPanel
          headline={`${formatCurrency(totalMRR)} monthly revenue`}
          subtext={`From ${activeCustomers} active companies`}
          trend="positive"
          icon={<TrendingUp className="h-5 w-5" />}
          linkTo="/subscriptions"
          linkLabel="View revenue details"
        />
        <InsightPanel
          headline={`${totalMembers} total team members`}
          subtext={`Across ${customers.length} companies`}
          trend="neutral"
          icon={<Briefcase className="h-5 w-5" />}
        />
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={viewMode === 'operator'
              ? "Search by company name, owner, or Suite ID..."
              : "Search by name, email, suite_id, or STE-XXX..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-card border-border"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] bg-card border-border">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Active">{viewMode === 'operator' ? 'Active' : 'Active'}</SelectItem>
            <SelectItem value="Trial">{viewMode === 'operator' ? 'Trying Out' : 'Trial'}</SelectItem>
            <SelectItem value="Paused">{viewMode === 'operator' ? 'On Hold' : 'Paused'}</SelectItem>
            <SelectItem value="At Risk">{viewMode === 'operator' ? 'Needs Attention' : 'At Risk'}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Customers Table */}
      <Panel title={viewMode === 'operator' ? "All Companies" : "Suite Registry"} noPadding>
        <DataTable
          columns={columns}
          data={filteredCustomers}
          keyExtractor={(c: Customer) => c.id}
          onRowClick={(c) => setSelectedCustomer(c)}
          emptyMessage={viewMode === 'operator' ? "No companies found." : "No suites match the current filters."}
        />
      </Panel>

      {/* Customer Detail Sheet - Enterprise Grade */}
      <Sheet open={!!selectedCustomer} onOpenChange={() => setSelectedCustomer(null)}>
        <SheetContent className="bg-card border-border w-[520px] sm:max-w-[520px] overflow-y-auto">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-foreground flex items-center gap-3">
              <Building2 className="h-5 w-5 text-primary" />
              {selectedCustomer?.name}
            </SheetTitle>
            {selectedCustomer && (
              <div className="flex items-center gap-2 mt-2">
                <StatusChip
                  status={getStatusType(selectedCustomer.status)}
                  label={viewMode === 'operator' ? getOperatorStatus(selectedCustomer.status) : selectedCustomer.status}
                />
                <span className="text-sm text-muted-foreground">{selectedCustomer.plan}</span>
                <span className="font-mono text-xs text-muted-foreground ml-auto">
                  {selectedCustomer.displayId ? 'STE-' + selectedCustomer.displayId : '--'}
                </span>
              </div>
            )}
          </SheetHeader>

          {selectedCustomer && (
            <Tabs defaultValue="overview" className="mt-2">
              <TabsList className="grid w-full grid-cols-4 bg-muted/50">
                <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
                <TabsTrigger value="profile" className="text-xs">Profile</TabsTrigger>
                <TabsTrigger value="needs" className="text-xs">Needs</TabsTrigger>
                <TabsTrigger value="source" className="text-xs">Source</TabsTrigger>
              </TabsList>

              {/* Tab 1: Overview */}
              <TabsContent value="overview" className="space-y-4 mt-4">
                <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 border border-border">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono text-sm font-semibold">
                      {selectedCustomer.displayId ? 'STE-' + selectedCustomer.displayId : '--'}
                    </span>
                  </div>
                  <span className="text-muted-foreground">|</span>
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono text-sm font-semibold">
                      {selectedCustomer.officeDisplayId ? 'OFF-' + selectedCustomer.officeDisplayId : '--'}
                    </span>
                  </div>
                </div>

                {/* Owner Info */}
                <div className="p-3 rounded-lg bg-muted/50 border border-border">
                  <p className="text-xs text-muted-foreground mb-1">
                    {viewMode === 'operator' ? 'Owner' : 'Suite Owner'}
                  </p>
                  <p className="font-medium">{selectedCustomer.ownerName || 'Unknown'}</p>
                  {selectedCustomer.ownerEmail && (
                    <div className="flex items-center gap-1 mt-1">
                      <Mail className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{selectedCustomer.ownerEmail}</span>
                    </div>
                  )}
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-muted/50 border border-border">
                    <p className="text-xs text-muted-foreground">{viewMode === 'operator' ? 'Monthly Revenue' : 'MRR'}</p>
                    <p className="text-lg font-semibold text-primary">{formatCurrency(selectedCustomer.mrr)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 border border-border">
                    <p className="text-xs text-muted-foreground">{viewMode === 'operator' ? 'Health' : 'Risk Flag'}</p>
                    <div className="mt-1">
                      {viewMode === 'operator' ? (
                        selectedCustomer.riskFlag === 'None'
                          ? <span className="text-success font-medium">Good</span>
                          : selectedCustomer.riskFlag === 'Low'
                          ? <span className="text-warning font-medium">Fair</span>
                          : <span className="text-destructive font-medium">Needs Attention</span>
                      ) : (
                        <RiskBadge risk={selectedCustomer.riskFlag} />
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 rounded-lg bg-muted/50 border border-border">
                    <p className="text-xs text-muted-foreground">Industry</p>
                    <p className="text-sm font-medium">{selectedCustomer.industry || '--'}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 border border-border">
                    <p className="text-xs text-muted-foreground">{viewMode === 'operator' ? 'Open Issues' : 'Incidents'}</p>
                    <p className={'text-lg font-semibold ' + (selectedCustomer.openIncidents > 0 ? 'text-warning' : '')}>
                      {selectedCustomer.openIncidents}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 border border-border">
                    <p className="text-xs text-muted-foreground">Last Active</p>
                    <p className="text-sm">{formatTimeAgo(selectedCustomer.lastActivity)}</p>
                  </div>
                </div>

                <Separator />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSelectedCustomer(null)}>Close</Button>
                  <Button size="sm" asChild>
                    <a href={'/incidents?customer=' + (selectedCustomer?.name || '')}>View Issues</a>
                  </Button>
                </div>
              </TabsContent>

              {/* Tab 2: Profile & Demographics */}
              <TabsContent value="profile" className="space-y-4 mt-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-foreground">Demographics</h4>
                  <Separator />
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <DetailField label="Entity Type" value={formatEntityType(selectedCustomer.entityType)} icon={<Building2 className="h-4 w-4" />} />
                  <DetailField label="Customer Type" value={selectedCustomer.customerType} icon={<Users className="h-4 w-4" />} />
                  <DetailField label="Gender" value={selectedCustomer.gender} />
                  <DetailField label="Age" value={calculateAge(selectedCustomer.dateOfBirth)} icon={<Calendar className="h-4 w-4" />} />
                  <DetailField label="Role" value={selectedCustomer.roleCategory} icon={<Briefcase className="h-4 w-4" />} />
                  <DetailField label="Years in Business" value={selectedCustomer.yearsInBusiness} />
                  <DetailField label="Industry Specialty" value={selectedCustomer.industrySpecialty} />
                  <DetailField label="Revenue Band" value={selectedCustomer.annualRevenueBand} />
                  <DetailField label="Income Range" value={selectedCustomer.incomeRange} />
                  <DetailField label="Sales Channel" value={selectedCustomer.salesChannel} />
                </div>

                <div className="space-y-1 pt-2">
                  <h4 className="text-sm font-semibold text-foreground">Location</h4>
                  <Separator />
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <DetailField
                    label="Home Location"
                    value={[selectedCustomer.homeCity, selectedCustomer.homeState, selectedCustomer.homeCountry].filter(Boolean).join(', ') || undefined}
                    icon={<MapPin className="h-4 w-4" />}
                  />
                  <DetailField
                    label="Business Location"
                    value={[selectedCustomer.businessCity, selectedCustomer.businessState, selectedCustomer.businessCountry].filter(Boolean).join(', ') || undefined}
                    icon={<Globe className="h-4 w-4" />}
                  />
                </div>
                {selectedCustomer.businessAddressSameAsHome && (
                  <p className="text-xs text-muted-foreground italic">Business address same as home</p>
                )}

                <div className="space-y-1 pt-2">
                  <h4 className="text-sm font-semibold text-foreground">Onboarding</h4>
                  <Separator />
                </div>
                <DetailField
                  label="Onboarding Completed"
                  value={selectedCustomer.onboardingCompletedAt ? formatDateShort(selectedCustomer.onboardingCompletedAt) : 'Not yet'}
                  icon={selectedCustomer.onboardingCompletedAt ? <CheckCircle className="h-4 w-4 text-success" /> : <Clock className="h-4 w-4 text-warning" />}
                />
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    {selectedCustomer.consentPersonalization ? <CheckCircle className="h-3.5 w-3.5 text-success" /> : <XCircle className="h-3.5 w-3.5 text-muted-foreground" />}
                    <span className="text-xs text-muted-foreground">Personalization</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {selectedCustomer.consentCommunications ? <CheckCircle className="h-3.5 w-3.5 text-success" /> : <XCircle className="h-3.5 w-3.5 text-muted-foreground" />}
                    <span className="text-xs text-muted-foreground">Communications</span>
                  </div>
                </div>
              </TabsContent>

              {/* Tab 3: Needs & Goals */}
              <TabsContent value="needs" className="space-y-4 mt-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-foreground">Services Needed</h4>
                  <Separator />
                </div>
                <TagList items={selectedCustomer.servicesNeeded} emptyText="No services selected" />

                <div className="space-y-1 pt-2">
                  <h4 className="text-sm font-semibold text-foreground">Service Priorities</h4>
                  <Separator />
                </div>
                <TagList items={selectedCustomer.servicesPriority} emptyText="No priorities set" />

                <div className="space-y-1 pt-2">
                  <h4 className="text-sm font-semibold text-foreground">Business Goals</h4>
                  <Separator />
                </div>
                <TagList items={selectedCustomer.businessGoals} emptyText="No goals defined" />

                {selectedCustomer.painPoint && (
                  <>
                    <div className="space-y-1 pt-2">
                      <h4 className="text-sm font-semibold text-foreground">Primary Pain Point</h4>
                      <Separator />
                    </div>
                    <p className="text-sm text-foreground bg-muted/50 p-3 rounded-lg border border-border">
                      {selectedCustomer.painPoint}
                    </p>
                  </>
                )}

                <div className="space-y-1 pt-2">
                  <h4 className="text-sm font-semibold text-foreground">Current Tools</h4>
                  <Separator />
                </div>
                <TagList items={selectedCustomer.currentTools} emptyText="None listed" />

                <div className="space-y-1 pt-2">
                  <h4 className="text-sm font-semibold text-foreground">Tools Planning to Adopt</h4>
                  <Separator />
                </div>
                <TagList items={selectedCustomer.toolsPlanning} emptyText="None listed" />
              </TabsContent>

              {/* Tab 4: Source & Preferences */}
              <TabsContent value="source" className="space-y-4 mt-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-foreground">Acquisition</h4>
                  <Separator />
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <DetailField label="Referral Source" value={selectedCustomer.referralSource} icon={<Target className="h-4 w-4" />} />
                  <DetailField label="Created" value={selectedCustomer.createdAt ? formatDateShort(selectedCustomer.createdAt) : undefined} icon={<Calendar className="h-4 w-4" />} />
                </div>

                <div className="space-y-1 pt-2">
                  <h4 className="text-sm font-semibold text-foreground">Preferences</h4>
                  <Separator />
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <DetailField label="Preferred Channel" value={selectedCustomer.preferredChannel} icon={<Mail className="h-4 w-4" />} />
                  <DetailField label="Timezone" value={selectedCustomer.timezone} icon={<Clock className="h-4 w-4" />} />
                  <DetailField label="Currency" value={selectedCustomer.currency} icon={<Globe className="h-4 w-4" />} />
                  <DetailField label="Team Size" value={selectedCustomer.teamSize ? String(selectedCustomer.teamSize) : undefined} icon={<Users className="h-4 w-4" />} />
                </div>
              </TabsContent>
            </Tabs>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
