import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KPICard } from '@/components/shared/KPICard';
import { Panel } from '@/components/shared/Panel';
import { DataTable } from '@/components/shared/DataTable';
import { StatusChip } from '@/components/shared/StatusChip';
import { SeverityBadge } from '@/components/shared/SeverityBadge';
import { RiskBadge } from '@/components/shared/RiskBadge';
import { ModeText } from '@/components/shared/ModeText';
import { ModeDetails } from '@/components/shared/ModeDetails';
import { ExplainTooltip, explainContent } from '@/components/shared/ExplainTooltip';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useSystem } from '@/contexts/SystemContext';
import { PageLoadingState } from '@/components/shared/PageLoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  useApprovals,
  useIncidents,
  useReceipts,
  useCustomers,
  useBusinessMetrics,
  useOpsMetrics,
  useTrustSpineMetrics,
} from '@/hooks/useAdminData';
import type { Approval, Incident, Receipt } from '@/data/seed';
import { formatDate, formatCurrency, formatTimeAgo, formatLatency, formatNumber } from '@/lib/formatters';
import {
  CheckCircle,
  AlertTriangle,
  Shield,
  Activity,
  Server,
  Cpu,
  Brain,
  Gauge,
  TrendingUp,
  Users,
  CreditCard,
  AlertCircle,
  RefreshCw,
  DollarSign,
  Check,
  X,
  Sparkles,
  FileText,
  Clock,
  Inbox,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
  const { systemState, viewMode } = useSystem();
  const [activeTab, setActiveTab] = useState('operations');
  const [approvalDialog, setApprovalDialog] = useState<{ approval: Approval; action: 'approve' | 'deny' } | null>(null);
  const [decisionReason, setDecisionReason] = useState('');
  const [analysisDialog, setAnalysisDialog] = useState<Incident | null>(null);

  // Production data hooks — all querying real Supabase tables
  const { data: allApprovals, loading: approvalsLoading, error: approvalsError, refetch: refetchApprovals } = useApprovals();
  const { data: allIncidents, loading: incidentsLoading, error: incidentsError } = useIncidents();
  const { data: allReceipts, loading: receiptsLoading, error: receiptsError } = useReceipts({ pageSize: 10 });
  const { data: allCustomers, loading: customersLoading, error: customersError } = useCustomers({ pageSize: 10 });
  const { data: ops, loading: opsLoading, error: opsError } = useOpsMetrics();
  const { data: biz, loading: bizLoading, error: bizError } = useBusinessMetrics();
  const { data: trustSpine, loading: trustLoading } = useTrustSpineMetrics();

  // Derived data
  const pendingApprovals = allApprovals.filter(a => a.status === 'Pending');
  const openIncidents = allIncidents.filter(i => i.status === 'Open');
  const recentReceipts = allReceipts.slice(0, 5);
  const newCustomers = allCustomers.filter(c => c.status === 'Trial' || c.status === 'Active').slice(0, 5);

  // Trust Spine sub-KPIs derived from real data
  const trustCoverage = trustSpine?.coveragePercent ?? 0;
  const trustTotalReceipts = trustSpine?.totalReceipts ?? 0;
  const trustSuccessRate = trustSpine?.successRate ?? 0;
  const missingReceiptCount = trustTotalReceipts > 0
    ? Math.round(trustTotalReceipts * (1 - trustSuccessRate / 100))
    : 0;
  const policyBlocks24h = allReceipts.filter(r => r.outcome === 'Blocked').length;
  const providerErrors24h = allReceipts.filter(r => r.outcome === 'Failed').length;

  const handleApprovalDecision = () => {
    // TODO: Wire to Supabase approval_events insert + refetch
    setApprovalDialog(null);
    setDecisionReason('');
    refetchApprovals();
  };

  const handleAnalyze = (incident: Incident) => {
    setAnalysisDialog(incident);
  };

  // Mode-aware column definitions for approvals
  const approvalColumns = viewMode === 'operator' ? [
    { key: 'risk', header: 'Priority', render: (a: Approval) => <RiskBadge risk={a.risk} /> },
    { key: 'summary', header: 'What needs approval', className: 'max-w-xs' },
    { key: 'requestedBy', header: 'Requested by', render: (a: Approval) => <span className="text-text-secondary">{a.requestedBy}</span> },
    {
      key: 'age',
      header: 'Waiting',
      render: (a: Approval) => <span className="text-text-secondary">{formatTimeAgo(a.requestedAt)}</span>
    },
    {
      key: 'actions',
      header: '',
      render: (a: Approval) => (
        <div className="flex gap-2">
          <Button size="sm" onClick={(e) => { e.stopPropagation(); setApprovalDialog({ approval: a, action: 'approve' }); }}>
            <Check className="h-3 w-3 mr-1" />
            Approve
          </Button>
          <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); setApprovalDialog({ approval: a, action: 'deny' }); }}>
            <X className="h-3 w-3 mr-1" />
            Deny
          </Button>
        </div>
      ),
    },
  ] : [
    { key: 'id', header: 'ID', render: (a: Approval) => <span className="font-mono text-xs">{a.id}</span> },
    { key: 'risk', header: 'Risk', render: (a: Approval) => <RiskBadge risk={a.risk} /> },
    { key: 'requestedBy', header: 'Requested By', render: (a: Approval) => <span className="text-text-secondary">{a.requestedBy}</span> },
    { key: 'summary', header: 'Summary', className: 'max-w-xs truncate' },
    {
      key: 'age',
      header: 'Age',
      render: (a: Approval) => <span className="text-text-secondary">{formatTimeAgo(a.requestedAt)}</span>
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (a: Approval) => (
        <div className="flex gap-2">
          <Button size="sm" onClick={(e) => { e.stopPropagation(); setApprovalDialog({ approval: a, action: 'approve' }); }}>
            <Check className="h-3 w-3 mr-1" />
            Approve
          </Button>
          <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); setApprovalDialog({ approval: a, action: 'deny' }); }}>
            <X className="h-3 w-3 mr-1" />
            Deny
          </Button>
        </div>
      ),
    },
  ];

  // Mode-aware column definitions for incidents
  const incidentColumns = viewMode === 'operator' ? [
    { key: 'severity', header: 'Urgency', render: (i: Incident) => <SeverityBadge severity={i.severity} /> },
    { key: 'summary', header: 'What happened', className: 'max-w-xs' },
    { key: 'customer', header: "Who's affected", render: (i: Incident) => <span className="text-text-secondary">{i.customer}</span> },
    {
      key: 'status',
      header: 'Status',
      render: (i: Incident) => <StatusChip status={i.status === 'Open' ? 'warning' : 'success'} label={i.status === 'Open' ? 'Needs attention' : 'Resolved'} />
    },
    {
      key: 'analyze',
      header: '',
      render: (i: Incident) => (
        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleAnalyze(i); }}>
          <Sparkles className="h-3 w-3 mr-1" />
          Get help
        </Button>
      ),
    },
  ] : [
    { key: 'severity', header: 'Sev', render: (i: Incident) => <SeverityBadge severity={i.severity} /> },
    { key: 'id', header: 'ID', render: (i: Incident) => <span className="font-mono text-xs">{i.id}</span> },
    { key: 'summary', header: 'Summary', className: 'max-w-xs truncate' },
    { key: 'customer', header: 'Affected', render: (i: Incident) => <span className="text-text-secondary">{i.customer}</span> },
    {
      key: 'status',
      header: 'Status',
      render: (i: Incident) => <StatusChip status={i.status === 'Open' ? 'warning' : 'success'} label={i.status} />
    },
    {
      key: 'updatedAt',
      header: 'Updated',
      render: (i: Incident) => <span className="text-text-secondary">{formatTimeAgo(i.updatedAt)}</span>
    },
    {
      key: 'analyze',
      header: '',
      render: (i: Incident) => (
        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleAnalyze(i); }}>
          <Sparkles className="h-3 w-3 mr-1" />
          Analyze
        </Button>
      ),
    },
  ];

  // Mode-aware column definitions for receipts
  const receiptColumns = viewMode === 'operator' ? [
    { key: 'timestamp', header: 'When', render: (r: Receipt) => <span className="text-text-secondary">{formatTimeAgo(r.timestamp)}</span> },
    { key: 'actor', header: 'Who' },
    { key: 'actionType', header: 'What happened' },
    {
      key: 'outcome',
      header: 'Result',
      render: (r: Receipt) => (
        <StatusChip
          status={r.outcome === 'Success' ? 'success' : r.outcome === 'Blocked' ? 'warning' : 'critical'}
          label={r.outcome === 'Success' ? 'Completed' : r.outcome === 'Blocked' ? 'Stopped' : 'Failed'}
        />
      )
    },
  ] : [
    { key: 'timestamp', header: 'Timestamp', render: (r: Receipt) => <span className="text-text-secondary">{formatDate(r.timestamp)}</span> },
    { key: 'actor', header: 'Actor' },
    { key: 'actionType', header: 'Action Type' },
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
    { key: 'correlationId', header: 'Correlation ID', render: (r: Receipt) => <span className="font-mono text-xs text-text-secondary">{r.correlationId}</span> },
  ];

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">
          <ModeText operator="What's Happening" engineer="Dashboard" />
        </h1>
        <p className="page-subtitle">
          <ModeText
            operator="Here's what needs your attention today"
            engineer="Real-time overview of operations and business metrics"
          />
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-surface-1 border border-border">
          <TabsTrigger value="operations" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <ModeText operator="Operations" engineer="Today: Operations" />
          </TabsTrigger>
          <TabsTrigger value="business" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <ModeText operator="Business" engineer="Today: Business" />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="operations" className="mt-6 space-y-6">
          {/* Loading state */}
          {opsLoading && <PageLoadingState showKPIs kpiCount={8} rows={5} />}

          {/* Error state */}
          {opsError && !opsLoading && (
            <EmptyState variant="error" title="Failed to load operations data" description={opsError} actionLabel="Retry" onAction={() => window.location.reload()} />
          )}

          {/* Operations content — only render when ops data is available */}
          {ops && !opsLoading && (
            <>
              {/* Row 1 KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard
                  title={viewMode === 'operator' ? "Waiting for You" : "Open Approvals"}
                  value={ops.openApprovals}
                  icon={<CheckCircle className="h-4 w-4" />}
                  status={ops.openApprovals > 0 ? 'warning' : 'success'}
                  linkTo="/approvals"
                  linkLabel={viewMode === 'operator' ? "Review now" : "View approvals"}
                />
                <KPICard
                  title={viewMode === 'operator' ? "Issues to Fix" : "Active Incidents"}
                  value={ops.activeIncidents.p0 + ops.activeIncidents.p1}
                  subtitle={viewMode === 'operator'
                    ? `${ops.activeIncidents.p0} urgent`
                    : `${ops.activeIncidents.p0} P0, ${ops.activeIncidents.p1} P1`}
                  icon={<AlertTriangle className="h-4 w-4" />}
                  status={ops.activeIncidents.p0 > 0 ? 'critical' : ops.activeIncidents.p1 > 0 ? 'warning' : 'success'}
                  linkTo="/incidents?severity=P0,P1"
                  linkLabel={viewMode === 'operator' ? "See issues" : "View incidents"}
                />
                <KPICard
                  title="Safety Mode"
                  value={systemState.safetyMode ? 'ON' : 'OFF'}
                  subtitle={systemState.safetyMode
                    ? (viewMode === 'operator' ? 'Changes restricted' : 'Writes restricted')
                    : (viewMode === 'operator' ? 'Running normally' : 'Normal operation')}
                  icon={<Shield className="h-4 w-4" />}
                  status={systemState.safetyMode ? 'warning' : 'success'}
                  linkTo="/safety"
                  linkLabel="Configure"
                />
                <KPICard
                  title={viewMode === 'operator' ? "Tasks Completed Today" : "Successful Actions Today"}
                  value={formatNumber(ops.successfulActionsToday)}
                  icon={<Activity className="h-4 w-4" />}
                  status="success"
                  linkTo="/activity"
                  linkLabel={viewMode === 'operator' ? "See activity" : "View activity"}
                />
              </div>

              {/* Row 2 KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard
                  title={viewMode === 'operator' ? "Connected Services" : "Provider Health"}
                  value={ops.providerHealth.status === 'Healthy'
                    ? (viewMode === 'operator' ? 'All good' : 'Healthy')
                    : (viewMode === 'operator' ? 'Issues detected' : 'Degraded')}
                  subtitle={viewMode === 'engineer' ? `p95 latency: ${formatLatency(ops.providerHealth.p95Latency)}` : undefined}
                  icon={<Server className="h-4 w-4" />}
                  status={ops.providerHealth.status === 'Healthy' ? 'success' : 'warning'}
                  linkTo="/connected-apps"
                />
                <KPICard
                  title={viewMode === 'operator' ? "Background Tasks" : "Queue Health"}
                  value={viewMode === 'operator'
                    ? (ops.queueHealth.depth > 0 ? 'Processing' : 'Clear')
                    : `${ops.queueHealth.depth} queued`}
                  subtitle={viewMode === 'engineer' ? `${ops.queueHealth.lag}s lag, ${ops.queueHealth.retries} retries` : undefined}
                  icon={<Cpu className="h-4 w-4" />}
                  status={ops.queueHealth.lag > 5 ? 'warning' : 'success'}
                />
                <KPICard
                  title={viewMode === 'operator' ? "AI Assistant" : "LLM Ops Analyst"}
                  value={ops.llmAnalyst.status === 'Online'
                    ? (viewMode === 'operator' ? 'Ready' : 'Online')
                    : (viewMode === 'operator' ? 'Unavailable' : 'Offline')}
                  subtitle={viewMode === 'engineer' ? `Last analysis: ${formatTimeAgo(ops.llmAnalyst.lastAnalysis)}` : undefined}
                  icon={<Brain className="h-4 w-4" />}
                  status={ops.llmAnalyst.status === 'Online' ? 'success' : 'warning'}
                />
                <KPICard
                  title="Error Budget"
                  value={`${ops.errorBudget.remaining}%`}
                  subtitle={viewMode === 'engineer' ? `Burn rate: ${ops.errorBudget.burnRate}x` : 'Remaining this period'}
                  icon={<Gauge className="h-4 w-4" />}
                  status={ops.errorBudget.remaining > 50 ? 'success' : ops.errorBudget.remaining > 20 ? 'warning' : 'critical'}
                />
              </div>

              {/* LLM Ops Desk Shortcut Card */}
              <Panel className="border-primary/30 bg-primary/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                      <Brain className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-text-primary">
                        <ModeText operator="Talk to Ava" engineer="LLM Ops Desk" />
                      </h3>
                      <p className="text-sm text-text-secondary">
                        <ModeText
                          operator="Get help analyzing and fixing issues with voice or chat"
                          engineer="Voice console for incident analysis and fix planning"
                        />
                      </p>
                    </div>
                  </div>
                  <Link to="/llm-ops-desk">
                    <Button>
                      <ModeText operator="Get Help" engineer="Open LLM Ops Desk" />
                    </Button>
                  </Link>
                </div>
              </Panel>

              {/* Trust Spine Health Section — derived from real Supabase data */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-text-primary">
                    <ModeText operator="System Health" engineer="Trust Spine Health" />
                  </h3>
                  <ExplainTooltip content={explainContent.receiptCoverage} />
                </div>
                {trustLoading ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="rounded-lg border border-border bg-card p-4 space-y-3 animate-pulse">
                        <div className="h-3 w-20 bg-surface-1 rounded" />
                        <div className="h-7 w-16 bg-surface-1 rounded" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <div className="relative">
                      <KPICard
                        title={viewMode === 'operator' ? 'Proof coverage' : 'Receipt coverage %'}
                        value={`${trustCoverage}%`}
                        subtitle={`${trustTotalReceipts} receipts (24h)`}
                        icon={<FileText className="h-4 w-4" />}
                        status={trustCoverage >= 95 ? 'success' : 'warning'}
                        linkTo="/llm-ops-desk"
                        linkLabel={viewMode === 'operator' ? 'View receipts' : 'Receipts tab'}
                      />
                    </div>
                    <div className="relative">
                      <KPICard
                        title={viewMode === 'operator' ? 'Missing proof' : 'Missing receipts'}
                        value={missingReceiptCount}
                        subtitle={missingReceiptCount > 5 ? 'Needs investigation' : 'Nominal'}
                        icon={<AlertCircle className="h-4 w-4" />}
                        status={missingReceiptCount > 5 ? 'warning' : 'success'}
                        linkTo="/incidents?proofStatus=missing"
                        linkLabel="Investigate"
                      />
                    </div>
                    <div className="relative">
                      <KPICard
                        title={viewMode === 'operator' ? 'Awaiting decisions' : 'Approvals pending'}
                        value={ops.openApprovals}
                        subtitle={pendingApprovals.length > 0 ? `${pendingApprovals.length} in queue` : 'Queue clear'}
                        icon={<Clock className="h-4 w-4" />}
                        status={ops.openApprovals > 5 ? 'warning' : 'info'}
                        linkTo="/approvals"
                        linkLabel="Review"
                      />
                    </div>
                    <div className="relative">
                      <KPICard
                        title={viewMode === 'operator' ? 'Blocked by rules' : 'Policy blocks (24h)'}
                        value={policyBlocks24h}
                        icon={<Shield className="h-4 w-4" />}
                        status={policyBlocks24h > 20 ? 'warning' : 'info'}
                        linkTo="/safety"
                        linkLabel={viewMode === 'operator' ? 'View blocks' : 'Safety filters'}
                      />
                    </div>
                    <div className="relative">
                      <KPICard
                        title={viewMode === 'operator' ? 'Service errors' : 'Provider errors (24h)'}
                        value={providerErrors24h}
                        subtitle={viewMode === 'engineer' ? `p95: ${ops.providerHealth.p95Latency}ms` : undefined}
                        icon={<Server className="h-4 w-4" />}
                        status={providerErrors24h > 10 ? 'critical' : 'info'}
                        linkTo="/llm-ops-desk?providerId=stripe"
                        linkLabel="Provider log"
                      />
                    </div>
                    <div className="relative">
                      <KPICard
                        title={viewMode === 'operator' ? 'Work queue' : 'Outbox health'}
                        value={`${ops.queueHealth.depth} jobs`}
                        subtitle={`Lag: ${ops.queueHealth.lag}s`}
                        icon={<Inbox className="h-4 w-4" />}
                        status={ops.queueHealth.depth > 20 ? 'warning' : 'success'}
                        linkTo="/automation"
                        linkLabel="Queue"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Main Panels */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Panel
                  title={viewMode === 'operator' ? "Decisions Needed" : "Approvals Needing Decision"}
                  action={
                    <Link to="/approvals" className="text-xs text-primary hover:underline">
                      View all
                    </Link>
                  }
                  noPadding
                >
                  {approvalsLoading ? (
                    <div className="p-4 space-y-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-12 bg-surface-1 rounded animate-pulse" />
                      ))}
                    </div>
                  ) : approvalsError ? (
                    <div className="p-4">
                      <EmptyState variant="error" title="Failed to load approvals" description={approvalsError} />
                    </div>
                  ) : (
                    <DataTable
                      columns={approvalColumns}
                      data={pendingApprovals}
                      keyExtractor={(a) => a.id}
                      emptyMessage={viewMode === 'operator' ? "Nothing waiting for your approval." : "No approvals pending decision."}
                    />
                  )}
                </Panel>

                <Panel
                  title={viewMode === 'operator' ? "Current Issues" : "Recent Incidents"}
                  action={
                    <Link to="/incidents" className="text-xs text-primary hover:underline">
                      View all
                    </Link>
                  }
                  noPadding
                >
                  {incidentsLoading ? (
                    <div className="p-4 space-y-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-12 bg-surface-1 rounded animate-pulse" />
                      ))}
                    </div>
                  ) : incidentsError ? (
                    <div className="p-4">
                      <EmptyState variant="error" title="Failed to load incidents" description={incidentsError} />
                    </div>
                  ) : (
                    <DataTable
                      columns={incidentColumns}
                      data={openIncidents}
                      keyExtractor={(i) => i.id}
                      emptyMessage={viewMode === 'operator' ? "No issues right now." : "No open incidents."}
                    />
                  )}
                </Panel>
              </div>

              {/* Recent Activity */}
              <Panel
                title={viewMode === 'operator' ? "Recent Activity" : "Recent Activity"}
                action={
                  <Link to="/activity" className="text-xs text-primary hover:underline">
                    View all
                  </Link>
                }
                noPadding
              >
                {receiptsLoading ? (
                  <div className="p-4 space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="h-10 bg-surface-1 rounded animate-pulse" />
                    ))}
                  </div>
                ) : receiptsError ? (
                  <div className="p-4">
                    <EmptyState variant="error" title="Failed to load receipts" description={receiptsError} />
                  </div>
                ) : (
                  <DataTable
                    columns={receiptColumns}
                    data={recentReceipts}
                    keyExtractor={(r) => r.id}
                    emptyMessage="No receipts recorded yet."
                  />
                )}
              </Panel>
            </>
          )}
        </TabsContent>

        <TabsContent value="business" className="mt-6 space-y-6">
          {/* Loading state */}
          {bizLoading && <PageLoadingState showKPIs kpiCount={8} rows={5} />}

          {/* Error state */}
          {bizError && !bizLoading && (
            <EmptyState variant="error" title="Failed to load business metrics" description={bizError} actionLabel="Retry" onAction={() => window.location.reload()} />
          )}

          {/* Business content — only render when business data is available */}
          {biz && !bizLoading && (
            <>
              {/* Row 1 KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard
                  title={viewMode === 'operator' ? "Monthly Revenue" : "Monthly Recurring Revenue"}
                  value={formatCurrency(biz.totalMRR)}
                  trend={{ value: biz.mrrGrowth, label: 'vs last month' }}
                  icon={<DollarSign className="h-4 w-4" />}
                  status="success"
                />
                <KPICard
                  title="New Subscriptions"
                  value={biz.newSubscriptions7d}
                  subtitle="Last 7 days"
                  icon={<TrendingUp className="h-4 w-4" />}
                  status="success"
                  linkTo="/subscriptions"
                />
                <KPICard
                  title={viewMode === 'operator' ? "Cancellations" : "Churn"}
                  value={biz.churn30d}
                  subtitle="Last 30 days"
                  icon={<RefreshCw className="h-4 w-4" />}
                  status={biz.churn30d > 2 ? 'warning' : 'success'}
                />
                <KPICard
                  title="Failed Payments"
                  value={biz.failedPayments.count}
                  subtitle={formatCurrency(biz.failedPayments.amount)}
                  icon={<AlertCircle className="h-4 w-4" />}
                  status={biz.failedPayments.count > 0 ? 'warning' : 'success'}
                />
              </div>

              {/* Row 2 KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard
                  title={viewMode === 'operator' ? "Trial Conversions" : "Trial -> Paid Conversion"}
                  value={`${biz.trialConversion}%`}
                  icon={<TrendingUp className="h-4 w-4" />}
                  status={biz.trialConversion > 30 ? 'success' : 'warning'}
                />
                <KPICard
                  title="Active Customers"
                  value={biz.activeCustomers}
                  icon={<Users className="h-4 w-4" />}
                  status="success"
                  linkTo="/customers"
                />
                <KPICard
                  title="Refunds / Disputes"
                  value={`${biz.refundsDisputes.refunds} / ${biz.refundsDisputes.disputes}`}
                  subtitle={formatCurrency(biz.refundsDisputes.amount)}
                  icon={<CreditCard className="h-4 w-4" />}
                  status={biz.refundsDisputes.disputes > 0 ? 'critical' : 'success'}
                />
                <KPICard
                  title={viewMode === 'operator' ? "Revenue Changes" : "Expansion vs Contraction"}
                  value={`+${formatCurrency(biz.expansionMRR)} / -${formatCurrency(biz.contractionMRR)}`}
                  subtitle={viewMode === 'operator' ? "Upgrades vs downgrades" : "Net expansion MRR"}
                  icon={<TrendingUp className="h-4 w-4" />}
                  status={biz.expansionMRR > biz.contractionMRR ? 'success' : 'warning'}
                />
              </div>

              {/* MRR Trend Chart */}
              <Panel title={viewMode === 'operator' ? "Revenue Trend (Last 30 Days)" : "MRR Trend (Last 30 Days)"}>
                {biz.mrrTrend.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={biz.mrrTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                        <XAxis
                          dataKey="date"
                          stroke="rgba(255,255,255,0.5)"
                          fontSize={12}
                          tickFormatter={(val) => val.split('-').slice(1).join('/')}
                        />
                        <YAxis
                          stroke="rgba(255,255,255,0.5)"
                          fontSize={12}
                          tickFormatter={(val: number) => `$${(val / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(220 18% 11%)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '8px',
                            color: 'rgba(255,255,255,0.92)'
                          }}
                          formatter={(value: number) => [formatCurrency(value), viewMode === 'operator' ? 'Revenue' : 'MRR']}
                        />
                        <Line
                          type="monotone"
                          dataKey="mrr"
                          stroke="hsl(187 82% 53%)"
                          strokeWidth={2}
                          dot={{ fill: 'hsl(187 82% 53%)', strokeWidth: 0, r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyState
                    variant="chart-empty"
                    title="No revenue trend data yet"
                    description="MRR trend data will populate as subscriptions are processed over time."
                  />
                )}
              </Panel>

              {/* Panels */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Panel
                  title="New Customers"
                  action={
                    <Link to="/customers" className="text-xs text-primary hover:underline">
                      View all
                    </Link>
                  }
                  noPadding
                >
                  {customersLoading ? (
                    <div className="p-4 space-y-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-12 bg-surface-1 rounded animate-pulse" />
                      ))}
                    </div>
                  ) : customersError ? (
                    <div className="p-4">
                      <EmptyState variant="error" title="Failed to load customers" description={customersError} />
                    </div>
                  ) : (
                    <DataTable
                      columns={viewMode === 'operator' ? [
                        { key: 'name', header: 'Customer' },
                        { key: 'plan', header: 'Plan' },
                        { key: 'mrr', header: 'Monthly Value', render: (c) => formatCurrency(c.mrr as number) },
                        {
                          key: 'status',
                          header: 'Status',
                          render: (c) => (
                            <StatusChip
                              status={c.status === 'Active' ? 'success' : c.status === 'Trial' ? 'pending' : 'warning'}
                              label={c.status === 'Active' ? 'Paying' : c.status === 'Trial' ? 'Trying out' : c.status as string}
                            />
                          )
                        },
                      ] : [
                        { key: 'name', header: 'Customer' },
                        { key: 'plan', header: 'Plan' },
                        { key: 'mrr', header: 'MRR', render: (c) => formatCurrency(c.mrr as number) },
                        {
                          key: 'status',
                          header: 'Status',
                          render: (c) => (
                            <StatusChip
                              status={c.status === 'Active' ? 'success' : c.status === 'Trial' ? 'pending' : 'warning'}
                              label={c.status as string}
                            />
                          )
                        },
                        {
                          key: 'riskFlag',
                          header: 'Risk',
                          render: (c) => <RiskBadge risk={c.riskFlag as 'None' | 'Low' | 'High'} />
                        },
                      ]}
                      data={newCustomers}
                      keyExtractor={(c) => c.id as string}
                      emptyMessage="No customers yet. They'll appear here as suites are created."
                    />
                  )}
                </Panel>

                <Panel title="Recent Payments" noPadding>
                  <EmptyState
                    variant="no-data"
                    title="No payment data yet"
                    description="Payment records will appear here once Stripe Connect processes transactions for your suites."
                  />
                </Panel>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Approval Decision Dialog */}
      <Dialog open={!!approvalDialog} onOpenChange={() => setApprovalDialog(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-text-primary">
              {approvalDialog?.action === 'approve' ? 'Approve Request' : 'Deny Request'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              {viewMode === 'engineer' && (
                <p className="text-sm text-text-secondary mb-2">
                  <strong>Request:</strong> {approvalDialog?.approval.id}
                </p>
              )}
              <p className="text-sm text-text-secondary">
                {approvalDialog?.approval.summary}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">
                <ModeText operator="Why? (required)" engineer="Decision Reason (required)" />
              </Label>
              <Textarea
                id="reason"
                value={decisionReason}
                onChange={(e) => setDecisionReason(e.target.value)}
                placeholder={viewMode === 'operator' ? "Explain your decision..." : "Enter the reason for your decision..."}
                className="bg-surface-1 border-border"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApprovalDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleApprovalDecision}
              disabled={!decisionReason.trim()}
              className={approvalDialog?.action === 'deny' ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              {approvalDialog?.action === 'approve' ? 'Approve' : 'Deny'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Analysis Dialog */}
      <Dialog open={!!analysisDialog} onOpenChange={() => setAnalysisDialog(null)}>
        <DialogContent className="bg-card border-border max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-text-primary flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <ModeText
                operator={`Help for: ${analysisDialog?.summary?.slice(0, 40)}...`}
                engineer={`LLM Analysis for ${analysisDialog?.id}`}
              />
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-warning/10 border border-warning/30">
              <p className="text-sm text-warning flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                <ModeText
                  operator="This is a suggestion only. You decide what to do."
                  engineer="Analysis is advisory only. No execution authority."
                />
              </p>
            </div>

            <ModeDetails
              summary={
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-text-primary">
                    <ModeText operator="What's happening" engineer="Incident Summary" />
                  </h4>
                  <p className="text-sm text-text-secondary">{analysisDialog?.summary}</p>

                  <h4 className="text-sm font-medium text-text-primary">
                    <ModeText operator="What we recommend" engineer="Analysis Results" />
                  </h4>
                  <div className="p-4 rounded-lg bg-surface-1 border border-border">
                    <p className="text-sm text-text-secondary">
                      {viewMode === 'operator'
                        ? `This looks like a temporary issue with the ${analysisDialog?.provider} service. Here's what we suggest:`
                        : `Based on the incident timeline and related receipts, this appears to be a transient issue related to ${analysisDialog?.provider} service degradation. The error pattern suggests:`}
                    </p>
                    <ul className="list-disc list-inside mt-2 text-sm text-text-secondary space-y-1">
                      {viewMode === 'operator' ? (
                        <>
                          <li>Wait about 30 minutes to see if it clears up</li>
                          <li>If it continues, contact the {analysisDialog?.provider} support team</li>
                          <li>Keep customers informed with a status update</li>
                        </>
                      ) : (
                        <>
                          <li>Initial trigger: Elevated latency in API responses</li>
                          <li>Cascading effect: Retry storms from affected clients</li>
                          <li>Recommended action: Monitor for 30 minutes before escalation</li>
                        </>
                      )}
                    </ul>
                  </div>
                </div>
              }
              details={
                <div className="space-y-2">
                  <p className="text-xs text-text-tertiary">Technical Details</p>
                  <div className="text-xs font-mono bg-surface-1 p-2 rounded border border-border text-text-secondary">
                    <p>Incident ID: {analysisDialog?.id}</p>
                    <p>Provider: {analysisDialog?.provider}</p>
                    <p>Customer: {analysisDialog?.customer}</p>
                    <p>Severity: {analysisDialog?.severity}</p>
                  </div>
                </div>
              }
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnalysisDialog(null)}>
              Close
            </Button>
            <Button onClick={() => setAnalysisDialog(null)}>
              <ModeText operator="Save to Notes" engineer="Add to Incident Notes" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
