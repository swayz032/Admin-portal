import { useState } from 'react';
import { Panel } from '@/components/shared/Panel';
import { KPICard } from '@/components/shared/KPICard';
import { DataTable } from '@/components/shared/DataTable';
import { ModeText } from '@/components/shared/ModeText';
import { ModeDetails } from '@/components/shared/ModeDetails';
import { useSystem } from '@/contexts/SystemContext';
import type { VendorUsage } from '@/data/businessSeed';
import { useCostsUsage } from '@/hooks/useAdminData';
import type { CostsUsageData } from '@/services/apiClient';
import { PageLoadingState } from '@/components/shared/PageLoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatCurrency, formatTimeAgo } from '@/lib/formatters';
import { 
  Package, 
  Cpu, 
  TrendingUp, 
  AlertTriangle, 
  Bell,
  ChevronRight,
  CreditCard,
  Link2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Card } from '@/components/ui/card';

// Map API vendor shape to display-friendly type
type ApiVendor = CostsUsageData['vendors'][number];

export default function CostsUsage() {
  const { viewMode } = useSystem();
  const [selectedVendor, setSelectedVendor] = useState<ApiVendor | null>(null);

  // Production data hook
  const { data: costsUsageData, loading, error, refetch } = useCostsUsage();

  if (loading) return <PageLoadingState showKPIs kpiCount={5} rows={5} />;
  if (error) return <EmptyState variant="error" title="Failed to load cost data" description={error} actionLabel="Retry" onAction={refetch} />;
  if (!costsUsageData) return <EmptyState variant="no-data" title="No cost data yet" description="Costs and usage data will appear once provider connections are active." />;

  const operatorColumns = [
    { key: 'vendor', header: 'Service' },
    { 
      key: 'costThisMonth', 
      header: 'This Month', 
      render: (v: VendorUsage) => <span className="font-medium">{formatCurrency(v.costThisMonth)}</span> 
    },
    { key: 'meaning', header: 'What This Is' },
    { 
      key: 'nextStep', 
      header: 'Next Step', 
      render: (v: VendorUsage) => (
        <Button variant="ghost" size="sm" className="h-7 text-xs">
          {v.nextStep}
          <ChevronRight className="ml-1 h-3 w-3" />
        </Button>
      )
    },
    { 
      key: 'updatedAt', 
      header: 'Updated', 
      render: (v: VendorUsage) => <span className="text-text-secondary text-xs">{formatTimeAgo(v.updatedAt)}</span> 
    },
  ];

  const engineerColumns = [
    { key: 'id', header: 'ID', render: (v: VendorUsage) => <span className="font-mono text-xs">{v.id}</span> },
    { key: 'vendor', header: 'Vendor' },
    { key: 'category', header: 'Category', render: (v: VendorUsage) => <span className="text-text-secondary">{v.category}</span> },
    { 
      key: 'costThisMonth', 
      header: 'Cost', 
      render: (v: VendorUsage) => <span className="font-medium">{formatCurrency(v.costThisMonth)}</span> 
    },
    { 
      key: 'change', 
      header: 'MoM', 
      render: (v: VendorUsage) => {
        const change = ((v.costThisMonth - v.costLastMonth) / v.costLastMonth * 100);
        return (
          <span className={change > 10 ? 'text-warning' : change < 0 ? 'text-success' : 'text-text-secondary'}>
            {change > 0 ? '+' : ''}{change.toFixed(1)}%
          </span>
        );
      }
    },
    { 
      key: 'nextStep', 
      header: 'Action', 
      render: (v: VendorUsage) => (
        <Button variant="ghost" size="sm" className="h-7 text-xs">
          {v.nextStep}
          <ChevronRight className="ml-1 h-3 w-3" />
        </Button>
      )
    },
  ];

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">
          <ModeText operator="Costs & Usage" engineer="Costs & Usage Analysis" />
        </h1>
        <p className="page-subtitle">
          <ModeText 
            operator="What you're spending on tools and APIs" 
            engineer="Vendor costs, API usage, and overage tracking" 
          />
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard
          title={viewMode === 'operator' ? 'Tools & Services' : 'Vendors Total'}
          value={formatCurrency(costsUsageData.toolsVendorsTotal)}
          icon={<Package className="h-4 w-4" />}
          status="info"
        />
        <KPICard
          title={viewMode === 'operator' ? 'AI & API Costs' : 'AI/API Usage'}
          value={formatCurrency(costsUsageData.aiApiTotal)}
          icon={<Cpu className="h-4 w-4" />}
          status="info"
        />
        <KPICard
          title={viewMode === 'operator' ? 'Biggest Increase' : 'Biggest Spike'}
          value={costsUsageData.biggestSpike}
          icon={<TrendingUp className="h-4 w-4" />}
          status="warning"
        />
        <KPICard
          title={viewMode === 'operator' ? 'Possible Overages' : 'Overage Exposure'}
          value={formatCurrency(costsUsageData.overageExposure)}
          icon={<AlertTriangle className="h-4 w-4" />}
          status={costsUsageData.overageExposure > 500 ? 'warning' : 'success'}
        />
        <KPICard
          title={viewMode === 'operator' ? 'Alerts' : 'Alerts Triggered'}
          value={costsUsageData.alertsTriggered}
          icon={<Bell className="h-4 w-4" />}
          status={costsUsageData.alertsTriggered > 0 ? 'warning' : 'success'}
        />
      </div>

      {/* What Needs Attention */}
      <Panel title={viewMode === 'operator' ? 'What Needs Attention' : 'Action Items'}>
        <div className="space-y-3">
          {costsUsageData.attentionItems.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-1 border border-border">
              <div className="flex-1">
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-text-secondary">{item.meaning}</p>
              </div>
              <Button variant="outline" size="sm" className="ml-4">
                {item.nextStep}
                <ChevronRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </Panel>

      {/* Vendor Table */}
      <Panel title={viewMode === 'operator' ? 'All Services' : 'Vendor Breakdown'} noPadding>
        <DataTable
          columns={viewMode === 'operator' ? operatorColumns : engineerColumns}
          data={costsUsageData.vendors}
          keyExtractor={(v) => v.id}
          onRowClick={(v) => setSelectedVendor(v)}
        />
      </Panel>

      {/* Connect Bank Feed Card */}
      <Card className="p-6 border-dashed border-2 border-border bg-surface-1/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <Link2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-medium">
                <ModeText operator="Connect Your Bank" engineer="Connect Bank Feed (Plaid/Sequence)" />
              </h3>
              <p className="text-sm text-text-secondary">
                <ModeText 
                  operator="Automatically sync your expenses" 
                  engineer="Real-time expense sync via Plaid or Sequence integration" 
                />
              </p>
            </div>
          </div>
          <Button variant="outline" disabled>
            <CreditCard className="mr-2 h-4 w-4" />
            Coming Soon
          </Button>
        </div>
      </Card>

      {/* Details Sheet */}
      <Sheet open={!!selectedVendor} onOpenChange={() => setSelectedVendor(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{selectedVendor?.vendor}</SheetTitle>
            <SheetDescription>
              {selectedVendor?.category}
            </SheetDescription>
          </SheetHeader>
          {selectedVendor && (
            <div className="mt-6 space-y-6">
              <div className="p-4 rounded-lg bg-surface-1 border border-border">
                <p className="text-sm text-text-secondary mb-2">This Month</p>
                <p className="text-2xl font-semibold">{formatCurrency(selectedVendor.costThisMonth)}</p>
                <p className="text-xs text-text-tertiary mt-1">
                  vs {formatCurrency(selectedVendor.costLastMonth)} last month
                </p>
              </div>

              <div>
                <p className="text-sm font-medium mb-3">
                  <ModeText operator="Usage Meters" engineer="Usage Metrics" />
                </p>
                <div className="space-y-4">
                  {selectedVendor.usage.map((meter, idx) => (
                    <div key={idx} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>{meter.metric}</span>
                        <span className="font-medium">
                          {meter.current.toLocaleString()} / {meter.limit?.toLocaleString() || '∞'} {meter.unit}
                        </span>
                      </div>
                      {meter.limit && (
                        <Progress 
                          value={(meter.current / meter.limit) * 100} 
                          className="h-2"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {selectedVendor.overageRules && (
                <ModeDetails
                  summary={
                    <p className="text-sm font-medium">Overage Rules</p>
                  }
                  details={
                    <p className="text-sm text-text-secondary">{selectedVendor.overageRules}</p>
                  }
                />
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
