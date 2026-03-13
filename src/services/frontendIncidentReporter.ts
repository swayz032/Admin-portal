import { buildOpsFacadeUrl, buildOpsHeaders } from '@/services/opsFacadeClient';
import { getAdminToken, getSuiteId } from '@/lib/adminAuth';

type PortalIncidentKind = 'render_error' | 'window_error' | 'unhandled_rejection';

export interface PortalIncidentInput {
  kind: PortalIncidentKind;
  title: string;
  message?: string;
  component?: string;
  severity?: 'sev1' | 'sev2' | 'sev3' | 'sev4';
  stack?: string | null;
  extras?: Record<string, unknown>;
}

function truncate(value: string | null | undefined, max = 4000): string | undefined {
  if (!value) {
    return undefined;
  }
  return value.length > max ? value.slice(0, max) : value;
}

function sanitizeMessage(value: unknown): string | undefined {
  if (value instanceof Error) {
    return truncate(value.message, 1000);
  }
  if (typeof value === 'string') {
    return truncate(value, 1000);
  }
  if (value == null) {
    return undefined;
  }

  try {
    return truncate(JSON.stringify(value), 1000);
  } catch {
    return truncate(String(value), 1000);
  }
}

function buildFingerprint(input: PortalIncidentInput): string {
  const locationPart =
    typeof window !== 'undefined'
      ? `${window.location.pathname}:${window.location.search}`
      : 'unknown-location';
  const messagePart = (input.message || input.title || 'unknown-error').toLowerCase();
  const componentPart = (input.component || 'frontend').toLowerCase();
  return `admin-portal:${input.kind}:${componentPart}:${locationPart}:${messagePart}`;
}

export async function reportPortalIncident(input: PortalIncidentInput): Promise<boolean> {
  if (!getAdminToken()) {
    return false;
  }

  const body = {
    title: truncate(input.title, 240) || 'Admin portal frontend incident',
    message: sanitizeMessage(input.message),
    severity: input.severity || 'sev2',
    state: 'open',
    source: 'admin_portal',
    component: input.component || 'frontend',
    suite_id: getSuiteId() || undefined,
    fingerprint: buildFingerprint(input),
    evidence_pack: {
      kind: input.kind,
      href: typeof window !== 'undefined' ? window.location.href : undefined,
      pathname: typeof window !== 'undefined' ? window.location.pathname : undefined,
      stack: truncate(input.stack, 6000),
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      ...input.extras,
    },
  };

  const response = await fetch(buildOpsFacadeUrl('/admin/ops/incidents/report'), {
    method: 'POST',
    headers: buildOpsHeaders({
      includeSuiteId: true,
    }),
    body: JSON.stringify(body),
    keepalive: true,
  });

  return response.ok;
}

export function captureWindowError(event: ErrorEvent): Promise<boolean> {
  return reportPortalIncident({
    kind: 'window_error',
    title: 'Admin portal uncaught window error',
    message: event.message || event.error?.message,
    stack: event.error?.stack || null,
    component: 'window',
    severity: 'sev2',
    extras: {
      filename: event.filename || undefined,
      line: event.lineno || undefined,
      column: event.colno || undefined,
    },
  });
}

export function captureUnhandledRejection(event: PromiseRejectionEvent): Promise<boolean> {
  const reason = event.reason;
  const error = reason instanceof Error ? reason : null;
  return reportPortalIncident({
    kind: 'unhandled_rejection',
    title: 'Admin portal unhandled promise rejection',
    message: sanitizeMessage(reason),
    stack: error?.stack || null,
    component: 'promise',
    severity: 'sev2',
  });
}
