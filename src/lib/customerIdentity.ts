import type { Approval, Customer, Incident, Receipt } from '@/data/seed';
import type { ProviderCallLog } from '@/contracts';

const PLACEHOLDER_VALUES = new Set([
  'unknown',
  'unknown action',
  'unlabeled',
  'unlabeled action',
  'unlinked',
  'unlinked company',
  'no requester linked',
  'no user linked',
  'no company linked',
  'n/a',
  'na',
  'none',
  'null',
  'undefined',
]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface CustomerIdentity {
  exactIds: string[];
  labels: string[];
  emails: string[];
}

export function normalizeIdentity(value?: string | number | null): string {
  return String(value ?? '').trim().toLowerCase();
}

export function isPlaceholderIdentity(value?: string | number | null): boolean {
  const normalized = normalizeIdentity(value);
  return !normalized || PLACEHOLDER_VALUES.has(normalized) || normalized.startsWith('unknown ');
}

function addUnique(target: string[], value?: string | number | null) {
  const normalized = normalizeIdentity(value);
  if (!isPlaceholderIdentity(normalized) && !target.includes(normalized)) {
    target.push(normalized);
  }
}

function boundedIncludes(haystack: string, token: string): boolean {
  if (!token) return false;
  if (UUID_PATTERN.test(token)) return haystack.includes(token);
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(haystack);
}

function exactOrBounded(value: string | undefined | null, tokens: string[]): boolean {
  const normalized = normalizeIdentity(value);
  if (isPlaceholderIdentity(normalized)) return false;
  return tokens.some((token) => normalized === token || boundedIncludes(normalized, token));
}

function exactOnly(value: string | undefined | null, tokens: string[]): boolean {
  const normalized = normalizeIdentity(value);
  if (isPlaceholderIdentity(normalized)) return false;
  return tokens.some((token) => normalized === token);
}

function textMentionsLabel(value: string | undefined | null, identity: CustomerIdentity): boolean {
  const normalized = normalizeIdentity(value);
  if (isPlaceholderIdentity(normalized)) return false;

  return [
    ...identity.emails,
    ...identity.labels.filter((label) => label.length >= 6),
  ].some((label) => boundedIncludes(normalized, label));
}

function traceMatches(value: string | undefined | null, traceIds: Set<string>): boolean {
  const normalized = normalizeIdentity(value);
  return Boolean(normalized && traceIds.has(normalized));
}

export function buildCustomerIdentity(customer: Customer): CustomerIdentity {
  const exactIds: string[] = [];
  const labels: string[] = [];
  const emails: string[] = [];

  addUnique(exactIds, customer.id);
  addUnique(exactIds, customer.displayId);
  addUnique(exactIds, customer.displayId ? `STE-${customer.displayId}` : null);
  addUnique(exactIds, customer.officeDisplayId);
  addUnique(exactIds, customer.officeDisplayId ? `OFF-${customer.officeDisplayId}` : null);

  addUnique(labels, customer.name);
  addUnique(labels, customer.ownerName);
  addUnique(emails, customer.ownerEmail);

  return { exactIds, labels, emails };
}

export function approvalBelongsToCustomer(approval: Approval, customer: Customer): boolean {
  const identity = buildCustomerIdentity(customer);
  return (
    exactOrBounded(approval.customer, [...identity.exactIds, ...identity.labels, ...identity.emails]) ||
    exactOrBounded(approval.requestedBy, [...identity.exactIds, ...identity.emails]) ||
    textMentionsLabel(approval.summary, identity)
  );
}

export function receiptBelongsToCustomer(receipt: Receipt, customer: Customer): boolean {
  const identity = buildCustomerIdentity(customer);
  return (
    exactOrBounded(receipt.linkedCustomerId ?? undefined, identity.exactIds) ||
    exactOnly(receipt.actor, identity.emails) ||
    exactOnly(receipt.actor, identity.labels)
  );
}

export function incidentBelongsToCustomer(
  incident: Incident,
  customer: Customer,
  linkedTraceIds: Set<string> = new Set(),
): boolean {
  const identity = buildCustomerIdentity(customer);
  return (
    exactOrBounded(incident.customer, [...identity.exactIds, ...identity.labels, ...identity.emails]) ||
    traceMatches(incident.correlationId ?? null, linkedTraceIds)
  );
}

function metadataBelongsToCustomer(meta: Record<string, unknown>, identity: CustomerIdentity): boolean {
  const candidateKeys = [
    'suite_id',
    'tenant_id',
    'customer_id',
    'linked_customer_id',
    'company_id',
    'business_id',
    'owner_email',
    'email',
  ];

  return candidateKeys.some((key) => {
    const value = meta[key];
    if (typeof value !== 'string') return false;
    if (key.includes('email')) return exactOnly(value, identity.emails);
    return exactOrBounded(value, identity.exactIds);
  });
}

export function providerCallBelongsToCustomer(
  call: ProviderCallLog,
  customer: Customer,
  linkedTraceIds: Set<string> = new Set(),
): boolean {
  const identity = buildCustomerIdentity(customer);
  return (
    exactOrBounded(call.suite_id, identity.exactIds) ||
    traceMatches(call.correlation_id, linkedTraceIds) ||
    metadataBelongsToCustomer(call.request_meta, identity) ||
    metadataBelongsToCustomer(call.response_meta, identity)
  );
}
