import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useSystem } from '@/contexts/SystemContext';
import { Panel } from '@/components/shared/Panel';
import { DataTable } from '@/components/shared/DataTable';
import { StatusChip } from '@/components/shared/StatusChip';
import { ModeText } from '@/components/shared/ModeText';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { formatTimeAgo } from '@/lib/formatters';
import {
  Monitor,
  Search,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';

interface ClientEventRaw {
  id: string;
  source: string;
  severity: string;
  event_type: string;
  correlation_id: string | null;
  component: string | null;
  page_route: string | null;
  data: Record<string, unknown> | null;
  created_at: string;
  session_id: string | null;
  tenant_id: string | null;
}

interface ClientEvent {
  id: string;
  source: string;
  severity: string;
  event_type: string;
  message: string;
  correlation_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  session_id: string | null;
  user_agent: string | null;
  component: string | null;
  page_route: string | null;
}

/** Extract human-readable fields from the raw DB row's `data` jsonb column */
function mapClientEvent(raw: ClientEventRaw): ClientEvent {
  const data = raw.data ?? {};
  return {
    id: raw.id,
    source: raw.source ?? 'unknown',
    severity: raw.severity ?? 'info',
    event_type: raw.event_type,
    message: (data.message as string) ?? (data.error_code as string) ?? raw.event_type ?? '',
    correlation_id: raw.correlation_id,
    metadata: data,
    created_at: raw.created_at,
    session_id: raw.session_id,
    user_agent: (data.user_agent as string) ?? null,
    component: raw.component ?? (data.component as string) ?? null,
    page_route: raw.page_route ?? (data.page_route as string) ?? null,
  };
}

const PAGE_SIZE = 50;

const SEVERITY_STATUS_MAP: Record<string, 'success' | 'warning' | 'critical' | 'info'> = {
  info: 'info',
  warning: 'warning',
  error: 'critical',
  critical: 'critical',
  debug: 'info',
};

export default function ClientEvents() {
  const { viewMode } = useSystem();
  const [events, setEvents] = useState<ClientEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState<ClientEvent | null>(null);

  // Filters
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Unique filter options derived from data
  const [sources, setSources] = useState<string[]>([]);
  const [severities, setSeverities] = useState<string[]>([]);
  const [eventTypes, setEventTypes] = useState<string[]>([]);

  // Live indicator
  const [isLive, setIsLive] = useState(false);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('client_events')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (sourceFilter !== 'all') query = query.eq('source', sourceFilter);
      if (severityFilter !== 'all') query = query.eq('severity', severityFilter);
      if (eventTypeFilter !== 'all') query = query.eq('event_type', eventTypeFilter);
      if (searchTerm) query = query.or(`message.ilike.%${searchTerm}%,correlation_id.ilike.%${searchTerm}%`);
      if (dateFrom) query = query.gte('created_at', dateFrom);
      if (dateTo) query = query.lte('created_at', dateTo);

      const { data, error: queryError, count } = await query;

      if (queryError) {
        throw new Error(queryError.message);
      }

      setEvents((data ?? []).map((row: Record<string, unknown>) => mapClientEvent(row as unknown as ClientEventRaw)));
      setTotalCount(count ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch client events');
    } finally {
      setLoading(false);
    }
  }, [page, sourceFilter, severityFilter, eventTypeFilter, searchTerm, dateFrom, dateTo]);

  // Fetch filter options on mount
  useEffect(() => {
    async function fetchFilterOptions() {
      try {
        const [srcRes, sevRes, etRes] = await Promise.all([
          supabase.from('client_events').select('source').limit(500),
          supabase.from('client_events').select('severity').limit(500),
          supabase.from('client_events').select('event_type').limit(500),
        ]);
        if (srcRes.data) setSources([...new Set(srcRes.data.map((r: Record<string, unknown>) => r.source as string).filter(Boolean))].sort());
        if (sevRes.data) setSeverities([...new Set(sevRes.data.map((r: Record<string, unknown>) => r.severity as string).filter(Boolean))].sort());
        if (etRes.data) setEventTypes([...new Set(etRes.data.map((r: Record<string, unknown>) => r.event_type as string).filter(Boolean))].sort());
      } catch (err) {
        // Non-critical — filters will just be empty, but log for debugging
        console.warn('[ClientEvents] Failed to fetch filter options:', err);
      }
    }
    fetchFilterOptions();
  }, []);

  // Fetch events when filters/page change
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Realtime subscription
  useEffect(() => {
    const channelName = `client-events-live-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes' as 'system',
        { event: 'INSERT', schema: 'public', table: 'client_events' } as { event: string; schema: string },
        (payload: { new: Record<string, unknown> }) => {
          setIsLive(true);
          const newEvent = mapClientEvent(payload.new as unknown as ClientEventRaw);
          // Only prepend if on page 0 and no conflicting filters
          if (page === 0) {
            setEvents(prev => {
              if (prev.some(e => e.id === newEvent.id)) return prev;
              return [newEvent, ...prev.slice(0, PAGE_SIZE - 1)];
            });
            setTotalCount(prev => prev + 1);
          }
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setIsLive(true);
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setIsLive(false);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [page]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const columns = viewMode === 'operator' ? [
    {
      key: 'severity',
      header: 'Level',
      render: (e: ClientEvent) => (
        <StatusChip
          status={SEVERITY_STATUS_MAP[e.severity] ?? 'info'}
          label={e.severity}
        />
      ),
    },
    { key: 'source', header: 'Source' },
    { key: 'event_type', header: 'Type' },
    {
      key: 'message',
      header: 'What happened',
      className: 'max-w-xs truncate',
      render: (e: ClientEvent) => (
        <span className="text-sm truncate block max-w-xs" title={e.message}>
          {e.message}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'When',
      render: (e: ClientEvent) => (
        <span className="text-muted-foreground text-xs">{formatTimeAgo(e.created_at)}</span>
      ),
    },
  ] : [
    {
      key: 'id',
      header: 'Event ID',
      render: (e: ClientEvent) => (
        <span className="font-mono text-xs text-muted-foreground">{e.id.slice(0, 12)}...</span>
      ),
    },
    {
      key: 'severity',
      header: 'Severity',
      render: (e: ClientEvent) => (
        <StatusChip
          status={SEVERITY_STATUS_MAP[e.severity] ?? 'info'}
          label={e.severity}
        />
      ),
    },
    { key: 'source', header: 'Source' },
    { key: 'event_type', header: 'Event Type' },
    {
      key: 'message',
      header: 'Message',
      className: 'max-w-xs truncate',
      render: (e: ClientEvent) => (
        <span className="text-sm truncate block max-w-xs" title={e.message}>
          {e.message}
        </span>
      ),
    },
    {
      key: 'correlation_id',
      header: 'Correlation ID',
      render: (e: ClientEvent) => e.correlation_id ? (
        <Link
          to={`/trace/${e.correlation_id}`}
          className="font-mono text-xs text-primary hover:underline"
          onClick={(ev) => ev.stopPropagation()}
        >
          {e.correlation_id.slice(0, 12)}...
        </Link>
      ) : (
        <span className="text-xs text-muted-foreground">-</span>
      ),
    },
    {
      key: 'created_at',
      header: 'Timestamp',
      render: (e: ClientEvent) => (
        <span className="text-muted-foreground text-xs">{new Date(e.created_at).toLocaleString()}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <h1 className="page-title">
            <ModeText operator="Frontend Telemetry" engineer="Client Events" />
          </h1>
          {isLive && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/20 text-green-400 border border-green-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Live
            </span>
          )}
        </div>
        <p className="page-subtitle">
          <ModeText
            operator="Events captured from the desktop and mobile apps"
            engineer="Frontend telemetry from the client_events table with Realtime subscription"
          />
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search messages or correlation IDs..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
            className="pl-9"
          />
        </div>
        <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            {sources.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={severityFilter} onValueChange={(v) => { setSeverityFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severity</SelectItem>
            {severities.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={eventTypeFilter} onValueChange={(v) => { setEventTypeFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Event Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {eventTypes.map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(0); }}
          className="w-[140px]"
          placeholder="From"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(0); }}
          className="w-[140px]"
          placeholder="To"
        />
        <Button variant="outline" size="icon" onClick={fetchEvents} title="Refresh">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
          <Button variant="outline" size="sm" className="ml-3" onClick={fetchEvents}>
            Retry
          </Button>
        </div>
      )}

      {/* Events Table */}
      <Panel>
        {loading && events.length === 0 ? (
          <div className="loading-state">Loading client events...</div>
        ) : events.length === 0 ? (
          <div className="empty-state">
            <Monitor className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-2">
              <ModeText operator="No events found" engineer="No client events match filters" />
            </h3>
            <p className="text-muted-foreground text-sm">
              <ModeText
                operator="Frontend events will appear here as they are captured"
                engineer="Adjust filters or wait for new events via Realtime"
              />
            </p>
          </div>
        ) : (
          <DataTable
            data={events}
            columns={columns}
            keyExtractor={(e) => e.id}
            onRowClick={(event) => setSelectedEvent(event)}
          />
        )}
      </Panel>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage(p => Math.max(0, p - 1))}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page + 1} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      <Sheet open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedEvent && (
            <>
              <SheetHeader>
                <SheetTitle>
                  <ModeText operator="Event Details" engineer="Client Event Details" />
                </SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Status */}
                <div className="flex items-center gap-3">
                  <StatusChip
                    status={SEVERITY_STATUS_MAP[selectedEvent.severity] ?? 'info'}
                    label={selectedEvent.severity}
                  />
                  <span className="text-xs text-muted-foreground">{selectedEvent.event_type}</span>
                </div>

                {/* Message */}
                <div className="p-3 rounded-lg bg-muted/50 border border-border">
                  <p className="text-xs text-muted-foreground mb-1">Message</p>
                  <p className="text-sm">{selectedEvent.message}</p>
                </div>

                {/* Key Info */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Source</span>
                    <span className="text-sm">{selectedEvent.source}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Timestamp</span>
                    <span className="text-sm">{new Date(selectedEvent.created_at).toLocaleString()}</span>
                  </div>
                  {selectedEvent.session_id && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Session ID</span>
                      <code className="text-xs bg-surface-2 px-2 py-1 rounded">{selectedEvent.session_id}</code>
                    </div>
                  )}
                  {selectedEvent.user_agent && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">User Agent</span>
                      <span className="text-xs text-muted-foreground truncate max-w-[250px]" title={selectedEvent.user_agent}>
                        {selectedEvent.user_agent}
                      </span>
                    </div>
                  )}
                </div>

                {viewMode === 'engineer' && (
                  <>
                    <div className="border-t border-border pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Event ID</span>
                        <code className="text-xs bg-surface-2 px-2 py-1 rounded">{selectedEvent.id}</code>
                      </div>
                      {selectedEvent.correlation_id && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Correlation ID</span>
                          <Link
                            to={`/trace/${selectedEvent.correlation_id}`}
                            className="text-xs font-mono text-primary hover:underline flex items-center gap-1"
                          >
                            {selectedEvent.correlation_id}
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </div>
                      )}
                    </div>

                    {selectedEvent.metadata && Object.keys(selectedEvent.metadata).length > 0 && (
                      <div className="border-t border-border pt-4">
                        <h4 className="text-sm font-medium mb-2">Metadata</h4>
                        <pre className="text-xs bg-surface-2 p-3 rounded-lg overflow-x-auto max-h-48">
                          {JSON.stringify(selectedEvent.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
