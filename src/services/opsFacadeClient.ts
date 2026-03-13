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
const OPS_BASE_URL = (
  import.meta.env.VITE_OPS_FACADE_URL ??
  import.meta.env.VITE_API_BASE_URL ??
  'http://localhost:8000'
).replace(/\/+$/, '');

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
  rotation_mode?: 'automated' | 'manual_alerted' | 'infrastructure' | 'unknown';
  automation_status?: string;
  verification_source?: string;
  adapter_type?: string;
  adapter_name?: string;
  secret_id?: string;
  secret_source?: string;
  production_verified?: boolean;
}

export interface OpsProviderRotationSummary {
  automated_count: number;
  manual_alerted_count: number;
  infrastructure_count: number;
  automated_providers: string[];
  manual_alerted_providers: string[];
  manual_alerted_with_adapter_modules: string[];
  manual_alerted_without_adapter_modules: string[];
  automation_gaps: {
    missing_adapter_modules: string[];
    registry_automated_missing_from_terraform: string[];
    terraform_automated_missing_from_registry: string[];
  };
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

export interface OpsReadinessContract {
  environment: string;
  replica_safe: boolean;
  rate_limiter_backend: string;
  outbox_backend: string;
  a2a_backend: string;
  checkpointer_backend: string;
  server_time: string;
}

export interface OpsVoiceConfig {
  provider: string;
  configured: boolean;
  has_api_key: boolean;
  configured_agents: string[];
  voices: Record<string, string>;
  server_time: string;
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

import { getAdminToken, getSuiteId, setAdminToken, clearAdminToken as clearToken } from '@/lib/adminAuth';
export { clearToken as clearAdminToken };

// Re-export getAdminToken for backward compat
export { getAdminToken };

export interface AdminTokenExchangeResponse {
  admin_token: string;
  expires_at: string;
  correlation_id: string;
}

function getCorrelationId(): string {
  return crypto.randomUUID();
}

export function getOpsFacadeBaseUrl(): string {
  return OPS_BASE_URL;
}

export function buildOpsFacadeUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${OPS_BASE_URL}${normalizedPath}`;
}

export function buildOpsHeaders(options?: {
  includeJson?: boolean;
  includeCorrelationId?: boolean;
  includeAdminToken?: boolean;
  includeSuiteId?: boolean;
  extraHeaders?: Record<string, string | undefined>;
}): Record<string, string> {
  const {
    includeJson = true,
    includeCorrelationId = true,
    includeAdminToken = true,
    includeSuiteId = false,
    extraHeaders = {},
  } = options ?? {};

  const headers: Record<string, string> = {};

  if (includeJson) {
    headers['Content-Type'] = 'application/json';
  }

  if (includeCorrelationId) {
    const correlationId = getCorrelationId();
    headers['X-Correlation-Id'] = correlationId;
    headers['X-Trace-Id'] = correlationId;
  }

  if (includeAdminToken) {
    const adminToken = getAdminToken();
    if (adminToken) {
      headers['X-Admin-Token'] = adminToken;
    }
  }

  if (includeSuiteId) {
    const suiteId = getSuiteId();
    if (suiteId) {
      headers['X-Suite-Id'] = suiteId;
    }
  }

  for (const [key, value] of Object.entries(extraHeaders)) {
    if (value) {
      headers[key] = value;
    }
  }

  return headers;
}

async function opsFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildOpsFacadeUrl(path), {
    ...init,
    headers: {
      ...buildOpsHeaders(),
      ...(init?.headers as Record<string, string> ?? {}),
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

  const response = await fetch(buildOpsFacadeUrl('/admin/auth/exchange'), {
    method: 'POST',
    headers: {
      ...buildOpsHeaders({ includeAdminToken: false }),
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
  setAdminToken(data.admin_token);
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

/** GET /admin/ops/readiness-contract — runtime backend contract */
export async function fetchOpsReadinessContract(): Promise<OpsReadinessContract> {
  return opsFetch<OpsReadinessContract>('/admin/ops/readiness-contract');
}

/** GET /admin/ops/voice/config — voice provider/runtime config */
export async function fetchOpsVoiceConfig(): Promise<OpsVoiceConfig> {
  return opsFetch<OpsVoiceConfig>('/admin/ops/voice/config');
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

export async function fetchOpsProviderRotationSummary(): Promise<{
  summary: OpsProviderRotationSummary;
  server_time: string;
}> {
  return opsFetch('/admin/ops/providers/rotation-summary');
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

/** POST /admin/ops/approvals/:id/decide — approve or deny a pending approval */
export async function submitApprovalDecision(
  approvalId: string,
  decision: 'approved' | 'denied',
  reason?: string,
): Promise<{ receipt_id: string; status: string }> {
  return opsFetch(`/admin/ops/approvals/${encodeURIComponent(approvalId)}/decide`, {
    method: 'POST',
    body: JSON.stringify({ decision, reason }),
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
