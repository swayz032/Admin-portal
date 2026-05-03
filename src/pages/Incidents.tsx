import { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { PageHero } from '@/components/shared/PageHero';
import { QuickStats } from '@/components/shared/QuickStats';
import { WhatToDoSection, ActionItem } from '@/components/shared/WhatToDoSection';
import { InsightPanel } from '@/components/shared/InsightPanel';
import { Panel } from '@/components/shared/Panel';
import { DataTable } from '@/components/shared/DataTable';
import { StatusChip } from '@/components/shared/StatusChip';
import { SeverityBadge } from '@/components/shared/SeverityBadge';
import { SourceBadge, deriveSourceCategory } from '@/components/shared/SourceBadge';
import { OccurrenceBadge } from '@/components/shared/OccurrenceBadge';
import { ModeText } from '@/components/shared/ModeText';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useSystem } from '@/contexts/SystemContext';
import type { Incident } from '@/data/seed';
import { useUnifiedIncidents } from '@/hooks/useUnifiedIncidents';
import { PageLoadingState } from '@/components/shared/PageLoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatTimeAgo } from '@/lib/formatters';
import { formatIncidentId } from '@/lib/premiumIds';
import { deriveCategoryFromReceiptType } from '@/services/apiClient';
import { CopyableId } from '@/components/shared/CopyableId';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import {
  buildSourceBreakdown,
  classifyIncident,
  customerLabel,
  explainIncident,
  humanizeToken,
} from '@/lib/storyTriage';
import { AlertTriangle, Sparkles, CheckCircle, Shield, GitBranch, List, Layers } from 'lucide-react';

// Category type for data-driven tabs
interface CategoryDef {
  id: string;
  label: string;
  count: number;
  filter: (i: Incident) => boolean;
}

