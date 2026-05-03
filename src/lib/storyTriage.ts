import type { Incident } from '@/data/seed';

export type SignalClass = 'real_incident' | 'warning' | 'noise' | 'resolved';

export type SourceCategory =
  | 'security'
  | 'revenue'
  | 'provider'
  | 'orchestrator'
  | 'automation'
  | 'customer'
  | 'frontend'
  | 'database'
  | 'other';

export interface ClassifiedSignal {
  signalClass: SignalClass;
  sourceCategory: SourceCategory;
  sourceLabel: string;
  story: string;
  recommendation: string;
  isRecent: boolean;
}

export interface IncidentStory {
  title: string;
  cause: string;
  fix: string;
  impact: string;
  evidence: string;
}

export interface SourceBreakdownItem {
  category: SourceCategory;
  label: string;
  total: number;
  realIncidents: number;
  warnings: number;
  noise: number;
  resolved: number;
  lastSeen?: string;
}

const SOURCE_LABELS: Record<SourceCategory, string> = {
  security: 'Security',
  revenue: 'Revenue rails',
  provider: 'Provider calls',
  orchestrator: 'Core brain',
  automation: 'Automation',
  customer: 'User onboarding',
  frontend: 'Admin frontend',
  database: 'Database',
  other: 'Platform telemetry',
};

function normalize(value?: string | null): string {
  return String(value ?? '').trim();
}

function isUnknown(value?: string | null): boolean {
  const cleaned = normalize(value).toLowerCase();
  return (
    !cleaned ||
    cleaned === 'unknown' ||
    cleaned === 'unknown action' ||
    cleaned === 'unlabeled action' ||
    cleaned === 'no requester linked' ||
    cleaned === 'no user linked' ||
    cleaned === 'n/a'
  );
}

export function humanizeToken(value?: string | null, fallback = 'Unclassified signal'): string {
  const cleaned = normalize(value)
    .replace(/^[._-]+|[._-]+$/g, '')
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned || cleaned.toLowerCase() === 'unknown') return fallback;
  return cleaned.replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function deriveSourceCategory(receiptType?: string | null, provider?: string | null): SourceCategory {
  const rt = normalize(receiptType).toLowerCase();
  const p = normalize(provider).toLowerCase();
  const combined = `${rt} ${p}`;

  if (combined.includes('auth') || combined.includes('csrf') || combined.includes('security')) return 'security';
  if (combined.includes('stripe') || combined.includes('invoice') || combined.includes('payment') || combined.includes('quickbooks')) return 'revenue';
  if (combined.includes('dead table') || combined.includes('database') || combined.includes('postgres') || combined.includes('supabase')) return 'database';
  if (
    combined.includes('twilio') ||
    combined.includes('livekit') ||
    combined.includes('openai') ||
    combined.includes('deepgram') ||
    combined.includes('elevenlabs') ||
    combined.includes('pandadoc') ||
    combined.includes('provider')
  ) return 'provider';
  if (combined.includes('orchestrator') || combined.includes('rag') || combined.includes('brain')) return 'orchestrator';
  if (combined.includes('n8n') || combined.includes('workflow') || combined.includes('automation')) return 'automation';
  if (combined.includes('onboarding') || combined.includes('profile') || combined.includes('mail')) return 'customer';
  if (combined.includes('frontend') || combined.includes('client')) return 'frontend';
  if (combined.includes('supabase') || combined.includes('database') || combined.includes('postgres')) return 'database';

  return 'other';
}

export function sourceLabel(category: SourceCategory): string {
  return SOURCE_LABELS[category];
}

export function incidentTimestamp(incident: Incident): string {
  return incident.lastSeen || incident.updatedAt || incident.createdAt || '';
}

export function isRecentIncident(incident: Incident, hours = 24): boolean {
  const timestamp = incidentTimestamp(incident);
  if (!timestamp) return false;
  const time = new Date(timestamp).getTime();
  if (Number.isNaN(time)) return false;
  return Date.now() - time <= hours * 60 * 60 * 1000;
}

