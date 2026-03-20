import { describe, expect, it } from 'vitest';
import type { ClientEvent } from '@/lib/clientEvents';
import {
  aggregateFrontendIncidents,
  computeFrontendHealth,
  summarizeFrontendHealth,
} from '@/lib/frontendHealth';

function makeEvent(overrides: Partial<ClientEvent>): ClientEvent {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    source: overrides.source ?? 'desktop',
    severity: overrides.severity ?? 'info',
    eventType: overrides.eventType ?? 'page_view',
    message: overrides.message ?? overrides.eventType ?? 'page_view',
    correlationId: overrides.correlationId ?? null,
    metadata: overrides.metadata ?? {},
    createdAt: overrides.createdAt ?? '2026-03-20T10:00:00.000Z',
    sessionId: overrides.sessionId ?? 'session-1',
    component: overrides.component ?? null,
    pageRoute: overrides.pageRoute ?? '/home',
    release: overrides.release ?? 'desktop@abc123',
    contractId: overrides.contractId ?? null,
    flowId: overrides.flowId ?? null,
    runtime: overrides.runtime ?? 'web',
    userAgent: overrides.userAgent ?? null,
  };
}

describe('frontendHealth', () => {
  it('marks healthy surfaces when expected baseline events are present', () => {
    const health = computeFrontendHealth([
      makeEvent({ contractId: 'desktop.home', pageRoute: '/home', eventType: 'page_view' }),
      makeEvent({ contractId: 'ava.voice', component: 'AvaDock', eventType: 'dock_expand', id: '2' }),
      makeEvent({ contractId: 'ava.voice', component: 'AvaDock', eventType: 'agent_connect', id: '3' }),
      makeEvent({ contractId: 'ava.voice', component: 'AvaDock', eventType: 'chat_send', id: '4' }),
    ]);

    const home = health.find((surface) => surface.contract.id === 'desktop.home');
    const ava = health.find((surface) => surface.contract.id === 'ava.voice');

    expect(home?.status).toBe('healthy');
    expect(ava?.status).toBe('healthy');
  });

  it('groups repeated failures into a single incident fingerprint', () => {
    const incidents = aggregateFrontendIncidents([
      makeEvent({
        id: '1',
        contractId: 'ava.voice',
        component: 'AvaDock',
        eventType: 'agent_connect_retry',
        severity: 'warning',
        message: 'retrying voice connect',
      }),
      makeEvent({
        id: '2',
        contractId: 'ava.voice',
        component: 'AvaDock',
        eventType: 'agent_connect_retry',
        severity: 'warning',
        sessionId: 'session-2',
        message: 'retrying voice connect',
      }),
    ]);

    expect(incidents).toHaveLength(1);
    expect(incidents[0].count).toBe(2);
    expect(incidents[0].affectedSessions).toBe(2);
    expect(incidents[0].contractId).toBe('ava.voice');
    expect(incidents[0].likelyCause).toBe('Voice, agent, or realtime connectivity');
  });

  it('marks silent or partially instrumented surfaces as coverage gaps', () => {
    const health = computeFrontendHealth([
      makeEvent({
        id: '1',
        contractId: 'session.voice',
        pageRoute: '/session/voice',
        eventType: 'session_mode_select',
      }),
    ]);

    const voice = health.find((surface) => surface.contract.id === 'session.voice');
    const conference = health.find((surface) => surface.contract.id === 'session.conference');
    const summary = summarizeFrontendHealth(health);

    expect(voice?.status).toBe('partial');
    expect(voice?.missingEvents).toContain('mic_toggle');
    expect(conference?.status).toBe('untested');
    expect(summary.partial).toBeGreaterThan(0);
    expect(summary.untested).toBeGreaterThan(0);
  });

  it('classifies new versus preexisting incidents by release', () => {
    const incidents = aggregateFrontendIncidents([
      makeEvent({
        id: 'old-1',
        contractId: 'ava.voice',
        component: 'AvaDock',
        eventType: 'agent_connect_retry',
        severity: 'warning',
        release: 'desktop@2026.03.19',
        createdAt: '2026-03-19T10:00:00.000Z',
      }),
      makeEvent({
        id: 'new-1',
        contractId: 'ava.voice',
        component: 'AvaDock',
        eventType: 'agent_connect_retry',
        severity: 'warning',
        release: 'desktop@2026.03.20',
        createdAt: '2026-03-20T10:00:00.000Z',
      }),
      makeEvent({
        id: 'new-2',
        contractId: 'canvas.workspace',
        component: 'canvas',
        eventType: 'canvas.error',
        severity: 'error',
        release: 'desktop@2026.03.20',
        createdAt: '2026-03-20T11:00:00.000Z',
        metadata: {
          flight_recorder: [
            { event_type: 'canvas.stage_open', component: 'canvas', page_route: '/canvas', created_at: '2026-03-20T10:59:00.000Z' },
          ],
        },
      }),
    ]);

    const preexisting = incidents.find((incident) => incident.contractId === 'ava.voice' && incident.release === 'desktop@2026.03.20');
    const introduced = incidents.find((incident) => incident.contractId === 'canvas.workspace');

    expect(preexisting?.releaseStatus).toBe('preexisting');
    expect(preexisting?.affectedReleases).toBe(2);
    expect(introduced?.releaseStatus).toBe('new');
    expect(introduced?.sampleFlightRecorder).toHaveLength(1);
  });
});
