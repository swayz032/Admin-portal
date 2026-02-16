/**
 * CANONICAL TRUST SPINE CONTRACTS
 * 
 * These are the canonical shapes for all Trust Spine objects.
 * The UI must render these shapes directly - no ad-hoc UI-only schemas allowed.
 */

// ============================================================================
// RECEIPT - Proof of what happened
// ============================================================================
export type ReceiptStatus = 'success' | 'failed' | 'blocked' | 'pending';

export interface Receipt {
  id: string;
  suite_id: string;
  office_id: string;
  domain: string;
  action_type: string;
  status: ReceiptStatus;
  created_at: string;
  correlation_id: string;
  payload: Record<string, unknown>;
  provider?: string;
  request_id?: string;
}

export interface ReceiptFilters {
  domain?: string;
  status?: ReceiptStatus;
  provider?: string;
  action_type?: string;
  suite_id?: string;
  office_id?: string;
  correlation_id?: string;
  from_date?: string;
  to_date?: string;
}

// ============================================================================
// AUTHORITY QUEUE ITEM - Approval requests awaiting decision
// ============================================================================
export type AuthorityQueueStatus = 'pending' | 'approved' | 'denied';
export type RiskLevel = 'high' | 'medium' | 'low' | 'none';

export interface AuthorityQueueItem {
  id: string;
  suite_id: string;
  office_id: string;
  status: AuthorityQueueStatus;
  risk_level: RiskLevel;
  summary: string;
  requested_at: string;
  decision_at?: string;
  decided_by?: string;
  linked_receipt_ids?: string[];
  correlation_id?: string;
  requested_by: string;
  type: string;
  customer?: string;
}

export interface AuthorityQueueFilters {
  status?: AuthorityQueueStatus;
  risk_level?: RiskLevel;
  suite_id?: string;
  office_id?: string;
  from_date?: string;
  to_date?: string;
}

// ============================================================================
// OUTBOX JOB - Execution queue for pending actions
// ============================================================================
export type OutboxJobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'retrying';

export interface OutboxJob {
  id: string;
  suite_id: string;
  office_id: string;
  status: OutboxJobStatus;
  queued_at: string;
  started_at?: string;
  finished_at?: string;
  attempts: number;
  correlation_id: string;
  action_type: string;
  provider?: string;
  error_message?: string;
}

export interface OutboxFilters {
  status?: OutboxJobStatus;
  provider?: string;
  suite_id?: string;
  office_id?: string;
  from_date?: string;
  to_date?: string;
}

// ============================================================================
// PROVIDER CALL LOG - Record of provider API calls
// ============================================================================
export type ProviderCallStatus = 'success' | 'failed' | 'timeout' | 'rate_limited';

export interface ProviderCallLog {
  id: string;
  suite_id: string;
  provider: string;
  action_type: string;
  status: ProviderCallStatus;
  started_at: string;
  finished_at: string;
  correlation_id: string;
  request_meta: Record<string, unknown>;
  response_meta: Record<string, unknown>;
  duration_ms?: number;
}

export interface ProviderCallLogFilters {
  provider?: string;
  status?: ProviderCallStatus;
  suite_id?: string;
  correlation_id?: string;
  from_date?: string;
  to_date?: string;
}

// ============================================================================
// INCIDENT - System issues requiring attention
// ============================================================================
export type IncidentSeverity = 'P0' | 'P1' | 'P2' | 'P3';
export type IncidentStatus = 'open' | 'investigating' | 'resolved' | 'closed';
export type DetectionSource = 'robot_test' | 'provider' | 'rule' | 'user_report';
export type NotificationStatus = 'yes' | 'no' | 'queued';
export type ProofStatus = 'ok' | 'missing' | 'pending';

export interface Incident {
  id: string;
  suite_id: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  created_at: string;
  updated_at: string;
  summary: string;
  linked_receipt_ids?: string[];
  correlation_id?: string;
  customer?: string;
  provider?: string;
  detection_source: DetectionSource;
  customer_notified: NotificationStatus;
  proof_status: ProofStatus;
  recommended_action?: string;
  notes?: IncidentNote[];
}

export interface IncidentNote {
  author: string;
  body: string;
  timestamp: string;
  is_llm_analysis?: boolean;
}

export interface IncidentFilters {
  severity?: IncidentSeverity;
  status?: IncidentStatus;
  suite_id?: string;
  correlation_id?: string;
  proof_status?: ProofStatus;
  from_date?: string;
  to_date?: string;
}

// ============================================================================
// PROVIDER INFO - Connected service metadata
// ============================================================================
export type ProviderConnectionStatus = 'connected' | 'degraded' | 'disconnected';
export type CapabilityScope = 'read_only' | 'writes_enabled' | 'writes_paused';

export interface ProviderInfo {
  id: string;
  name: string;
  type: string;
  connection_status: ProviderConnectionStatus;
  capability_scope: CapabilityScope;
  last_checked: string;
  latency_ms: number;
  p95_latency_ms: number;
  error_rate: number;
  scopes: string[];
  last_sync_time?: string;
  receipt_coverage_percent?: number;
  permissions_summary?: string;
}

// ============================================================================
// ECOSYSTEM SYNC - Contract synchronization status
// ============================================================================
export interface EcosystemSyncStatus {
  pack_version: string;
  contracts_loaded: boolean;
  schema_drift_detected: boolean;
  drift_warnings: string[];
  last_sync_check: string;
}
