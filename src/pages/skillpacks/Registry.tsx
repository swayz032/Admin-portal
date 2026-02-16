import { useState } from 'react';
import { Panel } from '@/components/shared/Panel';
import { KPICard } from '@/components/shared/KPICard';
import { DataTable } from '@/components/shared/DataTable';
import { ModeText } from '@/components/shared/ModeText';
import { StatusChip } from '@/components/shared/StatusChip';
import { useSystem } from '@/contexts/SystemContext';
// TODO: Remove seed type import once SkillPackData from apiClient fully replaces SkillPack
import type { SkillPack } from '@/data/businessSeed';
import { useSkillPackRegistry } from '@/hooks/useAdminData';
import type { SkillPackData } from '@/services/apiClient';
import { PageLoadingState } from '@/components/shared/PageLoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatTimeAgo } from '@/lib/formatters';
import {
  Package,
  CheckCircle,
  Clock,
  AlertTriangle,
  ChevronRight,
  Shield,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

export default function SkillPackRegistry() {
  const { viewMode, systemState } = useSystem();
  const [selectedPack, setSelectedPack] = useState<SkillPackData | null>(null);

  // Production data hook
  const { data, loading, error, count, refetch } = useSkillPackRegistry();

  if (loading) return <PageLoadingState showKPIs kpiCount={5} rows={5} />;
  if (error) return <EmptyState variant="error" title="Failed to load skill pack registry" description={error} actionLabel="Retry" onAction={refetch} />;
  if (!data || data.length === 0) return <EmptyState variant="no-data" title="No skill packs found" description="Skill pack data will appear once agents begin executing receipts." />;

  // Compute KPIs from data array
  const totalPacks = data.length;
  const enabledPacks = data.filter(p => p.status === 'active').length;
  const pausedPacks = data.filter(p => p.status === 'paused').length;
  const redTierPacks = data.filter(p => p.riskTier === 'RED').length;
  const yellowTierPacks = data.filter(p => p.riskTier === 'YELLOW').length;

  const getRiskTierStatus = (tier: SkillPackData['riskTier']) => {
    switch (tier) {
      case 'GREEN': return 'success';
      case 'YELLOW': return 'warning';
      case 'RED': return 'critical';
      default: return 'neutral';
    }
  };

  const getStatusType = (status: SkillPackData['status']) => {
    switch (status) {
      case 'active': return 'success';
      case 'paused': return 'pending';
      case 'disabled': return 'critical';
      default: return 'neutral';
    }
  };

  const operatorColumns = [
    {
      key: 'name',
      header: 'Staff Member',
      render: (p: SkillPackData) => (
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <span className="font-medium">{p.name}</span>
        </div>
      )
    },
    {
      key: 'category',
      header: 'Type',
      render: (p: SkillPackData) => (
        <Badge variant="outline" className="capitalize">{p.category}</Badge>
      )
    },
    {
      key: 'status',
      header: 'Status',
      render: (p: SkillPackData) => (
        <StatusChip status={getStatusType(p.status)} label={p.status} />
      )
    },
    {
      key: 'successRate',
      header: 'Success Rate',
      render: (p: SkillPackData) => (
        <span className={p.successRate > 95 ? 'text-success' : p.successRate > 90 ? 'text-warning' : 'text-destructive'}>
          {p.successRate}%
        </span>
      )
    },
    {
      key: 'executionCount',
      header: 'Executions',
      render: (p: SkillPackData) => <span>{p.executionCount.toLocaleString()}</span>
    },
  ];

  const engineerColumns = [
    { key: 'id', header: 'Pack ID', render: (p: SkillPackData) => <span className="font-mono text-xs">{p.id}</span> },
    {
      key: 'name',
      header: 'Name',
      render: (p: SkillPackData) => (
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <span>{p.name}</span>
        </div>
      )
    },
    { key: 'category', header: 'Category', render: (p: SkillPackData) => <span className="capitalize">{p.category}</span> },
    {
      key: 'riskTier',
      header: 'Risk Tier',
      render: (p: SkillPackData) => (
        <StatusChip status={getRiskTierStatus(p.riskTier)} label={p.riskTier} />
      )
    },
    {
      key: 'status',
      header: 'Status',
      render: (p: SkillPackData) => (
        <StatusChip
          status={getStatusType(p.status)}
          label={p.status}
        />
      )
    },
    {
      key: 'executionCount',
      header: 'Executions',
      render: (p: SkillPackData) => <span>{p.executionCount.toLocaleString()}</span>
    },
  ];

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">
          <ModeText operator="Your Staff (Skill Packs)" engineer="Skill Pack Registry" />
        </h1>
        <p className="page-subtitle">
          <ModeText
            operator="Meet your automated team members"
            engineer="Agent registry with governance, pricing, and autonomy configuration"
          />
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard
          title={viewMode === 'operator' ? 'Total Staff' : 'Total Packs'}
          value={totalPacks}
          icon={<Package className="h-4 w-4" />}
          status="info"
        />
        <KPICard
          title={viewMode === 'operator' ? 'Active Staff' : 'Enabled Packs'}
          value={enabledPacks}
          icon={<CheckCircle className="h-4 w-4" />}
          status="success"
        />
        <KPICard
          title={viewMode === 'operator' ? 'Paused' : 'Paused Packs'}
          value={pausedPacks}
          icon={<Clock className="h-4 w-4" />}
          status={pausedPacks > 0 ? 'warning' : 'success'}
        />
        <KPICard
          title={viewMode === 'operator' ? 'High Risk' : 'RED Tier Packs'}
          value={redTierPacks}
          icon={<AlertTriangle className="h-4 w-4" />}
          status={redTierPacks > 0 ? 'warning' : 'success'}
        />
        <KPICard
          title={viewMode === 'operator' ? 'Needs Review' : 'YELLOW Tier Packs'}
          value={yellowTierPacks}
          icon={<Shield className="h-4 w-4" />}
          status={yellowTierPacks > 0 ? 'warning' : 'success'}
        />
      </div>

      {/* Skill Pack Table */}
      <Panel title={viewMode === 'operator' ? 'Your Team' : 'All Skill Packs'} noPadding>
        <DataTable
          columns={viewMode === 'operator' ? operatorColumns : engineerColumns}
          data={data}
          keyExtractor={(p) => p.id}
          onRowClick={(p) => setSelectedPack(p)}
        />
      </Panel>

      {/* Details Sheet */}
      <Sheet open={!!selectedPack} onOpenChange={() => setSelectedPack(null)}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              {selectedPack?.name}
            </SheetTitle>
            <SheetDescription>
              {selectedPack?.agent} &middot; {selectedPack?.category}
            </SheetDescription>
          </SheetHeader>
          {selectedPack && (
            <div className="mt-6 space-y-6">
              {/* Status & Category */}
              <div className="flex items-center gap-2">
                <StatusChip
                  status={getStatusType(selectedPack.status)}
                  label={selectedPack.status}
                />
                <Badge variant="outline" className="capitalize">{selectedPack.category}</Badge>
                <StatusChip
                  status={getRiskTierStatus(selectedPack.riskTier)}
                  label={selectedPack.riskTier}
                />
              </div>

              {/* Pack ID (Engineer only) */}
              {viewMode === 'engineer' && (
                <div className="p-3 rounded-lg bg-surface-1 border border-border">
                  <p className="text-xs text-text-secondary mb-1">Pack ID</p>
                  <p className="font-mono text-sm">{selectedPack.id}</p>
                </div>
              )}

              {/* Execution Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-surface-1 border border-border">
                  <p className="text-xs text-text-secondary mb-1">
                    <ModeText operator="Total Actions" engineer="Execution Count" />
                  </p>
                  <p className="text-lg font-semibold">{selectedPack.executionCount.toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-lg bg-surface-1 border border-border">
                  <p className="text-xs text-text-secondary mb-1">
                    <ModeText operator="Success Rate" engineer="Success Rate" />
                  </p>
                  <p className={`text-lg font-semibold ${selectedPack.successRate > 95 ? 'text-success' : selectedPack.successRate > 90 ? 'text-warning' : 'text-destructive'}`}>
                    {selectedPack.successRate}%
                  </p>
                </div>
              </div>

              {/* Avg Latency (Engineer only) */}
              {viewMode === 'engineer' && (
                <div className="p-3 rounded-lg bg-surface-1 border border-border">
                  <p className="text-xs text-text-secondary mb-1">Avg Latency</p>
                  <p className="text-sm">{selectedPack.avgLatency}ms</p>
                </div>
              )}

              {/* Last Execution */}
              {selectedPack.lastExecution && (
                <p className="text-xs text-text-tertiary">
                  Last executed {formatTimeAgo(selectedPack.lastExecution)}
                </p>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
