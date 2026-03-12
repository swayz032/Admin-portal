import { useAuth } from '@/contexts/AuthContext';
import { useSystem } from '@/contexts/SystemContext';
import { HeroMetricCard } from '@/components/home/HeroMetricCard';
import { PriorityActionList, PriorityAction } from '@/components/home/PriorityActionList';
import { StoryInsightCard } from '@/components/home/StoryInsightCard';
import { Panel } from '@/components/shared/Panel';
import { useApprovals, useCustomers, useBusinessMetrics, useRunwayBurn } from '@/hooks/useAdminData';
import { useUnifiedIncidents } from '@/hooks/useUnifiedIncidents';
import { PageLoadingState } from '@/components/shared/PageLoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatCurrency } from '@/lib/formatters';
import { 
  DollarSign, 
  Clock, 
  Shield, 
  Users,
  TrendingUp,
  Activity
} from 'lucide-react';

const defaultBusinessMetrics = {
  totalMRR: 0, mrrGrowth: 0, activeCustomers: 0, newSubscriptions7d: 0,
  churnRate: 0, churn30d: 0, failedPayments: { count: 0, amount: 0 },
  trialConversion: 0, refundsDisputes: { refunds: 0, disputes: 0, amount: 0 },
  expansionMRR: 0, contractionMRR: 0, mrrTrend: [] as Array<{ date: string; mrr: number }>,
};

const defaultRunwayBurn = {
  monthlyBurn: 0, runway: 0, cashOnHand: 0,
  biggestCostDriver: 'No data', burnChangePercent: 0, costCategories: [],
};

