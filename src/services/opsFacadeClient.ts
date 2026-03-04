/**
 * OPS TELEMETRY FACADE CLIENT
 *
 * HTTP client for the backend Ops Telemetry Facade at /admin/ops/*.
 * This connects the admin portal to the Python FastAPI backend (port 8000)
 * instead of querying Supabase directly.
 *
 * Auth: X-Admin-Token header with JWT (Law #3: fail closed).
 * PII: Responses are pre-redacted by the backend (Law #9).
 * Receipts: Every call generates a server-side access receipt (Law #2).
 */

// Backend orchestrator URL — defaults to localhost:8000 for local dev
const OPS_BASE_URL = import.meta.env.VITE_OPS_FACADE_URL ?? 'http://localhost:8000';

// ============================================================================
// TYPES — match backend response shapes
// ============================================================================
export interface OpsHealthResponse {
  status: string;
  server_time: string;
  version: string;
}

export interface OpsPageInfo {
  has_more: boolean;
  next_cursor: string | null;
}

export interface OpsIncidentSummary {
  incident_id: string;
  state: string;
  severity: string;
  title: string;
  correlation_id: string;
  suite_id: string | null;
  first_seen: string;
  last_seen: string;
}

export interface OpsIncidentDetail extends OpsIncidentSummary {
  timeline: Array<{ ts: string; event: string; receipt_id: string }>;
  evidence_pack: Record<string, unknown>;
  server_time: string;
}

export interface OpsReceiptSummary {
  receipt_id: string;
  correlation_id: string;
  suite_id: string;
  office_id: string;
  action_type: string;
  risk_tier: string;
  outcome: string;
  created_at: string;
}

export interface OpsProviderCallSummary {
  call_id: string;
  correlation_id: string;
  provider: string;
  action: string;
  status: string;
  http_status: number | null;
  retry_count: number;
  started_at: string;
  finished_at: string | null;
  redacted_payload_preview: string;
}

export interface OpsOutboxStatus {
  server_time: string;
  queue_depth: number;
  oldest_age_seconds: number;
  stuck_jobs: number;
}

export interface OpsRolloutSummary {
  rollout_id: string;
  [key: string]: unknown;
}

export interface OpsProviderStatus {
  provider: string;
  lane: string;
  status: 'connected' | 'degraded' | 'disconnected';
  connection_status: string;
  scopes: string[];
  last_checked: string | null;
  latency_ms: number;
  p95_latency_ms: number;
  error_rate: number;
  webhook_error_rate: number;
}

export interface OpsWebhookDelivery {
  webhook_id: string;
  provider: string;
  event_type: string;
  status: string;
  http_status: number | null;
  attempt: number;
  latency_ms: number;
  delivered_at: string;
}

export interface OpsModelPolicy {
  builder_primary_model: string;
  builder_fallback_model: string;
  reasoning_model: string;
  updated_at: string;
  updated_by: string;
}

export interface OpsPaginatedResponse<T> {
  items: T[];
  page: OpsPageInfo;
  server_time: string;
}

export interface OpsError {
  code: string;
  message: string;
  correlation_id: string;
  retryable: boolean;
  details?: Record<string, unknown>;
}

// ============================================================================
// CLIENT
// ============================================================================

function getAdminToken(): string {
  // Admin JWT stored in sessionStorage after login
  return sessionStorage.getItem('aspire_admin_token') ?? '';
}

export function clearAdminToken(): void {
  sessionStorage.removeItem('aspire_admin_token');
}

export interface AdminTokenExchangeResponse {
  admin_token: string;
  expires_at: string;
  correlation_id: string;
}

function getCorrelationId(): string {
  return crypto.randomUUID();
}

async function opsFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAdminToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-correlation-id': getCorrelationId(),
    ...(token ? { 'x-admin-token': token } : {}),
  };

  const response = await fetch(`${OPS_BASE_URL}${path}`, {
    ...init,
    headers: { ...headers, ...(init?.headers as Record<string, string> ?? {}) },
  });

  if (!response.ok) {
    const error: OpsError = await response.json().catch(() => ({
      code: 'FETCH_ERROR',
      message: `HTTP ${response.status}: ${response.statusText}`,
      correlation_id: 'unknown',
      retryable: response.status >= 500,
    }));
    throw new OpsFacadeError(error.message, error.code, response.status);
  }

  return response.json();
}

export class OpsFacadeError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
  ) {
    super(message);
    this.name = 'OpsFacadeError';
  }
}

// ============================================================================
// ENDPOINT FUNCTIONS
// ============================================================================

/** GET /admin/ops/health — no auth required */
export async function fetchOpsHealth(): Promise<OpsHealthResponse> {
  return opsFetch<OpsHealthResponse>('/admin/ops/health');
}

/** POST /admin/auth/exchange — convert Supabase access token into admin JWT */
export async function exchangeAdminToken(accessToken: string): Promise<AdminTokenExchangeResponse> {
  if (!accessToken) {
    throw new OpsFacadeError('Missing access token for admin exchange', 'AUTH_REQUIRED', 401);
  }

  const response = await fetch(`${OPS_BASE_URL}/admin/auth/exchange`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-correlation-id': getCorrelationId(),
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error: OpsError = await response.json().catch(() => ({
      code: 'FETCH_ERROR',
      message: `HTTP ${response.status}: ${response.statusText}`,
      correlation_id: 'unknown',
      retryable: response.status >= 500,
    }));
    throw new OpsFacadeError(error.message, error.code, response.status);
  }

  const data = await response.json() as AdminTokenExchangeResponse;
  sessionStorage.setItem('aspire_admin_token', data.admin_token);
  return data;
}

