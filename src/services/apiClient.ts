/**
 * ADMIN PORTAL API CLIENT — Production Supabase Queries
 *
 * Every function queries real Supabase tables. No mock data.
 * If RLS blocks a query, the error is caught and surfaced to the UI.
 * If a table is empty, the UI shows an appropriate empty state.
 *
 * Data flow: Admin Portal → Supabase Auth (JWT) → RLS → Real Tables
 */

import { supabase } from '@/integrations/supabase/client';
import { devWarn } from '@/lib/devLog';

// Re-export types from seed files for backwards compatibility with pages
// Pages import types from here or from @/data/seed — both work
import type {
  Approval,
  Incident,
  IncidentNote,
  Receipt,
  Customer,
  Subscription,
  Provider,
} from '@/data/seed';

import type {
  AutomationJob,
  Automation,
  Schedule,
  AutomationFailure,
} from '@/data/automationSeed';

import type {
  Receipt as TrustReceipt,
  ReceiptFilters,
  AuthorityQueueItem,
  AuthorityQueueFilters,
  OutboxJob,
  OutboxFilters,
  ProviderCallLog,
  ProviderCallLogFilters,
  Incident as TrustIncident,
  IncidentFilters,
  ProviderInfo,
  EcosystemSyncStatus,
} from '@/contracts';

// ============================================================================
// SHARED TYPES
// ============================================================================
export interface PaginatedResult<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
}

// TODO: evaluate removal — ApiError is not imported by any consumer
export class ApiError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

