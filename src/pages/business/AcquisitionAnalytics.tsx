import { Panel } from '@/components/shared/Panel';
import { KPICard } from '@/components/shared/KPICard';
import { DataTable } from '@/components/shared/DataTable';
import { ModeText } from '@/components/shared/ModeText';
import { ModeDetails } from '@/components/shared/ModeDetails';
import { ChartWithHeadline } from '@/components/charts/ChartWithHeadline';
import { useSystem } from '@/contexts/SystemContext';
// TODO: Remove seed type imports once AcquisitionData from apiClient fully replaces seed types
import type { ChannelPerformance, AgeRangeData, GenderData } from '@/data/businessSeed';
import { useAcquisitionAnalytics } from '@/hooks/useAdminData';
import type { AcquisitionData } from '@/services/apiClient';
import { PageLoadingState } from '@/components/shared/PageLoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatPercent } from '@/lib/formatters';
import {
  Users,
  TrendingUp,
  Target,
  BarChart3,
  UserCircle,
  Info
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { Alert, AlertDescription } from '@/components/ui/alert';

const BAR_COLORS = ['hsl(217, 91%, 60%)', 'hsl(142, 71%, 45%)', 'hsl(262, 83%, 58%)', 'hsl(38, 92%, 50%)', 'hsl(0, 72%, 51%)'];

// Map API channel shape to display-friendly type
type ApiChannel = AcquisitionData['channels'][number];
type ApiAgeRange = AcquisitionData['demographics']['ageRanges'][number];
type ApiGender = AcquisitionData['demographics']['genders'][number];

export default function AcquisitionAnalytics() {
  const { viewMode } = useSystem();

  // Production data hook
  const { data: acquisitionData, loading, error, refetch } = useAcquisitionAnalytics();

  if (loading) return <PageLoadingState showKPIs kpiCount={5} rows={5} />;
  if (error) return <EmptyState variant="error" title="Failed to load acquisition data" description={error} actionLabel="Retry" onAction={refetch} />;
  if (!acquisitionData) return <EmptyState variant="no-data" title="No acquisition data yet" description="Acquisition analytics will appear once signups begin flowing in." />;

  const { totalSignups, signupsTrend, conversionRate, channels, demographics } = acquisitionData;

  // Compute KPIs from available data
  const topChannel = channels.length > 0
    ? [...channels].sort((a, b) => b.signups - a.signups)[0].name
    : '—';
  const totalChannelSignups = channels.reduce((sum, c) => sum + c.signups, 0);
  const recentTrend = signupsTrend.length >= 2
    ? signupsTrend[signupsTrend.length - 1].count - signupsTrend[signupsTrend.length - 2].count
    : 0;
  const hasDemographics = demographics.ageRanges.length > 0 || demographics.genders.length > 0;

  // Signup trend chart data
  const trendChartData = signupsTrend.map(t => ({
    name: t.date,
    signups: t.count,
  }));

  // Channel columns
  const operatorChannelColumns = [
    { key: 'name', header: 'Channel' },
    { key: 'signups', header: 'Signups', render: (c: ApiChannel) => <span className="font-medium">{c.signups}</span> },
    {
      key: 'conversion',
      header: 'Conversion',
      render: (c: ApiChannel) => (
        <span className={c.conversion > 5 ? 'text-success' : 'text-text-secondary'}>
          {c.conversion}%
        </span>
      )
    },
  ];

  const engineerChannelColumns = [
    { key: 'name', header: 'Channel' },
    { key: 'signups', header: 'Signups' },
    {
      key: 'conversion',
      header: 'Conv %',
      render: (c: ApiChannel) => `${c.conversion}%`
    },
  ];

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">
          <ModeText operator="Acquisition Analytics" engineer="Acquisition Analytics" />
        </h1>
        <p className="page-subtitle">
          <ModeText
            operator="Where your customers come from"
            engineer="Channel performance, signup trends, and demographic analysis"
          />
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard
          title={viewMode === 'operator' ? 'Total Signups' : 'Total Signups'}
          value={totalSignups}
          icon={<Users className="h-4 w-4" />}
          status="success"
        />
        <KPICard
          title={viewMode === 'operator' ? 'Conversion Rate' : 'Conversion Rate'}
          value={`${conversionRate}%`}
          icon={<TrendingUp className="h-4 w-4" />}
          status="info"
        />
        <KPICard
          title={viewMode === 'operator' ? 'Best Channel' : 'Top Channel'}
          value={topChannel}
          icon={<Target className="h-4 w-4" />}
          status="success"
        />
        <KPICard
          title={viewMode === 'operator' ? 'Channels' : 'Channel Count'}
          value={channels.length}
          icon={<BarChart3 className="h-4 w-4" />}
          status="info"
        />
        <KPICard
          title={viewMode === 'operator' ? 'Recent Trend' : 'MoM Change'}
          value={recentTrend >= 0 ? `+${recentTrend}` : `${recentTrend}`}
          icon={<UserCircle className="h-4 w-4" />}
          status={recentTrend >= 0 ? 'success' : 'warning'}
        />
      </div>

      <Tabs defaultValue="channels" className="w-full">
        <TabsList>
          <TabsTrigger value="channels">
            <ModeText operator="Channels" engineer="Channel Performance" />
          </TabsTrigger>
          <TabsTrigger value="trends">
            <ModeText operator="Trends" engineer="Signup Trends" />
          </TabsTrigger>
          <TabsTrigger value="demographics">
            <ModeText operator="Demographics" engineer="Age & Gender" />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="channels" className="space-y-6 mt-6">
          {channels.length > 0 ? (
            <Panel title={viewMode === 'operator' ? 'Traffic Sources' : 'Channel Performance'} noPadding>
              <DataTable
                columns={viewMode === 'operator' ? operatorChannelColumns : engineerChannelColumns}
                data={channels}
                keyExtractor={(c) => c.name}
              />
            </Panel>
          ) : (
            <EmptyState variant="no-data" title="No channel data" description="Channel performance data will appear once acquisition tracking is configured." />
          )}
        </TabsContent>

        <TabsContent value="trends" className="space-y-6 mt-6">
          {trendChartData.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Panel>
                <ChartWithHeadline
                  headline={viewMode === 'operator'
                    ? `${totalSignups} total signups`
                    : 'Signup Trend Over Time'}
                  subtext={viewMode === 'operator'
                    ? 'Monthly signups over time'
                    : `${signupsTrend.length} months of data`}
                  trend={recentTrend >= 0 ? 'positive' : 'negative'}
                >
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={trendChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                        <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" fontSize={12} />
                        <YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(220 18% 11%)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '8px',
                            color: 'rgba(255,255,255,0.92)'
                          }}
                        />
                        <Bar dataKey="signups" fill="hsl(217, 91%, 60%)" name="Signups" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </ChartWithHeadline>
              </Panel>

              <Panel title={viewMode === 'operator' ? 'Monthly Numbers' : 'Monthly Breakdown'}>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {signupsTrend.slice().reverse().map((month) => (
                    <div key={month.date} className="flex justify-between items-center p-2 rounded bg-surface-1">
                      <span className="text-sm">{month.date}</span>
                      <span className="font-medium">{month.count} signups</span>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          ) : (
            <EmptyState variant="chart-empty" title="No trend data" description="Signup trend data will appear once signups begin accumulating over time." />
          )}
        </TabsContent>

        <TabsContent value="demographics" className="space-y-6 mt-6">
          {hasDemographics ? (
            <>
              <Alert className="bg-surface-1 border-border">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <span className="text-sm">
                    {viewMode === 'operator'
                      ? 'Demographics data from analytics (aggregated, consenting users only)'
                      : 'Data source: suite_profiles metadata'
                    }
                  </span>
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Age Range */}
                {demographics.ageRanges.length > 0 ? (
                  <Panel title={viewMode === 'operator' ? 'Age Groups' : 'Age Range Distribution'}>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={demographics.ageRanges.map(a => ({ name: a.range, count: a.count }))}
                          layout="vertical"
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                          <XAxis type="number" stroke="rgba(255,255,255,0.5)" fontSize={12} />
                          <YAxis dataKey="name" type="category" stroke="rgba(255,255,255,0.5)" fontSize={12} width={100} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'hsl(220 18% 11%)',
                              border: '1px solid rgba(255,255,255,0.08)',
                              borderRadius: '8px',
                              color: 'rgba(255,255,255,0.92)'
                            }}
                          />
                          <Bar dataKey="count" fill="hsl(217, 91%, 60%)" name="Signups" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-4 space-y-2">
                      {demographics.ageRanges.slice(0, 3).map((age) => (
                        <div key={age.range} className="flex justify-between text-sm">
                          <span>{age.range}</span>
                          <span className="text-text-secondary">{age.count} signups</span>
                        </div>
                      ))}
                    </div>
                  </Panel>
                ) : (
                  <Panel title="Age Groups">
                    <EmptyState variant="chart-empty" title="No age data" description="Age range data is not yet available." />
                  </Panel>
                )}

                {/* Gender */}
                {demographics.genders.length > 0 ? (
                  <Panel title={viewMode === 'operator' ? 'Gender Split' : 'Gender Distribution'}>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={demographics.genders.map(g => ({ name: g.label, count: g.count }))}
                          layout="vertical"
                        >
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
                          <Bar dataKey="count" fill="hsl(262, 83%, 58%)" name="Signups" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-4 space-y-2">
                      {demographics.genders.slice(0, 3).map((gender) => (
                        <div key={gender.label} className="flex justify-between text-sm">
                          <span>{gender.label}</span>
                          <span className="text-text-secondary">{gender.count} signups</span>
                        </div>
                      ))}
                    </div>
                  </Panel>
                ) : (
                  <Panel title="Gender Split">
                    <EmptyState variant="chart-empty" title="No gender data" description="Gender distribution data is not yet available." />
                  </Panel>
                )}
              </div>
            </>
          ) : (
            <EmptyState variant="no-data" title="No demographics data" description="Demographic analytics will appear once user profile data is collected." />
          )}

          {/* Cross-tab note */}
          <Panel title={viewMode === 'operator' ? 'Age x Gender' : 'Cross-Tabulation'}>
            <div className="p-6 text-center text-text-secondary">
              <p className="text-sm">
                {viewMode === 'operator'
                  ? 'Not enough data yet to show age and gender together'
                  : 'Cross-tabulation requires minimum sample size threshold. Current data: Limited'
                }
              </p>
            </div>
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}
