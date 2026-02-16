import { Panel } from '@/components/shared/Panel';
import { KPICard } from '@/components/shared/KPICard';
import { DataTable } from '@/components/shared/DataTable';
import { ModeText } from '@/components/shared/ModeText';
import { useSystem } from '@/contexts/SystemContext';
// TODO: Remove seed type imports once hook data fully replaces seed types
import type { SkillPackUsage, SkillPackOutcome } from '@/data/businessSeed';
import { useSkillPackAnalytics } from '@/hooks/useAdminData';
import { PageLoadingState } from '@/components/shared/PageLoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatPercent } from '@/lib/formatters';
import {
  Zap,
  Trophy,
  AlertTriangle,
  TrendingUp,
  BarChart3
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart as RechartsPie,
  Pie,
  Legend
} from 'recharts';

const BAR_COLORS = ['hsl(187, 82%, 53%)', 'hsl(142, 71%, 45%)', 'hsl(262, 83%, 58%)', 'hsl(38, 92%, 50%)', 'hsl(0, 72%, 51%)'];
const PIE_COLORS = ['hsl(142, 71%, 45%)', 'hsl(0, 72%, 51%)', 'hsl(38, 92%, 50%)', 'hsl(262, 83%, 58%)', 'hsl(187, 82%, 53%)'];

export default function SkillPackAnalytics() {
  const { viewMode } = useSystem();

  // Production data hook
  const { data: analyticsData, loading, error, refetch } = useSkillPackAnalytics();

  if (loading) return <PageLoadingState showKPIs kpiCount={5} rows={5} />;
  if (error) return <EmptyState variant="error" title="Failed to load analytics" description={error} actionLabel="Retry" onAction={refetch} />;
  if (!analyticsData) return <EmptyState variant="no-data" title="No analytics data yet" description="Skill pack analytics will appear once agents begin executing actions." />;

  const { usageByPack, outcomeDistribution } = analyticsData;

  // Compute KPIs from available data
  const totalExecutions = usageByPack.reduce((sum, p) => sum + p.executions, 0);
  const avgSuccessRate = usageByPack.length > 0
    ? Math.round(usageByPack.reduce((sum, p) => sum + p.successRate, 0) / usageByPack.length)
    : 0;
  const mostUsedPack = usageByPack.length > 0
    ? [...usageByPack].sort((a, b) => b.executions - a.executions)[0].name
    : '—';
  const bestPerformer = usageByPack.length > 0
    ? [...usageByPack].sort((a, b) => b.successRate - a.successRate)[0].name
    : '—';
  const totalOutcomes = outcomeDistribution.reduce((sum, o) => sum + o.count, 0);

  // Chart data
  const usageChartData = usageByPack.map(u => ({
    name: u.name,
    executions: u.executions,
    successRate: u.successRate,
  }));

  const outcomeChartData = outcomeDistribution.map(o => ({
    name: o.outcome,
    value: o.count,
  }));

  // Table columns for usage by pack
  const operatorColumns = [
    {
      key: 'name',
      header: 'Staff Member',
      render: (u: { name: string; executions: number; successRate: number }) => (
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <span className="font-medium">{u.name}</span>
        </div>
      )
    },
    {
      key: 'executions',
      header: 'Actions',
      render: (u: { name: string; executions: number; successRate: number }) => <span className="font-medium">{u.executions.toLocaleString()}</span>
    },
    {
      key: 'successRate',
      header: 'Success',
      render: (u: { name: string; executions: number; successRate: number }) => (
        <span className={u.successRate > 95 ? 'text-success' : u.successRate > 90 ? 'text-warning' : 'text-destructive'}>
          {u.successRate}%
        </span>
      )
    },
  ];

  const engineerColumns = [
    { key: 'name', header: 'Pack Name' },
    {
      key: 'executions',
      header: '30d Executions',
      render: (u: { name: string; executions: number; successRate: number }) => <span>{u.executions.toLocaleString()}</span>
    },
    {
      key: 'successRate',
      header: 'Success %',
      render: (u: { name: string; executions: number; successRate: number }) => `${u.successRate}%`
    },
  ];

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">
          <ModeText operator="Staff Performance" engineer="Skill Pack Analytics" />
        </h1>
        <p className="page-subtitle">
          <ModeText
            operator="See how your automated team is doing"
            engineer="Usage metrics and outcome distribution"
          />
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard
          title={viewMode === 'operator' ? 'Total Actions' : 'Total Executions'}
          value={totalExecutions.toLocaleString()}
          icon={<Zap className="h-4 w-4" />}
          status="info"
        />
        <KPICard
          title={viewMode === 'operator' ? 'Busiest Staff' : 'Most Used Pack'}
          value={mostUsedPack}
          icon={<TrendingUp className="h-4 w-4" />}
          status="success"
        />
        <KPICard
          title={viewMode === 'operator' ? 'Top Performer' : 'Highest Success Rate'}
          value={bestPerformer}
          icon={<Trophy className="h-4 w-4" />}
          status="success"
        />
        <KPICard
          title={viewMode === 'operator' ? 'Avg Success' : 'Avg Success Rate'}
          value={`${avgSuccessRate}%`}
          icon={<BarChart3 className="h-4 w-4" />}
          status={avgSuccessRate > 95 ? 'success' : avgSuccessRate > 90 ? 'warning' : 'critical'}
        />
        <KPICard
          title={viewMode === 'operator' ? 'Outcome Types' : 'Distinct Outcomes'}
          value={outcomeDistribution.length}
          icon={<AlertTriangle className="h-4 w-4" />}
          status="info"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Usage Chart */}
        <Panel title={viewMode === 'operator' ? 'Staff Activity (30d)' : 'Top Skill Packs (30d)'}>
          {usageChartData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={usageChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis type="number" stroke="rgba(255,255,255,0.5)" fontSize={12} />
                  <YAxis dataKey="name" type="category" stroke="rgba(255,255,255,0.5)" fontSize={12} width={120} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(220 18% 11%)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '8px',
                      color: 'rgba(255,255,255,0.92)'
                    }}
                  />
                  <Bar dataKey="executions" name="Executions">
                    {usageChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState variant="chart-empty" />
          )}
        </Panel>

        {/* Outcome Distribution */}
        <Panel title={viewMode === 'operator' ? 'Results Breakdown' : 'Outcome Distribution'}>
          {outcomeChartData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie
                    data={outcomeChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {outcomeChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(220 18% 11%)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '8px',
                      color: 'rgba(255,255,255,0.92)'
                    }}
                  />
                  <Legend />
                </RechartsPie>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState variant="chart-empty" />
          )}
        </Panel>
      </div>

      {/* Usage Table */}
      <Panel title={viewMode === 'operator' ? 'All Staff Performance' : 'Usage by Pack'} noPadding>
        <DataTable
          columns={viewMode === 'operator' ? operatorColumns : engineerColumns}
          data={usageByPack}
          keyExtractor={(u) => u.name}
        />
      </Panel>
    </div>
  );
}