export function summarizeIncident(incident: Incident): string {
  if (!isUnknown(incident.summary) && normalize(incident.summary).length > 3) {
    return incident.summary;
  }

  const category = deriveSourceCategory(incident.receiptType, incident.provider);
  const source = sourceLabel(category);
  const receipt = humanizeToken(incident.receiptType, source);
  const provider = isUnknown(incident.provider) ? source : incident.provider;
  return `${receipt} issue from ${provider}. Review correlated receipts for the root cause.`;
}

function providerName(incident: Incident, fallback: string): string {
  return isUnknown(incident.provider) ? fallback : incident.provider;
}

function causeForCategory(incident: Incident, classification: ClassifiedSignal): string {
  const provider = providerName(incident, classification.sourceLabel);
  const receipt = humanizeToken(incident.receiptType, classification.sourceLabel).toLowerCase();
  const count = incident.occurrenceCount ?? 1;

  if (classification.signalClass === 'resolved') {
    return `${classification.sourceLabel} previously failed in ${receipt}; the active signal is closed and retained for audit.`;
  }

  switch (classification.sourceCategory) {
    case 'security':
      return `A security or auth control blocked ${receipt}; ${count} related signal${count === 1 ? '' : 's'} were grouped under this incident.`;
    case 'revenue':
      return `${provider} reported a payment, invoice, or subscription rail problem during ${receipt}.`;
    case 'provider':
      return `${provider} returned an error, timeout, or degraded response during ${receipt}.`;
    case 'orchestrator':
      return `The core brain workflow failed during ${receipt}, which means the agent path could not complete cleanly.`;
    case 'automation':
      return `An automation workflow stopped, retried, or returned a bad status during ${receipt}.`;
    case 'customer':
      return `A user-facing profile, onboarding, or communication step failed during ${receipt}.`;
    case 'frontend':
      return `The admin frontend emitted a client-side failure while handling ${receipt}.`;
    case 'database':
      return `The database layer returned a failed or delayed operation during ${receipt}.`;
    default:
      return `A platform signal failed during ${receipt}; it stays in admin logs until a suite, trace, provider, or repeated impact proves ownership.`;
  }
}

function fixForCategory(incident: Incident, classification: ClassifiedSignal): string {
  if (incident.recommendedAction && !isUnknown(incident.recommendedAction)) {
    return incident.recommendedAction;
  }

  switch (classification.sourceCategory) {
    case 'security':
      return 'Verify the admin session, allowlist, token scope, and audit entry before retrying the blocked action.';
    case 'revenue':
      return 'Open the payment trace, confirm the provider response, then retry or resolve the failed payment or invoice action.';
    case 'provider':
      return 'Open the provider call log, confirm provider status, then retry, fail over, or pause writes until the call succeeds.';
    case 'orchestrator':
      return 'Open the trace, inspect the failed tool step, then replay the workflow after the bad step is corrected.';
    case 'automation':
      return 'Open the automation run, inspect the failed node or retry state, then rerun after the trigger or credential is fixed.';
    case 'customer':
      return 'Open the user company, complete the missing profile or approval data, then retry the user-facing workflow.';
    case 'frontend':
      return 'Check the client error and route context, fix the UI path, then verify the page no longer emits the event.';
    case 'database':
      return 'Check the query, table, policy, and connection health, then retry after the failing database operation is corrected.';
    default:
      return 'Open the trace and receipt source, attach suite or provider ownership, then promote only if impact or repetition is proven.';
  }
}

export function explainIncident(incident: Incident): IncidentStory {
  const classification = classifyIncident(incident);
  const title = summarizeIncident(incident);
  const count = incident.occurrenceCount ?? 1;
  const customer = customerLabel(incident);
  const trace = incident.correlationId ? `Trace ${incident.correlationId}` : 'No trace linked';
  const receipt = humanizeToken(incident.receiptType, classification.sourceLabel);

  return {
    title,
    cause: causeForCategory(incident, classification),
    fix: fixForCategory(incident, classification),
    impact: `${incident.status} ${incident.severity} affecting ${customer}; ${count} grouped signal${count === 1 ? '' : 's'} in this story.`,
    evidence: `${classification.sourceLabel} - ${receipt} - ${trace}`,
  };
}

export function customerLabel(incident: Incident): string {
  if (!isUnknown(incident.customer)) return incident.customer;
  return 'No user linked';
}

