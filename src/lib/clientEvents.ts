export interface ClientEventRaw {
  id: string;
  source: string | null;
  severity: string | null;
  event_type: string;
  correlation_id: string | null;
  component: string | null;
  page_route: string | null;
  data: Record<string, unknown> | null;
  created_at: string;
  session_id: string | null;
  tenant_id: string | null;
}

export interface ClientEvent {
  id: string;
  source: string;
  severity: string;
  eventType: string;
  message: string;
  correlationId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  sessionId: string | null;
  component: string | null;
  pageRoute: string | null;
  release: string | null;
  contractId: string | null;
  flowId: string | null;
  runtime: string | null;
  userAgent: string | null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function mapClientEvent(raw: ClientEventRaw): ClientEvent {
  const data = raw.data ?? {};
  const payload =
    data.payload && typeof data.payload === 'object'
      ? (data.payload as Record<string, unknown>)
      : {};

  const message =
    readString(data.message) ??
    readString(data.error_code) ??
    readString(payload.message) ??
    readString(payload.error_code) ??
    raw.event_type;

  return {
    id: raw.id,
    source: readString(raw.source) ?? 'unknown',
    severity: readString(raw.severity) ?? 'info',
    eventType: raw.event_type,
    message,
    correlationId: raw.correlation_id,
    metadata: data,
    createdAt: raw.created_at,
    sessionId: raw.session_id,
    component: readString(raw.component) ?? readString(data.component) ?? null,
    pageRoute: readString(raw.page_route) ?? readString(data.page_route) ?? readString(data.route) ?? null,
    release: readString(data.release) ?? readString(payload.release) ?? null,
    contractId: readString(data.contract_id) ?? readString(payload.contract_id) ?? null,
    flowId: readString(data.flow_id) ?? readString(payload.flow_id) ?? null,
    runtime: readString(data.runtime) ?? readString(payload.runtime) ?? null,
    userAgent: readString(data.user_agent) ?? readString(payload.user_agent) ?? null,
  };
}

export function getEventErrorCode(event: ClientEvent): string | null {
  return (
    readString(event.metadata.error_code) ??
    readString(
      event.metadata.payload && typeof event.metadata.payload === 'object'
        ? (event.metadata.payload as Record<string, unknown>).error_code
        : null,
    ) ??
    null
  );
}

export function getEventFlightRecorder(event: ClientEvent): Record<string, unknown>[] {
  const value =
    event.metadata.flight_recorder ??
    (event.metadata.payload && typeof event.metadata.payload === 'object'
      ? (event.metadata.payload as Record<string, unknown>).flight_recorder
      : null);

  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}
