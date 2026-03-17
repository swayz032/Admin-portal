import { useState, useEffect } from 'react';
import { PageHero } from '@/components/shared/PageHero';
import { QuickStats } from '@/components/shared/QuickStats';
import { Panel } from '@/components/shared/Panel';
import { StatusChip } from '@/components/shared/StatusChip';
import { SeverityBadge } from '@/components/shared/SeverityBadge';
import { PageLoadingState } from '@/components/shared/PageLoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { useSystem } from '@/contexts/SystemContext';
import { fetchN8nIncidents, type N8nIncidentGroup } from '@/services/apiClient';
import { formatTimeAgo } from '@/lib/formatters';
import { Workflow, AlertTriangle, CheckCircle, Clock, Bot, Wrench } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function N8nOperations() {
  const { viewMode } = useSystem();
  const [incidents, setIncidents] = useState<N8nIncidentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<N8nIncidentGroup | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await fetchN8nIncidents();
      setIncidents(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load n8n data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) return <PageLoadingState showKPIs kpiCount={4} rows={8} />;
  if (error) return <EmptyState variant="error" title="Failed to load n8n operations" description={error} actionLabel="Retry" onAction={fetchData} />;

  const activeIncidents = incidents.filter(i => i.isActive);
  const stoppedIncidents = incidents.filter(i => !i.isActive);
  const totalFailures = incidents.reduce((sum, i) => sum + i.count, 0);
  const agentFailures = incidents.filter(i => i.receiptType === 'n8n_agent');
  const opsFailures = incidents.filter(i => i.receiptType === 'n8n_ops');
  const uniqueAgents = new Set(agentFailures.map(i => i.agent));

  const quickStats = [
    { label: 'active failures', value: activeIncidents.length, status: activeIncidents.length > 0 ? 'critical' as const : 'success' as const },
    { label: 'total failures', value: totalFailures.toLocaleString(), status: 'warning' as const },
    { label: 'agents affected', value: uniqueAgents.size, status: uniqueAgents.size > 0 ? 'warning' as const : 'success' as const },
    { label: 'ops workflows down', value: opsFailures.filter(i => i.isActive).length, status: 'critical' as const },
  ];

  const agentIcon = (agent: string) => {
    switch (agent.toLowerCase()) {
      case 'adam': return '🔍';
      case 'sarah': return '📞';
      case 'eli': return '📧';
      case 'nora': return '🎥';
      case 'quinn': return '💳';
      case 'teressa': return '📊';
      case 'sre': return '🛡️';
      case 'system': return '⚙️';
      default: return '🤖';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHero
        title={activeIncidents.length === 0
          ? 'n8n Workflows Healthy'
          : `${activeIncidents.length} n8n Workflow${activeIncidents.length !== 1 ? 's' : ''} Failing`}
        subtitle={viewMode === 'operator'
          ? 'Background automations and agent scheduled tasks'
          : 'n8n workflow execution health — ops and agent pipelines'}
        icon={<Workflow className="h-6 w-6" />}
        status={activeIncidents.length === 0
          ? { type: 'success', label: 'All running' }
          : { type: 'critical', label: `${activeIncidents.length} active` }}
      />

      <QuickStats stats={quickStats} />

      {/* Active Failures — RED section */}
      {activeIncidents.length > 0 && (
        <Panel
          title="Active Failures"
          subtitle={`${activeIncidents.length} workflows failing right now`}
        >
          <div className="divide-y divide-border">
            {activeIncidents.map((incident) => (
              <button
                key={incident.actionType}
                className="w-full text-left p-4 hover:bg-muted/50 transition-colors flex items-start gap-4"
                onClick={() => setSelectedIncident(incident)}
              >
                <div className="text-2xl flex-shrink-0 mt-0.5">{agentIcon(incident.agent)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <SeverityBadge severity={incident.severity} />
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      ACTIVE
                    </span>
                    <span className="text-xs text-muted-foreground ml-auto font-mono">
                      {incident.count.toLocaleString()} failures
                    </span>
                  </div>
                  <p className="text-sm font-medium text-foreground leading-snug">{incident.summary}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Bot className="h-3 w-3" />{incident.agent}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Last: {formatTimeAgo(incident.latestFailure)}</span>
                    <span className="flex items-center gap-1"><Wrench className="h-3 w-3" />{incident.receiptType}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Panel>
      )}

      {/* Stopped Failures — historical */}
      {stoppedIncidents.length > 0 && (
        <Panel
          title="Resolved / Stopped"
          subtitle={`${stoppedIncidents.length} workflows that previously failed but stopped`}
        >
          <div className="divide-y divide-border">
            {stoppedIncidents.map((incident) => (
              <button
                key={incident.actionType}
                className="w-full text-left p-4 hover:bg-muted/50 transition-colors flex items-start gap-4 opacity-70"
                onClick={() => setSelectedIncident(incident)}
              >
                <div className="text-2xl flex-shrink-0 mt-0.5">{agentIcon(incident.agent)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <SeverityBadge severity={incident.severity} />
                    <StatusChip status="success" label="Stopped" />
                    <span className="text-xs text-muted-foreground ml-auto font-mono">
                      {incident.count.toLocaleString()} total
                    </span>
                  </div>
                  <p className="text-sm font-medium text-foreground leading-snug">{incident.summary}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Bot className="h-3 w-3" />{incident.agent}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Last: {formatTimeAgo(incident.latestFailure)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Panel>
      )}

      {incidents.length === 0 && (
        <EmptyState
          variant="success"
          title="All n8n workflows healthy"
          description="No failed workflow executions detected."
        />
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedIncident} onOpenChange={() => setSelectedIncident(null)}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              {selectedIncident && <span className="text-xl">{agentIcon(selectedIncident.agent)}</span>}
              Workflow Failure Details
            </DialogTitle>
          </DialogHeader>
          {selectedIncident && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <SeverityBadge severity={selectedIncident.severity} />
                {selectedIncident.isActive ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    ACTIVE
                  </span>
                ) : (
                  <StatusChip status="success" label="Stopped" />
                )}
              </div>

              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">What's Happening</p>
                <p className="text-sm leading-relaxed">{selectedIncident.summary}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/50 border border-border">
                  <p className="text-xs text-muted-foreground mb-1">Agent</p>
                  <p className="text-sm font-medium">{selectedIncident.agent}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border border-border">
                  <p className="text-xs text-muted-foreground mb-1">Total Failures</p>
                  <p className="text-sm font-mono font-medium">{selectedIncident.count.toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border border-border">
                  <p className="text-xs text-muted-foreground mb-1">First Seen</p>
                  <p className="text-sm">{formatTimeAgo(selectedIncident.earliestFailure)}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border border-border">
                  <p className="text-xs text-muted-foreground mb-1">Last Seen</p>
                  <p className="text-sm">{formatTimeAgo(selectedIncident.latestFailure)}</p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Recommended Action</p>
                <p className="text-sm text-primary leading-relaxed">{selectedIncident.recommendedAction}</p>
              </div>

              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs text-muted-foreground mb-1">Workflow ID</p>
                <p className="text-xs font-mono text-muted-foreground">{selectedIncident.actionType}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
