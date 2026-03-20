import {
  type ClientEvent,
  getEventErrorCode,
  getEventFlightRecorder,
} from '@/lib/clientEvents';
import {
  FRONTEND_CONTRACTS,
  type FrontendContract,
} from '@/lib/frontendContracts';

export type FrontendSurfaceStatus = 'healthy' | 'degraded' | 'failing' | 'partial' | 'untested';
export type FrontendIncidentReleaseStatus = 'new' | 'preexisting' | 'single-release';
export type FrontendSurfaceReleaseStatus = 'new' | 'preexisting' | 'mixed' | 'single-release' | 'unknown';

export interface FrontendIncident {
  fingerprint: string;
  contractId: string;
  title: string;
  severity: 'critical' | 'warning' | 'info';
  eventType: string;
  route: string | null;
  component: string | null;
  release: string | null;
  count: number;
  affectedSessions: number;
  firstSeen: string;
  lastSeen: string;
  correlationId: string | null;
  sampleMessage: string;
  errorCode: string | null;
  flightRecorderCount: number;
  affectedReleases: number;
  releaseStatus: FrontendIncidentReleaseStatus;
  likelyCause: string;
  sampleFlightRecorder: Record<string, unknown>[];
}

type FrontendIncidentBucket = FrontendIncident & {
  _sessions: Set<string>;
  _releaseSignature: string;
};

export interface FrontendContractReplay {
  sessionId: string | null;
  expectedSequence: string[];
  actualSequence: string[];
  firstDivergence: string | null;
  release: string | null;
}

export interface FrontendSurfaceHealth {
  contract: FrontendContract;
  status: FrontendSurfaceStatus;
  releaseStatus: FrontendSurfaceReleaseStatus;
  totalEvents: number;
  failureCount: number;
  sessionCount: number;
  lastSeen: string | null;
  releases: string[];
  missingEvents: string[];
  likelyCause: string | null;
  sampleFlightRecorder: Record<string, unknown>[];
  activeIncidents: FrontendIncident[];
  replay: FrontendContractReplay | null;
}

function normalizeEventType(eventType: string): string {
  return eventType.startsWith('canvas.') ? eventType : eventType;
}

function routeMatches(route: string | null, prefixes: string[]): boolean {
  if (!route) return false;
  return prefixes.some((prefix) => route === prefix || route.startsWith(`${prefix}/`));
}

function componentMatches(component: string | null, hints: string[]): boolean {
  if (!component) return false;
  const normalized = component.toLowerCase();
  return hints.some((hint) => normalized.includes(hint.toLowerCase()));
}

function contractRecognizesEvent(contract: FrontendContract, eventType: string, severity: ClientEvent['severity']): boolean {
  const normalized = normalizeEventType(eventType);
  if (contract.expectedEvents.includes(eventType) || contract.failureEvents.includes(eventType)) return true;
  if (contract.expectedEvents.includes(normalized) || contract.failureEvents.includes(normalized)) return true;
  return severity === 'error' || severity === 'critical';
}

export function eventMatchesContract(event: ClientEvent, contract: FrontendContract): boolean {
  if (event.contractId && event.contractId !== contract.id) return false;
  if (event.contractId === contract.id) return true;
  if (!contractRecognizesEvent(contract, event.eventType, event.severity)) return false;
  if (routeMatches(event.pageRoute, contract.routes)) return true;
  if (componentMatches(event.component, contract.componentHints)) return true;
  return false;
}

function isFailureEvent(event: ClientEvent, contract: FrontendContract): boolean {
  if (contract.failureEvents.includes(event.eventType)) return true;
  if (contract.failureEvents.includes(normalizeEventType(event.eventType))) return true;
  return event.severity === 'error' || event.severity === 'critical';
}

function buildIncidentTitle(contract: FrontendContract, event: ClientEvent): string {
  return `${contract.label}: ${event.message || event.eventType}`;
}

function deriveIncidentSeverity(event: ClientEvent): 'critical' | 'warning' | 'info' {
  if (event.severity === 'critical' || event.severity === 'error') return 'critical';
  if (event.severity === 'warning') return 'warning';
  return 'info';
}

function deriveLikelyCause(contract: FrontendContract, event: Pick<ClientEvent, 'eventType' | 'pageRoute'>, errorCode: string | null): string {
  if (contract.id === 'auth.login') return 'Auth or session hydration';
  if (event.eventType === 'page_error') return 'Route render or client runtime';
  if (event.eventType.startsWith('agent_connect')) return 'Voice, agent, or realtime connectivity';
  if (event.eventType.startsWith('provider_')) return 'Finance provider integration';
  if (event.eventType.startsWith('canvas.')) {
    return event.eventType === 'canvas.slo_violation' ? 'Canvas performance or SLO drift' : 'Canvas workspace runtime';
  }
  if (contract.id.startsWith('session.')) return 'Session state orchestration';
  if (errorCode) return `Application error ${errorCode}`;
  if (event.pageRoute?.startsWith('/finance-hub')) return 'Finance route wiring';
  return 'Frontend contract regression';
}