export function classifyIncident(incident: Incident): ClassifiedSignal {
  const category = deriveSourceCategory(incident.receiptType, incident.provider);
  const label = sourceLabel(category);
  const isRecent = isRecentIncident(incident);
  const count = incident.occurrenceCount ?? 1;
  const isResolved = incident.status === 'Resolved';
  const isRepeated = count >= 3;
  const highImpactSource = ['security', 'revenue', 'provider', 'orchestrator', 'automation', 'customer'].includes(category);

  if (isResolved) {
    return {
      signalClass: 'resolved',
      sourceCategory: category,
      sourceLabel: label,
      isRecent,
      story: 'This signal is no longer active, but remains in the admin log for audit history.',
      recommendation: 'Keep it in logs and compare with future repeats before reopening.',
    };
  }

  if (incident.severity === 'P0' || incident.severity === 'P1') {
    return {
      signalClass: 'real_incident',
      sourceCategory: category,
      sourceLabel: label,
      isRecent,
      story: `${incident.severity} signal from ${label}. This is promoted immediately because it can affect trust, revenue, or core execution.`,
      recommendation: incident.recommendedAction || 'Investigate now and attach evidence receipts before marking resolved.',
    };
  }

  if (incident.severity === 'P2' && (isRepeated || (isRecent && highImpactSource))) {
    return {
      signalClass: 'real_incident',
      sourceCategory: category,
      sourceLabel: label,
      isRecent,
      story: `${label} has ${count.toLocaleString()} related failure${count === 1 ? '' : 's'}. The pattern is strong enough to treat as a real incident.`,
      recommendation: incident.recommendedAction || 'Open the incident details and follow the trace back to provider, receipt, or suite scope.',
    };
  }

  if (incident.severity === 'P2' || (incident.severity === 'P3' && isRepeated)) {
    return {
      signalClass: 'warning',
      sourceCategory: category,
      sourceLabel: label,
      isRecent,
      story: `${label} is showing a weak or early pattern. It is visible, but not promoted above real incidents yet.`,
      recommendation: 'Watch for repeats or customer impact before escalating.',
    };
  }

  return {
    signalClass: 'noise',
    sourceCategory: category,
    sourceLabel: label,
    isRecent,
    story: `${label} produced telemetry that is not actionable yet.`,
    recommendation: 'Keep it searchable in admin logs without adding it to the priority queue.',
  };
}

export function buildSourceBreakdown(incidents: Incident[]): SourceBreakdownItem[] {
  const map = new Map<SourceCategory, SourceBreakdownItem>();

  for (const incident of incidents) {
    const classification = classifyIncident(incident);
    const existing = map.get(classification.sourceCategory) ?? {
      category: classification.sourceCategory,
      label: classification.sourceLabel,
      total: 0,
      realIncidents: 0,
      warnings: 0,
      noise: 0,
      resolved: 0,
      lastSeen: undefined,
    };

    existing.total += 1;
    if (classification.signalClass === 'real_incident') existing.realIncidents += 1;
    if (classification.signalClass === 'warning') existing.warnings += 1;
    if (classification.signalClass === 'noise') existing.noise += 1;
    if (classification.signalClass === 'resolved') existing.resolved += 1;

    const ts = incidentTimestamp(incident);
    if (ts && (!existing.lastSeen || ts > existing.lastSeen)) existing.lastSeen = ts;
    map.set(classification.sourceCategory, existing);
  }

  return Array.from(map.values()).sort((a, b) => {
    const realDiff = b.realIncidents - a.realIncidents;
    if (realDiff !== 0) return realDiff;
    const warningDiff = b.warnings - a.warnings;
    if (warningDiff !== 0) return warningDiff;
    return b.total - a.total;
  });
}

export function partitionIncidents<T extends Incident>(incidents: T[]) {
  const realIncidents: T[] = [];
  const warnings: T[] = [];
  const noise: T[] = [];
  const resolved: T[] = [];

  for (const incident of incidents) {
    const classification = classifyIncident(incident).signalClass;
    if (classification === 'real_incident') realIncidents.push(incident);
    if (classification === 'warning') warnings.push(incident);
    if (classification === 'noise') noise.push(incident);
    if (classification === 'resolved') resolved.push(incident);
  }

  return { realIncidents, warnings, noise, resolved };
}
