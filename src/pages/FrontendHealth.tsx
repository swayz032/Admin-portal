import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { DataTable } from '@/components/shared/DataTable';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHero } from '@/components/shared/PageHero';
import { PageLoadingState } from '@/components/shared/PageLoadingState';
import { Panel } from '@/components/shared/Panel';
import { QuickStats } from '@/components/shared/QuickStats';
import { StatusChip } from '@/components/shared/StatusChip';
import { supabase } from '@/integrations/supabase/client';
import { formatTimeAgo } from '@/lib/formatters';
import { FRONTEND_CONTRACTS } from '@/lib/frontendContracts';
import { mapClientEvent, type ClientEventRaw } from '@/lib/clientEvents';
import {
  aggregateFrontendIncidents,
  computeFrontendHealth,
  summarizeFrontendHealth,
  type FrontendIncident,
  type FrontendIncidentReleaseStatus,
  type FrontendSurfaceHealth,
  type FrontendSurfaceReleaseStatus,
} from '@/lib/frontendHealth';
import { ExternalLink, Radar, RefreshCw, ShieldAlert } from 'lucide-react';

const MAX_EVENTS = 2500;
const WINDOW_OPTIONS = [
  { label: 'Last 6h', value: '6' },
  { label: 'Last 24h', value: '24' },
  { label: 'Last 7d', value: '168' },
];

