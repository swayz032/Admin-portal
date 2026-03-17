import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSystem } from '@/contexts/SystemContext';
import { Panel } from '@/components/shared/Panel';
import { StatusChip } from '@/components/shared/StatusChip';
import { ModeText } from '@/components/shared/ModeText';
import { Button } from '@/components/ui/button';
import { PageLoadingState } from '@/components/shared/PageLoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { fetchOpsTrace, type OpsTraceResponse, type OpsTraceEvent } from '@/services/opsFacadeClient';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  AlertTriangle,
  Zap,
  Monitor,
  Copy,
  Check,
} from 'lucide-react';

const EVENT_TYPE_CONFIG: Record<string, { color: string; bgColor: string; icon: React.ComponentType<{ className?: string }>; label: string }> = {
  receipt: { color: 'text-blue-400', bgColor: 'bg-blue-500/20 border-blue-500/30', icon: FileText, label: 'Receipt' },
  incident: { color: 'text-red-400', bgColor: 'bg-red-500/20 border-red-500/30', icon: AlertTriangle, label: 'Incident' },
  provider_call: { color: 'text-yellow-400', bgColor: 'bg-yellow-500/20 border-yellow-500/30', icon: Zap, label: 'Provider Call' },
  client_event: { color: 'text-gray-400', bgColor: 'bg-gray-500/20 border-gray-500/30', icon: Monitor, label: 'Client Event' },
};

function getEventConfig(type: string) {
  return EVENT_TYPE_CONFIG[type] ?? {
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/50 border-border',
    icon: Clock,
    label: type,
  };
}

export default function TraceView() {
  const { correlationId } = useParams<{ correlationId: string }>();
  const { viewMode } = useSystem();
  const [trace, setTrace] = useState<OpsTraceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedEvents, setExpandedEvents] = useState<Set<number>>(new Set());
  const [copiedId, setCopiedId] = useState(false);

  useEffect(() => {
    if (!correlationId) return;
    loadTrace();
  }, [correlationId]);

  const loadTrace = async () => {
    if (!correlationId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOpsTrace(correlationId);
      setTrace(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trace');
    } finally {
      setLoading(false);
    }
  };

  const toggleEvent = (index: number) => {
    setExpandedEvents(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const expandAll = () => {
    if (!trace) return;
    setExpandedEvents(new Set(trace.events.map((_, i) => i)));
  };

  const collapseAll = () => {
    setExpandedEvents(new Set());
  };

  const copyCorrelationId = () => {
    if (!correlationId) return;
    navigator.clipboard.writeText(correlationId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  if (loading) return <PageLoadingState showKPIs rows={5} />;
  if (error) return <EmptyState variant="error" title="Failed to load trace" description={error} actionLabel="Retry" onAction={loadTrace} />;
  if (!trace) return <EmptyState variant="empty" title="Trace not found" description="No trace data available for this correlation ID." />;

  const timestamps = trace.events
    .map(e => new Date(e.timestamp).getTime())
    .filter(t => !isNaN(t));
  const earliest = timestamps.length > 0 ? new Date(Math.min(...timestamps)) : null;
  const latest = timestamps.length > 0 ? new Date(Math.max(...timestamps)) : null;
  const durationMs = earliest && latest ? latest.getTime() - earliest.getTime() : 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Back navigation */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/receipts">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
        </Button>
      </div>

      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">
          <ModeText operator="Trace Timeline" engineer="Distributed Trace" />
        </h1>
        <p className="page-subtitle">
          <ModeText
            operator="Follow the full journey of a request through the system"
            engineer="Chronological event timeline for a single correlation ID"
          />
        </p>
      </div>

      {/* Trace summary */}
      <Panel>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Correlation ID</p>
              <button
                onClick={copyCorrelationId}
                className="font-mono text-sm text-primary hover:underline flex items-center gap-1"
              >
                {correlationId}
                {copiedId ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
            {trace.trace_id && trace.trace_id !== correlationId && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Trace ID</p>
                <code className="text-sm font-mono">{trace.trace_id}</code>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground mb-1">Events</p>
              <span className="text-sm font-medium">{trace.event_count}</span>
            </div>
            {earliest && latest && (
              <>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Time Range</p>
                  <span className="text-sm">
                    {earliest.toLocaleString()} &mdash; {latest.toLocaleTimeString()}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Duration</p>
                  <span className="text-sm font-medium">
                    {durationMs < 1000 ? `${durationMs}ms` : `${(durationMs / 1000).toFixed(1)}s`}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Event type legend */}
          <div className="flex flex-wrap gap-3 pt-2 border-t border-border">
            {Object.entries(EVENT_TYPE_CONFIG).map(([type, config]) => (
              <div key={type} className="flex items-center gap-1.5 text-xs">
                <div className={`w-2.5 h-2.5 rounded-full ${config.bgColor} border`} />
                <span className="text-muted-foreground">{config.label}</span>
                <span className="font-medium">
                  {trace.events.filter(e => e.type === type).length}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={expandAll}>
          Expand All
        </Button>
        <Button variant="outline" size="sm" onClick={collapseAll}>
          Collapse All
        </Button>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical timeline line */}
        <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />

        <div className="space-y-1">
          {trace.events.map((event, index) => {
            const config = getEventConfig(event.type);
            const Icon = config.icon;
            const isExpanded = expandedEvents.has(index);

            return (
              <div key={index} className="relative pl-12">
                {/* Timeline dot */}
                <div className={`absolute left-3.5 top-3 w-3 h-3 rounded-full border-2 ${config.bgColor}`} />

                {/* Event card */}
                <button
                  onClick={() => toggleEvent(index)}
                  className={`w-full text-left rounded-lg border p-3 transition-colors hover:bg-accent/30 ${
                    isExpanded ? 'bg-accent/20' : 'bg-card'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`h-4 w-4 flex-shrink-0 ${config.color}`} />
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.bgColor} border`}>
                      {config.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(event.timestamp).toLocaleString()}
                    </span>
                    <div className="ml-auto">
                      {isExpanded
                        ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && event.data && (
                    <div className="mt-3 pt-3 border-t border-border" onClick={(e) => e.stopPropagation()}>
                      <pre className="text-xs bg-surface-2 p-3 rounded-lg overflow-x-auto max-h-64 whitespace-pre-wrap">
                        {JSON.stringify(event.data, null, 2)}
                      </pre>
                    </div>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {trace.events.length === 0 && (
        <EmptyState
          variant="empty"
          title="No events in trace"
          description="This correlation ID has no associated events."
        />
      )}
    </div>
  );
}