/** GET /admin/ops/incidents — paginated, filtered */
export async function fetchOpsIncidents(params?: {
  state?: string;
  severity?: string;
  cursor?: string;
  limit?: number;
}): Promise<OpsPaginatedResponse<OpsIncidentSummary>> {
  const search = new URLSearchParams();
  if (params?.state) search.set('state', params.state);
  if (params?.severity) search.set('severity', params.severity);
  if (params?.cursor) search.set('cursor', params.cursor);
  if (params?.limit) search.set('limit', String(params.limit));
  const qs = search.toString();
  return opsFetch<OpsPaginatedResponse<OpsIncidentSummary>>(
    `/admin/ops/incidents${qs ? `?${qs}` : ''}`,
  );
}

/** GET /admin/ops/incidents/:id — single incident detail */
export async function fetchOpsIncidentDetail(incidentId: string): Promise<OpsIncidentDetail> {
  return opsFetch<OpsIncidentDetail>(`/admin/ops/incidents/${encodeURIComponent(incidentId)}`);
}

/** GET /admin/ops/receipts — paginated, filtered, PII-redacted */
export async function fetchOpsReceipts(params?: {
  suite_id: string;
  correlation_id?: string;
  office_id?: string;
  action_type?: string;
  since?: string;
  until?: string;
  cursor?: string;
  limit?: number;
}): Promise<OpsPaginatedResponse<OpsReceiptSummary>> {
  const search = new URLSearchParams();
  if (params?.suite_id) search.set('suite_id', params.suite_id);
  if (params?.correlation_id) search.set('correlation_id', params.correlation_id);
  if (params?.office_id) search.set('office_id', params.office_id);
  if (params?.action_type) search.set('action_type', params.action_type);
  if (params?.since) search.set('since', params.since);
  if (params?.until) search.set('until', params.until);
  if (params?.cursor) search.set('cursor', params.cursor);
  if (params?.limit) search.set('limit', String(params.limit));
  const qs = search.toString();
  return opsFetch<OpsPaginatedResponse<OpsReceiptSummary>>(
    `/admin/ops/receipts${qs ? `?${qs}` : ''}`,
  );
}

/** GET /admin/ops/provider-calls — paginated, filtered, redacted */
export async function fetchOpsProviderCalls(params?: {
  provider?: string;
  status?: string;
  correlation_id?: string;
  cursor?: string;
  limit?: number;
}): Promise<OpsPaginatedResponse<OpsProviderCallSummary>> {
  const search = new URLSearchParams();
  if (params?.provider) search.set('provider', params.provider);
  if (params?.status) search.set('status', params.status);
  if (params?.correlation_id) search.set('correlation_id', params.correlation_id);
  if (params?.cursor) search.set('cursor', params.cursor);
  if (params?.limit) search.set('limit', String(params.limit));
  const qs = search.toString();
  return opsFetch<OpsPaginatedResponse<OpsProviderCallSummary>>(
    `/admin/ops/provider-calls${qs ? `?${qs}` : ''}`,
  );
}

/** GET /admin/ops/outbox — queue status */
export async function fetchOpsOutbox(): Promise<OpsOutboxStatus> {
  return opsFetch<OpsOutboxStatus>('/admin/ops/outbox');
}

/** GET /admin/ops/rollouts — paginated */
export async function fetchOpsRollouts(params?: {
  cursor?: string;
  limit?: number;
}): Promise<OpsPaginatedResponse<OpsRolloutSummary>> {
  const search = new URLSearchParams();
  if (params?.cursor) search.set('cursor', params.cursor);
  if (params?.limit) search.set('limit', String(params.limit));
  const qs = search.toString();
  return opsFetch<OpsPaginatedResponse<OpsRolloutSummary>>(
    `/admin/ops/rollouts${qs ? `?${qs}` : ''}`,
  );
}

/** GET /admin/ops/providers — provider connectivity snapshot */
export async function fetchOpsProviders(params?: {
  provider?: string;
  status?: string;
}): Promise<{
  items: OpsProviderStatus[];
  count: number;
  source: string;
  warnings?: string[];
  server_time: string;
}> {
  const search = new URLSearchParams();
  if (params?.provider) search.set('provider', params.provider);
  if (params?.status) search.set('status', params.status);
  const qs = search.toString();
  return opsFetch(`/admin/ops/providers${qs ? `?${qs}` : ''}`);
}

/** GET /admin/ops/webhooks — webhook delivery health */
export async function fetchOpsWebhooks(params?: {
  provider?: string;
  status?: string;
  limit?: number;
}): Promise<{
  items: OpsWebhookDelivery[];
  count: number;
  summary: { total: number; failed: number; success_rate: number };
  source: string;
  warnings?: string[];
  server_time: string;
}> {
  const search = new URLSearchParams();
  if (params?.provider) search.set('provider', params.provider);
  if (params?.status) search.set('status', params.status);
  if (params?.limit) search.set('limit', String(params.limit));
  const qs = search.toString();
  return opsFetch(`/admin/ops/webhooks${qs ? `?${qs}` : ''}`);
}

/** GET /admin/ops/model-policy — current builder model policy */
export async function fetchOpsModelPolicy(): Promise<{
  policy: OpsModelPolicy;
  allowed_models: string[];
  server_time: string;
}> {
  return opsFetch('/admin/ops/model-policy');
}

/** PUT /admin/ops/model-policy — update builder model policy */
export async function updateOpsModelPolicy(payload: {
  builder_primary_model: string;
  builder_fallback_model: string;
  reasoning_model: string;
}): Promise<{ policy: OpsModelPolicy; server_time: string }> {
  return opsFetch('/admin/ops/model-policy', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

/** Check if the ops facade backend is reachable */
export async function isOpsFacadeAvailable(): Promise<boolean> {
  try {
    const health = await fetchOpsHealth();
    return health.status === 'ok';
  } catch {
    return false;
  }
}