export default function Incidents() {
  const { viewMode } = useSystem();
  const [viewType, setViewType] = useState<'grouped' | 'all'>('all');
  const filters = useMemo(() => ({ view: viewType }), [viewType]);
  const { data: incidents, loading: incidentsLoading, error: incidentsError, refetch: refetchIncidents } = useUnifiedIncidents(filters);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [analysisDialog, setAnalysisDialog] = useState<Incident | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [categoryTab, setCategoryTab] = useState<string>('all');
  const { copiedId, copyToClipboard } = useCopyToClipboard();

  // Build categories dynamically from actual receipt_type distribution
  const dynamicCategories: CategoryDef[] = useMemo(() => {
    const catMap = new Map<string, { label: string; count: number }>();
    for (const i of incidents) {
      const cat = deriveCategoryFromReceiptType(i.receiptType ?? '');
      const existing = catMap.get(cat.id);
      if (existing) existing.count++;
      else catMap.set(cat.id, { label: cat.label, count: 1 });
    }
    const sorted = [...catMap.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .map(([id, { label, count }]) => ({
        id,
        label,
        count,
        filter: (inc: Incident) => deriveCategoryFromReceiptType(inc.receiptType ?? '').id === id,
      }));
    return [
      { id: 'all', label: 'All', count: incidents.length, filter: () => true },
      ...sorted,
    ];
  }, [incidents]);

  // Memoize all derived data to prevent render-body recomputation cascades
  const categoryDef = useMemo(
    () => dynamicCategories.find(c => c.id === categoryTab) ?? dynamicCategories[0],
    [dynamicCategories, categoryTab],
  );
  const categoryFiltered = useMemo(
    () => incidents.filter(categoryDef.filter),
    [incidents, categoryDef],
  );
  const severityCounts = useMemo(() => ({
    P0: categoryFiltered.filter(i => i.severity === 'P0').length,
    P1: categoryFiltered.filter(i => i.severity === 'P1').length,
    P2: categoryFiltered.filter(i => i.severity === 'P2').length,
    P3: categoryFiltered.filter(i => i.severity === 'P3').length,
  }), [categoryFiltered]);
  const sourceFiltered = useMemo(
    () => sourceFilter === 'all'
      ? categoryFiltered
      : categoryFiltered.filter(i => deriveSourceCategory(i.receiptType ?? '') === sourceFilter),
    [categoryFiltered, sourceFilter],
  );
  const openIncidents = useMemo(() => sourceFiltered.filter(i => i.status === 'Open'), [sourceFiltered]);
  const resolvedIncidents = useMemo(() => sourceFiltered.filter(i => i.status === 'Resolved'), [sourceFiltered]);

  if (incidentsLoading) return <PageLoadingState showKPIs rows={5} />;
  if (incidentsError) return <EmptyState variant="error" title="Failed to load incidents" description={incidentsError} actionLabel="Retry" onAction={refetchIncidents} />;

  // Build priority actions from open incidents
  const priorityActions: ActionItem[] = openIncidents.slice(0, 10).map(i => ({
    id: i.id,
    title: explainIncident(i).title,
    description: `Cause: ${explainIncident(i).cause}`,
    urgency: i.severity === 'P0' ? 'critical' as const : i.severity === 'P1' ? 'high' as const : 'medium' as const,
    linkTo: `/incidents?id=${i.id}`,
    linkLabel: 'Investigate',
  }));

  // Quick stats
  const quickStats = [
    { label: 'total failures', value: incidents.length, status: incidents.length > 0 ? 'warning' as const : 'success' as const },
    { label: 'open', value: openIncidents.length, status: openIncidents.length > 0 ? 'warning' as const : 'success' as const },
    { label: 'critical (P0)', value: openIncidents.filter(i => i.severity === 'P0').length, status: 'critical' as const },
    { label: 'resolved this week', value: resolvedIncidents.length, status: 'success' as const },
  ];

  const storySourceBreakdown = buildSourceBreakdown(openIncidents);
  const topSource = storySourceBreakdown[0];

  const columns = viewMode === 'operator' ? [
    { key: 'id', header: 'ID', render: (i: Incident) => <CopyableId fullId={i.id} displayId={formatIncidentId(i.id)} isCopied={copiedId === i.id} onCopy={copyToClipboard} /> },
    { key: 'severity', header: 'Urgency', render: (i: Incident) => <SeverityBadge severity={i.severity} /> },
    {
      key: 'status',
      header: 'Status',
      render: (i: Incident) => <StatusChip status={i.status === 'Open' ? 'warning' : 'success'} label={i.status === 'Open' ? 'Needs attention' : 'Fixed'} />
    },
    {
      key: 'source',
      header: 'Source',
      render: (i: Incident) => <SourceBadge source={deriveSourceCategory(i.receiptType ?? '')} />,
    },
    {
      key: 'summary',
      header: 'Story',
      className: 'max-w-xs',
      render: (i: Incident) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{explainIncident(i).title}</span>
            {(i.occurrenceCount ?? 0) > 1 && <OccurrenceBadge count={i.occurrenceCount ?? 0} />}
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">Cause: {explainIncident(i).cause}</p>
        </div>
      ),
    },
    { key: 'customer', header: "Who's affected", render: (i: Incident) => customerLabel(i) },
  ] : [
    { key: 'id', header: 'ID', render: (i: Incident) => <CopyableId fullId={i.id} displayId={formatIncidentId(i.id)} isCopied={copiedId === i.id} onCopy={copyToClipboard} /> },
    { key: 'severity', header: 'Sev', render: (i: Incident) => <SeverityBadge severity={i.severity} /> },
    {
      key: 'status',
      header: 'Status',
      render: (i: Incident) => <StatusChip status={i.status === 'Open' ? 'warning' : 'success'} label={i.status} />
    },
    {
      key: 'receiptType',
      header: 'Problem Type',
      render: (i: Incident) => (
        <span className="text-xs text-muted-foreground">
          {humanizeToken(i.receiptType, classifyIncident(i).sourceLabel)}
        </span>
      ),
    },
    {
      key: 'source',
      header: 'Source',
      render: (i: Incident) => <SourceBadge source={deriveSourceCategory(i.receiptType ?? '')} />,
    },
    {
      key: 'summary',
      header: 'Story',
      className: 'max-w-xs',
      render: (i: Incident) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{explainIncident(i).title}</span>
            {(i.occurrenceCount ?? 0) > 1 && <OccurrenceBadge count={i.occurrenceCount ?? 0} />}
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">Cause: {explainIncident(i).cause}</p>
        </div>
      ),
    },
    { key: 'customer', header: 'Customer', render: (i: Incident) => customerLabel(i) },
    { key: 'provider', header: 'Provider', render: (i: Incident) => classifyIncident(i).sourceLabel },
    { key: 'updatedAt', header: 'Updated', render: (i: Incident) => <span className="text-muted-foreground">{formatTimeAgo(i.updatedAt)}</span> },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Hero Section */}
      <PageHero
        title={openIncidents.length === 0
          ? "All clear!"
          : `${openIncidents.length} issue${openIncidents.length !== 1 ? 's' : ''} need your attention`}
        subtitle={viewMode === 'operator'
          ? "Track and resolve problems affecting your customers"
          : `${incidents.length} incident stories from live telemetry; ${viewType === 'all' ? 'individual events' : 'grouped by repeated cause'}`}
        icon={openIncidents.length === 0 ? <CheckCircle className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
        status={openIncidents.length === 0
          ? { type: 'success', label: 'All healthy' }
          : { type: 'warning', label: `${openIncidents.length} open` }}
      />

      {/* Quick Stats */}
      <QuickStats stats={quickStats} />

      {/* What to Do Section */}
      {priorityActions.length > 0 && (
        <WhatToDoSection
          title={viewMode === 'operator' ? "Issues to address" : "Open incidents"}
          subtitle={`${priorityActions.length} issue${priorityActions.length !== 1 ? 's' : ''} require attention`}
          actions={priorityActions}
          maxItems={5}
          emptyMessage="No open issues! Everything is running smoothly."
        />
      )}

      {/* Story Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <InsightPanel
          headline={openIncidents.length === 0 ? "System is healthy" : `${openIncidents.length} active issues`}
          subtext={openIncidents.length === 0 ? "No problems detected" : "Require your attention"}
          trend={openIncidents.length === 0 ? 'positive' : 'negative'}
          icon={<Shield className="h-5 w-5" />}
        />
        <InsightPanel
          headline={topSource ? `Most issues from ${topSource.label}` : "No pattern detected"}
          subtext={topSource ? `${topSource.realIncidents + topSource.warnings} active signal${topSource.realIncidents + topSource.warnings === 1 ? '' : 's'}` : "Issues are evenly distributed"}
          trend="neutral"
          icon={<AlertTriangle className="h-5 w-5" />}
        />
        <InsightPanel
          headline={`${resolvedIncidents.length} issues resolved`}
          subtext="This week"
          trend="positive"
          icon={<CheckCircle className="h-5 w-5" />}
          linkTo="/activity"
          linkLabel="View activity"
        />
      </div>

      {/* Category Tabs */}
      <Tabs value={categoryTab} onValueChange={setCategoryTab}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList className="flex-wrap h-auto gap-1">
            {dynamicCategories.map(cat => (
              <TabsTrigger key={cat.id} value={cat.id} className="text-xs px-3 py-1.5">
                {cat.label}
                <span className="ml-1.5 text-[10px] font-mono opacity-70">
                  ({cat.count})
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* View Toggle + Source Filter */}
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setViewType('all')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors ${
                  viewType === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted/30 text-muted-foreground hover:bg-muted/60'
                }`}
              >
                <List className="h-3.5 w-3.5" />
                All Events
              </button>
              <button
                onClick={() => setViewType('grouped')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors ${
                  viewType === 'grouped' ? 'bg-primary text-primary-foreground' : 'bg-muted/30 text-muted-foreground hover:bg-muted/60'
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                Grouped
              </button>
            </div>

            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue placeholder="All Sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="backend">Backend</SelectItem>
                <SelectItem value="desktop">Desktop</SelectItem>
                <SelectItem value="provider">Provider</SelectItem>
                <SelectItem value="orchestrator">Orchestrator</SelectItem>
                <SelectItem value="security">Security</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Tabs>

      {/* Severity Distribution Tiles */}
      {categoryFiltered.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-muted-foreground font-medium">Severity:</span>
          {([
            { key: 'P0', label: viewMode === 'operator' ? 'Critical' : 'P0', color: 'bg-red-500/15 text-red-400 border-red-500/20' },
            { key: 'P1', label: viewMode === 'operator' ? 'High' : 'P1', color: 'bg-orange-500/15 text-orange-400 border-orange-500/20' },
            { key: 'P2', label: viewMode === 'operator' ? 'Medium' : 'P2', color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20' },
            { key: 'P3', label: viewMode === 'operator' ? 'Low' : 'P3', color: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
          ] as const).map(sev => (
            <span
              key={sev.key}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium ${sev.color}`}
            >
              {sev.label}
              <span className="font-mono">{severityCounts[sev.key]}</span>
            </span>
          ))}
        </div>
      )}

      <Panel noPadding>
        <DataTable
          columns={columns}
          data={sourceFiltered}
          keyExtractor={(i: Incident) => i.id}
          onRowClick={(i) => setSelectedIncident(i)}
          emptyMessage={viewMode === 'operator' ? "No issues in this category." : "No incidents in this category."}
          resultLabel="pipeline failures"
        />
      </Panel>

      {/* Incident Detail Dialog */}
      <Dialog open={!!selectedIncident} onOpenChange={() => setSelectedIncident(null)}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {viewMode === 'operator' ? "Issue Details" : "Incident Details"}
            </DialogTitle>
          </DialogHeader>
          {selectedIncident && (() => {
            const story = explainIncident(selectedIncident);
            return (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <SeverityBadge severity={selectedIncident.severity} />
                <StatusChip
                  status={selectedIncident.status === 'Open' ? 'warning' : 'success'}
                  label={viewMode === 'operator'
                    ? (selectedIncident.status === 'Open' ? 'Needs attention' : 'Fixed')
                    : selectedIncident.status}
                />
                <SourceBadge source={deriveSourceCategory(selectedIncident.receiptType ?? '')} />
                {(selectedIncident.occurrenceCount ?? 0) > 1 && <OccurrenceBadge count={selectedIncident.occurrenceCount ?? 0} />}
              </div>

              <div className="premium-mini-card p-3">
                <p className="text-xs text-muted-foreground mb-1">What happened</p>
                <p className="text-sm">{story.title}</p>
              </div>

              <div className="premium-mini-card p-3">
                <p className="text-xs text-muted-foreground mb-1">Exact cause</p>
                <p className="text-sm">{story.cause}</p>
              </div>

              <div className="rounded-lg border border-primary/25 bg-primary/5 p-3">
                <p className="text-xs text-primary mb-1">Fix</p>
                <p className="text-sm">{story.fix}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="premium-mini-card p-3">
                  <p className="text-xs text-muted-foreground mb-1">Who's affected</p>
                  <p className="text-sm">{customerLabel(selectedIncident)}</p>
                </div>
                <div className="premium-mini-card p-3">
                  <p className="text-xs text-muted-foreground mb-1">Evidence</p>
                  <p className="text-sm">{story.evidence}</p>
                </div>
              </div>

              {selectedIncident.receiptType && (
                <div className="premium-mini-card p-3">
                  <p className="text-xs text-muted-foreground mb-1">Problem type</p>
                  <p className="text-sm">{humanizeToken(selectedIncident.receiptType, classifyIncident(selectedIncident).sourceLabel)}</p>
                </div>
              )}

              {selectedIncident.firstSeen && selectedIncident.lastSeen && (
                <div className="premium-mini-card p-3">
                  <p className="text-xs text-muted-foreground mb-1">Time range</p>
                  <p className="text-sm">
                    {new Date(selectedIncident.firstSeen).toLocaleDateString()} - {new Date(selectedIncident.lastSeen).toLocaleDateString()}
                  </p>
                </div>
              )}

              {selectedIncident.recommendedAction && (
                <div className="rounded-lg border border-primary/25 bg-primary/5 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Recommended action</p>
                  <p className="text-sm text-primary">{selectedIncident.recommendedAction}</p>
                </div>
              )}

              <div className="pt-4 border-t border-border flex gap-2 flex-wrap">
                <Button size="sm" onClick={() => setAnalysisDialog(selectedIncident)}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  <ModeText operator="Get help" engineer="Analyze" />
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link to={`/llm-ops-desk?incidentId=${selectedIncident.id}`}>
                    Talk to Ava
                  </Link>
                </Button>
                {selectedIncident.correlationId && (
                  <Button size="sm" variant="outline" asChild>
                    <Link to={`/trace/${selectedIncident.correlationId}`}>
                      <GitBranch className="h-4 w-4 mr-2" />
                      View Trace
                    </Link>
                  </Button>
                )}
              </div>
            </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Analysis Dialog */}
      <Dialog open={!!analysisDialog} onOpenChange={() => setAnalysisDialog(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              <ModeText operator="Getting Help" engineer="AI Analysis" />
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {viewMode === 'operator'
                ? "Ava is analyzing this issue to help you understand what happened and what to do next."
                : `Analyzing incident ${analysisDialog?.id} with AI assistance.`}
            </p>
            <div className="rounded-lg border border-primary/25 bg-primary/5 p-4">
              <p className="text-sm">
                <strong>Story:</strong> {analysisDialog ? explainIncident(analysisDialog).title : ''}
              </p>
              <p className="text-sm mt-2 text-muted-foreground">
                Cause: {analysisDialog ? explainIncident(analysisDialog).cause : ''}
              </p>
              <p className="text-sm mt-2 text-primary">
                Fix: {analysisDialog ? explainIncident(analysisDialog).fix : ''}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnalysisDialog(null)}>
              Close
            </Button>
            <Button asChild>
              <Link to={`/llm-ops-desk?incidentId=${analysisDialog?.id}`}>
                Continue with Ava
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