function uniqueSorted(values: Iterable<string | null>): string[] {
  return [...new Set([...values].filter((value): value is string => !!value))].sort();
}

function getLatestRelease(events: ClientEvent[]): string | null {
  const latestEvent = [...events].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return latestEvent?.release ?? null;
}

function deriveSurfaceReleaseStatus(incidents: FrontendIncident[]): FrontendSurfaceReleaseStatus {
  if (!incidents.length) return 'unknown';
  const statuses = new Set(incidents.map((incident) => incident.releaseStatus));
  if (statuses.size === 1) {
    return incidents[0].releaseStatus;
  }
  return 'mixed';
}

function deriveSurfaceLikelyCause(
  contract: FrontendContract,
  status: FrontendSurfaceStatus,
  incidents: FrontendIncident[],
  missingEvents: string[],
): string | null {
  if (incidents.length > 0) return incidents[0].likelyCause;
  if (status === 'untested') return 'No telemetry observed yet';
  if (status === 'partial') {
    return missingEvents.length > 0
      ? `Missing expected signals: ${missingEvents.slice(0, 2).join(', ')}`
      : 'Partial instrumentation';
  }
  if (status === 'degraded') return 'Intermittent client failures';
  if (status === 'healthy') return null;
  return `${contract.label} needs investigation`;
}

export function aggregateFrontendIncidents(
  events: ClientEvent[],
  contracts: FrontendContract[] = FRONTEND_CONTRACTS,
): FrontendIncident[] {
  const buckets = new Map<string, FrontendIncidentBucket>();
  const latestRelease = getLatestRelease(events);
  const releaseHistory = new Map<string, Set<string>>();

  for (const event of events) {
    const contract = contracts.find((candidate) => eventMatchesContract(event, candidate));
    if (!contract || !isFailureEvent(event, contract)) continue;

    const errorCode = getEventErrorCode(event);
    const route = event.pageRoute ?? null;
    const component = event.component ?? null;
    const release = event.release ?? null;
    const fingerprint = [
      contract.id,
      release ?? 'release:unknown',
      route ?? 'route:unknown',
      component ?? 'component:unknown',
      event.eventType,
      errorCode ?? 'code:unknown',
    ].join('|');
    const releaseSignature = [
      contract.id,
      route ?? 'route:unknown',
      component ?? 'component:unknown',
      event.eventType,
      errorCode ?? 'code:unknown',
    ].join('|');

    const existing = buckets.get(fingerprint);
    const sessionId = event.sessionId ?? 'session:unknown';
    const releaseSet = releaseHistory.get(releaseSignature) ?? new Set<string>();
    if (release) releaseSet.add(release);
    releaseHistory.set(releaseSignature, releaseSet);

    if (existing) {
      existing.count += 1;
      existing.lastSeen = existing.lastSeen > event.createdAt ? existing.lastSeen : event.createdAt;
      existing.firstSeen = existing.firstSeen < event.createdAt ? existing.firstSeen : event.createdAt;
      existing.flightRecorderCount = Math.max(existing.flightRecorderCount, getEventFlightRecorder(event).length);
      if (!existing.correlationId && event.correlationId) existing.correlationId = event.correlationId;
      if (getEventFlightRecorder(event).length > existing.sampleFlightRecorder.length) {
        existing.sampleFlightRecorder = getEventFlightRecorder(event).slice(-8);
      }
      existing._sessions.add(sessionId);
      continue;
    }

    const incident: FrontendIncidentBucket = {
      fingerprint,
      contractId: contract.id,
      title: buildIncidentTitle(contract, event),
      severity: deriveIncidentSeverity(event),
      eventType: event.eventType,
      route,
      component,
      release,
      count: 1,
      affectedSessions: 1,
      firstSeen: event.createdAt,
      lastSeen: event.createdAt,
      correlationId: event.correlationId,
      sampleMessage: event.message,
      errorCode,
      flightRecorderCount: getEventFlightRecorder(event).length,
      affectedReleases: 0,
      releaseStatus: 'single-release',
      likelyCause: deriveLikelyCause(contract, event, errorCode),
      sampleFlightRecorder: getEventFlightRecorder(event).slice(-8),
      _sessions: new Set([sessionId]),
      _releaseSignature: releaseSignature,
    };
    buckets.set(fingerprint, incident);
  }

  return [...buckets.values()]
    .map((incident) => {
      const releases = releaseHistory.get(incident._releaseSignature) ?? new Set<string>();
      let releaseStatus: FrontendIncidentReleaseStatus = 'single-release';
      if (releases.size > 1) {
        releaseStatus = 'preexisting';
      } else if (
        latestRelease &&
        incident.release === latestRelease &&
        [...releaseHistory.values()].some((set) => [...set].some((value) => value !== latestRelease))
      ) {
        releaseStatus = 'new';
      }

      return {
        ...incident,
        affectedSessions: incident._sessions.size,
        affectedReleases: releases.size || (incident.release ? 1 : 0),
        releaseStatus,
      };
    })
    .sort((a, b) => {
      if (a.severity !== b.severity) {
        const rank = { critical: 0, warning: 1, info: 2 };
        return rank[a.severity] - rank[b.severity];
      }
      return a.lastSeen < b.lastSeen ? 1 : -1;
    });
}

