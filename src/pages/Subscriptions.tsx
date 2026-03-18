import { PageHero } from '@/components/shared/PageHero';
import { QuickStats } from '@/components/shared/QuickStats';
import { InsightPanel } from '@/components/shared/InsightPanel';
import { Panel } from '@/components/shared/Panel';
import { DataTable } from '@/components/shared/DataTable';
import { StatusChip } from '@/components/shared/StatusChip';
import type { Subscription } from '@/data/seed';
import { useSubscriptions, useBusinessMetrics } from '@/hooks/useAdminData';
import { PageLoadingState } from '@/components/shared/PageLoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatCurrency, formatDateShort } from '@/lib/formatters';
import { DollarSign, Users, TrendingUp, TrendingDown, CreditCard, AlertTriangle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { useSystem } from '@/contexts/SystemContext';
import { ModeText } from '@/components/shared/ModeText';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

const eventData = [
  { name: 'Jan 1', payments: 12, upgrades: 3, downgrades: 1, cancellations: 0 },
  { name: 'Jan 2', payments: 8, upgrades: 2, downgrades: 0, cancellations: 1 },
  { name: 'Jan 3', payments: 15, upgrades: 4, downgrades: 2, cancellations: 0 },
  { name: 'Jan 4', payments: 10, upgrades: 1, downgrades: 0, cancellations: 0 },
  { name: 'Jan 5', payments: 18, upgrades: 5, downgrades: 1, cancellations: 1 },
  { name: 'Jan 6', payments: 14, upgrades: 2, downgrades: 0, cancellations: 0 },
  { name: 'Jan 7', payments: 22, upgrades: 3, downgrades: 1, cancellations: 0 },
];

const planBreakdown = [
  { plan: 'Enterprise', count: 3, mrr: 11497, percent: 93 },
  { plan: 'Professional', count: 3, mrr: 797, percent: 6 },
  { plan: 'Starter', count: 1, mrr: 99, percent: 1 },
];

const defaultBusinessMetrics = {
  totalMRR: 0, mrrGrowth: 0, activeCustomers: 0, newSubscriptions7d: 0,
  churnRate: 0, churn30d: 0, failedPayments: { count: 0, amount: 0 },
  trialConversion: 0, refundsDisputes: { refunds: 0, disputes: 0, amount: 0 },
  expansionMRR: 0, contractionMRR: 0, mrrTrend: [] as Array<{ date: string; mrr: number }>,
};

export default function Subscriptions() {
  const { viewMode } = useSystem();
  const { data: subscriptions, loading: subsLoading, error: subsError, refetch: refetchSubs } = useSubscriptions();
  const { data: rawBusinessMetrics, loading: metricsLoading } = useBusinessMetrics();
  const businessMetrics = rawBusinessMetrics ?? defaultBusinessMetrics;
  const [showAllItems, setShowAllItems] = useState(false);

  if (subsLoading || metricsLoading) return <PageLoadingState showKPIs kpiCount={4} rows={5} />;
  if (subsError) return <EmptyState variant="error" title="Failed to load subscriptions" description={subsError} actionLabel="Retry" onAction={refetchSubs} />;

  const activeSubscriptions = subscriptions.filter(s => s.status === 'Active' || s.status === 'Trial');
  const overdueSubscriptions = subscriptions.filter(s => s.status === 'Past Due');

  const getStatusType = (status: Subscription['status']) => {
    switch (status) {
      case 'Active': return 'success';
      case 'Trial': return 'pending';
      case 'Past Due': return 'critical';
      case 'Cancelled': return 'neutral';
      default: return 'neutral';
    }
  };

  const getOperatorStatus = (status: Subscription['status']) => {
    switch (status) {
      case 'Active': return 'Active';
      case 'Trial': return 'Trying Out';
      case 'Past Due': return 'Payment Issue';
      case 'Cancelled': return 'Ended';
      default: return status;
    }
  };

  const quickStats = [
    { label: 'MRR', value: formatCurrency(businessMetrics.totalMRR), status: 'success' as const },
    { label: 'customers', value: businessMetrics.activeCustomers },
    { label: 'payment issues', value: overdueSubscriptions.length, status: overdueSubscriptions.length > 0 ? 'warning' as const : 'success' as const },
    { label: 'growth', value: `+${businessMetrics.mrrGrowth}%`, status: 'success' as const },
  ];

  const columns = viewMode === 'operator' ? [
    { key: 'customerName', header: 'Customer' },
    { key: 'plan', header: 'Plan' },
    { 
      key: 'status', 
      header: 'Status', 
      render: (s: Subscription) => <StatusChip status={getStatusType(s.status)} label={getOperatorStatus(s.status)} /> 
    },
    { key: 'mrr', header: 'Monthly', render: (s: Subscription) => formatCurrency(s.mrr) },
    { key: 'startedAt', header: 'Started', render: (s: Subscription) => <span className="text-muted-foreground">{formatDateShort(s.startedAt)}</span> },
  ] : [
    { key: 'id', header: 'Subscription ID', render: (s: Subscription) => <span className="font-mono text-xs">{s.id}</span> },
    { key: 'customerName', header: 'Customer' },
    { key: 'plan', header: 'Plan' },
    { 
      key: 'status', 
      header: 'Status', 
      render: (s: Subscription) => <StatusChip status={getStatusType(s.status)} label={s.status} /> 
    },
    { key: 'mrr', header: 'MRR', render: (s: Subscription) => formatCurrency(s.mrr) },
    { key: 'startedAt', header: 'Started', render: (s: Subscription) => <span className="text-muted-foreground">{formatDateShort(s.startedAt)}</span> },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Hero Section */}
      <PageHero
        title={viewMode === 'operator' 
          ? "Your revenue is growing!" 
          : `${formatCurrency(businessMetrics.totalMRR)} Monthly Recurring Revenue`}
        subtitle={viewMode === 'operator' 
          ? `You're earning ${formatCurrency(businessMetrics.totalMRR)} per month from ${businessMetrics.activeCustomers} customers` 
          : "Revenue metrics and subscription management"}
        icon={<DollarSign className="h-6 w-6" />}
        status={{ type: 'success', label: `+${businessMetrics.mrrGrowth}% growth` }}
      />

      {/* Quick Stats */}
      <QuickStats stats={quickStats} />

      {/* Story Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <InsightPanel
          headline={`Revenue grew ${businessMetrics.mrrGrowth}%`}
          subtext="Compared to last month"
          trend="positive"
          value={`+${businessMetrics.mrrGrowth}%`}
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <InsightPanel
          headline={overdueSubscriptions.length === 0 ? "No payment issues" : `${overdueSubscriptions.length} payment issue${overdueSubscriptions.length !== 1 ? 's' : ''}`}
          subtext={overdueSubscriptions.length === 0 ? "All payments on track" : `${formatCurrency(overdueSubscriptions.reduce((sum, s) => sum + s.mrr, 0))} at risk`}
          trend={overdueSubscriptions.length === 0 ? 'positive' : 'negative'}
          icon={overdueSubscriptions.length === 0 ? <CreditCard className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
        />
        <InsightPanel
          headline="Net growth: +$901"
          subtext="After accounting for churn"
          trend="positive"
          icon={<TrendingUp className="h-5 w-5" />}
          linkTo="/business/revenue-addons"
          linkLabel="View breakdown"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Panel title={viewMode === 'operator' ? "Revenue Growth" : "MRR Trend"}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={businessMetrics.mrrTrend}>
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
                  tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
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
                  stroke="hsl(217 91% 60%)" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(217 91% 60%)', strokeWidth: 0, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title={viewMode === 'operator' ? "Plan Distribution" : "Plans Breakdown"}>
          <div className="space-y-4">
            {planBreakdown.map((plan) => (
              <div key={plan.plan}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-primary" />
                    <span className="text-sm font-medium">{plan.plan}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{formatCurrency(plan.mrr)}</p>
                    <p className="text-xs text-muted-foreground">{plan.count} customers</p>
                  </div>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${plan.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Collapsible Subscriptions Table */}
      <Collapsible open={showAllItems} onOpenChange={setShowAllItems}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full flex items-center justify-between">
            <span>{viewMode === 'operator' ? 'View all plans' : 'View all subscriptions'}</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${showAllItems ? 'rotate-180' : ''}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4">
          <Panel noPadding>
            <DataTable
              columns={columns}
              data={subscriptions}
              keyExtractor={(s) => s.id}
              emptyMessage="No subscriptions found."
            />
          </Panel>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
