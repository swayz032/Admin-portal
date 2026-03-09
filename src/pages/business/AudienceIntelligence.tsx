import { Panel } from '@/components/shared/Panel';
import { KPICard } from '@/components/shared/KPICard';
import { useSystem } from '@/contexts/SystemContext';
import { useAudienceInsights } from '@/hooks/useAdminData';
import { PageLoadingState } from '@/components/shared/PageLoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatPercent } from '@/lib/formatters';
import {
  Users, Globe, Target, BarChart3, Briefcase, TrendingUp
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';

const COLORS = ['hsl(187, 82%, 53%)', 'hsl(142, 71%, 45%)', 'hsl(262, 83%, 58%)', 'hsl(38, 92%, 50%)', 'hsl(0, 72%, 51%)', 'hsl(210, 70%, 55%)', 'hsl(330, 65%, 50%)', 'hsl(170, 60%, 45%)'];

function BarChartPanel({ title, data, dataKey = 'count', nameKey = 'label' }: {
  title: string;
  data: Array<{ label: string; count: number }>;
  dataKey?: string;
  nameKey?: string;
}) {
  if (data.length === 0) {
    return (
      <Panel title={title}>
        <p className="text-sm text-muted-foreground text-center py-8">No data available</p>
      </Panel>
    );
  }
  return (
    <Panel title={title}>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.slice(0, 8)} layout="vertical" margin={{ left: 100, right: 16, top: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 20%)" />
            <XAxis type="number" tick={{ fill: 'hsl(0, 0%, 60%)', fontSize: 12 }} />
            <YAxis dataKey={nameKey} type="category" tick={{ fill: 'hsl(0, 0%, 60%)', fontSize: 12 }} width={90} />
            <Tooltip
              contentStyle={{ backgroundColor: 'hsl(0, 0%, 10%)', border: '1px solid hsl(0, 0%, 20%)', borderRadius: '8px' }}
              labelStyle={{ color: 'hsl(0, 0%, 90%)' }}
            />
            <Bar dataKey={dataKey} radius={[0, 4, 4, 0]}>
              {data.slice(0, 8).map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

function PieChartPanel({ title, data }: { title: string; data: Array<{ label: string; count: number }> }) {
  if (data.length === 0) {
    return (
      <Panel title={title}>
        <p className="text-sm text-muted-foreground text-center py-8">No data available</p>
      </Panel>
    );
  }
  const total = data.reduce((sum, d) => sum + d.count, 0);
  return (
    <Panel title={title}>
      <div className="h-64 flex items-center">
        <div className="w-1/2 h-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.slice(0, 6)}
                dataKey="count"
                nameKey="label"
                cx="50%"
                cy="50%"
                outerRadius={80}
                innerRadius={40}
              >
                {data.slice(0, 6).map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(0, 0%, 10%)', border: '1px solid hsl(0, 0%, 20%)', borderRadius: '8px' }}
                labelStyle={{ color: 'hsl(0, 0%, 90%)' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="w-1/2 space-y-1.5 pl-4">
          {data.slice(0, 6).map((d, i) => (
            <div key={d.label} className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              <span className="text-muted-foreground truncate">{d.label}</span>
              <span className="ml-auto text-foreground font-medium">{total > 0 ? Math.round((d.count / total) * 100) : 0}%</span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

export default function AudienceIntelligence() {
  const { viewMode } = useSystem();
  const { data, loading, error, refetch } = useAudienceInsights();

  if (loading) return <PageLoadingState showKPIs kpiCount={4} rows={3} />;
  if (error) return <EmptyState variant="error" title="Failed to load audience data" description={error} actionLabel="Retry" onAction={refetch} />;
  if (!data || data.totalProfiles === 0) return <EmptyState variant="no-data" title="No audience data yet" description="Audience intelligence will appear once customer profiles are created." />;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label={viewMode === 'operator' ? 'Total Customers' : 'Suite Profiles'}
          value={data.totalProfiles}
          icon={<Users className="h-4 w-4" />}
        />
        <KPICard
          label="Profile Completion"
          value={formatPercent(data.completionRate)}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <KPICard
          label={viewMode === 'operator' ? 'Top Industry' : 'Primary Vertical'}
          value={data.topIndustry}
          icon={<Briefcase className="h-4 w-4" />}
        />
        <KPICard
          label={viewMode === 'operator' ? 'Top Country' : 'Primary Region'}
          value={data.topCountry}
          icon={<Globe className="h-4 w-4" />}
        />
      </div>

      {/* Tabbed Charts */}
      <Tabs defaultValue="demographics">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="demographics">
            <Users className="h-4 w-4 mr-1.5" />
            {viewMode === 'operator' ? 'Who They Are' : 'Demographics'}
          </TabsTrigger>
          <TabsTrigger value="acquisition">
            <Target className="h-4 w-4 mr-1.5" />
            {viewMode === 'operator' ? 'How They Found Us' : 'Acquisition'}
          </TabsTrigger>
          <TabsTrigger value="needs">
            <BarChart3 className="h-4 w-4 mr-1.5" />
            {viewMode === 'operator' ? 'What They Need' : 'Needs & Intelligence'}
          </TabsTrigger>
          <TabsTrigger value="geography">
            <Globe className="h-4 w-4 mr-1.5" />
            Geography
          </TabsTrigger>
        </TabsList>

        {/* Demographics Tab */}
        <TabsContent value="demographics" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PieChartPanel
              title={viewMode === 'operator' ? 'Business Types' : 'Entity Types'}
              data={data.demographics.entityTypes}
            />
            <PieChartPanel
              title={viewMode === 'operator' ? 'Customer Segments' : 'Customer Types'}
              data={data.demographics.customerTypes}
            />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PieChartPanel title="Gender Distribution" data={data.demographics.genders} />
            <BarChartPanel
              title={viewMode === 'operator' ? 'Revenue Brackets' : 'Annual Revenue Bands'}
              data={data.demographics.revenueBands}
            />
          </div>
        </TabsContent>

        {/* Acquisition Tab */}
        <TabsContent value="acquisition" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BarChartPanel
              title={viewMode === 'operator' ? 'Where They Come From' : 'Referral Sources'}
              data={data.acquisition.referralSources}
            />
            <PieChartPanel
              title={viewMode === 'operator' ? 'Sales Channels' : 'Channel Distribution'}
              data={data.acquisition.salesChannels}
            />
          </div>
          <Panel title={viewMode === 'operator' ? 'Signups Over Time' : 'Monthly Registration Trend'}>
            {data.acquisition.signupsByMonth.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.acquisition.signupsByMonth} margin={{ left: 16, right: 16, top: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 20%)" />
                    <XAxis dataKey="date" tick={{ fill: 'hsl(0, 0%, 60%)', fontSize: 12 }} />
                    <YAxis tick={{ fill: 'hsl(0, 0%, 60%)', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(0, 0%, 10%)', border: '1px solid hsl(0, 0%, 20%)', borderRadius: '8px' }}
                      labelStyle={{ color: 'hsl(0, 0%, 90%)' }}
                    />
                    <Bar dataKey="count" fill="hsl(187, 82%, 53%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No signup data available</p>
            )}
          </Panel>
        </TabsContent>

        {/* Needs & Intelligence Tab */}
        <TabsContent value="needs" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BarChartPanel
              title={viewMode === 'operator' ? 'Most Requested Services' : 'Top Services Needed'}
              data={data.needs.topServices}
            />
            <BarChartPanel
              title={viewMode === 'operator' ? 'What They Want to Achieve' : 'Top Business Goals'}
              data={data.needs.topGoals}
            />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BarChartPanel
              title={viewMode === 'operator' ? 'Biggest Pain Points' : 'Top Pain Points'}
              data={data.needs.topPainPoints}
            />
            <PieChartPanel
              title={viewMode === 'operator' ? 'How They Want to Communicate' : 'Preferred Channels'}
              data={data.needs.preferredChannels}
            />
          </div>
        </TabsContent>

        {/* Geography Tab */}
        <TabsContent value="geography" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BarChartPanel
              title={viewMode === 'operator' ? 'Countries' : 'Business Countries'}
              data={data.geography.countries}
            />
            <BarChartPanel
              title={viewMode === 'operator' ? 'States / Regions' : 'Business States'}
              data={data.geography.states}
            />
          </div>
          <BarChartPanel
            title={viewMode === 'operator' ? 'Top Cities' : 'Business Cities'}
            data={data.geography.cities}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