function buildReplay(contract: FrontendContract, events: ClientEvent[]): FrontendContractReplay | null {
  if (!events.length) return null;
  const sorted = [...events].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const latestSessionId = sorted[sorted.length - 1]?.sessionId ?? null;
  const sessionEvents = latestSessionId
    ? sorted.filter((event) => event.sessionId === latestSessionId)
    : sorted;
  const actualSequence = [...new Set(sessionEvents.map((event) => event.eventType))].slice(0, 8);
  const expectedSequence = contract.expectedEvents;

  let firstDivergence: string | null = null;
  for (const expectedEvent of expectedSequence) {
    if (!actualSequence.includes(expectedEvent)) {
      firstDivergence = expectedEvent;
      break;
    }
  }

  return {
    sessionId: latestSessionId,
    expectedSequence,
    actualSequence,
    firstDivergence,
    release: sessionEvents[sessionEvents.length - 1]?.release ?? null,
  };
}

function getLastSeen(events: ClientEvent[]): string | null {
  if (!events.length) return null;
  return events.reduce((latest, event) => (event.createdAt > latest ? event.createdAt : latest), events[0].createdAt);
}

export function computeFrontendHealth(
  events: ClientEvent[],
  contracts: FrontendContract[] = FRONTEND_CONTRACTS,
): FrontendSurfaceHealth[] {
  const incidents = aggregateFrontendIncidents(events, contracts);

  return contracts.map((contract) => {
    const contractEvents = events.filter((event) => eventMatchesContract(event, contract));
    const failureCount = contractEvents.filter((event) => isFailureEvent(event, contract)).length;
    const releases = uniqueSorted(contractEvents.map((event) => event.release));
    const missingEvents = contract.expectedEvents.filter(
      (expected) => !contractEvents.some((event) => event.eventType === expected),
    );
    const activeIncidents = incidents.filter((incident) => incident.contractId === contract.id).slice(0, 5);
    const sessionCount = new Set(contractEvents.map((event) => event.sessionId).filter(Boolean)).size;

    let status: FrontendSurfaceStatus = 'healthy';
    if (contractEvents.length === 0) {
      status = 'untested';
    } else if (activeIncidents.length > 0 || failureCount >= 3) {
      status = 'failing';
    } else if (missingEvents.length > 0 && missingEvents.length < contract.expectedEvents.length) {
      status = 'partial';
    } else if (failureCount > 0) {
      status = 'degraded';
    }

    return {
      contract,
      status,
      releaseStatus: deriveSurfaceReleaseStatus(activeIncidents),
      totalEvents: contractEvents.length,
      failureCount,
      sessionCount,
      lastSeen: getLastSeen(contractEvents),
      releases,
      missingEvents,
      likelyCause: deriveSurfaceLikelyCause(contract, status, activeIncidents, missingEvents),
      sampleFlightRecorder: activeIncidents[0]?.sampleFlightRecorder ?? [],
      activeIncidents,
      replay: buildReplay(contract, contractEvents),
    };
  }).sort((a, b) => {
    const rank: Record<FrontendSurfaceStatus, number> = {
      failing: 0,
      degraded: 1,
      partial: 2,
      untested: 3,
      healthy: 4,
    };
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
    return a.contract.label.localeCompare(b.contract.label);
  });
}

export function summarizeFrontendHealth(health: FrontendSurfaceHealth[]) {
  return {
    failing: health.filter((surface) => surface.status === 'failing').length,
    degraded: health.filter((surface) => surface.status === 'degraded').length,
    partial: health.filter((surface) => surface.status === 'partial').length,
    untested: health.filter((surface) => surface.status === 'untested').length,
    healthy: health.filter((surface) => surface.status === 'healthy').length,
    newIncidents: health.flatMap((surface) => surface.activeIncidents).filter((incident) => incident.releaseStatus === 'new').length,
    preexistingIncidents: health.flatMap((surface) => surface.activeIncidents).filter((incident) => incident.releaseStatus === 'preexisting').length,
    releases: uniqueSorted(health.flatMap((surface) => surface.releases)),
    incidents: health.flatMap((surface) => surface.activeIncidents).length,
  };
}