function sinceIso(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function statusToChip(status: FrontendSurfaceHealth['status']): 'healthy' | 'warning' | 'critical' | 'neutral' {
  if (status === 'healthy') return 'healthy';
  if (status === 'untested') return 'neutral';
  if (status === 'partial' || status === 'degraded') return 'warning';
  return 'critical';
}

function releaseStatusToChip(
  status: FrontendIncidentReleaseStatus | FrontendSurfaceReleaseStatus,
): 'info' | 'warning' | 'neutral' {
  if (status === 'new' || status === 'mixed') return 'warning';
  if (status === 'preexisting') return 'neutral';
  return 'info';
}

function formatReleaseStatus(
  status: FrontendIncidentReleaseStatus | FrontendSurfaceReleaseStatus,
): string {
  if (status === 'single-release') return 'single release';
  return status;
}

function getSurfaceRelease(surface: FrontendSurfaceHealth): string {
  return surface.replay?.release ?? surface.releases[surface.releases.length - 1] ?? 'unknown';
}

function formatFlightValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

export default function FrontendHealth() {
  const [windowHours, setWindowHours] = useState('24');
  const [events, setEvents] = useState<ReturnType<typeof mapClientEvent>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSurface, setSelectedSurface] = useState<FrontendSurfaceHealth | null>(null);
  const [isLive, setIsLive] = useState(false);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await supabase
        .from('client_events')
        .select('*')
        .gte('created_at', sinceIso(Number(windowHours)))
        .order('created_at', { ascending: false })
        .limit(MAX_EVENTS);

      if (queryError) throw new Error(queryError.message);
      setEvents((data ?? []).map((row) => mapClientEvent(row as ClientEventRaw)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load frontend telemetry');
    } finally {
      setLoading(false);
    }
  }, [windowHours]);

  useEffect(() => {
    void fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    const channel = supabase
      .channel(`frontend-health-${Date.now()}`)
      .on(
        'postgres_changes' as 'system',
        { event: 'INSERT', schema: 'public', table: 'client_events' } as { event: string; schema: string },
        (payload: { new: Record<string, unknown> }) => {
          const next = mapClientEvent(payload.new as ClientEventRaw);
          if (next.createdAt < sinceIso(Number(windowHours))) return;
          setIsLive(true);
          setEvents((current) => {
            if (current.some((event) => event.id === next.id)) return current;
            return [next, ...current].slice(0, MAX_EVENTS);
          });
        },
      )
      .subscribe((status) => {
        setIsLive(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [windowHours]);

  const surfaces = useMemo(() => computeFrontendHealth(events), [events]);
  const incidents = useMemo(() => aggregateFrontendIncidents(events), [events]);
  const summary = useMemo(() => summarizeFrontendHealth(surfaces), [surfaces]);

  const heroStatus = summary.failing > 0
    ? { type: 'critical' as const, label: `${summary.failing} failing surfaces` }
    : summary.degraded > 0 || summary.partial > 0
      ? { type: 'warning' as const, label: `${summary.degraded + summary.partial} surfaces at risk` }
      : { type: 'success' as const, label: 'No active frontend regressions' };

  const coverageGaps = surfaces.filter((surface) => surface.status === 'untested' || surface.status === 'partial');

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHero
          title="Frontend Health"
          subtitle="Aggregated health for Aspire Desktop routes, widgets, and critical flows."
          status={{ type: 'pending', label: 'Loading' }}
          icon={<Radar className="h-6 w-6" />}
        />
        <PageLoadingState showKPIs kpiCount={4} rows={8} />
      </div>
    );
  }

  if (error && !events.length) {
    return (
      <div className="space-y-6">
        <PageHero
          title="Frontend Health"
          subtitle="Aggregated health for Aspire Desktop routes, widgets, and critical flows."
          status={{ type: 'critical', label: 'Unavailable' }}
          icon={<ShieldAlert className="h-6 w-6" />}
        />
        <EmptyState
          variant="error"
          title="Failed to load frontend health"
          description={error}
          actionLabel="Retry"
          onAction={() => { void fetchEvents(); }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHero
        title="Frontend Health"
        subtitle="Production command center for Aspire Desktop. Contracts turn raw client events into route, flow, and incident status."
        status={heroStatus}
        icon={<Radar className="h-6 w-6" />}
        action={(
          <div className="flex flex-wrap items-center gap-2">
            <Select value={windowHours} onValueChange={setWindowHours}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Window" />
              </SelectTrigger>
              <SelectContent>
                {WINDOW_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => { void fetchEvents(); }}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/client-events">
                Raw Events
                <ExternalLink className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </div>
        )}
      />

      <QuickStats
        stats={[
          { label: 'Failing surfaces', value: summary.failing, status: summary.failing ? 'critical' : 'success' },
          { label: 'Open incidents', value: incidents.length, status: incidents.length ? 'warning' : 'success' },
          { label: 'New release incidents', value: summary.newIncidents, status: summary.newIncidents ? 'warning' : 'success' },
          { label: 'Coverage gaps', value: coverageGaps.length, status: coverageGaps.length ? 'warning' : 'success' },
          { label: 'Preexisting failures', value: summary.preexistingIncidents, status: summary.preexistingIncidents ? 'neutral' : 'success' },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Panel
          title="Surface Health"
          subtitle={`Critical coverage contracts for ${FRONTEND_CONTRACTS.length} Aspire Desktop surfaces. Live stream ${isLive ? 'connected' : 'disconnected'}.`}
        >
          <DataTable
            columns={[
              {
                key: 'surface',
                header: 'Surface',
                render: (surface: FrontendSurfaceHealth) => (
                  <div className="space-y-0.5">
                    <div className="font-medium text-foreground">{surface.contract.label}</div>
                    <div className="text-xs text-muted-foreground">{surface.contract.description}</div>
                  </div>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (surface: FrontendSurfaceHealth) => (
                  <div className="space-y-1">
                    <StatusChip status={statusToChip(surface.status)} label={surface.status} />
                    <StatusChip
                      status={releaseStatusToChip(surface.releaseStatus)}
                      label={formatReleaseStatus(surface.releaseStatus)}
                    />
                  </div>
                ),
              },
              {
                key: 'signals',
                header: 'Signals',
                render: (surface: FrontendSurfaceHealth) => (
                  <div className="text-xs text-muted-foreground">
                    {surface.totalEvents} events | {surface.sessionCount} sessions | {surface.failureCount} failures
                  </div>
                ),
              },
              {
                key: 'hint',
                header: 'Debug Hint',
                render: (surface: FrontendSurfaceHealth) => (
                  <div className="text-xs text-foreground">{surface.likelyCause ?? 'No active hint'}</div>
                ),
              },
              {
                key: 'release',
                header: 'Release',
                render: (surface: FrontendSurfaceHealth) => (
                  <span className="font-mono text-xs text-muted-foreground">{getSurfaceRelease(surface)}</span>
                ),
              },
              {
                key: 'lastSeen',
                header: 'Last Seen',
                render: (surface: FrontendSurfaceHealth) => (
                  <span className="text-xs text-muted-foreground">
                    {surface.lastSeen ? formatTimeAgo(surface.lastSeen) : 'No traffic'}
                  </span>
                ),
              },
            ]}
            data={surfaces}
            keyExtractor={(surface) => surface.contract.id}
            onRowClick={setSelectedSurface}
            emptyMessage="No frontend health data yet."
            resultLabel="surfaces"
            maxHeight="580px"
          />
        </Panel>

        <div className="space-y-6">
          <Panel
            title="Open Frontend Incidents"
            subtitle="Failure fingerprints grouped by route, component, event type, and release."
          >
            {incidents.length === 0 ? (
              <EmptyState
                variant="all-done"
                title="No grouped incidents"
                description="The current telemetry window has no active client-side failure fingerprints."
              />
            ) : (
              <DataTable
                columns={[
                  {
                    key: 'title',
                    header: 'Incident',
                    render: (incident: FrontendIncident) => (
                      <div className="space-y-1">
                        <div className="font-medium">{incident.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {incident.eventType} | {incident.route ?? incident.component ?? 'unknown surface'}
                        </div>
                        <div className="text-xs text-foreground">{incident.likelyCause}</div>
                      </div>
                    ),
                  },
                  {
                    key: 'severity',
                    header: 'Severity',
                    render: (incident: FrontendIncident) => (
                      <StatusChip
                        status={incident.severity === 'critical' ? 'critical' : incident.severity === 'warning' ? 'warning' : 'info'}
                        label={incident.severity}
                      />
                    ),
                  },
                  {
                    key: 'classification',
                    header: 'Classification',
                    render: (incident: FrontendIncident) => (
                      <div className="space-y-1">
                        <StatusChip
                          status={releaseStatusToChip(incident.releaseStatus)}
                          label={formatReleaseStatus(incident.releaseStatus)}
                        />
                        <div className="text-xs text-muted-foreground">
                          {incident.count} events | {incident.affectedSessions} sessions | {incident.affectedReleases} releases
                        </div>
                      </div>
                    ),
                  },
                ]}
                data={incidents.slice(0, 8)}
                keyExtractor={(incident) => incident.fingerprint}
                emptyMessage="No incidents in the current window."
                resultLabel="incidents"
                maxHeight="320px"
              />
            )}
          </Panel>

          <Panel
            title="Coverage Gaps"
            subtitle="Surfaces that are silent or partially instrumented in the current telemetry window."
          >
            {coverageGaps.length === 0 ? (
              <EmptyState
                variant="all-done"
                title="Coverage looks healthy"
                description="Every tracked critical surface emitted the expected baseline signals in this window."
              />
            ) : (
              <div className="space-y-3">
                {coverageGaps.map((surface) => (
                  <button
                    key={surface.contract.id}
                    type="button"
                    onClick={() => setSelectedSurface(surface)}
                    className="w-full rounded-lg border border-border/50 bg-card/50 px-4 py-3 text-left hover:bg-card transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium">{surface.contract.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {surface.status === 'untested'
                            ? 'No telemetry observed for this contract.'
                            : `Missing ${surface.missingEvents.length} expected events.`}
                        </div>
                      </div>
                      <StatusChip status={statusToChip(surface.status)} label={surface.status} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>

      <Sheet open={!!selectedSurface} onOpenChange={(open) => { if (!open) setSelectedSurface(null); }}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          {selectedSurface && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedSurface.contract.label}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <Panel title="Status" subtitle={selectedSurface.contract.description}>
                  <div className="flex items-center gap-3 flex-wrap">
                    <StatusChip status={statusToChip(selectedSurface.status)} label={selectedSurface.status} />
                    <StatusChip
                      status={releaseStatusToChip(selectedSurface.releaseStatus)}
                      label={formatReleaseStatus(selectedSurface.releaseStatus)}
                    />
                    <span className="text-sm text-muted-foreground">
                      {selectedSurface.totalEvents} events | {selectedSurface.sessionCount} sessions | {selectedSurface.failureCount} failures
                    </span>
                  </div>
                </Panel>

                <Panel title="Debug Hint" subtitle="Fast triage guidance generated from contracts and failure signals.">
                  <div className="space-y-2 text-sm">
                    <div className="font-medium text-foreground">
                      {selectedSurface.likelyCause ?? 'No active failures or missing instrumentation.'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Release posture: {formatReleaseStatus(selectedSurface.releaseStatus)}
                    </div>
                  </div>
                </Panel>

                <Panel title="Expected Contract">
                  <div className="space-y-4 text-sm">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Expected Events</div>
                      <div className="flex flex-wrap gap-2">
                        {selectedSurface.contract.expectedEvents.map((eventType) => (
                          <StatusChip key={eventType} status="info" label={eventType} />
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Failure Signals</div>
                      <div className="flex flex-wrap gap-2">
                        {selectedSurface.contract.failureEvents.map((eventType) => (
                          <StatusChip key={eventType} status="warning" label={eventType} />
                        ))}
                      </div>
                    </div>
                    {selectedSurface.missingEvents.length > 0 && (
                      <div>
                        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Missing In Window</div>
                        <div className="flex flex-wrap gap-2">
                          {selectedSurface.missingEvents.map((eventType) => (
                            <StatusChip key={eventType} status="critical" label={eventType} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Panel>

                <Panel title="Contract Replay" subtitle="Most recent session observed for this surface.">
                  {selectedSurface.replay ? (
                    <div className="space-y-4 text-sm">
                      <div className="text-muted-foreground">
                        Session {selectedSurface.replay.sessionId ?? 'unknown'} | release {selectedSurface.replay.release ?? 'unknown'}
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Expected</div>
                        <div className="flex flex-wrap gap-2">
                          {selectedSurface.replay.expectedSequence.map((eventType) => (
                            <StatusChip key={eventType} status="info" label={eventType} />
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Actual</div>
                        <div className="flex flex-wrap gap-2">
                          {selectedSurface.replay.actualSequence.map((eventType) => (
                            <StatusChip key={eventType} status="neutral" label={eventType} />
                          ))}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        First divergence: {selectedSurface.replay.firstDivergence ?? 'None'}
                      </div>
                    </div>
                  ) : (
                    <EmptyState
                      title="No replay available"
                      description="This surface has not emitted enough session data in the selected window."
                    />
                  )}
                </Panel>

                <Panel title="Flight Recorder" subtitle="Last captured pre-failure breadcrumbs attached to the strongest incident.">
                  {selectedSurface.sampleFlightRecorder.length === 0 ? (
                    <EmptyState
                      title="No flight recorder attached"
                      description="This surface has no captured failure breadcrumb trail in the selected window."
                    />
                  ) : (
                    <div className="space-y-3">
                      {selectedSurface.sampleFlightRecorder.map((entry, index) => (
                        <div
                          key={`${formatFlightValue(entry.created_at, 'step')}-${index}`}
                          className="rounded-lg border border-border/50 bg-card/50 px-4 py-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-medium text-sm">
                              {formatFlightValue(entry.event_type, 'unknown_event')}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatFlightValue(entry.created_at, `step-${index + 1}`)}
                            </div>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {formatFlightValue(entry.component, 'unknown_component')} | {formatFlightValue(entry.page_route, 'unknown_route')}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>

                <Panel title="Active Incidents">
                  {selectedSurface.activeIncidents.length === 0 ? (
                    <EmptyState
                      variant="all-done"
                      title="No active incidents"
                      description="This contract has no grouped failures in the selected window."
                    />
                  ) : (
                    <div className="space-y-3">
                      {selectedSurface.activeIncidents.map((incident) => (
                        <div key={incident.fingerprint} className="rounded-lg border border-border/50 bg-card/50 px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-medium">{incident.title}</div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {incident.count} events | {incident.affectedSessions} sessions | release {incident.release ?? 'unknown'}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                Last seen {formatTimeAgo(incident.lastSeen)}
                              </div>
                              <div className="text-xs text-foreground mt-2">{incident.likelyCause}</div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <StatusChip
                                status={incident.severity === 'critical' ? 'critical' : incident.severity === 'warning' ? 'warning' : 'info'}
                                label={incident.severity}
                              />
                              <StatusChip
                                status={releaseStatusToChip(incident.releaseStatus)}
                                label={formatReleaseStatus(incident.releaseStatus)}
                              />
                            </div>
                          </div>
                          {incident.sampleMessage && (
                            <div className="mt-3 rounded-md bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                              {incident.sampleMessage}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
