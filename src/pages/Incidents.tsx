import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
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
import { CopyableId } from '@/components/shared/CopyableId';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { AlertTriangle, Sparkles, CheckCircle, Shield, GitBranch } from 'lucide-react';

export default function Incidents() {
  const { viewMode } = useSystem();
  const { data: incidents, loading: incidentsLoading, error: incidentsError, refetch: refetchIncidents } = useUnifiedIncidents();
  const [searchParams] = useSearchParams();
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [analysisDialog, setAnalysisDialog] = useState<Incident | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const { copiedId, copyToClipboard } = useCopyToClipboard();

  if (incidentsLoading) return <PageLoadingState showKPIs rows={5} />;
  if (incidentsError) return <EmptyState variant="error" title="Failed to load incidents" description={incidentsError} actionLabel="Retry" onAction={refetchIncidents} />;

  // Apply source filter globally (affects stats, actions, insights, AND table)
  const sourceFiltered = sourceFilter === 'all'
    ? incidents
    : incidents.filter(i => deriveSourceCategory(i.receiptType ?? '') === sourceFilter);

  const openIncidents = sourceFiltered.filter(i => i.status === 'Open');
  const resolvedIncidents = sourceFiltered.filter(i => i.status === 'Resolved');

  // Build priority actions from open incidents
  const priorityActions: ActionItem[] = openIncidents.map(i => ({
    id: i.id,
    title: i.summary,
    description: `${i.severity} • ${i.customer}`,
    urgency: i.severity === 'P0' ? 'critical' as const : i.severity === 'P1' ? 'high' as const : 'medium' as const,
    linkTo: `/incidents?id=${i.id}`,
    linkLabel: 'Investigate',
  }));

  // Quick stats
  const quickStats = [
    { label: 'open', value: openIncidents.length, status: openIncidents.length > 0 ? 'warning' as const : 'success' as const },
    { label: 'critical (P0)', value: openIncidents.filter(i => i.severity === 'P0').length, status: 'critical' as const },
    { label: 'resolved this week', value: resolvedIncidents.length, status: 'success' as const },
  ];

  // Detection source breakdown for insight
  const sourceBreakdown = openIncidents.reduce((acc, i) => {
    acc[i.detectionSource] = (acc[i.detectionSource] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const topSource = Object.entries(sourceBreakdown).sort((a, b) => b[1] - a[1])[0];

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
      header: 'What happened',
      className: 'max-w-xs',
      render: (i: Incident) => (
        <div className="flex items-center gap-2">
          <span className="truncate">{i.summary}</span>
          {(i.occurrenceCount ?? 0) > 1 && <OccurrenceBadge count={i.occurrenceCount ?? 0} />}
        </div>
      ),
    },
    { key: 'customer', header: "Who's affected" },
  ] : [
    { key: 'id', header: 'ID', render: (i: Incident) => <CopyableId fullId={i.id} displayId={formatIncidentId(i.id)} isCopied={copiedId === i.id} onCopy={copyToClipboard} /> },
    { key: 'severity', header: 'Sev', render: (i: Incident) => <SeverityBadge severity={i.severity} /> },
    {
      key: 'status',
      header: 'Status',
      render: (i: Incident) => <StatusChip status={i.status === 'Open' ? 'warning' : 'success'} label={i.status} />
    },
    {
      key: 'source',
      header: 'Source',
      render: (i: Incident) => <SourceBadge source={deriveSourceCategory(i.receiptType ?? '')} />,
    },
    {
      key: 'summary',
      header: 'Summary',
      className: 'max-w-xs',
      render: (i: Incident) => (
        <div className="flex items-center gap-2">
          <span className="truncate">{i.summary}</span>
          {(i.occurrenceCount ?? 0) > 1 && <OccurrenceBadge count={i.occurrenceCount ?? 0} />}
        </div>
      ),
    },
    { key: 'customer', header: 'Customer' },
    { key: 'provider', header: 'Provider' },
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
          : "Monitor and manage system incidents"}
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
          headline={topSource ? `Most issues from ${topSource[0].replace('_', ' ')}` : "No pattern detected"}
          subtext={topSource ? `${topSource[1]} incidents this week` : "Issues are evenly distributed"}
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

      {/* Source Filter */}
      <div className="flex items-center gap-3">
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[160px]">
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
          {selectedIncident && (
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

              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs text-muted-foreground mb-1">What happened</p>
                <p className="text-sm">{selectedIncident.summary}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/50 border border-border">
                  <p className="text-xs text-muted-foreground mb-1">Who's affected</p>
                  <p className="text-sm">{selectedIncident.customer}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border border-border">
                  <p className="text-xs text-muted-foreground mb-1">Provider</p>
                  <p className="text-sm">{selectedIncident.provider}</p>
                </div>
              </div>

              {selectedIncident.firstSeen && selectedIncident.lastSeen && (
                <div className="p-3 rounded-lg bg-muted/50 border border-border">
                  <p className="text-xs text-muted-foreground mb-1">Time range</p>
                  <p className="text-sm">
                    {new Date(selectedIncident.firstSeen).toLocaleDateString()} - {new Date(selectedIncident.lastSeen).toLocaleDateString()}
                  </p>
                </div>
              )}

              {selectedIncident.recommendedAction && (
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
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
          )}
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
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-sm">
                <strong>Summary:</strong> {analysisDialog?.summary}
              </p>
              <p className="text-sm mt-2 text-muted-foreground">
                This appears to be a {analysisDialog?.severity} issue affecting {analysisDialog?.customer}.
                Based on similar incidents, the recommended action is to check the {analysisDialog?.provider} integration.
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
