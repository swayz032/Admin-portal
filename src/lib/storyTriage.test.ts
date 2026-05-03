import { describe, expect, it } from 'vitest';
import type { Incident } from '@/data/seed';
import {
  buildSourceBreakdown,
  classifyIncident,
  explainIncident,
  summarizeIncident,
} from './storyTriage';

function incident(overrides: Partial<Incident> = {}): Incident {
  const now = new Date().toISOString();
  return {
    id: 'inc-1',
    severity: 'P3',
    status: 'Open',
    summary: 'Unknown',
    customer: '',
    provider: 'Internal',
    createdAt: now,
    updatedAt: now,
    subscribed: false,
    timelineReceiptIds: [],
    notes: [],
    detectionSource: 'rule',
    customerNotified: 'no',
    proofStatus: 'ok',
    receiptType: 'tool_execution',
    occurrenceCount: 1,
    lastSeen: now,
    ...overrides,
  };
}

describe('story triage', () => {
  it('promotes P0/P1 incidents immediately', () => {
    const result = classifyIncident(incident({ severity: 'P1', receiptType: 'orchestrator' }));
    expect(result.signalClass).toBe('real_incident');
    expect(result.sourceCategory).toBe('orchestrator');
  });

  it('promotes repeated recent P2 provider failures', () => {
    const result = classifyIncident(incident({
      severity: 'P2',
      receiptType: 'twilio.voice',
      provider: 'Twilio',
      occurrenceCount: 3,
    }));
    expect(result.signalClass).toBe('real_incident');
    expect(result.sourceCategory).toBe('provider');
  });

  it('keeps weak P3 signals as noise', () => {
    const result = classifyIncident(incident({
      severity: 'P3',
      receiptType: 'domain.check.denied',
      occurrenceCount: 1,
    }));
    expect(result.signalClass).toBe('noise');
  });

  it('keeps resolved incidents in history instead of promoting them', () => {
    const result = classifyIncident(incident({
      severity: 'P1',
      status: 'Resolved',
      receiptType: 'stripe.payment',
      provider: 'Stripe',
    }));
    expect(result.signalClass).toBe('resolved');
  });

  it('replaces Unknown summaries with a source-aware story', () => {
    const summary = summarizeIncident(incident({
      receiptType: 'stripe.payment',
      provider: 'Stripe',
    }));
    expect(summary).not.toContain('Unknown');
    expect(summary).toContain('Stripe');
  });

  it('builds separated source counts for story pages', () => {
    const breakdown = buildSourceBreakdown([
      incident({ id: 'security', severity: 'P0', receiptType: 'auth_denial', provider: 'Auth' }),
      incident({ id: 'resolved', status: 'Resolved', receiptType: 'stripe.payment', provider: 'Stripe' }),
      incident({ id: 'noise', severity: 'P3', receiptType: 'domain.check.denied' }),
    ]);

    expect(breakdown.reduce((sum, item) => sum + item.total, 0)).toBe(3);
    expect(breakdown.some((item) => item.realIncidents === 1)).toBe(true);
    expect(breakdown.some((item) => item.resolved === 1)).toBe(true);
    expect(breakdown.some((item) => item.noise === 1)).toBe(true);
  });

  it('turns an incident into cause, fix, impact, and evidence', () => {
    const story = explainIncident(incident({
      severity: 'P1',
      receiptType: 'twilio.voice.timeout',
      provider: 'Twilio',
      customer: 'Harbor View Dental',
      correlationId: 'corr-123',
      occurrenceCount: 4,
    }));

    expect(story.cause).toContain('Twilio');
    expect(story.fix).toContain('provider call log');
    expect(story.impact).toContain('Harbor View Dental');
    expect(story.evidence).toContain('corr-123');
  });
});
