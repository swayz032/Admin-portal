import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reportPortalIncident } from './frontendIncidentReporter';

describe('frontendIncidentReporter', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('fails closed when no admin token is available', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(
      reportPortalIncident({
        kind: 'render_error',
        title: 'Portal crash',
        message: 'boom',
      })
    ).resolves.toBe(false);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('posts incidents through the backend ops facade with trace headers', async () => {
    sessionStorage.setItem('aspire_admin_token', 'admin-jwt');
    localStorage.setItem('aspire.admin.scope.suiteId', 'suite-123');

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ accepted: true }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await expect(
      reportPortalIncident({
        kind: 'window_error',
        title: 'Portal uncaught error',
        message: 'window failure',
        component: 'window',
        stack: 'stack trace',
      })
    ).resolves.toBe(true);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('http://localhost:8000/admin/ops/incidents/report');
    expect(init?.method).toBe('POST');
    expect(init?.keepalive).toBe(true);
    expect(init?.headers).toEqual(
      expect.objectContaining({
        'Content-Type': 'application/json',
        'X-Admin-Token': 'admin-jwt',
        'X-Suite-Id': 'suite-123',
      })
    );
    expect((init?.headers as Record<string, string>)['X-Correlation-Id']).toBeTruthy();
    expect((init?.headers as Record<string, string>)['X-Trace-Id']).toBeTruthy();
    expect(init?.body).toContain('"source":"admin_portal"');
    expect(init?.body).toContain('"component":"window"');
  });
});