export default function Home() {
  const { user } = useAuth();
  const { viewMode } = useSystem();
  const { data: approvals, loading: approvalsLoading } = useApprovals();
  const { data: incidents, loading: incidentsLoading } = useUnifiedIncidents();
  const { data: customers, loading: customersLoading } = useCustomers();
  const { data: rawBusinessMetrics, loading: metricsLoading } = useBusinessMetrics();
  const { data: rawRunwayBurn, loading: runwayLoading } = useRunwayBurn();
  const businessMetrics = rawBusinessMetrics ?? defaultBusinessMetrics;
  const runwayBurnData = rawRunwayBurn ?? defaultRunwayBurn;

  const isLoading = approvalsLoading || incidentsLoading || customersLoading || metricsLoading || runwayLoading;
  if (isLoading) return <PageLoadingState showKPIs kpiCount={3} rows={5} />;

  // Calculate metrics
  const pendingApprovals = approvals.filter(a => a.status === 'Pending').length;
  const openIncidents = incidents.filter(i => i.status === 'Open').length;
  const totalMRR = customers.reduce((sum, c) => sum + c.mrr, 0);

  // Mock sparkline data
  const mrrSparkline = [38000, 39500, 41000, 40200, 43000, 44500, totalMRR];
  const runwaySparkline = [16.5, 17, 17.2, 17.8, 18.0, 18.2, runwayBurnData.runway];
  
  // Determine health status
  const healthStatus = openIncidents === 0 && pendingApprovals < 3 
    ? 'All systems healthy' 
    : openIncidents > 0 
      ? `${openIncidents} issue${openIncidents > 1 ? 's' : ''} need attention`
      : `${pendingApprovals} pending approvals`;

  const healthCardStatus: 'success' | 'warning' | 'critical' = 
    openIncidents === 0 ? 'success' : openIncidents <= 2 ? 'warning' : 'critical';

  // Build priority actions from real data
  const priorityActions: PriorityAction[] = [
    ...approvals
      .filter(a => a.status === 'Pending')
      .map(a => ({
        id: a.id,
        title: a.summary,
        description: `${a.type} • ${a.customer}`,
        urgency: a.risk === 'High' ? 'critical' as const : a.risk === 'Medium' ? 'high' as const : 'medium' as const,
        type: 'approval' as const,
        linkTo: `/approvals?id=${a.id}`,
        linkLabel: 'Review',
      })),
    ...incidents
      .filter(i => i.status === 'Open')
      .map(i => ({
        id: i.id,
        title: i.summary,
        description: `${i.severity} • ${i.provider}`,
        urgency: i.severity === 'P0' ? 'critical' as const : i.severity === 'P1' ? 'high' as const : 'medium' as const,
        type: 'incident' as const,
        linkTo: `/incidents?id=${i.id}`,
        linkLabel: 'Investigate',
      })),
  ].sort((a, b) => {
    const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
  });

  // Story insights data
  const revenueGrowth = businessMetrics.mrrGrowth;
  const weeklyTasksData = [120, 135, 142, 128, 156, 148, 162];
  const customerHealthData = [85, 87, 82, 88, 90, 89, 92];

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  // Get formal name (e.g., "Mr. Scott" from "tonioscott39")
  const formalName = user?.displayName || 'there';

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Welcome Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          {getGreeting()}, {formalName}! 👋
        </h1>
        <p className="text-muted-foreground text-lg">
          {viewMode === 'operator' 
            ? "Here's your business at a glance."
            : "Here's your system overview."}
        </p>
      </div>

      {/* Hero Metrics - 3 Large Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <HeroMetricCard
          title="Monthly Revenue"
          value={formatCurrency(totalMRR)}
          trend={{
            direction: revenueGrowth > 0 ? 'up' : revenueGrowth < 0 ? 'down' : 'flat',
            value: `${revenueGrowth > 0 ? '+' : ''}${revenueGrowth}%`,
            label: 'vs last month',
          }}
          sparklineData={mrrSparkline}
          icon={<DollarSign className="h-5 w-5" />}
          status="success"
          linkTo="/business/revenue-addons"
          linkLabel="View revenue"
        />

        <HeroMetricCard
          title="Runway"
          value={`${runwayBurnData.runway.toFixed(0)} months`}
          trend={{
            direction: runwayBurnData.runway > 12 ? 'up' : 'down',
            value: runwayBurnData.runway > 12 ? 'Healthy' : 'Watch',
            label: `${formatCurrency(runwayBurnData.cashOnHand)} in bank`,
          }}
          sparklineData={runwaySparkline}
          icon={<Clock className="h-5 w-5" />}
          status={runwayBurnData.runway > 12 ? 'success' : 'warning'}
          linkTo="/business/runway-burn"
          linkLabel="View burn rate"
        />

        <HeroMetricCard
          title="System Health"
          value={healthStatus}
          trend={
            openIncidents === 0
              ? { direction: 'up', value: 'All good' }
              : { direction: 'down', value: `${openIncidents} issues` }
          }
          icon={<Shield className="h-5 w-5" />}
          status={healthCardStatus}
          linkTo="/incidents"
          linkLabel="View incidents"
        />
      </div>

      {/* What to Do Today */}
      <Panel 
        title={viewMode === 'operator' ? "What to do today" : "Priority Queue"}
        subtitle={`${priorityActions.length} action${priorityActions.length !== 1 ? 's' : ''} need your attention`}
      >
        <PriorityActionList actions={priorityActions} maxItems={5} />
      </Panel>

      {/* Story Insight Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StoryInsightCard
          headline={revenueGrowth > 0 ? "Revenue is growing!" : "Revenue is stable"}
          subtext={`${revenueGrowth > 0 ? '+' : ''}${revenueGrowth}% compared to last month`}
          trend={revenueGrowth > 0 ? 'positive' : revenueGrowth < 0 ? 'negative' : 'neutral'}
          chartType="area"
          chartData={mrrSparkline}
          icon={<TrendingUp className="h-5 w-5" />}
          linkTo="/business/revenue-addons"
          linkLabel="See breakdown"
        />

        <StoryInsightCard
          headline={`${customers.length} active customers`}
          subtext={`${customers.filter(c => c.status === 'Active').length} healthy, ${customers.filter(c => c.status === 'At Risk').length} at risk`}
          trend="neutral"
          chartType="sparkline"
          chartData={customerHealthData}
          icon={<Users className="h-5 w-5" />}
          linkTo="/customers"
          linkLabel="View customers"
        />

        <StoryInsightCard
          headline="System handled 162 tasks"
          subtext="Up from 142 last week"
          trend="positive"
          chartType="area"
          chartData={weeklyTasksData}
          icon={<Activity className="h-5 w-5" />}
          linkTo="/activity"
          linkLabel="View activity"
        />
      </div>
    </div>
  );
}
