import { Panel } from '@/components/shared/Panel';
import { KPICard } from '@/components/shared/KPICard';
import { DataTable } from '@/components/shared/DataTable';
import { ModeText } from '@/components/shared/ModeText';
import { StatusChip } from '@/components/shared/StatusChip';
import { useSystem } from '@/contexts/SystemContext';
// TODO: Remove seed type import once RevenueData from apiClient fully replaces RevenueSKU
import type { RevenueSKU } from '@/data/businessSeed';
import { useRevenueAddons } from '@/hooks/useAdminData';
import type { RevenueData } from '@/services/apiClient';
import { PageLoadingState } from '@/components/shared/PageLoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatCurrency } from '@/lib/formatters';
import {
  DollarSign,
  Package,
  TrendingUp,
  TrendingDown,
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
  Cell
} from 'recharts';

const COLORS = ['hsl(187, 82%, 53%)', 'hsl(142, 71%, 45%)', 'hsl(262, 83%, 58%)', 'hsl(38, 92%, 50%)', 'hsl(0, 72%, 51%)'];

// Map API SKU shape to display-friendly type
type ApiSku = RevenueData['skus'][number];

export default function RevenueAddons() {
  const { viewMode } = useSystem();

  // Production data hook
  const { data: revenueData, loading, error, refetch } = useRevenueAddons();

  if (loading) return <PageLoadingState showKPIs kpiCount={5} rows={5} />;
  if (error) return <EmptyState variant="error" title="Failed to load revenue data" description={error} actionLabel="Retry" onAction={refetch} />;
  if (!revenueData) return <EmptyState variant="no-data" title="No revenue data yet" description="Revenue and add-on data will appear once billing connections are configured." />;

  const { totalRevenue, revenueChange, skus } = revenueData;

  // Compute KPIs from available data
  const skuCount = skus.length;
  const topSku = skus.length > 0
    ? [...skus].sort((a, b) => b.revenue - a.revenue)[0].name
    : '—';
  const totalCustomers = skus.reduce((sum, s) => sum + s.customers, 0);

  const getTrendIcon = (trend: ApiSku['trend']) => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-3 w-3 text-success inline ml-1" />;
      case 'down': return <TrendingDown className="h-3 w-3 text-destructive inline ml-1" />;
      default: return null;
    }
  };

  // Chart data for SKU revenue
  const skuChartData = skus.map(s => ({
    name: s.name,
    revenue: s.revenue,
    customers: s.customers,
  }));

  const operatorColumns = [
    { key: 'name', header: 'Product' },
    {
      key: 'revenue',
      header: 'Revenue',
      render: (s: ApiSku) => (
        <span className="font-medium">
          {formatCurrency(s.revenue)}
          {getTrendIcon(s.trend)}
        </span>
      )
    },
    {
      key: 'customers',
      header: 'Customers',
      render: (s: ApiSku) => <span>{s.customers}</span>
    },
    {
      key: 'trend',
      header: 'Trend',
      render: (s: ApiSku) => (
        <Badge variant={s.trend === 'up' ? 'default' : s.trend === 'down' ? 'destructive' : 'outline'} className="capitalize">
          {s.trend}
        </Badge>
      )
    },
  ];

  const engineerColumns = [
    { key: 'name', header: 'SKU Name' },
    {
      key: 'revenue',
      header: 'Revenue',
      render: (s: ApiSku) => <span className="font-medium">{formatCurrency(s.revenue)}</span>
    },
    {
      key: 'customers',
      header: 'Customers',
      render: (s: ApiSku) => <span>{s.customers}</span>
    },
    {
      key: 'trend',
      header: 'Trend',
      render: (s: ApiSku) => <span className="text-text-secondary capitalize">{s.trend}</span>
    },
  ];

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">
          <ModeText operator="Revenue & Add-ons" engineer="Revenue & Add-ons Analysis" />
        </h1>
        <p className="page-subtitle">
          <ModeText
            operator="Your recurring revenue breakdown"
            engineer="Revenue by SKU, add-ons, and trends"
          />
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard
          title={viewMode === 'operator' ? 'Total Revenue' : 'Total Revenue'}
          value={formatCurrency(totalRevenue)}
          icon={<DollarSign className="h-4 w-4" />}
          status="success"
        />
        <KPICard
          title={viewMode === 'operator' ? 'Revenue Change' : 'Revenue Change'}
          value={`${revenueChange >= 0 ? '+' : ''}${revenueChange}%`}
          icon={revenueChange >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          status={revenueChange >= 0 ? 'success' : 'warning'}
        />
        <KPICard
          title={viewMode === 'operator' ? 'Products' : 'SKU Count'}
          value={skuCount}
          icon={<Package className="h-4 w-4" />}
          status="info"
        />
        <KPICard
          title={viewMode === 'operator' ? 'Top Product' : 'Top SKU'}
          value={topSku}
          icon={<BarChart3 className="h-4 w-4" />}
          status="success"
        />
        <KPICard
          title={viewMode === 'operator' ? 'Total Customers' : 'Customers (All SKUs)'}
          value={totalCustomers}
          icon={<DollarSign className="h-4 w-4" />}
          status="info"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Revenue by SKU Chart */}
        <Panel title={viewMode === 'operator' ? 'Revenue Mix' : 'Revenue by SKU'}>
          {skuChartData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={skuChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis type="number" stroke="rgba(255,255,255,0.5)" fontSize={12} />
                  <YAxis dataKey="name" type="category" stroke="rgba(255,255,255,0.5)" fontSize={12} width={120} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: 'hsl(220 18% 11%)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '8px',
                      color: 'rgba(255,255,255,0.92)'
                    }}
                  />
                  <Bar dataKey="revenue" name="Revenue">
                    {skuChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState variant="chart-empty" />
          )}
        </Panel>

        {/* Revenue Summary Cards */}
        <div className="xl:col-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {skus.length > 0 ? (
            skus.slice(0, 6).map((sku, index) => (
              <div key={sku.name} className="p-4 rounded-lg bg-surface-1 border border-border">
                <p className="text-xs text-text-secondary uppercase tracking-wide mb-1">{sku.name}</p>
                <p className="text-2xl font-semibold" style={{ color: COLORS[index % COLORS.length] }}>
                  {formatCurrency(sku.revenue)}
                </p>
                <p className="text-xs text-text-tertiary mt-1">
                  {sku.customers} customer{sku.customers !== 1 ? 's' : ''}
                  {getTrendIcon(sku.trend)}
                </p>
              </div>
            ))
          ) : (
            <div className="sm:col-span-2 lg:col-span-3">
              <EmptyState variant="no-data" title="No SKU data" description="Revenue breakdown by SKU will appear once subscriptions are active." />
            </div>
          )}
        </div>
      </div>

      {/* SKU Table */}
      <Panel title={viewMode === 'operator' ? 'All Products' : 'Revenue by SKU'} noPadding>
        {skus.length > 0 ? (
          <DataTable
            columns={viewMode === 'operator' ? operatorColumns : engineerColumns}
            data={skus}
            keyExtractor={(s) => s.name}
          />
        ) : (
          <EmptyState variant="no-data" title="No products yet" description="Product revenue data will populate as subscriptions come in." />
        )}
      </Panel>
    </div>
  );
}
