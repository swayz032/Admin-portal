import { describe, expect, it } from 'vitest';
import type { Approval, Customer, Incident, Receipt } from '@/data/seed';
import {
  approvalBelongsToCustomer,
  incidentBelongsToCustomer,
  normalizeIdentity,
  receiptBelongsToCustomer,
} from './customerIdentity';

const customer: Customer = {
  id: '085b44ec-df39-42c9-9fe9-71dae2d9d657',
  name: 'T&Scott Remodeling and Construction LLC',
  status: 'Active',
  plan: 'Aspire Suite',
  mrr: 0,
  riskFlag: 'None',
  openIncidents: 0,
  openApprovals: 0,
  lastActivity: '2026-05-03T01:00:00.000Z',
  integrations: [],
  displayId: '130',
  ownerName: 'Tony Scott',
  ownerEmail: 'tonyscott@remodelingandconstruction.org',
};

function incident(overrides: Partial<Incident> = {}): Incident {
  return {
    id: 'inc-1',
    severity: 'P3',
    status: 'Open',
    summary: 'Alert Agent Heartbeat - operation failed',
    customer: '',
    provider: 'Internal platform',
    createdAt: '2026-05-03T01:00:00.000Z',
    updatedAt: '2026-05-03T01:00:00.000Z',
    subscribed: false,
    timelineReceiptIds: [],
    notes: [],
    detectionSource: 'rule',
    customerNotified: 'no',
    proofStatus: 'ok',
    correlationId: 'trace-platform',
    receiptType: 'alert_agent_heartbeat',
    ...overrides,
  };
}

function receipt(overrides: Partial<Receipt> = {}): Receipt {
  return {
    id: 'rcp-1',
    timestamp: '2026-05-03T01:00:00.000Z',
    runId: 'run-1',
    correlationId: 'trace-owned',
    actor: 'System',
    actionType: 'alert_agent_heartbeat',
    outcome: 'Failed',
    provider: 'Internal platform',
    providerCallId: '',
    redactedRequest: '{}',
    redactedResponse: '{}',
    linkedIncidentId: null,
    linkedApprovalId: null,
    linkedCustomerId: customer.id,
    ...overrides,
  };
}

describe('customer identity matching', () => {
  it('matches receipts only when a customer identity is explicit', () => {
    expect(receiptBelongsToCustomer(receipt(), customer)).toBe(true);
    expect(receiptBelongsToCustomer(receipt({ linkedCustomerId: 'other-suite' }), customer)).toBe(false);
  });

  it('does not attach platform incidents to a company through summary text', () => {
    const platformIncident = incident({
      summary: `Open P3 affecting ${customer.id}; 823 grouped platform signals`,
      customer: '',
    });

    expect(incidentBelongsToCustomer(platformIncident, customer)).toBe(false);
  });

  it('allows trace matching only after a company receipt proves the trace', () => {
    const linkedTraceIds = new Set([normalizeIdentity(receipt().correlationId)]);

    expect(incidentBelongsToCustomer(incident({ correlationId: 'trace-owned' }), customer, linkedTraceIds)).toBe(true);
    expect(incidentBelongsToCustomer(incident({ correlationId: 'trace-platform' }), customer, linkedTraceIds)).toBe(false);
  });

  it('keeps approvals linked by exact company or owner context', () => {
    const approval: Approval = {
      id: 'approval-1',
      type: 'Approval decision',
      risk: 'None',
      customer: customer.name,
      summary: 'Approval decision is waiting for the company owner',
      requestedBy: 'Authority policy',
      requestedAt: '2026-05-03T01:00:00.000Z',
      status: 'Pending',
      evidenceReceiptIds: [],
    };

    expect(approvalBelongsToCustomer(approval, customer)).toBe(true);
  });
});
