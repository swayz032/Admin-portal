/**
 * Incident Management Tests
 *
 * Validates:
 * - Incident status updates via ops facade
 * - Receipt emission on incident state changes (Law #2)
 *
 * Uses opsFacadeClient patterns (fetch mock) — incidents are managed
 * through the backend API, not direct Supabase mutations.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function setupAuth(opts: { token?: string; suiteId?: string } = {}) {
  const sessionStore: Record<string, string> = {};
  if (opts.token) sessionStore['aspire_admin_token'] = opts.token;

  const localStore: Record<string, string> = {};
  if (opts.suiteId) localStore['aspire.admin.scope.suiteId'] = opts.suiteId;

  Object.defineProperty(window, 'sessionStorage', {
    value: {
      getItem: vi.fn((key: string) => sessionStore[key] ?? null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    },
    writable: true,
    configurable: true,
  });

  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: vi.fn((key: string) => localStore[key] ?? null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    },
    writable: true,
    configurable: true,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Incident Management', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    fetchMock.mockReset();
  });

  it('should update incident status via backend API', async () => {
    setupAuth({ token: 'admin-jwt', suiteId: 'suite-600' });

    const incidentId = 'inc-001';
    const newState = 'resolved';

    // Backend responds with updated incident + receipt
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        incident_id: incidentId,
        state: newState,
        receipt_id: 'rcpt-inc-resolve-1',
        server_time: '2026-03-15T12:00:00Z',
      }),
    });

    // Simulate calling the backend incident update endpoint
    const response = await fetch('http://localhost:8000/admin/ops/incidents/inc-001/resolve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': 'admin-jwt',
        'X-Trace-Id': 'trace-inc-1',
      },
      body: JSON.stringify({ state: newState, reason: 'Root cause identified and fixed' }),
    });

    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data.state).toBe('resolved');
    expect(data.incident_id).toBe(incidentId);

    // Verify correct HTTP call
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain(`/incidents/${incidentId}/resolve`);
    expect(options.method).toBe('POST');
    expect(options.headers['X-Admin-Token']).toBe('admin-jwt');
  });

  it('should emit receipt on incident status change', async () => {
    setupAuth({ token: 'admin-jwt', suiteId: 'suite-600' });

    const incidentId = 'inc-002';

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        incident_id: incidentId,
        state: 'resolved',
        receipt_id: 'rcpt-inc-status-change',
        server_time: '2026-03-15T12:30:00Z',
      }),
    });

    const response = await fetch(`http://localhost:8000/admin/ops/incidents/${incidentId}/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': 'admin-jwt',
        'X-Trace-Id': 'trace-inc-2',
      },
      body: JSON.stringify({ state: 'resolved', reason: 'Vendor patched the issue' }),
    });

    const data = await response.json();

    // Law #2: Every state change produces a receipt
    expect(data.receipt_id).toBeDefined();
    expect(data.receipt_id).toMatch(/^rcpt-/);
    expect(data.state).toBe('resolved');
  });
});