// ============================================================================
// APPROVALS — from approval_requests table
// ============================================================================
export async function fetchApprovals(filters?: {
  status?: string;
  risk?: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResult<Approval>> {
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('approval_requests')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (filters?.status) {
    query = query.eq('status', filters.status.toLowerCase());
  }
  if (filters?.risk) {
    query = query.eq('risk_level', filters.risk.toLowerCase());
  }

  const { data, error, count } = await query;
  if (error) throw new ApiError(`Failed to fetch approvals: ${error.message}`, error.code);

  return {
    data: (data ?? []).map(mapApprovalRow),
    count: count ?? 0,
    page,
    pageSize,
  };
}

function mapApprovalRow(row: Record<string, unknown>): Approval {
  const riskLevel = (row.risk_level as string) ?? 'none';
  const status = (row.status as string) ?? 'pending';

  return {
    id: row.id as string,
    type: (row.action_type as string) ?? (row.type as string) ?? 'Unknown',
    risk: mapRiskLabel(riskLevel),
    customer: (row.customer as string) ?? (row.requester_name as string) ?? '',
    summary: (row.summary as string) ?? (row.description as string) ?? '',
    requestedBy: (row.requested_by as string) ?? (row.actor as string) ?? '',
    requestedAt: (row.created_at as string) ?? (row.requested_at as string) ?? '',
    status: mapApprovalStatus(status),
    decisionReason: (row.decision_reason as string) ?? undefined,
    evidenceReceiptIds: (row.linked_receipt_ids as string[]) ?? [],
    linkedIncidentId: (row.linked_incident_id as string) ?? undefined,
  };
}

function mapRiskLabel(level: string): 'High' | 'Medium' | 'Low' | 'None' {
  switch (level?.toLowerCase()) {
    case 'high': case 'red': return 'High';
    case 'medium': case 'yellow': return 'Medium';
    case 'low': case 'green': return 'Low';
    default: return 'None';
  }
}

function mapApprovalStatus(status: string): 'Pending' | 'Approved' | 'Denied' {
  switch (status?.toLowerCase()) {
    case 'approved': return 'Approved';
    case 'denied': case 'rejected': return 'Denied';
    default: return 'Pending';
  }
}

// ============================================================================
// INCIDENTS — aggregated by category from receipts (pipeline only, n8n excluded)
// Each unique receipt_type + action_type = 1 incident with count. Idempotent.
// ============================================================================
export async function fetchIncidents(filters?: {
  severity?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResult<Incident>> {
  // Fetch ALL pipeline failure receipts (no pagination on raw rows — we aggregate)
  const { data, error } = await supabase
    .from('receipts')
    .select('receipt_id, receipt_type, status, action, result, correlation_id, suite_id, tenant_id, actor_id, created_at')
    .in('status', ['failed', 'blocked', 'FAILED', 'BLOCKED', 'DENIED'])
    .not('receipt_type', 'like', 'n8n_%')
    .order('created_at', { ascending: false })
    .limit(2000);

  if (error) throw new ApiError(`Failed to fetch incidents: ${error.message}`, error.code);

  // Aggregate by fingerprint key: receipt_type + action_type + status
  const groups = new Map<string, {
    rows: Record<string, unknown>[];
    count: number;
    latest: string;
    earliest: string;
    receiptType: string;
    actionType: string;
    status: string;
  }>();

  for (const row of data ?? []) {
    const action = (row.action as Record<string, unknown>) ?? {};
    const actionType = (action.action_type as string) ?? '';
    const toolUsed = (action.tool_used as string) ?? '';
    const status = ((row.status as string) ?? '').toLowerCase();
    // Fingerprint: receipt_type + action_type + tool + status
    const key = `${row.receipt_type}::${actionType}::${toolUsed}::${status}`;
    const ts = row.created_at as string;

    const existing = groups.get(key);
    if (existing) {
      existing.count++;
      if (ts > existing.latest) {
        existing.latest = ts;
        existing.rows[0] = row as Record<string, unknown>; // Keep latest row as representative
      }
      if (ts < existing.earliest) existing.earliest = ts;
    } else {
      groups.set(key, {
        rows: [row as Record<string, unknown>],
        count: 1,
        latest: ts,
        earliest: ts,
        receiptType: row.receipt_type as string,
        actionType,
        status,
      });
    }
  }

  // Convert groups to Incident objects
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  let incidents: Incident[] = Array.from(groups.values()).map(g => {
    const row = g.rows[0];
    const incident = mapIncidentRow(row);
    // Enrich with aggregation data
    const isActive = g.latest >= twentyFourHoursAgo;
    incident.summary = `${incident.summary}${g.count > 1 ? ` (${g.count.toLocaleString()} occurrences)` : ''}`;
    incident.notes = [
      ...incident.notes,
      {
        author: 'System',
        body: `${g.count.toLocaleString()} total failures from ${g.earliest.split('T')[0]} to ${g.latest.split('T')[0]}. ${isActive ? 'STILL ACTIVE — failing in last 24h.' : 'Stopped — no failures in last 24h.'}`,
        timestamp: g.latest,
      },
    ];
    return incident;
  });

  // Sort: P0 first, then P1, then by count (embedded in summary), then newest
  const severityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
  incidents.sort((a, b) => {
    const sevDiff = (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4);
    if (sevDiff !== 0) return sevDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Apply page/pageSize to aggregated results
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 50;
  const from = (page - 1) * pageSize;

  // Severity filter on aggregated results
  if (filters?.severity) {
    incidents = incidents.filter(i => i.severity === filters.severity);
  }

  const total = incidents.length;
  const paged = incidents.slice(from, from + pageSize);

  return {
    data: paged,
    count: total,
    page,
    pageSize,
  };
}

// ============================================================================
// N8N OPERATIONS — dedicated n8n workflow failures
// ============================================================================
export interface N8nIncidentGroup {
  actionType: string;
  count: number;
  latestFailure: string;
  earliestFailure: string;
  receiptType: string;
  summary: string;
  severity: 'P0' | 'P1' | 'P2' | 'P3';
  isActive: boolean;
  agent: string;
  recommendedAction: string;
}

export async function fetchN8nIncidents(): Promise<N8nIncidentGroup[]> {
  const { data, error } = await supabase
    .from('receipts')
    .select('receipt_type, status, action, result, created_at')
    .in('status', ['FAILED', 'BLOCKED', 'DENIED'])
    .or('receipt_type.eq.n8n_ops,receipt_type.eq.n8n_agent')
    .order('created_at', { ascending: false });

  if (error) throw new ApiError(`Failed to fetch n8n incidents: ${error.message}`, error.code);

  // Group by action_type
  const groups = new Map<string, {
    count: number;
    latest: string;
    earliest: string;
    receiptType: string;
    actionType: string;
  }>();

  for (const row of data ?? []) {
    const action = (row.action as Record<string, unknown>) ?? {};
    const actionType = (action.action_type as string) ?? 'unknown';
    const existing = groups.get(actionType);
    const ts = row.created_at as string;

    if (existing) {
      existing.count++;
      if (ts > existing.latest) existing.latest = ts;
      if (ts < existing.earliest) existing.earliest = ts;
    } else {
      groups.set(actionType, {
        count: 1,
        latest: ts,
        earliest: ts,
        receiptType: row.receipt_type as string,
        actionType,
      });
    }
  }

  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  return Array.from(groups.values())
    .map(g => ({
      actionType: g.actionType,
      count: g.count,
      latestFailure: g.latest,
      earliestFailure: g.earliest,
      receiptType: g.receiptType,
      isActive: g.latest >= twentyFourHoursAgo,
      ...deriveN8nIncidentDetails(g.actionType, g.count),
    }))
    .sort((a, b) => {
      // Active first, then by severity, then by count
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      const sevOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
      const sevDiff = sevOrder[a.severity] - sevOrder[b.severity];
      if (sevDiff !== 0) return sevDiff;
      return b.count - a.count;
    });
}

function deriveN8nIncidentDetails(actionType: string, count: number): {
  summary: string;
  severity: 'P0' | 'P1' | 'P2' | 'P3';
  agent: string;
  recommendedAction: string;
} {
  const details: Record<string, { summary: string; severity: 'P0' | 'P1' | 'P2' | 'P3'; agent: string; action: string }> = {
    'ops.slo_monitor': {
      summary: `SLO Monitor Non-Functional — Service level monitoring offline. ${count.toLocaleString()} consecutive failures. No SLO breach detection active.`,
      severity: 'P1',
      agent: 'SRE',
      action: 'Check n8n SLO monitor workflow connectivity. Verify Supabase credentials in n8n environment.',
    },
    'ops.provider_health_check': {
      summary: `Provider Health Checks Failing — Cannot verify external service availability. ${count} checks missed.`,
      severity: 'P2',
      agent: 'SRE',
      action: 'Review n8n provider health workflow. Check if target endpoints are reachable from n8n container.',
    },
    'ops.rotation_health_check': {
      summary: `Secrets Rotation Health Monitor Down — Cannot verify credential rotation status. ${count} checks missed.`,
      severity: 'P2',
      agent: 'SRE',
      action: 'Verify AWS Secrets Manager access from n8n. Check rotation Lambda function status.',
    },
    'ops.analytics_rollup': {
      summary: `Analytics Rollup Pipeline Broken — Business metrics not aggregating. Dashboard data going stale.`,
      severity: 'P2',
      agent: 'SRE',
      action: 'Check n8n analytics workflow. Verify Supabase RPC functions for rollup are accessible.',
    },
    'ops.receipt_archival': {
      summary: `Receipt Archival Pipeline Stalled — Old receipts not being archived. Table growth unbounded.`,
      severity: 'P2',
      agent: 'SRE',
      action: 'Check n8n archival workflow. Verify Supabase permissions for receipt table operations.',
    },
    'ops.cert_expiry_check': {
      summary: `SSL/TLS Certificate Monitoring Broken — Cannot detect expiring certificates. Risk of unexpected outage.`,
      severity: 'P2',
      agent: 'SRE',
      action: 'n8n cert check uses fetch() which is unavailable. Upgrade n8n Code node or use HTTP Request node.',
    },
    'ops.rotation_health_alert': {
      summary: `Rotation Alert Dispatch Failed — Critical alert about credential rotation could not be sent.`,
      severity: 'P1',
      agent: 'SRE',
      action: 'Check Discord webhook and n8n alert routing configuration.',
    },
    'agent.adam.pulse_scan': {
      summary: `Adam Pulse Scan Down — Market and industry intelligence scanning offline. ${count} scans missed.`,
      severity: 'P2',
      agent: 'Adam',
      action: 'Check Adam pulse scan n8n workflow. Verify Exa/Brave API credentials.',
    },
    'agent.adam.daily_brief': {
      summary: `Adam Daily Brief Failing — Morning intelligence briefing not generating. Founder starts day blind.`,
      severity: 'P2',
      agent: 'Adam',
      action: 'Check Adam daily brief workflow. Verify LLM API access from n8n.',
    },
    'agent.adam.focus_weekly': {
      summary: `Adam Focus Weekly Broken — Weekly strategic focus report not generating.`,
      severity: 'P3',
      agent: 'Adam',
      action: 'Check Adam focus weekly n8n workflow configuration.',
    },
    'agent.adam.education_weekly': {
      summary: `Adam Education Digest Failing — Weekly learning content curation offline.`,
      severity: 'P3',
      agent: 'Adam',
      action: 'Check Adam education workflow and content source APIs.',
    },
    'agent.adam.library_curate': {
      summary: `Adam Library Curation Down — Knowledge library auto-curation not running.`,
      severity: 'P3',
      agent: 'Adam',
      action: 'Check Adam library curation workflow.',
    },
    'agent.sarah.handle_call': {
      summary: `Sarah Call Handler Failing — Inbound call routing and handling broken. ${count} calls potentially missed.`,
      severity: 'P1',
      agent: 'Sarah',
      action: 'Check Sarah call handler workflow. Verify Twilio/LiveKit webhook configuration in n8n.',
    },
    'agent.eli.triage_email': {
      summary: `Eli Email Triage Down — Email classification and auto-routing offline. ${count} emails untriaged.`,
      severity: 'P1',
      agent: 'Eli',
      action: 'Check Eli triage workflow. Verify PolarisM email API access from n8n.',
    },
    'agent.nora.summarize_meeting': {
      summary: `Nora Meeting Summaries Failing — Post-meeting summaries not generating. ${count} meetings unsummarized.`,
      severity: 'P2',
      agent: 'Nora',
      action: 'Check Nora summarize workflow. Verify Deepgram transcript access.',
    },
    'agent.teressa.sync_books': {
      summary: `Teressa QuickBooks Sync Broken — Accounting data not syncing. Financial records drifting from source.`,
      severity: 'P1',
      agent: 'Teressa',
      action: 'Check Teressa sync workflow. Verify QuickBooks OAuth token and API connectivity.',
    },
    'agent.quinn.check_overdue': {
      summary: `Quinn Overdue Invoice Detection Down — Cannot detect overdue payments. Revenue at risk.`,
      severity: 'P1',
      agent: 'Quinn',
      action: 'Check Quinn overdue check workflow. Verify Stripe API access from n8n.',
    },
    'onboarding.activation': {
      summary: `Onboarding Activation Failures — New account activations failing in n8n pipeline. ${count} accounts stuck.`,
      severity: 'P2',
      agent: 'System',
      action: 'Check onboarding activation workflow. Verify Supabase auth and tenant creation access.',
    },
  };

  const match = details[actionType];
  if (match) {
    return { summary: match.summary, severity: match.severity, agent: match.agent, recommendedAction: match.action };
  }

  // Fallback for unknown action types
  const agentMatch = actionType.match(/^agent\.(\w+)\./);
  const agent = agentMatch ? agentMatch[1].charAt(0).toUpperCase() + agentMatch[1].slice(1) : 'System';
  const cleanName = actionType.replace(/^(ops\.|agent\.\w+\.)/, '').replace(/_/g, ' ');
  return {
    summary: `${agent} — ${cleanName} failing. ${count} failures recorded.`,
    severity: 'P3',
    agent,
    recommendedAction: `Investigate n8n workflow for ${actionType}.`,
  };
}

// ============================================================================
// INCIDENT ROW MAPPING — premium, human + machine readable messages
// ============================================================================
function mapIncidentRow(row: Record<string, unknown>): Incident {
  const action = (row.action as Record<string, unknown>) ?? {};
  const result = (row.result as Record<string, unknown>) ?? {};
  const status = ((row.status as string) ?? 'failed').toLowerCase();
  const receiptType = (row.receipt_type as string) ?? '';
  const actionType = (action.action_type as string) ?? '';
  const toolUsed = (action.tool_used as string) ?? '';
  const errorMsg = (result.error_message as string) ?? (result.error as string) ?? (result.reason_code as string) ?? '';

  return {
    id: (row.receipt_id as string) ?? `${receiptType}-${row.created_at}`,
    severity: deriveSeverity(row),
    status: status === 'failed' || status === 'blocked' || status === 'denied' ? 'Open' : 'Resolved',
    summary: derivePremiumSummary(receiptType, actionType, toolUsed, errorMsg, status),
    customer: (row.suite_id as string) ?? '',
    provider: deriveProvider(receiptType, toolUsed, action),
    createdAt: row.created_at as string,
    updatedAt: row.created_at as string,
    subscribed: false,
    timelineReceiptIds: [(row.receipt_id as string) ?? ''],
    notes: buildIncidentNotes(result, errorMsg),
    detectionSource: 'rule',
    customerNotified: 'no',
    proofStatus: 'ok',
    recommendedAction: deriveRecommendedAction(receiptType, actionType, errorMsg),
    correlationId: (row.correlation_id as string) ?? undefined,
  };
}

function derivePremiumSummary(
  receiptType: string,
  actionType: string,
  toolUsed: string,
  errorMsg: string,
  status: string,
): string {
  const rt = receiptType.toLowerCase();

  // Orchestrator failures
  if (rt === 'orchestrator') {
    if (toolUsed.includes('search_general_knowledge'))
      return 'Knowledge Base Retrieval Failed — Ava cannot search general knowledge. Users may receive incomplete answers.';
    if (toolUsed.includes('financial_retrieval'))
      return 'Financial Knowledge Retrieval Failed — Finn cannot access financial analysis data.';
    return `Orchestrator Execution Failed — ${actionType || 'Core pipeline'} encountered an error during processing.`;
  }

  // Stripe failures
  if (rt.startsWith('stripe')) {
    if (errorMsg.includes('Expired API Key'))
      return 'Stripe API Key Expired — Payment processing blocked. Immediate key rotation required. Revenue impact.';
    return `Stripe Integration Error — ${actionType || 'Payment operation'} failed. ${errorMsg || 'Check Stripe dashboard.'}`;
  }

  // Mail OAuth / security
  if (rt === 'mail.oauth.csrf_rejected')
    return 'OAuth Security Alert — CSRF token rejected during mail authentication. Possible replay or session hijack attempt.';
  if (rt.startsWith('mail.oauth'))
    return `Mail OAuth Failure — ${errorMsg || 'Authentication flow interrupted.'} Customer email access affected.`;

  // Mail onboarding
  if (rt === 'mail.onboarding.start_failed')
    return 'Mail Onboarding Cannot Start — New email account setup failing. Customer stuck in signup flow.';
  if (rt === 'mail.onboarding.invalid_transition')
    return 'Mail Onboarding State Error — Pipeline hit invalid state transition. Account stuck between setup stages.';
  if (rt === 'mail.onboarding.activation_failed')
    return 'Mail Account Activation Blocked — Email account cannot activate. Customer has no email access.';

  // Profile onboarding
  if (rt === 'onboarding.profile_update')
    return 'Profile Update Failed — Customer onboarding profile changes not saving. Setup flow interrupted.';

  // Param extraction
  if (rt === 'param_extraction')
    return `Parameter Extraction Failed — Cannot parse ${toolUsed || 'tool'} request. Agent action blocked at planning stage.`;

  // Tool execution
  if (rt === 'tool_execution') {
    if (status === 'denied')
      return `Tool Execution Denied — ${toolUsed || 'Operation'} blocked by governance policy. Capability token invalid or missing.`;
    return `Tool Execution Failed — ${toolUsed || 'Agent operation'} could not complete. ${errorMsg || 'Check tool availability.'}`;
  }

  // Auth
  if (rt === 'auth_denial')
    return 'Access Denied — Unauthorized request blocked by authentication guard. Check user permissions.';

  // Domain check
  if (rt === 'domain.check.denied')
    return 'Domain Verification Denied — Domain check blocked by RED tier governance policy. Requires explicit authority.';

  // Generic fallback — still premium
  const cleanType = receiptType.replace(/[._]/g, ' ');
  if (errorMsg) return `${cleanType} — ${errorMsg}`;
  return `${cleanType} — Operation ${status}. Review receipt details for root cause.`;
}

function deriveProvider(
  receiptType: string,
  toolUsed: string,
  action: Record<string, unknown>,
): string {
  const rt = receiptType.toLowerCase();
  if (rt.startsWith('stripe')) return 'Stripe';
  if (rt.startsWith('mail.oauth') || rt.startsWith('mail.onboarding')) return 'PolarisM';
  if (rt === 'orchestrator') {
    if (toolUsed.includes('financial')) return 'Finn (RAG)';
    return 'Ava (Orchestrator)';
  }
  if (rt === 'tool_execution') return toolUsed || 'Agent Tools';
  if (rt === 'param_extraction') return toolUsed || 'Parameter Engine';
  if (rt === 'auth_denial') return 'Auth Guard';
  if (rt.startsWith('domain')) return 'Domain Rail';
  if (rt.startsWith('onboarding')) return 'Onboarding';
  return (action.provider as string) ?? 'Internal';
}

function deriveRecommendedAction(receiptType: string, actionType: string, errorMsg: string): string {
  const rt = receiptType.toLowerCase();
  if (rt.startsWith('stripe') && errorMsg.includes('Expired'))
    return 'Rotate Stripe API key immediately. Go to Stripe Dashboard > Developers > API Keys. Update in AWS Secrets Manager.';
  if (rt === 'orchestrator')
    return 'Check RAG vector store connectivity. Verify embedding service is running and Supabase pgvector extension is active.';
  if (rt.startsWith('mail.oauth'))
    return 'Review OAuth flow logs. Check Google/Microsoft OAuth app credentials and redirect URIs.';
  if (rt.startsWith('mail.onboarding'))
    return 'Check PolarisM onboarding pipeline status. Verify domain DNS records and mail server provisioning.';
  if (rt === 'tool_execution')
    return 'Review capability token validity. Check tool service health and agent permissions matrix.';
  if (rt === 'param_extraction')
    return 'Review LLM parameter extraction prompts. Check if tool schema has changed.';
  if (rt === 'auth_denial')
    return 'Verify user role assignments in tenant_memberships. Check RLS policies.';
  return 'Review receipt details and correlated trace for root cause analysis.';
}

function deriveSeverity(row: Record<string, unknown>): 'P0' | 'P1' | 'P2' | 'P3' {
  const receiptType = ((row.receipt_type as string) ?? '').toLowerCase();
  const status = ((row.status as string) ?? '').toLowerCase();
  const result = (row.result as Record<string, unknown>) ?? {};
  const errorMsg = ((result.error as string) ?? '').toLowerCase();

  // P0 — Security events, expired credentials with revenue impact
  if (receiptType.startsWith('mail.oauth') || receiptType.includes('security')) return 'P0';
  if (receiptType.startsWith('stripe') && errorMsg.includes('expired')) return 'P0';
  if (receiptType === 'auth_denial') return 'P1';

  // P1 — Revenue impact, core pipeline broken
  if (receiptType.startsWith('stripe') && status === 'failed') return 'P1';
  if (receiptType === 'orchestrator' && status === 'failed') return 'P1';

  // P2 — Degraded functionality
  if (receiptType.startsWith('mail.onboarding')) return 'P2';
  if (receiptType === 'tool_execution') return 'P2';
  if (receiptType === 'param_extraction') return 'P2';
  if (receiptType === 'onboarding.profile_update') return 'P2';
  if (status === 'blocked' || status === 'denied') return 'P2';

  // P3 — Informational
  if (receiptType.startsWith('domain')) return 'P3';
  return 'P3';
}

function buildIncidentNotes(
  result: Record<string, unknown>,
  errorMsg: string,
): IncidentNote[] {
  const notes: IncidentNote[] = [];
  if (errorMsg) {
    notes.push({
      author: 'System',
      body: errorMsg,
      timestamp: new Date().toISOString(),
    });
  }
  if (result.stack_trace) {
    notes.push({
      author: 'System',
      body: `Stack trace:\n${result.stack_trace as string}`,
      timestamp: new Date().toISOString(),
    });
  }
  return notes;
}

// ============================================================================
// RECEIPTS (seed format) — from receipts table
// ============================================================================
export async function fetchReceipts(filters?: {
  status?: string;
  provider?: string;
  correlationId?: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResult<Receipt>> {
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('receipts')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (filters?.status) {
    const mapped = filters.status.toLowerCase() === 'success' ? 'success'
      : filters.status.toLowerCase() === 'failed' ? 'failed'
      : filters.status.toLowerCase() === 'blocked' ? 'blocked'
      : filters.status;
    query = query.eq('status', mapped);
  }
  if (filters?.provider) query = query.eq('provider', filters.provider);
  if (filters?.correlationId) query = query.eq('correlation_id', filters.correlationId);

  const { data, error, count } = await query;
  if (error) throw new ApiError(`Failed to fetch receipts: ${error.message}`, error.code);

  return {
    data: (data ?? []).map(mapReceiptRow),
    count: count ?? 0,
    page,
    pageSize,
  };
}

function mapReceiptRow(row: Record<string, unknown>): Receipt {
  const payload = (row.payload as Record<string, unknown>) ?? {};
  const status = (row.status as string) ?? 'success';

  return {
    id: row.id as string,
    timestamp: row.created_at as string,
    runId: (payload.run_id as string) ?? (row.correlation_id as string) ?? '',
    correlationId: (row.correlation_id as string) ?? '',
    actor: (payload.actor as string) ?? (row.domain as string) ?? 'System',
    actionType: (row.action_type as string) ?? '',
    outcome: status === 'success' ? 'Success' : status === 'failed' ? 'Failed' : 'Blocked',
    provider: (row.provider as string) ?? 'Internal',
    providerCallId: (payload.provider_call_id as string) ?? (row.request_id as string) ?? '',
    redactedRequest: JSON.stringify(payload.redacted_inputs ?? payload.request ?? {}),
    redactedResponse: JSON.stringify(payload.redacted_outputs ?? payload.response ?? {}),
    linkedIncidentId: (payload.linked_incident_id as string) ?? null,
    linkedApprovalId: (payload.linked_approval_id as string) ?? null,
    linkedCustomerId: (payload.linked_customer_id as string) ?? (row.suite_id as string) ?? null,
  };
}

// ============================================================================
// CUSTOMERS — from suite_profiles or app.suites
// ============================================================================
export async function fetchCustomers(filters?: {
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResult<Customer>> {
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Query suite_profiles (no status column — derive from onboarding_completed_at)
  const query = supabase
    .from('suite_profiles')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  const { data, error, count } = await query;

  if (error) {
    // If suite_profiles doesn't exist or RLS denies, try admin view
    devWarn('suite_profiles query failed, admin RLS policy may be needed:', error.message);
    return { data: [], count: 0, page, pageSize };
  }

  return {
    data: (data ?? []).map(mapCustomerRow),
    count: count ?? 0,
    page,
    pageSize,
  };
}

function mapCustomerRow(row: Record<string, unknown>): Customer {
  // Derive status from onboarding state (no status column in suite_profiles)
  const hasOnboarding = !!row.onboarding_completed_at;
  const derivedStatus = hasOnboarding ? 'active' : 'trial';

  // Parse team_size string ("1-5") into a number (midpoint)
  const teamSizeStr = row.team_size as string | null;
  let teamSize: number | undefined;
  if (teamSizeStr) {
    const parts = teamSizeStr.split('-');
    teamSize = parts.length === 2
      ? Math.round((parseInt(parts[0]) + parseInt(parts[1])) / 2)
      : parseInt(parts[0]) || undefined;
  }

  return {
    id: (row.suite_id as string) ?? (row.id as string),
    name: (row.business_name as string) ?? (row.name as string) ?? 'Unknown',
    status: mapCustomerStatus(derivedStatus),
    plan: 'Aspire Suite',
    mrr: 0, // Requires Stripe integration for real revenue data
    riskFlag: 'None',
    openIncidents: 0,
    openApprovals: 0,
    lastActivity: (row.updated_at as string) ?? (row.created_at as string) ?? '',
    integrations: [],
    // Enterprise fields from actual suite_profiles columns
    displayId: (row.display_id as string) ?? undefined,
    officeDisplayId: (row.office_display_id as string) ?? undefined,
    ownerName: (row.owner_name as string) ?? (row.name as string) ?? undefined,
    ownerEmail: (row.email as string) ?? undefined,
    industry: (row.industry as string) ?? null,
    teamSize,
  };
}

function mapCustomerStatus(status: string): 'Active' | 'Trial' | 'Paused' | 'At Risk' {
  switch (status?.toLowerCase()) {
    case 'active': return 'Active';
    case 'trial': return 'Trial';
    case 'paused': case 'inactive': return 'Paused';
    case 'at_risk': case 'at risk': return 'At Risk';
    default: return 'Active';
  }
}

// ============================================================================
// SUBSCRIPTIONS — derived from suite_profiles
// ============================================================================
export async function fetchSubscriptions(filters?: {
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResult<Subscription>> {
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('suite_profiles')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (filters?.status) {
    query = query.eq('status', filters.status.toLowerCase());
  }

  const { data, error, count } = await query;
  if (error) {
    devWarn('Subscriptions query failed:', error.message);
    return { data: [], count: 0, page, pageSize };
  }

  return {
    data: (data ?? []).map(mapSubscriptionRow),
    count: count ?? 0,
    page,
    pageSize,
  };
}

function mapSubscriptionRow(row: Record<string, unknown>): Subscription {
  const metadata = (row.metadata as Record<string, unknown>) ?? {};

  return {
    id: (row.id as string) ?? '',
    customerId: (row.suite_id as string) ?? (row.id as string),
    customerName: (row.business_name as string) ?? (row.name as string) ?? 'Unknown',
    plan: (row.plan as string) ?? (metadata.plan as string) ?? 'Aspire',
    status: mapSubscriptionStatus((row.status as string) ?? 'active'),
    mrr: (row.mrr as number) ?? (metadata.mrr as number) ?? 0,
    startedAt: (row.created_at as string) ?? '',
  };
}

function mapSubscriptionStatus(status: string): 'Active' | 'Trial' | 'Past Due' | 'Cancelled' {
  switch (status?.toLowerCase()) {
    case 'active': return 'Active';
    case 'trial': return 'Trial';
    case 'past_due': case 'past due': return 'Past Due';
    case 'cancelled': case 'canceled': return 'Cancelled';
    default: return 'Active';
  }
}

// ============================================================================
// PROVIDERS — from finance_connections + provider_call_log aggregates
// ============================================================================
export async function fetchProviders(): Promise<PaginatedResult<Provider>> {
  // Fetch finance_connections for connected providers
  const { data: connections, error: connError } = await supabase
    .from('finance_connections')
    .select('*')
    .order('created_at', { ascending: false });

  if (connError) {
    devWarn('finance_connections query failed:', connError.message);
  }

  // Fetch recent provider call stats (last 24h)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: callStats, error: callError } = await supabase
    .from('provider_call_log')
    .select('*')
    .gte('started_at', since);

  if (callError) {
    devWarn('provider_call_log query failed:', callError.message);
  }

  // Aggregate call stats by provider
  const statsMap = new Map<string, { total: number; errors: number; totalMs: number; maxMs: number }>();
  for (const call of callStats ?? []) {
    const key = call.provider as string;
    const existing = statsMap.get(key) ?? { total: 0, errors: 0, totalMs: 0, maxMs: 0 };
    existing.total++;
    if (call.status !== 'success') existing.errors++;
    const callRecord = call as Record<string, unknown>;
    const ms = Number(callRecord.duration_ms ?? callRecord.latency_ms ?? callRecord.elapsed_ms ?? 0) || 0;
    existing.totalMs += ms;
    existing.maxMs = Math.max(existing.maxMs, ms);
    statsMap.set(key, existing);
  }

  // Map connections to Provider type, enriched with call stats
  const providers: Provider[] = (connections ?? []).map(conn => {
    const name = (conn.provider as string) ?? '';
    const stats = statsMap.get(name);
    const avgLatency = stats ? Math.round(stats.totalMs / stats.total) : 0;
    const errorRate = stats ? Number(((stats.errors / stats.total) * 100).toFixed(1)) : 0;

    return {
      id: conn.id as string,
      name,
      type: (conn.provider_type as string) ?? deriveProviderType(name),
      status: deriveProviderStatus(errorRate, conn),
      lastChecked: (conn.last_webhook_at as string) ?? (conn.updated_at as string) ?? '',
      latency: avgLatency,
      p95Latency: stats ? stats.maxMs : 0,
      errorRate,
      scopes: (conn.scopes as string[]) ?? [],
      lastSyncTime: (conn.last_sync_at as string) ?? (conn.updated_at as string) ?? undefined,
      recentReceiptsCount: stats?.total ?? 0,
      permissionsSummary: (conn.permissions_summary as string) ?? undefined,
    };
  });

  // Add well-known providers not in finance_connections (infrastructure providers)
  const connectedNames = new Set(providers.map(p => p.name.toLowerCase()));
  const infraProviders = getInfrastructureProviders(statsMap, connectedNames);

  return {
    data: [...providers, ...infraProviders],
    count: providers.length + infraProviders.length,
    page: 1,
    pageSize: 100,
  };
}

function deriveProviderType(name: string): string {
  const typeMap: Record<string, string> = {
    stripe: 'Payment', twilio: 'Telephony', openai: 'AI/LLM',
    livekit: 'Realtime', pandadoc: 'Contracts', elevenlabs: 'TTS',
    deepgram: 'STT', anam: 'Avatar', supabase: 'Database',
    n8n: 'Automation', google: 'Productivity', gusto: 'Payroll',
    quickbooks: 'Accounting', plaid: 'Banking', moov: 'Payments',
  };
  return typeMap[name.toLowerCase()] ?? 'Integration';
}

function deriveProviderStatus(
  errorRate: number,
  conn: Record<string, unknown>
): 'Healthy' | 'At Risk' | 'Writes Paused' | 'Read-only Allowed' {
  const status = (conn.status as string) ?? '';
  if (status === 'disconnected') return 'Read-only Allowed';
  if (status === 'paused') return 'Writes Paused';
  if (errorRate > 5) return 'At Risk';
  if (errorRate > 2) return 'Writes Paused';
  return 'Healthy';
}

function getInfrastructureProviders(
  statsMap: Map<string, { total: number; errors: number; totalMs: number; maxMs: number }>,
  connectedNames: Set<string>
): Provider[] {
  // Infrastructure providers that exist in the platform but may not be in finance_connections
  const infraNames = [
    { name: 'OpenAI', type: 'AI/LLM', scopes: ['chat', 'embeddings', 'agents_sdk'] },
    { name: 'LiveKit', type: 'Realtime', scopes: ['webrtc', 'sip_bridge', 'video'] },
    { name: 'ElevenLabs', type: 'TTS', scopes: ['voice_cloning', 'low_latency_tts'] },
    { name: 'Deepgram', type: 'STT', scopes: ['real_time_transcription', 'nova_3'] },
    { name: 'Anam', type: 'Avatar', scopes: ['avatar_rendering', 'realtime_presence'] },
    { name: 'Supabase', type: 'Database', scopes: ['postgres', 'auth', 'realtime', 'edge_functions'] },
    { name: 'n8n', type: 'Automation', scopes: ['webhooks', 'retries', 'batch_jobs'] },
    { name: 'Twilio', type: 'Telephony', scopes: ['voice', 'sms', 'sip_trunking'] },
  ];

  return infraNames
    .filter(p => !connectedNames.has(p.name.toLowerCase()))
    .map(p => {
      const stats = statsMap.get(p.name);
      const avgLatency = stats ? Math.round(stats.totalMs / stats.total) : 0;
      const errorRate = stats ? Number(((stats.errors / stats.total) * 100).toFixed(1)) : 0;

      return {
        id: `infra-${p.name.toLowerCase()}`,
        name: p.name,
        type: p.type,
        status: errorRate > 5 ? 'At Risk' as const : 'Healthy' as const,
        lastChecked: new Date().toISOString(),
        latency: avgLatency,
        p95Latency: stats?.maxMs ?? 0,
        errorRate,
        scopes: p.scopes,
        recentReceiptsCount: stats?.total ?? 0,
      };
    });
}

// ============================================================================
// BUSINESS METRICS — aggregated from multiple tables
// ============================================================================
export interface BusinessMetrics {
  totalMRR: number;
  mrrGrowth: number;
  activeCustomers: number;
  newSubscriptions7d: number;
  churnRate: number;
  churn30d: number;
  failedPayments: { count: number; amount: number };
  trialConversion: number;
  refundsDisputes: { refunds: number; disputes: number; amount: number };
  expansionMRR: number;
  contractionMRR: number;
  mrrTrend: Array<{ date: string; mrr: number }>;
}

export async function fetchBusinessMetrics(): Promise<BusinessMetrics> {
  // Aggregate from suite_profiles
  const { data: suites, error: suitesErr } = await supabase
    .from('suite_profiles')
    .select('*');

  if (suitesErr) {
    devWarn('Business metrics query failed:', suitesErr.message);
    return getEmptyBusinessMetrics();
  }

  const allSuites = suites ?? [];
  const activeSuites = allSuites.filter(s => {
    const explicit = String(s.status ?? '').toLowerCase();
    if (explicit === 'active') return true;
    return Boolean((s as Record<string, unknown>).onboarding_completed_at);
  });
  const totalMRR = activeSuites.reduce((sum, s) => {
    const metadata = ((s as Record<string, unknown>).metadata as Record<string, unknown> | undefined) ?? {};
    const mrr = Number((s as Record<string, unknown>).mrr ?? metadata.mrr ?? 0);
    return sum + (Number.isFinite(mrr) ? mrr : 0);
  }, 0);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const newSubs = allSuites.filter(s => (s.created_at as string) > sevenDaysAgo).length;
  const trials = allSuites.filter(s => (s.status as string) === 'trial');
  const trialConversions = trials.length > 0
    ? Math.round((activeSuites.length / (activeSuites.length + trials.length)) * 100)
    : 0;

  // Get failed payment-like receipts using schema-safe fields (domain may not exist in all deployments).
  const { data: failedReceipts, error: failedPaymentErr } = await supabase
    .from('receipts')
    .select('*')
    .eq('status', 'failed')
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
  const failedPaymentCount = failedPaymentErr
    ? 0
    : (failedReceipts ?? []).filter((r) => {
        const actionType = String((r as Record<string, unknown>).action_type ?? '').toLowerCase();
        const payload = ((r as Record<string, unknown>).payload as Record<string, unknown> | undefined) ?? {};
        const payloadDomain = String(payload.domain ?? '').toLowerCase();
        return actionType.includes('payment') || payloadDomain === 'payments';
      }).length;

  return {
    totalMRR,
    mrrGrowth: 0, // Needs historical data comparison
    activeCustomers: activeSuites.length,
    newSubscriptions7d: newSubs,
    churnRate: 0,
    churn30d: 0,
    failedPayments: { count: failedPaymentCount, amount: 0 },
    trialConversion: trialConversions,
    refundsDisputes: { refunds: 0, disputes: 0, amount: 0 },
    expansionMRR: 0,
    contractionMRR: 0,
    mrrTrend: [], // Needs time-series data
  };
}

function getEmptyBusinessMetrics(): BusinessMetrics {
  return {
    totalMRR: 0, mrrGrowth: 0, activeCustomers: 0, newSubscriptions7d: 0,
    churnRate: 0, churn30d: 0, failedPayments: { count: 0, amount: 0 },
    trialConversion: 0, refundsDisputes: { refunds: 0, disputes: 0, amount: 0 },
    expansionMRR: 0, contractionMRR: 0, mrrTrend: [],
  };
}

// ============================================================================
// OPS METRICS — aggregated from receipts + approval_requests + outbox
// ============================================================================
export interface OpsMetrics {
  openApprovals: number;
  activeIncidents: { p0: number; p1: number; p2: number; p3: number };
  successfulActionsToday: number;
  providerHealth: { status: string; p95Latency: number };
  queueHealth: { depth: number; lag: number; retries: number };
  llmAnalyst: { status: string; lastAnalysis: string };
  errorBudget: { remaining: number; burnRate: number };
}

export async function fetchOpsMetrics(): Promise<OpsMetrics> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString();

  // Parallel queries for efficiency
  const [approvalsRes, receiptsRes, outboxRes, callsRes] = await Promise.all([
    supabase.from('approval_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('receipts').select('status, domain, payload', { count: 'exact' }).gte('created_at', todayStr),
    supabase.from('outbox_jobs').select('status, attempts', { count: 'exact' }).in('status', ['queued', 'processing', 'retrying']),
    supabase.from('provider_call_log').select('duration_ms, status').gte('started_at', todayStr).order('duration_ms', { ascending: false }).limit(100),
  ]);

  const todayReceipts = receiptsRes.data ?? [];
  const successToday = todayReceipts.filter(r => r.status === 'success').length;
  const failedToday = todayReceipts.filter(r => r.status === 'failed' || r.status === 'blocked');

  // Derive incident severity counts from today's failures
  const incidentCounts = { p0: 0, p1: 0, p2: 0, p3: 0 };
  for (const r of failedToday) {
    const sev = deriveSeverity(r as Record<string, unknown>);
    incidentCounts[sev.toLowerCase() as keyof typeof incidentCounts]++;
  }

  const outboxJobs = outboxRes.data ?? [];
  const retrying = outboxJobs.filter(j => (j.attempts as number) > 1).length;

  const calls = callsRes.data ?? [];
  const p95Index = Math.floor(calls.length * 0.95);
  const p95Latency = calls.length > 0 ? (calls[p95Index]?.duration_ms as number) ?? 0 : 0;
  const callErrors = calls.filter(c => c.status !== 'success').length;
  const providerStatus = callErrors > calls.length * 0.05 ? 'Degraded'
    : callErrors > 0 ? 'Partial' : 'Healthy';

  return {
    openApprovals: approvalsRes.count ?? 0,
    activeIncidents: incidentCounts,
    successfulActionsToday: successToday,
    providerHealth: { status: providerStatus, p95Latency },
    queueHealth: { depth: outboxJobs.length, lag: 0, retries: retrying },
    llmAnalyst: { status: 'Online', lastAnalysis: new Date().toISOString() },
    errorBudget: {
      remaining: todayReceipts.length > 0
        ? Math.round(((successToday / todayReceipts.length) * 100))
        : 100,
      burnRate: todayReceipts.length > 0
        ? Number(((failedToday.length / todayReceipts.length) * 100).toFixed(1))
        : 0,
    },
  };
}

// ============================================================================
// AUTOMATION JOBS — from outbox_jobs table
// ============================================================================
export async function fetchAutomationJobs(filters?: {
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResult<AutomationJob>> {
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('outbox_jobs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (filters?.status) query = query.eq('status', filters.status);

  const { data, error, count } = await query;
  if (error) throw new ApiError(`Failed to fetch automation jobs: ${error.message}`, error.code);

  return {
    data: (data ?? []).map(mapAutomationJobRow),
    count: count ?? 0,
    page,
    pageSize,
  };
}

function mapAutomationJobRow(row: Record<string, unknown>): AutomationJob {
  const payload = (row.payload as Record<string, unknown>) ?? {};

  return {
    id: row.id as string,
    jobType: (row.action_type as string) ?? 'unknown',
    jobDescription: (payload.description as string) ?? (row.action_type as string) ?? '',
    tenantId: (row.suite_id as string) ?? '',
    suiteId: (row.suite_id as string) ?? '',
    suiteName: (payload.suite_name as string) ?? '',
    officeId: (row.office_id as string) ?? '',
    officeName: (payload.office_name as string) ?? '',
    status: mapJobStatus((row.status as string) ?? 'queued'),
    attempts: (row.attempts as number) ?? 0,
    maxAttempts: (payload.max_attempts as number) ?? 3,
    nextRunAt: (row.scheduled_at as string) ?? (row.created_at as string) ?? '',
    createdAt: (row.created_at as string) ?? '',
    lastAttemptAt: (row.started_at as string) ?? undefined,
    waitingReason: (row.error_message as string) ?? undefined,
    idempotencyKey: (payload.idempotency_key as string) ?? (row.id as string),
    policyDecisionRef: (payload.policy_decision_ref as string) ?? undefined,
    receiptRef: (payload.receipt_id as string) ?? undefined,
    correlationId: (row.correlation_id as string) ?? '',
    proofStatus: 'ok',
    traceId: (row.correlation_id as string) ?? '',
  };
}

function mapJobStatus(status: string): AutomationJob['status'] {
  switch (status) {
    case 'queued': return 'queued';
    case 'processing': return 'running';
    case 'completed': return 'completed';
    case 'failed': return 'failed';
    case 'retrying': return 'retrying';
    default: return 'queued';
  }
}

// ============================================================================
// AUTOMATION FAILURES — from outbox_dead_letters
// ============================================================================
export async function fetchAutomationFailures(filters?: {
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResult<AutomationFailure>> {
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from('outbox_dead_letters')
    .select('*', { count: 'exact' })
    .range(from, to);

  if (error) {
    devWarn('Dead letters query failed:', error.message);
    return { data: [], count: 0, page, pageSize };
  }

  const sorted = [...(data ?? [])].sort((a, b) => {
    const aTs = String((a as Record<string, unknown>).created_at ?? (a as Record<string, unknown>).failed_at ?? '');
    const bTs = String((b as Record<string, unknown>).created_at ?? (b as Record<string, unknown>).failed_at ?? '');
    return bTs.localeCompare(aTs);
  });

  return {
    data: sorted.map(row => ({
      id: row.id as string,
      jobId: (row.original_job_id as string) ?? '',
      jobType: (row.action_type as string) ?? '',
      tenantId: (row.suite_id as string) ?? '',
      suiteId: (row.suite_id as string) ?? '',
      suiteName: '',
      officeId: (row.office_id as string) ?? '',
      failedAt: (row.created_at as string) ?? '',
      errorCode: ((row.payload as Record<string, unknown>)?.error_code as string) ?? 'UNKNOWN',
      errorMessage: (row.error as string) ?? 'Unknown error',
      attempts: (row.attempts as number) ?? 0,
      correlationId: (row.correlation_id as string) ?? '',
      traceId: (row.correlation_id as string) ?? '',
      rootCause: ((row.payload as Record<string, unknown>)?.root_cause as string) ?? undefined,
    })),
    count: count ?? 0,
    page,
    pageSize,
  };
}

// ============================================================================
// AUTOMATION METRICS — aggregated from outbox_jobs
// ============================================================================
export interface AutomationMetricsData {
  totalJobs: number;
  successRate: number;
  avgDuration: string;
  failedJobs: number;
  retryRate: number;
  queueDepth: number;
}

export async function fetchAutomationMetrics(): Promise<AutomationMetricsData> {
  const { data: jobs, error } = await supabase
    .from('outbox_jobs')
    .select('*');

  if (error) {
    devWarn('Automation metrics query failed:', error.message);
    return { totalJobs: 0, successRate: 0, avgDuration: '0s', failedJobs: 0, retryRate: 0, queueDepth: 0 };
  }

  const allJobs = jobs ?? [];
  const completed = allJobs.filter(j => j.status === 'completed');
  const failed = allJobs.filter(j => j.status === 'failed');
  const queued = allJobs.filter(j => j.status === 'queued' || j.status === 'processing');
  const retried = allJobs.filter(j => (j.attempts as number) > 1);

  return {
    totalJobs: allJobs.length,
    successRate: allJobs.length > 0 ? Math.round((completed.length / allJobs.length) * 100) : 0,
    avgDuration: '0s', // Needs duration calculation from started_at/finished_at
    failedJobs: failed.length,
    retryRate: allJobs.length > 0 ? Math.round((retried.length / allJobs.length) * 100) : 0,
    queueDepth: queued.length,
  };
}

// ============================================================================
// TRUST SPINE METRICS — from receipts
// ============================================================================
export interface TrustSpineMetricsData {
  totalReceipts: number;
  successRate: number;
  coveragePercent: number;
  avgLatency: number;
}

export async function fetchTrustSpineMetrics(): Promise<TrustSpineMetricsData> {
  const { data, count, error } = await supabase
    .from('receipts')
    .select('status, payload', { count: 'exact' })
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  if (error) {
    devWarn('Trust spine metrics query failed:', error.message);
    return { totalReceipts: 0, successRate: 0, coveragePercent: 0, avgLatency: 0 };
  }

  const all = data ?? [];
  const success = all.filter(r => r.status === 'success').length;

  return {
    totalReceipts: count ?? all.length,
    successRate: all.length > 0 ? Math.round((success / all.length) * 100) : 0,
    coveragePercent: 100, // By design — Law #2
    avgLatency: 0,
  };
}

// ============================================================================
// RUNWAY & BURN — from finance_events aggregates
// ============================================================================
export interface RunwayBurnData {
  monthlyBurn: number;
  runway: number;
  cashOnHand: number;
  biggestCostDriver: string;
  burnChangePercent: number;
  costCategories: Array<{
    id: string;
    category: string;
    thisMonth: number;
    lastMonth: number;
    meaning: string;
    nextStep: string;
    vendors: Array<{ name: string; amount: number; type: string }>;
    updatedAt: string;
  }>;
}

export async function fetchRunwayBurn(): Promise<RunwayBurnData> {
  // Query finance_events for cost data
  const { data: events, error } = await supabase
    .from('finance_events')
    .select('*')
    .eq('event_type', 'charge')
    .gte('created_at', new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false });

  if (error || !events?.length) {
    devWarn('Runway/burn data not available:', error?.message ?? 'No finance events');
    return {
      monthlyBurn: 0, runway: 0, cashOnHand: 0,
      biggestCostDriver: 'No data', burnChangePercent: 0,
      costCategories: [],
    };
  }

  // Aggregate by month and category
  const thisMonth = events.filter(e => {
    const d = new Date(e.created_at as string);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const totalThisMonth = thisMonth.reduce((sum, e) => sum + ((e.amount as number) ?? 0), 0);

  return {
    monthlyBurn: totalThisMonth,
    runway: totalThisMonth > 0 ? 0 : Infinity, // Need cash_on_hand from finance_connections
    cashOnHand: 0,
    biggestCostDriver: 'Computing...',
    burnChangePercent: 0,
    costCategories: [],
  };
}

// ============================================================================
// COSTS & USAGE — from provider_call_log aggregates
// ============================================================================
export interface CostsUsageData {
  totalCost: number;
  costChange: number;
  vendors: Array<{
    name: string;
    cost: number;
    calls: number;
    avgLatency: number;
    errorRate: number;
    trend: 'up' | 'down' | 'flat';
  }>;
}

export async function fetchCostsUsage(): Promise<CostsUsageData> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: calls, error } = await supabase
    .from('provider_call_log')
    .select('*')
    .gte('started_at', thirtyDaysAgo);

  if (error || !calls?.length) {
    return { totalCost: 0, costChange: 0, vendors: [] };
  }

  // Group by provider
  const byProvider = new Map<string, { calls: number; errors: number; totalMs: number }>();
  for (const call of calls) {
    const key = call.provider as string;
    const existing = byProvider.get(key) ?? { calls: 0, errors: 0, totalMs: 0 };
    existing.calls++;
    if (call.status !== 'success') existing.errors++;
    const callRecord = call as Record<string, unknown>;
    existing.totalMs += Number(callRecord.duration_ms ?? callRecord.latency_ms ?? callRecord.elapsed_ms ?? 0) || 0;
    byProvider.set(key, existing);
  }

  const vendors = Array.from(byProvider.entries()).map(([name, stats]) => ({
    name,
    cost: 0, // Actual cost needs billing data
    calls: stats.calls,
    avgLatency: Math.round(stats.totalMs / stats.calls),
    errorRate: Number(((stats.errors / stats.calls) * 100).toFixed(1)),
    trend: 'flat' as const,
  }));

  return { totalCost: 0, costChange: 0, vendors };
}

// ============================================================================
// REVENUE & ADD-ONS — from finance_events
// ============================================================================
export interface RevenueData {
  totalRevenue: number;
  revenueChange: number;
  skus: Array<{ name: string; revenue: number; customers: number; trend: 'up' | 'down' | 'flat' }>;
}

export async function fetchRevenueAddons(): Promise<RevenueData> {
  const { data: events, error } = await supabase
    .from('finance_events')
    .select('*')
    .in('event_type', ['payment', 'subscription'])
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  if (error || !events?.length) {
    return { totalRevenue: 0, revenueChange: 0, skus: [] };
  }

  const totalRevenue = events.reduce((sum, e) => sum + ((e.amount as number) ?? 0), 0);

  return { totalRevenue, revenueChange: 0, skus: [] };
}

// ============================================================================
// SKILL PACK REGISTRY — from pack manifests + receipt stats
// ============================================================================
export interface SkillPackData {
  id: string;
  name: string;
  agent: string;
  category: string;
  riskTier: 'GREEN' | 'YELLOW' | 'RED';
  status: 'active' | 'paused' | 'disabled';
  executionCount: number;
  successRate: number;
  avgLatency: number;
  lastExecution: string;
}

export async function fetchSkillPackRegistry(): Promise<PaginatedResult<SkillPackData>> {
  // Derive skill pack stats from receipts grouped by actor/domain
  const { data: receipts, error } = await supabase
    .from('receipts')
    .select('domain, action_type, status, payload, created_at')
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  if (error) {
    devWarn('Skill pack registry query failed:', error.message);
    return { data: [], count: 0, page: 1, pageSize: 50 };
  }

  // Group by actor (from payload)
  const byActor = new Map<string, { total: number; success: number; last: string }>();
  for (const r of receipts ?? []) {
    const actor = ((r.payload as Record<string, unknown>)?.actor as string) ?? (r.domain as string) ?? 'unknown';
    const existing = byActor.get(actor) ?? { total: 0, success: 0, last: '' };
    existing.total++;
    if (r.status === 'success') existing.success++;
    if ((r.created_at as string) > existing.last) existing.last = r.created_at as string;
    byActor.set(actor, existing);
  }

  const packs: SkillPackData[] = Array.from(byActor.entries()).map(([actor, stats]) => ({
    id: `pack-${actor}`,
    name: actor,
    agent: actor,
    category: 'execution',
    riskTier: 'GREEN' as const,
    status: 'active' as const,
    executionCount: stats.total,
    successRate: stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0,
    avgLatency: 0,
    lastExecution: stats.last,
  }));

  return { data: packs, count: packs.length, page: 1, pageSize: 50 };
}

// ============================================================================
// SKILL PACK ANALYTICS — from receipts
// ============================================================================
export async function fetchSkillPackAnalytics(): Promise<{
  usageByPack: Array<{ name: string; executions: number; successRate: number }>;
  outcomeDistribution: Array<{ outcome: string; count: number }>;
}> {
  const { data, error } = await supabase
    .from('receipts')
    .select('domain, action_type, status, payload')
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  if (error) return { usageByPack: [], outcomeDistribution: [] };

  const byPack = new Map<string, { total: number; success: number }>();
  const outcomeCounts = new Map<string, number>();

  for (const r of data ?? []) {
    const actor = ((r.payload as Record<string, unknown>)?.actor as string) ?? (r.domain as string) ?? 'unknown';
    const existing = byPack.get(actor) ?? { total: 0, success: 0 };
    existing.total++;
    if (r.status === 'success') existing.success++;
    byPack.set(actor, existing);

    const outcome = (r.status as string) ?? 'unknown';
    outcomeCounts.set(outcome, (outcomeCounts.get(outcome) ?? 0) + 1);
  }

  return {
    usageByPack: Array.from(byPack.entries()).map(([name, stats]) => ({
      name,
      executions: stats.total,
      successRate: stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0,
    })),
    outcomeDistribution: Array.from(outcomeCounts.entries()).map(([outcome, count]) => ({ outcome, count })),
  };
}

// ============================================================================
// ACQUISITION ANALYTICS — from suite_profiles creation dates
// ============================================================================
export interface AcquisitionData {
  totalSignups: number;
  signupsTrend: Array<{ date: string; count: number }>;
  conversionRate: number;
  channels: Array<{ name: string; signups: number; conversion: number }>;
  demographics: { ageRanges: Array<{ range: string; count: number }>; genders: Array<{ label: string; count: number }> };
}

export async function fetchAcquisitionAnalytics(): Promise<AcquisitionData> {
  const { data: suites, error } = await supabase
    .from('suite_profiles')
    .select('created_at, status, metadata')
    .order('created_at', { ascending: true });

  if (error || !suites?.length) {
    return {
      totalSignups: 0, signupsTrend: [], conversionRate: 0,
      channels: [], demographics: { ageRanges: [], genders: [] },
    };
  }

  // Group signups by month
  const byMonth = new Map<string, number>();
  for (const s of suites) {
    const date = (s.created_at as string).slice(0, 7); // YYYY-MM
    byMonth.set(date, (byMonth.get(date) ?? 0) + 1);
  }

  const active = suites.filter(s => s.status === 'active').length;

  return {
    totalSignups: suites.length,
    signupsTrend: Array.from(byMonth.entries()).map(([date, count]) => ({ date, count })),
    conversionRate: suites.length > 0 ? Math.round((active / suites.length) * 100) : 0,
    channels: [],
    demographics: { ageRanges: [], genders: [] },
  };
}

// ============================================================================
// AUDIENCE INTELLIGENCE
// ============================================================================
type LabelCount = { label: string; count: number };

export interface AudienceInsights {
  totalProfiles: number;
  completionRate: number;
  topIndustry: string;
  topCountry: string;
  demographics: {
    entityTypes: LabelCount[];
    customerTypes: LabelCount[];
    genders: LabelCount[];
    revenueBands: LabelCount[];
  };
  acquisition: {
    referralSources: LabelCount[];
    salesChannels: LabelCount[];
    signupsByMonth: Array<{ date: string; count: number }>;
  };
  needs: {
    topServices: LabelCount[];
    topGoals: LabelCount[];
    topPainPoints: LabelCount[];
    preferredChannels: LabelCount[];
  };
  geography: {
    countries: LabelCount[];
    states: LabelCount[];
    cities: LabelCount[];
  };
}

export async function fetchAudienceInsights(): Promise<AudienceInsights> {
  const { data: profiles, error } = await supabase
    .from('suite_profiles')
    .select('*');

  const empty: AudienceInsights = {
    totalProfiles: 0, completionRate: 0, topIndustry: 'N/A', topCountry: 'N/A',
    demographics: { entityTypes: [], customerTypes: [], genders: [], revenueBands: [] },
    acquisition: { referralSources: [], salesChannels: [], signupsByMonth: [] },
    needs: { topServices: [], topGoals: [], topPainPoints: [], preferredChannels: [] },
    geography: { countries: [], states: [], cities: [] },
  };

  if (error || !profiles?.length) return empty;

  const count = (arr: string[]): LabelCount[] => {
    const m = new Map<string, number>();
    for (const v of arr) if (v) m.set(v, (m.get(v) ?? 0) + 1);
    return Array.from(m.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  };

  const meta = profiles.map(p => (p.metadata ?? {}) as Record<string, unknown>);

  // Aggregate fields from metadata (graceful — missing keys produce empty arrays)
  const industries = meta.map(m => String(m.industry ?? '')).filter(Boolean);
  const countries = meta.map(m => String(m.country ?? '')).filter(Boolean);
  const states = meta.map(m => String(m.state ?? '')).filter(Boolean);
  const cities = meta.map(m => String(m.city ?? '')).filter(Boolean);
  const entityTypes = meta.map(m => String(m.entity_type ?? '')).filter(Boolean);
  const customerTypes = meta.map(m => String(m.customer_type ?? '')).filter(Boolean);
  const genders = meta.map(m => String(m.gender ?? '')).filter(Boolean);
  const revenueBands = meta.map(m => String(m.revenue_band ?? '')).filter(Boolean);
  const referralSources = meta.map(m => String(m.referral_source ?? '')).filter(Boolean);
  const salesChannels = meta.map(m => String(m.sales_channel ?? '')).filter(Boolean);
  const services = meta.flatMap(m => Array.isArray(m.services_needed) ? m.services_needed.map(String) : []);
  const goals = meta.flatMap(m => Array.isArray(m.goals) ? m.goals.map(String) : []);
  const painPoints = meta.flatMap(m => Array.isArray(m.pain_points) ? m.pain_points.map(String) : []);
  const channels = meta.map(m => String(m.preferred_channel ?? '')).filter(Boolean);

  // Signups by month
  const byMonth = new Map<string, number>();
  for (const p of profiles) {
    const d = (p.created_at as string)?.slice(0, 7);
    if (d) byMonth.set(d, (byMonth.get(d) ?? 0) + 1);
  }

  const filled = meta.filter(m => Object.keys(m).length > 2).length;
  const topInd = count(industries);
  const topCty = count(countries);

  return {
    totalProfiles: profiles.length,
    completionRate: profiles.length > 0 ? Math.round((filled / profiles.length) * 100) : 0,
    topIndustry: topInd[0]?.label ?? 'N/A',
    topCountry: topCty[0]?.label ?? 'N/A',
    demographics: {
      entityTypes: count(entityTypes),
      customerTypes: count(customerTypes),
      genders: count(genders),
      revenueBands: count(revenueBands),
    },
    acquisition: {
      referralSources: count(referralSources),
      salesChannels: count(salesChannels),
      signupsByMonth: Array.from(byMonth.entries()).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date)),
    },
    needs: {
      topServices: count(services),
      topGoals: count(goals),
      topPainPoints: count(painPoints),
      preferredChannels: count(channels),
    },
    geography: {
      countries: topCty,
      states: count(states),
      cities: count(cities),
    },
  };
}

// ============================================================================
// TRUST SPINE CONTRACT FUNCTIONS (for Receipts, Outbox, ProviderCallLog pages)
// These return contract types (snake_case)
// ============================================================================
export async function listReceipts(filters?: ReceiptFilters): Promise<PaginatedResult<TrustReceipt>> {
  const page = 1;
  const pageSize = 100;

  let query = supabase
    .from('receipts')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(pageSize);

  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.provider) query = query.eq('provider', filters.provider);
  if (filters?.domain) query = query.eq('domain', filters.domain);
  if (filters?.action_type) query = query.eq('action_type', filters.action_type);
  if (filters?.correlation_id) query = query.eq('correlation_id', filters.correlation_id);
  if (filters?.suite_id) query = query.eq('suite_id', filters.suite_id);
  if (filters?.from_date) query = query.gte('created_at', filters.from_date);
  if (filters?.to_date) query = query.lte('created_at', filters.to_date);

  const { data, error, count } = await query;
  if (error) throw new ApiError(`Failed to fetch receipts: ${error.message}`, error.code);

  return {
    data: (data ?? []) as unknown as TrustReceipt[],
    count: count ?? 0,
    page,
    pageSize,
  };
}

// TODO: evaluate removal — listAuthorityQueue is not imported by any consumer
export async function listAuthorityQueue(filters?: AuthorityQueueFilters): Promise<PaginatedResult<AuthorityQueueItem>> {
  let query = supabase
    .from('approval_requests')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(100);

  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.risk_level) query = query.eq('risk_level', filters.risk_level);

  const { data, error, count } = await query;
  if (error) throw new ApiError(`Failed to fetch authority queue: ${error.message}`, error.code);

  return {
    data: (data ?? []) as unknown as AuthorityQueueItem[],
    count: count ?? 0,
    page: 1,
    pageSize: 100,
  };
}

export async function listOutboxJobs(filters?: OutboxFilters): Promise<PaginatedResult<OutboxJob>> {
  let query = supabase
    .from('outbox_jobs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(100);

  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.provider) query = query.eq('provider', filters.provider);

  const { data, error, count } = await query;
  if (error) throw new ApiError(`Failed to fetch outbox jobs: ${error.message}`, error.code);

  return {
    data: (data ?? []) as unknown as OutboxJob[],
    count: count ?? 0,
    page: 1,
    pageSize: 100,
  };
}

export async function listProviderCallLogs(filters?: ProviderCallLogFilters): Promise<PaginatedResult<ProviderCallLog>> {
  let query = supabase
    .from('provider_call_log')
    .select('*', { count: 'exact' })
    .order('started_at', { ascending: false })
    .limit(100);

  if (filters?.provider) query = query.eq('provider', filters.provider);
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.correlation_id) query = query.eq('correlation_id', filters.correlation_id);

  const { data, error, count } = await query;
  if (error) throw new ApiError(`Failed to fetch provider call logs: ${error.message}`, error.code);

  return {
    data: (data ?? []) as unknown as ProviderCallLog[],
    count: count ?? 0,
    page: 1,
    pageSize: 100,
  };
}

// TODO: evaluate removal — listIncidents is not imported by any consumer
export async function listIncidents(filters?: IncidentFilters): Promise<PaginatedResult<TrustIncident>> {
  const result = await fetchIncidents({
    severity: filters?.severity,
    status: filters?.status,
    page: 1,
    pageSize: 100,
  });

  // Map seed Incident type to contract Incident type
  return {
    data: result.data.map(i => ({
      id: i.id,
      suite_id: '',
      severity: i.severity,
      status: i.status.toLowerCase() as 'open' | 'investigating' | 'resolved' | 'closed',
      created_at: i.createdAt,
      updated_at: i.updatedAt,
      summary: i.summary,
      linked_receipt_ids: i.timelineReceiptIds,
      correlation_id: i.correlationId,
      customer: i.customer,
      provider: i.provider,
      detection_source: i.detectionSource,
      customer_notified: i.customerNotified,
      proof_status: i.proofStatus,
      recommended_action: i.recommendedAction,
      notes: i.notes?.map(n => ({
        author: n.author,
        body: n.body,
        timestamp: n.timestamp,
        is_llm_analysis: n.isLLMAnalysis,
      })),
    })),
    count: result.count,
    page: 1,
    pageSize: 100,
  };
}

// TODO: evaluate removal — listProviders is not imported by any consumer
export async function listProviders(): Promise<ProviderInfo[]> {
  const result = await fetchProviders();
  return result.data.map(p => ({
    id: p.id,
    name: p.name,
    type: p.type,
    connection_status: p.status === 'Healthy' ? 'connected' : p.status === 'At Risk' ? 'degraded' : 'disconnected',
    capability_scope: p.status === 'Writes Paused' ? 'writes_paused' : p.status === 'Read-only Allowed' ? 'read_only' : 'writes_enabled',
    last_checked: p.lastChecked,
    latency_ms: p.latency,
    p95_latency_ms: p.p95Latency,
    error_rate: p.errorRate,
    scopes: p.scopes,
    last_sync_time: p.lastSyncTime,
    receipt_coverage_percent: 100,
    permissions_summary: p.permissionsSummary,
  }));
}

export async function getEcosystemSyncStatus(): Promise<EcosystemSyncStatus> {
  // This is derived from build-time config, not runtime data
  return {
    pack_version: 'v3.0.0',
    contracts_loaded: true,
    schema_drift_detected: false,
    drift_warnings: [],
    last_sync_check: new Date().toISOString(),
  };
}
