import { useState } from 'react';
import { Panel } from '@/components/shared/Panel';
import { KPICard } from '@/components/shared/KPICard';
import { DataTable } from '@/components/shared/DataTable';
import { ModeText } from '@/components/shared/ModeText';
import { ModeDetails } from '@/components/shared/ModeDetails';
import { useSystem } from '@/contexts/SystemContext';
import type { CostCategory } from '@/data/businessSeed';
import { useRunwayBurn } from '@/hooks/useAdminData';
import { PageLoadingState } from '@/components/shared/PageLoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatCurrency, formatTimeAgo } from '@/lib/formatters';
import { 
  DollarSign, 
  Clock, 
  Wallet, 
  TrendingUp, 
  AlertCircle,
  ChevronRight,
  Calculator,
  Sliders
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { 
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

export default function RunwayBurn() {
  const { viewMode } = useSystem();
  const [selectedCategory, setSelectedCategory] = useState<CostCategory | null>(null);

  // Production data hook
  const { data: runwayBurnData, loading, error, refetch } = useRunwayBurn();

  // Scenario planner state
  const [devSpend, setDevSpend] = useState(28000);
  const [marketingSpend, setMarketingSpend] = useState(8500);
  const [legalCpa, setLegalCpa] = useState(3800);
  const [apiCosts, setApiCosts] = useState(5200);
  const [customerCount, setCustomerCount] = useState(50);

  if (loading) return <PageLoadingState showKPIs kpiCount={5} rows={5} />;
  if (error) return <EmptyState variant="error" title="Failed to load financial data" description={error} actionLabel="Retry" onAction={refetch} />;
  if (!runwayBurnData) return <EmptyState variant="no-data" title="No financial data yet" description="Runway and burn data will appear once billing connections are configured." />;

  const getOperatorStatus = (changePercent: number) => {
    if (changePercent > 10) return 'Needs attention';
    if (changePercent > 5) return 'Growing';
    if (changePercent < -5) return 'Decreasing';
    return 'Done';
  };

  const scenarioBurn = devSpend + marketingSpend + legalCpa + apiCosts + 2000; // +2000 for misc
  const scenarioRunway = runwayBurnData.cashOnHand / scenarioBurn;
  const revenuePerCustomer = 250; // avg
  const projectedRevenue = customerCount * revenuePerCustomer;
  const grossMargin = projectedRevenue > 0 ? ((projectedRevenue - scenarioBurn) / projectedRevenue * 100) : 0;
  const costPerAction = scenarioBurn / (customerCount * 100); // assume 100 actions per customer

  const operatorColumns = [
    { key: 'category', header: 'Category' },
    { 
      key: 'thisMonth', 
      header: 'This Month', 
      render: (c: CostCategory) => <span className="font-medium">{formatCurrency(c.thisMonth)}</span> 
    },
    { key: 'meaning', header: 'What This Is' },
    { 
      key: 'nextStep', 
      header: 'Next Step', 
      render: (c: CostCategory) => (
        <Button variant="ghost" size="sm" className="h-7 text-xs">
          {c.nextStep}
          <ChevronRight className="ml-1 h-3 w-3" />
        </Button>
      )
    },
    { 
      key: 'updatedAt', 
      header: 'Updated', 
      render: (c: CostCategory) => <span className="text-text-secondary text-xs">{formatTimeAgo(c.updatedAt)}</span> 
    },
  ];

  const engineerColumns = [
    { key: 'id', header: 'ID', render: (c: CostCategory) => <span className="font-mono text-xs">{c.id}</span> },
    { key: 'category', header: 'Category' },
    { 
      key: 'thisMonth', 
      header: 'This Month', 
      render: (c: CostCategory) => <span className="font-medium">{formatCurrency(c.thisMonth)}</span> 
    },
    { 
      key: 'change', 
      header: 'Change', 
      render: (c: CostCategory) => {
        const change = c.lastMonth !== 0 ? ((c.thisMonth - c.lastMonth) / c.lastMonth * 100) : 0;
        return (
          <span className={change > 0 ? 'text-warning' : 'text-success'}>
            {change > 0 ? '+' : ''}{change.toFixed(1)}%
          </span>
        );
      }
    },
    { key: 'meaning', header: 'Description' },
    { 
      key: 'nextStep', 
      header: 'Action', 
      render: (c: CostCategory) => (
        <Button variant="ghost" size="sm" className="h-7 text-xs">
          {c.nextStep}
          <ChevronRight className="ml-1 h-3 w-3" />
        </Button>
      )
    },
  ];

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">
          <ModeText operator="Runway & Burn" engineer="Runway & Burn Analysis" />
        </h1>
        <p className="page-subtitle">
          <ModeText 
            operator="How long your money will last" 
            engineer="Cash flow analysis and scenario planning" 
          />
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard
          title={viewMode === 'operator' ? 'Monthly Spending' : 'Monthly Burn'}
          value={formatCurrency(runwayBurnData.monthlyBurn)}
          icon={<DollarSign className="h-4 w-4" />}
          status="info"
        />
        <KPICard
          title="Runway"
          value={`${runwayBurnData.runway.toFixed(1)} months`}
          icon={<Clock className="h-4 w-4" />}
          status={runwayBurnData.runway < 12 ? 'warning' : 'success'}
        />
        <KPICard
          title={viewMode === 'operator' ? 'Cash Available' : 'Cash on Hand'}
          value={formatCurrency(runwayBurnData.cashOnHand)}
          icon={<Wallet className="h-4 w-4" />}
          status="success"
        />
        <KPICard
          title={viewMode === 'operator' ? 'Biggest Cost' : 'Top Cost Driver'}
          value={runwayBurnData.biggestCostDriver}
          icon={<TrendingUp className="h-4 w-4" />}
          status="info"
        />
        <KPICard
          title={viewMode === 'operator' ? 'Change This Month' : 'Burn Change MoM'}
          value={`+${runwayBurnData.burnChangePercent}%`}
          icon={<AlertCircle className="h-4 w-4" />}
          status="warning"
        />
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">
            <ModeText operator="Overview" engineer="Cost Overview" />
          </TabsTrigger>
          <TabsTrigger value="planner">
            <Calculator className="h-4 w-4 mr-2" />
            <ModeText operator="Plan Ahead" engineer="Scenario Planner" />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          {/* Cost Categories Table */}
          <Panel title={viewMode === 'operator' ? 'Cost Breakdown' : 'Cost Categories'} noPadding>
            <DataTable
              columns={viewMode === 'operator' ? operatorColumns : engineerColumns}
              data={(runwayBurnData.costCategories ?? []) as CostCategory[]}
              keyExtractor={(c) => c.id}
              onRowClick={(c) => setSelectedCategory(c)}
            />
          </Panel>
        </TabsContent>

        <TabsContent value="planner" className="space-y-6 mt-6">
          {/* Scenario Presets */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => {
                setDevSpend(20000);
                setMarketingSpend(3000);
                setLegalCpa(2000);
                setApiCosts(3000);
                setCustomerCount(40);
              }}
              className="p-4 rounded-xl bg-surface-1 border border-border hover:border-success/50 hover:bg-success/5 transition-all group text-left"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-success" />
                <span className="font-semibold">Conservative</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {viewMode === 'operator' 
                  ? 'Minimal spending, longest runway. Best for uncertain times.'
                  : 'Min burn rate, max runway. $28k/mo burn target.'}
              </p>
            </button>

            <button
              onClick={() => {
                setDevSpend(28000);
                setMarketingSpend(8500);
                setLegalCpa(3800);
                setApiCosts(5200);
                setCustomerCount(50);
              }}
              className="p-4 rounded-xl bg-surface-1 border border-primary/30 hover:border-primary/60 hover:bg-primary/5 transition-all group text-left ring-2 ring-primary/20"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-primary" />
                <span className="font-semibold">Balanced</span>
                <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">Current</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {viewMode === 'operator' 
                  ? 'Moderate growth investment. Good balance of speed and runway.'
                  : 'Current allocation. ~$45k/mo burn, 18mo runway.'}
              </p>
            </button>

            <button
              onClick={() => {
                setDevSpend(45000);
                setMarketingSpend(20000);
                setLegalCpa(5000);
                setApiCosts(10000);
                setCustomerCount(100);
              }}
              className="p-4 rounded-xl bg-surface-1 border border-border hover:border-warning/50 hover:bg-warning/5 transition-all group text-left"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-warning" />
                <span className="font-semibold">Aggressive</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {viewMode === 'operator' 
                  ? 'Fast growth mode. Shorter runway but faster customer acquisition.'
                  : 'Max growth. ~$80k/mo burn, 10mo runway.'}
              </p>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Inputs */}
            <Panel title={viewMode === 'operator' ? 'Fine-Tune Spending' : 'Scenario Inputs'}>
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Engineering</span>
                    <span className="font-medium">{formatCurrency(devSpend)}</span>
                  </div>
                  <Slider
                    value={[devSpend]}
                    onValueChange={([v]) => setDevSpend(v)}
                    min={10000}
                    max={50000}
                    step={1000}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Marketing</span>
                    <span className="font-medium">{formatCurrency(marketingSpend)}</span>
                  </div>
                  <Slider
                    value={[marketingSpend]}
                    onValueChange={([v]) => setMarketingSpend(v)}
                    min={0}
                    max={25000}
                    step={500}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Legal & CPA</span>
                    <span className="font-medium">{formatCurrency(legalCpa)}</span>
                  </div>
                  <Slider
                    value={[legalCpa]}
                    onValueChange={([v]) => setLegalCpa(v)}
                    min={1000}
                    max={10000}
                    step={100}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>API & Infrastructure</span>
                    <span className="font-medium">{formatCurrency(apiCosts)}</span>
                  </div>
                  <Slider
                    value={[apiCosts]}
                    onValueChange={([v]) => setApiCosts(v)}
                    min={1000}
                    max={15000}
                    step={200}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Customer Count</span>
                    <span className="font-medium">{customerCount}</span>
                  </div>
                  <Slider
                    value={[customerCount]}
                    onValueChange={([v]) => setCustomerCount(v)}
                    min={10}
                    max={500}
                    step={5}
                  />
                </div>
              </div>
            </Panel>

            {/* Outputs */}
            <Panel title={viewMode === 'operator' ? 'What This Means' : 'Scenario Outputs'}>
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-surface-1 border border-border">
                  <p className="text-xs text-text-secondary uppercase tracking-wide mb-1">
                    {viewMode === 'operator' ? 'Monthly Spending' : 'Projected Burn'}
                  </p>
                  <p className="text-2xl font-semibold">{formatCurrency(scenarioBurn)}</p>
                </div>

                <div className="p-4 rounded-lg bg-surface-1 border border-border">
                  <p className="text-xs text-text-secondary uppercase tracking-wide mb-1">
                    {viewMode === 'operator' ? 'How Long Cash Lasts' : 'Runway'}
                  </p>
                  <p className={`text-2xl font-semibold ${scenarioRunway < 12 ? 'text-warning' : 'text-success'}`}>
                    {scenarioRunway.toFixed(1)} months
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-surface-1 border border-border">
                  <p className="text-xs text-text-secondary uppercase tracking-wide mb-1">
                    {viewMode === 'operator' ? 'Profit Margin Estimate' : 'Gross Margin'}
                  </p>
                  <p className={`text-2xl font-semibold ${grossMargin < 0 ? 'text-destructive' : 'text-success'}`}>
                    {grossMargin.toFixed(1)}%
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-surface-1 border border-border">
                  <p className="text-xs text-text-secondary uppercase tracking-wide mb-1">
                    {viewMode === 'operator' ? 'Cost Per Action' : 'Cost Per Action'}
                  </p>
                  <p className="text-2xl font-semibold">{formatCurrency(costPerAction)}</p>
                </div>
              </div>
            </Panel>
          </div>
        </TabsContent>
      </Tabs>

      {/* Details Sheet */}
      <Sheet open={!!selectedCategory} onOpenChange={() => setSelectedCategory(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{selectedCategory?.category}</SheetTitle>
            <SheetDescription>
              {viewMode === 'operator' ? 'Vendor breakdown' : 'Detailed cost breakdown'}
            </SheetDescription>
          </SheetHeader>
          {selectedCategory && (
            <div className="mt-6 space-y-4">
              <div className="p-4 rounded-lg bg-surface-1 border border-border">
                <p className="text-sm text-text-secondary mb-2">This Month Total</p>
                <p className="text-2xl font-semibold">{formatCurrency(selectedCategory.thisMonth)}</p>
              </div>

              <ModeDetails
                summary={
                  <div>
                    <p className="text-sm font-medium mb-1">Vendors</p>
                    <p className="text-xs text-text-secondary">{selectedCategory.vendors.length} line items</p>
                  </div>
                }
                details={
                  <div className="space-y-2">
                    {selectedCategory.vendors.map((vendor, idx) => (
                      <div key={idx} className="flex justify-between items-center p-2 rounded bg-surface-2">
                        <div>
                          <p className="text-sm">{vendor.name}</p>
                          <p className="text-xs text-text-tertiary">{vendor.type}</p>
                        </div>
                        <span className="font-medium">{formatCurrency(vendor.amount)}</span>
                      </div>
                    ))}
                  </div>
                }
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
